import styles from "./LoadError.module.css";

interface LoadErrorProps {
  message: string;
  retryHref: string;
}

// Rendered instead of AppShell when Supabase can't be reached — otherwise a
// hiccup there took down the whole map + schedule with a raw Next.js error
// screen, right when someone's trying to check live progress.
export default function LoadError({ message, retryHref }: LoadErrorProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden>
          ⚠️
        </div>
        <div className={styles.title}>Kon de route niet laden</div>
        <p className={styles.hint}>{message}</p>
        <a className={styles.retry} href={retryHref}>
          Opnieuw proberen
        </a>
      </div>
    </div>
  );
}
