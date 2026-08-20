import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { buddyForLeg, loadLegs } from "@/lib/legs";
import { formatDateTime, formatGeplandeTijd, formatKm } from "@/lib/format";
import { parseRouteSlug, routeConfig, socialMetadata } from "@/lib/routes";
import { partiesForRoute, partyConfig, parsePartySlug } from "@/lib/parties";
import { groupLegsByDay } from "@/lib/scheduleDays";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

// Nr, CP, Plaats, Tijd, Afstand, Cumulatief, Buddy, Adres, Bijzonderheden —
// the day-separator row spans the full table width.
const COLUMN_COUNT = 9;

interface SchemaPageProps {
  searchParams: Promise<{ route?: string; party?: string }>;
}

export async function generateMetadata({ searchParams }: SchemaPageProps): Promise<Metadata> {
  const { route, party } = await searchParams;
  const activeRoute = parseRouteSlug(route);
  const config = routeConfig(activeRoute);
  const parties = partiesForRoute(activeRoute);
  const activeParty = parsePartySlug(activeRoute, party);
  // Same "only name the party once there's more than one" rule TopBar and
  // LegSchedule already follow, so a single-party route's printed schema
  // keeps the plain title it always had.
  const title =
    parties.length > 1 ? `${partyConfig(activeRoute, activeParty).label} — ${config.pageTitle}` : config.pageTitle;
  return socialMetadata(`Schema — ${title}`, `Volledig schema van de ${config.routeDescription}`);
}

export default async function SchemaPage({ searchParams }: SchemaPageProps) {
  const { route, party } = await searchParams;
  const activeRoute = parseRouteSlug(route);
  const config = routeConfig(activeRoute);
  const parties = partiesForRoute(activeRoute);
  const activeParty = parsePartySlug(activeRoute, party);
  const legs = await loadLegs(activeRoute);
  const generatedAt = formatDateTime(new Date());
  const dayGroups = groupLegsByDay(legs);
  const title =
    parties.length > 1 ? `${partyConfig(activeRoute, activeParty).label} — ${config.pageTitle}` : config.pageTitle;

  return (
    <main className={styles.page}>
      <div className={`${styles.nav} ${styles.noprint}`}>
        <Link href={`/?route=${activeRoute}&party=${activeParty}`}>← Terug naar kaart</Link>
      </div>

      <header className={styles.header}>
        <h1>{title}</h1>
        <p className={styles.subtitle}>Volledig schema · gegenereerd {generatedAt}</p>
      </header>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nr</th>
              <th>CP</th>
              <th>Plaats</th>
              <th>Tijd</th>
              <th>Afstand</th>
              <th>Cumulatief</th>
              <th>Buddy</th>
              <th>Adres</th>
              <th>Bijzonderheden</th>
            </tr>
          </thead>
          <tbody>
            {dayGroups.map((group) => (
              <Fragment key={group.key}>
                <tr className={styles.dayRow}>
                  <th colSpan={COLUMN_COUNT} scope="colgroup">
                    {group.label}
                  </th>
                </tr>
                {group.legs.map(({ leg }) => (
                  <tr key={leg.nr}>
                    <td>{leg.nr}</td>
                    <td>{leg.cp_nummer ?? ""}</td>
                    <td className={styles.plaats}>{leg.start_plaats}</td>
                    <td>{formatGeplandeTijd(leg.geplande_tijd) ?? ""}</td>
                    <td>{leg.afstand_km !== null ? formatKm(leg.afstand_km) : ""}</td>
                    <td>{formatKm(leg.cumulatief_start_km)}</td>
                    <td>{buddyForLeg(leg, activeParty) ?? ""}</td>
                    <td>{leg.adres ?? ""}</td>
                    <td className={styles.bijzonderheden}>{leg.bijzonderheden ?? ""}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
