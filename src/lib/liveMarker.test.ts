import { describe, expect, it } from "vitest";
import { estimateLivePosition, isLivePositionFresh, LIVE_POSITION_MAX_AGE_MS, pointAtFraction } from "./liveMarker";
import type { LatLng } from "./geo";
import type { Leg } from "./legs";
import type { LegSegment } from "./segments";

function makeLeg(overrides: Partial<Leg>): Leg {
  return {
    nr: 1,
    start_plaats: "Testplaats",
    afstand_km: 10,
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

describe("pointAtFraction", () => {
  const line: LatLng[] = [
    [0, 0],
    [0, 1],
    [0, 3],
  ];

  it("returns the start at fraction 0 and the end at fraction 1", () => {
    expect(pointAtFraction(line, 0)).toEqual([0, 0]);
    expect(pointAtFraction(line, 1)).toEqual([0, 3]);
  });

  it("weights by distance, not by point index", () => {
    // The first leg (0,0 -> 0,1) is a third of the total 3-degree length,
    // so the halfway-by-distance point falls inside the second, longer
    // leg (0,1 -> 0,3) — not at the middle point (0,1) itself.
    const midpoint = pointAtFraction(line, 0.5);
    expect(midpoint[1]).toBeGreaterThan(1);
    expect(midpoint[1]).toBeLessThan(3);
  });

  it("clamps out-of-range fractions instead of extrapolating", () => {
    expect(pointAtFraction(line, -0.5)).toEqual([0, 0]);
    expect(pointAtFraction(line, 1.5)).toEqual([0, 3]);
  });

  it("handles a single-point line without dividing by zero", () => {
    expect(pointAtFraction([[1, 2]], 0.5)).toEqual([1, 2]);
  });
});

describe("estimateLivePosition", () => {
  const legs: Leg[] = [
    makeLeg({ nr: 1, afstand_km: 10, cumulatief_start_km: 0 }),
    makeLeg({ nr: 2, afstand_km: 10, cumulatief_start_km: 10 }),
    makeLeg({ nr: 3, afstand_km: 0, loper: null, cumulatief_start_km: 20 }),
  ];
  const legSegments: LegSegment[] = [
    { leg: legs[0], positions: [[0, 0], [0, 1]], effortKm: 10 },
    { leg: legs[1], positions: [[0, 1], [0, 2]], effortKm: 10 },
    { leg: legs[2], positions: [[0, 2]], effortKm: 0 },
  ];

  it("returns null before the first check-in", () => {
    expect(estimateLivePosition(legs, legSegments, new Map(), 1000, 5)).toBeNull();
  });

  it("returns null once the finish leg has been checked into", () => {
    const checkinTimes = new Map([[1, 0], [2, 1000], [3, 2000]]);
    expect(estimateLivePosition(legs, legSegments, checkinTimes, 3000, 5)).toBeNull();
  });

  it("interpolates along the segment after the most recent check-in", () => {
    const checkinTime = 0;
    const checkinTimes = new Map([[1, checkinTime]]);
    // 10 km at 5 km/u = 2h for the full leg; 1h elapsed = halfway.
    const oneHourLater = checkinTime + 60 * 60 * 1000;
    const result = estimateLivePosition(legs, legSegments, checkinTimes, oneHourLater, 5);
    expect(result?.legNr).toBe(1);
    expect(result?.position).toEqual(pointAtFraction(legSegments[0].positions, 0.5));
  });

  it("uses the most recently checked-in leg, not the first one", () => {
    const checkinTimes = new Map([[1, 0], [2, 60 * 60 * 1000]]);
    const now = 60 * 60 * 1000 + 30 * 60 * 1000; // 30 min into leg 2
    const result = estimateLivePosition(legs, legSegments, checkinTimes, now, 5);
    expect(result?.legNr).toBe(2);
  });

  it("clamps at the segment end instead of overshooting when overdue", () => {
    const checkinTimes = new Map([[1, 0]]);
    const wayLater = 10 * 60 * 60 * 1000; // way past the ~2h estimate
    const result = estimateLivePosition(legs, legSegments, checkinTimes, wayLater, 5);
    expect(result?.position).toEqual([0, 1]);
  });
});

describe("isLivePositionFresh", () => {
  const now = 1_000_000_000;

  it("is fresh right at the moment it was recorded", () => {
    expect(isLivePositionFresh(new Date(now).toISOString(), now)).toBe(true);
  });

  it("is fresh just under the max age", () => {
    const recordedAt = new Date(now - LIVE_POSITION_MAX_AGE_MS + 1000).toISOString();
    expect(isLivePositionFresh(recordedAt, now)).toBe(true);
  });

  it("is stale just over the max age", () => {
    const recordedAt = new Date(now - LIVE_POSITION_MAX_AGE_MS - 1000).toISOString();
    expect(isLivePositionFresh(recordedAt, now)).toBe(false);
  });

  it("tolerates a little clock skew rather than treating a future timestamp as invalid", () => {
    const recordedAt = new Date(now + 5000).toISOString();
    expect(isLivePositionFresh(recordedAt, now)).toBe(true);
  });

  it("is not fresh for an unparseable timestamp", () => {
    expect(isLivePositionFresh("not-a-date", now)).toBe(false);
  });
});
