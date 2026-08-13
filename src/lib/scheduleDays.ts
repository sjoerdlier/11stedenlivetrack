import type { Leg } from "./legs";
import { formatDayLabel } from "./format";

export interface DayGroup {
  // ISO date (yyyy-mm-dd, Europe/Amsterdam) or "onbekend" for legs with no
  // geplande_tijd — stable, sortable-as-string key for React lists.
  key: string;
  // "Zaterdag 29 augustus" — see formatDayLabel.
  label: string;
  legs: { leg: Leg; index: number }[];
}

const UNKNOWN_DAY_KEY = "onbekend";

// yyyy-mm-dd in Europe/Amsterdam, regardless of what timezone the process
// itself runs in — same reasoning as formatGeplandeTijd/formatDayLabel. The
// en-CA locale is a deliberate trick: it's the one built-in Intl locale that
// formats a date as yyyy-mm-dd, so this needs no manual field re-assembly.
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Amsterdam",
});

function dayKey(geplandeTijd: string | null): string {
  if (!geplandeTijd) return UNKNOWN_DAY_KEY;
  const date = new Date(geplandeTijd);
  if (Number.isNaN(date.getTime())) return UNKNOWN_DAY_KEY;
  return dayKeyFormatter.format(date);
}

// Groups legs (assumed already sorted by nr, i.e. chronological) into
// consecutive same-calendar-day runs, each carrying the leg's own index in
// the original `legs` array — callers that need that index (computeLegTiming
// et al. take a position into the *full* legs array, not a per-day-local
// one) don't have to re-derive it via indexOf. A leg with no geplande_tijd
// (or an unparseable one) falls into an "onbekend" bucket rather than
// crashing the grouping — defensive, not expected in real schedule data.
export function groupLegsByDay(legs: Leg[]): DayGroup[] {
  const groups: DayGroup[] = [];
  legs.forEach((leg, index) => {
    const key = dayKey(leg.geplande_tijd);
    const current = groups[groups.length - 1];
    if (!current || current.key !== key) {
      groups.push({
        key,
        label: key === UNKNOWN_DAY_KEY ? "Onbekende datum" : formatDayLabel(leg.geplande_tijd) ?? "Onbekende datum",
        legs: [{ leg, index }],
      });
    } else {
      current.legs.push({ leg, index });
    }
  });
  return groups;
}
