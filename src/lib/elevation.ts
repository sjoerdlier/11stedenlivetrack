import { haversineMeters, type LatLng } from "./geo";

export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
}

const DEFAULT_MAX_POINTS = 200;

// Cumulative-distance-vs-elevation profile, downsampled to at most
// `maxPoints` — a 4700-point GPX track has far more resolution than an SVG
// chart a few hundred pixels wide can usefully show, and shipping all of it
// to the client would dwarf the already-simplified route polyline. Returns
// [] if the GPX has no elevation data at all (the KAT100 export does;
// nothing guarantees every future GPX will).
export function buildElevationProfile(
  points: LatLng[],
  elevations: (number | null)[],
  maxPoints: number = DEFAULT_MAX_POINTS,
): ElevationPoint[] {
  if (points.length === 0 || elevations.every((e) => e === null)) return [];

  let cumulativeM = 0;
  const full: ElevationPoint[] = points.map((point, i) => {
    if (i > 0) cumulativeM += haversineMeters(points[i - 1], point);
    return { distanceKm: cumulativeM / 1000, elevationM: elevations[i] ?? 0 };
  });

  if (full.length <= maxPoints) return full;

  const stride = Math.ceil(full.length / maxPoints);
  const sampled = full.filter((_, i) => i % stride === 0);
  const last = full[full.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}
