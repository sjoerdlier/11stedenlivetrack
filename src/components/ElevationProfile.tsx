"use client";

import { useMemo } from "react";
import type { ElevationPoint } from "@/lib/elevation";
import styles from "./ElevationProfile.module.css";

interface ElevationProfileProps {
  profile: ElevationPoint[];
}

// Fixed viewBox, scaled to the sidebar's actual width by the SVG's own
// width: 100% + preserveAspectRatio="none" — the same trick as a
// resolution-independent icon, just for a line chart instead of a glyph.
const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 56;

export default function ElevationProfile({ profile }: ElevationProfileProps) {
  const chart = useMemo(() => {
    if (profile.length < 2) return null;

    const elevations = profile.map((p) => p.elevationM);
    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const range = Math.max(1, maxEle - minEle);
    const maxDist = profile[profile.length - 1].distanceKm || 1;

    const coords = profile.map((p): [number, number] => [
      (p.distanceKm / maxDist) * VIEW_WIDTH,
      VIEW_HEIGHT - ((p.elevationM - minEle) / range) * VIEW_HEIGHT,
    ]);
    const lineD = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const areaD = `${lineD} L${VIEW_WIDTH},${VIEW_HEIGHT} L0,${VIEW_HEIGHT} Z`;

    let gainM = 0;
    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i - 1];
      if (diff > 0) gainM += diff;
    }

    return { lineD, areaD, minEle, maxEle, gainM };
  }, [profile]);

  if (!chart) return null;

  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className={styles.chart}
        role="img"
        aria-label={`Hoogteprofiel: van ${Math.round(chart.minEle)} tot ${Math.round(chart.maxEle)} meter (hoogteverschil ${Math.round(chart.maxEle - chart.minEle)} meter), ${Math.round(chart.gainM)} meter stijging`}
      >
        <path d={chart.areaD} className={styles.area} />
        <path d={chart.lineD} className={styles.line} />
      </svg>
      {/* The chart above stretches whatever range the data has to fill the
          full SVG height, so a near-flat route can visually read as
          mountainous. Spelling out the actual meter difference here (not
          just the raw min/max a reader would otherwise have to subtract
          themselves) is the reference point that keeps the scale honest,
          without a full axis-and-gridline overhaul. */}
      <div className={styles.meta} aria-hidden>
        <span>
          {Math.round(chart.minEle)}–{Math.round(chart.maxEle)} m
          <span className={styles.metaDelta}> (Δ{Math.round(chart.maxEle - chart.minEle)} m)</span>
        </span>
        <span>↑ {Math.round(chart.gainM)} m</span>
      </div>
    </div>
  );
}
