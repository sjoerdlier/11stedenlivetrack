import { NextResponse } from "next/server";
import { saveLivePosition } from "@/lib/livePositions";
import { loadSetting } from "@/lib/settings";
import { parseRouteSlug } from "@/lib/routes";
import { liveTokenSettingKey, parsePartySlug } from "@/lib/parties";
import { timingSafeStringEqual } from "@/lib/checkinAuth";

// Called by the Android tracker app, not a browser — auth is a bearer token
// per (route, party) rather than the /invoer PIN-cookie flow, since there's
// no session to keep alive between requests. A party with no token set in
// /beheer has no valid token to compare against, so it's closed by default,
// not open with a guessable key.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const route = parseRouteSlug(body?.route);
  const party = parsePartySlug(route, body?.party);

  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  let expectedToken: string | null;
  try {
    expectedToken = await loadSetting(liveTokenSettingKey(route, party));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  if (!expectedToken || !bearerToken || !timingSafeStringEqual(bearerToken, expectedToken)) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd." }, { status: 401 });
  }

  const lat = typeof body?.lat === "number" ? body.lat : NaN;
  const lon = typeof body?.lon === "number" ? body.lon : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ ok: false, error: "lat/lon zijn verplicht en moeten getallen zijn." }, { status: 400 });
  }

  const recordedAt =
    typeof body?.recordedAt === "string" && !Number.isNaN(new Date(body.recordedAt).getTime())
      ? new Date(body.recordedAt).toISOString()
      : new Date().toISOString();

  try {
    await saveLivePosition(route, party, lat, lon, recordedAt);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
