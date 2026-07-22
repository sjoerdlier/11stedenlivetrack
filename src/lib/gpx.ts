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
