import { describe, expect, it } from "vitest";
import { firstCheckinByLeg, firstCheckinTimesByLeg } from "./actualProgress";
import type { Checkin } from "./checkins";

function makeCheckin(overrides: Partial<Checkin>): Checkin {
  return {
    tijdstip: "2026-08-08T07:00:00Z",
    leg_nr: 1,
    lat: null,
    lon: null,
    notitie: null,
    invoerder: "Test",
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
