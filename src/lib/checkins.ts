import { createClient } from "@supabase/supabase-js";

export interface NewCheckin {
  tijdstip: string;
  leg_nr: number;
  lat: number | null;
  lon: number | null;
  notitie: string | null;
  invoerder: string;
}

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
