"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import styles from "@/components/LoadError.module.css";

// Root error boundary (Next.js `error.js` file convention) — catches any
// otherwise-unhandled throw in a Server or Client Component under this
// segment (e.g. a malformed GPX file, see gpx.ts's NaN guard) so a viewer
// gets a friendly Dutch message instead of Next's default error screen.
// LoadError.tsx already handles the *expected* "Supabase is unreachable"
// case with its own inline UI; this is the catch-all for anything that
// error.tsx and LoadError.tsx haven't already been made to.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Server Component errors arrive here with a generic message + digest
    // (the original message is intentionally stripped in production) — the
    // digest is what ties this back to the real server-side console.error.
    console.error("Onbehandelde fout in de app:", error);
  }, [error]);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden>
          ⚠️
        </div>
        <div className={styles.title}>Er ging iets mis</div>
        <p className={styles.hint}>
          Er is een onverwachte fout opgetreden. Probeer het opnieuw — als het probleem
          blijft bestaan, laat het de organisatie weten.
        </p>
        <button type="button" className={styles.retry} onClick={() => unstable_retry()}>
          Probeer opnieuw
        </button>
      </div>
    </div>
  );
}
