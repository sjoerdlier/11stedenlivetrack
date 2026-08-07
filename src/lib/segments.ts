import { gradeAdjustedKm, haversineMeters, simplifyRoute, type LatLng } from "./geo";
import type { Leg } from "./legs";

export interface LegSegment {
  leg: Leg;
  positions: LatLng[];
  // Grade-adjusted flat-equivalent distance for this leg's forward stretch
  // (see gradeAdjustedKm) — a separate number from leg.afstand_km, which
  // stays the real, unadjusted distance for anything that displays "km".
  effortKm: number;
}

// Well under typical consumer-GPS accuracy (3-10m), so simplification here
// doesn't change the route's appearance at any zoom level a walking-route
// overview is actually viewed at — it just drops points redundant with
// their neighbors.
const SIMPLIFY_TOLERANCE_METERS = 10;

// Finds the GPX track point closest to (lat, lon), searching forward from
// fromIdx only. The route re-visits the same area more than once (e.g.
// Bartlehiem), so an unrestricted nearest-neighbor search could snap to the
// wrong pass; legs are in route order, so their track indices only increase.
function findTrackIndex(points: LatLng[], lat: number, lon: number, fromIdx: number): number {
  let bestIdx = fromIdx;
  let bestDist = Infinity;
  for (let i = fromIdx; i < points.length; i++) {
    const d = haversineMeters([lat, lon], points[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function buildLegSegments(points: LatLng[], elevations: (number | null)[], legs: Leg[]): LegSegment[] {
  const indices: number[] = [];
  let fromIdx = 0;
  for (const leg of legs) {
    fromIdx = findTrackIndex(points, leg.start_lat, leg.start_lon, fromIdx);
    indices.push(fromIdx);
  }

  return legs.map((leg, i) => {
    const startIdx = indices[i];
    const endIdx = i + 1 < legs.length ? indices[i + 1] : points.length - 1;
    const rawSlice = points.slice(startIdx, endIdx + 1);
    // Matching against leg start coordinates (findTrackIndex, above) needs
    // the raw, full-resolution track; only the polyline actually sent to
    // the client benefits from simplification, so it's applied here, after
    // slicing, rather than once on the whole route up front. effortKm is
    // computed from the same raw slice, before simplification, since
    // dropping points would also drop grade information between them.
    return {
      leg,
      positions: simplifyRoute(rawSlice, SIMPLIFY_TOLERANCE_METERS),
      effortKm: gradeAdjustedKm(rawSlice, elevations.slice(startIdx, endIdx + 1)),
    };
  });
}

// A grade-adjusted stand-in for `legs`: every pace/ETA function in
// actualProgress.ts, status.ts, and liveMarker.ts reads a leg's own
// afstand_km/cumulatief_start_km, so swapping those two fields for their
// effortKm equivalents here makes every one of those functions
// grade-adjusted for free, with no changes to their own code. Only for
// pace/ETA math — anything that displays "km" (the progress bar, "X km
// totaal", the route popup) should keep using the real `legs`/`afstand_km`,
// not this.
export function buildEffortLegs(legSegments: LegSegment[]): Leg[] {
  let cumulative = 0;
  return legSegments.map(({ leg, effortKm }) => {
    // afstand_km === null marks the finish leg (an endpoint, not a walkable
    // stage) — preserve that convention rather than replacing it with the
    // finish segment's own near-zero effortKm.
    const afstand_km = leg.afstand_km !== null ? effortKm : null;
    const effortLeg: Leg = { ...leg, afstand_km, cumulatief_start_km: cumulative };
    cumulative += afstand_km ?? 0;
    return effortLeg;
  });
}
