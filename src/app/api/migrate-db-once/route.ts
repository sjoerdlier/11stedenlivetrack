import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { timingSafeStringEqual } from "@/lib/checkinAuth";

// TEMPORARY — one-time seed of the new Vercel Postgres (Neon) database.
// Originally written to copy data over from the old Supabase project, but
// that project got repurposed for something else (renamed, schema replaced)
// before this ever ran — so instead this seeds the `legs` schedule directly
// from known-good values (reconstructed from this migration's own working
// history, since it matches exactly what was last confirmed correct in the
// old database). `checkins`/`settings`/`live_positions` start empty, same as
// they were before race day anyway. Creates the schema (idempotent —
// `create table if not exists`) and upserts every row (safe to re-run).
// Delete this whole route once verified on the real site — it has no reason
// to exist afterward.
//
// Gated by MIGRATE_DB_TOKEN, a one-off secret set temporarily in Vercel's
// Environment Variables (never committed) — remove that var alongside this
// route once done.
//
// loper_bjorn was cross-checked against Bijlage 1 of the "Draaiboek Oog
// voor Maja 2026" (the crew's own run sheet): every local time there
// matches this table's geplande_tijd exactly (UTC+2), and every existing
// `loper` value already matched the draaiboek's "Buddy Lowie" column, so
// this only had to *add* the previously-missing "Buddy Bjorn" column, not
// correct anything else. Two exceptions where the draaiboek had more/newer
// info than this table did: leg 6's adres/GPS (a real street address,
// where this table only had a generic "bij de rotonde") and two
// spectator-relevant bijzonderheden (legs 9 and 11) worth surfacing to
// followers. Leg 4's draaiboek entry (CP1, Sneek) has a location/GPS that's
// obviously a copy-paste of the leg 1 Leeuwarden row — left alone here,
// since this table's existing Sneek address/coordinates are correct.
const LEGS_11STEDEN = [
  { nr: 1, start_plaats: "Leeuwarden", afstand_km: 8.5, loper: "Nico", loper_bjorn: "Femke R., Lorenzo", cumulatief_start_km: 0.0, start_lat: 53.202338, start_lon: 5.769497, geplande_tijd: "2026-08-29T05:00:00+00:00", cp_nummer: null, adres: "Elfstedenhal", bijzonderheden: null },
  { nr: 2, start_plaats: "Weidum", afstand_km: 8.1, loper: "Fynn", loper_bjorn: "Femke R., Lorenzo", cumulatief_start_km: 8.5, start_lat: 53.148236, start_lon: 5.745660, geplande_tijd: "2026-08-29T06:15:00+00:00", cp_nummer: null, adres: "P, de Vijf Sinnen, Hegedyk 2", bijzonderheden: null },
  { nr: 3, start_plaats: "Daersum", afstand_km: 9, loper: "Nico", loper_bjorn: "Lorenzo", cumulatief_start_km: 16.6, start_lat: 53.090609, start_lon: 5.719029, geplande_tijd: "2026-08-29T07:45:00+00:00", cp_nummer: null, adres: "Rotonde bij minicamping De Wynmole, Harstawy 8, Daersum", bijzonderheden: null },
  { nr: 4, start_plaats: "Sneek", afstand_km: 4, loper: "Nico", loper_bjorn: "Femke R., Lorenzo", cumulatief_start_km: 25.6, start_lat: 53.030890, start_lon: 5.649651, geplande_tijd: "2026-08-29T09:00:00+00:00", cp_nummer: 1, adres: "Kanaalstraat 22, Sneek (parkeerplaats achter Argos)", bijzonderheden: null },
  { nr: 5, start_plaats: "IJlst", afstand_km: 10, loper: "Fynn", loper_bjorn: "Lorenzo", cumulatief_start_km: 29.6, start_lat: 53.011244, start_lon: 5.625312, geplande_tijd: "2026-08-29T09:50:00+00:00", cp_nummer: 2, adres: "Poiesz IJlst", bijzonderheden: null },
  { nr: 6, start_plaats: "Woudsend", afstand_km: 9.3, loper: "Nico", loper_bjorn: "Lorenzo", cumulatief_start_km: 39.6, start_lat: 52.942240, start_lon: 5.632513, geplande_tijd: "2026-08-29T11:30:00+00:00", cp_nummer: null, adres: "De Kolk 1, 8551 RL Woudsend", bijzonderheden: null },
  { nr: 7, start_plaats: "Sloten", afstand_km: 12.3, loper: "Fynn", loper_bjorn: "Lorenzo", cumulatief_start_km: 48.9, start_lat: 52.895938, start_lon: 5.646748, geplande_tijd: "2026-08-29T13:00:00+00:00", cp_nummer: 3, adres: "Voorstreek 120, Sloten", bijzonderheden: null },
  { nr: 8, start_plaats: "Rijs", afstand_km: 12.7, loper: "Cecile", loper_bjorn: "Lorenzo", cumulatief_start_km: 61.2, start_lat: 52.864497, start_lon: 5.498301, geplande_tijd: "2026-08-29T14:45:00+00:00", cp_nummer: null, adres: "Snackbar it Hert, Leise Leane 1A, Rijs", bijzonderheden: null },
  { nr: 9, start_plaats: "Stavoren", afstand_km: 8.7, loper: "Sjoerd", loper_bjorn: "Lorenzo", cumulatief_start_km: 73.9, start_lat: 52.886461, start_lon: 5.359594, geplande_tijd: "2026-08-29T17:00:00+00:00", cp_nummer: 4, adres: "Standbeeld het vrouwtje van Stavoren, Noord 18, Stavoren", bijzonderheden: "Over 1,5 km, bij Camping Séleantsje, staat een groep om aan te moedigen." },
  { nr: 10, start_plaats: "Hindeloopen", afstand_km: 7.3, loper: "Cecile", loper_bjorn: "Lorenzo", cumulatief_start_km: 82.6, start_lat: 52.939889, start_lon: 5.404043, geplande_tijd: "2026-08-29T18:30:00+00:00", cp_nummer: 5, adres: "Parkeerplak, Meenscharsweg 23-9, Hindeloopen", bijzonderheden: null },
  { nr: 11, start_plaats: "Workum", afstand_km: 13.1, loper: "Sjoerd", loper_bjorn: "Lorenzo", cumulatief_start_km: 89.9, start_lat: 52.980673, start_lon: 5.445668, geplande_tijd: "2026-08-29T19:30:00+00:00", cp_nummer: 6, adres: "Schoolstraat 10-16, Workum", bijzonderheden: "Kaas van Bij de Harmonie staat klaar." },
  { nr: 12, start_plaats: "Bolsward", afstand_km: 3, loper: "Cecile", loper_bjorn: "Femke B.", cumulatief_start_km: 103.0, start_lat: 53.064119, start_lon: 5.519790, geplande_tijd: "2026-08-29T21:30:00+00:00", cp_nummer: 7, adres: "St Franciscusbasiliek, Grote Dijlakker 7, Bolsward", bijzonderheden: "geen lopers (officieel schema)" },
  { nr: 13, start_plaats: "Witmarsum", afstand_km: 10.5, loper: "Cecile", loper_bjorn: "Femke B.", cumulatief_start_km: 106.0, start_lat: 53.103637, start_lon: 5.472489, geplande_tijd: "2026-08-29T22:45:00+00:00", cp_nummer: null, adres: null, bijzonderheden: "geen lopers (officieel schema)" },
  { nr: 14, start_plaats: "Harlingen", afstand_km: 7.5, loper: "Cecile", loper_bjorn: "Femke B.", cumulatief_start_km: 116.5, start_lat: 53.171609, start_lon: 5.431231, geplande_tijd: "2026-08-30T00:30:00+00:00", cp_nummer: 8, adres: "Maritiem Instituut Harlingen, Almenumerweg 1", bijzonderheden: "geen lopers (officieel schema)" },
  { nr: 15, start_plaats: "Franeker", afstand_km: 6.5, loper: "Sjoerd", loper_bjorn: "Femke B.", cumulatief_start_km: 124.0, start_lat: 53.187273, start_lon: 5.550115, geplande_tijd: "2026-08-30T01:45:00+00:00", cp_nummer: 9, adres: "Cafe t Park, Harlingerweg 11, Franeker", bijzonderheden: "geen lopers (officieel schema)" },
  { nr: 16, start_plaats: "Tzummarum", afstand_km: 10, loper: "Cecile", loper_bjorn: "Femke B.", cumulatief_start_km: 130.5, start_lat: 53.236695, start_lon: 5.547887, geplande_tijd: "2026-08-30T02:45:00+00:00", cp_nummer: null, adres: "St Martinuskerk, Tsjerkepaed 1, Tzummarum", bijzonderheden: "geen lopers (officieel schema)" },
  { nr: 17, start_plaats: "St. Anna Parochie", afstand_km: 14.5, loper: "Sjoerd", loper_bjorn: "Femke B.", cumulatief_start_km: 140.5, start_lat: 53.276619, start_lon: 5.655616, geplande_tijd: "2026-08-30T04:30:00+00:00", cp_nummer: null, adres: "Den Staten Generaal, Statenweg 10, St. Anna Parochie", bijzonderheden: "geen lopers (officieel schema)" },
  { nr: 18, start_plaats: "Finkum/Hijum", afstand_km: 6, loper: "Martijn", loper_bjorn: "Sven", cumulatief_start_km: 155.0, start_lat: 53.291145, start_lon: 5.765535, geplande_tijd: "2026-08-30T05:30:00+00:00", cp_nummer: null, adres: "Hijum (station Finkum)", bijzonderheden: null },
  { nr: 19, start_plaats: "Bartlehiem", afstand_km: 15, loper: "Martijn", loper_bjorn: "Sven", cumulatief_start_km: 161.0, start_lat: 53.276238, start_lon: 5.834029, geplande_tijd: "2026-08-30T07:00:00+00:00", cp_nummer: null, adres: "Westkade bruggetje, Bartlehiem", bijzonderheden: null },
  { nr: 20, start_plaats: "Dokkum", afstand_km: 14, loper: "Sjoerd", loper_bjorn: "Femke B.", cumulatief_start_km: 176.0, start_lat: 53.323674, start_lon: 5.997955, geplande_tijd: "2026-08-30T09:00:00+00:00", cp_nummer: 10, adres: "Keerpunt Elfstedentocht, Dokkum", bijzonderheden: null },
  { nr: 21, start_plaats: "Bartlehiem", afstand_km: 10, loper: "Martijn", loper_bjorn: "Femke B.", cumulatief_start_km: 190.0, start_lat: 53.276112, start_lon: 5.841448, geplande_tijd: "2026-08-30T11:00:00+00:00", cp_nummer: null, adres: "Grutte Pier brouwerij, Bartlehiem 23", bijzonderheden: null },
  { nr: 22, start_plaats: "Lekkum", afstand_km: 5, loper: "Sjoerd", loper_bjorn: "Femke B.", cumulatief_start_km: 200.0, start_lat: 53.223951, start_lon: 5.820648, geplande_tijd: "2026-08-30T12:15:00+00:00", cp_nummer: null, adres: "Kantine Sportveld, Buorren 2, Lekkum", bijzonderheden: "Let op: route loopt nu nog langs Westkade, mogelijk wijziging naar Oostkade i.v.m. campertoegang (post staat ook op Oostoever)" },
  { nr: 23, start_plaats: "Leeuwarden (finish)", afstand_km: null, loper: null, loper_bjorn: null, cumulatief_start_km: 202, start_lat: 53.202339, start_lon: 5.769475, geplande_tijd: "2026-08-30T13:15:00+00:00", cp_nummer: 11, adres: "Elfstedenhal", bijzonderheden: null },
];

