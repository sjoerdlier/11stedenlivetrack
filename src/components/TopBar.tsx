"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Leg } from "@/lib/legs";
import type { Checkin } from "@/lib/checkins";
import { formatClockTime, formatKm, formatPaceKmh } from "@/lib/format";
import {
  actualAveragePaceKmh,
  computeActualProgress,
  estimateArrival,
} from "@/lib/actualProgress";
import {
  computeProgress,
  daysUntilStart,
  totalPlannedPaceKmh,
  totalRouteKm,
  type LegStatus,
} from "@/lib/status";
import { ROUTES, routeConfig, type RouteSlug } from "@/lib/routes";
import styles from "./TopBar.module.css";

interface TopBarProps {
  activeRoute: RouteSlug;
  legs: Leg[];
  statuses: Map<number, LegStatus>;
  now: number;
  checkins: Checkin[];
  checkinTimes: Map<number, number>;
  liveTrackOpen: boolean;
  onToggleLiveTrack: () => void;
}

const donationUrl = process.env.NEXT_PUBLIC_DONATION_URL;

export default function TopBar({
  activeRoute,
  legs,
  statuses,
  now,
  checkins,
  checkinTimes,
  liveTrackOpen,
  onToggleLiveTrack,
}: TopBarProps) {
  const config = routeConfig(activeRoute);
  const totalKm = useMemo(() => totalRouteKm(legs), [legs]);
  const { km, percent } = useMemo(() => computeProgress(legs, statuses), [legs, statuses]);
  const countdownDays = useMemo(() => daysUntilStart(legs, now), [legs, now]);
  const plannedPaceKmh = useMemo(() => totalPlannedPaceKmh(legs), [legs]);
  const paceLabel = useMemo(() => formatPaceKmh(plannedPaceKmh), [plannedPaceKmh]);
  const [copied, setCopied] = useState(false);

  // Once at least one check-in exists, the real status bar (built from
  // actual arrivals) takes over from the schedule-based one entirely —
  // before that (checkins is empty pre-race day, the normal state) the
  // countdown / planned-progress display below is unchanged.
  const actual = useMemo(() => {
    if (checkins.length === 0) return null;
    const progress = computeActualProgress(legs, checkinTimes);
    const remainingKm = Math.max(0, totalKm - progress.km);
    const paceKmh = actualAveragePaceKmh(checkinTimes, progress.km, now);
    const arrival = estimateArrival(now, remainingKm, paceKmh, plannedPaceKmh, checkins.length);
    return { progress, remainingKm, paceKmh, arrival };
  }, [checkins.length, legs, checkinTimes, now, plannedPaceKmh, totalKm]);

  async function handleShare() {
    const shareData = { title: config.pageTitle, url: window.location.href };
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
      {actual ? (
        <div className={styles.progress}>
          <span className={styles.progressText}>
            <span className={styles.progressFull}>
              {formatKm(actual.progress.km)} van {formatKm(totalKm)} ·{" "}
            </span>
            {Math.round(actual.progress.percent)}%
          </span>
          <span className={styles.progressTrack}>
            <span className={styles.progressFill} style={{ width: `${actual.progress.percent}%` }} />
          </span>
          <span className={styles.pace}>
            Te gaan: {formatKm(actual.remainingKm)}
            {actual.paceKmh !== null && <> · Tempo: {formatPaceKmh(actual.paceKmh)}</>}
            {actual.arrival && (
              <>
                {" "}
                · Aankomst ± {formatClockTime(actual.arrival.time)}
                {actual.arrival.basis === "gepland" && " (schatting o.b.v. gepland tempo)"}
              </>
            )}
          </span>
        </div>
      ) : countdownDays !== null ? (
        <div className={styles.progress}>
          <span className={styles.progressText}>
            <span className={styles.progressFull}>Nog </span>
            {countdownDays}
            <span className={styles.progressFull}> {countdownDays === 1 ? "dag" : "dagen"} tot de start</span>
            <span className={styles.progressShort}>d tot start</span>
          </span>
        </div>
      ) : (
        <div className={styles.progress}>
          <span className={styles.progressText}>
            <span className={styles.progressFull}>
              {formatKm(km)} van {formatKm(totalKm)} ·{" "}
            </span>
            {Math.round(percent)}%
          </span>
          <span className={styles.progressTrack}>
            <span className={styles.progressFill} style={{ width: `${percent}%` }} />
          </span>
          {paceLabel && (
            <span className={styles.pace}>Gem. tempo: {paceLabel} (gepland)</span>
          )}
        </div>
      )}

      <nav className={styles.actions}>
        <div className={styles.routeSwitch} role="group" aria-label="Route">
          {ROUTES.map((r) => (
            <Link
              key={r.slug}
              href={`/?route=${r.slug}`}
              className={`${styles.action} ${r.slug === activeRoute ? styles.actionActive : ""}`}
              title={r.pageTitle}
              aria-current={r.slug === activeRoute}
            >
              {r.navLabel}
            </Link>
          ))}
        </div>

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

        <Link
          href={`/schema?route=${activeRoute}`}
          target="_blank"
          className={styles.action}
          title="Printbaar schema"
        >
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
