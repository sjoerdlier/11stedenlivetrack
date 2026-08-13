import type { Metadata } from "next";
import Link from "next/link";
import { loadLegs } from "@/lib/legs";
import { formatDateTime, formatGeplandeTijd, formatKm } from "@/lib/format";
import { parseRouteSlug, routeConfig, socialMetadata } from "@/lib/routes";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface SchemaPageProps {
  searchParams: Promise<{ route?: string }>;
}

export async function generateMetadata({ searchParams }: SchemaPageProps): Promise<Metadata> {
  const { route } = await searchParams;
  const config = routeConfig(parseRouteSlug(route));
  return socialMetadata(
    `Schema — ${config.pageTitle}`,
    `Volledig schema van de ${config.routeDescription}`,
  );
}

export default async function SchemaPage({ searchParams }: SchemaPageProps) {
  const { route } = await searchParams;
  const activeRoute = parseRouteSlug(route);
  const config = routeConfig(activeRoute);
  const legs = await loadLegs(activeRoute);
  const generatedAt = formatDateTime(new Date());

  return (
    <main className={styles.page}>
      <div className={`${styles.nav} ${styles.noprint}`}>
        <Link href={`/?route=${activeRoute}`}>← Terug naar kaart</Link>
      </div>

      <header className={styles.header}>
        <h1>{config.pageTitle}</h1>
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
            {legs.map((leg) => (
              <tr key={leg.nr}>
                <td>{leg.nr}</td>
                <td>{leg.cp_nummer ?? ""}</td>
                <td className={styles.plaats}>{leg.start_plaats}</td>
                <td>{formatGeplandeTijd(leg.geplande_tijd) ?? ""}</td>
                <td>{leg.afstand_km !== null ? formatKm(leg.afstand_km) : ""}</td>
                <td>{formatKm(leg.cumulatief_start_km)}</td>
                <td>{leg.loper ?? ""}</td>
                <td>{leg.adres ?? ""}</td>
                <td className={styles.bijzonderheden}>{leg.bijzonderheden ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
