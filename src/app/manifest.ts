import type { MetadataRoute } from "next";

// Makes the app installable ("Add to Home Screen" / desktop install prompt).
// Colors pulled from the Vertrekstaat design tokens (--db-surface /
// --db-amber, see globals.css) rather than picked fresh, so the install
// icon/splash screen matches the in-app chrome (layout.tsx's `viewport`
// export uses the same light surface color for the browser theme-color).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lowie & Björn — 11Stedentocht",
    short_name: "11 Steden Live Track",
    description: "Live track van Lowie van Eck en Björn van Loon, die de Elfstedentocht geblinddoekt lopen voor OOG voor Maja / het Oogfonds.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdfcf7",
    theme_color: "#fdfcf7",
    lang: "nl",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icon-192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
