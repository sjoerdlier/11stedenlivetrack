"use client";

import { useMemo } from "react";
import type { LatLng } from "@/lib/gpx";
import type { LegSegment } from "@/lib/segments";
import { computeLegStatuses } from "@/lib/status";
import { useNow } from "@/lib/useNow";
import TopBar from "./TopBar";
import RouteMapLoader from "./RouteMapLoader";
import styles from "./AppShell.module.css";

const STATUS_REFRESH_MS = 30_000;

interface AppShellProps {
  start: LatLng;
  legSegments: LegSegment[];
}

export default function AppShell({ start, legSegments }: AppShellProps) {
  const now = useNow(STATUS_REFRESH_MS);
  const legs = useMemo(() => legSegments.map((s) => s.leg), [legSegments]);
  const statuses = useMemo(() => computeLegStatuses(legs, now), [legs, now]);

  return (
    <div className={styles.shell}>
      <TopBar legs={legs} statuses={statuses} />
      <div className={styles.body}>
        <RouteMapLoader start={start} legSegments={legSegments} statuses={statuses} now={now} />
      </div>
    </div>
  );
}
