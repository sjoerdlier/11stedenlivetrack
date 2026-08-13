import type { MetadataRoute } from "next";

// Same production-URL fallback pattern as layout.tsx's metadataBase — see
// that file for why. Duplicated here rather than shared, since robots.ts is
// a standalone Route Handler file (can't import from a "use client"-free
// module tree without its own copy being simplest given each audit-fix PR
// branches independently from the same base commit).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://11stedenlivetrack.vercel.app";

// Deliberately permissive: the two admin pages (/beheer, /invoer) are kept
// out of search results via a per-page `robots: { index: false, follow:
// false }` meta tag instead of a Disallow rule here — a Disallow would stop
// crawlers from ever fetching those pages, so they'd never see the noindex
// tag telling them to drop it from results (and third parties who ignore
// robots.txt would just index them anyway). The public routes (`/`,
// `/schema`) have nothing worth excluding.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
