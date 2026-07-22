"use client";

import { useEffect, useState } from "react";

// A client-side clock that ticks every `intervalMs`, so status derived from
// geplande_tijd stays current without a page reload.
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
