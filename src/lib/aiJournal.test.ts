import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPartySnapshot, buildPrompt, generateJournalText, stripMarkdown, type JournalInput } from "./aiJournal";
import type { Checkin } from "./checkins";
import type { Leg } from "./legs";
import type { PartyConfig } from "./parties";

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

const PARTY: PartyConfig = { slug: "team", label: "Lowie", color: "#c9498b" };

const LEGS: Leg[] = [
  makeLeg({ nr: 1, start_plaats: "Leeuwarden", afstand_km: 20, cumulatief_start_km: 0 }),
  makeLeg({ nr: 2, start_plaats: "Sneek", afstand_km: 20, cumulatief_start_km: 20 }),
  makeLeg({ nr: 3, start_plaats: "IJlst", afstand_km: null, loper: null, cumulatief_start_km: 40 }),
];

describe("buildPartySnapshot", () => {
  it("returns null before this party's first check-in", () => {
    expect(buildPartySnapshot(PARTY, LEGS, [], 40, 10, Date.now())).toBeNull();
  });

  it("computes progress/pace from real check-in timestamps", () => {
    const checkins: Checkin[] = [
      makeCheckin({ leg_nr: 2, tijdstip: "2026-08-08T09:00:00Z" }),
    ];
    const now = new Date("2026-08-08T09:00:00Z").getTime();
    const snapshot = buildPartySnapshot(PARTY, LEGS, checkins, 40, 10, now);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.km).toBe(20);
    expect(snapshot?.percent).toBe(50);
    expect(snapshot?.remainingKm).toBe(20);
  });

  it("reads the last-reached and next place name off the leg list", () => {
    const checkins: Checkin[] = [makeCheckin({ leg_nr: 2, tijdstip: "2026-08-08T09:00:00Z" })];
    const snapshot = buildPartySnapshot(PARTY, LEGS, checkins, 40, 10, Date.now());
    expect(snapshot?.currentPlaats).toBe("Sneek");
    expect(snapshot?.nextPlaats).toBe("IJlst");
  });

  it("has no next place once the finish leg itself is reached", () => {
    const checkins: Checkin[] = [makeCheckin({ leg_nr: 3, tijdstip: "2026-08-08T11:00:00Z" })];
    const snapshot = buildPartySnapshot(PARTY, LEGS, checkins, 40, 10, Date.now());
    expect(snapshot?.currentPlaats).toBe("IJlst");
    expect(snapshot?.nextPlaats).toBeNull();
  });

  it("picks the latest note among this party's check-ins", () => {
    const checkins: Checkin[] = [
      makeCheckin({ leg_nr: 1, tijdstip: "2026-08-08T07:00:00Z", notitie: "eerste" }),
      makeCheckin({ leg_nr: 2, tijdstip: "2026-08-08T09:00:00Z", notitie: "recentste" }),
    ];
    const snapshot = buildPartySnapshot(PARTY, LEGS, checkins, 40, 10, Date.now());
    expect(snapshot?.lastNote).toBe("recentste");
  });
});

