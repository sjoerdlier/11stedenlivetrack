import Link from "next/link";
import { loadLegs } from "@/lib/legs";
import { formatGeplandeTijd } from "@/lib/format";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Schema — 11Stedentocht",
};

export default async function SchemaPage() {
  const legs = await loadLegs();
  const generatedAt = new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date());

  return (
    <main className={styles.page}>
      <div className={`${styles.nav} ${styles.noprint}`}>
        <Link href="/">← Terug naar kaart</Link>
      </div>

      <header className={styles.header}>
        <h1>Lowie — 11Stedentocht</h1>
        <p className={styles.subtitle}>Volledig schema · gegenereerd {generatedAt}</p>
      </header>

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
              <td>{leg.afstand_km !== null ? `${leg.afstand_km} km` : ""}</td>
              <td>{leg.cumulatief_start_km} km</td>
              <td>{leg.loper ?? ""}</td>
              <td>{leg.adres ?? ""}</td>
              <td className={styles.bijzonderheden}>{leg.bijzonderheden ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
