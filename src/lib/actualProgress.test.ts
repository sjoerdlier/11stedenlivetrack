import { describe, expect, it } from "vitest";
import {
  currentScheduleDelta,
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
