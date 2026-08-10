import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CHECKIN_COOKIE, currentPinHash, isAuthorized } from "@/lib/checkinAuth";
import { loadSettings } from "@/lib/settings";
import { allRouteParties, garminUrlSettingKey, liveTokenSettingKey } from "@/lib/parties";
import { socialMetadata } from "@/lib/routes";
import BeheerClient from "./BeheerClient";

// Same reasoning as /invoer: this page reads the PIN-session cookie, which
// is per-visitor, so it can't be ISR-cached.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return socialMetadata("Instellingen — Livetrack", "Garmin-links en check-in PIN beheren");
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

  return (
    <BeheerClient
      initialAuthorized={authorized}
      routeParties={routeParties}
      garminUrls={garminUrls}
      liveTokens={liveTokens}
      pinIsSet={pinIsSet}
      loadError={loadError}
    />
  );
}
