import { ImageResponse } from "next/og";

// Shared by app/icon-192/route.tsx and app/icon-512/route.tsx — the manifest
// (app/manifest.ts) needs real raster PNGs at standard PWA sizes for the
// install icon/splash screen, which app/icon.svg alone doesn't cover on
// every platform. Re-draws the exact same shape as icon.svg (a solid circle
// with a smaller white circle centered inside) at whatever size is asked
// for, rather than trying to rasterize the SVG file itself.
const BRAND_BLUE = "#2a78d6";

export function renderAppIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_BLUE,
          borderRadius: "50%",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "44%",
            height: "44%",
            borderRadius: "50%",
            background: "#ffffff",
          }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
