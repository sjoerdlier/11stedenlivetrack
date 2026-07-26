import { NextResponse } from "next/server";
import { CHECKIN_COOKIE, CHECKIN_COOKIE_MAX_AGE, currentPinHash, tokenForPin, verifyPin } from "@/lib/checkinAuth";

export async function POST(request: Request) {
  if (!(await currentPinHash())) {
    return NextResponse.json(
      { ok: false, error: "Er is nog geen PIN ingesteld. Zie /beheer." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!(await verifyPin(pin))) {
    return NextResponse.json({ ok: false, error: "Onjuiste PIN." }, { status: 401 });
  }

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
