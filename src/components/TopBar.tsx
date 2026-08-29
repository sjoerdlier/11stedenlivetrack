"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Leg } from "@/lib/legs";
import type { Checkin } from "@/lib/checkins";
import { formatClockTime, formatKm, formatPaceKmh, formatScheduleDelta, formatTimeOnly } from "@/lib/format";
import {
  actualAveragePaceKmh,
  computeActualProgress,
  currentScheduleDelta,
  estimateArrival,
  estimateArrivalForecast,
  estimateInterpolatedProgress,
  type ArrivalForecast,
  type EstimatedArrival,
  type ScheduleDelta,
  type ScheduleDeltaBand,
} from "@/lib/actualProgress";
import type { LiveTrackProgress } from "@/lib/liveTrackProgress";
import {
  computeProgress,
  daysUntilStart,
  totalPlannedPaceKmh,
  totalRouteKm,
  type Progress,
  type LegStatus,
} from "@/lib/status";
import { ROUTES, routeConfig, type RouteSlug } from "@/lib/routes";
import { partiesForRoute, partyConfig } from "@/lib/parties";
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
  // GPS-derived progress/pace/ETA for the active party (see
  // liveTrackProgress.ts) — the primary source for the board below once it's
  // non-null. Check-in-derived figures (computed further down from
  // `checkins`/`checkinTimes`) are the fallback for whenever this is null:
  // no tracker attached yet, or its last fix has gone stale.
  liveTrackProgress: LiveTrackProgress | null;
  // Purely a fallback: the site has its own live marker on the map (real GPS
  // via /api/live, with a check-in-based estimate as fallback), so a Garmin
  // LiveTrack link is only worth surfacing at all once it's actually set in
  // /beheer — never a full-screen panel, just a small outbound link.
  garminUrl: string | null;
  weather: WeatherSnapshot | null;
}

const donationUrl = process.env.NEXT_PUBLIC_DONATION_URL;

// Every "Tempo" figure in this bar is grade-adjusted (Minetti-based, see
// gradeAdjustedKm) rather than a flat km/u reading — a title tooltip is the
// only explanation that fits without lengthening the label on mobile.
const GAP_TITLE = "Hoogtegecorrigeerd tempo — houdt rekening met klimmen en dalen.";

// Same three-way signal system used on LegCard's own delta badge and
// everywhere else on the board (see globals.css's token roles).
const DELTA_COLOR: Record<ScheduleDeltaBand, string> = {
  voor: "var(--db-signal-green)",
  op: "var(--db-amber)",
  achter: "var(--db-signal-red)",
};

