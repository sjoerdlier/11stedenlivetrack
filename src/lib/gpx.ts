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
  // Parallel to `points`; null for a track point with no <ele> (or a GPX
  // export that omits elevation entirely — buildElevationProfile treats an
  // all-null array as "no elevation data" and returns nothing to chart).
  elevations: (number | null)[];
  start: LatLng;
}

interface TrkPt {
  "@_lat": string;
  "@_lon": string;
  ele?: number;
}

interface TrkSeg {
  trkpt?: TrkPt | TrkPt[];
}

interface ParsedGpx {
  gpx?: {
    trk?: {
      // fast-xml-parser only returns an array once there's more than one
      // <trkseg> — a single-segment GPX (every export so far) parses
      // trkseg as one bare object, not a one-element array, same reason
      // trkpt is normalized below.
      trkseg?: TrkSeg | TrkSeg[];
    };
  };
}

export function loadRoute(gpxFile: string): RouteData {
  const xml = readFileSync(join(process.cwd(), "data", gpxFile), "utf-8");
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml) as ParsedGpx;

  const rawSegments = parsed.gpx?.trk?.trkseg;
  const segments: TrkSeg[] = Array.isArray(rawSegments)
    ? rawSegments
    : rawSegments
      ? [rawSegments]
      : [];

  // Concatenated in document order — a multi-segment GPX (e.g. exported
  // with a pause/gap in recording) represents one continuous route split
  // across <trkseg> elements, not several unrelated tracks, so every
  // downstream consumer (segments.ts's forward index search, the
  // elevation profile) expects one flat point list.
  const trkpts: TrkPt[] = segments.flatMap((seg) => {
    const rawPoints = seg.trkpt;
    return Array.isArray(rawPoints) ? rawPoints : rawPoints ? [rawPoints] : [];
  });

  const points: LatLng[] = [];
  const elevations: (number | null)[] = [];
  for (const pt of trkpts) {
    const lat = parseFloat(pt["@_lat"]);
    const lon = parseFloat(pt["@_lon"]);
    // A NaN coordinate here would otherwise flow silently into
    // haversineMeters (producing NaN distances) and Leaflet (which drops
    // or mis-renders NaN LatLngs) — fail loudly instead, since a malformed
    // trackpoint means the GPX export itself is broken.
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      throw new Error(
        `Ongeldig trackpoint in data/${gpxFile}: lat="${pt["@_lat"]}" lon="${pt["@_lon"]}"`,
      );
    }
    points.push([lat, lon]);
    elevations.push(typeof pt.ele === "number" ? pt.ele : null);
  }

  if (points.length === 0) {
    throw new Error(`Geen trackpoints gevonden in data/${gpxFile}`);
  }

  return { points, elevations, start: points[0] };
}
