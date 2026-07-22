"use client";

import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/gpx";

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div style={{ height: "100%", width: "100%" }}>Kaart laden…</div>,
});

interface RouteMapLoaderProps {
  points: LatLng[];
  start: LatLng;
}

export default function RouteMapLoader({ points, start }: RouteMapLoaderProps) {
  return <RouteMap points={points} start={start} />;
}
