import type { Leg } from "./legs";
import type { LegSegment } from "./segments";
import type { LivePositionRow } from "./livePositions";
import { haversineMeters, nearestPointIndexForward, type LatLng } from "./geo";
import { totalRouteKm, totalPlannedPaceKmh, type Progress } from "./status";
import { estimateArrival, type EstimatedArrival, type ScheduleDelta, type ScheduleDeltaBand } from "./actualProgress";
import { LIVE_POSITION_MAX_AGE_MS } from "./liveMarker";

// GPS is the *primary* progress mechanism now, not a supplement to
// check-ins — the whole point of tracking Lowie's own device (see the
// gps666.net bridge) is that a 32-hour, ~200km walk by two blindfolded
// walkers is too hard to hand-check-in for at every one of 23 legs.
// TopBar reaches for this module's output first; actualProgress.ts's
// check-in-derived figures are the fallback for whenever GPS goes stale
// (LIVE_POSITION_MAX_AGE_MS) or never started (no tracker attached, dead
// battery, no signal) — see TopBar.tsx for how the two get merged.

// Long enough to smooth over the real gap between fixes (4-15 minutes
// observed) without averaging pace across the whole 32-hour event the way
// an all-time-since-first-fix pace would — that would barely move and stop
// reflecting how fast the walker is going *right now*.
const PACE_WINDOW_MS = 90 * 60 * 1000;
const MINUTE_MS = 60_000;

// A fix whose nearest route point is still this far away is more likely a
// GPS glitch (multipath, a bad read from the gps666.net bridge — this is a
// reverse-engineered, unofficial API, not vetted hardware) than a genuine
// detour this far off a marked route with a guide. Generous enough to allow
// a real stop at a checkpoint building just off the line.
const MAX_OFF_ROUTE_METERS = 1500;
// A fix implying ground speed above this between it and the last *accepted*
// fix is treated as a bad reading rather than real movement — well above any
// sustained walking pace, but low enough to catch a multi-km GPS jump. Both
// this and MAX_OFF_ROUTE_METERS exist because a single bad fix would
// otherwise permanently corrupt the trail: nearestPointIndexForward only
// ever searches forward from where the previous fix landed (see its own
// comment for why — the route revisits some spots), so one wildly-wrong
// "forward" snap would push that search boundary past every subsequent
// good fix, with no way back.
const MAX_PLAUSIBLE_SPEED_KMH = 25;

// How far back page.tsx/api/poll fetch a party's live_positions trail for —
// comfortably wider than PACE_WINDOW_MS so a pace can always be computed
// from a full window's worth of fixes, without pulling the whole event's
// trail (hundreds of rows over 32 hours) on every poll.
export const LIVE_TRACK_HISTORY_WINDOW_MS = 4 * 60 * 60 * 1000;

// getCachedLivePositionHistory's "since" argument, rounded down to the same
// 20s bucket the surrounding unstable_cache revalidate window uses — a raw
// `new Date()` would produce a slightly different ISO string on every single
// call, so every poll (from every viewer) would miss the cache and hit
// Supabase directly, defeating the point of wrapping it in unstable_cache at
// all. Bucketing means concurrent requests within the same 20s window share
// one cached read.
const HISTORY_CACHE_BUCKET_MS = 20_000;

export function historySinceIso(now: number): string {
  const bucketed = Math.floor((now - LIVE_TRACK_HISTORY_WINDOW_MS) / HISTORY_CACHE_BUCKET_MS) * HISTORY_CACHE_BUCKET_MS;
  return new Date(bucketed).toISOString();
}

// Mirrors actualProgress.ts's own (unexported) ON_SCHEDULE_THRESHOLD_MINUTES
// — kept at the same value so "op schema" means the same thing everywhere on
// the board. Not imported from there because this module's schedule delta is
// keyed off a continuous GPS km position rather than a leg arrival, so it
// doesn't fit that file's per-leg function shape.
const ON_SCHEDULE_THRESHOLD_MINUTES = 3;

function bandForMinutes(minutes: number): ScheduleDeltaBand {
  if (minutes <= -ON_SCHEDULE_THRESHOLD_MINUTES) return "voor";
  if (minutes >= ON_SCHEDULE_THRESHOLD_MINUTES) return "achter";
  return "op";
}

interface RoutePoints {
  points: LatLng[];
  km: number[];
  effortKm: number[];
}

