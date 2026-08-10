"use client";

import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/gpx";
import type { Leg } from "@/lib/legs";
import type { LegSegment } from "@/lib/segments";
import type { LegStatus } from "@/lib/status";
import type { RouteSlug } from "@/lib/routes";
import type { Checkin } from "@/lib/checkins";
import type { LivePositionRow } from "@/lib/livePositions";
import type { ElevationPoint } from "@/lib/elevation";
import styles from "./RouteMapLoader.module.css";

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Kaart laden…</div>,
});

interface RouteMapLoaderProps {
  activeRoute: RouteSlug;
  activeParty: string;
  start: LatLng;
  legSegments: LegSegment[];
  effortLegs: Leg[];
  statuses: Map<number, LegStatus>;
  checkinTimes: Map<number, number>;
  checkinsByLeg: Map<number, Checkin>;
  checkins: Checkin[];
  livePositions: LivePositionRow[];
  now: number;
  lastRefreshedAt: number | null;
  elevationProfile: ElevationPoint[];
}

export default function RouteMapLoader({
  activeRoute,
  activeParty,
  start,
  legSegments,
  effortLegs,
  statuses,
  checkinTimes,
  checkinsByLeg,
  checkins,
  livePositions,
  now,
  lastRefreshedAt,
  elevationProfile,
}: RouteMapLoaderProps) {
  return (
    <RouteMap
      activeRoute={activeRoute}
      activeParty={activeParty}
      start={start}
      legSegments={legSegments}
      effortLegs={effortLegs}
      statuses={statuses}
      checkinTimes={checkinTimes}
      checkinsByLeg={checkinsByLeg}
      checkins={checkins}
      livePositions={livePositions}
      now={now}
      lastRefreshedAt={lastRefreshedAt}
      elevationProfile={elevationProfile}
    />
  );
}
