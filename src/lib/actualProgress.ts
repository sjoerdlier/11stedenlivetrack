import type { Leg } from "./legs";
import type { Checkin } from "./checkins";
import { totalRouteKm, type Progress } from "./status";

// Earliest recorded check-in per leg_nr — the moment a leg was first
// reached. A later duplicate check-in for the same leg (a correction, an
// accidental re-submit) never moves the arrival time or overrides the note.
export function firstCheckinByLeg(checkins: Checkin[]): Map<number, Checkin> {
  const map = new Map<number, Checkin>();
  for (const checkin of checkins) {
    const time = new Date(checkin.tijdstip).getTime();
    if (Number.isNaN(time)) continue;
    const existing = map.get(checkin.leg_nr);
    if (existing === undefined || time < new Date(existing.tijdstip).getTime()) {
      map.set(checkin.leg_nr, checkin);
    }
  }
  return map;
}

export function firstCheckinTimesByLeg(checkins: Checkin[]): Map<number, number> {
  const map = new Map<number, number>();
  firstCheckinByLeg(checkins).forEach((checkin, legNr) => {
    map.set(legNr, new Date(checkin.tijdstip).getTime());
  });
  return map;
}

// Distance actually covered: the sum of afstand_km for every leg whose
// endpoint (the next leg's start) has a check-in. Legs assumed sorted by nr.
export function computeActualProgress(legs: Leg[], checkinTimes: Map<number, number>): Progress {
  let km = 0;
  for (let i = 0; i < legs.length - 1; i++) {
    const leg = legs[i];
    const next = legs[i + 1];
    if (leg.afstand_km !== null && checkinTimes.has(next.nr)) {
      km += leg.afstand_km;
    }
  }
  km = Math.round(km * 10) / 10;
  const percent = Math.min(100, Math.max(0, (km / totalRouteKm(legs)) * 100));
  return { km, percent };
}

// Actual pace for the stretch just walked to reach this leg: the previous
// leg's own distance over the real elapsed time between the two check-ins.
// Requires a check-in for both this leg and the one before it — the first
// leg has no "before" to measure against, and the leg after the last one
// doesn't exist, so both ends of the array safely yield null.
export function actualLegPaceKmh(
  legs: Leg[],
  checkinTimes: Map<number, number>,
  index: number,
): number | null {
  const leg = legs[index];
  const prev = legs[index - 1];
  if (!leg || !prev || prev.afstand_km === null) return null;

  const prevTime = checkinTimes.get(prev.nr);
  const thisTime = checkinTimes.get(leg.nr);
  if (prevTime === undefined || thisTime === undefined) return null;

  const hours = (thisTime - prevTime) / (1000 * 60 * 60);
  if (hours <= 0) return null;
  return prev.afstand_km / hours;
}

// Actual average pace since the very first check-in of the day: total
// distance actually covered over the real elapsed time since that moment.
export function actualAveragePaceKmh(
  checkinTimes: Map<number, number>,
  afgelegdKm: number,
  now: number,
): number | null {
  if (checkinTimes.size === 0) return null;
  const firstCheckin = Math.min(...checkinTimes.values());
  const hours = (now - firstCheckin) / (1000 * 60 * 60);
  if (hours <= 0) return null;
  return afgelegdKm / hours;
}

// Fixed for now — there's no separate data source for per-checkpoint stop
// duration, so every CP gets the same planning assumption.
const CP_STOP_MINUTES = 10;
const MINUTE_MS = 60_000;

export interface LegTiming {
  stopMinutes: number;
  vertrekGepland: number | null;
  tempoGepland: number | null;
  aankomstWerkelijk: number | null;
  vertrekWerkelijk: number | null;
  tempoWerkelijk: number | null;
}

