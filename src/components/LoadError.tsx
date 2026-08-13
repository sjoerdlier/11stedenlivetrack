import styles from "./LoadError.module.css";

interface LoadErrorProps {
  message: string;
  retryHref: string;
}

// Rendered instead of AppShell when Supabase can't be reached — otherwise a
// hiccup there took down the whole map + schedule with a raw Next.js error
// screen, right when someone's trying to check live progress.
export default function LoadError({ message, retryHref }: LoadErrorProps) {
  // The raw error (often a technical Supabase message) isn't meaningful to
  // an end user checking live progress — log it for whoever's debugging
  // (server console if this rendered server-side, browser console
  // otherwise) and show a friendly Dutch message in the UI instead.
  console.error("LoadError:", message);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden>
          ⚠️
        </div>
        <div className={styles.title}>Kon de route niet laden</div>
        <p className={styles.hint}>
          Er ging iets mis bij het ophalen van de gegevens. Probeer het over een paar seconden
          opnieuw.
        </p>
        <a className={styles.retry} href={retryHref}>
          Opnieuw proberen
        </a>
      </div>
    </div>
  );
}
