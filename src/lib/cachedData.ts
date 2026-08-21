import { unstable_cache } from "next/cache";
import { loadLegs, type Leg } from "./legs";
import { loadCheckins } from "./checkins";
import { loadLivePositions, loadLivePositionHistory } from "./livePositions";
import { loadWeather } from "./weather";
import { loadRoute, type LatLng } from "./gpx";
import { buildLegSegments, type LegSegment } from "./segments";
import { buildElevationProfile, type ElevationPoint } from "./elevation";

// Shared between page.tsx (the initial SSR render), /api/poll (AppShell's
// lightweight background refresh — see AppShell.tsx's poll effect), and
// /update (the AI journal) so all three read from the same cache bucket
// instead of each maintaining their own unstable_cache instance keyed
// identically. Same 20s revalidate window as page.tsx's other cached
// loaders, and for the same reason: a poll should never pay for its own
// uncached Supabase round-trip.
export const getCachedLegs = unstable_cache(loadLegs, ["legs"], { revalidate: 20 });
export const getCachedCheckins = unstable_cache(loadCheckins, ["checkins"], { revalidate: 20 });
export const getCachedLivePositions = unstable_cache(loadLivePositions, ["live_positions"], { revalidate: 20 });
// One party's recent trail — liveTrackProgress.ts's primary input. Keyed
// separately from getCachedLivePositions above (distinct key array) since
// this wraps a different function with a different argument shape (route,
// party, sinceIso rather than just route).
export const getCachedLivePositionHistory = unstable_cache(
  loadLivePositionHistory,
  ["live_positions", "history"],
  { revalidate: 20 },
);
// Open-Meteo, unlike the Supabase reads above, isn't something a viewer's
// own poll should hammer every 20s — weather doesn't change that fast, and
// this is a free API with no key. A much longer window (30 min, within the
// "900-1800s" range other slow-changing context uses) still means everyone
// checking during the event sees the same handful of API calls.
export const getCachedWeather = unstable_cache(loadWeather, ["weather"], { revalidate: 1800 });

export interface RouteGeometry {
  start: LatLng;
  legSegments: LegSegment[];
  elevationProfile: ElevationPoint[];
}

// Moved here from page.tsx so aiJournal.ts can share it too — liveTrackProgress.ts
// needs legSegments to project GPS fixes onto the route, and /update (the AI
// journal) shouldn't have to re-parse the 556KB GPX file and redo the RDP/
// Minetti walks page.tsx already pays for. loadRoute() re-parses that file,
// and buildLegSegments()/buildElevationProfile() re-run RDP simplification
// and the grade-adjusted-cost walk over all ~204km of it — none of that is
// cheap, so it's wrapped the same way as the Supabase reads above, on the
// same 20s window, keyed on `legs` too (not just the gpx file) since a
// schedule edit shifts where each leg's segment starts.
export const getCachedRouteGeometry = unstable_cache(
  async (gpxFile: string, legs: Leg[]): Promise<RouteGeometry> => {
    const { points, elevations, start } = loadRoute(gpxFile);
    return {
      start,
      legSegments: buildLegSegments(points, elevations, legs),
      elevationProfile: buildElevationProfile(points, elevations),
    };
  },
  ["route-geometry"],
  { revalidate: 20 },
);
