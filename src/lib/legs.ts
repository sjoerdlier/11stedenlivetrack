import { getSql } from "./db";
import type { RouteSlug } from "./routes";

export interface Leg {
  nr: number;
  start_plaats: string;
  afstand_km: number | null;
  loper: string | null;
  cumulatief_start_km: number;
  start_lat: number;
  start_lon: number;
  geplande_tijd: string | null;
  cp_nummer: number | null;
  adres: string | null;
  bijzonderheden: string | null;
}

export async function loadLegs(route: RouteSlug): Promise<Leg[]> {
  const sql = getSql();

  try {
    // numeric columns cast to float8: Postgres returns `numeric` as a
    // string by default (to avoid precision loss on huge values), but
    // every caller of loadLegs does arithmetic on these fields expecting
    // real numbers — casting here keeps that contract intact.
    const rows = (await sql`
      select nr, start_plaats, afstand_km::float8 as afstand_km, loper,
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
