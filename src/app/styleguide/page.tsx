import type { Metadata } from "next";
import RouteMapLoader from "@/components/RouteMapLoader";
import PinScreenFixture from "./PinScreenFixture";
import LoadError from "@/components/LoadError";
import NewCheckinToast from "@/components/NewCheckinToast";
import BuddyBadge from "@/components/BuddyBadge";
import LegScheduleFixture from "./LegScheduleFixture";
import ElevationProfile from "@/components/ElevationProfile";
import type { ElevationPoint } from "@/lib/elevation";
import styles from "./styleguide.module.css";
import TopBarFixtures from "./TopBarFixtures";
import {
  CLOSEUP_EFFORT_LEGS,
  CLOSEUP_LEG_SEGMENTS,
  CLOSEUP_START,
  CLOSEUP_STATUSES,
  FIXTURE_CHECKINS,
  FIXTURE_CHECKINS_BY_LEG,
  FIXTURE_CHECKIN_TIMES,
  FIXTURE_EFFORT_LEGS,
  FIXTURE_LEG_SEGMENTS,
  FIXTURE_LIVE_POSITIONS,
  FIXTURE_NOW,
  FIXTURE_START,
  FIXTURE_STATUSES,
} from "./mapFixture";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const swatches = [
  { name: "ground", token: "--db-ground" },
  { name: "surface", token: "--db-surface" },
  { name: "surface-2", token: "--db-surface-2" },
  { name: "border", token: "--db-border" },
  { name: "text", token: "--db-text" },
  { name: "text-dim", token: "--db-text-dim" },
  { name: "amber (live)", token: "--db-amber" },
  { name: "steel (route)", token: "--db-steel" },
  { name: "signal-red", token: "--db-signal-red" },
  { name: "signal-green", token: "--db-signal-green" },
];

const legs = [
  { stad: "Leeuwarden", tijd: "07:00", status: "voltooid" as const, tempo: "6,1" },
  { stad: "Sneek", tijd: "10:40", status: "voltooid" as const, tempo: "5,8" },
  { stad: "IJlst", tijd: "12:05", status: "bezig" as const, tempo: "5,4" },
  { stad: "Sloten", tijd: "14:20", status: "nog" as const, tempo: "—" },
  { stad: "Stavoren", tijd: "17:10", status: "nog" as const, tempo: "—" },
];

// Deterministic mock profile — Friesland is mostly flat, with a handful of
// dike/bridge bumps, rather than random noise, so it screenshots the same
// way every time. distanceKm goes from 0 to 204 (the real route length),
// elevationM stays low/near-sea-level with a few +/- swings.
const mockElevationProfile: ElevationPoint[] = Array.from({ length: 41 }, (_, i) => {
  const distanceKm = (i / 40) * 204;
  const elevationM = 3 + 4 * Math.sin(i / 3.4) + 2 * Math.sin(i / 1.1) - (i > 30 ? (i - 30) * 0.3 : 0);
  return { distanceKm, elevationM };
});

