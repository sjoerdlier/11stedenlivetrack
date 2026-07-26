import { describe, expect, it } from "vitest";
import { computeProgress, daysUntilStart, statusForLeg, totalRouteKm } from "./status";
import type { Leg } from "./legs";

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

const legs: Leg[] = [
  makeLeg({ nr: 1, cumulatief_start_km: 0, geplande_tijd: "2026-08-08T07:00:00Z" }),
  makeLeg({ nr: 2, cumulatief_start_km: 10, geplande_tijd: "2026-08-08T09:00:00Z" }),
  makeLeg({ nr: 3, cumulatief_start_km: 25, afstand_km: 0, loper: null, geplande_tijd: "2026-08-08T12:00:00Z" }),
];

describe("statusForLeg", () => {
  it("is nog-te-gaan before its own geplande_tijd", () => {
    const now = new Date("2026-08-08T06:00:00Z").getTime();
    expect(statusForLeg(legs, 0, now)).toBe("nog-te-gaan");
  });

  it("is bezig once its own tijd passed but the next leg's hasn't", () => {
    const now = new Date("2026-08-08T08:00:00Z").getTime();
    expect(statusForLeg(legs, 0, now)).toBe("bezig");
  });

  it("is voltooid once the next leg's tijd passed", () => {
    const now = new Date("2026-08-08T09:30:00Z").getTime();
    expect(statusForLeg(legs, 0, now)).toBe("voltooid");
  });

  it("the last leg can only reach bezig, never voltooid (no next leg to close it out)", () => {
    const wayAfter = new Date("2026-08-09T00:00:00Z").getTime();
    expect(statusForLeg(legs, 2, wayAfter)).toBe("bezig");
  });
});

describe("totalRouteKm", () => {
  it("reads the finish leg's cumulatief_start_km instead of a hardcoded constant", () => {
    expect(totalRouteKm(legs)).toBe(25);
  });

  it("returns 0 for an empty leg list rather than throwing", () => {
    expect(totalRouteKm([])).toBe(0);
  });
});

describe("computeProgress", () => {
  it("uses the last voltooid leg's own cumulatief_start_km as progress", () => {
    const statuses = new Map([
      [1, "voltooid" as const],
      [2, "voltooid" as const],
      [3, "bezig" as const],
    ]);
    const progress = computeProgress(legs, statuses);
    expect(progress.km).toBe(10);
    expect(progress.percent).toBeCloseTo((10 / 25) * 100);
  });
});

describe("daysUntilStart", () => {
  it("rounds up so a same-day start still reads as 1 day", () => {
    const sixHoursBefore = new Date("2026-08-08T01:00:00Z").getTime();
    expect(daysUntilStart(legs, sixHoursBefore)).toBe(1);
  });

  it("returns null once leg 1 has already started", () => {
    const afterStart = new Date("2026-08-08T08:00:00Z").getTime();
    expect(daysUntilStart(legs, afterStart)).toBeNull();
  });
});
