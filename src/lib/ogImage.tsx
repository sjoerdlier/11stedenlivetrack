import { ImageResponse } from "next/og";

// Shared between app/opengraph-image.tsx and app/twitter-image.tsx so both
// social preview cards render identically without duplicating the JSX/config
// — see socialMetadata() in routes.ts for the text metadata these
// accompany.
export const OG_IMAGE_ALT = "Lowie loopt de 11Stedentocht — Live Track";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_CONTENT_TYPE = "image/png";

// Same brand blue as STATUS_COLORS.bezig in status.ts and the topbar's
// active/accent color — keep this in sync if that ever changes.
const BRAND_BLUE = "#2a78d6";

export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fcfcfb",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 96,
            background: BRAND_BLUE,
            marginBottom: 40,
          }}
        >
          <div style={{ display: "flex", fontSize: 52 }}>📍</div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 88,
            fontWeight: 700,
            color: "#161615",
            letterSpacing: -2,
          }}
        >
          Lowie
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 600,
              color: BRAND_BLUE,
            }}
          >
            11Stedentocht
          </div>
          <div style={{ display: "flex", fontSize: 40, color: "#9c9b93" }}>
            · Live Track
          </div>
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );
}
