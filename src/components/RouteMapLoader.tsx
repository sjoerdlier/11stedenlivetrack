"use client";

import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/gpx";
import type { LegSegment } from "@/lib/segments";
import type { LegStatus } from "@/lib/status";
import type { RouteSlug } from "@/lib/routes";
import styles from "./RouteMapLoader.module.css";

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Kaart laden…</div>,
});

interface RouteMapLoaderProps {
  activeRoute: RouteSlug;
  start: LatLng;
  legSegments: LegSegment[];
  statuses: Map<number, LegStatus>;
  checkinTimes: Map<number, number>;
}

export default function RouteMapLoader({
  activeRoute,
  start,
  legSegments,
  statuses,
  checkinTimes,
}: RouteMapLoaderProps) {
  return (
    <RouteMap
      activeRoute={activeRoute}
      start={start}
      legSegments={legSegments}
      statuses={statuses}
      checkinTimes={checkinTimes}
    />
  );
}
