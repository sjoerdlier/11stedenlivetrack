import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
    { media: "(prefers-color-scheme: light)", color: "#fcfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#161615" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
