"use client";

import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/gpx";
import type { LegSegment } from "@/lib/segments";

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div style={{ height: "100%", width: "100%" }}>Kaart laden…</div>,
});

interface RouteMapLoaderProps {
  start: LatLng;
  legSegments: LegSegment[];
}

export default function RouteMapLoader({ start, legSegments }: RouteMapLoaderProps) {
  return <RouteMap start={start} legSegments={legSegments} />;
}
