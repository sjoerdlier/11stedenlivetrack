import { describe, expect, it } from "vitest";
import {
  actualAveragePaceKmh,
  computeActualProgress,
  currentScheduleDelta,
  estimateArrivalForecast,
  estimateInterpolatedProgress,
  estimateLegArrivals,
  estimateLegArrivalWindows,
  firstCheckinByLeg,
  firstCheckinTimesByLeg,
  scheduleDeltaForLeg,
} from "./actualProgress";
import type { Checkin } from "./checkins";
import type { Leg } from "./legs";

function makeCheckin(overrides: Partial<Checkin>): Checkin {
  return {
    party: "team",
    tijdstip: "2026-08-08T07:00:00Z",
    leg_nr: 1,
    lat: null,
    lon: null,
    notitie: null,
    invoerder: "Test",
    ...overrides,
  };
}

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

describe("firstCheckinByLeg", () => {
  it("keeps the earliest check-in per leg, note included", () => {
    const checkins: Checkin[] = [
      makeCheckin({ leg_nr: 1, tijdstip: "2026-08-08T09:00:00Z", notitie: "later, moet niet winnen" }),
      makeCheckin({ leg_nr: 1, tijdstip: "2026-08-08T07:00:00Z", notitie: "eerste keer hier" }),
    ];
    const byLeg = firstCheckinByLeg(checkins);
    expect(byLeg.get(1)?.notitie).toBe("eerste keer hier");
  });

  it("ignores check-ins with an unparseable tijdstip", () => {
    const checkins: Checkin[] = [makeCheckin({ leg_nr: 1, tijdstip: "niet-een-datum" })];
    expect(firstCheckinByLeg(checkins).size).toBe(0);
  });
});

describe("firstCheckinTimesByLeg", () => {
  it("matches the tijdstip of whichever check-in firstCheckinByLeg picks", () => {
    const checkins: Checkin[] = [
      makeCheckin({ leg_nr: 2, tijdstip: "2026-08-08T10:00:00Z" }),
      makeCheckin({ leg_nr: 2, tijdstip: "2026-08-08T08:00:00Z" }),
    ];
    const times = firstCheckinTimesByLeg(checkins);
    expect(times.get(2)).toBe(new Date("2026-08-08T08:00:00Z").getTime());
  });
});

describe("computeActualProgress", () => {
  const legs: Leg[] = [
    makeLeg({ nr: 1, afstand_km: 10, cumulatief_start_km: 0 }),
    makeLeg({ nr: 2, afstand_km: 10, cumulatief_start_km: 10 }),
    makeLeg({ nr: 3, afstand_km: 10, cumulatief_start_km: 20 }),
    makeLeg({ nr: 4, afstand_km: 10, cumulatief_start_km: 30 }),
    makeLeg({ nr: 5, afstand_km: 0, cumulatief_start_km: 40 }),
  ];

  it("is 0 with no check-ins", () => {
    expect(computeActualProgress(legs, new Map()).km).toBe(0);
  });

  it("credits the full unbroken chain up to the last checked-in leg", () => {
    const checkinTimes = new Map([[1, 0], [2, 0], [3, 0]]);
    expect(computeActualProgress(legs, checkinTimes).km).toBe(20);
  });

  // The actual bug this replaced: check-ins in this event don't land on
  // every leg boundary in order -- someone gets checked in wherever a
  // screenshot happens to place them (leg 4 here), with legs 2-3 never
  // individually logged. The old sum-consecutive-hops version credited 0 km
  // for this (no leg's "next" was ever checked in), which is exactly the
  // "23,3 km van 202" bug reported live during the event.
  it("still credits the walker's real distance when earlier legs were never individually checked in", () => {
    const checkinTimes = new Map([[4, 0]]);
    expect(computeActualProgress(legs, checkinTimes).km).toBe(30);
  });

  it("uses the furthest checked-in leg, not the most recently added one", () => {
    const checkinTimes = new Map([[4, 0], [2, 0]]);
    expect(computeActualProgress(legs, checkinTimes).km).toBe(30);
  });
});

