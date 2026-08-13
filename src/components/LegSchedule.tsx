import type { Leg } from "@/lib/legs";
import type { Checkin } from "@/lib/checkins";
import type { ElevationPoint } from "@/lib/elevation";
import { computeLegTiming, estimateLegArrivals } from "@/lib/actualProgress";
import { formatKm, formatRelativeTime } from "@/lib/format";
import { totalRouteKm, type LegStatus } from "@/lib/status";
import { routeConfig, type RouteSlug } from "@/lib/routes";
import { partiesForRoute, partyConfig } from "@/lib/parties";
import ElevationProfile from "./ElevationProfile";
import LegCard from "./LegCard";
import styles from "./LegSchedule.module.css";

interface LegScheduleProps {
  activeRoute: RouteSlug;
  activeParty: string;
  legs: Leg[];
  effortLegs: Leg[];
  statuses: Map<number, LegStatus>;
  checkinTimes: Map<number, number>;
  checkinsByLeg: Map<number, Checkin>;
  selectedNr: number | null;
  onSelect: (nr: number | null) => void;
  mobileExpanded: boolean;
  onToggleMobileExpanded: () => void;
  now: number;
  lastRefreshedAt: number | null;
  elevationProfile: ElevationPoint[];
}

export default function LegSchedule({
  activeRoute,
  activeParty,
  legs,
  effortLegs,
  statuses,
  checkinTimes,
  checkinsByLeg,
  selectedNr,
  onSelect,
  mobileExpanded,
  onToggleMobileExpanded,
  now,
  lastRefreshedAt,
  elevationProfile,
}: LegScheduleProps) {
  const config = routeConfig(activeRoute);
  // effortLegs (grade-adjusted) drives arrival projections so a climb ahead
  // pushes an ETA back — legs (real km) is what's shown on screen.
  const legArrivals = estimateLegArrivals(effortLegs, checkinTimes, now);
  // Only worth naming the party once there's more than one sharing this
  // route to disambiguate between — a single-party route keeps the plain
  // route title it always had.
  const parties = partiesForRoute(activeRoute);
  const title =
    parties.length > 1 ? `${partyConfig(activeRoute, activeParty).label} — ${config.pageTitle}` : config.pageTitle;
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
          <div className={styles.title}>{title}</div>
          <div className={styles.hint}>
            {formatKm(totalRouteKm(legs))}, {legs.length} stops
            {lastRefreshedAt !== null && ` · bijgewerkt ${formatRelativeTime(lastRefreshedAt, now)}`}
          </div>
        </div>
        <span className={styles.chevron} aria-hidden>
          ▲
        </span>
      </div>

      <div className={styles.elevationWrap}>
        <ElevationProfile profile={elevationProfile} />
      </div>

      <div className={styles.boardHeader}>
        <span>Stad</span>
        <span>Tijd</span>
        <span>Tempo</span>
        <span>Status</span>
      </div>

      <ol className={styles.list}>
        {legs.map((leg, index) => {
          const status = statuses.get(leg.nr) ?? "nog-te-gaan";
          const isSelected = leg.nr === selectedNr;
          // The active leg auto-expands when nothing else is picked; a click
          // always wins so any card (past or upcoming) can be inspected.
          const expanded = isSelected || (selectedNr === null && status === "bezig");
          const timing = computeLegTiming(effortLegs, checkinTimes, index);

          return (
            <LegCard
              key={leg.nr}
              leg={leg}
              status={status}
              expanded={expanded}
              timing={timing}
              checkin={checkinsByLeg.get(leg.nr) ?? null}
              expectedArrival={legArrivals.get(leg.nr) ?? null}
              onToggle={() => onSelect(isSelected ? null : leg.nr)}
            />
          );
        })}
      </ol>
    </div>
  );
}