// Gepland/werkelijk timing for a single leg's card: when this leg is
// scheduled/was actually reached, when the walker leaves again after the
// checkpoint stop, and how fast the *next* stage (this leg's own
// afstand_km, on to the following leg) is planned/was actually walked.
// aankomst_gepland isn't included here — it's just leg.geplande_tijd
// verbatim, no computation needed.
export function computeLegTiming(
  legs: Leg[],
  checkinTimes: Map<number, number>,
  index: number,
): LegTiming {
  const leg = legs[index];
  const next = legs[index + 1];
  const stopMinutes = leg.cp_nummer !== null ? CP_STOP_MINUTES : 0;

  const aankomstGepland = leg.geplande_tijd ? new Date(leg.geplande_tijd).getTime() : null;
  const vertrekGepland =
    aankomstGepland !== null && !Number.isNaN(aankomstGepland)
      ? aankomstGepland + stopMinutes * MINUTE_MS
      : null;

  const volgendeAankomstGepland = next?.geplande_tijd ? new Date(next.geplande_tijd).getTime() : null;
  let tempoGepland: number | null = null;
  if (
    vertrekGepland !== null &&
    volgendeAankomstGepland !== null &&
    !Number.isNaN(volgendeAankomstGepland) &&
    leg.afstand_km !== null
  ) {
    const duurGeplandUur = (volgendeAankomstGepland - vertrekGepland) / (1000 * 60 * 60);
    if (duurGeplandUur > 0) tempoGepland = leg.afstand_km / duurGeplandUur;
  }

  const aankomstWerkelijk = checkinTimes.get(leg.nr) ?? null;
  const vertrekWerkelijk =
    aankomstWerkelijk !== null ? aankomstWerkelijk + stopMinutes * MINUTE_MS : null;
  // Actual pace for the same stage tempoGepland describes (this leg's own
  // afstand_km, on to the next leg) — actualLegPaceKmh(index + 1) measures
  // exactly that: the distance of the leg *before* index+1 (i.e. this leg)
  // over the real time between this leg's check-in and the next leg's.
  const tempoWerkelijk = actualLegPaceKmh(legs, checkinTimes, index + 1);

  return {
    stopMinutes,
    vertrekGepland,
    tempoGepland,
    aankomstWerkelijk,
    vertrekWerkelijk,
    tempoWerkelijk,
  };
}

export interface EstimatedArrival {
  time: number;
  basis: "actueel" | "gepland";
}

// Projected arrival: now + remaining km at whichever pace we trust. With
// fewer than 2 check-ins there isn't enough real data for a pace yet, so
// this falls back to the official planned pace (total route km / total
// scheduled duration), reported with basis "gepland" so callers can label
// it clearly.
export function estimateArrival(
  now: number,
  remainingKm: number,
  actualPaceKmh: number | null,
  plannedPaceKmh: number | null,
  checkinCount: number,
): EstimatedArrival | null {
  const canUseActual = checkinCount >= 2 && actualPaceKmh !== null && actualPaceKmh > 0;
  const pace = canUseActual ? actualPaceKmh : plannedPaceKmh;
  if (pace === null || pace <= 0) return null;

  const hours = remainingKm / pace;
  return {
    time: now + hours * 60 * 60 * 1000,
    basis: canUseActual ? "actueel" : "gepland",
  };
}

// Projects an arrival time for every leg not yet reached, at the current
// actual pace — "when will they get to *my* stop", not just the overall
// finish ETA TopBar already shows. Empty until there are enough check-ins
// for a trustworthy actual pace (the same >=2 threshold estimateArrival
// uses): before that, a projection would just repeat the Gepland column's
// planned-pace value under a different label.
export function estimateLegArrivals(
  legs: Leg[],
  checkinTimes: Map<number, number>,
  now: number,
): Map<number, number> {
  const result = new Map<number, number>();
  if (checkinTimes.size < 2) return result;

  const progress = computeActualProgress(legs, checkinTimes);
  const paceKmh = actualAveragePaceKmh(checkinTimes, progress.km, now);
  if (paceKmh === null || paceKmh <= 0) return result;

  for (const leg of legs) {
    if (checkinTimes.has(leg.nr)) continue;
    const remainingKm = leg.cumulatief_start_km - progress.km;
    if (remainingKm <= 0) continue;
    result.set(leg.nr, now + (remainingKm / paceKmh) * 60 * 60 * 1000);
  }
  return result;
}

