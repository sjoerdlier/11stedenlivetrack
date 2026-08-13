import { createHash, timingSafeEqual } from "crypto";
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

// Constant-time string compare, safe for arbitrary-length (attacker
// controlled) input. crypto.timingSafeEqual itself requires equal-length
// buffers and throws otherwise, which would both crash on a mismatched
// length and leak that same length information through the exception path;
// hashing both sides to a fixed-length digest first sidesteps that instead
// of branching on `.length` ourselves.
export function timingSafeStringEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
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
  return !!hash && timingSafeStringEqual(tokenForPin(pin), hash);
}

export async function isAuthorized(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const hash = await currentPinHash();
  return !!hash && timingSafeStringEqual(cookieValue, hash);
}

// --- PIN login rate limiting -------------------------------------------
//
// /api/invoer/verify is the only endpoint a brute-force PIN guess is
// practical against (4-digit PIN, no other secret). Vercel serverless
// functions can cold-start on any request, so an in-memory counter isn't
// reliable as a lockout store — attempts are persisted in the same
// Supabase `settings` key/value table everything else here already uses,
// keyed per client IP.
const LOGIN_ATTEMPT_MAX = 5;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface LoginAttemptState {
  count: number;
  windowStart: number;
}

function loginAttemptSettingKey(ip: string): string {
  return `checkin_login_attempts:${ip}`;
}

async function loadLoginAttemptState(ip: string): Promise<LoginAttemptState | null> {
  const raw = await loadSetting(loginAttemptSettingKey(ip));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LoginAttemptState>;
    if (typeof parsed.count === "number" && typeof parsed.windowStart === "number") {
      return { count: parsed.count, windowStart: parsed.windowStart };
    }
  } catch {
    // Malformed value (shouldn't happen since we're the only writer) —
    // treat it as "no prior attempts" rather than failing the request.
  }
  return null;
}

// Returns the number of seconds the caller must wait before retrying, or
// null if they're not currently locked out. Doesn't record an attempt
// itself — call this before verifying the PIN, then
// recordFailedLoginAttempt/clearLoginAttempts after, so a correct PIN
// always resets the counter regardless of how it got there.
export async function checkLoginLockout(ip: string): Promise<number | null> {
  const state = await loadLoginAttemptState(ip);
  if (!state) return null;
  const elapsedMs = Date.now() - state.windowStart;
  if (elapsedMs > LOGIN_ATTEMPT_WINDOW_MS) return null;
  if (state.count < LOGIN_ATTEMPT_MAX) return null;
  return Math.max(1, Math.ceil((LOGIN_ATTEMPT_WINDOW_MS - elapsedMs) / 1000));
}

export async function recordFailedLoginAttempt(ip: string): Promise<void> {
  const existing = await loadLoginAttemptState(ip);
  const now = Date.now();
  const withinWindow = existing && now - existing.windowStart <= LOGIN_ATTEMPT_WINDOW_MS;
  const state: LoginAttemptState = withinWindow
    ? { count: existing.count + 1, windowStart: existing.windowStart }
    : { count: 1, windowStart: now };
  await saveSetting(loginAttemptSettingKey(ip), JSON.stringify(state));
}

export async function clearLoginAttempts(ip: string): Promise<void> {
  await saveSetting(loginAttemptSettingKey(ip), JSON.stringify({ count: 0, windowStart: Date.now() }));
}
