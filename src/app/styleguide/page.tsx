import type { Metadata } from "next";
import styles from "./styleguide.module.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const swatches = [
  { name: "ground", token: "--db-ground" },
  { name: "surface", token: "--db-surface" },
  { name: "surface-2", token: "--db-surface-2" },
  { name: "border", token: "--db-border" },
  { name: "text", token: "--db-text" },
  { name: "text-dim", token: "--db-text-dim" },
  { name: "amber (live)", token: "--db-amber" },
  { name: "steel (route)", token: "--db-steel" },
  { name: "signal-red", token: "--db-signal-red" },
  { name: "signal-green", token: "--db-signal-green" },
];

const legs = [
  { stad: "Leeuwarden", tijd: "07:00", status: "voltooid" as const, tempo: "6,1" },
  { stad: "Sneek", tijd: "10:40", status: "voltooid" as const, tempo: "5,8" },
  { stad: "IJlst", tijd: "12:05", status: "bezig" as const, tempo: "5,4" },
  { stad: "Sloten", tijd: "14:20", status: "nog" as const, tempo: "—" },
  { stad: "Stavoren", tijd: "17:10", status: "nog" as const, tempo: "—" },
];

export default function StyleguidePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Vertrekstaat — ontwerprichting</span>
        <div className={styles.heroRow}>
          <div>
            <div className={styles.heroNumber}>16</div>
            <div className={styles.heroLabel}>dagen tot start</div>
          </div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.statLabel}>Voortgang</span>
              <span className={styles.statValue}>38%</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.statLabel}>Tempo</span>
              <span className={styles.statValue}>5,6 km/u</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.statLabel}>Aankomst ±</span>
              <span className={styles.statValue}>17:40</span>
            </div>
          </div>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: "38%" }} />
        </div>
        <button className={styles.donate} type="button">
          <span aria-hidden>❤</span> Doneer voor Lowie
        </button>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Kleur</h2>
        <div className={styles.swatchGrid}>
          {swatches.map((s) => (
            <div className={styles.swatch} key={s.token}>
              <div className={styles.swatchColor} style={{ background: `var(${s.token})` }} />
              <span className={styles.swatchLabel}>{s.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Typografie</h2>
        <div className={styles.typeDisplay}>204</div>
        <div className={styles.typeSans}>IBM Plex Sans — Etappe 3: IJlst → Sloten</div>
        <div className={styles.typeMono}>12:05:33 · 14,2 km · 5,4 km/u</div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Etappeschema (departure rows)</h2>
        <div className={styles.board}>
          <div className={styles.boardHeader}>
            <span>Stad</span>
            <span>Tijd</span>
            <span>Tempo</span>
            <span>Status</span>
          </div>
          {legs.map((leg) => (
            <div className={`${styles.boardRow} ${styles[`row_${leg.status}`]}`} key={leg.stad}>
              <span className={styles.rowCity}>{leg.stad}</span>
              <span className={styles.rowTime}>{leg.tijd}</span>
              <span className={styles.rowTempo}>{leg.tempo}</span>
              <span className={styles.rowStamp}>
                {leg.status === "voltooid" ? "●" : leg.status === "bezig" ? "▸" : "○"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
