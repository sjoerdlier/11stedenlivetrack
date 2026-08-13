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
import { partiesForRoute } from "@/lib/parties";
import type { WeatherSnapshot } from "@/lib/weather";
import WeatherStrip from "./WeatherStrip";
import styles from "./TopBar.module.css";

interface TopBarProps {
  activeRoute: RouteSlug;
  activeParty: string;
  legs: Leg[];
  effortLegs: Leg[];
  statuses: Map<number, LegStatus>;
  now: number;
  checkins: Checkin[];
  checkinTimes: Map<number, number>;
  liveTrackOpen: boolean;
  onToggleLiveTrack: () => void;
  weather: WeatherSnapshot | null;
}

const donationUrl = process.env.NEXT_PUBLIC_DONATION_URL;

// Every "Tempo" figure in this bar is grade-adjusted (Minetti-based, see
// gradeAdjustedKm) rather than a flat km/u reading — a title tooltip is the
// only explanation that fits without lengthening the label on mobile.
const GAP_TITLE = "Hoogtegecorrigeerd tempo — houdt rekening met klimmen en dalen.";

export default function TopBar({
  activeRoute,
  activeParty,
  legs,
  effortLegs,
  statuses,
  now,
  checkins,
  checkinTimes,
  liveTrackOpen,
  onToggleLiveTrack,
  weather,
}: TopBarProps) {
  const config = routeConfig(activeRoute);
  const parties = partiesForRoute(activeRoute);
  const totalKm = useMemo(() => totalRouteKm(legs), [legs]);
  // Grade-adjusted total — only ever divided into a grade-adjusted pace, so
  // it stays out of anything that displays a plain "km" number.
  const totalEffortKm = useMemo(() => totalRouteKm(effortLegs), [effortLegs]);
  const { km, percent } = useMemo(() => computeProgress(legs, statuses), [legs, statuses]);
  const countdownDays = useMemo(() => daysUntilStart(legs, now), [legs, now]);
  const plannedPaceKmh = useMemo(() => totalPlannedPaceKmh(effortLegs), [effortLegs]);
  const paceLabel = useMemo(() => formatPaceKmh(plannedPaceKmh), [plannedPaceKmh]);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState(false);

  // Once at least one check-in exists, the real status bar (built from
  // actual arrivals) takes over from the schedule-based one entirely —
  // before that (checkins is empty pre-race day, the normal state) the
  // countdown / planned-progress display below is unchanged. `progress`
  // (real km, shown as-is) and `effortProgress` (grade-adjusted, only fed
  // into pace/ETA math) are deliberately two separate computations — see
  // buildEffortLegs.
  const actual = useMemo(() => {
    if (checkins.length === 0) return null;
    const progress = computeActualProgress(legs, checkinTimes);
    const effortProgress = computeActualProgress(effortLegs, checkinTimes);
    const remainingKm = Math.max(0, totalKm - progress.km);
    const effortRemainingKm = Math.max(0, totalEffortKm - effortProgress.km);
    const paceKmh = actualAveragePaceKmh(checkinTimes, effortProgress.km, now);
    const arrival = estimateArrival(now, effortRemainingKm, paceKmh, plannedPaceKmh, checkins.length);
    return { progress, remainingKm, paceKmh, arrival };
  }, [checkins.length, legs, effortLegs, checkinTimes, now, plannedPaceKmh, totalKm, totalEffortKm]);

  // The strongest conversion moment for the donation ask: Lowie has actually
  // finished, not just "the tocht is scheduled to be over". `actual` is only
  // non-null once there's real check-in data, and its percent only reaches
  // 100 once a check-in exists for the finish leg itself
  // (computeActualProgress) — so this can't fire on the pre-start countdown
  // or on the schedule-only view.
  const isFinished = actual !== null && actual.progress.percent >= 100;

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
      try {
        await navigator.clipboard.writeText(shareData.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        // falls through to the shared "kon niet delen" message below
      }
    }
    // Neither the Web Share API nor Clipboard API is available (old
    // browser, non-secure context), or the clipboard write itself was
    // denied — surface that instead of the button silently doing nothing.
    setShareError(true);
    setTimeout(() => setShareError(false), 2000);
  }

  return (
    <header className={styles.bar}>
      {/* Groups the countdown/progress board with the weather strip as one
          flex child, so WeatherStrip stays visually attached to the live
          status instead of splitting header's two-column space-between
          layout into three. */}
      <div className={styles.leftColumn}>
        {actual ? (
          <div className={styles.board} aria-live="polite">
            <div className={styles.panelMain}>
              <div className={styles.heroBlock}>
                <span className={styles.heroNumber}>{Math.round(actual.progress.percent)}</span>
                <span className={styles.heroPercent}>%</span>
              </div>
              <div className={styles.heroMeta}>
                <span className={styles.liveTag}>Nu live</span>
                <span className={styles.heroLabel}>
                  {formatKm(actual.progress.km)} van {formatKm(totalKm)}
                </span>
              </div>
            </div>

            <div className={styles.statRow}>
              <span className={styles.stat}>
                <span className={styles.statLabel}>Te gaan</span>
                <span className={styles.statValue}>{formatKm(actual.remainingKm)}</span>
              </span>
              {actual.paceKmh !== null && (
                <span className={styles.stat} title={GAP_TITLE}>
                  <span className={styles.statLabel}>Tempo</span>
                  <span className={styles.statValue}>
                    {formatPaceKmh(actual.paceKmh)}
                    <span className={styles.gapBadge} aria-hidden>
                      ⛰
                    </span>
                  </span>
                </span>
              )}
              {actual.arrival && (
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Aankomst ±</span>
                  <span className={styles.statValue}>
                    {formatClockTime(actual.arrival.time)}
                    {actual.arrival.basis === "gepland" && (
                      <span className={styles.statNote}> (schatting o.b.v. gepland tempo)</span>
                    )}
                  </span>
                </span>
              )}
            </div>

            {actual.progress.percent >= 50 && (
              <div className={styles.milestone}>
                🎉 Halverwege
                {donationUrl && (
                  <>
                    {" — "}
                    <a
                      href={donationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.milestoneLink}
                    >
                      steun Lowie
                    </a>
                  </>
                )}
              </div>
            )}

            <span className={styles.progressTrack}>
              <span className={styles.progressFill} style={{ width: `${actual.progress.percent}%` }} />
            </span>
          </div>
        ) : countdownDays !== null ? (
          <div className={styles.board} aria-live="polite">
            <div className={styles.panelMain}>
              <div className={styles.heroBlock}>
                <span className={styles.heroNumber}>{countdownDays}</span>
              </div>
              <div className={styles.heroMeta}>
                <span className={styles.heroLabel}>
                  {countdownDays === 1 ? "dag tot de start" : "dagen tot de start"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.board} aria-live="polite">
            <div className={styles.panelMain}>
              <div className={styles.heroBlock}>
                <span className={styles.heroNumber}>{Math.round(percent)}</span>
                <span className={styles.heroPercent}>%</span>
              </div>
              <div className={styles.heroMeta}>
                <span className={styles.heroLabel}>
                  {formatKm(km)} van {formatKm(totalKm)}
                </span>
              </div>
            </div>

            {paceLabel && (
              <div className={styles.statRow}>
                <span className={styles.stat} title={GAP_TITLE}>
                  <span className={styles.statLabel}>Gem. tempo (gepland)</span>
                  <span className={styles.statValue}>
                    {paceLabel}
                    <span className={styles.gapBadge} aria-hidden>
                      ⛰
                    </span>
                  </span>
                </span>
              </div>
            )}

            <span className={styles.progressTrack}>
              <span className={styles.progressFill} style={{ width: `${percent}%` }} />
            </span>
          </div>
        )}

        <WeatherStrip weather={weather} />
      </div>

      <nav className={styles.actions}>
        {ROUTES.length > 1 && (
          <div className={styles.routeSwitch} role="group" aria-label="Route">
            {ROUTES.map((r) => (
              <Link
                key={r.slug}
                href={`/?route=${r.slug}`}
                className={`${styles.action} ${r.slug === activeRoute ? styles.actionSelected : ""}`}
                title={r.pageTitle}
                aria-current={r.slug === activeRoute}
              >
                {r.navLabel}
              </Link>
            ))}
          </div>
        )}

        {parties.length > 1 && (
          <div className={styles.routeSwitch} role="group" aria-label="Loper(s)">
            {parties.map((p) => (
              <Link
                key={p.slug}
                href={`/?route=${activeRoute}&party=${p.slug}`}
                className={`${styles.action} ${p.slug === activeParty ? styles.actionSelected : ""}`}
                title={p.label}
                aria-current={p.slug === activeParty}
              >
                <span className={styles.partySwitchDot} style={{ background: p.color }} aria-hidden />
                {p.label}
              </Link>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onToggleLiveTrack}
          className={`${styles.action} ${liveTrackOpen ? styles.actionLive : ""}`}
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
          <span className={styles.actionLabel}>
            {copied ? "Gekopieerd!" : shareError ? "Kon niet delen" : "Delen"}
          </span>
        </button>

        {donationUrl ? (
          <a
            href={donationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.donate}
            title={isFinished ? "Lowie is gefinisht — nu doneren" : "Doneer voor Lowie"}
          >
            <span aria-hidden>{isFinished ? "🎉" : "❤"}</span>
            <span className={styles.actionLabel}>
              {isFinished ? "Lowie is gefinisht — doneer" : "Doneer"}
            </span>
          </a>
        ) : (
          <span
            className={`${styles.donate} ${styles.donateTodo}`}
            title="Doneren is hier binnenkort mogelijk"
          >
            <span aria-hidden>❤</span>
            <span className={styles.actionLabel}>Doneren volgt nog</span>
          </span>
        )}

        {/* This tracker is a companion to oogvoormaja.nl, where the full
            story lives (Lowie & Björn walking the Elfstedentocht
            blindfolded for OOG voor Maja/het Oogfonds) — a small, plain-text
            pointer back there, deliberately not styled as another action
            button. Independent of the NEXT_PUBLIC_DONATION_URL button
            above: that donates directly, this links to the story. */}
        <a
          href="https://www.oogvoormaja.nl/"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.storyLink}
          aria-label="Het volledige verhaal en doneren op oogvoormaja.nl (opent in nieuw tabblad)"
        >
          Het volledige verhaal: oogvoormaja.nl
        </a>
      </nav>
    </header>
  );
}
