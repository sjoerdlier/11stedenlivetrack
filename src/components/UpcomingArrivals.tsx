import type { Leg } from "@/lib/legs";
import { estimateLegArrivalWindows } from "@/lib/actualProgress";
import { formatClockTime, formatGeplandeTijd, formatKm, googleMapsUrl } from "@/lib/format";
import type { LegStatus } from "@/lib/status";
import styles from "./UpcomingArrivals.module.css";

interface UpcomingArrivalsProps {
  // Real (unadjusted) legs — for plaats/adres/afstand display.
  legs: Leg[];
  // Grade-adjusted — fed into the arrival-window estimate only, so a climb
  // ahead widens/shifts the window instead of assuming a flat pace.
  effortLegs: Leg[];
  statuses: Map<number, LegStatus>;
  checkinTimes: Map<number, number>;
  now: number;
}

const MAX_SHOWN = 4;
const ARRIVAL_MARGIN_RATIO = 0.1;

// "Wanneer is hij bij mij?" — the next few not-yet-reached stops with an
// honest arrival *window* (±10% pace), for a spectator planning to be
// somewhere along the route, not for the walker's own team (that's the
// Schema tab's job). Distinct from the Schema tab's expectedArrival column:
// this only ever shows the next few *upcoming* stops, with the CP/adres info
// a spectator actually needs to find the spot.
export default function UpcomingArrivals({
  legs,
  effortLegs,
  statuses,
  checkinTimes,
  now,
}: UpcomingArrivalsProps) {
  const windows = estimateLegArrivalWindows(effortLegs, checkinTimes, now, ARRIVAL_MARGIN_RATIO);
  const upcoming = legs
    .filter((leg) => (statuses.get(leg.nr) ?? "nog-te-gaan") === "nog-te-gaan")
    .slice(0, MAX_SHOWN);

  if (upcoming.length === 0) {
    return <p className={styles.empty}>Geen aankomende etappes meer — de route is (bijna) klaar.</p>;
  }

  return (
    <ol className={styles.list} aria-label="Eerstvolgende etappes">
      {upcoming.map((leg) => {
        const window = windows.get(leg.nr);
        return (
          <li key={leg.nr} className={styles.row}>
            <div className={styles.headline}>
              <span className={styles.plaats}>{leg.start_plaats}</span>
              {leg.cp_nummer !== null && <span className={styles.cpBadge}>CP {leg.cp_nummer}</span>}
            </div>

            {window ? (
              <div className={styles.window}>
                Verwacht tussen <strong>{formatClockTime(window.earliest)}</strong> en{" "}
                <strong>{formatClockTime(window.latest)}</strong>
              </div>
            ) : (
              <div className={styles.window}>
                {formatGeplandeTijd(leg.geplande_tijd) ?? "–"}
                <span className={styles.basis}> volgens schema</span>
              </div>
            )}

            <div className={styles.meta}>
              {formatKm(leg.cumulatief_start_km)} totaal
              {leg.adres && (
                <>
                  <span aria-hidden> · </span>
                  <a
                    className={styles.adres}
                    href={googleMapsUrl(leg.start_lat, leg.start_lon)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    📍 {leg.adres}
                  </a>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
