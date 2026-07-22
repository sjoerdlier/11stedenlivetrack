"use client";

import { useMemo, useState } from "react";
import type { LatLng } from "@/lib/gpx";
import type { LegSegment } from "@/lib/segments";
import { computeLegStatuses } from "@/lib/status";
import { useNow } from "@/lib/useNow";
import TopBar from "./TopBar";
import RouteMapLoader from "./RouteMapLoader";
import LiveTrackPanel from "./LiveTrackPanel";
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
  const [liveTrackOpen, setLiveTrackOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <TopBar
        legs={legs}
        statuses={statuses}
        liveTrackOpen={liveTrackOpen}
        onToggleLiveTrack={() => setLiveTrackOpen((v) => !v)}
      />
      <div className={styles.body}>
        <div className={styles.mapWrap}>
          <RouteMapLoader start={start} legSegments={legSegments} statuses={statuses} />
        </div>
        <LiveTrackPanel open={liveTrackOpen} onClose={() => setLiveTrackOpen(false)} />
      </div>
    </div>
  );
}
