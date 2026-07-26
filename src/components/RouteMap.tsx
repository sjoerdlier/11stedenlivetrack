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
import type { Checkin } from "@/lib/checkins";
import { formatGeplandeTijd, formatKm } from "@/lib/format";
import { STATUS_COLORS, totalPlannedPaceKmh, totalRouteKm, type LegStatus } from "@/lib/status";
import { actualAveragePaceKmh, computeActualProgress } from "@/lib/actualProgress";
import { estimateLivePosition } from "@/lib/liveMarker";
import { assignCpTooltipDirections, labelModeForZoom } from "@/lib/mapLabels";
import { routeConfig, type RouteSlug } from "@/lib/routes";
import BuddyBadge from "./BuddyBadge";
import LegSchedule from "./LegSchedule";
import styles from "./RouteMap.module.css";

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

// A small pulsing dot for the estimated live position — deliberately not a
// Leaflet CircleMarker, since those can't carry a CSS animation. The pulse
// ring and animation live in RouteMap.module.css (with a
// prefers-reduced-motion override); this just wires up the two layered
// spans divIcon expects as an HTML string.
const liveIcon = L.divIcon({
  className: styles.liveIconWrap,
  html: `<span class="${styles.livePulse}"></span><span class="${styles.liveDot}"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface RouteMapProps {
  activeRoute: RouteSlug;
  start: LatLng;
  legSegments: LegSegment[];
  statuses: Map<number, LegStatus>;
  checkinTimes: Map<number, number>;
  checkinsByLeg: Map<number, Checkin>;
  now: number;
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

// Switching routes (11 Steden <-> KAT100) re-renders RouteMap with new
// legSegments in place rather than remounting it — react-leaflet's
// MapContainer only reads center/zoom on the *initial* mount, so without
// this the map would stay parked on whichever route loaded first. Refits
// to the new route's full extent whenever its bounds change.
function MapViewController({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, bounds]);
  return null;
}

export default function RouteMap({
  activeRoute,
  start,
  legSegments,
  statuses,
  checkinTimes,
  checkinsByLeg,
  now,
}: RouteMapProps) {
  const [selectedNr, setSelectedNr] = useState<number | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const legs = useMemo(() => legSegments.map((s) => s.leg), [legSegments]);
  const labelMode = labelModeForZoom(zoom);
  const cpDirections = useMemo(() => assignCpTooltipDirections(legs), [legs]);
  const config = routeConfig(activeRoute);
  const totalKm = useMemo(() => totalRouteKm(legs), [legs]);
  const routeBounds = useMemo(() => {
    const allPoints = legSegments.flatMap((s) => s.positions);
    return allPoints.length > 0 ? L.latLngBounds(allPoints) : null;
  }, [legSegments]);

  // Same actual-pace-with-planned-fallback rule TopBar uses for its ETA, so
  // the live marker moves at whichever pace the rest of the app already
  // trusts, rather than inventing a second notion of "current speed".
  const livePosition = useMemo(() => {
    const progress = computeActualProgress(legs, checkinTimes);
    const actualPaceKmh = actualAveragePaceKmh(checkinTimes, progress.km, now);
    const paceKmh =
      checkinTimes.size >= 2 && actualPaceKmh !== null && actualPaceKmh > 0
        ? actualPaceKmh
        : totalPlannedPaceKmh(legs);
    return estimateLivePosition(legs, legSegments, checkinTimes, now, paceKmh);
  }, [legs, legSegments, checkinTimes, now]);
  const liveLeg = livePosition ? legs.find((l) => l.nr === livePosition.legNr) : undefined;

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
        activeRoute={activeRoute}
        legs={legs}
        statuses={statuses}
        checkinTimes={checkinTimes}
        checkinsByLeg={checkinsByLeg}
        selectedNr={selectedNr}
        onSelect={setSelectedNr}
        mobileExpanded={mobileExpanded}
        onToggleMobileExpanded={() => setMobileExpanded((v) => !v)}
      />

      <div className={styles.mapArea}>
        <MapContainer center={start} zoom={INITIAL_ZOOM} className={styles.map} scrollWheelZoom>
          <MapResizeHandler />
          <ZoomWatcher onZoom={setZoom} />
          <MapViewController bounds={routeBounds} />
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

          {livePosition && (
            <Marker position={livePosition.position} icon={liveIcon} zIndexOffset={1000}>
              <Tooltip direction="top" offset={[0, -10]}>
                <span className={styles.tooltipRow}>
                  Live positie
                  {liveLeg?.loper && <BuddyBadge name={liveLeg.loper} />}
                </span>
              </Tooltip>
            </Marker>
          )}

          <Marker position={start} icon={startFinishIcon}>
            <Popup>
              Start / Finish — {config.startFinishPlaats}
              <br />
              {config.routeDescription} ({formatKm(totalKm)})
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}
