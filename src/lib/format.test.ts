import { describe, expect, it } from "vitest";
import { formatGeplandeTijd, formatPaceKmh, formatRelativeTime, formatTimeOnly } from "./format";

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

describe("formatTimeOnly", () => {
  it("converts a UTC instant to Europe/Amsterdam wall-clock time, no weekday", () => {
    expect(formatTimeOnly(new Date("2026-08-08T05:00:00Z").getTime())).toBe("07:00");
  });

  it("returns null for non-finite input", () => {
    expect(formatTimeOnly(NaN)).toBeNull();
    expect(formatTimeOnly(Infinity)).toBeNull();
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

describe("formatRelativeTime", () => {
  it("reads as 'zojuist' under 10 seconds", () => {
    expect(formatRelativeTime(1000, 1000)).toBe("zojuist");
    expect(formatRelativeTime(1000, 9500)).toBe("zojuist");
  });

  it("counts in seconds under a minute", () => {
    expect(formatRelativeTime(0, 45_000)).toBe("45s geleden");
  });

  it("switches to minutes, correctly pluralized", () => {
    expect(formatRelativeTime(0, 60_000)).toBe("1 minuut geleden");
    expect(formatRelativeTime(0, 3 * 60_000)).toBe("3 minuten geleden");
  });

  it("never goes negative for a clock that ticked before the reference", () => {
    expect(formatRelativeTime(5000, 1000)).toBe("zojuist");
  });
});
