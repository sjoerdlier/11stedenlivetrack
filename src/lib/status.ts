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
