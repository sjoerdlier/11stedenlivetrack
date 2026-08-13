import type { MetadataRoute } from "next";

// Same production-URL fallback pattern as layout.tsx's metadataBase/robots.ts
// — see those files for why.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://11stedenlivetrack.vercel.app";

// Only the two public, indexable routes — /beheer and /invoer are PIN-gated
// admin tools (kept out via per-page `robots: { index: false }` instead) and
// don't belong in a sitemap either.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/schema`,
      changeFrequency: "daily",
      priority: 0.5,
    },
  ];
}
