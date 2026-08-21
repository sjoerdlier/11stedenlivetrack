import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CHECKIN_COOKIE, currentPinHash, isAuthorized } from "@/lib/checkinAuth";
import { loadSettings } from "@/lib/settings";
import { allRouteParties, garminUrlSettingKey, liveTokenSettingKey, trackerStatusKey } from "@/lib/parties";
import { socialMetadata } from "@/lib/routes";
import { getCachedLivePositions } from "@/lib/cachedData";
import type { LivePositionRow } from "@/lib/livePositions";
import BeheerClient from "./BeheerClient";

// Same reasoning as /invoer: this page reads the PIN-session cookie, which
// is per-visitor, so it can't be ISR-cached.
export const dynamic = "force-dynamic";

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
  // settings, and TrackerStatus reads each entry as "no positions loaded",
  // no different from a tracker that genuinely hasn't reported yet.
  const trackerPositions: Record<string, LivePositionRow | null> = {};
  const routes = [...new Set(routeParties.map((rp) => rp.route))];
  try {
    const positionsByRoute = await Promise.all(routes.map((route) => getCachedLivePositions(route)));
    routes.forEach((route, i) => {
      const positions = positionsByRoute[i];
      for (const { party } of routeParties.filter((rp) => rp.route === route)) {
        trackerPositions[trackerStatusKey(route, party.slug)] =
          positions.find((p) => p.party === party.slug) ?? null;
      }
    });
  } catch (err) {
    console.error("BeheerPage: loading live positions for TrackerStatus failed", err);
  }

  return (
    <BeheerClient
      initialAuthorized={authorized}
      routeParties={routeParties}
      garminUrls={garminUrls}
      liveTokens={liveTokens}
      pinIsSet={pinIsSet}
      loadError={loadError}
      initialTrackerPositions={trackerPositions}
    />
  );
}
