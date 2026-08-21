"use client";

// Fixture gallery for the real TopBar component (not a mock re-drawing of
// it) — every state TopBar.tsx can render, driven by plausible mock props,
// so a visual pass here catches the actual component's CSS, not a stand-in.
// Dev-only, reached via /styleguide (already noindex'd by the page's own
// metadata export).

import TopBar from "@/components/TopBar";
import type { Leg } from "@/lib/legs";
import type { Checkin } from "@/lib/checkins";
import type { WeatherSnapshot } from "@/lib/weather";
import { computeLegStatuses } from "@/lib/status";
import { firstCheckinTimesByLeg } from "@/lib/actualProgress";
import styles from "./styleguide.module.css";

const ROUTE = "11steden" as const;
const PARTY = "team";

// Fixed mock snapshot — WeatherStrip doesn't vary with the leg/check-in
// state these fixtures otherwise sweep through, so every fixture below
// shares this one value.
const MOCK_WEATHER: WeatherSnapshot = {
  temperatureC: 14,
  windKmh: 18,
  weatherCode: 3,
  description: "bewolkt",
  isDay: true,
};

function iso(base: string, hoursOffset: number): string {
  const d = new Date(base);
  d.setTime(d.getTime() + hoursOffset * 60 * 60 * 1000);
  return d.toISOString();
}

// Same shape/order as the real 11Stedentocht legs table: a chain of
// walkable stages ending in a finish row with afstand_km/loper null.
function makeLegs(day: string, startHour: number): Leg[] {
  const t = (h: number) => iso(day, startHour + h);
  return [
    {
      nr: 1,
      start_plaats: "Leeuwarden",
      afstand_km: 22.5,
      loper: "Lowie",
      loper_bjorn: null,
      cumulatief_start_km: 0,
      start_lat: 53.2012,
      start_lon: 5.7999,
      geplande_tijd: t(0),
      cp_nummer: 1,
      adres: null,
      bijzonderheden: null,
    },
    {
      nr: 2,
      start_plaats: "Sneek",
      afstand_km: 18.3,
      loper: "Lowie",
      loper_bjorn: null,
      cumulatief_start_km: 22.5,
      start_lat: 53.0331,
      start_lon: 5.6584,
      geplande_tijd: t(3.5),
      cp_nummer: 2,
      adres: null,
      bijzonderheden: null,
    },
    {
      nr: 3,
      start_plaats: "IJlst",
      afstand_km: 12.1,
      loper: "Lowie",
      loper_bjorn: null,
      cumulatief_start_km: 40.8,
      start_lat: 53.0022,
      start_lon: 5.6836,
      geplande_tijd: t(6.5),
      cp_nummer: 3,
      adres: null,
      bijzonderheden: null,
    },
    {
      nr: 4,
      start_plaats: "Sloten",
      afstand_km: 20.4,
      loper: "Lowie",
      loper_bjorn: null,
      cumulatief_start_km: 52.9,
      start_lat: 52.9502,
      start_lon: 5.6733,
      geplande_tijd: t(8.5),
      cp_nummer: 4,
      adres: null,
      bijzonderheden: null,
    },
    {
      nr: 5,
      start_plaats: "Stavoren",
      afstand_km: null,
      loper: null,
      loper_bjorn: null,
      cumulatief_start_km: 73.3,
      start_lat: 52.8869,
      start_lon: 5.3583,
      geplande_tijd: t(11.5),
      cp_nummer: null,
      adres: null,
      bijzonderheden: null,
    },
  ];
}

function makeCheckin(legNr: number, tijdstip: string): Checkin {
  return { party: PARTY, tijdstip, leg_nr: legNr, lat: null, lon: null, notitie: null, invoerder: "fixture" };
}

interface FixtureProps {
  label: string;
  legs: Leg[];
  now: number;
  checkins: Checkin[];
  garminUrl?: string | null;
}

