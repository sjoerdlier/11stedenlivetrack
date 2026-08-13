import { describe, expect, it } from "vitest";
import { describeWeatherCode, iconForWeatherCode } from "./weather";

describe("describeWeatherCode", () => {
  it("maps a known WMO code to its Dutch phrase", () => {
    expect(describeWeatherCode(0)).toBe("helder");
    expect(describeWeatherCode(61)).toBe("lichte regen");
    expect(describeWeatherCode(95)).toBe("onweer");
  });

  it("falls back to a neutral phrase for an unrecognized code", () => {
    expect(describeWeatherCode(9999)).toBe("wisselend weer");
  });
});

describe("iconForWeatherCode", () => {
  it("distinguishes day/night for clear skies", () => {
    expect(iconForWeatherCode(0, true)).toBe("☀️");
    expect(iconForWeatherCode(0, false)).toBe("🌙");
  });

  it("picks a rain icon for the drizzle/rain/shower range", () => {
    expect(iconForWeatherCode(63, true)).toBe("🌧️");
    expect(iconForWeatherCode(80, true)).toBe("🌧️");
  });

  it("picks a storm icon for thunderstorm codes", () => {
    expect(iconForWeatherCode(95, true)).toBe("⛈️");
    expect(iconForWeatherCode(99, true)).toBe("⛈️");
  });

  it("falls back to a neutral icon for an unrecognized code", () => {
    expect(iconForWeatherCode(9999, true)).toBe("🌤️");
  });
});
