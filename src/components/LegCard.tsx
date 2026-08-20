import type { Leg } from "@/lib/legs";
import type { Checkin } from "@/lib/checkins";
import { scheduleDeltaForLeg, type LegTiming, type ScheduleDeltaBand } from "@/lib/actualProgress";
import {
  formatGeplandeTijd,
  formatClockTime,
  formatKm,
  formatPaceKmh,
  formatScheduleDelta,
  googleMapsUrl,
} from "@/lib/format";
import { STATUS_LABELS, type LegStatus } from "@/lib/status";
import BuddyBadge from "./BuddyBadge";
import styles from "./LegCard.module.css";

interface LegCardProps {
  leg: Leg;
  status: LegStatus;
  expanded: boolean;
  timing: LegTiming;
  checkin: Checkin | null;
  expectedArrival: number | null;
  // Already resolved to the party currently being viewed — see
  // legs.ts's buddyForLeg. Can be a comma-separated list of names (Björn
  // sometimes has two buddies on the same stretch), split into one badge
  // each below.
  buddy: string | null;
  onToggle: () => void;
}

const DASH = "–";

// The row's status glyph — the departure-board "stamp" — mirrors the
// styleguide's board mock exactly (voltooid/bezig/nog-te-gaan), colored via
// the status-* class on the row rather than per-glyph so it stays in sync
// with the rest of the row's signal coloring.
const STATUS_GLYPH: Record<LegStatus, string> = {
  voltooid: "●",
  bezig: "▸",
  "nog-te-gaan": "○",
};

// Same three-way signal system used everywhere else on the board (see
// globals.css's token roles) — voor/op/achter schedule maps directly onto
// the "done"/"live"/"critical-now" roles those tokens already carry.
const DELTA_COLOR: Record<ScheduleDeltaBand, string> = {
  voor: "var(--db-signal-green)",
  op: "var(--db-amber)",
  achter: "var(--db-signal-red)",
};

export default function LegCard({
  leg,
  status,
  expanded,
  timing,
  checkin,
  expectedArrival,
  buddy,
  onToggle,
}: LegCardProps) {
  const buddyNames = buddy
    ? buddy
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
    : [];
  const isCp = leg.cp_nummer !== null;
  // "compact" only gates the detail panel below the summary line — the
  // summary itself (stad/tijd/tempo/status) is always shown, unchanged
  // logic from before the redesign (voltooid legs collapse by default,
  // bezig/nog-te-gaan legs and any explicitly selected leg stay open).
  const compact = status === "voltooid" && !expanded;
  const noteTijd = checkin ? formatClockTime(new Date(checkin.tijdstip).getTime()) : null;
  const scheduleDelta = scheduleDeltaForLeg(
    leg.geplande_tijd,
    checkin ? new Date(checkin.tijdstip).getTime() : null,
  );

  return (
    <li>
      <button
        type="button"
        id={`leg-row-${leg.nr}`}
        className={[styles.row, styles[`status-${status}`], compact ? styles.compact : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className={styles.summary}>
          <span className={styles.city}>
            {leg.start_plaats}
            {isCp && <span className={styles.cpBadge}>CP {leg.cp_nummer}</span>}
          </span>
          <span className={styles.time}>{formatGeplandeTijd(leg.geplande_tijd) ?? DASH}</span>
          <span className={styles.tempo}>{formatPaceKmh(timing.tempoGepland) ?? DASH}</span>
          <span className={styles.stamp} aria-hidden>
            {STATUS_GLYPH[status]}
          </span>
        </span>
        <span className={styles.srOnly}>{STATUS_LABELS[status]}</span>

        {!compact && (
          <span className={styles.detail}>
            <span className={styles.metaRow}>
              {leg.afstand_km !== null && (
                <>
                  <span>{formatKm(leg.afstand_km)}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span>{formatKm(leg.cumulatief_start_km)} totaal</span>
            </span>

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
                    {scheduleDelta && (
                      <span className={styles.deltaBadge} style={{ color: DELTA_COLOR[scheduleDelta.band] }}>
                        {formatScheduleDelta(scheduleDelta)}
                      </span>
                    )}
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

            {buddyNames.length > 0 && (
              <div className={styles.buddyRow}>
                <span className={styles.buddyLabel}>Buddy</span>
                <span className={styles.buddyBadges}>
                  {buddyNames.map((name) => (
                    <BuddyBadge key={name} name={name} />
                  ))}
                </span>
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
          </span>
        )}
      </button>
    </li>
  );
}
