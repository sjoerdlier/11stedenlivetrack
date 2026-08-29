import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CHECKIN_COOKIE, isAuthorized } from "@/lib/checkinAuth";
import { insertCheckin, updateCheckinTijdstip } from "@/lib/checkins";
import { parseRouteSlug } from "@/lib/routes";
import { parsePartySlug } from "@/lib/parties";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const authorized = await isAuthorized(cookieStore.get(CHECKIN_COOKIE)?.value);

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
    console.error("POST /api/invoer: insertCheckin failed", err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Corrects a single check-in's tijdstip after the fact -- e.g. a screenshot
// relayed through chat had the wrong time typed in, or the person entering
// it mixed up two updates. Deliberately narrow (tijdstip only, not leg/notitie)
// -- that's the specific gap this was asked to close, not a general edit form.
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const authorized = await isAuthorized(cookieStore.get(CHECKIN_COOKIE)?.value);

  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  const id = typeof body?.id === "string" && body.id ? body.id : null;
  const route = parseRouteSlug(body?.route);
  const tijdstip =
    typeof body?.tijdstip === "string" && !Number.isNaN(new Date(body.tijdstip).getTime())
      ? new Date(body.tijdstip).toISOString()
      : null;

  if (!id || !tijdstip) {
    return NextResponse.json({ ok: false, error: "id en een geldig tijdstip zijn verplicht." }, { status: 400 });
  }

  try {
    await updateCheckinTijdstip(id, route, tijdstip);
  } catch (err) {
    console.error(`PATCH /api/invoer: updateCheckinTijdstip failed (id=${id})`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
