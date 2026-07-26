import type { Leg } from "@/lib/legs";
import type { Checkin } from "@/lib/checkins";
import { computeLegTiming } from "@/lib/actualProgress";
import { formatKm, formatRelativeTime } from "@/lib/format";
import { totalRouteKm, type LegStatus } from "@/lib/status";
import { routeConfig, type RouteSlug } from "@/lib/routes";
import LegCard from "./LegCard";
import styles from "./LegSchedule.module.css";

interface LegScheduleProps {
  activeRoute: RouteSlug;
  legs: Leg[];
  statuses: Map<number, LegStatus>;
  checkinTimes: Map<number, number>;
  checkinsByLeg: Map<number, Checkin>;
  selectedNr: number | null;
  onSelect: (nr: number | null) => void;
  mobileExpanded: boolean;
  onToggleMobileExpanded: () => void;
  now: number;
  lastRefreshedAt: number | null;
}

export default function LegSchedule({
  activeRoute,
  legs,
  statuses,
  checkinTimes,
  checkinsByLeg,
  selectedNr,
  onSelect,
  mobileExpanded,
  onToggleMobileExpanded,
  now,
  lastRefreshedAt,
}: LegScheduleProps) {
  const config = routeConfig(activeRoute);
  return (
    <div className={`${styles.sidebar} ${mobileExpanded ? styles.expanded : ""}`}>
      <div className={styles.handle} aria-hidden />
      <div
        className={styles.header}
        onClick={onToggleMobileExpanded}
        role="button"
        tabIndex={0}
        aria-expanded={mobileExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggleMobileExpanded();
        }}
      >
        <div>
          <div className={styles.title}>{config.pageTitle}</div>
          <div className={styles.hint}>
            {formatKm(totalRouteKm(legs))}, {legs.length} stops
            {lastRefreshedAt !== null && ` · bijgewerkt ${formatRelativeTime(lastRefreshedAt, now)}`}
          </div>
        </div>
        <span className={styles.chevron} aria-hidden>
          ▲
        </span>
      </div>

      <ol className={styles.list}>
        {legs.map((leg, index) => {
          const status = statuses.get(leg.nr) ?? "nog-te-gaan";
          const isSelected = leg.nr === selectedNr;
          // The active leg auto-expands when nothing else is picked; a click
          // always wins so any card (past or upcoming) can be inspected.
          const expanded = isSelected || (selectedNr === null && status === "bezig");
          const timing = computeLegTiming(legs, checkinTimes, index);

          return (
            <LegCard
              key={leg.nr}
              leg={leg}
              status={status}
              expanded={expanded}
              timing={timing}
              checkin={checkinsByLeg.get(leg.nr) ?? null}
              onToggle={() => onSelect(isSelected ? null : leg.nr)}
            />
          );
        })}
      </ol>
    </div>
  );
}
