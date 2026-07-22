import { createClient } from "@supabase/supabase-js";

export interface Leg {
  nr: number;
  start_plaats: string;
  afstand_km: number;
  loper: string;
  cumulatief_start_km: number;
  start_lat: number;
  start_lon: number;
  geplande_tijd: string | null;
}

export async function loadLegs(): Promise<Leg[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL en SUPABASE_ANON_KEY ontbreken. Zie .env.example.",
    );
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("legs")
    .select(
      "nr, start_plaats, afstand_km, loper, cumulatief_start_km, start_lat, start_lon, geplande_tijd",
    )
    .order("nr", { ascending: true });

  if (error) {
    throw new Error(`Kon legs niet laden uit Supabase: ${error.message}`);
  }

  return data ?? [];
}
