import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

// One-time correction for four legs whose afstand_km came from a
// hand-written loopschema PDF that turned out to have four legs
// significantly wrong (two too short, two too long -- they roughly
// cancelled out in the route *total*, which is why nobody had noticed).
// Verified by matching each checkpoint against the real route.gpx track and
// measuring the actual distance along it (see the chat session this was
// built from). afstand_km values below are those GPX measurements, rounded
// to one decimal to match this table's existing convention.
//
// Recomputes cumulatief_start_km for every leg on the route from nr 1
// forward, not just the four overridden ones -- afstand_km is
// forward-looking (CLAUDE.md), so cumulatief_start_km is a running sum and
// a single leg's correction shifts every leg after it, including the
// finish row.
//
// Gated by FIX_LEGS_TOKEN, a one-off secret set temporarily in Vercel's
// Environment Variables (never committed) -- delete this whole route once
// run and verified, same lifecycle as the earlier migrate-db-once route.
const ROUTE = "11steden";

const AFSTAND_OVERRIDES: Record<number, number> = {
  12: 7.34, // Bolsward -> Witmarsum (loopschema said 3.0)
  14: 9.97, // Harlingen -> Franeker (loopschema said 7.5)
  17: 7.37, // St. Anna Parochie -> Finkum/Hijum (loopschema said 14.5)
  21: 6.66, // Bartlehiem (2nd pass) -> Lekkum (loopschema said 10.0)
};

export async function POST(request: Request) {
  const token = request.headers.get("x-fix-legs-token");
  if (!token || token !== process.env.FIX_LEGS_TOKEN) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd." }, { status: 401 });
  }

  const sql = getSql();

  try {
    const rows = (await sql`
      select nr, afstand_km::float8 as afstand_km, cumulatief_start_km::float8 as cumulatief_start_km
      from legs
      where route = ${ROUTE}
      order by nr asc
    `) as { nr: number; afstand_km: number | null; cumulatief_start_km: number }[];

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: `Geen legs gevonden voor route ${ROUTE}.` }, { status: 404 });
    }

    let running = 0;
    const log: Record<string, unknown>[] = [];

    for (const row of rows) {
      const newCumulatief = Math.round(running * 10) / 10;
      const newAfstand = AFSTAND_OVERRIDES[row.nr] ?? row.afstand_km;

      log.push({
        nr: row.nr,
        afstand_was: row.afstand_km,
        afstand_now: newAfstand,
        cumulatief_was: row.cumulatief_start_km,
        cumulatief_now: newCumulatief,
      });

      await sql`
        update legs
        set afstand_km = ${newAfstand}, cumulatief_start_km = ${newCumulatief}
        where route = ${ROUTE} and nr = ${row.nr}
      `;

      if (newAfstand !== null) running += newAfstand;
    }

    return NextResponse.json({ ok: true, log });
  } catch (err) {
    console.error("POST /api/fix-leg-distances-once: failed", err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
