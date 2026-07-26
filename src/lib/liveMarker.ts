import { haversineMeters, type LatLng } from "./geo";
import type { Leg } from "./legs";
import type { LegSegment } from "./segments";

// Point along a polyline at the given fraction [0, 1] of its total length —
// distance-weighted, not index-based, since GPX points aren't evenly spaced
// (a straight stretch has far fewer points per km than a winding one).
export function pointAtFraction(positions: LatLng[], fraction: number): LatLng {
  if (positions.length === 0) return [0, 0];
  if (positions.length === 1 || fraction <= 0) return positions[0];
  if (fraction >= 1) return positions[positions.length - 1];

  const segmentLengths: number[] = [];
  let total = 0;
  for (let i = 1; i < positions.length; i++) {
    const d = haversineMeters(positions[i - 1], positions[i]);
    segmentLengths.push(d);
    total += d;
  }
  if (total === 0) return positions[0];

  const target = fraction * total;
  let covered = 0;
  for (let i = 0; i < segmentLengths.length; i++) {
    if (covered + segmentLengths[i] >= target) {
      const t = segmentLengths[i] === 0 ? 0 : (target - covered) / segmentLengths[i];
      const [lat1, lon1] = positions[i];
      const [lat2, lon2] = positions[i + 1];
      return [lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t];
    }
    covered += segmentLengths[i];
  }
  return positions[positions.length - 1];
}

export interface LivePosition {
  position: LatLng;
  legNr: number;
}

// Estimates where the walker currently is: interpolated along the segment
// from the most recently checked-into leg toward the next one, based on
// elapsed time since that check-in and an estimated pace (actual average if
// there's enough data, otherwise the planned pace — same fallback rule as
// estimateArrival). Returns null before the first check-in (nothing to show
// yet) or once the finish leg itself has a check-in (walk is done).
export function estimateLivePosition(
  legs: Leg[],
  legSegments: LegSegment[],
  checkinTimes: Map<number, number>,
  now: number,
  paceKmh: number | null,
): LivePosition | null {
  if (checkinTimes.size === 0 || paceKmh === null || paceKmh <= 0 || legs.length === 0) {
    return null;
  }

  const finishLeg = legs[legs.length - 1];
  if (checkinTimes.has(finishLeg.nr)) return null;

  let currentIndex = -1;
  for (let i = 0; i < legs.length - 1; i++) {
    if (checkinTimes.has(legs[i].nr)) currentIndex = i;
  }
  if (currentIndex === -1) return null;

  const leg = legs[currentIndex];
  const segment = legSegments[currentIndex];
  const checkinTime = checkinTimes.get(leg.nr);
  if (!segment || checkinTime === undefined || leg.afstand_km === null || leg.afstand_km <= 0) {
    return null;
  }

  const elapsedHours = Math.max(0, (now - checkinTime) / (1000 * 60 * 60));
  const estimatedDurationHours = leg.afstand_km / paceKmh;
  const fraction = estimatedDurationHours > 0 ? elapsedHours / estimatedDurationHours : 1;

  return {
    position: pointAtFraction(segment.positions, Math.min(1, fraction)),
    legNr: leg.nr,
  };
}
