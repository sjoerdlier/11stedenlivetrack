import { NextResponse } from "next/server";
import { parseRouteSlug } from "@/lib/routes";
import { getCachedCheckins, getCachedLivePositions } from "@/lib/cachedData";

// Lightweight JSON companion to the full-page SSR load in page.tsx — polled
// by AppShell (see its poll effect) instead of router.refresh(), so a
// visible tab only re-fetches the two datasets that actually change during
// the event (check-ins, live GPS) instead of the whole RSC payload — route
// geometry, elevation profile, and the schedule are all static for the
// lifetime of a page view and don't need to travel on every poll.
//
// force-dynamic for the same reason page.tsx is: this must run per-request,
// not get statically optimized at build time — the unstable_cache calls
// below (shared with page.tsx via @/lib/cachedData) are what actually keep
// repeat requests within the same 20s window cheap.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const route = parseRouteSlug(searchParams.get("route") ?? undefined);

  try {
    const [checkins, livePositions] = await Promise.all([
      getCachedCheckins(route),
      getCachedLivePositions(route),
    ]);
    return NextResponse.json({ checkins, livePositions });
  } catch (err) {
    console.error(`GET /api/poll(${route}): loading checkins/livePositions failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
