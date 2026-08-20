import { describe, expect, it } from "vitest";
import { groupLegsByDay } from "./scheduleDays";
import type { Leg } from "./legs";

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

describe("groupLegsByDay", () => {
  it("keeps same-calendar-day legs (Europe/Amsterdam) in one group", () => {
    // 2026-08-29 05:00 UTC = 07:00 CEST (still Saturday); 21:00 UTC = 23:00
    // CEST (still Saturday too) — both must land in the same group.
    const legs: Leg[] = [
      makeLeg({ nr: 1, geplande_tijd: "2026-08-29T05:00:00Z" }),
      makeLeg({ nr: 2, geplande_tijd: "2026-08-29T21:00:00Z" }),
    ];
    const groups = groupLegsByDay(legs);
    expect(groups).toHaveLength(1);
    expect(groups[0].legs.map((l) => l.leg.nr)).toEqual([1, 2]);
  });

  it("splits into a new group across a CEST midnight boundary, carrying original indices", () => {
    // 2026-08-29 22:45 UTC = Sunday 00:45 CEST — already the next day in
    // Europe/Amsterdam even though the UTC date is still the 29th. Regression
    // guard for the exact bug class formatGeplandeTijd's own tests target.
    const legs: Leg[] = [
      makeLeg({ nr: 1, geplande_tijd: "2026-08-29T05:00:00Z" }),
      makeLeg({ nr: 2, geplande_tijd: "2026-08-29T22:45:00Z" }),
      makeLeg({ nr: 3, geplande_tijd: "2026-08-30T01:45:00Z" }),
    ];
    const groups = groupLegsByDay(legs);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Zaterdag 29 augustus");
    expect(groups[0].legs).toEqual([{ leg: legs[0], index: 0 }]);
    expect(groups[1].label).toBe("Zondag 30 augustus");
    expect(groups[1].legs).toEqual([
      { leg: legs[1], index: 1 },
      { leg: legs[2], index: 2 },
    ]);
  });

  it("buckets legs with no geplande_tijd into a separate 'onbekend' group instead of crashing", () => {
    const legs: Leg[] = [
      makeLeg({ nr: 1, geplande_tijd: null }),
      makeLeg({ nr: 2, geplande_tijd: "2026-08-29T05:00:00Z" }),
    ];
    const groups = groupLegsByDay(legs);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("onbekend");
    expect(groups[0].label).toBe("Onbekende datum");
  });
});
