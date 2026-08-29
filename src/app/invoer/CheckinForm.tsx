"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { Leg } from "@/lib/legs";
import { ROUTES, routeConfig, type RouteSlug } from "@/lib/routes";
import { partiesForRoute } from "@/lib/parties";
import styles from "./invoer.module.css";

interface Prefill {
  party?: string;
  legNr?: string;
  tijdstip?: string;
  notitie?: string;
}

interface CheckinFormProps {
  activeRoute: RouteSlug;
  legs: Leg[];
  legsError: string | null;
  onUnauthorized: () => void;
  // Optional tap-to-fill values from the URL (see page.tsx) -- lets a
  // pre-built link land on this form already filled in (e.g. from a
  // screenshot relayed through chat), so the only thing left to do here is
  // check it and hit "Opslaan". Absent for the normal manual-entry flow,
  // which is unaffected.
  prefill?: Prefill;
}

function nowForInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm(defaultParty: string, prefill?: Prefill) {
  return {
    party: prefill?.party ?? defaultParty,
    tijdstip: prefill?.tijdstip ?? nowForInput(),
    legNr: prefill?.legNr ?? "",
    lat: "",
    lon: "",
    notitie: prefill?.notitie ?? "",
    invoerder: "",
  };
}

export default function CheckinForm({ activeRoute, legs, legsError, onUnauthorized, prefill }: CheckinFormProps) {
  const config = routeConfig(activeRoute);
  const parties = partiesForRoute(activeRoute);
  const [form, setForm] = useState(() => emptyForm(parties[0].slug, prefill));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setConfirmed(false);

    try {
      const res = await fetch("/api/invoer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route: activeRoute,
          party: form.party,
          tijdstip: new Date(form.tijdstip).toISOString(),
          leg_nr: Number(form.legNr),
          lat: form.lat.trim() ? Number(form.lat) : null,
          lon: form.lon.trim() ? Number(form.lon) : null,
          notitie: form.notitie,
          invoerder: form.invoerder,
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

      setForm(emptyForm(form.party));
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
        <div className={styles.formTitle}>Check-in invoeren — {config.navLabel}</div>
        <p className={styles.formHint}>Fallback voor als de Garmin LiveTrack uitvalt.</p>
        <p className={styles.formHint}>
          Andere route:{" "}
          {ROUTES.filter((r) => r.slug !== activeRoute).map((r, i, arr) => (
            <span key={r.slug}>
              <Link href={`/invoer?route=${r.slug}`} className={styles.routeLink}>
                {r.navLabel}
              </Link>
              {i < arr.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
        <p className={styles.formHint}>
          <Link href="/beheer" className={styles.routeLink}>
            ⚙ Instellingen (Garmin-links, PIN)
          </Link>
        </p>
      </div>

      {confirmed && <div className={styles.confirmation}>✓ Check-in opgeslagen.</div>}
      {!confirmed && prefill && (prefill.party || prefill.legNr || prefill.tijdstip) && (
        <div className={styles.prefillNotice}>Vooringevuld vanuit screenshot — controleer de velden en sla op.</div>
      )}
      {error && <div className={styles.formError}>{error}</div>}
      {legsError && (
        <div className={styles.formError}>
          Kon de leg-lijst niet laden ({legsError}). Herlaad de pagina om het opnieuw te proberen.
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        {parties.length > 1 && (
          <label className={styles.field}>
            <span>Voor wie</span>
            <select value={form.party} onChange={(e) => update("party", e.target.value)}>
              {parties.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={styles.field}>
          <span>Tijdstip</span>
          <input
            type="datetime-local"
            required
            value={form.tijdstip}
            onChange={(e) => update("tijdstip", e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Dichtstbijzijnde leg</span>
          <select
            required
            disabled={legs.length === 0}
            value={form.legNr}
            onChange={(e) => update("legNr", e.target.value)}
          >
            <option value="" disabled>
              Kies een leg…
            </option>
            {legs.map((leg) => (
              <option key={leg.nr} value={leg.nr}>
                #{leg.nr} · {leg.start_plaats}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Lat (optioneel)</span>
            <input
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => update("lat", e.target.value)}
              placeholder="53.2023"
            />
          </label>
          <label className={styles.field}>
            <span>Lon (optioneel)</span>
            <input
              type="number"
              step="any"
              value={form.lon}
              onChange={(e) => update("lon", e.target.value)}
              placeholder="5.7695"
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>Notitie</span>
          <textarea
            rows={3}
            value={form.notitie}
            onChange={(e) => update("notitie", e.target.value)}
            placeholder="Vrije tekst, bijv. hoe het gaat, wat je ziet…"
          />
        </label>

        <label className={styles.field}>
          <span>Naam invoerder</span>
          <input
            type="text"
            required
            value={form.invoerder}
            onChange={(e) => update("invoerder", e.target.value)}
            placeholder="Jouw naam"
          />
        </label>

        <button type="submit" className={styles.submitButton} disabled={submitting}>
          {submitting ? "Bezig…" : "Opslaan"}
        </button>
      </form>
    </div>
  );
}
