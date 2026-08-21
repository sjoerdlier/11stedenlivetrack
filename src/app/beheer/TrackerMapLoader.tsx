"use client";

import dynamic from "next/dynamic";
import type { RouteSlug } from "@/lib/routes";
import type { PartyConfig } from "@/lib/parties";
import type { LivePositionRow } from "@/lib/livePositions";
import styles from "@/components/RouteMapLoader.module.css";

// Same ssr:false dynamic-import pattern as RouteMapLoader — react-leaflet
// touches `window` at module load time and can't render server-side.
const TrackerMap = dynamic(() => import("./TrackerMap"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Kaart laden…</div>,
});

interface TrackerMapLoaderProps {
  routeParties: { route: RouteSlug; party: PartyConfig }[];
  history: Record<string, LivePositionRow[]>;
}

export default function TrackerMapLoader({ routeParties, history }: TrackerMapLoaderProps) {
  return <TrackerMap routeParties={routeParties} history={history} />;
}
