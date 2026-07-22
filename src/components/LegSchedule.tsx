import type { Leg } from "@/lib/legs";
import { formatGeplandeTijd } from "@/lib/format";
import { STATUS_COLORS, STATUS_LABELS, type LegStatus } from "@/lib/status";
import styles from "./LegSchedule.module.css";

interface LegScheduleProps {
  legs: Leg[];
  statuses: Map<number, LegStatus>;
  selectedNr: number | null;
  onSelect: (nr: number) => void;
}

export default function LegSchedule({ legs, statuses, selectedNr, onSelect }: LegScheduleProps) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.title}>Lowie — 11Stedentocht</div>
        <div className={styles.hint}>204 km, 22 etappes</div>
      </div>

      <ol className={styles.list}>
        {legs.map((leg) => {
          const status = statuses.get(leg.nr) ?? "nog-te-gaan";
          const isSelected = leg.nr === selectedNr;
          const tijd = formatGeplandeTijd(leg.geplande_tijd);

          return (
            <li key={leg.nr}>
              <button
                type="button"
                id={`leg-row-${leg.nr}`}
                className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                onClick={() => onSelect(leg.nr)}
                aria-expanded={isSelected}
              >
                <span
                  className={styles.dot}
                  style={{ background: STATUS_COLORS[status] }}
                  aria-hidden
                />
                <span className={styles.rowMain}>
                  <span className={styles.rowTop}>
                    <span className={styles.plaats}>{leg.start_plaats}</span>
                    <span className={styles.tijd}>{tijd ?? "–"}</span>
                  </span>
                  <span className={styles.rowBottom}>
                    <span className={styles.afstand}>{leg.afstand_km} km</span>
                    <span className={styles.statusLabel}>{STATUS_LABELS[status]}</span>
                  </span>
                  {isSelected && (
                    <span className={styles.detail}>
                      Buddy: {leg.loper} · Cumulatief: {leg.cumulatief_start_km} km
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
