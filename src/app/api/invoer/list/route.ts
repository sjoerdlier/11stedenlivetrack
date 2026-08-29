import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CHECKIN_COOKIE, isAuthorized } from "@/lib/checkinAuth";
import { loadRecentCheckinsWithIds } from "@/lib/checkins";
import { parseRouteSlug } from "@/lib/routes";

// Feeds /invoer's "recent check-ins" correction list -- same PIN-cookie
// gate as the insert/update endpoints, since this exposes invoerder names
// and notes alongside the check-ins.
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const authorized = await isAuthorized(cookieStore.get(CHECKIN_COOKIE)?.value);

  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const route = parseRouteSlug(searchParams.get("route") ?? undefined);

  try {
    const checkins = await loadRecentCheckinsWithIds(route);
    return NextResponse.json({ ok: true, checkins });
  } catch (err) {
    console.error(`GET /api/invoer/list(${route}): loadRecentCheckinsWithIds failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
