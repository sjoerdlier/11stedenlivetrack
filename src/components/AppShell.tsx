"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  weather: WeatherSnapshot | null;
}

export default function AppShell({
  activeRoute,
  activeParty,
  start,
  legSegments,
  checkins,
  elevationProfile,
  garminUrl,
  livePositions,
  weather,
}: AppShellProps) {
  const now = useSimulatedNow(STATUS_REFRESH_MS);
  const router = useRouter();
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

  // Viewers were left to reload the page by hand to see new check-ins.
  // Skipped under ?debugTime= so a debug session stays reproducible instead
  // of silently picking up real live data mid-test.
  useEffect(() => {
    if (isDebugMode) return;
    const id = setInterval(() => router.refresh(), DATA_POLL_MS);
    return () => clearInterval(id);
  }, [router, isDebugMode]);

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

  // Records when fresh data actually landed (mount, or a completed poll) —
  // left null under ?debugTime=, since lastRefreshedAt would use the real
  // wall clock while `now` is frozen on an arbitrary simulated instant,
  // making "X geleden" meaningless relative to it. Watches the full,
  // unfiltered checkins (any party's new data proves the poll is working),
  // not just the active party's.
  useEffect(() => {
    if (isDebugMode) return;
    const id = requestAnimationFrame(() => setLastRefreshedAt(Date.now()));
    return () => cancelAnimationFrame(id);
  }, [checkins, isDebugMode]);

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
        weather={weather}
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
