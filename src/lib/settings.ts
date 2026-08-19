import { getSql } from "./db";

// Simple key/value store for things an organizer needs to change without
// touching Vercel's env vars or redeploying — currently the check-in PIN's
// hash and the per-party Garmin LiveTrack links (see /beheer). Deliberately
// not typed per-key: callers know which keys they're asking for.
//
// One query per key rather than a single `WHERE key = ANY($1)` — at this
// table's size (a handful of settings rows) that's not worth the extra
// array-parameter handling, and it keeps every call here a plain,
// obviously-correct single-value query.
export async function loadSettings(keys: string[]): Promise<Map<string, string>> {
  const sql = getSql();
  const map = new Map<string, string>();

  try {
    await Promise.all(
      keys.map(async (key) => {
        const rows = (await sql`select value from settings where key = ${key}`) as { value: string | null }[];
        const value = rows[0]?.value;
        if (value !== null && value !== undefined) map.set(key, value);
      }),
    );
  } catch (err) {
    console.error(`loadSettings([${keys.join(", ")}]): query failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    throw new Error(`Kon instellingen niet laden uit de database: ${message}`);
  }

  return map;
}

export async function loadSetting(key: string): Promise<string | null> {
  const settings = await loadSettings([key]);
  return settings.get(key) ?? null;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      insert into settings (key, value, updated_at)
      values (${key}, ${value}, now())
      on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at
    `;
  } catch (err) {
    console.error(`saveSetting(${key}): query failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    throw new Error(`Kon instelling niet opslaan: ${message}`);
  }
}
