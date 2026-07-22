"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  Tooltip,
  Popup,
  useMap,
  useMapEvent,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/gpx";
import type { LegSegment } from "@/lib/segments";
import { formatGeplandeTijd } from "@/lib/format";
import { STATUS_COLORS, type LegStatus } from "@/lib/status";
import { assignCpTooltipDirections, labelModeForZoom } from "@/lib/mapLabels";
import LegSchedule from "./LegSchedule";
import styles from "./RouteMap.module.css";

const INITIAL_ZOOM = 11;

const MARKER_RING_COLOR = "#52514e";

const startFinishIcon = L.icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
        <path d="M16 0C7.2 0 0 7.2 0 16c0 11 16 26 16 26s16-15 16-26C32 7.2 24.8 0 16 0z" fill="#d62828"/>
        <circle cx="16" cy="16" r="8" fill="#ffffff"/>
      </svg>`
    ).toString("base64"),
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -38],
});

interface RouteMapProps {
  start: LatLng;
  legSegments: LegSegment[];
  statuses: Map<number, LegStatus>;
}

// The map's container width changes when sibling panels (e.g. LiveTrack)
// toggle open/closed; Leaflet doesn't notice on its own, so nudge it.
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  const handleZoom = useCallback(
    (e: L.LeafletEvent) => onZoom(e.target.getZoom()),
    [onZoom],
  );
  useMapEvent("zoomend", handleZoom);
  return null;
}

export default function RouteMap({ start, legSegments, statuses }: RouteMapProps) {
  const [selectedNr, setSelectedNr] = useState<number | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const legs = useMemo(() => legSegments.map((s) => s.leg), [legSegments]);
  const labelMode = labelModeForZoom(zoom);
  const cpDirections = useMemo(() => assignCpTooltipDirections(legs), [legs]);

  useEffect(() => {
    if (selectedNr === null) return;
    document
      .getElementById(`leg-row-${selectedNr}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedNr]);

  return (
    <div className={styles.layout}>
      <LegSchedule legs={legs} statuses={statuses} selectedNr={selectedNr} onSelect={setSelectedNr} />

      <div className={styles.mapArea}>
        <MapContainer center={start} zoom={INITIAL_ZOOM} className={styles.map} scrollWheelZoom>
          <MapResizeHandler />
          <ZoomWatcher onZoom={setZoom} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {legSegments.map(({ leg, positions }) => (
            <Polyline
              key={`casing-${leg.nr}`}
              positions={positions}
              pathOptions={{ color: "#c3c2b7", weight: 8, opacity: 0.9, lineCap: "round" }}
              interactive={false}
            />
          ))}

          {legSegments.map(({ leg, positions }) => {
            const status = statuses.get(leg.nr) ?? "nog-te-gaan";
            const isSelected = leg.nr === selectedNr;
            return (
              <Polyline
                key={`line-${leg.nr}`}
                positions={positions}
                pathOptions={{
                  color: STATUS_COLORS[status],
                  weight: status === "bezig" || isSelected ? 7 : 5,
                  opacity: 0.95,
                  lineCap: "round",
                }}
                eventHandlers={{ click: () => setSelectedNr(isSelected ? null : leg.nr) }}
              />
            );
          })}

          {legSegments.map(({ leg }) => {
            const status = statuses.get(leg.nr) ?? "nog-te-gaan";
            const isSelected = leg.nr === selectedNr;
            const isCp = leg.cp_nummer !== null;
            const tijd = formatGeplandeTijd(leg.geplande_tijd);
            const baseRadius = isCp ? 8 : 6;
            const showCpLabel = isCp && labelMode !== "hidden";
            const cpDirection = cpDirections.get(leg.nr) ?? "right";
            const cpOffset: [number, number] = cpDirection === "right" ? [8, 0] : [-8, 0];
            return (
              <CircleMarker
                key={`marker-${leg.nr}`}
                center={[leg.start_lat, leg.start_lon]}
                radius={isSelected ? baseRadius + 3 : baseRadius}
                pathOptions={{
                  color: MARKER_RING_COLOR,
                  weight: isCp || isSelected ? 2.5 : 1.5,
                  fillColor: STATUS_COLORS[status],
                  fillOpacity: 1,
                }}
                eventHandlers={{ click: () => setSelectedNr(isSelected ? null : leg.nr) }}
              >
                {showCpLabel ? (
                  // react-leaflet never re-applies the `permanent` option to
                  // an already-mounted Tooltip (only path/tile layers get an
                  // update hook, overlays don't) — a stale permanent tooltip
                  // would stay stuck open forever once zoomed back out.
                  // Keying on the permanent/non-permanent boundary forces a
                  // real remount there instead of a no-op prop update.
                  <Tooltip
                    key="cp"
                    direction={cpDirection}
                    offset={cpOffset}
                    permanent
                    className={styles.cpTooltip}
                  >
                    {labelMode === "full" ? `CP ${leg.cp_nummer} · ${leg.start_plaats}` : `CP ${leg.cp_nummer}`}
                  </Tooltip>
                ) : (
                  <Tooltip key="hover" direction="top" offset={[0, -6]}>
                    {leg.start_plaats}
                    {tijd ? ` · ${tijd}` : ""}
                  </Tooltip>
                )}
              </CircleMarker>
            );
          })}

          <Marker position={start} icon={startFinishIcon}>
            <Popup>
              Start / Finish — Leeuwarden
              <br />
              11Stedentocht wandelroute (204 km)
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}
