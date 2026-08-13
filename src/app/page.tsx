import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import AppShell from "@/components/AppShell";
import LoadError from "@/components/LoadError";
import { loadRoute, type LatLng } from "@/lib/gpx";
import { loadLegs, type Leg } from "@/lib/legs";
import type { Checkin } from "@/lib/checkins";
import type { LivePositionRow } from "@/lib/livePositions";
import { getCachedCheckins, getCachedLivePositions } from "@/lib/cachedData";
import { loadWeather, type WeatherSnapshot } from "@/lib/weather";
import { buildLegSegments, type LegSegment } from "@/lib/segments";
import { buildElevationProfile, type ElevationPoint } from "@/lib/elevation";
import { parseRouteSlug, routeConfig, socialMetadata } from "@/lib/routes";
import { parsePartySlug, partiesForRoute, partyConfig, garminUrlSettingKey } from "@/lib/parties";
import { loadSetting } from "@/lib/settings";

// Route-level ISR (dropping force-dynamic, adding `revalidate`) was tried
// first but rejected: without force-dynamic, Next tries to prerender this
// page at *build* time, which means a deploy now depends on Supabase being
// reachable during the build step — a brief Supabase hiccup at exactly the
// wrong moment would fail the whole build, a failure mode that never
// existed with force-dynamic. That's too much risk for a live event
// tracker to take on for a caching win.
//
// unstable_cache gets most of the benefit without that risk: it caches
// independently of the route's rendering mode, so the route keeps
// rendering per-request (safe, same reliability as before) while repeat
// requests within the window share one Supabase read instead of each
// paying for their own. AppShell's auto-refresh polls on this same 20s
// cadence, so a poll never pays for its own uncached Supabase round-trip.
export const dynamic = "force-dynamic";

const getCachedLegs = unstable_cache(loadLegs, ["legs"], { revalidate: 20 });
const getCachedSetting = unstable_cache(loadSetting, ["settings"], { revalidate: 20 });
// getCachedCheckins/getCachedLivePositions now live in @/lib/cachedData,
// shared with /api/poll — see that file's comment.
// Open-Meteo, unlike the Supabase reads above, isn't something a viewer's
// own poll should hammer every 20s — weather doesn't change that fast, and
// this is a free API with no key. A much longer window (30 min, within the
// "900-1800s" range other slow-changing context uses) still means everyone
// checking during the event sees the same handful of API calls.
const getCachedWeather = unstable_cache(loadWeather, ["weather"], { revalidate: 1800 });

interface RouteGeometry {
  start: LatLng;
  legSegments: LegSegment[];
  elevationProfile: ElevationPoint[];
}

// loadRoute() re-parses a 556KB GPX file and buildLegSegments()/
// buildElevationProfile() re-run RDP simplification and the Minetti
// grade-adjusted-cost walk over all ~204km of it — none of that is cheap,
// and unlike the Supabase reads above it was running on *every* request
// with no caching at all. Wrapped the same way, on the same 20s window, so
// a burst of requests (or AppShell's poll) shares one computation instead
// of each paying for its own. Keyed on `legs` too (not just the gpx file),
// since a schedule edit shifts where each leg's segment starts.
const getCachedRouteGeometry = unstable_cache(
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

interface HomeProps {
  searchParams: Promise<{ route?: string; party?: string }>;
}

export async function generateMetadata({ searchParams }: HomeProps): Promise<Metadata> {
  const { route, party } = await searchParams;
  const activeRoute = parseRouteSlug(route);
  const config = routeConfig(activeRoute);
  const parties = partiesForRoute(activeRoute);
  // Only worth naming the party in the title once there's more than one to
  // disambiguate between — for every other route this is a no-op.
  const title =
    parties.length > 1
      ? `${partyConfig(activeRoute, parsePartySlug(activeRoute, party)).label} — ${config.pageTitle}`
      : config.pageTitle;
  return socialMetadata(title, `Kaart van de ${config.routeDescription}`);
}

export default async function Home({ searchParams }: HomeProps) {
  const { route, party } = await searchParams;
  const activeRoute = parseRouteSlug(route);
  const activeParty = parsePartySlug(activeRoute, party);
  const config = routeConfig(activeRoute);

  let legs: Leg[], checkins: Checkin[];
  try {
    [legs, checkins] = await Promise.all([
      getCachedLegs(activeRoute),
      getCachedCheckins(activeRoute),
    ]);
  } catch (err) {
    console.error(`Home(${activeRoute}): loading legs/checkins failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return <LoadError message={message} retryHref={`/?route=${activeRoute}`} />;
  }

  const { start, legSegments, elevationProfile } = await getCachedRouteGeometry(config.gpxFile, legs);

  // A missing Garmin link is a normal pre-race state (LiveTrackPanel shows a
  // placeholder), not something that should take the whole page down — only
  // the legs/checkins load above is critical enough to error out on.
  let garminUrl: string | null = null;
  try {
    garminUrl = await getCachedSetting(garminUrlSettingKey(activeRoute, activeParty));
  } catch (err) {
    console.error(`Home(${activeRoute}): loading garminUrl setting failed`, err);
    garminUrl = null;
  }

  // Same reasoning: no live_positions rows yet (tracker app not running, or
  // not built yet) is a normal state — the map just falls back to the
  // check-in-based position estimate, same as before this existed.
  let livePositions: LivePositionRow[] = [];
  try {
    livePositions = await getCachedLivePositions(activeRoute);
  } catch (err) {
    console.error(`Home(${activeRoute}): loading livePositions failed`, err);
    livePositions = [];
  }

  // Weather context for whoever's tracking the walk — loadWeather() already
  // never throws (any Open-Meteo hiccup resolves to null there), this
  // try/catch just matches the same defensive shape every other optional
  // data source on this page uses.
  let weather: WeatherSnapshot | null = null;
  try {
    weather = await getCachedWeather(start[0], start[1]);
  } catch (err) {
    console.error(`Home(${activeRoute}): loading weather failed`, err);
    weather = null;
  }

  return (
    <AppShell
      activeRoute={activeRoute}
      activeParty={activeParty}
      start={start}
      legSegments={legSegments}
      checkins={checkins}
      elevationProfile={elevationProfile}
      garminUrl={garminUrl}
      livePositions={livePositions}
      weather={weather}
    />
  );
}
