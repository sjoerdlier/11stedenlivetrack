"use client";

import { Fragment, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RouteSlug } from "@/lib/routes";
import type { PartyConfig } from "@/lib/parties";
import { trackerStatusKey } from "@/lib/parties";
import type { LivePositionRow } from "@/lib/livePositions";
import { formatClockTime } from "@/lib/format";
import styles from "./TrackerMap.module.css";

// No route/schedule data on this map on purpose — this is the raw GPS
// trail (breadcrumbs from live_positions), not the planned Elfstedentocht
// line. During the pre-race stability tests this repo's CLAUDE.md/the
// organizer's own instructions are explicit that route-matching is
// meaningless right now (the tracker gets walked/ridden anywhere for
// testing), so this deliberately never touches segments.ts/legs.ts.
const DEFAULT_CENTER: [number, number] = [52.2, 5.3];
const DEFAULT_ZOOM = 7;

function MapViewController({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, bounds]);
  return null;
}

interface TrackerMapProps {
  routeParties: { route: RouteSlug; party: PartyConfig }[];
  history: Record<string, LivePositionRow[]>;
}

export default function TrackerMap({ routeParties, history }: TrackerMapProps) {
  const trails = useMemo(
    () =>
      routeParties
        .map(({ route, party }) => {
          const rows = history[trackerStatusKey(route, party.slug)] ?? [];
          if (rows.length === 0) return null;
          const positions: [number, number][] = rows.map((r) => [r.lat, r.lon]);
          const latest = rows[rows.length - 1];
          return { party, positions, latest };
        })
        .filter((t): t is { party: PartyConfig; positions: [number, number][]; latest: LivePositionRow } => t !== null),
    [routeParties, history],
  );

  const bounds = useMemo(() => {
    const allPoints = trails.flatMap((t) => t.positions);
    return allPoints.length > 0 ? L.latLngBounds(allPoints) : null;
  }, [trails]);

  return (
    <div className={styles.mapArea}>
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className={styles.map} scrollWheelZoom>
        <MapViewController bounds={bounds} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {trails.map(({ party, positions, latest }) => (
          <Fragment key={party.slug}>
            <Polyline positions={positions} pathOptions={{ color: party.color, weight: 3, opacity: 0.8 }} />
            <CircleMarker
              center={[latest.lat, latest.lon]}
              radius={7}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: party.color, fillOpacity: 1 }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <span className={styles.tooltipRow}>
                  {party.label} — laatste fix {formatClockTime(new Date(latest.recordedAt).getTime())}
                </span>
              </Tooltip>
            </CircleMarker>
          </Fragment>
        ))}
      </MapContainer>
      {trails.length === 0 && <div className={styles.emptyOverlay}>Nog geen posities ontvangen.</div>}
    </div>
  );
}
