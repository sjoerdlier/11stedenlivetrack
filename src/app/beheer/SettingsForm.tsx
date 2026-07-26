"use client";

import { useState, type FormEvent } from "react";
import type { RouteSlug } from "@/lib/routes";
import { routeConfig } from "@/lib/routes";
import { garminUrlSettingKey, type PartyConfig } from "@/lib/parties";
import styles from "../invoer/invoer.module.css";

interface SettingsFormProps {
  routeParties: { route: RouteSlug; party: PartyConfig }[];
  initialGarminUrls: Record<string, string>;
  pinIsSet: boolean;
  loadError: string | null;
  onUnauthorized: () => void;
}

export default function SettingsForm({
  routeParties,
  initialGarminUrls,
  pinIsSet,
  loadError,
  onUnauthorized,
}: SettingsFormProps) {
  const [garminUrls, setGarminUrls] = useState(initialGarminUrls);
  const [newPin, setNewPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setConfirmed(false);

    try {
      const res = await fetch("/api/beheer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garminUrls,
          newPin: newPin.trim() ? newPin.trim() : undefined,
        }),
      });

      if (res.status === 401) {
        onUnauthorized();
        return;
      }

      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Opslaan mislukt.");
      }

      setNewPin("");
      setConfirmed(true);
      setTimeout(() => setConfirmed(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.formWrap}>
      <div className={styles.formHeader}>
        <div className={styles.formTitle}>Instellingen</div>
        <p className={styles.formHint}>
          Garmin LiveTrack-links en de check-in PIN — direct van kracht, geen redeploy nodig.
        </p>
      </div>

      {confirmed && <div className={styles.confirmation}>✓ Opgeslagen.</div>}
      {error && <div className={styles.formError}>{error}</div>}
      {loadError && (
        <div className={styles.formError}>
          Kon huidige instellingen niet laden ({loadError}). Opslaan overschrijft dan mogelijk met lege waarden —
          herlaad de pagina om het opnieuw te proberen.
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        {routeParties.map(({ route, party }) => {
          const key = garminUrlSettingKey(route, party.slug);
          return (
            <label className={styles.field} key={key}>
              <span>
                Garmin LiveTrack — {routeConfig(route).navLabel} · {party.label}
              </span>
              <input
                type="text"
                value={garminUrls[key] ?? ""}
                onChange={(e) => setGarminUrls((g) => ({ ...g, [key]: e.target.value }))}
                placeholder="https://livetrack.garmin.com/…"
              />
            </label>
          );
        })}

        <label className={styles.field}>
          <span>Nieuwe check-in PIN {pinIsSet ? "(er staat al een PIN, laat leeg om te behouden)" : "(nog geen PIN ingesteld)"}</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="1234"
          />
        </label>

        <button type="submit" className={styles.submitButton} disabled={submitting}>
          {submitting ? "Bezig…" : "Opslaan"}
        </button>
      </form>
    </div>
  );
}
