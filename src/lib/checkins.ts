import { createClient } from "@supabase/supabase-js";
import type { RouteSlug } from "./routes";

export interface NewCheckin {
  route: RouteSlug;
  // Which independent tracked group this check-in belongs to (see
  // parties.ts) — for routes with only one implicit party this is always
  // that party's slug, invisible in the UI.
  party: string;
  tijdstip: string;
  leg_nr: number;
  lat: number | null;
  lon: number | null;
  notitie: string | null;
  invoerder: string;
}

export type Checkin = Omit<NewCheckin, "route">;

export async function insertCheckin(checkin: NewCheckin): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL en SUPABASE_ANON_KEY ontbreken. Zie .env.example.");
  }

  const supabase = createClient(url, key);
  const { error } = await supabase.from("checkins").insert(checkin);

  if (error) {
    throw new Error(`Kon check-in niet opslaan: ${error.message}`);
  }
}

// Wrapped in unstable_cache by page.tsx (20s data cache, route stays
// force-dynamic) so the top bar and sidebar can derive real progress/pace
// from actual check-ins instead of the schedule. Empty before race day —
// that's the expected starting state, not an error.
export async function loadCheckins(route: RouteSlug): Promise<Checkin[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL en SUPABASE_ANON_KEY ontbreken. Zie .env.example.");
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("checkins")
    .select("party, tijdstip, leg_nr, lat, lon, notitie, invoerder")
    .eq("route", route)
    .order("tijdstip", { ascending: true });

  if (error) {
    throw new Error(`Kon check-ins niet laden uit Supabase: ${error.message}`);
  }

  return data ?? [];
}
