import type { LatLng } from "./gpx";
import type { LegSegment } from "./segments";
import type { LegStatus } from "./status";
import { haversineMeters, bearingDeg } from "./geo";

export interface RunnerPosition {
  legNr: number;
  position: LatLng;
  bearingDeg: number;
}

function cumulativeDistances(points: LatLng[]): number[] {
  const dists = [0];
  for (let i = 1; i < points.length; i++) {
    const [lat1, lon1] = points[i - 1];
    const [lat2, lon2] = points[i];
    dists.push(dists[i - 1] + haversineMeters(lat1, lon1, lat2, lon2));
  }
  return dists;
}

// There is no live GPS feed yet (see status.ts): the runner's position is
// simulated by placing it along the active leg's track proportionally to how
// far its scheduled time window (own geplande_tijd -> next leg's) has
// progressed, so the map marker moves smoothly instead of jumping leg-to-leg.
export function computeRunnerPosition(
  legSegments: LegSegment[],
  statuses: Map<number, LegStatus>,
  now: number
): RunnerPosition | null {
  const legIndex = legSegments.findIndex((s) => statuses.get(s.leg.nr) === "bezig");
  if (legIndex === -1) return null;

  const { leg, positions } = legSegments[legIndex];
  if (positions.length < 2) return null;

  const legTime = leg.geplande_tijd ? new Date(leg.geplande_tijd).getTime() : null;
  if (legTime === null || Number.isNaN(legTime)) return null;

  const nextLeg = legSegments[legIndex + 1]?.leg;
  const nextTime = nextLeg?.geplande_tijd ? new Date(nextLeg.geplande_tijd).getTime() : null;

  let fraction = 0;
  if (nextTime !== null && !Number.isNaN(nextTime) && nextTime > legTime) {
    fraction = (now - legTime) / (nextTime - legTime);
  }
  fraction = Math.min(1, Math.max(0, fraction));

  const dists = cumulativeDistances(positions);
  const totalDist = dists[dists.length - 1];
  const target = fraction * totalDist;

  let idx = 0;
  while (idx < dists.length - 2 && dists[idx + 1] < target) idx++;

  const segStart = positions[idx];
  const segEnd = positions[idx + 1];
  const segStartDist = dists[idx];
  const segEndDist = dists[idx + 1];
  const segFraction =
    segEndDist > segStartDist ? (target - segStartDist) / (segEndDist - segStartDist) : 0;

  const position: LatLng = [
    segStart[0] + (segEnd[0] - segStart[0]) * segFraction,
    segStart[1] + (segEnd[1] - segStart[1]) * segFraction,
  ];

  return {
    legNr: leg.nr,
    position,
    bearingDeg: bearingDeg(segStart, segEnd),
  };
}
