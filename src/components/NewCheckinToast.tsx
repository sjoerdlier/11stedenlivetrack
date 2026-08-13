import styles from "./NewCheckinToast.module.css";

interface NewCheckinToastProps {
  plaats: string;
}

// Mounted/unmounted by AppShell (a timer clears the state after ~6s) rather
// than driven by an `open` prop — simplest way to get a fresh CSS animation
// on every new arrival instead of fighting a still-visible toast's timers.
export default function NewCheckinToast({ plaats }: NewCheckinToastProps) {
  return (
    <div className={styles.toast} role="status">
      <span className={styles.dot} aria-hidden>
        ●
      </span>
      Nieuwe check-in: {plaats}
    </div>
  );
}
