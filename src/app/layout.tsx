import type { Metadata, Viewport } from "next";
import { Big_Shoulders, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// "Vertrekstaat" design system — three faces, one job each:
// display for hero numerals (countdown/progress), sans for UI text, mono
// (tabular figures) as the instrument face for every piece of live data.
// Big Shoulders ships as one variable family (former "Display"/"Text" cuts
// merged into an opsz axis) — the high static weights read as the display cut.
const displayFont = Big_Shoulders({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const sansFont = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Needed to resolve the relative og:image/twitter:image URLs that the
// file-based app/opengraph-image.tsx and app/twitter-image.tsx routes
// produce into absolute ones (required for social platforms to fetch them).
// NEXT_PUBLIC_SITE_URL isn't in .env.example/Vercel yet — falls back to the
// known production URL (see android/README.md's server-URL setup step) so
// this works out of the box; set the env var if that domain ever changes.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://11stedenlivetrack.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "11Stedentocht Live Track",
  description: "Kaart van de 11Stedentocht wandelroute (204 km)",
  twitter: {
    card: "summary_large_image",
  },
};

// Matches TopBar's own light/dark background so the browser chrome (status
// bar on mobile, tab/toolbar color on desktop) blends with the app instead
// of showing the browser's default color.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcf7" },
    { media: "(prefers-color-scheme: dark)", color: "#171b21" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
