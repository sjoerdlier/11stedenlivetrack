import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/LoadError.module.css";

// Next's file-based 404 (thrown by an unmatched route, or explicit
// notFound() calls — see src/app/styleguide/page.tsx). Without this file
// Next falls back to its own bare default screen, which after the full
// Vertrekstaat redesign would read as the app being broken rather than a
// simple wrong URL. Reuses LoadError's panel pattern (see LoadError.tsx)
// rather than inventing a second "error card" look.
export const metadata: Metadata = {
  title: "Pagina niet gevonden — 11 Steden Livetrack",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden>
          🧭
        </div>
        <div className={styles.title}>Pagina niet gevonden</div>
        <p className={styles.hint}>
          Deze pagina bestaat niet (meer), of de link klopt niet helemaal. De live kaart en
          het etappeschema staan op de startpagina.
        </p>
        <Link className={styles.retry} href="/">
          Terug naar de kaart
        </Link>
      </div>
    </div>
  );
}