describe("buildPrompt", () => {
  it("mentions the countdown when the tocht hasn't started", () => {
    const input: JournalInput = {
      routeDescription: "11Stedentocht wandelroute",
      countdownDays: 3,
      parties: [{ party: PARTY, snapshot: null }],
      weather: null,
    };
    const prompt = buildPrompt(input);
    expect(prompt).toContain("nog 3 dagen tot de start");
  });

  it("instructs explaining what the update does once the tocht has started, only pre-start", () => {
    const preStart = buildPrompt({
      routeDescription: "11Stedentocht wandelroute",
      countdownDays: 3,
      parties: [{ party: PARTY, snapshot: null }],
      weather: null,
    });
    expect(preStart).toContain("Leg kort uit wat deze update doet");

    const duringTocht = buildPrompt({
      routeDescription: "11Stedentocht wandelroute",
      countdownDays: null,
      parties: [
        {
          party: PARTY,
          snapshot: {
            label: "Lowie",
            percent: 50,
            km: 20,
            remainingKm: 20,
            paceKmh: null,
            scheduleDelta: null,
            arrival: null,
            arrivalForecast: null,
            lastNote: null,
            currentPlaats: "Sneek",
            nextPlaats: "IJlst",
          },
        },
      ],
      weather: null,
    });
    expect(duringTocht).not.toContain("Leg kort uit wat deze update doet");
  });

  it("includes only the facts actually present, never a placeholder for missing ones", () => {
    const input: JournalInput = {
      routeDescription: "11Stedentocht wandelroute",
      countdownDays: null,
      parties: [
        {
          party: PARTY,
          snapshot: {
            label: "Lowie",
            percent: 50,
            km: 20,
            remainingKm: 20,
            paceKmh: null,
            scheduleDelta: null,
            arrival: null,
            arrivalForecast: null,
            lastNote: null,
            currentPlaats: null,
            nextPlaats: null,
          },
        },
      ],
      weather: null,
    };
    const prompt = buildPrompt(input);
    expect(prompt).toContain("Lowie: 20,0 km afgelegd (50% van de route), nog 20,0 km te gaan.");
    // No pace/schedule/arrival/note/place facts were given — none of those
    // lines should appear, since inventing a plausible-sounding one would
    // be exactly the kind of hallucination this prompt exists to prevent.
    expect(prompt).not.toContain("tempo");
    expect(prompt).not.toContain("schema");
    expect(prompt).not.toContain("aankomst");
    expect(prompt).not.toContain("notitie");
    expect(prompt).not.toContain("Lowie is onderweg");
    expect(prompt).not.toContain("Lowie heeft de finish");
  });

  it("describes position by place name, not just a bare percentage", () => {
    const input: JournalInput = {
      routeDescription: "11Stedentocht wandelroute",
      countdownDays: null,
      parties: [
        {
          party: PARTY,
          snapshot: {
            label: "Lowie",
            percent: 50,
            km: 20,
            remainingKm: 20,
            paceKmh: null,
            scheduleDelta: null,
            arrival: null,
            arrivalForecast: null,
            lastNote: null,
            currentPlaats: "Sneek",
            nextPlaats: "IJlst",
          },
        },
      ],
      weather: null,
    };
    expect(buildPrompt(input)).toContain("Lowie is onderweg van Sneek naar IJlst.");
  });

  it("phrases the arrival as a range when a forecast is present, instead of one instant", () => {
    const input: JournalInput = {
      routeDescription: "11Stedentocht wandelroute",
      countdownDays: null,
      parties: [
        {
          party: PARTY,
          snapshot: {
            label: "Lowie",
            percent: 50,
            km: 20,
            remainingKm: 20,
            paceKmh: null,
            scheduleDelta: null,
            arrival: { time: new Date("2026-08-08T18:45:00Z").getTime(), basis: "actueel" },
            arrivalForecast: {
              earliest: new Date("2026-08-08T18:20:00Z").getTime(),
              median: new Date("2026-08-08T18:45:00Z").getTime(),
              latest: new Date("2026-08-08T19:15:00Z").getTime(),
              sampleSize: 5,
            },
            lastNote: null,
            currentPlaats: null,
            nextPlaats: null,
          },
        },
      ],
      weather: null,
    };
    const prompt = buildPrompt(input);
    expect(prompt).toContain("ergens tussen 20:20 en 21:15");
  });

  it("instructs the model to avoid hype language and AI-sounding phrasing", () => {
    const input: JournalInput = {
      routeDescription: "11Stedentocht wandelroute",
      countdownDays: null,
      parties: [],
      weather: null,
    };
    const prompt = buildPrompt(input);
    expect(prompt).toContain("indrukwekkend");
    expect(prompt).toContain("AI-gegenereerd");
  });

  it("instructs the model to only use the given facts", () => {
    const input: JournalInput = {
      routeDescription: "11Stedentocht wandelroute",
      countdownDays: null,
      parties: [],
      weather: null,
    };
    expect(buildPrompt(input)).toContain("UITSLUITEND de feiten hieronder");
  });
});

describe("stripMarkdown", () => {
  it("drops a leading markdown heading line entirely", () => {
    expect(stripMarkdown("# Update 11Stedentocht\n\nLowie loopt goed.")).toBe("Lowie loopt goed.");
  });

  it("unwraps bold and italic markers without dropping the text", () => {
    expect(stripMarkdown("Lowie loopt **goed** en *snel*.")).toBe("Lowie loopt goed en snel.");
  });

  it("strips leading bullet markers", () => {
    expect(stripMarkdown("- Lowie loopt goed.\n- Björn ook.")).toBe("Lowie loopt goed. Björn ook.");
  });

  it("collapses multiple paragraphs into one flowing block of text", () => {
    expect(stripMarkdown("Eerste alinea.\n\nTweede alinea.")).toBe("Eerste alinea. Tweede alinea.");
  });

  it("leaves already-plain text untouched", () => {
    expect(stripMarkdown("Lowie loopt nu richting Sneek.")).toBe("Lowie loopt nu richting Sneek.");
  });
});

describe("generateJournalText", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
    vi.unstubAllEnvs();
  });

  it("returns null without ever calling the API when no key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const input: JournalInput = {
      routeDescription: "11Stedentocht wandelroute",
      countdownDays: null,
      parties: [],
      weather: null,
    };
    await expect(generateJournalText(input)).resolves.toBeNull();
  });
});
