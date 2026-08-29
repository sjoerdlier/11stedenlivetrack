"use client";

import { useEffect, useState } from "react";
import type { RouteSlug } from "@/lib/routes";
import { partyConfig } from "@/lib/parties";
import styles from "./invoer.module.css";

interface CheckinRow {
  id: string;
  party: string;
  tijdstip: string;
  leg_nr: number;
  notitie: string | null;
  invoerder: string;
}

const POLL_MS = 20_000;

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface RecentCheckinsProps {
  activeRoute: RouteSlug;
  onUnauthorized: () => void;
}

// The correction counterpart to CheckinForm: lists the last 20 check-ins
// for this route (any party) with an editable tijdstip, for the case a
// screenshot's time was misread or mistyped and needs fixing after the
// fact -- rather than living with a wrong "werkelijke tijd" for the rest
// of the event. Polls the same way TrackerStatus does, so a correction
// made from a different phone shows up here too.
export default function RecentCheckins({ activeRoute, onUnauthorized }: RecentCheckinsProps) {
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/invoer/list?route=${activeRoute}`, { cache: "no-store" });
        if (res.status === 401) {
          if (!cancelled) onUnauthorized();
          return;
        }
        if (!res.ok || cancelled) return;
        const data: { ok: boolean; checkins?: CheckinRow[] } = await res.json();
        if (cancelled || !data.ok || !data.checkins) return;
        setCheckins(data.checkins);
      } catch (err) {
        console.error(`RecentCheckins: polling /api/invoer/list(${activeRoute}) failed`, err);
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeRoute, onUnauthorized]);

  async function handleSave(checkinId: string) {
    const draft = drafts[checkinId];
    if (!draft) return;

    setSavingId(checkinId);
    setSavedId(null);
    setError(null);

    try {
      const isoTijdstip = new Date(draft).toISOString();
      const res = await fetch("/api/invoer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: checkinId, route: activeRoute, tijdstip: isoTijdstip }),
      });

      if (res.status === 401) {
        onUnauthorized();
        return;
      }

      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Bijwerken mislukt.");
      }

      setCheckins((prev) => prev.map((c) => (c.id === checkinId ? { ...c, tijdstip: isoTijdstip } : c)));
      setSavedId(checkinId);
      setTimeout(() => setSavedId((current) => (current === checkinId ? null : current)), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bijwerken mislukt.");
    } finally {
      setSavingId(null);
    }
  }

  if (checkins.length === 0) return null;

  return (
    <div className={styles.formWrap}>
      <div className={styles.formHeader}>
        <div className={styles.formTitle}>Recente check-ins</div>
        <p className={styles.formHint}>Tijdstip niet correct? Pas het aan en druk op Bijwerken.</p>
      </div>

      {error && <div className={styles.formError}>{error}</div>}

      <ul className={styles.recentList}>
        {checkins.map((c) => (
          <li key={c.id} className={styles.recentRow}>
            <span className={styles.recentLabel}>
              {partyConfig(activeRoute, c.party).label} · #{c.leg_nr}
            </span>
            <input
              type="datetime-local"
              value={drafts[c.id] ?? toLocalInputValue(c.tijdstip)}
              onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
            />
            <button
              type="button"
              className={styles.recentSaveButton}
              disabled={savingId === c.id}
              onClick={() => handleSave(c.id)}
            >
              {savingId === c.id ? "…" : savedId === c.id ? "✓" : "Bijwerken"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
