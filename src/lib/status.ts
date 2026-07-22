import type { Leg } from "./legs";

export type LegStatus = "voltooid" | "bezig" | "nog-te-gaan";

// Shared between the map and the side-menu so both read the same system.
export const STATUS_COLORS: Record<LegStatus, string> = {
  voltooid: "#9c9b93",
  bezig: "#2a78d6",
  "nog-te-gaan": "#ffffff",
};

export const STATUS_LABELS: Record<LegStatus, string> = {
  voltooid: "Voltooid",
  bezig: "Bezig",
  "nog-te-gaan": "Nog te gaan",
};

// A leg is "voltooid" once the next leg's geplande_tijd has passed, "bezig"
// once its own geplande_tijd has passed (and the next hasn't yet), otherwise
// "nog-te-gaan". Legs assumed sorted by nr; the last leg can only reach
// "bezig" since there is no next leg's time to complete it against.
export function statusForLeg(legs: Leg[], index: number, now: number): LegStatus {
  const leg = legs[index];
  const next = legs[index + 1];
  const legTime = leg.geplande_tijd ? new Date(leg.geplande_tijd).getTime() : null;
  const nextTime = next?.geplande_tijd ? new Date(next.geplande_tijd).getTime() : null;

  if (nextTime !== null && !Number.isNaN(nextTime) && now >= nextTime) return "voltooid";
  if (legTime !== null && !Number.isNaN(legTime) && now >= legTime) return "bezig";
  return "nog-te-gaan";
}

export function computeLegStatuses(legs: Leg[], now: number): Map<number, LegStatus> {
  const map = new Map<number, LegStatus>();
  legs.forEach((leg, i) => {
    map.set(leg.nr, statusForLeg(legs, i, now));
  });
  return map;
}

// Average planned pace for a leg: its distance over the elapsed time between
// this leg's geplande_tijd and the next leg's. The last leg has no next time
// to measure against, so its pace is unknown.
export function legPlannedPaceKmh(legs: Leg[], index: number): number | null {
  const leg = legs[index];
  const next = legs[index + 1];
  if (leg.afstand_km === null || !leg.geplande_tijd || !next?.geplande_tijd) return null;

  const start = new Date(leg.geplande_tijd).getTime();
  const end = new Date(next.geplande_tijd).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  const hours = (end - start) / (1000 * 60 * 60);
  return leg.afstand_km / hours;
}

export const TOTAL_ROUTE_KM = 202;

// Total planned average pace over the whole route: the fixed route distance
// over the scheduled duration from the first leg's time to the last, a
// constant until live tracking data (fase 4b) replaces it.
export function totalPlannedPaceKmh(legs: Leg[]): number | null {
  const first = legs[0];
  const last = legs[legs.length - 1];
  if (!first?.geplande_tijd || !last?.geplande_tijd) return null;

  const start = new Date(first.geplande_tijd).getTime();
  const end = new Date(last.geplande_tijd).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  const hours = (end - start) / (1000 * 60 * 60);
  return TOTAL_ROUTE_KM / hours;
}

export interface Progress {
  km: number;
  percent: number;
}

// Progress is the cumulatief_start_km of the last completed (voltooid) leg,
// as a share of the official route distance. Legs assumed sorted by nr.
export function computeProgress(legs: Leg[], statuses: Map<number, LegStatus>): Progress {
  let km = 0;
  for (const leg of legs) {
    if (statuses.get(leg.nr) === "voltooid") {
      km = leg.cumulatief_start_km;
    }
  }
  const percent = Math.min(100, Math.max(0, (km / TOTAL_ROUTE_KM) * 100));
  return { km, percent };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Whole days remaining until leg 1's geplande_tijd, or null once that time
// has passed (or is unknown) — the signal the top bar uses to switch from
// the pre-start countdown to the normal progress display. Rounds up so
// "starts in 6 hours" still reads as "nog 1 dag" rather than "nog 0 dagen".
export function daysUntilStart(legs: Leg[], now: number): number | null {
  const firstLeg = legs.find((l) => l.nr === 1);
  const startTime = firstLeg?.geplande_tijd ? new Date(firstLeg.geplande_tijd).getTime() : null;

  if (startTime === null || Number.isNaN(startTime) || now >= startTime) return null;
  return Math.max(1, Math.ceil((startTime - now) / DAY_MS));
}
