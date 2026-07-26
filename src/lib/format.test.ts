import { describe, expect, it } from "vitest";
import { formatGeplandeTijd, formatPaceKmh } from "./format";

describe("formatGeplandeTijd", () => {
  // Regression guard for the timezone bug found in the quality audit: a
  // timestamptz value always carries an explicit UTC offset, so it must
  // render as the correct Europe/Amsterdam wall-clock time regardless of
  // what timezone the server process itself runs in. 05:00 UTC is 07:00
  // CEST (summer, UTC+2) — the exact case that was silently rendering as
  // 09:00 when the column was still a timezone-naive `timestamp`.
  it("converts a UTC instant to Europe/Amsterdam wall-clock time (CEST, summer)", () => {
    expect(formatGeplandeTijd("2026-08-08T05:00:00Z")).toBe("za 07:00");
  });

  it("converts a UTC instant to Europe/Amsterdam wall-clock time (CET, winter)", () => {
    expect(formatGeplandeTijd("2026-01-10T06:00:00Z")).toBe("za 07:00");
  });

  it("returns null for a missing value", () => {
    expect(formatGeplandeTijd(null)).toBeNull();
    expect(formatGeplandeTijd(undefined)).toBeNull();
  });

  it("falls back to the raw string for an unparseable value instead of crashing", () => {
    expect(formatGeplandeTijd("niet-een-datum")).toBe("niet-een-datum");
  });
});

describe("formatPaceKmh", () => {
  it("formats with one decimal, nl-NL comma", () => {
    expect(formatPaceKmh(6.34)).toBe("6,3 km/u");
  });

  it("returns null for null/non-finite input", () => {
    expect(formatPaceKmh(null)).toBeNull();
    expect(formatPaceKmh(Infinity)).toBeNull();
  });
});
