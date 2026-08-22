import type { Leg } from "./legs";
import type { LegSegment } from "./segments";
import type { LivePositionRow } from "./livePositions";
import { haversineMeters, nearestPointIndexForward, type LatLng } from "./geo";
import { totalRouteKm, totalPlannedPaceKmh, type Progress } from "./status";
import {
  estimateArrival,
  mulberry32,
  percentile,
  type ArrivalForecast,
  type EstimatedArrival,
  type ScheduleDelta,
  type ScheduleDeltaBand,
} from "./actualProgress";
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
// trail (hundreds of rows over 32 hours) on every poll. This is the default
// for the progress-engine's own use (TopBar/AppShell); /beheer's tracker
// dashboard asks historySinceIso for a much wider window instead (see
// TRACKER_DASHBOARD_HISTORY_HOURS below) since it's showing the actual
// travelled trail on a map, not deriving a short-term pace.
export const LIVE_TRACK_HISTORY_WINDOW_MS = 4 * 60 * 60 * 1000;

// /beheer's tracker dashboard (status rows + trail map) wants to see the
// whole of a stability test — e.g. a multi-hour walk, or a 24h
// no-charger battery test — not just the trailing pace window. 24h keeps a
// full day-long test visible while still bounding the query during the real
// 32-hour event, where an unbounded "since the tracker was first turned on"
// would grow to hundreds of rows.
export const TRACKER_DASHBOARD_HISTORY_HOURS = 24;

// getCachedLivePositionHistory's "since" argument, rounded down to the same
// 20s bucket the surrounding unstable_cache revalidate window uses — a raw
// `new Date()` would produce a slightly different ISO string on every single
// call, so every poll (from every viewer) would miss the cache and hit
// Supabase directly, defeating the point of wrapping it in unstable_cache at
// all. Bucketing means concurrent requests within the same 20s window share
// one cached read. `windowMs` defaults to the progress-engine's own window;
// pass a wider one (see TRACKER_DASHBOARD_HISTORY_HOURS) for a caller that
// wants more history than a pace calculation needs.
const HISTORY_CACHE_BUCKET_MS = 20_000;

export function historySinceIso(now: number, windowMs: number = LIVE_TRACK_HISTORY_WINDOW_MS): string {
  const bucketed = Math.floor((now - windowMs) / HISTORY_CACHE_BUCKET_MS) * HISTORY_CACHE_BUCKET_MS;
  return new Date(bucketed).toISOString();
}

// Clamped so a stray/hostile ?historyHours= query param can't force an
// unbounded live_positions scan — 48h comfortably covers the widest
// legitimate ask (TRACKER_DASHBOARD_HISTORY_HOURS's 24h battery/stability
// tests) with room to spare, without allowing "since the beginning of time".
const MAX_HISTORY_HOURS = 48;

// Parses /api/poll's optional ?historyHours= param into a windowMs for
// historySinceIso — pulled out as its own pure function (rather than inlined
// in the route handler) so it's unit-testable without a route-handler test
// harness, which nothing else in this codebase's test suite uses (see
// CLAUDE.md — coverage is src/lib/** only). Returns undefined for a
// missing/invalid/non-positive value, which historySinceIso's own default
// parameter then falls back to (LIVE_TRACK_HISTORY_WINDOW_MS).
export function parseHistoryWindowMs(param: string | null): number | undefined {
  const hours = Number(param);
  if (!Number.isFinite(hours) || hours <= 0) return undefined;
  return Math.min(hours, MAX_HISTORY_HOURS) * 60 * 60 * 1000;
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
  // A range instead of arrival's single falsely-precise instant, once
  // there's enough of the accepted GPS trail to resample a real spread
  // from — see estimateLiveArrivalForecast. null under the same
  // "not enough data yet" condition estimateArrival's "gepland" basis
  // covers, mirroring actualProgress.ts's own arrivalForecast field.
  arrivalForecast: ArrivalForecast | null;
  scheduleDelta: ScheduleDelta | null;
  // When the position this is all based on was actually recorded — TopBar
  // can use this to show "laatste positie Xm geleden" if needed later.
  lastFixAt: number;
}

const FORECAST_MIN_SAMPLES = 3;
const FORECAST_TRIALS = 2000;
// GPS has no leg boundaries to resample per-leg the way
// actualProgress.ts's estimateArrivalForecast does for check-ins —
// splitting the remaining distance into this many equal virtual chunks,
// each drawing its own independently-resampled pace, keeps the same "more
// remaining distance -> more independent draws -> narrower range" behavior
// without needing real legs to split by.
const FORECAST_VIRTUAL_CHUNKS = 10;

// The GPS-mode equivalent of actualProgress.ts's estimateArrivalForecast: a
// range of plausible finish times instead of one falsely-precise ETA,
// bootstrap-resampled from the walker's own observed point-to-point paces
// across the accepted GPS trail (effortKmAtFix/times — already
// forward-walked and plausibility-filtered by the caller) rather than
// per-leg paces, since a continuous GPS position has no leg boundaries.
function estimateLiveArrivalForecast(
  effortKmAtFix: number[],
  times: number[],
  effortRemainingKm: number,
  now: number,
): ArrivalForecast | null {
  const observedPaces: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const hours = (times[i] - times[i - 1]) / (1000 * 60 * 60);
    const km = effortKmAtFix[i] - effortKmAtFix[i - 1];
    if (hours > 0 && km > 0) observedPaces.push(km / hours);
  }
  if (observedPaces.length < FORECAST_MIN_SAMPLES || effortRemainingKm <= 0) return null;

  // Same "seed from the data itself" reasoning as actualProgress.ts's own
  // forecast — identical trail always simulates the same range, and it only
  // shifts once a real new fix arrives.
  const seed = times.reduce((sum, t) => (sum + Math.round(t)) % 2147483647, 0);
  const random = mulberry32(seed || 1);
  const chunkKm = effortRemainingKm / FORECAST_VIRTUAL_CHUNKS;

  const trialFinishTimes: number[] = [];
  for (let trial = 0; trial < FORECAST_TRIALS; trial++) {
    let hours = 0;
    for (let chunk = 0; chunk < FORECAST_VIRTUAL_CHUNKS; chunk++) {
      const pace = observedPaces[Math.floor(random() * observedPaces.length)];
      hours += chunkKm / pace;
    }
    trialFinishTimes.push(now + hours * 60 * 60 * 1000);
  }
  trialFinishTimes.sort((a, b) => a - b);

  return {
    earliest: percentile(trialFinishTimes, 0.1),
    median: percentile(trialFinishTimes, 0.5),
    latest: percentile(trialFinishTimes, 0.9),
    sampleSize: observedPaces.length,
  };
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
  const arrivalForecast = estimateLiveArrivalForecast(effortKmAtFix, times, effortRemainingKm, now);
  const scheduleDelta = scheduleDeltaForKm(legs, currentKm, now);

  return { progress, remainingKm, paceKmh, arrival, arrivalForecast, scheduleDelta, lastFixAt: latestFixTime };
}
