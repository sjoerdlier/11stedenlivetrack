import { describe, expect, it } from "vitest";
import { buildLegSegments } from "./segments";
import type { LatLng } from "./geo";
import type { Leg } from "./legs";

function makeLeg(overrides: Partial<Leg>): Leg {
  return {
    nr: 1,
    start_plaats: "Testplaats",
    afstand_km: 1,
    loper: "Testloper",
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

describe("buildLegSegments", () => {
  it("snaps a revisited coordinate forward to its later pass, not back to the earlier one", () => {
    const legs: Leg[] = [
      makeLeg({ nr: 1, start_lat: 0, start_lon: 0 }),
      makeLeg({ nr: 2, start_lat: 0, start_lon: 1 }),
      makeLeg({ nr: 3, start_lat: 0, start_lon: 1.00001 }),
    ];

    const segments = buildLegSegments(points, legs);

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

    const segments = buildLegSegments(points, legs);

    // Leg 1 runs up to (and including) leg 2's start point.
    expect(segments[0].positions.at(-1)).toEqual(points[2]);
    // The last leg runs to the end of the track.
    expect(segments[1].positions.at(-1)).toEqual(points.at(-1));
  });
});
