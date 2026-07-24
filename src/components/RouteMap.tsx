"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
import { STATUS_COLORS, daysUntilStart, type LegStatus } from "@/lib/status";
import { computeRunnerPosition } from "@/lib/runnerPosition";
import { assignCpTooltipDirections, labelModeForZoom } from "@/lib/mapLabels";
import BuddyBadge from "./BuddyBadge";
import LegSchedule from "./LegSchedule";
import RunnerFigure from "./RunnerFigure";
import styles from "./RouteMap.module.css";

const RUNNER_ICON_SIZE = 30;
const INITIAL_ZOOM = 11;

const MARKER_RING_COLOR = "#52514e";
// The route line no longer follows leg status (that made most of the route
// white/invisible); it's blue by default and turns green when a leg is
// selected from the sidebar, so the click actually stands out.
const ROUTE_BASE_COLOR = "#2a78d6";
const ROUTE_SELECTED_COLOR = "#16a34a";

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
  now: number;
  checkinTimes: Map<number, number>;
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

export default function RouteMap({
  start,
  legSegments,
  statuses,
  now,
  checkinTimes,
}: RouteMapProps) {
  const [selectedNr, setSelectedNr] = useState<number | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const legs = useMemo(() => legSegments.map((s) => s.leg), [legSegments]);
  const labelMode = labelModeForZoom(zoom);
  const cpDirections = useMemo(() => assignCpTooltipDirections(legs), [legs]);

  const runner = useMemo(
    () => computeRunnerPosition(legSegments, statuses, now),
    [legSegments, statuses, now]
  );
  const beforeStart = useMemo(() => daysUntilStart(legs, now) !== null, [legs, now]);

  // Before the race starts there is no active leg to run computeRunnerPosition
  // against, so show Lowie waiting at the start line instead — still bouncing
  // (warming up), but not mid-stride since he isn't running yet.
  const displayRunner = useMemo(() => {
    if (runner) {
      const legIndex = legs.findIndex((leg) => leg.nr === runner.legNr);
      const from = legs[legIndex]?.start_plaats;
      const to = legs[legIndex + 1]?.start_plaats;
      return {
        position: runner.position,
        bearingDeg: runner.bearingDeg,
        running: true,
        label: to ? `${from} → ${to}` : from ?? "",
      };
    }
    if (beforeStart && legs[0]) {
      return {
        position: [legs[0].start_lat, legs[0].start_lon] as LatLng,
        bearingDeg: 90,
        running: false,
        label: `Start bij ${legs[0].start_plaats}`,
      };
    }
    return null;
  }, [runner, beforeStart, legs]);

  // Rotate the figure (drawn facing east) to face its actual running
  // direction; rebuilt as a divIcon since Leaflet renders markers outside
  // React's own DOM tree.
  const runnerIcon = useMemo(() => {
    if (!displayRunner) return null;
    return L.divIcon({
      html: renderToStaticMarkup(
        <RunnerFigure
          size={RUNNER_ICON_SIZE}
          color={STATUS_COLORS.bezig}
          rotationDeg={displayRunner.bearingDeg - 90}
          running={displayRunner.running}
          bounce
        />
      ),
      className: styles.runnerIcon,
      iconSize: [RUNNER_ICON_SIZE, RUNNER_ICON_SIZE],
      iconAnchor: [RUNNER_ICON_SIZE / 2, RUNNER_ICON_SIZE / 2],
    });
  }, [displayRunner]);

  useEffect(() => {
    if (selectedNr === null) return;
    document
      .getElementById(`leg-row-${selectedNr}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedNr]);

  // On mobile the schedule is a collapsed bottom sheet by default — a
  // marker/segment tap on the map needs to expand it too, otherwise the
  // detail the user just asked for gets scrolled to but stays invisible.
  function selectFromMap(nr: number | null) {
    setSelectedNr(nr);
    if (nr !== null) setMobileExpanded(true);
  }

  return (
    <div className={styles.layout}>
      <LegSchedule
        legs={legs}
        statuses={statuses}
        checkinTimes={checkinTimes}
        selectedNr={selectedNr}
        onSelect={setSelectedNr}
        mobileExpanded={mobileExpanded}
        onToggleMobileExpanded={() => setMobileExpanded((v) => !v)}
      />

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
                  color: isSelected ? ROUTE_SELECTED_COLOR : ROUTE_BASE_COLOR,
                  weight: status === "bezig" || isSelected ? 7 : 5,
                  opacity: 0.95,
                  lineCap: "round",
                }}
                eventHandlers={{ click: () => selectFromMap(isSelected ? null : leg.nr) }}
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
                eventHandlers={{ click: () => selectFromMap(isSelected ? null : leg.nr) }}
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
                    <span className={styles.tooltipRow}>
                      {leg.start_plaats}
                      {tijd ? ` · ${tijd}` : ""}
                      {leg.loper && <BuddyBadge name={leg.loper} />}
                    </span>
                  </Tooltip>
                )}
              </CircleMarker>
            );
          })}

          {displayRunner && runnerIcon && (
            <Marker position={displayRunner.position} icon={runnerIcon} zIndexOffset={1000}>
              <Popup className={styles.runnerPopup}>
                <div className={styles.runnerPopupContent}>
                  <RunnerFigure size={140} color={STATUS_COLORS.bezig} running={displayRunner.running} />
                  <div className={styles.runnerPopupLabel}>{displayRunner.label}</div>
                </div>
              </Popup>
            </Marker>
          )}

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
