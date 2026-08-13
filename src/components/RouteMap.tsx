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
import type { Leg } from "@/lib/legs";
import type { LegSegment } from "@/lib/segments";
import type { Checkin } from "@/lib/checkins";
import type { LivePositionRow } from "@/lib/livePositions";
import type { ElevationPoint } from "@/lib/elevation";
import { formatClockTime, formatGeplandeTijd, formatKm } from "@/lib/format";
import { totalPlannedPaceKmh, totalRouteKm, type LegStatus } from "@/lib/status";
import {
  actualAveragePaceKmh,
  computeActualProgress,
  firstCheckinTimesByLeg,
} from "@/lib/actualProgress";
import { estimateLivePosition, isLivePositionFresh, type LivePosition } from "@/lib/liveMarker";
import { assignCpTooltipDirections, labelModeForZoom } from "@/lib/mapLabels";
import { routeConfig, type RouteSlug } from "@/lib/routes";
import { partiesForRoute, partyConfig, type PartyConfig } from "@/lib/parties";
import LegSchedule from "./LegSchedule";
import styles from "./RouteMap.module.css";

const INITIAL_ZOOM = 11;

// Leaflet's SVG layer isn't part of the page's light/dark cascade the way
// the sidebar's DOM is — a `var(--db-*)` in a stylesheet resolves for a
// CSS-painted element automatically, but pathOptions.color needs a literal
// string handed to Leaflet's JS. So every "Vertrekstaat" board color used on
// the map is read once via getComputedStyle at module load (client-only —
// falls back to the token's light-mode literal for the instant before the
// stylesheet has painted, and again if this ever evaluates during SSR).
// This deliberately *does* track the theme's light/dark split (unlike the
// single fixed charcoal below): --db-steel, --db-amber etc. all carry a
// dark-mode override in globals.css, and the map is meant to re-light with
// the rest of the board, not stay pinned to one theme's values.
function readBoardColor(token: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
}

// The route line's identity color — previously a plain accent blue, always
// on regardless of theme. --db-steel *is* "route/schedule identity" in the
// token system (see globals.css), so this is a deliberate swap to that
// token's value, not just the old blue hiding behind a new variable name.
const ROUTE_BASE_COLOR = readBoardColor("--db-steel", "#2c5c8a");
// A selected leg used to turn green ("the click actually stands out" from
// the rest of the route). Green is now reserved for "voltooid" elsewhere on
// the board, so reusing it here would make a selection read as "done" —
// amber ("live/actief") fits a user-focused segment much better within the
// four-color system, and still contrasts hard against the steel default.
const ROUTE_SELECTED_COLOR = readBoardColor("--db-amber", "#c97a12");

// Filled leg-marker stroke: keeps a "stamped seal" edge readable against
// whatever color the OSM tile underneath happens to be (green fields, blue
// water, pale roads) — same rationale as the old fixed charcoal ring this
// replaces, kept as a literal for the same reason (this is contrast against
// tiles, not a themed board surface).
const MARKER_STROKE_COLOR = "#52514e";
// "Nog te gaan" markers are hollow outlines dimmed to --db-text-dim, not
// pure white — the old bug was a white ring vanishing against near-white
// tiles/cards; a dim mid-gray ring stays visible on both light and dark
// tiles while clearly reading as "hasn't happened yet".
const MARKER_DIM_COLOR = readBoardColor("--db-text-dim", "#5b5f68");
const MARKER_AMBER_COLOR = readBoardColor("--db-amber", "#c97a12");
const MARKER_GREEN_COLOR = readBoardColor("--db-signal-green", "#1f7a4d");
// The live marker (real GPS or estimate) is a fixed "live/actief" amber
// signal now, the same role --db-amber plays everywhere else on the board —
// not tinted per party the way it used to be (see liveMarkers below for
// why that's an acceptable trade here).
const LIVE_MARKER_COLOR = readBoardColor("--db-amber", "#c97a12");

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

