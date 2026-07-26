import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CHECKIN_COOKIE, CHECKIN_COOKIE_MAX_AGE, isAuthorized, setPin, tokenForPin } from "@/lib/checkinAuth";
import { saveSetting } from "@/lib/settings";
import { allRouteParties, garminUrlSettingKey } from "@/lib/parties";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const authorized = await isAuthorized(cookieStore.get(CHECKIN_COOKIE)?.value);

  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  const allowedKeys = new Set(
    allRouteParties().map(({ route, party }) => garminUrlSettingKey(route, party.slug)),
  );
  const garminUrls =
    body?.garminUrls && typeof body.garminUrls === "object" ? (body.garminUrls as Record<string, unknown>) : {};

  const newPinRaw = typeof body?.newPin === "string" ? body.newPin.trim() : "";
  if (newPinRaw && !/^\d{4}$/.test(newPinRaw)) {
    return NextResponse.json({ ok: false, error: "PIN moet uit precies 4 cijfers bestaan." }, { status: 400 });
  }

  try {
    for (const [key, value] of Object.entries(garminUrls)) {
      if (!allowedKeys.has(key) || typeof value !== "string") continue;
      await saveSetting(key, value.trim());
    }
    if (newPinRaw) {
      await setPin(newPinRaw);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  if (newPinRaw) {
    // The PIN just changed, so the existing session cookie (a hash of the
    // *old* PIN) would otherwise fail isAuthorized on the very next request
    // — refresh it to match so whoever just set the new PIN doesn't get
    // logged out of their own change.
    response.cookies.set(CHECKIN_COOKIE, tokenForPin(newPinRaw), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CHECKIN_COOKIE_MAX_AGE,
    });
  }
  return response;
}
