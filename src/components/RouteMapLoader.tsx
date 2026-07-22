"use client";

import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/gpx";
import type { LegSegment } from "@/lib/segments";
import type { LegStatus } from "@/lib/status";

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div style={{ height: "100%", width: "100%" }}>Kaart laden…</div>,
});

interface RouteMapLoaderProps {
  start: LatLng;
  legSegments: LegSegment[];
  statuses: Map<number, LegStatus>;
  now: number;
  checkinTimes: Map<number, number>;
}

export default function RouteMapLoader({
  start,
  legSegments,
  statuses,
  now,
  checkinTimes,
}: RouteMapLoaderProps) {
  return (
    <RouteMap
      start={start}
      legSegments={legSegments}
      statuses={statuses}
      now={now}
      checkinTimes={checkinTimes}
    />
  );
}
