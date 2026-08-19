import type { KeyboardEvent } from "react";
import { buddyForLeg, type Leg } from "@/lib/legs";
import type { Checkin } from "@/lib/checkins";
import type { ElevationPoint } from "@/lib/elevation";
import { computeLegTiming, estimateLegArrivals } from "@/lib/actualProgress";
import { groupLegsByDay } from "@/lib/scheduleDays";
import { formatKm, formatRelativeTime } from "@/lib/format";
import { totalRouteKm, type LegStatus } from "@/lib/status";
import { routeConfig, type RouteSlug } from "@/lib/routes";
import { partiesForRoute, partyConfig } from "@/lib/parties";
import ElevationProfile from "./ElevationProfile";
import LegCard from "./LegCard";
import UpdatesFeed from "./UpdatesFeed";
import UpcomingArrivals from "./UpcomingArrivals";
import styles from "./LegSchedule.module.css";

export type SidebarTab = "schema" | "updates" | "aankomst";

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "schema", label: "Schema" },
  { id: "updates", label: "Updates" },
  { id: "aankomst", label: "Aankomst" },
];

interface LegScheduleProps {
  activeRoute: RouteSlug;
  activeParty: string;
  legs: Leg[];
  effortLegs: Leg[];
  statuses: Map<number, LegStatus>;
  checkinTimes: Map<number, number>;
  checkinsByLeg: Map<number, Checkin>;
  // Unfiltered — every party's check-ins, not just activeParty's — the
  // Updates tab deliberately shows both, same as the map already does.
  checkins: Checkin[];
  selectedNr: number | null;
  onSelect: (nr: number | null) => void;
  mobileExpanded: boolean;
  onToggleMobileExpanded: () => void;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  now: number;
  lastRefreshedAt: number | null;
  elevationProfile: ElevationPoint[];
}

// WAI-ARIA "automatic activation" tabs pattern: Left/Right moves *and*
// selects (no separate Enter/Space step), Home/End jump to the ends. Tab
// buttons stay in the DOM regardless of which is selected (only the panels
// toggle `hidden`), so focusing the next button needs no extra wait for it
// to mount.
function handleTabKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  currentId: SidebarTab,
  onTabChange: (tab: SidebarTab) => void,
) {
  const index = TABS.findIndex((t) => t.id === currentId);
  let nextIndex: number | null = null;
  if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
  else if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = TABS.length - 1;
  if (nextIndex === null) return;

  event.preventDefault();
  const nextId = TABS[nextIndex].id;
  onTabChange(nextId);
  document.getElementById(`tab-${nextId}`)?.focus();
}

export default function LegSchedule({
  activeRoute,
  activeParty,
  legs,
  effortLegs,
  statuses,
  checkinTimes,
  checkinsByLeg,
  checkins,
  selectedNr,
  onSelect,
  mobileExpanded,
  onToggleMobileExpanded,
  activeTab,
  onTabChange,
  now,
  lastRefreshedAt,
  elevationProfile,
}: LegScheduleProps) {
  const config = routeConfig(activeRoute);
  // effortLegs (grade-adjusted) drives arrival projections so a climb ahead
  // pushes an ETA back — legs (real km) is what's shown on screen.
  const legArrivals = estimateLegArrivals(effortLegs, checkinTimes, now);
  const dayGroups = groupLegsByDay(legs);
  // Only worth naming the party once there's more than one sharing this
  // route to disambiguate between — a single-party route keeps the plain
  // route title it always had.
  const parties = partiesForRoute(activeRoute);
  const title =
    parties.length > 1 ? `${partyConfig(activeRoute, activeParty).label} — ${config.pageTitle}` : config.pageTitle;

  return (
    // id/tabIndex target the skip link in AppShell — tabIndex={-1} makes it
    // focusable programmatically (so keyboard focus visibly lands here, not
    // just the scroll position) without adding it to the normal Tab order.
    <div
      id="etappeschema"
      tabIndex={-1}
      className={`${styles.sidebar} ${mobileExpanded ? styles.expanded : ""}`}
    >
      <div className={styles.handle} aria-hidden />
      {/* Header + tabs stick together to the top of .sidebar's own scroll
          port (same sticky-within-scroll-container pattern .dayHeader below
          already uses) so the tab bar stays reachable while the Schema list
          scrolls underneath it, instead of scrolling away with the content. */}
      <div className={styles.stickyTop}>
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
            <h2 className={styles.title}>{title}</h2>
            <div className={styles.hint}>
              {formatKm(totalRouteKm(legs))}, {legs.length} stops
              {lastRefreshedAt !== null && ` · bijgewerkt ${formatRelativeTime(lastRefreshedAt, now)}`}
            </div>
          </div>
          <span className={styles.chevron} aria-hidden>
            ▲
          </span>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Sidebar onderdelen">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabSelected : ""}`}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, tab.id, onTabChange)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div id="panel-schema" role="tabpanel" aria-labelledby="tab-schema" hidden={activeTab !== "schema"}>
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
          {dayGroups.map((group) => (
            <li key={group.key} className={styles.dayGroup}>
              <h3 className={styles.dayHeader}>{group.label}</h3>
              <ol className={styles.dayList}>
                {group.legs.map(({ leg, index }) => {
                  const status = statuses.get(leg.nr) ?? "nog-te-gaan";
                  const isSelected = leg.nr === selectedNr;
                  // The active leg auto-expands when nothing else is picked;
                  // a click always wins so any card (past or upcoming) can
                  // be inspected.
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
                      buddy={buddyForLeg(leg, activeParty)}
                      onToggle={() => onSelect(isSelected ? null : leg.nr)}
                    />
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      </div>

      <div id="panel-updates" role="tabpanel" aria-labelledby="tab-updates" hidden={activeTab !== "updates"}>
        <UpdatesFeed activeRoute={activeRoute} legs={legs} checkins={checkins} now={now} />
      </div>

      <div id="panel-aankomst" role="tabpanel" aria-labelledby="tab-aankomst" hidden={activeTab !== "aankomst"}>
        <UpcomingArrivals legs={legs} effortLegs={effortLegs} statuses={statuses} checkinTimes={checkinTimes} now={now} />
      </div>
    </div>
  );
}
