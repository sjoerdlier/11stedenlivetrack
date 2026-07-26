import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL en SUPABASE_ANON_KEY ontbreken. Zie .env.example.");
  }

  return createClient(url, key);
}

// Simple key/value store for things an organizer needs to change without
// touching Vercel's env vars or redeploying — currently the check-in PIN's
// hash and the per-party Garmin LiveTrack links (see /beheer). Deliberately
// not typed per-key: callers know which keys they're asking for.
export async function loadSettings(keys: string[]): Promise<Map<string, string>> {
  const { data, error } = await client().from("settings").select("key, value").in("key", keys);

  if (error) {
    throw new Error(`Kon instellingen niet laden uit Supabase: ${error.message}`);
  }

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.value !== null) map.set(row.key, row.value);
  }
  return map;
}

export async function loadSetting(key: string): Promise<string | null> {
  const settings = await loadSettings([key]);
  return settings.get(key) ?? null;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const { error } = await client().from("settings").upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) {
    throw new Error(`Kon instelling niet opslaan: ${error.message}`);
  }
}