export default function TopBar({
  activeRoute,
  activeParty,
  legs,
  effortLegs,
  statuses,
  now,
  checkins,
  checkinTimes,
  liveTrackProgress,
  garminUrl,
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
  // buildEffortLegs. This is the *fallback* board now — see `actual` below,
  // which prefers GPS-derived figures whenever they're available.
  const checkinActual = useMemo(() => {
    if (checkins.length === 0) return null;
    const progress = computeActualProgress(legs, checkinTimes);
    const effortProgress = computeActualProgress(effortLegs, checkinTimes);
    const paceKmh = actualAveragePaceKmh(checkinTimes, effortProgress.km, now);
    // A real (non-grade-adjusted) pace just for interpolating the plain-km
    // headline below — feeding the grade-adjusted paceKmh into a real-km
    // figure would over/undershoot on any climb or descent (see CLAUDE.md:
    // never mix legs/effortLegs for the same figure).
    const realPaceKmh = actualAveragePaceKmh(checkinTimes, progress.km, now);
    // Interpolated forward from the last check-in at the current pace (same
    // dead-reckoning estimateLivePosition already does for the map dot) so
    // the headline percent/km/progress-bar keeps advancing between
    // check-ins instead of sitting frozen at the last one's km — `now`
    // itself already ticks every 30s (see AppShell's STATUS_REFRESH_MS), so
    // this recomputes on the same cadence with no extra polling needed.
    const displayProgress = estimateInterpolatedProgress(legs, checkinTimes, now, realPaceKmh);
    const effortDisplayProgress = estimateInterpolatedProgress(effortLegs, checkinTimes, now, paceKmh);
    const remainingKm = Math.max(0, totalKm - displayProgress.km);
    const effortRemainingKm = Math.max(0, totalEffortKm - effortDisplayProgress.km);
    const arrival = estimateArrival(now, effortRemainingKm, paceKmh, plannedPaceKmh, checkins.length);
    // A range instead of arrival's single falsely-precise instant, once
    // there's enough completed-leg spread to resample from (see
    // estimateArrivalForecast) — effortLegs again, same grade-adjusted
    // reasoning as arrival/paceKmh above, since this is a pace-derived
    // figure too.
    const arrivalForecast = estimateArrivalForecast(effortLegs, checkinTimes, now);
    // "How far ahead/behind schedule is the walker *right now*" — keyed off
    // the real (unadjusted) legs, since geplande_tijd is a wall-clock time,
    // not a distance the grade adjustment would apply to.
    const scheduleDelta = currentScheduleDelta(legs, checkinTimes);
    return { progress: displayProgress, remainingKm, paceKmh, arrival, arrivalForecast, scheduleDelta };
  }, [checkins.length, legs, effortLegs, checkinTimes, now, plannedPaceKmh, totalKm, totalEffortKm]);

  // The board TopBar actually renders: GPS (liveTrackProgress) whenever it's
  // available — the whole point of tracking Lowie's own device is to not
  // depend on someone hand-logging a check-in at every one of 23 legs — with
  // the check-in-derived board above as the fallback for whenever GPS hasn't
  // reported yet or has gone stale (see liveTrackProgress.ts's header).
  // arrivalForecast comes from liveTrackProgress itself now — GPS mode
  // resamples from the accepted trail's own point-to-point paces instead of
  // per-leg ones (see estimateLiveArrivalForecast), so the range shows up
  // for both sources instead of only check-ins.
  const actual: {
    progress: Progress;
    remainingKm: number;
    paceKmh: number | null;
    arrival: EstimatedArrival | null;
    arrivalForecast: ArrivalForecast | null;
    scheduleDelta: ScheduleDelta | null;
    source: "gps" | "checkin";
  } | null = useMemo(() => {
    if (liveTrackProgress) return { ...liveTrackProgress, source: "gps" };
    if (checkinActual) return { ...checkinActual, source: "checkin" };
    return null;
  }, [liveTrackProgress, checkinActual]);

  // The strongest conversion moment for the donation ask: Lowie has actually
  // finished, not just "the tocht is scheduled to be over". `actual` is only
  // non-null once there's real check-in data, and its percent only reaches
  // 100 once a check-in exists for the finish leg itself
  // (computeActualProgress) — so this can't fire on the pre-start countdown
  // or on the schedule-only view.
  const isFinished = actual !== null && actual.progress.percent >= 100;

  async function handleShare() {
    // Same "prefix with the party's label, but only when there's more than
    // one to disambiguate" pattern as page.tsx's generateMetadata and
    // LegSchedule's own title — sharing from Björn's view shouldn't read as
    // Lowie's page.
    const shareTitle =
      parties.length > 1 ? `${partyConfig(activeRoute, activeParty).label} — ${config.pageTitle}` : config.pageTitle;
    const shareData = { title: shareTitle, url: window.location.href };
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
                <span className={styles.liveTag}>
                  Nu live
                  {/* GPS is the primary source now (see liveTrackProgress.ts)
                      — this only shows up while falling back to check-ins,
                      so a viewer knows the figures are as fresh as the last
                      manual check-in, not the tracker. */}
                  {actual.source === "checkin" && (
                    <span className={styles.statNote}> (o.b.v. inchecks)</span>
                  )}
                </span>
                {actual.scheduleDelta && (
                  <span
                    className={styles.deltaTag}
                    style={{ color: DELTA_COLOR[actual.scheduleDelta.band] }}
                    aria-label={`Schema: ${formatScheduleDelta(actual.scheduleDelta)}`}
                  >
                    {formatScheduleDelta(actual.scheduleDelta)}
                  </span>
                )}
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
                    {formatClockTime(actual.arrivalForecast ? actual.arrivalForecast.median : actual.arrival.time)}
                    {actual.arrival.basis === "gepland" && (
                      <span className={styles.statNote}> (schatting o.b.v. gepland tempo)</span>
                    )}
                  </span>
                  {/* A range beats a single falsely-precise instant — this
                      only ever renders once enough legs have been walked to
                      resample a real spread from (see
                      estimateArrivalForecast's FORECAST_MIN_SAMPLES), so it
                      never appears alongside the "gepland tempo" note above,
                      which covers the opposite (too little data) case. */}
                  {actual.arrivalForecast && (
                    <span className={styles.statNote} title="Bandbreedte op basis van het tempo tot nu toe">
                      {formatTimeOnly(actual.arrivalForecast.earliest)}–{formatTimeOnly(actual.arrivalForecast.latest)}
                    </span>
                  )}
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
        {/* First action deliberately — /update's AI-geschreven journaal is
            written primarily for blind/low-vision bezoekers, so this link
            gets priority placement rather than being buried after the
            route/party switchers. */}
        <Link href={`/update?route=${activeRoute}`} className={styles.action} title="Live update laten voorlezen">
          <span aria-hidden>🔊</span>
          <span className={styles.actionLabel}>Voorlezen</span>
        </Link>

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

        {garminUrl && (
          <a
            href={garminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.garminLink}
            title="Garmin LiveTrack (achtervang)"
          >
            <span aria-hidden>📡</span>
            <span className={styles.actionLabel}>Garmin</span>
          </a>
        )}

        <Link
          href={`/schema?route=${activeRoute}&party=${activeParty}`}
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
