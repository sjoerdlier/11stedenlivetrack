import type { Leg } from "@/lib/legs";
import type { Checkin } from "@/lib/checkins";
import type { LegTiming } from "@/lib/actualProgress";
import { formatGeplandeTijd, formatClockTime, formatKm, formatPaceKmh, googleMapsUrl } from "@/lib/format";
import { STATUS_COLORS, STATUS_LABELS, type LegStatus } from "@/lib/status";
import BuddyBadge from "./BuddyBadge";
import styles from "./LegCard.module.css";

interface LegCardProps {
  leg: Leg;
  status: LegStatus;
  expanded: boolean;
  timing: LegTiming;
  checkin: Checkin | null;
  expectedArrival: number | null;
  onToggle: () => void;
}

const DASH = "–";

export default function LegCard({
  leg,
  status,
  expanded,
  timing,
  checkin,
  expectedArrival,
  onToggle,
}: LegCardProps) {
  const isCp = leg.cp_nummer !== null;
  const compact = status === "voltooid" && !expanded;
  const noteTijd = checkin ? formatClockTime(new Date(checkin.tijdstip).getTime()) : null;

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
          {compact ? (
            <span className={styles.tijd}>{formatGeplandeTijd(leg.geplande_tijd) ?? DASH}</span>
          ) : (
            <span className={styles.statusLabel}>{STATUS_LABELS[status]}</span>
          )}
        </div>

        {!compact && (
          <>
            <div className={styles.metaRow}>
              {leg.afstand_km !== null && (
                <>
                  <span>{formatKm(leg.afstand_km)}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span>{formatKm(leg.cumulatief_start_km)} totaal</span>
            </div>

            <table className={styles.timingTable}>
              <thead>
                <tr>
                  <th scope="col" />
                  <th scope="col">Gepland</th>
                  <th scope="col">Werkelijk</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Aankomst</th>
                  <td>{formatGeplandeTijd(leg.geplande_tijd) ?? DASH}</td>
                  <td className={timing.aankomstWerkelijk === null ? styles.pending : ""}>
                    {timing.aankomstWerkelijk !== null
                      ? formatClockTime(timing.aankomstWerkelijk) ?? DASH
                      : DASH}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Vertrek</th>
                  <td>
                    {timing.vertrekGepland !== null
                      ? formatClockTime(timing.vertrekGepland) ?? DASH
                      : DASH}
                  </td>
                  <td className={timing.vertrekWerkelijk === null ? styles.pending : ""}>
                    {timing.vertrekWerkelijk !== null
                      ? formatClockTime(timing.vertrekWerkelijk) ?? DASH
                      : DASH}
                  </td>
                </tr>
                <tr>
                  <th scope="row" title="Hoogtegecorrigeerd tempo — houdt rekening met klimmen en dalen.">
                    Tempo
                    <span className={styles.gapBadge} aria-hidden>
                      ⛰
                    </span>
                  </th>
                  <td>{formatPaceKmh(timing.tempoGepland) ?? DASH}</td>
                  <td className={timing.tempoWerkelijk === null ? styles.pending : ""}>
                    {formatPaceKmh(timing.tempoWerkelijk) ?? DASH}
                  </td>
                </tr>
              </tbody>
            </table>

            {expectedArrival !== null && (
              <div className={styles.expectedLine}>
                Verwacht hier: ± {formatClockTime(expectedArrival)}
                <span className={styles.expectedBasis}>o.b.v. actueel tempo</span>
              </div>
            )}

            {timing.stopMinutes > 0 && (
              <div className={styles.stopLine}>Stop: {timing.stopMinutes} min (CP)</div>
            )}

            {leg.loper && (
              <div className={styles.buddyRow}>
                <span className={styles.buddyLabel}>Buddy</span>
                <BuddyBadge name={leg.loper} />
              </div>
            )}

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

            {checkin?.notitie && (
              <div className={styles.note}>
                <span className={styles.noteIcon} aria-hidden>
                  💬
                </span>
                <div>
                  <div>{checkin.notitie}</div>
                  <div className={styles.noteMeta}>
                    {checkin.invoerder}
                    {noteTijd && ` · ${noteTijd}`}
                  </div>
                </div>
              </div>
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
          </>
        )}
      </button>
    </li>
  );
}
