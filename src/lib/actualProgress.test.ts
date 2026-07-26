import { describe, expect, it } from "vitest";
import { estimateLegArrivals, firstCheckinByLeg, firstCheckinTimesByLeg } from "./actualProgress";
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
