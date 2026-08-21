import { ROUTES, type RouteSlug } from "./routes";

export interface PartyConfig {
  slug: string;
  label: string;
  color: string;
}

// Most routes have exactly one implicit party — everyone who checks in
// shares the same timeline. A route that's shared by more than one
// independent group (see git history for the KAT100 routes, removed after
// that race weekend ended) adds an entry with more than one party here.
//
// "11steden" is run by two people, each with their own check-ins/live
// position but sharing the same schedule (`legs`) — Lowie van Eck and
// Björn van Loon run the Elfstedentocht blindfolded together for OOG voor
// Maja / het Oogfonds. `team` is kept as the existing party slug (real
// check-in rows in Supabase already use it) rather than renamed to
// `lowie`, which would silently orphan that data.
export const PARTIES_BY_ROUTE: Record<RouteSlug, PartyConfig[]> = {
  "11steden": [
    { slug: "team", label: "Lowie", color: "#c9498b" },
    { slug: "bjorn", label: "Björn", color: "#3a9188" },
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

// The settings.ts key a party's Garmin LiveTrack link is stored under —
// derived rather than a separate config field, so a new party in
// PARTIES_BY_ROUTE gets a working /beheer field with no other changes.
export function garminUrlSettingKey(route: RouteSlug, partySlug: string): string {
  return `garmin_url__${route}__${partySlug}`;
}

// The settings.ts key a party's live-tracking bearer token is stored
// under — set via /beheer, checked by /api/live on every incoming GPS
// update from that party's own tracker app. No default: a party with no
// token set here has live tracking closed, not open with a guessable key.
export function liveTokenSettingKey(route: RouteSlug, partySlug: string): string {
  return `live_token__${route}__${partySlug}`;
}

// Every (route, party) pair that exists — the set /beheer's Garmin-link
// form renders one field for, and page.tsx looks a link up from.
export function allRouteParties(): { route: RouteSlug; party: PartyConfig }[] {
  return ROUTES.flatMap((r) => partiesForRoute(r.slug).map((party) => ({ route: r.slug, party })));
}

// A stable key for "this (route, party) pair's tracker status" — shared
// between /beheer's server component (which loads the initial snapshot) and
// TrackerStatus (the client component that polls for fresh ones), so both
// sides address the same row the same way.
export function trackerStatusKey(route: RouteSlug, partySlug: string): string {
  return `${route}:${partySlug}`;
}
