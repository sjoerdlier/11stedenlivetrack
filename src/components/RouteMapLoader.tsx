"use client";

import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/gpx";
import type { Leg } from "@/lib/legs";
import type { LegSegment } from "@/lib/segments";
import type { LegStatus } from "@/lib/status";
import type { RouteSlug } from "@/lib/routes";
import type { Checkin } from "@/lib/checkins";
import type { LivePositionRow } from "@/lib/livePositions";
import styles from "./RouteMapLoader.module.css";

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Kaart laden…</div>,
});

interface RouteMapLoaderProps {
  activeRoute: RouteSlug;
  start: LatLng;
  legSegments: LegSegment[];
  effortLegs: Leg[];
  statuses: Map<number, LegStatus>;
  checkins: Checkin[];
  livePositions: LivePositionRow[];
  now: number;
  // Optional: real usage (AppShell) always wires these up to its lifted
  // selection state, but the styleguide's static map previews just want a
  // plain, unselected map with no click behavior — defaulting here means
  // those call sites don't need to invent state/handlers they don't use.
  selectedNr?: number | null;
  onSelectLeg?: (nr: number | null) => void;
}

export default function RouteMapLoader({
  activeRoute,
  start,
  legSegments,
  effortLegs,
  statuses,
  checkins,
  livePositions,
  now,
  selectedNr = null,
  onSelectLeg = () => {},
}: RouteMapLoaderProps) {
  return (
    <RouteMap
      activeRoute={activeRoute}
      start={start}
      legSegments={legSegments}
      effortLegs={effortLegs}
      statuses={statuses}
      checkins={checkins}
      livePositions={livePositions}
      now={now}
      selectedNr={selectedNr}
      onSelectLeg={onSelectLeg}
    />
  );
}
