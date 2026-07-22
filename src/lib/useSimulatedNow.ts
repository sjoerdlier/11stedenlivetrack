"use client";

import { useEffect, useState } from "react";

function parseDebugTime(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("debugTime");
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

// A client-side clock that ticks every `intervalMs`, so status derived from
// geplande_tijd stays current without a page reload — unless a
// `?debugTime=<ISO date>` query param is present, in which case "now" is
// frozen at that value instead. Lets status colors, the pre-start countdown,
// etc. be tested deterministically without waiting for race day.
//
// NOTE: a future RunnerFigure PR will likely want its own simulated-time
// source (probably to drive marker position along the route). This hook is
// the natural place to reconcile the two — expect a merge conflict here,
// don't route around it.
export function useSimulatedNow(intervalMs: number): number {
  const [debugTime] = useState(parseDebugTime);
  const [now, setNow] = useState(() => debugTime ?? Date.now());

  useEffect(() => {
    if (debugTime !== null) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [debugTime, intervalMs]);

  return debugTime ?? now;
}
