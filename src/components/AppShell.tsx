"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LatLng } from "@/lib/gpx";
import type { Leg } from "@/lib/legs";
import type { LegSegment } from "@/lib/segments";
import type { Checkin } from "@/lib/checkins";
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
  start: LatLng;
  legSegments: LegSegment[];
  checkins: Checkin[];
}

export default function AppShell({ activeRoute, start, legSegments, checkins }: AppShellProps) {
  const now = useSimulatedNow(STATUS_REFRESH_MS);
  const router = useRouter();
  const legs = useMemo(() => legSegments.map((s) => s.leg), [legSegments]);
  const statuses = useMemo(() => computeLegStatuses(legs, now), [legs, now]);
  const checkinTimes = useMemo(() => firstCheckinTimesByLeg(checkins), [checkins]);
  // Same "earliest check-in per leg" pick as checkinTimes, but keeping the
  // whole record — LegCard reads .notitie/.invoerder off of it.
  const checkinsByLeg = useMemo(() => firstCheckinByLeg(checkins), [checkins]);
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

  // Detects a newly-arrived leg by diffing checkinsByLeg's keys against the
  // previous render — skipped on the very first render (nothing to diff
  // against yet) so mounting with existing check-ins doesn't toast for all
  // of them at once.
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
  // making "X geleden" meaningless relative to it.
  useEffect(() => {
    if (isDebugMode) return;
    const id = requestAnimationFrame(() => setLastRefreshedAt(Date.now()));
    return () => cancelAnimationFrame(id);
  }, [checkins, isDebugMode]);

  return (
    <div className={styles.shell}>
      <TopBar
        activeRoute={activeRoute}
        legs={legs}
        statuses={statuses}
        now={now}
        checkins={checkins}
        checkinTimes={checkinTimes}
        liveTrackOpen={liveTrackOpen}
        onToggleLiveTrack={() => setLiveTrackOpen((v) => !v)}
      />
      <div className={styles.body}>
        <div className={styles.mapWrap}>
          {newArrival && <NewCheckinToast plaats={newArrival.start_plaats} />}
          <RouteMapLoader
            activeRoute={activeRoute}
            start={start}
            legSegments={legSegments}
            statuses={statuses}
            checkinTimes={checkinTimes}
            checkinsByLeg={checkinsByLeg}
            checkins={checkins}
            now={now}
            lastRefreshedAt={lastRefreshedAt}
          />
        </div>
        <LiveTrackPanel open={liveTrackOpen} onClose={() => setLiveTrackOpen(false)} />
      </div>
    </div>
  );
}
