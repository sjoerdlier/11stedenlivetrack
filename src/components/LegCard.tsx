import type { Leg } from "@/lib/legs";
import { formatGeplandeTijd, googleMapsUrl } from "@/lib/format";
import { STATUS_COLORS, STATUS_LABELS, type LegStatus } from "@/lib/status";
import BuddyBadge from "./BuddyBadge";
import styles from "./LegCard.module.css";

interface LegCardProps {
  leg: Leg;
  status: LegStatus;
  expanded: boolean;
  onToggle: () => void;
}

export default function LegCard({ leg, status, expanded, onToggle }: LegCardProps) {
  const tijd = formatGeplandeTijd(leg.geplande_tijd);
  const isCp = leg.cp_nummer !== null;
  const compact = status === "voltooid" && !expanded;

  return (
    <li>
      <button
        type="button"
        id={`leg-row-${leg.nr}`}
        className={[
          styles.card,
          styles[`status-${status}`],
          compact ? styles.compact : "",
          status === "bezig" ? styles.active : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className={styles.header}>
          <span
            className={`${styles.dot} ${isCp ? styles.dotCp : ""}`}
            style={{ background: STATUS_COLORS[status] }}
            aria-hidden
          />
          <span className={styles.plaats}>{leg.start_plaats}</span>
          {isCp && <span className={styles.cpBadge}>CP {leg.cp_nummer}</span>}
          <span className={styles.tijd}>{tijd ?? "–"}</span>
        </div>

        {!compact && (
          <div className={styles.metaRow}>
            {leg.afstand_km !== null && <span>{leg.afstand_km} km</span>}
            <span className={styles.statusPill}>{STATUS_LABELS[status]}</span>
          </div>
        )}

        {expanded && (
          <div className={styles.details}>
            <dl className={styles.factList}>
              <div className={styles.fact}>
                <dt>Cumulatief</dt>
                <dd>{leg.cumulatief_start_km} km</dd>
              </div>
              {leg.loper && (
                <div className={styles.fact}>
                  <dt>Buddy</dt>
                  <dd>
                    <BuddyBadge name={leg.loper} />
                  </dd>
                </div>
              )}
            </dl>

            {leg.adres && (
              <a
                className={styles.adres}
                href={googleMapsUrl(leg.start_lat, leg.start_lon)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                📍 {leg.adres}
              </a>
            )}

            {leg.bijzonderheden && (
              <div className={styles.warning}>
                <span className={styles.warningIcon} aria-hidden>
                  ⚠
                </span>
                <div>
                  <div className={styles.warningLabel}>Let op</div>
                  <div>{leg.bijzonderheden}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </button>
    </li>
  );
}
