import { createHash } from "crypto";
import { loadSetting, saveSetting } from "./settings";

// The PIN itself never reaches the client, not even hashed-and-comparable in
// JS: the browser only ever holds a session cookie whose value is a one-way
// hash of the PIN, verified again server-side on every write.
export const CHECKIN_COOKIE = "checkin_auth";
export const CHECKIN_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

const PIN_HASH_SETTING_KEY = "checkin_pin_hash";

export function tokenForPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

// The PIN can live in two places: the settings table (set via /beheer, takes
// priority) or the CHECKIN_PIN env var (the original, Vercel-only way of
// configuring it). Falling back keeps existing deployments working exactly
// as before until someone actually opens /beheer and sets one.
export async function currentPinHash(): Promise<string | null> {
  const dbHash = await loadSetting(PIN_HASH_SETTING_KEY);
  if (dbHash) return dbHash;
  const envPin = process.env.CHECKIN_PIN;
  return envPin ? tokenForPin(envPin) : null;
}

export async function setPin(pin: string): Promise<void> {
  await saveSetting(PIN_HASH_SETTING_KEY, tokenForPin(pin));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const hash = await currentPinHash();
  return !!hash && tokenForPin(pin) === hash;
}

export async function isAuthorized(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const hash = await currentPinHash();
  return !!hash && cookieValue === hash;
}