describe("actualAveragePaceKmh", () => {
  const legs: Leg[] = [
    makeLeg({ nr: 1, afstand_km: 10, cumulatief_start_km: 0 }),
    makeLeg({ nr: 2, afstand_km: 10, cumulatief_start_km: 10 }),
    makeLeg({ nr: 3, afstand_km: 10, cumulatief_start_km: 20 }),
  ];
  const H = 60 * 60 * 1000;

  it("is null with no check-ins", () => {
    expect(actualAveragePaceKmh(legs, new Map(), 20, H)).toBeNull();
  });

  // The actual bug this replaced, reproduced at the same scale as the live
  // event: check-ins start at leg 2 (already 10km "for free" -- walked
  // before anyone started tracking), then leg 3 lands an hour later at 20km
  // total. The old version divided the *full* 20km by the 1h since the
  // first check-in -> 20 km/u, wildly overstating the real pace. Only the
  // 10km covered *since* that first check-in should count.
  it("only counts distance covered since the first check-in, not the route's full afgelegdKm", () => {
    const checkinTimes = new Map([[2, 0], [3, H]]);
    expect(actualAveragePaceKmh(legs, checkinTimes, 20, H)).toBe(10);
  });

  it("matches the naive calculation when check-ins start at the very first leg", () => {
    const checkinTimes = new Map([[1, 0], [2, H]]);
    expect(actualAveragePaceKmh(legs, checkinTimes, 10, H)).toBe(10);
  });
});

describe("estimateInterpolatedProgress", () => {
  const legs: Leg[] = [
    makeLeg({ nr: 1, afstand_km: 10, cumulatief_start_km: 0 }),
    makeLeg({ nr: 2, afstand_km: 10, cumulatief_start_km: 10 }),
    makeLeg({ nr: 3, afstand_km: 0, cumulatief_start_km: 20 }),
  ];
  const H = 60 * 60 * 1000;

  it("falls back to the raw check-in km without a usable pace", () => {
    const checkinTimes = new Map([[1, 0]]);
    expect(estimateInterpolatedProgress(legs, checkinTimes, H, null).km).toBe(0);
    expect(estimateInterpolatedProgress(legs, checkinTimes, H, 0).km).toBe(0);
  });

  it("advances forward from the last check-in at the given pace", () => {
    // Checked in at leg 1 (km 0) at t=0; leg 1 is 10km. At 10 km/u, half an
    // hour in should read as 5km further along.
    const checkinTimes = new Map([[1, 0]]);
    const progress = estimateInterpolatedProgress(legs, checkinTimes, 0.5 * H, 10);
    expect(progress.km).toBe(5);
  });

  it("never advances past the current leg's own end", () => {
    // Same setup, but 3 hours in (leg 1 would only take 1h at 10 km/u) --
    // caps at leg 2's cumulatief_start_km (10), doesn't run off toward leg 3.
    const checkinTimes = new Map([[1, 0]]);
    const progress = estimateInterpolatedProgress(legs, checkinTimes, 3 * H, 10);
    expect(progress.km).toBe(10);
  });

  it("returns the exact check-in km once the finish leg itself is reached", () => {
    const checkinTimes = new Map([[1, 0], [2, H], [3, 2 * H]]);
    const progress = estimateInterpolatedProgress(legs, checkinTimes, 5 * H, 10);
    expect(progress.km).toBe(20);
  });

  it("never regresses below the real check-in km", () => {
    // Pathological case shouldn't be reachable in practice (paceKmh > 0 is
    // required to enter the interpolation branch at all), but the km floor
    // is a deliberate belt-and-braces guard -- assert it holds regardless.
    const checkinTimes = new Map([[2, 0]]);
    const progress = estimateInterpolatedProgress(legs, checkinTimes, H, 0.0001);
    expect(progress.km).toBeGreaterThanOrEqual(10);
  });
});

