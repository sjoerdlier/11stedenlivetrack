import { createClient } from "@supabase/supabase-js";
import type { RouteSlug } from "./routes";

export interface LivePositionRow {
  party: string;
  lat: number;
  lon: number;
  recordedAt: string;
}

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL en SUPABASE_ANON_KEY ontbreken. Zie .env.example.");
  }

  return createClient(url, key);
}

// One row per (route, party) — only ever the *latest* reported position, not
// a full track history. The Android tracker app upserts this via /api/live
// roughly every 30s; the map treats a row as usable only while it's recent
// (see LIVE_POSITION_MAX_AGE_MS in liveMarker.ts) and falls back to the
// check-in-based estimate otherwise. Returned as a plain array (like
// loadCheckins) rather than a Map, so it can cross the server/client prop
// boundary the same way checkins already does — client components build
// whatever per-party lookup they need from it.
export async function loadLivePositions(route: RouteSlug): Promise<LivePositionRow[]> {
  const { data, error } = await client().from("live_positions").select("party, lat, lon, recorded_at").eq("route", route);

  if (error) {
    throw new Error(`Kon live posities niet laden uit Supabase: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    party: row.party,
    lat: Number(row.lat),
    lon: Number(row.lon),
    recordedAt: row.recorded_at,
  }));
}

export async function saveLivePosition(
  route: RouteSlug,
  party: string,
  lat: number,
  lon: number,
  recordedAt: string,
): Promise<void> {
  const { error } = await client()
    .from("live_positions")
    .upsert({ route, party, lat, lon, recorded_at: recordedAt, received_at: new Date().toISOString() });

  if (error) {
    throw new Error(`Kon live positie niet opslaan: ${error.message}`);
  }
}
