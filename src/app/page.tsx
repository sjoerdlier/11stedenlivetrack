import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import AppShell from "@/components/AppShell";
import LoadError from "@/components/LoadError";
import { loadRoute } from "@/lib/gpx";
import { loadLegs, type Leg } from "@/lib/legs";
import { loadCheckins, type Checkin } from "@/lib/checkins";
import { buildLegSegments } from "@/lib/segments";
import { buildElevationProfile } from "@/lib/elevation";
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
const getCachedCheckins = unstable_cache(loadCheckins, ["checkins"], { revalidate: 20 });
const getCachedSetting = unstable_cache(loadSetting, ["settings"], { revalidate: 20 });

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
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return <LoadError message={message} retryHref={`/?route=${activeRoute}`} />;
  }

  const { points, elevations, start } = loadRoute(config.gpxFile);
  const legSegments = buildLegSegments(points, elevations, legs);
  const elevationProfile = buildElevationProfile(points, elevations);

  // A missing Garmin link is a normal pre-race state (LiveTrackPanel shows a
  // placeholder), not something that should take the whole page down — only
  // the legs/checkins load above is critical enough to error out on.
  let garminUrl: string | null = null;
  try {
    garminUrl = await getCachedSetting(garminUrlSettingKey(activeRoute, activeParty));
  } catch {
    garminUrl = null;
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
    />
  );
}