export interface ArrivalWindow {
  earliest: number;
  latest: number;
}

// Same paceKmh basis as estimateLegArrivals, but widened into a
// +/-marginRatio window instead of one falsely-precise instant — a
// faster-than-current pace pulls the arrival earlier, a slower one pushes it
// later, so a spectator gets an honest "somewhere in this range" for "wanneer
// is hij bij mij". Empty under the same <2-check-ins condition
// estimateLegArrivals uses (not enough real pace data yet); callers fall
// back to the leg's own geplande_tijd, labeled "volgens schema", for that
// case — see UpcomingArrivals.
export function estimateLegArrivalWindows(
  legs: Leg[],
  checkinTimes: Map<number, number>,
  now: number,
  marginRatio = 0.1,
): Map<number, ArrivalWindow> {
  const result = new Map<number, ArrivalWindow>();
  if (checkinTimes.size < 2) return result;

  const progress = computeActualProgress(legs, checkinTimes);
  const paceKmh = actualAveragePaceKmh(checkinTimes, progress.km, now);
  if (paceKmh === null || paceKmh <= 0) return result;

  const fastPaceKmh = paceKmh * (1 + marginRatio);
  const slowPaceKmh = paceKmh * (1 - marginRatio);

  for (const leg of legs) {
    if (checkinTimes.has(leg.nr)) continue;
    const remainingKm = leg.cumulatief_start_km - progress.km;
    if (remainingKm <= 0) continue;
    const earliest = now + (remainingKm / fastPaceKmh) * 60 * 60 * 1000;
    const latest = slowPaceKmh > 0 ? now + (remainingKm / slowPaceKmh) * 60 * 60 * 1000 : earliest;
    result.set(leg.nr, { earliest, latest });
  }
  return result;
}

export type ScheduleDeltaBand = "voor" | "op" | "achter";

export interface ScheduleDelta {
  minutes: number;
  band: ScheduleDeltaBand;
}

// Within this many minutes either way of geplande_tijd reads as "op schema"
// rather than meaningfully ahead/behind — a real walking pace drifts by a
// minute or two leg to leg even when everything is going exactly to plan.
const ON_SCHEDULE_THRESHOLD_MINUTES = 3;

function bandForMinutes(minutes: number): ScheduleDeltaBand {
  if (minutes <= -ON_SCHEDULE_THRESHOLD_MINUTES) return "voor";
  if (minutes >= ON_SCHEDULE_THRESHOLD_MINUTES) return "achter";
  return "op";
}

// Minutes behind (positive) or ahead of (negative) the printed schedule for
// a single leg: the raw difference between when the walker actually checked
// in here and when geplande_tijd said they would. null when either side is
// missing/unparseable — a leg with no schedule time, or one not yet reached.
export function scheduleDeltaForLeg(
  plannedTijd: string | null,
  actualMs: number | null,
): ScheduleDelta | null {
  if (!plannedTijd || actualMs === null) return null;
  const planned = new Date(plannedTijd).getTime();
  if (Number.isNaN(planned)) return null;
  const minutes = Math.round((actualMs - planned) / MINUTE_MS);
  return { minutes, band: bandForMinutes(minutes) };
}

// The schedule delta for the most recently reached leg — "how far
// ahead/behind schedule is the walker *right now*", the single figure
// TopBar's hero shows (as opposed to a per-leg delta, which is what
// scheduleDeltaForLeg/LegCard show). "Most recently reached" = latest actual
// check-in timestamp, not necessarily the highest leg nr — check-ins should
// arrive in order, but this stays correct even if one lands out of order.
export function currentScheduleDelta(
  legs: Leg[],
  checkinTimes: Map<number, number>,
): ScheduleDelta | null {
  let latestLeg: Leg | null = null;
  let latestTime = -Infinity;
  for (const leg of legs) {
    const time = checkinTimes.get(leg.nr);
    if (time !== undefined && time > latestTime) {
      latestTime = time;
      latestLeg = leg;
    }
  }
  return latestLeg ? scheduleDeltaForLeg(latestLeg.geplande_tijd, latestTime) : null;
}
