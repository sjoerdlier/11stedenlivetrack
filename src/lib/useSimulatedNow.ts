"use client";

import { useEffect, useState } from "react";

const DEFAULT_DEBUG_SPEED = 60;
const DEBUG_TICK_MS = 250;

interface DebugClock {
  baseTime: number;
  speed: number | null; // null = frozen, no ticking
}

function readDebugClock(): DebugClock | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);

  const debugTimeRaw = params.get("debugTime");
  const parsedBase = debugTimeRaw ? new Date(debugTimeRaw).getTime() : NaN;
  const hasBase = !Number.isNaN(parsedBase);

  if (!params.has("debug")) {
    return hasBase ? { baseTime: parsedBase, speed: null } : null;
  }

  const rawSpeed = Number(params.get("debug"));
  const speed = Number.isFinite(rawSpeed) && rawSpeed > 0 ? rawSpeed : DEFAULT_DEBUG_SPEED;
  return { baseTime: hasBase ? parsedBase : Date.now(), speed };
}

// A client-side clock that ticks every `intervalMs`, so status derived from
// geplande_tijd stays current without a page reload — unless overridden via
// the querystring for deterministic testing without waiting for race day:
//
// - `?debugTime=<ISO date>` freezes "now" at that value (no ticking at all)
//   — status colors, progress, the pre-start countdown, etc. all read that
//   fixed point in time.
// - `?debug=<speed>` (optionally combined with debugTime) instead ticks
//   forward from that point (or from the real time, if no debugTime) at
//   <speed>x real time (default 60x), so a moving/rotating map marker or
//   other time-driven animation can be watched progress without a real day
//   passing.
export function useSimulatedNow(intervalMs: number): number {
  const [debugClock] = useState(readDebugClock);
  const [now, setNow] = useState(() => debugClock?.baseTime ?? Date.now());

  useEffect(() => {
    if (debugClock === null) {
      const id = setInterval(() => setNow(Date.now()), intervalMs);
      return () => clearInterval(id);
    }

    const { baseTime, speed } = debugClock;
    if (speed === null) return; // frozen: initial state already holds baseTime

    const mountedAt = Date.now();
    const id = setInterval(() => {
      setNow(baseTime + (Date.now() - mountedAt) * speed);
    }, DEBUG_TICK_MS);
    return () => clearInterval(id);
  }, [debugClock, intervalMs]);

  return now;
}
