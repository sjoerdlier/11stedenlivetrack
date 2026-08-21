"use client";

import { useEffect, useState } from "react";
import type { RouteSlug } from "@/lib/routes";
import type { PartyConfig } from "@/lib/parties";
import { trackerStatusKey } from "@/lib/parties";
import type { LivePositionRow } from "@/lib/livePositions";
import { LIVE_POSITION_MAX_AGE_MS } from "@/lib/liveMarker";
import { TRACKER_DASHBOARD_HISTORY_HOURS } from "@/lib/liveTrackProgress";
import { formatRelativeTime } from "@/lib/format";
import { useSimulatedNow } from "@/lib/useSimulatedNow";
import TrackerMapLoader from "./TrackerMapLoader";
import styles from "../invoer/invoer.module.css";

// Same cadence as AppShell's own poll — GPS positions don't need to be
// checked more often than the public map itself refreshes.
const POLL_MS = 20_000;
const TICK_MS = 15_000;

interface TrackerStatusProps {
  routeParties: { route: RouteSlug; party: PartyConfig }[];
  // Each party's recent trail (see TRACKER_DASHBOARD_HISTORY_HOURS), oldest
  // first — the last entry doubles as "the latest known position" for the
  // status rows below, so there's one data source for both the rows and the
  // map instead of two separate fetches.
  initialHistory: Record<string, LivePositionRow[]>;
}

// The organizer-facing counterpart to the map's live dot: that dot quietly
// falls back to a check-in-based estimate the moment a tracker goes stale
// (see liveMarker.ts), which is exactly the failure mode nobody watching
// the public site would notice on their own — the whole point of GPS
// tracking (see liveTrackProgress.ts's header) is to *not* need someone
// checking in by hand, so a silently-dead tracker needs its own alarm
// somewhere. This is that somewhere: a small always-visible panel, not
// gated behind anything but the PIN /beheer already requires, listing every
// party's tracker and how long ago it last reported, plus a map of the
// actual trail (see TrackerMap) — useful both during the real event and for
// watching a pre-race stability test unfold live.
export default function TrackerStatus({ routeParties, initialHistory }: TrackerStatusProps) {
  const now = useSimulatedNow(TICK_MS);
  const [history, setHistory] = useState(initialHistory);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      for (const { route, party } of routeParties) {
        try {
          const res = await fetch(
            `/api/poll?route=${route}&party=${party.slug}&historyHours=${TRACKER_DASHBOARD_HISTORY_HOURS}`,
            { cache: "no-store" },
          );
          if (!res.ok || cancelled) continue;
          const data: { livePositionHistory?: LivePositionRow[] } = await res.json();
          if (cancelled || !data.livePositionHistory) continue;
          const key = trackerStatusKey(route, party.slug);
          setHistory((prev) => ({ ...prev, [key]: data.livePositionHistory! }));
        } catch (err) {
          console.error(`TrackerStatus: polling /api/poll(${route}, ${party.slug}) failed`, err);
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // routeParties is derived fresh from static config on every render, but
    // its array identity isn't stable — keying off routes.join instead of
    // routeParties itself would be more correct, but this list only ever
    // changes with a deploy, not at runtime, so re-subscribing on an
    // incidental re-render here costs nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={styles.formWrap} aria-label="Tracker-status">
      <div className={styles.formHeader}>
        <div className={styles.formTitle}>Tracker-status</div>
        <p className={styles.formHint}>
          Wanneer elke tracker voor het laatst een positie doorgaf, en de afgelegde trail van de laatste{" "}
          {TRACKER_DASHBOARD_HISTORY_HOURS} uur — GPS is nu de primaire bron van voortgang, dus een stille tracker
          hier betekent dat viewers terugvallen op handmatige inchecks.
        </p>
      </div>
      <ul className={styles.trackerList}>
        {routeParties.map(({ route, party }) => {
          const rows = history[trackerStatusKey(route, party.slug)] ?? [];
          const latest = rows.length > 0 ? rows[rows.length - 1] : null;
          const recordedMs = latest ? new Date(latest.recordedAt).getTime() : null;
          const fresh = recordedMs !== null && !Number.isNaN(recordedMs) && now - recordedMs <= LIVE_POSITION_MAX_AGE_MS;
          const dotClass = !latest ? styles.trackerDotNone : fresh ? styles.trackerDotFresh : styles.trackerDotStale;
          return (
            <li key={trackerStatusKey(route, party.slug)} className={styles.trackerRow}>
              <span className={dotClass} aria-hidden />
              <span className={styles.trackerLabel}>{party.label}</span>
              <span className={styles.trackerAgo}>
                {latest && recordedMs !== null && !Number.isNaN(recordedMs)
                  ? `${fresh ? "" : "stil sinds "}${formatRelativeTime(recordedMs, now)}`
                  : "nog geen positie ontvangen"}
              </span>
            </li>
          );
        })}
      </ul>
      <div className={styles.trackerMapWrap}>
        <TrackerMapLoader routeParties={routeParties} history={history} />
      </div>
    </section>
  );
}