// A small pulsing dot for a party's live/estimated position — deliberately
// not a Leaflet CircleMarker, since those can't carry a CSS animation/
// transition. The pulse ring and animation live in RouteMap.module.css
// (with a prefers-reduced-motion override); this just wires up the two
// layered spans divIcon expects as an HTML string.
//
// isLive (real Android-tracker GPS) and the estimated fallback (interpolated
// from pace + check-ins) get visibly different treatments — a solid filled
// dot for confirmed GPS vs. a hollow dashed ring for an estimate — since the
// only other signal (the tooltip's " · live GPS"/" · schatting" suffix)
// isn't reachable on mobile without a hover state.
function liveIconFor(color: string, isLive: boolean) {
  const dotClass = isLive ? styles.liveDot : `${styles.liveDot} ${styles.liveDotEstimated}`;
  const pulseClass = isLive ? styles.livePulse : `${styles.livePulse} ${styles.livePulseEstimated}`;
  const dotStyle = isLive ? `background:${color}` : `border-color:${color}`;
  return L.divIcon({
    className: styles.liveIconWrap,
    html: `<span class="${pulseClass}" style="background:${color}"></span><span class="${dotClass}" style="${dotStyle}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

interface RouteMapProps {
  activeRoute: RouteSlug;
  activeParty: string;
  start: LatLng;
  legSegments: LegSegment[];
  effortLegs: Leg[];
  statuses: Map<number, LegStatus>;
  checkinTimes: Map<number, number>;
  checkinsByLeg: Map<number, Checkin>;
  checkins: Checkin[];
  livePositions: LivePositionRow[];
  now: number;
  lastRefreshedAt: number | null;
  elevationProfile: ElevationPoint[];
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
  activeParty,
  start,
  legSegments,
  effortLegs,
  statuses,
  checkinTimes,
  checkinsByLeg,
  checkins,
  livePositions,
  now,
  lastRefreshedAt,
  elevationProfile,
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

  // One live marker per party sharing this route — for a single-party route
  // (11 Steden) this is exactly the one marker it always was; a route with
  // more than one party (see git history for the KAT100 routes) gets one
  // per independent group, each on its own check-in stream and its own
  // actual/planned pace, same rule TopBar's ETA uses. Pace and the
  // within-leg fraction both come from effortLegs (grade-adjusted) rather
  // than legs, so a climb slows the marker's progress along that stretch
  // instead of assuming a flat, uniform pace.
  //
  // A fresh (see isLivePositionFresh) livePositions row — reported by the
  // Android tracker app — always wins over this estimate: real GPS beats a
  // guess. The estimate is what's left once tracking stops reporting or
  // never started, so the dot never just vanishes mid-race.
  const liveMarkers = useMemo(() => {
    return partiesForRoute(activeRoute)
      .map((party) => {
        const liveRow = livePositions.find(
          (p) => p.party === party.slug && isLivePositionFresh(p.recordedAt, now),
        );
        if (liveRow) {
          const position: LivePosition = { position: [liveRow.lat, liveRow.lon], legNr: 0 };
          return { party, position, isLive: true };
        }

        const partyCheckins = checkins.filter((c) => c.party === party.slug);
        const partyCheckinTimes = firstCheckinTimesByLeg(partyCheckins);
        const progress = computeActualProgress(effortLegs, partyCheckinTimes);
        const actualPaceKmh = actualAveragePaceKmh(partyCheckinTimes, progress.km, now);
        const paceKmh =
          partyCheckinTimes.size >= 2 && actualPaceKmh !== null && actualPaceKmh > 0
            ? actualPaceKmh
            : totalPlannedPaceKmh(effortLegs);
        const position = estimateLivePosition(effortLegs, legSegments, partyCheckinTimes, now, paceKmh);
        return position ? { party, position, isLive: false } : null;
      })
      .filter((m): m is { party: PartyConfig; position: LivePosition; isLive: boolean } => m !== null);
  }, [activeRoute, checkins, effortLegs, legSegments, livePositions, now]);

  // Check-ins carry an *optional* GPS position distinct from the leg's own
  // planned coordinates — a photo stop, a detour, wherever the phone
  // actually was when someone hit "opslaan" in /invoer. Plotting those
  // separately from the leg markers is the only way that ever becomes
  // visible instead of silently unused. Colored per party so two groups'
  // pins stay distinguishable on the same map.
  const checkinPins = useMemo(
    () => checkins.filter((c) => c.lat !== null && c.lon !== null),
    [checkins],
  );

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
        activeParty={activeParty}
        legs={legs}
        effortLegs={effortLegs}
        statuses={statuses}
        checkinTimes={checkinTimes}
        checkinsByLeg={checkinsByLeg}
        selectedNr={selectedNr}
        onSelect={setSelectedNr}
        mobileExpanded={mobileExpanded}
        onToggleMobileExpanded={() => setMobileExpanded((v) => !v)}
        now={now}
        lastRefreshedAt={lastRefreshedAt}
        elevationProfile={elevationProfile}
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
            // Checkpoint/leg markers read as stamps: a "voltooid" leg is a
            // filled green dot (done), "bezig" is a filled amber dot that
            // pulses (live/actief, see .markerPulse below), and anything
            // still ahead is a dimmed outline-only ring — not filled at
            // all — rather than the old solid gray, so it clearly reads as
            // "hasn't happened" instead of just a duller version of "done".
            const markerFill =
              status === "voltooid"
                ? MARKER_GREEN_COLOR
                : status === "bezig"
                  ? MARKER_AMBER_COLOR
                  : "none";
            const markerStroke = status === "nog-te-gaan" ? MARKER_DIM_COLOR : MARKER_STROKE_COLOR;
            return (
              <CircleMarker
                key={`marker-${leg.nr}`}
                center={[leg.start_lat, leg.start_lon]}
                radius={isSelected ? baseRadius + 3 : baseRadius}
                pathOptions={{
                  color: markerStroke,
                  weight: isCp || isSelected ? 2.5 : 1.5,
                  fillColor: markerFill,
                  fillOpacity: status === "nog-te-gaan" ? 0 : 1,
                  className: status === "bezig" ? styles.markerPulse : undefined,
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
                      {tijd ? <span className={styles.tooltipTime}> · {tijd}</span> : null}
                    </span>
                  </Tooltip>
                )}
              </CircleMarker>
            );
          })}

          {checkinPins.map((checkin, i) => {
            const leg = legs.find((l) => l.nr === checkin.leg_nr);
            const tijd = formatClockTime(new Date(checkin.tijdstip).getTime());
            const color = partyConfig(activeRoute, checkin.party).color;
            return (
              <CircleMarker
                key={`checkin-${checkin.party}-${checkin.leg_nr}-${i}`}
                center={[checkin.lat as number, checkin.lon as number]}
                radius={5}
                pathOptions={{
                  color: "#ffffff",
                  weight: 1.5,
                  fillColor: color,
                  fillOpacity: 0.9,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span className={styles.tooltipRow}>
                    📍 {leg?.start_plaats ?? `Leg ${checkin.leg_nr}`}
                    {tijd ? <span className={styles.tooltipTime}> · {tijd}</span> : null}
                    {checkin.notitie ? ` · “${checkin.notitie}”` : ""}
                  </span>
                </Tooltip>
              </CircleMarker>
            );
          })}

          {liveMarkers.map(({ party, position, isLive }) => (
            <Marker
              key={`live-${party.slug}`}
              position={position.position}
              icon={liveIconFor(LIVE_MARKER_COLOR, isLive)}
              zIndexOffset={1000}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                <span className={styles.tooltipRow}>
                  <span
                    className={styles.partyDot}
                    style={{ background: party.color }}
                    aria-hidden
                  />
                  {party.label}
                  {isLive ? " · live GPS" : " · schatting"}
                </span>
              </Tooltip>
            </Marker>
          ))}

          <Marker position={start} icon={startFinishIcon}>
            <Popup>
              Start / Finish — {config.startFinishPlaats}
              <br />
              {config.routeDescription} (<span className={styles.tooltipTime}>{formatKm(totalKm)}</span>)
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}
