import { NextResponse } from "next/server";
import {
  CHECKIN_COOKIE,
  CHECKIN_COOKIE_MAX_AGE,
  checkLoginLockout,
  clearLoginAttempts,
  currentPinHash,
  recordFailedLoginAttempt,
  tokenForPin,
  verifyPin,
} from "@/lib/checkinAuth";

// x-forwarded-for can carry a client-supplied chain ("client, proxy1,
// proxy2") — the first entry is what Vercel's edge network reports as the
// original client. Falls back to a single shared bucket if neither header
// is present (local dev without a proxy in front), which is strictly safe:
// worst case everyone shares one lockout counter, never no lockout at all.
function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const ip = clientIp(request);

  const retryAfterSeconds = await checkLoginLockout(ip);
  if (retryAfterSeconds !== null) {
    const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
    return NextResponse.json(
      {
        ok: false,
        error: `Te veel foute pogingen. Probeer het over ${retryAfterMinutes} ${retryAfterMinutes === 1 ? "minuut" : "minuten"} opnieuw.`,
      },
      { status: 429 },
    );
  }

  if (!(await currentPinHash())) {
    return NextResponse.json(
      { ok: false, error: "Er is nog geen PIN ingesteld. Zie /beheer." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!(await verifyPin(pin))) {
    await recordFailedLoginAttempt(ip);
    return NextResponse.json({ ok: false, error: "Onjuiste PIN." }, { status: 401 });
  }

  await clearLoginAttempts(ip);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CHECKIN_COOKIE, tokenForPin(pin), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CHECKIN_COOKIE_MAX_AGE,
  });
  return response;
}
