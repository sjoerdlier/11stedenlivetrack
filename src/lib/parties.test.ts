import { describe, expect, it } from "vitest";
import { parsePartySlug, partiesForRoute, partyConfig } from "./parties";

describe("partiesForRoute", () => {
  it("has exactly one implicit party for 11steden", () => {
    expect(partiesForRoute("11steden")).toHaveLength(1);
  });
});

describe("parsePartySlug", () => {
  it("accepts the known party slug for the route", () => {
    expect(parsePartySlug("11steden", "team")).toBe("team");
  });

  it("falls back to the route's first party for an unknown slug", () => {
    expect(parsePartySlug("11steden", "does-not-exist")).toBe("team");
  });

  it("falls back when missing entirely", () => {
    expect(parsePartySlug("11steden", undefined)).toBe("team");
  });
});

describe("partyConfig", () => {
  it("returns the matching config", () => {
    expect(partyConfig("11steden", "team").label).toBe("Lowie");
  });

  it("falls back to the first party for an unknown slug", () => {
    expect(partyConfig("11steden", "does-not-exist").slug).toBe("team");
  });
});
