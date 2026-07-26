"use client";

import { useMemo, useState } from "react";
import type { LatLng } from "@/lib/gpx";
import type { LegSegment } from "@/lib/segments";
import type { Checkin } from "@/lib/checkins";
import type { RouteSlug } from "@/lib/routes";
import { firstCheckinByLeg, firstCheckinTimesByLeg } from "@/lib/actualProgress";
import { computeLegStatuses } from "@/lib/status";
import { useSimulatedNow } from "@/lib/useSimulatedNow";
import TopBar from "./TopBar";
import RouteMapLoader from "./RouteMapLoader";
import LiveTrackPanel from "./LiveTrackPanel";
import styles from "./AppShell.module.css";

const STATUS_REFRESH_MS = 30_000;

interface AppShellProps {
  activeRoute: RouteSlug;
  start: LatLng;
  legSegments: LegSegment[];
  checkins: Checkin[];
}

export default function AppShell({ activeRoute, start, legSegments, checkins }: AppShellProps) {
  const now = useSimulatedNow(STATUS_REFRESH_MS);
  const legs = useMemo(() => legSegments.map((s) => s.leg), [legSegments]);
  const statuses = useMemo(() => computeLegStatuses(legs, now), [legs, now]);
  const checkinTimes = useMemo(() => firstCheckinTimesByLeg(checkins), [checkins]);
  // Same "earliest check-in per leg" pick as checkinTimes, but keeping the
  // whole record — LegCard reads .notitie/.invoerder off of it.
  const checkinsByLeg = useMemo(() => firstCheckinByLeg(checkins), [checkins]);
  const [liveTrackOpen, setLiveTrackOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <TopBar
        activeRoute={activeRoute}
        legs={legs}
        statuses={statuses}
        now={now}
        checkins={checkins}
        checkinTimes={checkinTimes}
        liveTrackOpen={liveTrackOpen}
        onToggleLiveTrack={() => setLiveTrackOpen((v) => !v)}
      />
      <div className={styles.body}>
        <div className={styles.mapWrap}>
          <RouteMapLoader
            activeRoute={activeRoute}
            start={start}
            legSegments={legSegments}
            statuses={statuses}
            checkinTimes={checkinTimes}
            checkinsByLeg={checkinsByLeg}
            now={now}
          />
        </div>
        <LiveTrackPanel open={liveTrackOpen} onClose={() => setLiveTrackOpen(false)} />
      </div>
    </div>
  );
}
