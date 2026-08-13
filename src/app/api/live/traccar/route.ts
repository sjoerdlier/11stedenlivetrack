import { NextResponse } from "next/server";
import { saveLivePosition } from "@/lib/livePositions";
import { loadSetting } from "@/lib/settings";
import { parseRouteSlug } from "@/lib/routes";
import { liveTokenSettingKey, parsePartySlug } from "@/lib/parties";

// Called by our self-hosted Traccar instance's Position Forwarding feature
// (forward.type=json), not by a tracker device directly — Traccar already
// decoded the device's raw protocol (GT06/365GPS) into its own JSON shape,
// so this route's only job is translating that into the {route, party, lat,
// lon, recordedAt} shape /api/live already expects, then handing off to the
// same saveLivePosition() call — same table, same freshness gate, same map
// marker, no changes needed anywhere downstream.
//
// route/party are read from the query string (set once in traccar.xml's
// forward.url, e.g. "...?route=11steden&party=team"), not from the JSON
// body — Traccar's payload has no concept of them, and one Traccar
// deployment can forward several devices to different URLs this way.
//
// Reuses the same live-tracking token as the Android app for the same
// (route, party): both are just alternate ways of reporting the same
// person's position, not simultaneous independent trackers, so one token
// slot per party is correct, not a gap.
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const route = parseRouteSlug(searchParams.get("route") ?? undefined);
  const party = parsePartySlug(route, searchParams.get("party") ?? undefined);

  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  let expectedToken: string | null;
  try {
    expectedToken = await loadSetting(liveTokenSettingKey(route, party));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  if (!expectedToken || !bearerToken || bearerToken !== expectedToken) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  // Traccar's forward.type=json wraps the position in a "position" key
  // alongside a "device" key — but tolerate a bare position object too, in
  // case a future Traccar version (or a manual test POST) sends one flat.
  const position = body?.position ?? body;

  const lat = typeof position?.latitude === "number" ? position.latitude : NaN;
  const lon = typeof position?.longitude === "number" ? position.longitude : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { ok: false, error: "latitude/longitude zijn verplicht en moeten getallen zijn." },
      { status: 400 },
    );
  }

  const fixTime =
    typeof position?.fixTime === "string"
      ? position.fixTime
      : typeof position?.deviceTime === "string"
        ? position.deviceTime
        : null;
  const recordedAt =
    fixTime && !Number.isNaN(new Date(fixTime).getTime()) ? new Date(fixTime).toISOString() : new Date().toISOString();

  try {
    await saveLivePosition(route, party, lat, lon, recordedAt);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