// Flattens legSegments into one point trail spanning the whole route, with
// two parallel cumulative-distance arrays — real km (scaled to each leg's
// own afstand_km) and grade-adjusted km (scaled to effortLegs' equivalent) —
// rather than the raw polyline length. Scaling to the leg's own declared
// distance (not summed haversine hops) keeps a GPS-projected km comparable
// to computeActualProgress's check-in-derived one, which also sums
// afstand_km. legSegments and effortLegs are index-aligned (buildEffortLegs
// maps 1:1 over legSegments), so a plain index lookup pairs each segment
// with its effort equivalent.
function buildRoutePoints(legSegments: LegSegment[], effortLegs: Leg[]): RoutePoints {
  const points: LatLng[] = [];
  const km: number[] = [];
  const effortKm: number[] = [];

  legSegments.forEach(({ leg, positions }, i) => {
    if (positions.length === 0) return;
    const effortLeg = effortLegs[i];
    const segMeters: number[] = [0];
    for (let p = 1; p < positions.length; p++) {
      segMeters.push(segMeters[p - 1] + haversineMeters(positions[p - 1], positions[p]));
    }
    const totalMeters = segMeters[segMeters.length - 1];
    const legKm = leg.afstand_km ?? 0;
    const legEffortKm = effortLeg?.afstand_km ?? 0;

    for (let p = 0; p < positions.length; p++) {
      // Consecutive legSegments share a boundary point (buildLegSegments
      // slices each segment through the next leg's start index) — skip it
      // on every segment after the first so it isn't pushed twice.
      if (points.length > 0 && p === 0) continue;
      points.push(positions[p]);
      const fraction = totalMeters > 0 ? segMeters[p] / totalMeters : 0;
      km.push(leg.cumulatief_start_km + fraction * legKm);
      effortKm.push((effortLeg?.cumulatief_start_km ?? 0) + fraction * legEffortKm);
    }
  });

  return { points, km, effortKm };
}

export interface LiveTrackProgress {
  progress: Progress;
  remainingKm: number;
  paceKmh: number | null;
  arrival: EstimatedArrival | null;
  scheduleDelta: ScheduleDelta | null;
  // When the position this is all based on was actually recorded — TopBar
  // can use this to show "laatste positie Xm geleden" if needed later.
  lastFixAt: number;
}

function expectedTimeForKm(legs: Leg[], km: number): number | null {
  if (legs.length === 0) return null;
  const toTime = (leg: Leg) => (leg.geplande_tijd ? new Date(leg.geplande_tijd).getTime() : NaN);

  if (km <= legs[0].cumulatief_start_km) {
    const t = toTime(legs[0]);
    return Number.isNaN(t) ? null : t;
  }
  for (let i = 0; i < legs.length - 1; i++) {
    const a = legs[i];
    const b = legs[i + 1];
    if (km <= b.cumulatief_start_km) {
      const aTime = toTime(a);
      const bTime = toTime(b);
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return null;
      const span = b.cumulatief_start_km - a.cumulatief_start_km;
      if (span <= 0) return aTime;
      const fraction = (km - a.cumulatief_start_km) / span;
      return aTime + fraction * (bTime - aTime);
    }
  }
  const last = legs[legs.length - 1];
  const t = toTime(last);
  return Number.isNaN(t) ? null : t;
}

// The continuous equivalent of actualProgress.ts's currentScheduleDelta:
// "how far ahead/behind is the walker right now", interpolated between
// whichever two legs' geplande_tijd bracket the GPS-derived km instead of
// needing a check-in to land exactly on a leg boundary.
function scheduleDeltaForKm(legs: Leg[], km: number, now: number): ScheduleDelta | null {
  const expected = expectedTimeForKm(legs, km);
  if (expected === null) return null;
  const minutes = Math.round((now - expected) / MINUTE_MS);
  return { minutes, band: bandForMinutes(minutes) };
}

