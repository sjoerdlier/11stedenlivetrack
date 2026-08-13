"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/gpx";
import type { Leg } from "@/lib/legs";
import { buildEffortLegs, type LegSegment } from "@/lib/segments";
import type { Checkin } from "@/lib/checkins";
import type { LivePositionRow } from "@/lib/livePositions";
import type { ElevationPoint } from "@/lib/elevation";
import type { RouteSlug } from "@/lib/routes";
import { firstCheckinByLeg, firstCheckinTimesByLeg } from "@/lib/actualProgress";
import { computeLegStatuses } from "@/lib/status";
import { useSimulatedNow } from "@/lib/useSimulatedNow";
import TopBar from "./TopBar";
import RouteMapLoader from "./RouteMapLoader";
import LiveTrackPanel from "./LiveTrackPanel";
import NewCheckinToast from "./NewCheckinToast";
import styles from "./AppShell.module.css";

const STATUS_REFRESH_MS = 30_000;
// Matches page.tsx's unstable_cache revalidate window — polling faster than
// that would just hit the same cached Supabase read over and over.
const DATA_POLL_MS = 20_000;
const TOAST_MS = 6_000;

interface AppShellProps {
  activeRoute: RouteSlug;
  activeParty: string;
  start: LatLng;
  legSegments: LegSegment[];
  checkins: Checkin[];
  elevationProfile: ElevationPoint[];
  garminUrl: string | null;
  livePositions: LivePositionRow[];
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
}: AppShellProps) {
  const now = useSimulatedNow(STATUS_REFRESH_MS);
  const [checkins, setCheckins] = useState(initialCheckins);
  const [livePositions, setLivePositions] = useState(initialLivePositions);
  const legs = useMemo(() => legSegments.map((s) => s.leg), [legSegments]);
  // Grade-adjusted stand-in for `legs`, fed to pace/ETA math only — see
  // buildEffortLegs. `legs` itself (real km) still drives anything that
  // displays a distance.
  const effortLegs = useMemo(() => buildEffortLegs(legSegments), [legSegments]);
  const statuses = useMemo(() => computeLegStatuses(legs, now), [legs, now]);
  // TopBar/sidebar are scoped to whichever party the switcher has selected
  // (its own progress, pace, notes) — `checkins` itself stays unfiltered and
  // goes to the map, which shows every party's live position at once.
  const partyCheckins = useMemo(
    () => checkins.filter((c) => c.party === activeParty),
    [checkins, activeParty],
  );
  const checkinTimes = useMemo(() => firstCheckinTimesByLeg(partyCheckins), [partyCheckins]);
  // Same "earliest check-in per leg" pick as checkinTimes, but keeping the
  // whole record — LegCard reads .notitie/.invoerder off of it.
  const checkinsByLeg = useMemo(() => firstCheckinByLeg(partyCheckins), [partyCheckins]);
  const [liveTrackOpen, setLiveTrackOpen] = useState(false);
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
  }

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
        const res = await fetch(`/api/poll?route=${activeRoute}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data: { checkins?: Checkin[]; livePositions?: LivePositionRow[] } = await res.json();
        if (cancelled) return;
        if (data.checkins) setCheckins(data.checkins);
        if (data.livePositions) setLivePositions(data.livePositions);
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
  }, [activeRoute, isDebugMode]);

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
    <div className={styles.shell}>
      <TopBar
        activeRoute={activeRoute}
        activeParty={activeParty}
        legs={legs}
        effortLegs={effortLegs}
        statuses={statuses}
        now={now}
        checkins={partyCheckins}
        checkinTimes={checkinTimes}
        liveTrackOpen={liveTrackOpen}
        onToggleLiveTrack={() => setLiveTrackOpen((v) => !v)}
      />
      <div className={styles.body}>
        <div className={styles.mapWrap}>
          {newArrival && <NewCheckinToast plaats={newArrival.start_plaats} />}
          <RouteMapLoader
            activeRoute={activeRoute}
            activeParty={activeParty}
            start={start}
            legSegments={legSegments}
            effortLegs={effortLegs}
            statuses={statuses}
            checkinTimes={checkinTimes}
            checkinsByLeg={checkinsByLeg}
            checkins={checkins}
            livePositions={livePositions}
            now={now}
            lastRefreshedAt={lastRefreshedAt}
            elevationProfile={elevationProfile}
          />
        </div>
        <LiveTrackPanel open={liveTrackOpen} onClose={() => setLiveTrackOpen(false)} garminUrl={garminUrl} />
      </div>
    </div>
  );
}
