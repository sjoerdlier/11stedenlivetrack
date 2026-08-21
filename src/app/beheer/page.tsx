import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CHECKIN_COOKIE, currentPinHash, isAuthorized } from "@/lib/checkinAuth";
import { loadSettings } from "@/lib/settings";
import { allRouteParties, garminUrlSettingKey, liveTokenSettingKey, trackerStatusKey } from "@/lib/parties";
import { socialMetadata } from "@/lib/routes";
import { getCachedLivePositionHistory } from "@/lib/cachedData";
import { historySinceIso, TRACKER_DASHBOARD_HISTORY_HOURS } from "@/lib/liveTrackProgress";
import type { LivePositionRow } from "@/lib/livePositions";
import type { RouteSlug } from "@/lib/routes";
import type { PartyConfig } from "@/lib/parties";
import BeheerClient from "./BeheerClient";

// Same reasoning as /invoer: this page reads the PIN-session cookie, which
// is per-visitor, so it can't be ISR-cached.
export const dynamic = "force-dynamic";

// A plain module-level helper (not the page component itself) so
// Date.now() — needed for historySinceIso's cache-friendly bucketing —
// isn't called directly inside BeheerPage's body; the react-hooks purity
// rule flags impure calls like Date.now() in a component's own render, even
// a server component's (same reasoning as page.tsx's loadLiveTrackHistory).
async function loadTrackerHistory(
  routeParties: { route: RouteSlug; party: PartyConfig }[],
): Promise<Record<string, LivePositionRow[]>> {
  const sinceIso = historySinceIso(Date.now(), TRACKER_DASHBOARD_HISTORY_HOURS * 60 * 60 * 1000);
  const entries = await Promise.all(
    routeParties.map(async ({ route, party }) => {
      const history = await getCachedLivePositionHistory(route, party.slug, sinceIso);
      return [trackerStatusKey(route, party.slug), history] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    ...socialMetadata("Instellingen — Livetrack", "Garmin-links en check-in PIN beheren"),
    // PIN-gated admin screen — doesn't belong in search results.
    robots: { index: false, follow: false },
  };
}

export default async function BeheerPage() {
  const cookieStore = await cookies();
  const authorized = await isAuthorized(cookieStore.get(CHECKIN_COOKIE)?.value);
  const routeParties = allRouteParties();

  let garminUrls: Record<string, string> = {};
  let liveTokens: Record<string, string> = {};
  let pinIsSet = false;
  let loadError: string | null = null;
  try {
    const garminKeys = routeParties.map(({ route, party }) => garminUrlSettingKey(route, party.slug));
    const tokenKeys = routeParties.map(({ route, party }) => liveTokenSettingKey(route, party.slug));
    const settings = await loadSettings([...garminKeys, ...tokenKeys]);
    garminUrls = Object.fromEntries(garminKeys.map((k) => [k, settings.get(k) ?? ""]));
    liveTokens = Object.fromEntries(tokenKeys.map((k) => [k, settings.get(k) ?? ""]));
    pinIsSet = (await currentPinHash()) !== null;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Kon instellingen niet laden.";
  }

  // Doesn't fail the whole page on error, same as garminUrls/liveTokens
  // above — a live-position read hiccup shouldn't block seeing/editing
  // settings, and TrackerStatus/TrackerMap read a missing entry as "no
  // positions loaded", no different from a tracker that genuinely hasn't
  // reported yet.
  let trackerHistory: Record<string, LivePositionRow[]> = {};
  try {
    trackerHistory = await loadTrackerHistory(routeParties);
  } catch (err) {
    console.error("BeheerPage: loading live position history for TrackerStatus failed", err);
  }

  return (
    <BeheerClient
      initialAuthorized={authorized}
      routeParties={routeParties}
      garminUrls={garminUrls}
      liveTokens={liveTokens}
      pinIsSet={pinIsSet}
      loadError={loadError}
      initialTrackerHistory={trackerHistory}
    />
  );
}
