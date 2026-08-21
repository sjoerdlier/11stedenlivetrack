"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LatLng } from "@/lib/gpx";
import type { Leg } from "@/lib/legs";
import { buildEffortLegs, type LegSegment } from "@/lib/segments";
import type { Checkin } from "@/lib/checkins";
import type { LivePositionRow } from "@/lib/livePositions";
import type { ElevationPoint } from "@/lib/elevation";
import type { RouteSlug } from "@/lib/routes";
import type { WeatherSnapshot } from "@/lib/weather";
import { firstCheckinByLeg, firstCheckinTimesByLeg } from "@/lib/actualProgress";
import { computeLegStatuses } from "@/lib/status";
import { computeLiveTrackProgress } from "@/lib/liveTrackProgress";
import { useSimulatedNow } from "@/lib/useSimulatedNow";
import TopBar from "./TopBar";
import LegSchedule, { type SidebarTab } from "./LegSchedule";
import RouteMapLoader from "./RouteMapLoader";
import NewCheckinToast from "./NewCheckinToast";
import styles from "./AppShell.module.css";

const STATUS_REFRESH_MS = 30_000;
// Matches page.tsx's unstable_cache revalidate window — polling faster than
// that would just hit the same cached Supabase read over and over.
const DATA_POLL_MS = 20_000;
const TOAST_MS = 6_000;
const LEG_QUERY_PARAM = "leg";

interface AppShellProps {
  activeRoute: RouteSlug;
  activeParty: string;
  start: LatLng;
  legSegments: LegSegment[];
  checkins: Checkin[];
  elevationProfile: ElevationPoint[];
  garminUrl: string | null;
  livePositions: LivePositionRow[];
  // The active party's own recent live_positions trail — separate from
  // `livePositions` above (unfiltered, latest-per-party, feeds the map's
  // dots) because liveTrackProgress.ts needs a whole window of history for
  // one party, not just everyone's latest fix. See liveTrackProgress.ts's
  // header for why GPS drives TopBar's progress/pace/ETA now.
  liveTrackHistory: LivePositionRow[];
  weather: WeatherSnapshot | null;
}

// Reads the initially-selected leg from `?leg=<nr>` — same lazy-initializer,
// SSR-safe pattern useSimulatedNow uses for `?debugTime=` (window is guarded,
// read once at mount, not during the render body directly).
function parseLegParam(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get(LEG_QUERY_PARAM);
  if (!raw) return null;
  const nr = Number(raw);
  return Number.isFinite(nr) ? nr : null;
}

// Mirrors `selectedNr` into the URL as `?leg=<nr>` (or removes it) via plain
// `history.replaceState` rather than Next's router — router.push/replace
// treats a searchParams change as a real navigation (a fresh RSC request for
// this page's server output), which is wasted work for what's purely local
// UI state; a raw replaceState updates the address bar (so a "look, hij is
// nu bij Bartlehiem" link can be copied) without re-fetching or re-rendering
// anything server-side. No history entry either — this is a live selection
// following the map/schedule, not a page the back button should step
// through leg by leg.
function setLegQueryParam(nr: number | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (nr === null) url.searchParams.delete(LEG_QUERY_PARAM);
  else url.searchParams.set(LEG_QUERY_PARAM, String(nr));
  window.history.replaceState(window.history.state, "", url);
}

