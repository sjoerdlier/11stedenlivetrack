"use client";

import { useMemo, useState } from "react";
import type { Leg } from "@/lib/legs";
import type { Checkin } from "@/lib/checkins";
import { computeLegStatuses } from "@/lib/status";
import { firstCheckinByLeg, firstCheckinTimesByLeg } from "@/lib/actualProgress";
import LegSchedule from "@/components/LegSchedule";

// Static mock data for the styleguide preview only — same shape the real
// page.tsx assembles from Supabase/GPX, but hand-written here so this page
// keeps working without any env vars. `now` is a fixed instant (not
// useSimulatedNow) so the preview's mix of voltooid/bezig/nog-te-gaan
// statuses stays stable across renders/screenshots.
const FIXTURE_LEGS: Leg[] = [
  {
    nr: 1,
    start_plaats: "Leeuwarden",
    afstand_km: 18.4,
    loper: "Lowie",
    cumulatief_start_km: 0,
    start_lat: 53.2012,
    start_lon: 5.7999,
    geplande_tijd: "2026-08-15T05:00:00.000Z",
    cp_nummer: null,
    adres: "Wilhelminaplein, Leeuwarden",
    bijzonderheden: null,
  },
  {
    nr: 2,
    start_plaats: "Sneek",
    afstand_km: 9.2,
    loper: "Lowie",
    cumulatief_start_km: 18.4,
    start_lat: 53.0331,
    start_lon: 5.6586,
    geplande_tijd: "2026-08-15T08:40:00.000Z",
    cp_nummer: 1,
    adres: null,
    bijzonderheden: null,
  },
  {
    nr: 3,
    start_plaats: "IJlst",
    afstand_km: 12.7,
    loper: "Marieke",
    cumulatief_start_km: 27.6,
    start_lat: 52.9736,
    start_lon: 5.6903,
    geplande_tijd: "2026-08-15T10:05:00.000Z",
    cp_nummer: null,
    adres: null,
    bijzonderheden: "Smalle kade langs het water — pas op met fietsers.",
  },
  {
    nr: 4,
    start_plaats: "Sloten",
    afstand_km: 21.3,
    loper: "Marieke",
    cumulatief_start_km: 40.3,
    start_lat: 52.9241,
    start_lon: 5.6841,
    geplande_tijd: "2026-08-15T12:20:00.000Z",
    cp_nummer: 2,
    adres: null,
    bijzonderheden: null,
  },
  {
    nr: 5,
    start_plaats: "Stavoren",
    afstand_km: 15.1,
    loper: "Bram",
    cumulatief_start_km: 61.6,
    start_lat: 52.886,
    start_lon: 5.3572,
    geplande_tijd: "2026-08-15T15:10:00.000Z",
    cp_nummer: null,
    adres: null,
    bijzonderheden: null,
  },
  {
    nr: 6,
    start_plaats: "Hindeloopen (finish)",
    afstand_km: null,
    loper: null,
    cumulatief_start_km: 76.7,
    start_lat: 52.9525,
    start_lon: 5.3961,
    geplande_tijd: "2026-08-15T17:30:00.000Z",
    cp_nummer: null,
    adres: null,
    bijzonderheden: null,
  },
];

const FIXTURE_CHECKINS: Checkin[] = [
  {
    party: "team",
    tijdstip: "2026-08-15T04:58:00.000Z",
    leg_nr: 1,
    lat: 53.2012,
    lon: 5.7999,
    notitie: null,
    invoerder: "Sjoerd",
  },
  {
    party: "team",
    tijdstip: "2026-08-15T08:52:00.000Z",
    leg_nr: 2,
    lat: 53.0331,
    lon: 5.6586,
    notitie: null,
    invoerder: "Sjoerd",
  },
  {
    party: "team",
    tijdstip: "2026-08-15T10:14:00.000Z",
    leg_nr: 3,
    lat: 52.9736,
    lon: 5.6903,
    notitie: "Korte pauze voor droge sokken, gaat verder prima.",
    invoerder: "Anne",
  },
];

// 13:00 Europe/Amsterdam on the fixture's date — after leg 3's (IJlst)
// scheduled time, before leg 4's (Sloten), so leg 3 reads as "bezig" and
// legs 1-2 as "voltooid", matching the board mock above.
const FIXTURE_NOW = new Date("2026-08-15T11:00:00.000Z").getTime();

export default function LegScheduleFixture() {
  const [selectedNr, setSelectedNr] = useState<number | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const statuses = useMemo(() => computeLegStatuses(FIXTURE_LEGS, FIXTURE_NOW), []);
  const checkinTimes = useMemo(() => firstCheckinTimesByLeg(FIXTURE_CHECKINS), []);
  const checkinsByLeg = useMemo(() => firstCheckinByLeg(FIXTURE_CHECKINS), []);

  return (
    <LegSchedule
      activeRoute="11steden"
      activeParty="team"
      legs={FIXTURE_LEGS}
      effortLegs={FIXTURE_LEGS}
      statuses={statuses}
      checkinTimes={checkinTimes}
      checkinsByLeg={checkinsByLeg}
      selectedNr={selectedNr}
      onSelect={setSelectedNr}
      mobileExpanded={mobileExpanded}
      onToggleMobileExpanded={() => setMobileExpanded((v) => !v)}
      now={FIXTURE_NOW}
      lastRefreshedAt={FIXTURE_NOW}
      elevationProfile={[]}
    />
  );
}
