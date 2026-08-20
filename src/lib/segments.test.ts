import { describe, expect, it } from "vitest";
import { buildEffortLegs, buildLegSegments, type LegSegment } from "./segments";
import { gradeAdjustedKm, haversineMeters, type LatLng } from "./geo";
import type { Leg } from "./legs";

function makeLeg(overrides: Partial<Leg>): Leg {
  return {
    nr: 1,
    start_plaats: "Testplaats",
    afstand_km: 1,
    loper: "Testloper",
    loper_bjorn: null,
    cumulatief_start_km: 0,
    start_lat: 0,
    start_lon: 0,
    geplande_tijd: null,
    cp_nummer: null,
    adres: null,
    bijzonderheden: null,
    ...overrides,
  };
}

// A route that passes near the same spot twice — the KAT100's
// Lärchfilzhochalm (km 16.8 and km 43.2) and the 11 Steden's Bartlehiem are
// the real-world versions of this shape. Point 3 sits almost on top of
// point 1 but isn't identical, same as those real checkpoint pairs.
const points: LatLng[] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [0, 1.00001],
  [0, 3],
];
const flatElevations: (number | null)[] = points.map(() => 500);

describe("buildLegSegments", () => {
  it("snaps a revisited coordinate forward to its later pass, not back to the earlier one", () => {
    const legs: Leg[] = [
      makeLeg({ nr: 1, start_lat: 0, start_lon: 0 }),
      makeLeg({ nr: 2, start_lat: 0, start_lon: 1 }),
      makeLeg({ nr: 3, start_lat: 0, start_lon: 1.00001 }),
    ];

    const segments = buildLegSegments(points, flatElevations, legs);

    expect(segments[1].positions[0]).toEqual(points[1]);
    // The bug this guards against: an unrestricted nearest-neighbor search
    // would resolve leg 3 back to point 1 (nearly identical coordinates,
    // encountered earlier) instead of forward to point 3.
    expect(segments[2].positions[0]).toEqual(points[3]);
  });

  it("gives each leg's segment the correct trailing leg for its end boundary", () => {
    const legs: Leg[] = [
      makeLeg({ nr: 1, start_lat: 0, start_lon: 0 }),
      makeLeg({ nr: 2, start_lat: 0, start_lon: 2 }),
    ];

    const segments = buildLegSegments(points, flatElevations, legs);

    // Leg 1 runs up to (and including) leg 2's start point.
    expect(segments[0].positions.at(-1)).toEqual(points[2]);
    // The last leg runs to the end of the track.
    expect(segments[1].positions.at(-1)).toEqual(points.at(-1));
  });

  it("gives a leg segment ~0 effortKm on perfectly flat ground, matching its raw distance", () => {
    const legs: Leg[] = [
      makeLeg({ nr: 1, start_lat: 0, start_lon: 0 }),
      makeLeg({ nr: 2, start_lat: 0, start_lon: 1 }),
    ];

    const segments = buildLegSegments(points, flatElevations, legs);
    const rawKm = haversineMeters(points[0], points[1]) / 1000;

    expect(segments[0].effortKm).toBeCloseTo(rawKm, 5);
  });
});

describe("gradeAdjustedKm", () => {
  const flatPoints: LatLng[] = [
    [47.4, 12.4],
    [47.41, 12.4],
  ];
  const rawKm = haversineMeters(flatPoints[0], flatPoints[1]) / 1000;

  it("matches the raw distance on flat ground", () => {
    expect(gradeAdjustedKm(flatPoints, [1000, 1000])).toBeCloseTo(rawKm, 5);
  });

  it("costs more than the raw distance on a climb", () => {
    // ~5% grade over the stretch's own distance
    const gainM = rawKm * 1000 * 0.05;
    expect(gradeAdjustedKm(flatPoints, [1000, 1000 + gainM])).toBeGreaterThan(rawKm);
  });

  it("costs less than the raw distance on a gentle descent", () => {
    const dropM = rawKm * 1000 * 0.05;
    expect(gradeAdjustedKm(flatPoints, [1000, 1000 - dropM])).toBeLessThan(rawKm);
  });

  it("falls back to the raw distance when elevation is missing", () => {
    expect(gradeAdjustedKm(flatPoints, [null, null])).toBeCloseTo(rawKm, 5);
  });

  it("clamps an extreme, GPS-noise-scale grade instead of blowing up", () => {
    const km = gradeAdjustedKm(flatPoints, [0, 100000]);
    expect(Number.isFinite(km)).toBe(true);
    expect(km).toBeGreaterThan(0);
  });
});

describe("buildEffortLegs", () => {
  function makeSegment(nr: number, afstand_km: number | null, effortKm: number): LegSegment {
    return { leg: makeLeg({ nr, afstand_km }), positions: [], effortKm };
  }

  it("replaces afstand_km with the grade-adjusted equivalent and re-derives cumulatief_start_km", () => {
    const segments = [makeSegment(1, 10, 12), makeSegment(2, 5, 4), makeSegment(3, null, 0.01)];
    const effortLegs = buildEffortLegs(segments);

    expect(effortLegs[0].afstand_km).toBe(12);
    expect(effortLegs[0].cumulatief_start_km).toBe(0);
    expect(effortLegs[1].afstand_km).toBe(4);
    expect(effortLegs[1].cumulatief_start_km).toBe(12);
    expect(effortLegs[2].cumulatief_start_km).toBe(16);
  });

  it("keeps the finish leg's afstand_km null rather than substituting its own near-zero effortKm", () => {
    const segments = [makeSegment(1, 10, 12), makeSegment(2, null, 0.01)];
    const effortLegs = buildEffortLegs(segments);

    expect(effortLegs[1].afstand_km).toBeNull();
  });
});
