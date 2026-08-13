import type { Leg } from "@/lib/legs";
import type { Checkin } from "@/lib/checkins";
import { formatClockTime, formatRelativeTime } from "@/lib/format";
import { partyConfig } from "@/lib/parties";
import type { RouteSlug } from "@/lib/routes";
import styles from "./UpdatesFeed.module.css";

interface UpdatesFeedProps {
  activeRoute: RouteSlug;
  // The unfiltered leg list (not effortLegs) — this only ever looks up a
  // check-in's plaats/adres, real distances aren't shown here.
  legs: Leg[];
  // Unfiltered — every party's check-ins, deliberately not scoped to
  // whichever party the switcher has selected. Same rule the map's
  // checkinPins already follows: a live event timeline is more useful
  // showing everyone than showing only the currently-viewed party.
  checkins: Checkin[];
  now: number;
}

// A stable-enough key for a row with no id of its own (Checkin doesn't carry
// one — see checkins.ts) — party + leg_nr + tijdstip is unique in practice
// (one check-in per party per leg per moment), array index as a last-resort
// tiebreaker for the pathological case of two identical rows.
function checkinKey(checkin: Checkin, index: number): string {
  return `${checkin.party}-${checkin.leg_nr}-${checkin.tijdstip}-${index}`;
}

export default function UpdatesFeed({ activeRoute, legs, checkins, now }: UpdatesFeedProps) {
  if (checkins.length === 0) {
    return (
      <p className={styles.empty}>
        Nog geen updates — zodra de eerste check-in binnenkomt verschijnt die hier.
      </p>
    );
  }

  // Newest first — a live timeline, not the chronological order check-ins
  // were walked in. Sorted on a copy; `checkins` itself stays in the
  // ascending order loadCheckins/AppShell rely on elsewhere.
  const sorted = [...checkins].sort(
    (a, b) => new Date(b.tijdstip).getTime() - new Date(a.tijdstip).getTime(),
  );

  return (
    <ol className={styles.list} aria-label="Live updates, nieuwste eerst">
      {sorted.map((checkin, index) => {
        const leg = legs.find((l) => l.nr === checkin.leg_nr);
        const time = new Date(checkin.tijdstip).getTime();
        const party = partyConfig(activeRoute, checkin.party);
        return (
          <li key={checkinKey(checkin, index)} className={styles.row}>
            <span className={styles.partyDot} style={{ background: party.color }} aria-hidden />
            <div className={styles.body}>
              <div className={styles.headline}>
                <span className={styles.party}>{party.label}</span>
                <span className={styles.plaats}>{leg?.start_plaats ?? `Etappe ${checkin.leg_nr}`}</span>
              </div>
              <div className={styles.meta}>
                {formatClockTime(time) ?? checkin.tijdstip}
                <span aria-hidden> · </span>
                {formatRelativeTime(time, now)}
                {checkin.invoerder && (
                  <>
                    <span aria-hidden> · </span>
                    {checkin.invoerder}
                  </>
                )}
              </div>
              {checkin.notitie && <div className={styles.note}>{checkin.notitie}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
