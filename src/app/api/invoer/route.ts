import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CHECKIN_COOKIE, isAuthorized } from "@/lib/checkinAuth";
import { insertCheckin } from "@/lib/checkins";
import { parseRouteSlug } from "@/lib/routes";
import { parsePartySlug } from "@/lib/parties";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const authorized = isAuthorized(cookieStore.get(CHECKIN_COOKIE)?.value);

  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  const legNr = typeof body?.leg_nr === "number" ? body.leg_nr : null;
  const invoerder = typeof body?.invoerder === "string" ? body.invoerder.trim() : "";

  if (legNr === null || !invoerder) {
    return NextResponse.json(
      { ok: false, error: "Leg en naam invoerder zijn verplicht." },
      { status: 400 },
    );
  }

  const tijdstip =
    typeof body?.tijdstip === "string" && !Number.isNaN(new Date(body.tijdstip).getTime())
      ? new Date(body.tijdstip).toISOString()
      : new Date().toISOString();
  const lat = typeof body?.lat === "number" && !Number.isNaN(body.lat) ? body.lat : null;
  const lon = typeof body?.lon === "number" && !Number.isNaN(body.lon) ? body.lon : null;
  const notitieRaw = typeof body?.notitie === "string" ? body.notitie.trim() : "";

  const route = parseRouteSlug(body?.route);

  try {
    await insertCheckin({
      route,
      party: parsePartySlug(route, body?.party),
      tijdstip,
      leg_nr: legNr,
      lat,
      lon,
      notitie: notitieRaw || null,
      invoerder,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
