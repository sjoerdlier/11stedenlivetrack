import { describe, expect, it } from "vitest";
import { buildElevationProfile } from "./elevation";
import type { LatLng } from "./geo";

describe("buildElevationProfile", () => {
  it("returns [] when there's no elevation data at all", () => {
    const points: LatLng[] = [[0, 0], [0, 1]];
    expect(buildElevationProfile(points, [null, null])).toEqual([]);
  });

  it("returns [] for an empty route", () => {
    expect(buildElevationProfile([], [])).toEqual([]);
  });

  it("computes cumulative distance alongside each elevation", () => {
    const points: LatLng[] = [[0, 0], [0, 1]];
    const profile = buildElevationProfile(points, [100, 200]);
    expect(profile[0]).toEqual({ distanceKm: 0, elevationM: 100 });
    expect(profile[1].elevationM).toBe(200);
    expect(profile[1].distanceKm).toBeGreaterThan(0);
  });

  it("treats a null elevation among real values as 0, not a gap", () => {
    const points: LatLng[] = [[0, 0], [0, 1], [0, 2]];
    const profile = buildElevationProfile(points, [100, null, 300]);
    expect(profile[1].elevationM).toBe(0);
  });

  it("keeps every point when under the max, downsamples when over", () => {
    const points: LatLng[] = Array.from({ length: 10 }, (_, i) => [0, i] as LatLng);
    const elevations = points.map((_, i) => i * 10);

    const full = buildElevationProfile(points, elevations, 20);
    expect(full).toHaveLength(10);

    const sampled = buildElevationProfile(points, elevations, 3);
    expect(sampled.length).toBeLessThan(10);
  });

  it("always keeps the final point so the chart reaches the finish", () => {
    const points: LatLng[] = Array.from({ length: 11 }, (_, i) => [0, i] as LatLng);
    const elevations = points.map((_, i) => i * 10);
    const sampled = buildElevationProfile(points, elevations, 4);
    expect(sampled[sampled.length - 1]).toEqual({
      distanceKm: sampled[sampled.length - 1].distanceKm,
      elevationM: 100,
    });
  });
});
