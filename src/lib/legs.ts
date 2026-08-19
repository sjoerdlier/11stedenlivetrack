import { getSql } from "./db";
import type { RouteSlug } from "./routes";

export interface Leg {
  nr: number;
  start_plaats: string;
  afstand_km: number | null;
  loper: string | null;
  // Björn's own buddy roster for this leg — a second column on the same
  // shared legs table rather than a generic per-party table, matching
  // parties.ts's own "team"/"bjorn" hardcoding for this one two-party
  // route. Can hold more than one name (comma-separated, e.g. "Femke R.,
  // Lorenzo") since Björn sometimes has two buddies on the same stretch —
  // see buddyForLeg's callers for how that gets split into badges.
  loper_bjorn: string | null;
  cumulatief_start_km: number;
  start_lat: number;
  start_lon: number;
  geplande_tijd: string | null;
  cp_nummer: number | null;
  adres: string | null;
  bijzonderheden: string | null;
}

// Resolves which buddy-roster column applies to the party currently being
// viewed. Hardcoded to the "bjorn" slug rather than a generic lookup,
// mirroring parties.ts's own two-party hardcoding for this route — a
// third party sharing this legs table would need its own column and a
// third branch here, same as it would need its own PARTIES_BY_ROUTE entry.
export function buddyForLeg(leg: Leg, partySlug: string): string | null {
  return partySlug === "bjorn" ? leg.loper_bjorn : leg.loper;
}

export async function loadLegs(route: RouteSlug): Promise<Leg[]> {
  const sql = getSql();

  try {
    // numeric columns cast to float8: Postgres returns `numeric` as a
    // string by default (to avoid precision loss on huge values), but
    // every caller of loadLegs does arithmetic on these fields expecting
    // real numbers — casting here keeps that contract intact.
    const rows = (await sql`
      select nr, start_plaats, afstand_km::float8 as afstand_km, loper, loper_bjorn,
             cumulatief_start_km::float8 as cumulatief_start_km,
             start_lat::float8 as start_lat, start_lon::float8 as start_lon,
             geplande_tijd, cp_nummer, adres, bijzonderheden
      from legs
      where route = ${route}
      order by nr asc
    `) as Leg[];
    return rows;
  } catch (err) {
    console.error(`loadLegs(${route}): query failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    throw new Error(`Kon legs niet laden uit de database: ${message}`);
  }
}
