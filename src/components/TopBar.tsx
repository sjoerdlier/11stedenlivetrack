"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Leg } from "@/lib/legs";
import { computeProgress, TOTAL_ROUTE_KM, type LegStatus } from "@/lib/status";
import styles from "./TopBar.module.css";

interface TopBarProps {
  legs: Leg[];
  statuses: Map<number, LegStatus>;
  liveTrackOpen: boolean;
  onToggleLiveTrack: () => void;
}

const donationUrl = process.env.NEXT_PUBLIC_DONATION_URL;

export default function TopBar({ legs, statuses, liveTrackOpen, onToggleLiveTrack }: TopBarProps) {
  const { km, percent } = useMemo(() => computeProgress(legs, statuses), [legs, statuses]);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const shareData = { title: "Lowie — 11Stedentocht", url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled the native share sheet, nothing to do
      }
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <header className={styles.bar}>
      <div className={styles.progress}>
        <span className={styles.progressText}>
          <span className={styles.progressFull}>
            {km.toLocaleString("nl-NL")} van {TOTAL_ROUTE_KM} km ·{" "}
          </span>
          {Math.round(percent)}%
        </span>
        <span className={styles.progressTrack}>
          <span className={styles.progressFill} style={{ width: `${percent}%` }} />
        </span>
      </div>

      <nav className={styles.actions}>
        <button
          type="button"
          onClick={onToggleLiveTrack}
          className={`${styles.action} ${liveTrackOpen ? styles.actionActive : ""}`}
          title="Live locatie"
          aria-pressed={liveTrackOpen}
        >
          <span aria-hidden>📡</span>
          <span className={styles.actionLabel}>Live</span>
        </button>

        <Link href="/schema" target="_blank" className={styles.action} title="Printbaar schema">
          <span aria-hidden>🖨</span>
          <span className={styles.actionLabel}>Schema</span>
        </Link>

        <button type="button" onClick={handleShare} className={styles.action} title="Delen">
          <span aria-hidden>🔗</span>
          <span className={styles.actionLabel}>{copied ? "Gekopieerd!" : "Delen"}</span>
        </button>

        {donationUrl ? (
          <a
            href={donationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.donate}
            title="Doneer voor Lowie"
          >
            <span aria-hidden>❤</span>
            <span className={styles.actionLabel}>Doneer</span>
          </a>
        ) : (
          <span
            className={`${styles.donate} ${styles.donateTodo}`}
            title="NEXT_PUBLIC_DONATION_URL is niet ingesteld"
          >
            <span aria-hidden>❤</span>
            <span className={styles.actionLabel}>Doneer (TODO: url instellen)</span>
          </span>
        )}
      </nav>
    </header>
  );
}
