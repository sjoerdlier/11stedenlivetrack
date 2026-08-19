import { getSql } from "./db";
import type { RouteSlug } from "./routes";

export interface LivePositionRow {
  party: string;
  lat: number;
  lon: number;
  recordedAt: string;
}

// One row per (route, party) — only ever the *latest* reported position, not
// a full track history. The Android tracker app (and the Traccar-based GPS
// tracker path) upsert this via /api/live and /api/live/traccar roughly
// every 30s; the map treats a row as usable only while it's recent (see
// LIVE_POSITION_MAX_AGE_MS in liveMarker.ts) and falls back to the
// check-in-based estimate otherwise. Returned as a plain array (like
// loadCheckins) rather than a Map, so it can cross the server/client prop
// boundary the same way checkins already does — client components build
// whatever per-party lookup they need from it.
export async function loadLivePositions(route: RouteSlug): Promise<LivePositionRow[]> {
  const sql = getSql();
  try {
    const rows = (await sql`
      select party, lat::float8 as lat, lon::float8 as lon, recorded_at
      from live_positions
      where route = ${route}
    `) as { party: string; lat: number; lon: number; recorded_at: string }[];
    return rows.map((row) => ({
      party: row.party,
      lat: Number(row.lat),
      lon: Number(row.lon),
      recordedAt: row.recorded_at,
    }));
  } catch (err) {
    console.error(`loadLivePositions(${route}): query failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    throw new Error(`Kon live posities niet laden uit de database: ${message}`);
  }
}

export async function saveLivePosition(
  route: RouteSlug,
  party: string,
  lat: number,
  lon: number,
  recordedAt: string,
): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      insert into live_positions (route, party, lat, lon, recorded_at, received_at)
      values (${route}, ${party}, ${lat}, ${lon}, ${recordedAt}, now())
      on conflict (route, party) do update set
        lat = excluded.lat, lon = excluded.lon,
        recorded_at = excluded.recorded_at, received_at = excluded.received_at
    `;
  } catch (err) {
    console.error(`saveLivePosition(route=${route}, party=${party}): query failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    throw new Error(`Kon live positie niet opslaan: ${message}`);
  }
}
