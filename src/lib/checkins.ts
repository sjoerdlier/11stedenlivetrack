import { createClient } from "@supabase/supabase-js";

export interface NewCheckin {
  tijdstip: string;
  leg_nr: number;
  lat: number | null;
  lon: number | null;
  notitie: string | null;
  invoerder: string;
}

export type Checkin = NewCheckin;

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
export async function loadCheckins(): Promise<Checkin[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL en SUPABASE_ANON_KEY ontbreken. Zie .env.example.");
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("checkins")
    .select("tijdstip, leg_nr, lat, lon, notitie, invoerder")
    .order("tijdstip", { ascending: true });

  if (error) {
    throw new Error(`Kon check-ins niet laden uit Supabase: ${error.message}`);
  }

  return data ?? [];
}
