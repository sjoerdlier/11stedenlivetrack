import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "11Stedentocht Live Track",
  description: "Kaart van de 11Stedentocht wandelroute (204 km)",
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
    <html lang="nl" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