export async function POST(request: Request) {
  const expectedToken = process.env.MIGRATE_DB_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ ok: false, error: "MIGRATE_DB_TOKEN ontbreekt." }, { status: 500 });
  }

  const token = request.headers.get("x-migration-token") ?? "";
  if (!timingSafeStringEqual(token, expectedToken)) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd." }, { status: 401 });
  }

  const sql = getSql();
  const log: string[] = [];

  try {
    await sql`
      create table if not exists legs (
        route text not null,
        nr integer not null,
        start_plaats text,
        afstand_km numeric,
        loper text,
        cumulatief_start_km numeric,
        start_lat numeric,
        start_lon numeric,
        geplande_tijd timestamptz,
        cp_nummer integer,
        adres text,
        bijzonderheden text,
        primary key (route, nr)
      )
    `;
    // Added after the table's initial creation (this route already ran once
    // seeding Lowie's roster only) — `if not exists` keeps this safe to
    // re-run against a database that already has the column.
    await sql`alter table legs add column if not exists loper_bjorn text`;
    await sql`
      create table if not exists checkins (
        id uuid primary key default gen_random_uuid(),
        created_at timestamptz default now(),
        tijdstip timestamptz not null,
        leg_nr integer,
        lat numeric,
        lon numeric,
        notitie text,
        invoerder text,
        route text not null,
        party text not null
      )
    `;
    await sql`
      create table if not exists settings (
        key text primary key,
        value text,
        updated_at timestamptz not null default now()
      )
    `;
    await sql`
      create table if not exists live_positions (
        route text not null,
        party text not null,
        lat numeric not null,
        lon numeric not null,
        recorded_at timestamptz not null,
        received_at timestamptz not null default now(),
        primary key (route, party)
      )
    `;
    // live_positions started as "one row per (route, party), upserted" —
    // just the latest fix, no trail. liveTrackProgress.ts needs the trail
    // (to derive distance/pace from GPS alone, without a check-in per leg),
    // so this widens the primary key to keep every fix instead of
    // overwriting it.
    //
    // A prior version of this migration assumed the existing constraint was
    // named `live_positions_pkey` (Postgres' default for an inline
    // `primary key (...)` in CREATE TABLE) and dropped it by that literal
    // name. That table predates this route, though — it was created
    // directly against Supabase back when the live-GPS pipeline first
    // shipped (see PR #14), not via this file's own `create table if not
    // exists` above (a no-op once the table already existed) — so its real
    // constraint name was never actually verified, only assumed. Running
    // this against production reported `{"ok":true}` (both ALTERs
    // "succeeded" — a name-mismatched DROP CONSTRAINT IF EXISTS silently
    // no-ops rather than erroring) but `/api/live` kept failing afterward
    // with "no unique or exclusion constraint matching the ON CONFLICT
    // specification" — meaning the add never actually took effect, most
    // likely because the real constraint had a different name and something
    // about it (or a leftover duplicate) kept the new one from landing
    // cleanly. Looking up the *actual* current primary-key constraint name
    // from pg_constraint and dropping that dynamically removes the guess
    // entirely; the before/after log lines make the real state visible in
    // the response instead of trusting another blind ALTER to have worked.
    const pkBefore = (await sql`
      select conname from pg_constraint
      where conrelid = 'live_positions'::regclass and contype = 'p'
    `) as { conname: string }[];
    log.push(`live_positions PK voor migratie: ${pkBefore[0]?.conname ?? "(geen)"}`);

    if (pkBefore[0]?.conname) {
      await sql`
        do $$
        declare
          pk_name text := (
            select conname from pg_constraint
            where conrelid = 'live_positions'::regclass and contype = 'p'
          );
        begin
          if pk_name is not null then
            execute format('alter table live_positions drop constraint %I', pk_name);
          end if;
        end $$;
      `;
    }
    await sql`alter table live_positions add primary key (route, party, recorded_at)`;

    const pkAfter = (await sql`
      select conname, pg_get_constraintdef(oid) as def from pg_constraint
      where conrelid = 'live_positions'::regclass and contype = 'p'
    `) as { conname: string; def: string }[];
    log.push(`live_positions PK na migratie: ${pkAfter[0]?.conname ?? "(geen)"} ${pkAfter[0]?.def ?? ""}`);
    log.push("schema klaar");

    for (const leg of LEGS_11STEDEN) {
      await sql`
        insert into legs (route, nr, start_plaats, afstand_km, loper, loper_bjorn, cumulatief_start_km,
                           start_lat, start_lon, geplande_tijd, cp_nummer, adres, bijzonderheden)
        values ('11steden', ${leg.nr}, ${leg.start_plaats}, ${leg.afstand_km}, ${leg.loper}, ${leg.loper_bjorn},
                ${leg.cumulatief_start_km}, ${leg.start_lat}, ${leg.start_lon}, ${leg.geplande_tijd},
                ${leg.cp_nummer}, ${leg.adres}, ${leg.bijzonderheden})
        on conflict (route, nr) do update set
          start_plaats = excluded.start_plaats, afstand_km = excluded.afstand_km,
          loper = excluded.loper, loper_bjorn = excluded.loper_bjorn,
          cumulatief_start_km = excluded.cumulatief_start_km,
          start_lat = excluded.start_lat, start_lon = excluded.start_lon,
          geplande_tijd = excluded.geplande_tijd, cp_nummer = excluded.cp_nummer,
          adres = excluded.adres, bijzonderheden = excluded.bijzonderheden
      `;
    }
    log.push(`legs: ${LEGS_11STEDEN.length} rijen geseed`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: message, log }, { status: 500 });
  }

  return NextResponse.json({ ok: true, log });
}
