import type { LatLng } from "./gpx";
import type { Leg } from "./legs";

export interface LegSegment {
  leg: Leg;
  positions: LatLng[];
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Finds the GPX track point closest to (lat, lon), searching forward from
// fromIdx only. The route re-visits the same area more than once (e.g.
// Bartlehiem), so an unrestricted nearest-neighbor search could snap to the
// wrong pass; legs are in route order, so their track indices only increase.
function findTrackIndex(points: LatLng[], lat: number, lon: number, fromIdx: number): number {
  let bestIdx = fromIdx;
  let bestDist = Infinity;
  for (let i = fromIdx; i < points.length; i++) {
    const d = haversineMeters(lat, lon, points[i][0], points[i][1]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function buildLegSegments(points: LatLng[], legs: Leg[]): LegSegment[] {
  const indices: number[] = [];
  let fromIdx = 0;
  for (const leg of legs) {
    fromIdx = findTrackIndex(points, leg.start_lat, leg.start_lon, fromIdx);
    indices.push(fromIdx);
  }

  return legs.map((leg, i) => {
    const startIdx = indices[i];
    const endIdx = i + 1 < legs.length ? indices[i + 1] : points.length - 1;
    return {
      leg,
      positions: points.slice(startIdx, endIdx + 1),
    };
  });
}
