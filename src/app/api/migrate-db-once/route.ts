import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSql } from "@/lib/db";

// TEMPORARY — one-time migration from the old Supabase project to the new
// Vercel Postgres (Neon) database. Creates the schema (idempotent —
// `create table if not exists`) and copies every row over (idempotent —
// every insert is an upsert), so it's safe to call more than once, e.g. to
// re-sync after fixing something. Delete this whole route once the
// migration has run successfully and been verified on the real site — it
// has no reason to exist afterward, and it's the one place in the app that
// still needs the old SUPABASE_URL/SUPABASE_ANON_KEY env vars.
//
// Gated by a token baked directly into this file rather than a separate env
// var — simplest option for something this short-lived, and the token is
// only useful for as long as this file exists at all.
const MIGRATION_TOKEN = "81e0fea6113e4e679e5d948af8607f921013ebb3435b4ca0";

export async function POST(request: Request) {
  const token = request.headers.get("x-migration-token");
  if (token !== MIGRATION_TOKEN) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd." }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: "SUPABASE_URL/SUPABASE_ANON_KEY ontbreken." }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
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
    log.push("schema klaar");

    const { data: legs, error: legsErr } = await supabase.from("legs").select("*");
    if (legsErr) throw new Error(`legs ophalen uit Supabase: ${legsErr.message}`);
    for (const leg of legs ?? []) {
      await sql`
        insert into legs (route, nr, start_plaats, afstand_km, loper, cumulatief_start_km,
                           start_lat, start_lon, geplande_tijd, cp_nummer, adres, bijzonderheden)
        values (${leg.route}, ${leg.nr}, ${leg.start_plaats}, ${leg.afstand_km}, ${leg.loper},
                ${leg.cumulatief_start_km}, ${leg.start_lat}, ${leg.start_lon}, ${leg.geplande_tijd},
                ${leg.cp_nummer}, ${leg.adres}, ${leg.bijzonderheden})
        on conflict (route, nr) do update set
          start_plaats = excluded.start_plaats, afstand_km = excluded.afstand_km,
          loper = excluded.loper, cumulatief_start_km = excluded.cumulatief_start_km,
          start_lat = excluded.start_lat, start_lon = excluded.start_lon,
          geplande_tijd = excluded.geplande_tijd, cp_nummer = excluded.cp_nummer,
          adres = excluded.adres, bijzonderheden = excluded.bijzonderheden
      `;
    }
    log.push(`legs: ${legs?.length ?? 0} rijen`);

    const { data: checkins, error: checkinsErr } = await supabase.from("checkins").select("*");
    if (checkinsErr) throw new Error(`checkins ophalen uit Supabase: ${checkinsErr.message}`);
    for (const c of checkins ?? []) {
      await sql`
        insert into checkins (id, created_at, tijdstip, leg_nr, lat, lon, notitie, invoerder, route, party)
        values (${c.id}, ${c.created_at}, ${c.tijdstip}, ${c.leg_nr}, ${c.lat}, ${c.lon},
                ${c.notitie}, ${c.invoerder}, ${c.route}, ${c.party})
        on conflict (id) do nothing
      `;
    }
    log.push(`checkins: ${checkins?.length ?? 0} rijen`);

    const { data: settings, error: settingsErr } = await supabase.from("settings").select("*");
    if (settingsErr) throw new Error(`settings ophalen uit Supabase: ${settingsErr.message}`);
    for (const s of settings ?? []) {
      await sql`
        insert into settings (key, value, updated_at)
        values (${s.key}, ${s.value}, ${s.updated_at})
        on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at
      `;
    }
    log.push(`settings: ${settings?.length ?? 0} rijen`);

    const { data: livePositions, error: livePositionsErr } = await supabase.from("live_positions").select("*");
    if (livePositionsErr) throw new Error(`live_positions ophalen uit Supabase: ${livePositionsErr.message}`);
    for (const p of livePositions ?? []) {
      await sql`
        insert into live_positions (route, party, lat, lon, recorded_at, received_at)
        values (${p.route}, ${p.party}, ${p.lat}, ${p.lon}, ${p.recorded_at}, ${p.received_at})
        on conflict (route, party) do update set
          lat = excluded.lat, lon = excluded.lon,
          recorded_at = excluded.recorded_at, received_at = excluded.received_at
      `;
    }
    log.push(`live_positions: ${livePositions?.length ?? 0} rijen`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout.";
    return NextResponse.json({ ok: false, error: message, log }, { status: 500 });
  }

  return NextResponse.json({ ok: true, log });
}
