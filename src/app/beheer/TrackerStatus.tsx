"use client";

import { useEffect, useState } from "react";
import type { RouteSlug } from "@/lib/routes";
import type { PartyConfig } from "@/lib/parties";
import { trackerStatusKey } from "@/lib/parties";
import type { LivePositionRow } from "@/lib/livePositions";
import { LIVE_POSITION_MAX_AGE_MS } from "@/lib/liveMarker";
import { formatRelativeTime } from "@/lib/format";
import { useSimulatedNow } from "@/lib/useSimulatedNow";
import styles from "../invoer/invoer.module.css";

// Same cadence as AppShell's own poll — GPS positions don't need to be
// checked more often than the public map itself refreshes.
const POLL_MS = 20_000;
const TICK_MS = 15_000;

interface TrackerStatusProps {
  routeParties: { route: RouteSlug; party: PartyConfig }[];
  initialPositions: Record<string, LivePositionRow | null>;
}

// The organizer-facing counterpart to the map's live dot: that dot quietly
// falls back to a check-in-based estimate the moment a tracker goes stale
// (see liveMarker.ts), which is exactly the failure mode nobody watching
// the public site would notice on their own — the whole point of GPS
// tracking (see liveTrackProgress.ts's header) is to *not* need someone
// checking in by hand, so a silently-dead tracker needs its own alarm
// somewhere. This is that somewhere: a small always-visible panel, not
// gated behind anything but the PIN /beheer already requires, listing every
// party's tracker and how long ago it last reported.
export default function TrackerStatus({ routeParties, initialPositions }: TrackerStatusProps) {
  const now = useSimulatedNow(TICK_MS);
  const [positions, setPositions] = useState(initialPositions);

  useEffect(() => {
    const routes = [...new Set(routeParties.map((rp) => rp.route))];
    let cancelled = false;

    async function poll() {
      for (const route of routes) {
        try {
          const res = await fetch(`/api/poll?route=${route}`, { cache: "no-store" });
          if (!res.ok || cancelled) continue;
          const data: { livePositions?: LivePositionRow[] } = await res.json();
          if (cancelled || !data.livePositions) continue;
          const rowsForRoute = data.livePositions;
          setPositions((prev) => {
            const next = { ...prev };
            for (const { party } of routeParties.filter((rp) => rp.route === route)) {
              next[trackerStatusKey(route, party.slug)] =
                rowsForRoute.find((p) => p.party === party.slug) ?? null;
            }
            return next;
          });
        } catch (err) {
          console.error(`TrackerStatus: polling /api/poll(${route}) failed`, err);
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
          Wanneer elke tracker voor het laatst een positie doorgaf — GPS is nu de primaire bron van voortgang, dus
          een stille tracker hier betekent dat viewers terugvallen op handmatige inchecks.
        </p>
      </div>
      <ul className={styles.trackerList}>
        {routeParties.map(({ route, party }) => {
          const row = positions[trackerStatusKey(route, party.slug)] ?? null;
          const recordedMs = row ? new Date(row.recordedAt).getTime() : null;
          const fresh = recordedMs !== null && !Number.isNaN(recordedMs) && now - recordedMs <= LIVE_POSITION_MAX_AGE_MS;
          const dotClass = !row ? styles.trackerDotNone : fresh ? styles.trackerDotFresh : styles.trackerDotStale;
          return (
            <li key={trackerStatusKey(route, party.slug)} className={styles.trackerRow}>
              <span className={dotClass} aria-hidden />
              <span className={styles.trackerLabel}>{party.label}</span>
              <span className={styles.trackerAgo}>
                {row && recordedMs !== null && !Number.isNaN(recordedMs)
                  ? `${fresh ? "" : "stil sinds "}${formatRelativeTime(recordedMs, now)}`
                  : "nog geen positie ontvangen"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