export default function AppShell({
  activeRoute,
  activeParty,
  start,
  legSegments,
  // Renamed on destructure: these are only the SSR baseline now — the
  // `checkins`/`livePositions` used everywhere below are local state that
  // the poll effect further down keeps fresh, reset back to this baseline
  // whenever a real navigation (route/party switch, hard reload) hands
  // AppShell new SSR props. See that effect's comment for why.
  checkins: initialCheckins,
  elevationProfile,
  garminUrl,
  livePositions: initialLivePositions,
  liveTrackHistory: initialLiveTrackHistory,
  weather,
}: AppShellProps) {
  const now = useSimulatedNow(STATUS_REFRESH_MS);
  const [checkins, setCheckins] = useState(initialCheckins);
  const [livePositions, setLivePositions] = useState(initialLivePositions);
  const [liveTrackHistory, setLiveTrackHistory] = useState(initialLiveTrackHistory);
  const legs = useMemo(() => legSegments.map((s) => s.leg), [legSegments]);
  // Grade-adjusted stand-in for `legs`, fed to pace/ETA math only — see
  // buildEffortLegs. `legs` itself (real km) still drives anything that
  // displays a distance.
  const effortLegs = useMemo(() => buildEffortLegs(legSegments), [legSegments]);
  const statuses = useMemo(() => computeLegStatuses(legs, now), [legs, now]);
  // TopBar/sidebar are scoped to whichever party the switcher has selected
  // (its own progress, pace, notes) — `checkins` itself stays unfiltered and
  // goes to the map (every party's live position at once) and the Updates
  // tab (every party's timeline at once).
  const partyCheckins = useMemo(
    () => checkins.filter((c) => c.party === activeParty),
    [checkins, activeParty],
  );
  const checkinTimes = useMemo(() => firstCheckinTimesByLeg(partyCheckins), [partyCheckins]);
  // Same "earliest check-in per leg" pick as checkinTimes, but keeping the
  // whole record — LegCard reads .notitie/.invoerder off of it.
  const checkinsByLeg = useMemo(() => firstCheckinByLeg(partyCheckins), [partyCheckins]);
  // GPS-derived progress/pace/ETA for the active party — null whenever GPS
  // can't drive the board yet (no fixes, or the newest one has gone stale),
  // in which case TopBar falls back to its own check-in-derived figures. See
  // liveTrackProgress.ts's header for why this is the primary mechanism now.
  const liveTrackProgress = useMemo(
    () => computeLiveTrackProgress(legs, legSegments, effortLegs, liveTrackHistory, now),
    [legs, legSegments, effortLegs, liveTrackHistory, now],
  );
  const [newArrival, setNewArrival] = useState<Leg | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  // Same lazy-initializer pattern useSimulatedNow uses for ?debugTime= —
  // computed once, SSR-safe (window is guarded, not read during the render
  // body directly).
  const [isDebugMode] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debugTime"),
  );

  // Resets the polled overlay back to the fresh SSR baseline whenever
  // AppShell receives genuinely new props from a real navigation (route or
  // party switch — a hard reload just remounts). `initialCheckins`/
  // `initialLivePositions` never change after mount for any other reason
  // (the poll effect below talks straight to /api/poll and never touches
  // router.refresh() or these props), so a route/party change is exactly
  // the signal to re-sync on. This follows React's "adjusting state when a
  // prop changes" pattern — done during render, not inside an effect, so it
  // can't create a refresh loop with the poll below.
  const navKey = `${activeRoute}:${activeParty}`;
  const [prevNavKey, setPrevNavKey] = useState(navKey);
  if (navKey !== prevNavKey) {
    setPrevNavKey(navKey);
    setCheckins(initialCheckins);
    setLivePositions(initialLivePositions);
    setLiveTrackHistory(initialLiveTrackHistory);
  }

  // Selection state lives here (not in RouteMap, not in LegSchedule) so a
  // click in either place drives the other — see selectLeg below. Deep-links
  // via `?leg=<nr>` (see parseLegParam/setLegQueryParam): loading with
  // `?leg=7` in the URL starts with etappe 7 already selected/expanded (and
  // the mobile sheet already open, so the detail is actually visible).
  const [selectedNr, setSelectedNr] = useState<number | null>(parseLegParam);
  const [mobileExpanded, setMobileExpanded] = useState(() => parseLegParam() !== null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("schema");

  function selectLeg(nr: number | null) {
    setSelectedNr(nr);
    // A marker/segment tap on the map (mobile is a collapsed bottom sheet by
    // default) needs to expand the sheet too, otherwise the detail the user
    // just asked for gets scrolled to but stays invisible; re-setting this
    // true from a schedule-originated click (already visible, since you had
    // to be looking at the expanded sheet to click it) is a harmless no-op.
    if (nr !== null) setMobileExpanded(true);
  }

  useEffect(() => {
    setLegQueryParam(selectedNr);
  }, [selectedNr]);

  // Scrolls the selected leg's row into view within the (now sibling, not
  // child-of-RouteMap) schedule list — fires for both map-originated and
  // schedule-originated selections, and for the `?leg=` deep-link on mount.
  useEffect(() => {
    if (selectedNr === null) return;
    document
      .getElementById(`leg-row-${selectedNr}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedNr]);

  // Marks fresh data as having landed on mount and on every route/party
  // switch (the reset above) — the rAF callback (not a synchronous setState
  // in the effect body) matches the poll effect's own pattern of only ever
  // updating this from a callback.
  useEffect(() => {
    if (isDebugMode) return;
    const id = requestAnimationFrame(() => setLastRefreshedAt(Date.now()));
    return () => cancelAnimationFrame(id);
  }, [navKey, isDebugMode]);

  // Viewers were left to reload the page by hand to see new check-ins. Polls
  // a lightweight JSON endpoint (/api/poll) instead of router.refresh() —
  // that avoided re-fetching the whole RSC payload (route geometry,
  // elevation profile — all static for the page view) just to pick up the
  // two datasets that actually change during the event. Paused while the
  // tab is hidden (Page Visibility API): a laptop left open for two days
  // would otherwise poll thousands of times for a tab nobody's looking at.
  // Becoming visible again polls immediately rather than waiting out the
  // rest of the interval, so switching back to the tab shows fresh data
  // right away. Skipped entirely under ?debugTime= so a debug session stays
  // reproducible instead of silently picking up real live data mid-test.
  useEffect(() => {
    if (isDebugMode) return;

    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/poll?route=${activeRoute}&party=${activeParty}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data: {
          checkins?: Checkin[];
          livePositions?: LivePositionRow[];
          livePositionHistory?: LivePositionRow[];
        } = await res.json();
        if (cancelled) return;
        if (data.checkins) setCheckins(data.checkins);
        if (data.livePositions) setLivePositions(data.livePositions);
        if (data.livePositionHistory) setLiveTrackHistory(data.livePositionHistory);
        setLastRefreshedAt(Date.now());
      } catch (err) {
        console.error("AppShell: polling /api/poll failed", err);
      }
    }

    let id: ReturnType<typeof setInterval> | null = null;
    function start() {
      if (id !== null) return;
      poll();
      id = setInterval(poll, DATA_POLL_MS);
    }
    function stop() {
      if (id === null) return;
      clearInterval(id);
      id = null;
    }
    function handleVisibilityChange() {
      if (document.hidden) stop();
      else start();
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeRoute, activeParty, isDebugMode]);

  // Detects a newly-arrived leg (for the active party) by diffing
  // checkinsByLeg's keys against the previous render — skipped on the very
  // first render (nothing to diff against yet) so mounting with existing
  // check-ins doesn't toast for all of them at once.
  const prevLegNrsRef = useRef<Set<number> | null>(null);
  useEffect(() => {
    const currentKeys = new Set(checkinsByLeg.keys());
    const prevKeys = prevLegNrsRef.current;
    prevLegNrsRef.current = currentKeys;
    if (!prevKeys) return;

    const newKeys = [...currentKeys].filter((nr) => !prevKeys.has(nr));
    if (newKeys.length === 0) return;
    const leg = legs.find((l) => l.nr === Math.max(...newKeys));
    if (!leg) return;

    setNewArrival(leg);
    const t = setTimeout(() => setNewArrival(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [checkinsByLeg, legs]);

  return (
    <main className={styles.shell}>
      {/* Same visible-on-focus skip-link styling as the one below, but a
          real navigation rather than an in-page anchor — /update's AI
          journal is written primarily for blind/low-vision visitors, so it
          gets the very first tab stop on the page rather than living only
          as a button further down in TopBar's action row. */}
      <Link href={`/update?route=${activeRoute}`} className={styles.skipLink}>
        Live update voorlezen
      </Link>
      {/* Skip link: invisible until it receives keyboard focus, then jumps
          straight past the map to the etappeschema sidebar — see
          #etappeschema on LegSchedule's root. */}
      <a href="#etappeschema" className={styles.skipLink}>
        Naar het etappeschema
      </a>
      {/* Visually hidden (not display:none, so it stays in the accessibility
          tree) — the map itself has no visible page title, so this is the
          only <h1> a screen reader user gets. */}
      <h1 className={styles.srOnly}>11 Steden Livetrack — Lowie &amp; Björn</h1>
      <TopBar
        activeRoute={activeRoute}
        activeParty={activeParty}
        legs={legs}
        effortLegs={effortLegs}
        statuses={statuses}
        now={now}
        checkins={partyCheckins}
        checkinTimes={checkinTimes}
        liveTrackProgress={liveTrackProgress}
        garminUrl={garminUrl}
        weather={weather}
      />
      <div className={styles.body}>
        <LegSchedule
          activeRoute={activeRoute}
          activeParty={activeParty}
          legs={legs}
          effortLegs={effortLegs}
          statuses={statuses}
          checkinTimes={checkinTimes}
          checkinsByLeg={checkinsByLeg}
          checkins={checkins}
          selectedNr={selectedNr}
          onSelect={selectLeg}
          mobileExpanded={mobileExpanded}
          onToggleMobileExpanded={() => setMobileExpanded((v) => !v)}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          now={now}
          lastRefreshedAt={lastRefreshedAt}
          elevationProfile={elevationProfile}
        />
        <div className={styles.mapWrap}>
          {newArrival && <NewCheckinToast plaats={newArrival.start_plaats} />}
          <RouteMapLoader
            activeRoute={activeRoute}
            start={start}
            legSegments={legSegments}
            effortLegs={effortLegs}
            statuses={statuses}
            checkins={checkins}
            livePositions={livePositions}
            now={now}
            selectedNr={selectedNr}
            onSelectLeg={selectLeg}
          />
        </div>
      </div>
    </main>
  );
}
