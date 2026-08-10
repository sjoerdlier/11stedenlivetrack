"use client";

import { useState, type FormEvent } from "react";
import type { RouteSlug } from "@/lib/routes";
import { routeConfig } from "@/lib/routes";
import { garminUrlSettingKey, liveTokenSettingKey, type PartyConfig } from "@/lib/parties";
import styles from "../invoer/invoer.module.css";

interface SettingsFormProps {
  routeParties: { route: RouteSlug; party: PartyConfig }[];
  initialGarminUrls: Record<string, string>;
  initialLiveTokens: Record<string, string>;
  pinIsSet: boolean;
  loadError: string | null;
  onUnauthorized: () => void;
}

// Random enough for a bearer token that only ever gets copy-pasted once
// into the tracker app's settings, not typed by hand — crypto.getRandomValues
// rather than Math.random, since this is a credential, not a UI id.
function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function SettingsForm({
  routeParties,
  initialGarminUrls,
  initialLiveTokens,
  pinIsSet,
  loadError,
  onUnauthorized,
}: SettingsFormProps) {
  const [garminUrls, setGarminUrls] = useState(initialGarminUrls);
  const [liveTokens, setLiveTokens] = useState(initialLiveTokens);
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
          liveTokens,
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
          Garmin LiveTrack-links, live-tracking tokens en de check-in PIN — direct van kracht, geen redeploy nodig.
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

        {routeParties.map(({ route, party }) => {
          const key = liveTokenSettingKey(route, party.slug);
          return (
            <label className={styles.field} key={key}>
              <span>
                Live-tracking token — {routeConfig(route).navLabel} · {party.label}
              </span>
              <input
                type="text"
                value={liveTokens[key] ?? ""}
                onChange={(e) => setLiveTokens((t) => ({ ...t, [key]: e.target.value }))}
                placeholder="nog niet ingesteld — tracker-app kan niet versturen"
              />
              <button
                type="button"
                className={styles.routeLink}
                style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", textAlign: "left" }}
                onClick={() => setLiveTokens((t) => ({ ...t, [key]: randomToken() }))}
              >
                Genereer nieuw token
              </button>
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