// GPS-derived progress/pace/ETA/schedule-status for one party, built from
// their recent live_positions trail (see livePositions.ts's
// loadLivePositionHistory) rather than check-ins. Returns null whenever GPS
// can't drive the board — no fixes at all, or the newest one is older than
// LIVE_POSITION_MAX_AGE_MS (the tracker's stopped reporting) — so callers
// can fall back to check-in-derived figures, the same threshold the map's
// own live dot uses to fall back to its estimate.
export function computeLiveTrackProgress(
  legs: Leg[],
  legSegments: LegSegment[],
  effortLegs: Leg[],
  history: LivePositionRow[],
  now: number,
): LiveTrackProgress | null {
  if (history.length === 0 || legs.length === 0) return null;

  const latest = history[history.length - 1];
  const latestTime = new Date(latest.recordedAt).getTime();
  if (Number.isNaN(latestTime) || Math.abs(now - latestTime) > LIVE_POSITION_MAX_AGE_MS) {
    return null;
  }

  const { points, km, effortKm } = buildRoutePoints(legSegments, effortLegs);
  if (points.length === 0) return null;

  // Walks the trail chronologically, each fix's nearest-point search
  // starting where the previous *accepted* one landed — the same
  // forward-only disambiguation the route itself needs for spots it visits
  // twice (e.g. Bartlehiem), applied here to a live GPS trail instead of a
  // known leg boundary. A fix that lands implausibly far from the route, or
  // implies an implausible speed since the last accepted fix, is skipped
  // entirely (fromIdx/prevKm/prevTime don't advance) rather than accepted —
  // see MAX_OFF_ROUTE_METERS/MAX_PLAUSIBLE_SPEED_KMH's comments for why a
  // single bad fix can't be allowed to move the search boundary.
  let fromIdx = 0;
  let latestIdx = 0;
  let prevTime: number | null = null;
  let prevKm: number | null = null;
  const times: number[] = [];
  const effortKmAtFix: number[] = [];
  for (const fix of history) {
    const t = new Date(fix.recordedAt).getTime();
    if (Number.isNaN(t)) continue;

    const idx = nearestPointIndexForward(points, [fix.lat, fix.lon], fromIdx);
    if (haversineMeters([fix.lat, fix.lon], points[idx]) > MAX_OFF_ROUTE_METERS) continue;

    const fixKm = km[idx];
    if (prevTime !== null && prevKm !== null) {
      const hours = (t - prevTime) / (1000 * 60 * 60);
      if (hours > 0 && Math.abs(fixKm - prevKm) / hours > MAX_PLAUSIBLE_SPEED_KMH) continue;
    }

    fromIdx = idx;
    latestIdx = idx;
    prevTime = t;
    prevKm = fixKm;
    times.push(t);
    effortKmAtFix.push(effortKm[idx]);
  }
  if (times.length === 0) return null;

  const currentKm = km[latestIdx];
  const currentEffortKm = effortKm[latestIdx];
  const totalKm = totalRouteKm(legs);
  const totalEffortKm = totalRouteKm(effortLegs);

  const progress: Progress = {
    km: Math.round(currentKm * 10) / 10,
    percent: Math.min(100, Math.max(0, (currentKm / totalKm) * 100)),
  };
  const remainingKm = Math.max(0, totalKm - currentKm);
  const effortRemainingKm = Math.max(0, totalEffortKm - currentEffortKm);

  // Pace over the trailing window (see PACE_WINDOW_MS) rather than the
  // whole trail since the very first fix.
  const latestFixTime = times[times.length - 1];
  const windowStart = latestFixTime - PACE_WINDOW_MS;
  let windowStartIndex = times.length - 1;
  for (let i = 0; i < times.length; i++) {
    if (times[i] >= windowStart) {
      windowStartIndex = i;
      break;
    }
  }
  let paceKmh: number | null = null;
  if (windowStartIndex < times.length - 1) {
    const hours = (latestFixTime - times[windowStartIndex]) / (1000 * 60 * 60);
    const effortDeltaKm = effortKmAtFix[effortKmAtFix.length - 1] - effortKmAtFix[windowStartIndex];
    if (hours > 0 && effortDeltaKm > 0) {
      paceKmh = effortDeltaKm / hours;
    }
  }

  const plannedPaceKmh = totalPlannedPaceKmh(effortLegs);
  // Reuses estimateArrival's own >=2-samples gate by reporting "2" exactly
  // when this window actually produced a real pace, and "0" otherwise — same
  // canUseActual condition check-ins drive, just fed from a GPS-derived pace
  // instead of a check-in count.
  const arrival = estimateArrival(now, effortRemainingKm, paceKmh, plannedPaceKmh, paceKmh !== null ? 2 : 0);
  const scheduleDelta = scheduleDeltaForKm(legs, currentKm, now);

  return { progress, remainingKm, paceKmh, arrival, scheduleDelta, lastFixAt: latestFixTime };
}
