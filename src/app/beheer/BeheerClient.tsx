"use client";

import { useState } from "react";
import type { RouteSlug } from "@/lib/routes";
import type { PartyConfig } from "@/lib/parties";
import PinScreen from "../invoer/PinScreen";
import SettingsForm from "./SettingsForm";
import styles from "../invoer/invoer.module.css";

interface BeheerClientProps {
  initialAuthorized: boolean;
  routeParties: { route: RouteSlug; party: PartyConfig }[];
  garminUrls: Record<string, string>;
  pinIsSet: boolean;
  loadError: string | null;
}

export default function BeheerClient({
  initialAuthorized,
  routeParties,
  garminUrls,
  pinIsSet,
  loadError,
}: BeheerClientProps) {
  const [authorized, setAuthorized] = useState(initialAuthorized);

  return (
    <main className={styles.page}>
      {authorized ? (
        <SettingsForm
          routeParties={routeParties}
          initialGarminUrls={garminUrls}
          pinIsSet={pinIsSet}
          loadError={loadError}
          onUnauthorized={() => setAuthorized(false)}
        />
      ) : (
        <PinScreen title="Instellingen" onSuccess={() => setAuthorized(true)} />
      )}
    </main>
  );
}
