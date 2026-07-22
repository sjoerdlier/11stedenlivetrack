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
}

export default function RouteMapLoader({ start, legSegments, statuses }: RouteMapLoaderProps) {
  return <RouteMap start={start} legSegments={legSegments} statuses={statuses} />;
}
