import { describe, expect, it } from "vitest";
import { parsePartySlug, partiesForRoute, partyConfig } from "./parties";

describe("partiesForRoute", () => {
  it("has exactly one implicit party for 11steden", () => {
    expect(partiesForRoute("11steden")).toHaveLength(1);
  });

  it("has two independent parties for kat100", () => {
    expect(partiesForRoute("kat100").map((p) => p.slug)).toEqual(["sjoerd-lowie", "bjorn-sander"]);
  });
});

describe("parsePartySlug", () => {
  it("accepts a known party slug for the route", () => {
    expect(parsePartySlug("kat100", "bjorn-sander")).toBe("bjorn-sander");
  });

  it("falls back to the route's first party for an unknown slug", () => {
    expect(parsePartySlug("kat100", "does-not-exist")).toBe("sjoerd-lowie");
  });

  it("falls back for a slug that belongs to a different route", () => {
    expect(parsePartySlug("11steden", "bjorn-sander")).toBe("team");
  });

  it("falls back when missing entirely", () => {
    expect(parsePartySlug("kat100", undefined)).toBe("sjoerd-lowie");
  });
});

describe("partyConfig", () => {
  it("returns the matching config", () => {
    expect(partyConfig("kat100", "bjorn-sander").label).toBe("Björn & Sander");
  });

  it("falls back to the first party for an unknown slug", () => {
    expect(partyConfig("kat100", "does-not-exist").slug).toBe("sjoerd-lowie");
  });
});
