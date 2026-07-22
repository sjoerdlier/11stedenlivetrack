import { createHash } from "crypto";

// The PIN itself never reaches the client, not even hashed-and-comparable in
// JS: the browser only ever holds a session cookie whose value is a one-way
// hash of the PIN, verified again server-side on every write.
export const CHECKIN_COOKIE = "checkin_auth";
export const CHECKIN_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

export function verifyPin(pin: string): boolean {
  const expected = process.env.CHECKIN_PIN;
  return !!expected && pin === expected;
}

export function tokenForPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

export function isAuthorized(cookieValue: string | undefined): boolean {
  const pin = process.env.CHECKIN_PIN;
  if (!pin || !cookieValue) return false;
  return cookieValue === tokenForPin(pin);
}