describe("estimateLegArrivals", () => {
  const legs: Leg[] = [
    makeLeg({ nr: 1, afstand_km: 10, cumulatief_start_km: 0 }),
    makeLeg({ nr: 2, afstand_km: 10, cumulatief_start_km: 10 }),
    makeLeg({ nr: 3, afstand_km: 0, cumulatief_start_km: 20 }),
  ];

  it("is empty with fewer than 2 check-ins — not enough for a trustworthy pace", () => {
    const checkinTimes = new Map([[1, 0]]);
    expect(estimateLegArrivals(legs, checkinTimes, 60 * 60 * 1000).size).toBe(0);
  });

  it("projects an arrival for each leg not yet reached, at the actual pace", () => {
    // Leg 1 at t=0, leg 2 at t=1h -> 10km in 1h = 10 km/u actual pace.
    const checkinTimes = new Map([[1, 0], [2, 60 * 60 * 1000]]);
    const now = 60 * 60 * 1000;
    const arrivals = estimateLegArrivals(legs, checkinTimes, now);

    expect(arrivals.has(1)).toBe(false);
    expect(arrivals.has(2)).toBe(false); // already reached
    // Leg 3 is 10km further (cumulatief 20 vs progress 10) at 10 km/u = 1h.
    expect(arrivals.get(3)).toBe(now + 60 * 60 * 1000);
  });
});

describe("estimateLegArrivalWindows", () => {
  const legs: Leg[] = [
    makeLeg({ nr: 1, afstand_km: 10, cumulatief_start_km: 0 }),
    makeLeg({ nr: 2, afstand_km: 10, cumulatief_start_km: 10 }),
    makeLeg({ nr: 3, afstand_km: 0, cumulatief_start_km: 20 }),
  ];

  it("is empty with fewer than 2 check-ins", () => {
    const checkinTimes = new Map([[1, 0]]);
    expect(estimateLegArrivalWindows(legs, checkinTimes, 60 * 60 * 1000).size).toBe(0);
  });

  it("widens the single-pace estimate into an earliest/latest window", () => {
    // Leg 1 at t=0, leg 2 at t=1h -> 10 km/u actual pace.
    const checkinTimes = new Map([[1, 0], [2, 60 * 60 * 1000]]);
    const now = 60 * 60 * 1000;
    const windows = estimateLegArrivalWindows(legs, checkinTimes, now, 0.1);
    const window = windows.get(3);
    expect(window).toBeDefined();
    // 10km remaining. Fast pace (11 km/u) arrives sooner than slow (9 km/u).
    expect(window!.earliest).toBeLessThan(window!.latest);
    expect(window!.earliest).toBeCloseTo(now + (10 / 11) * 60 * 60 * 1000, 0);
    expect(window!.latest).toBeCloseTo(now + (10 / 9) * 60 * 60 * 1000, 0);
  });
});

describe("estimateArrivalForecast", () => {
  // 6 legs, each 10km. Check-ins on legs 1-4 give 3 completed hops (nr1->2,
  // 2->3, 3->4) to resample from; legs 4->5 and 5->6 (20km) remain.
  const legs: Leg[] = [
    makeLeg({ nr: 1, afstand_km: 10, cumulatief_start_km: 0 }),
    makeLeg({ nr: 2, afstand_km: 10, cumulatief_start_km: 10 }),
    makeLeg({ nr: 3, afstand_km: 10, cumulatief_start_km: 20 }),
    makeLeg({ nr: 4, afstand_km: 10, cumulatief_start_km: 30 }),
    makeLeg({ nr: 5, afstand_km: 10, cumulatief_start_km: 40 }),
    makeLeg({ nr: 6, afstand_km: 0, cumulatief_start_km: 50 }),
  ];
  const H = 60 * 60 * 1000;

  it("is null with fewer than 3 completed hops", () => {
    const checkinTimes = new Map([[1, 0], [2, H]]);
    expect(estimateArrivalForecast(legs, checkinTimes, H)).toBeNull();
  });

  it("is null once every leg has already been reached (nothing left to forecast)", () => {
    const checkinTimes = new Map([[1, 0], [2, H], [3, 2 * H], [4, 3 * H], [5, 4 * H], [6, 5 * H]]);
    expect(estimateArrivalForecast(legs, checkinTimes, 5 * H)).toBeNull();
  });

  it("collapses to a tight range when every observed pace has been identical", () => {
    // 10km per hop each hour -> a steady 10 km/u for every resampled trial.
    const checkinTimes = new Map([[1, 0], [2, H], [3, 2 * H], [4, 3 * H]]);
    const now = 3 * H;
    const forecast = estimateArrivalForecast(legs, checkinTimes, now);
    expect(forecast).not.toBeNull();
    expect(forecast!.sampleSize).toBe(3);
    // 20km remaining at a guaranteed 10 km/u = exactly 2h from now.
    const expected = now + 2 * H;
    expect(forecast!.earliest).toBe(expected);
    expect(forecast!.median).toBe(expected);
    expect(forecast!.latest).toBe(expected);
  });

  it("widens the range when observed paces have varied a lot", () => {
    // Hops at 10, 5, and 20 km/u — a real spread to resample from.
    const checkinTimes = new Map([[1, 0], [2, H], [3, H + 2 * H], [4, H + 2 * H + 0.5 * H]]);
    const now = H + 2 * H + 0.5 * H;
    const forecast = estimateArrivalForecast(legs, checkinTimes, now);
    expect(forecast).not.toBeNull();
    expect(forecast!.earliest).toBeLessThan(forecast!.median);
    expect(forecast!.median).toBeLessThan(forecast!.latest);
  });

  it("doesn't resample legs before wherever check-ins actually started", () => {
    // Check-ins land on legs 3-6 only (legs 1-2 never individually logged,
    // same gap as computeActualProgress's regression case). Once leg 6 (the
    // last leg, 0km of its own) is reached, nothing should remain to
    // forecast -- if legs 1-2 were wrongly still counted as "ahead", this
    // would return a forecast instead of null.
    const checkinTimes = new Map([[3, 0], [4, H], [5, 2 * H], [6, 3 * H]]);
    expect(estimateArrivalForecast(legs, checkinTimes, 3 * H)).toBeNull();
  });

  it("is deterministic for the same check-in data — no flicker on a plain refresh", () => {
    const checkinTimes = new Map([[1, 0], [2, H], [3, H + 2 * H], [4, H + 2 * H + 0.5 * H]]);
    const now = H + 2 * H + 0.5 * H;
    const first = estimateArrivalForecast(legs, checkinTimes, now);
    const second = estimateArrivalForecast(legs, checkinTimes, now);
    expect(second).toEqual(first);
  });
});

