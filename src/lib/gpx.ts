import { readFileSync } from "fs";
import { join } from "path";
import { XMLParser } from "fast-xml-parser";
import type { LatLng } from "./geo";

// Re-exported for existing consumers; the type itself, and the pure
// geometry helpers, live in geo.ts (no Node deps) so client components can
// import them without pulling this file's `fs` usage into the browser
// bundle.
export type { LatLng };
export { haversineMeters, simplifyRoute } from "./geo";

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

export function loadRoute(gpxFile: string): RouteData {
  const xml = readFileSync(join(process.cwd(), "data", gpxFile), "utf-8");
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
    throw new Error(`Geen trackpoints gevonden in data/${gpxFile}`);
  }

  return { points, start: points[0] };
}
