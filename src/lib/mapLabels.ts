export type LabelMode = "full" | "short" | "hidden";

// Permanent CP tooltips clutter the map once you zoom out far enough to see
// the whole 204km loop — especially around Leeuwarden, where the start and
// finish CPs sit at (almost) the same coordinate. Shorten, then hide, as the
// zoom level drops; markers themselves stay put, only their labels react.
export const LABEL_FULL_ZOOM = 12;
export const LABEL_SHORT_ZOOM = 10;

export function labelModeForZoom(zoom: number): LabelMode {
  if (zoom >= LABEL_FULL_ZOOM) return "full";
  if (zoom >= LABEL_SHORT_ZOOM) return "short";
  return "hidden";
}

export type TooltipDirection = "left" | "right";

interface CpLegLike {
  nr: number;
  cp_nummer: number | null;
  start_lat: number;
  start_lon: number;
}

// Markers that sit at (almost) the same coordinate — e.g. the start and
// finish CPs at Leeuwarden — would otherwise stack their permanent tooltips
// exactly on top of each other regardless of zoom. Group CP legs by rounded
// coordinate and alternate direction *within each group*, so coincident
// labels fan out instead of overlapping. A CP number's own parity isn't
// reliable here: two coincident CPs can easily both be odd or both even.
export function assignCpTooltipDirections(legs: CpLegLike[]): Map<number, TooltipDirection> {
  const groups = new Map<string, CpLegLike[]>();

  for (const leg of legs) {
    if (leg.cp_nummer === null) continue;
    const key = `${leg.start_lat.toFixed(4)},${leg.start_lon.toFixed(4)}`;
    const group = groups.get(key);
    if (group) group.push(leg);
    else groups.set(key, [leg]);
  }

  const directions = new Map<number, TooltipDirection>();
  for (const group of groups.values()) {
    group.forEach((leg, i) => {
      directions.set(leg.nr, i % 2 === 0 ? "right" : "left");
    });
  }
  return directions;
}
