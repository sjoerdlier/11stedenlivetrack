"use client";

import { useState } from "react";
import type { RouteSlug } from "@/lib/routes";
import type { PartyConfig } from "@/lib/parties";
import type { LivePositionRow } from "@/lib/livePositions";
import PinScreen from "../invoer/PinScreen";
import SettingsForm from "./SettingsForm";
import TrackerStatus from "./TrackerStatus";
import styles from "../invoer/invoer.module.css";

interface BeheerClientProps {
  initialAuthorized: boolean;
  routeParties: { route: RouteSlug; party: PartyConfig }[];
  garminUrls: Record<string, string>;
  liveTokens: Record<string, string>;
  pinIsSet: boolean;
  loadError: string | null;
  initialTrackerPositions: Record<string, LivePositionRow | null>;
}

export default function BeheerClient({
  initialAuthorized,
  routeParties,
  garminUrls,
  liveTokens,
  pinIsSet,
  loadError,
  initialTrackerPositions,
}: BeheerClientProps) {
  const [authorized, setAuthorized] = useState(initialAuthorized);

  return (
    <main className={styles.page}>
      {authorized ? (
        <div className={styles.stack}>
          <TrackerStatus routeParties={routeParties} initialPositions={initialTrackerPositions} />
          <SettingsForm
            routeParties={routeParties}
            initialGarminUrls={garminUrls}
            initialLiveTokens={liveTokens}
            pinIsSet={pinIsSet}
            loadError={loadError}
            onUnauthorized={() => setAuthorized(false)}
          />
        </div>
      ) : (
        <PinScreen title="Instellingen" onSuccess={() => setAuthorized(true)} />
      )}
    </main>
  );
}
