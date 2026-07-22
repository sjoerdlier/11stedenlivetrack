"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const DEFAULT_DEBUG_SPEED = 60;
const DEBUG_TICK_MS = 250;

interface DebugClock {
  baseTime: number;
  speed: number;
}

// ?debug=1 (or ?debug=<speed>) fast-forwards the clock so leg statuses and
// the simulated runner position race through the whole schedule in minutes
// instead of days, without needing a real live-location feed. ?debugTime=
// overrides the starting point (e.g. the race's actual start) instead of
// "now", so any point in the schedule can be previewed on demand.
function readDebugClock(searchParams: URLSearchParams): DebugClock | null {
  if (!searchParams.has("debug")) return null;

  const rawSpeed = Number(searchParams.get("debug"));
  const speed = Number.isFinite(rawSpeed) && rawSpeed > 0 ? rawSpeed : DEFAULT_DEBUG_SPEED;

  const debugTime = searchParams.get("debugTime");
  const parsedBase = debugTime ? new Date(debugTime).getTime() : NaN;
  const baseTime = Number.isNaN(parsedBase) ? Date.now() : parsedBase;

  return { baseTime, speed };
}

// A client-side clock that ticks every `intervalMs`, so status derived from
// geplande_tijd stays current without a page reload.
export function useNow(intervalMs: number): number {
  const searchParams = useSearchParams();
  const debugClock = readDebugClock(searchParams);
  const debugBaseTime = debugClock?.baseTime ?? null;
  const debugSpeed = debugClock?.speed ?? null;

  const [now, setNow] = useState(() => debugBaseTime ?? Date.now());

  useEffect(() => {
    if (debugBaseTime === null || debugSpeed === null) {
      const id = setInterval(() => setNow(Date.now()), intervalMs);
      return () => clearInterval(id);
    }

    const mountedAt = Date.now();
    const id = setInterval(() => {
      setNow(debugBaseTime + (Date.now() - mountedAt) * debugSpeed);
    }, DEBUG_TICK_MS);
    return () => clearInterval(id);
  }, [intervalMs, debugBaseTime, debugSpeed]);

  return now;
}
