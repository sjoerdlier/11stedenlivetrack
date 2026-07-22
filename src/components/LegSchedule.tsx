import type { Leg } from "@/lib/legs";
import { legPlannedPaceKmh, type LegStatus } from "@/lib/status";
import LegCard from "./LegCard";
import styles from "./LegSchedule.module.css";

interface LegScheduleProps {
  legs: Leg[];
  statuses: Map<number, LegStatus>;
  selectedNr: number | null;
  onSelect: (nr: number | null) => void;
}

export default function LegSchedule({ legs, statuses, selectedNr, onSelect }: LegScheduleProps) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.title}>Lowie — 11Stedentocht</div>
        <div className={styles.hint}>204 km, {legs.length} stops</div>
      </div>

      <ol className={styles.list}>
        {legs.map((leg, index) => {
          const status = statuses.get(leg.nr) ?? "nog-te-gaan";
          const isSelected = leg.nr === selectedNr;
          // The active leg auto-expands when nothing else is picked; a click
          // always wins so any card (past or upcoming) can be inspected.
          const expanded = isSelected || (selectedNr === null && status === "bezig");
          const pace = legPlannedPaceKmh(legs, index);

          return (
            <LegCard
              key={leg.nr}
              leg={leg}
              status={status}
              expanded={expanded}
              pace={pace}
              onToggle={() => onSelect(isSelected ? null : leg.nr)}
            />
          );
        })}
      </ol>
    </div>
  );
}
