import type { Metadata } from "next";

export type RouteSlug = "11steden" | "kat100";

export interface RouteConfig {
  slug: RouteSlug;
  navLabel: string;
  pageTitle: string;
  gpxFile: string;
  startFinishPlaats: string;
  routeDescription: string;
}

// Order here is also the order the switcher renders in.
export const ROUTES: RouteConfig[] = [
  {
    slug: "11steden",
    navLabel: "11 Steden",
    pageTitle: "Lowie — 11Stedentocht",
    gpxFile: "route.gpx",
    startFinishPlaats: "Leeuwarden",
    routeDescription: "11Stedentocht wandelroute",
  },
  {
    slug: "kat100",
    navLabel: "KAT100",
    pageTitle: "Sjoerd & Lowie — KAT100",
    gpxFile: "kat100.gpx",
    startFinishPlaats: "Fieberbrunn",
    routeDescription: "KAT100 Marathon Trail",
  },
];

export const DEFAULT_ROUTE_SLUG: RouteSlug = "11steden";

export function routeConfig(slug: RouteSlug): RouteConfig {
  return ROUTES.find((r) => r.slug === slug) ?? ROUTES[0];
}

// Query params arrive as string | string[] | undefined; anything that isn't
// a known route slug quietly falls back to the default rather than 404ing.
export function parseRouteSlug(value: string | string[] | undefined): RouteSlug {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "kat100" ? "kat100" : DEFAULT_ROUTE_SLUG;
}

// Shared title + description + Open Graph shape for generateMetadata, so a
// shared link (the topbar's "Delen" button, or the donation ask) gets a real
// preview card on WhatsApp/Twitter/Facebook instead of a bare link — none of
// the three pages had openGraph fields before this.
export function socialMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      locale: "nl_NL",
      type: "website",
    },
  };
}