describe("scheduleDeltaForLeg", () => {
  it("returns null without a planned or actual time", () => {
    expect(scheduleDeltaForLeg(null, Date.now())).toBeNull();
    expect(scheduleDeltaForLeg("2026-08-08T05:00:00Z", null)).toBeNull();
  });

  it("bands a late arrival as achter (positive minutes)", () => {
    const delta = scheduleDeltaForLeg(
      "2026-08-08T05:00:00Z",
      new Date("2026-08-08T05:12:00Z").getTime(),
    );
    expect(delta).toEqual({ minutes: 12, band: "achter" });
  });

  it("bands an early arrival as voor (negative minutes)", () => {
    const delta = scheduleDeltaForLeg(
      "2026-08-08T05:00:00Z",
      new Date("2026-08-08T04:50:00Z").getTime(),
    );
    expect(delta).toEqual({ minutes: -10, band: "voor" });
  });

  it("bands a near-exact arrival as op (within the threshold)", () => {
    const delta = scheduleDeltaForLeg(
      "2026-08-08T05:00:00Z",
      new Date("2026-08-08T05:02:00Z").getTime(),
    );
    expect(delta).toEqual({ minutes: 2, band: "op" });
  });
});

describe("currentScheduleDelta", () => {
  const legs: Leg[] = [
    makeLeg({ nr: 1, geplande_tijd: "2026-08-08T05:00:00Z" }),
    makeLeg({ nr: 2, geplande_tijd: "2026-08-08T06:00:00Z" }),
  ];

  it("is null with no check-ins", () => {
    expect(currentScheduleDelta(legs, new Map())).toBeNull();
  });

  it("picks the check-in with the latest timestamp, not the highest leg nr", () => {
    // Leg 1's check-in timestamp is *later* than leg 2's here (simulating a
    // late/out-of-order submission) — currentScheduleDelta must still key
    // off leg 1 (the latest timestamp), measured against leg 1's own
    // geplande_tijd (05:00): 06:10 - 05:00 = 70 minutes late.
    const checkinTimes = new Map([
      [2, new Date("2026-08-08T05:55:00Z").getTime()],
      [1, new Date("2026-08-08T06:10:00Z").getTime()],
    ]);
    const delta = currentScheduleDelta(legs, checkinTimes);
    expect(delta).toEqual({ minutes: 70, band: "achter" });
  });
});
