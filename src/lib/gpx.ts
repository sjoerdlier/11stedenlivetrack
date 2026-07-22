import { readFileSync } from "fs";
import { join } from "path";
import { XMLParser } from "fast-xml-parser";

export type LatLng = [number, number];

export interface RouteData {
  points: LatLng[];
  start: LatLng;
}

interface TrkPt {
  "@_lat": string;
  "@_lon": string;
}

interface ParsedGpx {
  gpx?: {
    trk?: {
      trkseg?: {
        trkpt?: TrkPt | TrkPt[];
      };
    };
  };
}

const GPX_PATH = join(process.cwd(), "data", "route.gpx");

export function loadRoute(): RouteData {
  const xml = readFileSync(GPX_PATH, "utf-8");
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml) as ParsedGpx;

  const rawPoints = parsed.gpx?.trk?.trkseg?.trkpt;
  const trkpts = Array.isArray(rawPoints)
    ? rawPoints
    : rawPoints
      ? [rawPoints]
      : [];

  const points: LatLng[] = trkpts.map((pt) => [
    parseFloat(pt["@_lat"]),
    parseFloat(pt["@_lon"]),
  ]);

  if (points.length === 0) {
    throw new Error(`Geen trackpoints gevonden in ${GPX_PATH}`);
  }

  return { points, start: points[0] };
}

const EARTH_RADIUS_M = 6371000;

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
