// Pure geometry helpers with zero Node dependencies, split out from gpx.ts
// (which reads GPX files off disk via `fs`) specifically so client
// components — like the live position marker — can import them without
// pulling a server-only `fs` import into the browser bundle.

export type LatLng = [number, number];

const EARTH_RADIUS_M = 6371000;

// Great-circle distance between two points, in meters.
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Local equirectangular projection (meters), accurate enough for a single
// route confined to a narrow latitude band — not meant for global use.
function projectMeters(lat: number, lon: number, refLatRad: number): [number, number] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  return [EARTH_RADIUS_M * toRad(lon) * Math.cos(refLatRad), EARTH_RADIUS_M * toRad(lat)];
}

function perpendicularDistanceMeters(
  point: LatLng,
  lineStart: LatLng,
  lineEnd: LatLng,
  refLatRad: number,
): number {
  const [px, py] = projectMeters(point[0], point[1], refLatRad);
  const [ax, ay] = projectMeters(lineStart[0], lineStart[1], refLatRad);
  const [bx, by] = projectMeters(lineEnd[0], lineEnd[1], refLatRad);
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / Math.sqrt(lenSq);
}

// Metabolic cost of running/walking a gradient, relative to flat ground —
// Minetti et al. (2002), the same physiological model most "grade adjusted
// pace" (GAP) tools use. `gradient` is rise/run (0.1 = 10% grade); clamped
// to ±45%, the range the original study validated, since GPS/barometric
// noise over a short point-to-point stretch can otherwise produce
// nonsensical spikes. Below ~-20% the polynomial rises again (steep
// descents cost more than gentle ones, due to braking) — that's the model
// working as intended, not a bug.
function minettiCostFactor(gradient: number): number {
  const i = Math.max(-0.45, Math.min(0.45, gradient));
  const cost = 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;
  const FLAT_COST = 3.6; // cost at i = 0
  return cost / FLAT_COST;
}

// Converts a GPX stretch into its flat-ground *effort* equivalent: walks
// consecutive points, costing each small hop by its own gradient rather
// than the stretch's net elevation change — a leg with equal climbing and
// descending nets to ~0m gain but is still real effort, which only
// point-by-point costing captures. A point pair with missing elevation
// contributes its raw (unadjusted) distance rather than being dropped, so
// a GPX with partial elevation data degrades gracefully instead of
// under-counting distance.
export function gradeAdjustedKm(points: LatLng[], elevations: (number | null)[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) {
    const distM = haversineMeters(points[i - 1], points[i]);
    const eleA = elevations[i - 1];
    const eleB = elevations[i];
    const factor = distM > 0 && eleA !== null && eleB !== null ? minettiCostFactor((eleB - eleA) / distM) : 1;
    km += (distM * factor) / 1000;
  }
  return km;
}

// Nearest track point to `query`, searching only forward from `fromIdx` —
// same reasoning as segments.ts's findTrackIndex: the route re-visits the
// same area more than once (Bartlehiem), so an unrestricted nearest-neighbor
// search could snap a live GPS fix to the wrong pass. Walking a chronological
// trail of fixes forward (each one searching from where the previous one
// landed) keeps that disambiguation correct without needing to know which
// leg a fix belongs to ahead of time, the way findTrackIndex's caller does.
export function nearestPointIndexForward(points: LatLng[], query: LatLng, fromIdx: number): number {
  let bestIdx = fromIdx;
  let bestDist = Infinity;
  for (let i = fromIdx; i < points.length; i++) {
    const d = haversineMeters(query, points[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Ramer-Douglas-Peucker line simplification. Drops points that sit within
// `toleranceMeters` of the straight line between their neighbors, keeping
// the route's shape intact while cutting point count substantially — a
// 4127-point GPX track (~84KB) is far denser than a 204km route needs at
// map scale, and that payload ships to every client over what can be a
// 3G-grade connection on race day.
export function simplifyRoute(points: LatLng[], toleranceMeters: number): LatLng[] {
  if (points.length < 3) return points.slice();

  const avgLat = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const refLatRad = (avgLat * Math.PI) / 180;

  function rdp(pts: LatLng[]): LatLng[] {
    if (pts.length < 3) return pts;
    const first = pts[0];
    const last = pts[pts.length - 1];
    let maxDist = 0;
    let maxIndex = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const dist = perpendicularDistanceMeters(pts[i], first, last, refLatRad);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }
    if (maxDist > toleranceMeters) {
      const left = rdp(pts.slice(0, maxIndex + 1));
      const right = rdp(pts.slice(maxIndex));
      return left.slice(0, -1).concat(right);
    }
    return [first, last];
  }

  return rdp(points);
}
