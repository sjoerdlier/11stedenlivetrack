import { ImageResponse } from "next/og";

// Shared by app/icon-192/route.tsx and app/icon-512/route.tsx — the manifest
// (app/manifest.ts) needs real raster PNGs at standard PWA sizes for the
// install icon/splash screen, which app/icon.svg alone doesn't cover on
// every platform. Re-draws the exact same mark as icon.svg (two bars reading
// as "11", one lit amber for "live") at whatever size is asked for, rather
// than trying to rasterize the SVG file itself. --db-steel/--db-amber
// (light-mode values, see globals.css) are hardcoded rather than imported —
// this renders server-side via Satori, which can't read CSS custom
// properties, and an install icon doesn't switch with the viewer's theme
// the way in-app UI does.
const STEEL = "#2c5c8a";
const AMBER = "#f5a623";

export function renderAppIcon(size: number) {
  const barWidth = size * (5 / 32);
  const barHeight = size * (16 / 32);
  const barGap = size * (4 / 32);
  const barRadius = barWidth / 2;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: barGap,
          background: STEEL,
          borderRadius: "50%",
        }}
      >
        <div
          style={{
            display: "flex",
            width: barWidth,
            height: barHeight,
            borderRadius: barRadius,
            background: "#ffffff",
          }}
        />
        <div
          style={{
            display: "flex",
            width: barWidth,
            height: barHeight,
            borderRadius: barRadius,
            background: AMBER,
          }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