export default function StyleguidePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Vertrekstaat — ontwerprichting</span>
        <div className={styles.heroRow}>
          <div>
            <div className={styles.heroNumber}>16</div>
            <div className={styles.heroLabel}>dagen tot start</div>
          </div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.statLabel}>Voortgang</span>
              <span className={styles.statValue}>38%</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.statLabel}>Tempo</span>
              <span className={styles.statValue}>5,6 km/u</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.statLabel}>Aankomst ±</span>
              <span className={styles.statValue}>17:40</span>
            </div>
          </div>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: "38%" }} />
        </div>
        <button className={styles.donate} type="button">
          <span aria-hidden>❤</span> Doneer voor Lowie
        </button>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Kleur</h2>
        <div className={styles.swatchGrid}>
          {swatches.map((s) => (
            <div className={styles.swatch} key={s.token}>
              <div className={styles.swatchColor} style={{ background: `var(${s.token})` }} />
              <span className={styles.swatchLabel}>{s.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Typografie</h2>
        <div className={styles.typeDisplay}>204</div>
        <div className={styles.typeSans}>IBM Plex Sans — Etappe 3: IJlst → Sloten</div>
        <div className={styles.typeMono}>12:05:33 · 14,2 km · 5,4 km/u</div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Hoogteprofiel</h2>
        <div className={styles.panelNarrow}>
          <ElevationProfile profile={mockElevationProfile} />
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Etappeschema (departure rows)</h2>
        <div className={styles.board}>
          <div className={styles.boardHeader}>
            <span>Stad</span>
            <span>Tijd</span>
            <span>Tempo</span>
            <span>Status</span>
          </div>
          {legs.map((leg) => (
            <div className={`${styles.boardRow} ${styles[`row_${leg.status}`]}`} key={leg.stad}>
              <span className={styles.rowCity}>{leg.stad}</span>
              <span className={styles.rowTime}>{leg.tijd}</span>
              <span className={styles.rowTempo}>{leg.tempo}</span>
              <span className={styles.rowStamp}>
                {leg.status === "voltooid" ? "●" : leg.status === "bezig" ? "▸" : "○"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Kaart (RouteMap)</h2>
        <p className={styles.mapCaption}>
          Live GPS — vaste ring, gevulde amber stip
        </p>
        <div className={styles.mapPreview}>
          <RouteMapLoader
            activeRoute="11steden"
            activeParty="team"
            start={FIXTURE_START}
            legSegments={FIXTURE_LEG_SEGMENTS}
            effortLegs={FIXTURE_EFFORT_LEGS}
            statuses={FIXTURE_STATUSES}
            checkinTimes={FIXTURE_CHECKIN_TIMES}
            checkinsByLeg={FIXTURE_CHECKINS_BY_LEG}
            checkins={FIXTURE_CHECKINS}
            livePositions={FIXTURE_LIVE_POSITIONS}
            now={FIXTURE_NOW}
            lastRefreshedAt={FIXTURE_NOW}
            elevationProfile={[]}
          />
        </div>
        <p className={styles.mapCaption}>
          Schatting (geen verse GPS-fix) — gestippelde ring, holle stip
        </p>
        <div className={styles.mapPreview}>
          <RouteMapLoader
            activeRoute="11steden"
            activeParty="team"
            start={FIXTURE_START}
            legSegments={FIXTURE_LEG_SEGMENTS}
            effortLegs={FIXTURE_EFFORT_LEGS}
            statuses={FIXTURE_STATUSES}
            checkinTimes={FIXTURE_CHECKIN_TIMES}
            checkinsByLeg={FIXTURE_CHECKINS_BY_LEG}
            checkins={FIXTURE_CHECKINS}
            livePositions={[]}
            now={FIXTURE_NOW}
            lastRefreshedAt={FIXTURE_NOW}
            elevationProfile={[]}
          />
        </div>
        <p className={styles.mapCaption}>
          Ingezoomd — CP-stempels (voltooid/bezig/nog) en de vaste CP-tooltip
        </p>
        <div className={styles.mapPreview}>
          <RouteMapLoader
            activeRoute="11steden"
            activeParty="team"
            start={CLOSEUP_START}
            legSegments={CLOSEUP_LEG_SEGMENTS}
            effortLegs={CLOSEUP_EFFORT_LEGS}
            statuses={CLOSEUP_STATUSES}
            checkinTimes={new Map()}
            checkinsByLeg={new Map()}
            checkins={[]}
            livePositions={[]}
            now={FIXTURE_NOW}
            lastRefreshedAt={FIXTURE_NOW}
            elevationProfile={[]}
          />
        </div>
      </section>

      <TopBarFixtures />

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Etappeschema — echte component</h2>
        <p className={styles.blockHint}>
          De werkelijke <code>LegSchedule</code>/<code>LegCard</code> met mock-legs — klik een rij open (voltooide
          rijen collapsen standaard, de actieve rij en alles wat nog moet komen staat al open).
        </p>
        <div className={styles.fixtureWrap}>
          <LegScheduleFixture />
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Restjes-surfaces (fixtures)</h2>
        <div className={styles.fixtureGrid}>
          <div className={styles.fixtureCard}>
            <span className={styles.fixtureLabel}>PinScreen — /invoer, /beheer</span>
            <div className={styles.fixtureFrame}>
              <PinScreenFixture />
            </div>
          </div>

          <div className={styles.fixtureCard}>
            <span className={styles.fixtureLabel}>LoadError — route laadfout</span>
            <div className={styles.fixtureFrame}>
              <LoadError
                message="Mock voor styleguide: Supabase niet bereikbaar"
                retryHref="#styleguide-fixture"
              />
            </div>
          </div>

          <div className={styles.fixtureCard}>
            <span className={styles.fixtureLabel}>NewCheckinToast</span>
            <div className={`${styles.fixtureFrame} ${styles.fixtureFrameShort}`}>
              <NewCheckinToast plaats="Bartlehiem" />
            </div>
          </div>

          <div className={styles.fixtureCard}>
            <span className={styles.fixtureLabel}>BuddyBadge</span>
            <div className={styles.fixtureFrame}>
              <div className={styles.fixtureBadgeRow}>
                <BuddyBadge name="Sjoerd" />
                <BuddyBadge name="Lowie" />
                <BuddyBadge name="Anna" />
                <BuddyBadge name="Mark" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