function Fixture({ label, legs, now, checkins, garminUrl = null }: FixtureProps) {
  const statuses = computeLegStatuses(legs, now);
  const checkinTimes = firstCheckinTimesByLeg(checkins);
  return (
    <div className={styles.fixture}>
      <span className={styles.fixtureLabel}>{label}</span>
      <div className={styles.topBarFrame}>
        <TopBar
          activeRoute={ROUTE}
          activeParty={PARTY}
          legs={legs}
          effortLegs={legs}
          statuses={statuses}
          now={now}
          checkins={checkins}
          checkinTimes={checkinTimes}
          liveTrackProgress={null}
          garminUrl={garminUrl}
          weather={MOCK_WEATHER}
        />
      </div>
    </div>
  );
}

export default function TopBarFixtures() {
  const day = "2026-08-15T00:00:00+02:00";

  // Before the start: leg 1's geplande_tijd is a few days out.
  const countdownLegs = makeLegs("2026-08-19T00:00:00+02:00", 7);
  const countdownNow = new Date("2026-08-13T09:00:00+02:00").getTime();

  // After the start, no check-ins yet: schedule-derived progress bar.
  const scheduleLegs = makeLegs(day, 7);
  const scheduleNow = new Date(iso(day, 7 + 5)).getTime(); // mid-way between leg 2 and leg 3

  // One check-in: not enough for a trusted actual pace yet, so the ETA
  // falls back to "gepland" (the (schatting o.b.v. gepland tempo) note).
  const liveEarlyLegs = makeLegs(day, 7);
  const liveEarlyCheckinTime = iso(day, 7 + 3.5);
  const liveEarlyCheckins = [makeCheckin(2, liveEarlyCheckinTime)];
  const liveEarlyNow = new Date(liveEarlyCheckinTime).getTime() + 3 * 60 * 60 * 1000;

  // Two check-ins, past the halfway mark: actual pace + "Halverwege" milestone.
  const liveMidLegs = makeLegs(day, 7);
  const liveMidT0 = iso(day, 7 + 3.5);
  const liveMidT1 = iso(day, 7 + 6.5);
  const liveMidCheckins = [makeCheckin(2, liveMidT0), makeCheckin(3, liveMidT1)];
  const liveMidNow = new Date(liveMidT1).getTime() + 1.5 * 60 * 60 * 1000;

  // Every leg checked in, including the finish — the "Lowie is gefinisht"
  // donate copy (only visible with NEXT_PUBLIC_DONATION_URL set).
  const finishedLegs = makeLegs(day, 7);
  const finishedCheckins = [2, 3, 4, 5].map((nr) => makeCheckin(nr, iso(day, 7 + nr * 2.5)));
  const finishedNow = new Date(iso(day, 7 + 5 * 2.5)).getTime() + 30 * 60 * 1000;

  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>TopBar — vertrekbord-hero (fixtures)</h2>
      <div className={styles.fixtureGallery}>
        <Fixture label="Voor start — countdown" legs={countdownLegs} now={countdownNow} checkins={[]} />
        <Fixture
          label="Na start, geen check-ins — schema-gebaseerd"
          legs={scheduleLegs}
          now={scheduleNow}
          checkins={[]}
        />
        <Fixture
          label="1 check-in — live, schatting o.b.v. gepland tempo"
          legs={liveEarlyLegs}
          now={liveEarlyNow}
          checkins={liveEarlyCheckins}
        />
        <Fixture
          label="2+ check-ins, >50% — live, actueel tempo + halverwege"
          legs={liveMidLegs}
          now={liveMidNow}
          checkins={liveMidCheckins}
        />
        <Fixture label="Gefinisht" legs={finishedLegs} now={finishedNow} checkins={finishedCheckins} />
        <Fixture
          label="Met Garmin-link (achtervang) ingesteld via /beheer"
          legs={scheduleLegs}
          now={scheduleNow}
          checkins={[]}
          garminUrl="https://livetrack.garmin.com/session/example"
        />
      </div>
    </section>
  );
}
