"use client";

import { useState } from "react";
import type { Leg } from "@/lib/legs";
import type { RouteSlug } from "@/lib/routes";
import PinScreen from "./PinScreen";
import CheckinForm from "./CheckinForm";
import styles from "./invoer.module.css";

interface InvoerClientProps {
  activeRoute: RouteSlug;
  initialAuthorized: boolean;
  legs: Leg[];
  legsError: string | null;
}

export default function InvoerClient({
  activeRoute,
  initialAuthorized,
  legs,
  legsError,
}: InvoerClientProps) {
  const [authorized, setAuthorized] = useState(initialAuthorized);

  return (
    <main className={styles.page}>
      {authorized ? (
        <CheckinForm
          activeRoute={activeRoute}
          legs={legs}
          legsError={legsError}
          onUnauthorized={() => setAuthorized(false)}
        />
      ) : (
        <PinScreen onSuccess={() => setAuthorized(true)} />
      )}
    </main>
  );
}
