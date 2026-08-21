import { NextResponse } from "next/server";
import { parseRouteSlug } from "@/lib/routes";
import { parsePartySlug } from "@/lib/parties";
import { getCachedCheckins, getCachedLivePositions, getCachedLivePositionHistory } from "@/lib/cachedData";
import { historySinceIso } from "@/lib/liveTrackProgress";

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
  // Optional — only AppShell's TopBar-driving poll passes this (see its poll
  // effect); the map-only checkins/livePositions poll predates party
  // filtering and doesn't need it.
  const party = searchParams.get("party");

  try {
    const [checkins, livePositions, livePositionHistory] = await Promise.all([
      getCachedCheckins(route),
      getCachedLivePositions(route),
      party
        ? getCachedLivePositionHistory(route, parsePartySlug(route, party), historySinceIso(Date.now()))
        : Promise.resolve(undefined),
    ]);
    return NextResponse.json({ checkins, livePositions, livePositionHistory });
  } catch (err) {
    console.error(`GET /api/poll(${route}): loading checkins/livePositions failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
