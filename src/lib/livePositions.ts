import { getSql } from "./db";
import type { RouteSlug } from "./routes";

export interface LivePositionRow {
  party: string;
  lat: number;
  lon: number;
  recordedAt: string;
}

// Append-only history now (primary key (route, party, recorded_at), not
// (route, party)) — the Android tracker app, Traccar, and the gps666.net
// bridge script all insert via /api/live and /api/live/traccar roughly
// every 30s (or whenever a device actually has a new fix, which for some
// trackers is far sparser). Keeping every row, not just the latest, is what
// lets liveTrackProgress.ts derive a real distance-travelled/pace from GPS
// alone instead of requiring a check-in for every leg — see that file's
// header comment for why. loadLivePositions still only ever returns the
// *latest* row per party (unchanged contract for the map's live-dot
// consumers); loadLivePositionHistory is the new one, for one party's
// recent trail.
export async function loadLivePositions(route: RouteSlug): Promise<LivePositionRow[]> {
  const sql = getSql();
  try {
    const rows = (await sql`
      select distinct on (party) party, lat::float8 as lat, lon::float8 as lon, recorded_at
      from live_positions
      where route = ${route}
      order by party, recorded_at desc
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

// One party's recent trail, oldest first — same "since" windowing pattern
// as nothing else in this codebase needs (checkins/legs are small enough to
// load in full), because this table can grow to hundreds of rows per party
// over a 32-hour event. Used by liveTrackProgress.ts to derive both the
// current snapped position (the newest row) and a pace (the spread across
// the window) without an unbounded query.
export async function loadLivePositionHistory(
  route: RouteSlug,
  party: string,
  sinceIso: string,
): Promise<LivePositionRow[]> {
  const sql = getSql();
  try {
    const rows = (await sql`
      select party, lat::float8 as lat, lon::float8 as lon, recorded_at
      from live_positions
      where route = ${route} and party = ${party} and recorded_at >= ${sinceIso}
      order by recorded_at asc
    `) as { party: string; lat: number; lon: number; recorded_at: string }[];
    return rows.map((row) => ({
      party: row.party,
      lat: Number(row.lat),
      lon: Number(row.lon),
      recordedAt: row.recorded_at,
    }));
  } catch (err) {
    console.error(`loadLivePositionHistory(${route}, ${party}): query failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    throw new Error(`Kon live positiegeschiedenis niet laden uit de database: ${message}`);
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
      on conflict (route, party, recorded_at) do nothing
    `;
  } catch (err) {
    console.error(`saveLivePosition(route=${route}, party=${party}): query failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    throw new Error(`Kon live positie niet opslaan: ${message}`);
  }
}
