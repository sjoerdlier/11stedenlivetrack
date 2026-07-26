import type { RouteSlug } from "./routes";

export interface PartyConfig {
  slug: string;
  label: string;
  color: string;
}

// Most routes have exactly one implicit party — everyone who checks in
// shares the same timeline. KAT100 is the first route two independent
// pairs run at once (Sjoerd & Lowie, Björn & Sander), each needing their
// own progress/pace/notes without the other's check-ins mixed in.
export const PARTIES_BY_ROUTE: Record<RouteSlug, PartyConfig[]> = {
  "11steden": [{ slug: "team", label: "Lowie", color: "#2a78d6" }],
  kat100: [
    { slug: "sjoerd-lowie", label: "Sjoerd & Lowie", color: "#2a78d6" },
    { slug: "bjorn-sander", label: "Björn & Sander", color: "#1baf7a" },
  ],
};

export function partiesForRoute(route: RouteSlug): PartyConfig[] {
  return PARTIES_BY_ROUTE[route];
}

export function partyConfig(route: RouteSlug, slug: string): PartyConfig {
  const parties = PARTIES_BY_ROUTE[route];
  return parties.find((p) => p.slug === slug) ?? parties[0];
}

// Same "quietly fall back to the default" contract as parseRouteSlug —
// an unknown or missing party slug (or one that belonged to a different
// route) resolves to that route's first party rather than 404ing.
export function parsePartySlug(route: RouteSlug, value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  const parties = PARTIES_BY_ROUTE[route];
  return parties.some((p) => p.slug === v) ? (v as string) : parties[0].slug;
}
