import { getSql } from "./db";
import type { RouteSlug } from "./routes";

export interface NewCheckin {
  route: RouteSlug;
  // Which independent tracked group this check-in belongs to (see
  // parties.ts) — for routes with only one implicit party this is always
  // that party's slug, invisible in the UI.
  party: string;
  tijdstip: string;
  leg_nr: number;
  lat: number | null;
  lon: number | null;
  notitie: string | null;
  invoerder: string;
}

export type Checkin = Omit<NewCheckin, "route">;

export async function insertCheckin(checkin: NewCheckin): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      insert into checkins (route, party, tijdstip, leg_nr, lat, lon, notitie, invoerder)
      values (${checkin.route}, ${checkin.party}, ${checkin.tijdstip}, ${checkin.leg_nr},
              ${checkin.lat}, ${checkin.lon}, ${checkin.notitie}, ${checkin.invoerder})
    `;
  } catch (err) {
    console.error(`insertCheckin(route=${checkin.route}, leg_nr=${checkin.leg_nr}): query failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    throw new Error(`Kon check-in niet opslaan: ${message}`);
  }
}

// Wrapped in unstable_cache by page.tsx (20s data cache, route stays
// force-dynamic) so the top bar and sidebar can derive real progress/pace
// from actual check-ins instead of the schedule. Empty before race day —
// that's the expected starting state, not an error.
export async function loadCheckins(route: RouteSlug): Promise<Checkin[]> {
  const sql = getSql();
  try {
    const rows = (await sql`
      select party, tijdstip, leg_nr, lat::float8 as lat, lon::float8 as lon, notitie, invoerder
      from checkins
      where route = ${route}
      order by tijdstip asc
    `) as Checkin[];
    return rows;
  } catch (err) {
    console.error(`loadCheckins(${route}): query failed`, err);
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    throw new Error(`Kon check-ins niet laden uit de database: ${message}`);
  }
}
