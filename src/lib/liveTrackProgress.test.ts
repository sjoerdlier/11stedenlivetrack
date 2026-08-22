import { describe, expect, it } from "vitest";
import {
  computeLiveTrackProgress,
  historySinceIso,
  parseHistoryWindowMs,
  LIVE_TRACK_HISTORY_WINDOW_MS,
} from "./liveTrackProgress";
import { LIVE_POSITION_MAX_AGE_MS } from "./liveMarker";
import type { Leg } from "./legs";
import type { LegSegment } from "./segments";
import type { LivePositionRow } from "./livePositions";

function makeLeg(overrides: Partial<Leg>): Leg {
  return {
    nr: 1,
    start_plaats: "Testplaats",
    afstand_km: 10,
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

// A straight two-leg-plus-finish route running north along longitude 0, ~10
// declared km per leg (real geodesic distance is close enough for these
// tests' purposes — buildRoutePoints scales by the *declared* afstand_km,
// not the raw polyline length, so an exact match isn't required).
const T0 = new Date("2026-08-29T08:00:00Z").getTime();
const legs: Leg[] = [
  makeLeg({ nr: 1, afstand_km: 10, cumulatief_start_km: 0, geplande_tijd: new Date(T0).toISOString() }),
  makeLeg({
    nr: 2,
    afstand_km: 10,
    cumulatief_start_km: 10,
    geplande_tijd: new Date(T0 + 2 * 60 * 60 * 1000).toISOString(),
  }),
  makeLeg({
    nr: 3,
    afstand_km: null,
    loper: null,
    cumulatief_start_km: 20,
    geplande_tijd: new Date(T0 + 4 * 60 * 60 * 1000).toISOString(),
  }),
];
const legSegments: LegSegment[] = [
  { leg: legs[0], positions: [[0, 0], [0.05, 0], [0.1, 0]], effortKm: 10 },
  { leg: legs[1], positions: [[0.1, 0], [0.15, 0], [0.2, 0]], effortKm: 10 },
  { leg: legs[2], positions: [[0.2, 0]], effortKm: 0 },
];
// Grade-adjusted stand-in — equal to the real legs here, since these tests
// aren't exercising the Minetti adjustment itself.
const effortLegs = legs;

function fix(position: [number, number], recordedAt: number): LivePositionRow {
  return { party: "team", lat: position[0], lon: position[1], recordedAt: new Date(recordedAt).toISOString() };
}

describe("computeLiveTrackProgress", () => {
  it("returns null with no position history", () => {
    expect(computeLiveTrackProgress(legs, legSegments, effortLegs, [], T0)).toBeNull();
  });

  it("returns null once the newest fix has gone stale", () => {
    const history = [fix([0, 0], T0)];
    const now = T0 + LIVE_POSITION_MAX_AGE_MS + 1000;
    expect(computeLiveTrackProgress(legs, legSegments, effortLegs, history, now)).toBeNull();
  });

  it("derives km/progress/pace from a normal, steadily-advancing trail", () => {
    const history = [
      fix([0, 0], T0),
      fix([0.05, 0], T0 + 30 * 60 * 1000), // ~halfway along leg 1, 30 min later
    ];
    const now = T0 + 30 * 60 * 1000;
    const result = computeLiveTrackProgress(legs, legSegments, effortLegs, history, now);
    expect(result).not.toBeNull();
    expect(result!.progress.km).toBeCloseTo(5, 0);
    expect(result!.paceKmh).not.toBeNull();
    expect(result!.paceKmh!).toBeGreaterThan(0);
    expect(result!.paceKmh!).toBeLessThan(25); // sane walking-ish pace, not a glitch
  });

  it("ignores a fix far off the route without corrupting later, correct fixes", () => {
    const history = [
      fix([0, 0], T0),
      // ~2.2km east of the *finish* end of the route — its nearest point is
      // still the finish (km 20), just past MAX_OFF_ROUTE_METERS (1500m).
      // Unfiltered, nearestPointIndexForward would happily snap to that
      // finish point anyway (it's still the closest one), wrongly pushing
      // the forward-only search boundary all the way to the end.
      fix([0.2, 0.02], T0 + 10 * 60 * 1000),
      // A genuine fix back at leg 1's midpoint. If the fix above had wrongly
      // advanced the search boundary to the finish, this could never
      // resolve back to km 5 — the search can only go forward from there.
      fix([0.05, 0], T0 + 20 * 60 * 1000),
    ];
    const now = T0 + 20 * 60 * 1000;
    const result = computeLiveTrackProgress(legs, legSegments, effortLegs, history, now);
    expect(result).not.toBeNull();
    expect(result!.progress.km).toBeCloseTo(5, 0);
  });

  it("ignores an implausible speed jump without corrupting later, correct fixes", () => {
    const history = [
      fix([0, 0], T0),
      // Implies ~11km in 10 seconds — a glitch, not real movement.
      fix([0.1, 0], T0 + 10 * 1000),
      // A genuine fix back at leg 1's midpoint, 40 minutes after the first
      // one. If the glitch above had wrongly advanced the forward-only
      // search past leg 1 already, this fix (geographically *before* that
      // point) could never resolve correctly again.
      fix([0.05, 0], T0 + 40 * 60 * 1000),
    ];
    const now = T0 + 40 * 60 * 1000;
    const result = computeLiveTrackProgress(legs, legSegments, effortLegs, history, now);
    expect(result).not.toBeNull();
    expect(result!.progress.km).toBeCloseTo(5, 0);
  });

  it("falls back to null when every fix in the trail is implausible", () => {
    const history = [fix([0.05, 5], T0)]; // hundreds of km off the route
    const result = computeLiveTrackProgress(legs, legSegments, effortLegs, history, T0);
    expect(result).toBeNull();
  });

  it("reports a schedule delta interpolated between the bracketing legs' geplande_tijd", () => {
    // Halfway through leg 1 (km 5 of 0-10), geplande_tijd runs T0 -> T0+2h
    // for legs 1->2, so the "expected" moment for km 5 is T0 + 1h — this fix
    // lands there at T0 + 1.5h, 30 minutes behind that.
    const now = T0 + 90 * 60 * 1000;
    const history = [fix([0.05, 0], now)];
    const result = computeLiveTrackProgress(legs, legSegments, effortLegs, history, now);
    expect(result?.scheduleDelta).not.toBeNull();
    expect(result!.scheduleDelta!.minutes).toBeCloseTo(30, 0);
    expect(result!.scheduleDelta!.band).toBe("achter");
  });

  it("has no arrival forecast with fewer than 3 observed pace samples", () => {
    const history = [fix([0, 0], T0), fix([0.05, 0], T0 + 30 * 60 * 1000)];
    const now = T0 + 30 * 60 * 1000;
    const result = computeLiveTrackProgress(legs, legSegments, effortLegs, history, now);
    expect(result?.arrivalForecast).toBeNull();
  });

  it("resamples a plausible arrival range once there are enough observed paces", () => {
    // Four fixes, three intervals (== FORECAST_MIN_SAMPLES), each covering
    // 5km in 20 minutes -- a steady 15 km/h, so every bootstrap trial should
    // land on exactly the same total, not just a plausible-looking range.
    const history = [
      fix([0, 0], T0),
      fix([0.05, 0], T0 + 20 * 60 * 1000),
      fix([0.1, 0], T0 + 40 * 60 * 1000),
      fix([0.15, 0], T0 + 60 * 60 * 1000), // km 15 of 20 -- 5km still remaining
    ];
    const now = T0 + 60 * 60 * 1000;
    const result = computeLiveTrackProgress(legs, legSegments, effortLegs, history, now);
    expect(result?.arrivalForecast).not.toBeNull();
    const forecast = result!.arrivalForecast!;
    expect(forecast.sampleSize).toBe(3);
    // 5km remaining at a steady 15 km/h -> 20 minutes, and since every
    // observed pace was identical, the whole resampled range collapses to
    // that same instant.
    const expected = now + 20 * 60 * 1000;
    expect(forecast.median).toBeCloseTo(expected, -2);
    expect(forecast.earliest).toBeCloseTo(expected, -2);
    expect(forecast.latest).toBeCloseTo(expected, -2);
  });
});

describe("historySinceIso", () => {
  const now = new Date("2026-08-29T12:00:00Z").getTime();

  it("defaults to LIVE_TRACK_HISTORY_WINDOW_MS back from now", () => {
    const expected = new Date(now - LIVE_TRACK_HISTORY_WINDOW_MS).toISOString();
    expect(historySinceIso(now)).toBe(expected);
  });

  it("uses a wider window when one is passed explicitly", () => {
    const wideWindowMs = 24 * 60 * 60 * 1000;
    const wide = new Date(historySinceIso(now, wideWindowMs)).getTime();
    const narrow = new Date(historySinceIso(now)).getTime();
    expect(wide).toBeLessThan(narrow);
  });
});

describe("parseHistoryWindowMs", () => {
  it("returns undefined for a missing param", () => {
    expect(parseHistoryWindowMs(null)).toBeUndefined();
  });

  it("returns undefined for a non-numeric param", () => {
    expect(parseHistoryWindowMs("not-a-number")).toBeUndefined();
  });

  it("returns undefined for a zero or negative param", () => {
    expect(parseHistoryWindowMs("0")).toBeUndefined();
    expect(parseHistoryWindowMs("-5")).toBeUndefined();
  });

  it("converts a valid hour count to milliseconds", () => {
    expect(parseHistoryWindowMs("2")).toBe(2 * 60 * 60 * 1000);
  });

  it("clamps an excessive hour count to the 48h maximum", () => {
    expect(parseHistoryWindowMs("1000")).toBe(48 * 60 * 60 * 1000);
  });
});
