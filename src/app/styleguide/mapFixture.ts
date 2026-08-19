// Plausible mock data for the RouteMap preview on this page only — real
// coordinates subsampled from data/route.gpx (every 20th track point) so the
// polyline traces an actual stretch of the real route, cut into leg
// segments the same forward-looking way buildLegSegments does (each leg's
// segment runs from its own start to the *next* leg's start; the finish leg
// has no "next", so its segment is just its own point — see segments.ts).
// This file only exists to drive the styleguide's visual-verification
// fixture; nothing in the real app imports it.
import type { LatLng } from "@/lib/gpx";
import type { Leg } from "@/lib/legs";
import type { LegSegment } from "@/lib/segments";
import type { Checkin } from "@/lib/checkins";
import type { LivePositionRow } from "@/lib/livePositions";
import { computeLegStatuses } from "@/lib/status";
import { firstCheckinByLeg, firstCheckinTimesByLeg } from "@/lib/actualProgress";

const TRACK: LatLng[] = [
  [53.20234, 5.7695], [53.20162, 5.76646], [53.19334, 5.76549], [53.19278, 5.75328],
  [53.19022, 5.73635], [53.18534, 5.73168], [53.18152, 5.73054], [53.17967, 5.73297],
  [53.17318, 5.73686], [53.16782, 5.74071], [53.16246, 5.74408], [53.15926, 5.74443],
  [53.14875, 5.74589], [53.1457, 5.74528], [53.14138, 5.7378], [53.12857, 5.73018],
  [53.11759, 5.73569], [53.11138, 5.73473], [53.10932, 5.73457], [53.10266, 5.72969],
  [53.0935, 5.71478], [53.09043, 5.71868], [53.08093, 5.71262], [53.06952, 5.69895],
  [53.05941, 5.68284], [53.05707, 5.67893], [53.05046, 5.67757], [53.04729, 5.67694],
  [53.03877, 5.66762], [53.03395, 5.66106], [53.0345, 5.65614], [53.03201, 5.65216],
  [53.03036, 5.64895], [53.02489, 5.63721], [53.01363, 5.6169], [53.01054, 5.62427],
  [53.01084, 5.6265], [53.01143, 5.6486], [52.99808, 5.65131], [52.99007, 5.64978],
  [52.97922, 5.64978], [52.97764, 5.64979], [52.96592, 5.65172], [52.94919, 5.65357],
  [52.94389, 5.64955], [52.94318, 5.63276], [52.94311, 5.6337], [52.94215, 5.64745],
  [52.93852, 5.65596], [52.91264, 5.69726], [52.90405, 5.6815], [52.90082, 5.66955],
  [52.89501, 5.64892], [52.89567, 5.64663], [52.89402, 5.6422], [52.88912, 5.62411],
  [52.89067, 5.61052], [52.89307, 5.59802], [52.89816, 5.58478], [52.89586, 5.57661],
  [52.88965, 5.56716], [52.8749, 5.54417], [52.87281, 5.51376], [52.86376, 5.49716],
  [52.87058, 5.48619], [52.87795, 5.47142], [52.88034, 5.46203], [52.88021, 5.45455],
  [52.87518, 5.43487], [52.87533, 5.41558], [52.87498, 5.40996], [52.88146, 5.40506],
  [52.88614, 5.40226], [52.88613, 5.39212], [52.88797, 5.37342], [52.88831, 5.361],
  [52.8863, 5.35858], [52.88659, 5.35897], [52.88878, 5.35819], [52.89741, 5.36875],
  [52.90385, 5.38692], [52.90444, 5.3927], [52.91047, 5.40789], [52.92422, 5.41027],
  [52.93666, 5.40283], [52.93946, 5.40314], [52.94309, 5.40387], [52.94377, 5.41777],
  [52.94763, 5.4334], [52.97222, 5.43448], [52.97608, 5.4386], [52.98273, 5.44729],
  [52.98226, 5.45765], [52.98002, 5.46377], [52.99469, 5.47469], [53.01128, 5.47678],
  [53.02263, 5.4823], [53.04014, 5.49628], [53.05127, 5.50801], [53.05829, 5.51646],
  [53.06247, 5.51803], [53.06361, 5.51998], [53.06248, 5.51459], [53.06279, 5.50603],
  [53.07019, 5.49285], [53.08018, 5.48207], [53.08729, 5.4835], [53.10141, 5.47879],
  [53.10418, 5.46987], [53.11131, 5.48327], [53.11591, 5.48693], [53.12547, 5.48355],
  [53.12989, 5.47645], [53.13176, 5.4728], [53.13581, 5.46452], [53.13997, 5.44343],
  [53.14157, 5.4364], [53.14214, 5.43422], [53.1462, 5.4284], [53.15792, 5.42785],
  [53.16325, 5.42754], [53.16784, 5.42768], [53.17085, 5.42973], [53.17588, 5.44149],
  [53.17932, 5.44917], [53.18295, 5.46596], [53.18435, 5.49399], [53.18406, 5.51985],
  [53.18425, 5.53109], [53.18624, 5.53867], [53.18677, 5.54678], [53.18798, 5.55042],
  [53.19069, 5.5465], [53.19324, 5.54051], [53.19962, 5.54098], [53.20757, 5.54235],
  [53.21973, 5.54041], [53.23064, 5.54709], [53.23676, 5.54728], [53.23907, 5.55225],
  [53.2441, 5.57269], [53.25043, 5.59001], [53.25469, 5.60166], [53.26651, 5.60465],
  [53.2728, 5.60563], [53.27486, 5.63302], [53.27598, 5.64988], [53.27675, 5.66063],
  [53.2775, 5.66993], [53.27927, 5.6971], [53.28034, 5.71171], [53.27901, 5.72138],
  [53.28765, 5.72696], [53.29193, 5.74741], [53.29137, 5.76227], [53.29317, 5.76738],
  [53.29657, 5.77389], [53.3027, 5.77946], [53.29768, 5.79279], [53.27889, 5.83596],
  [53.28574, 5.8463], [53.28865, 5.86057], [53.29511, 5.87947], [53.29644, 5.88305],
  [53.30268, 5.89889], [53.30973, 5.91637], [53.31366, 5.92617], [53.31684, 5.94196],
  [53.32159, 5.95589], [53.32151, 5.97175], [53.32258, 5.9783], [53.32712, 5.98405],
  [53.32549, 5.99118], [53.32523, 5.99592], [53.32509, 5.99771], [53.3265, 5.99352],
  [53.3263, 5.98785], [53.32445, 5.97926], [53.32223, 5.97969], [53.32302, 5.96358],
  [53.31791, 5.9492], [53.31561, 5.93353], [53.31195, 5.92119], [53.30663, 5.90798],
  [53.2989, 5.88942], [53.29615, 5.88197], [53.29345, 5.87688], [53.28835, 5.86783],
  [53.2784, 5.84373], [53.26968, 5.8362], [53.25243, 5.83259], [53.24639, 5.83277],
  [53.24093, 5.83309], [53.23421, 5.82731], [53.22741, 5.82191], [53.22424, 5.82032],
  [53.22317, 5.82028], [53.22322, 5.8168], [53.21918, 5.80936], [53.21535, 5.80858],
  [53.21287, 5.80313], [53.20925, 5.7985], [53.2058, 5.79553], [53.20472, 5.78764],
  [53.20491, 5.77796], [53.20234, 5.77573], [53.20246, 5.77048],
];

// Indices into TRACK where each leg starts (finish last, mirroring how the
// real `legs` table's last row is the endpoint, not a walkable stage).
const LEG_START_IDX = [0, 41, 82, 124, 165, 206];

export const FIXTURE_NOW = new Date("2026-08-16T12:10:00+02:00").getTime();

const tijd = (t: string) => `2026-08-16T${t}:00+02:00`;

export const FIXTURE_LEGS: Leg[] = [
  {
    nr: 1,
    start_plaats: "Leeuwarden",
    afstand_km: 42,
    loper: "Lowie",
    loper_bjorn: null,
    cumulatief_start_km: 0,
    start_lat: TRACK[LEG_START_IDX[0]][0],
    start_lon: TRACK[LEG_START_IDX[0]][1],
    geplande_tijd: tijd("07:00"),
    cp_nummer: 1,
    adres: null,
    bijzonderheden: null,
  },
  {
    nr: 2,
    start_plaats: "Sneek",
    afstand_km: 8,
    loper: "Lowie",
    loper_bjorn: null,
    cumulatief_start_km: 42,
    start_lat: TRACK[LEG_START_IDX[1]][0],
    start_lon: TRACK[LEG_START_IDX[1]][1],
    geplande_tijd: tijd("10:40"),
    cp_nummer: 2,
    adres: null,
    bijzonderheden: null,
  },
  {
    nr: 3,
    start_plaats: "IJlst",
    afstand_km: 24,
    loper: "Lowie",
    loper_bjorn: null,
    cumulatief_start_km: 50,
    start_lat: TRACK[LEG_START_IDX[2]][0],
    start_lon: TRACK[LEG_START_IDX[2]][1],
    geplande_tijd: tijd("12:05"),
    cp_nummer: 3,
    adres: null,
    bijzonderheden: null,
  },
  {
    nr: 4,
    start_plaats: "Sloten",
    afstand_km: 33,
    loper: "Lowie",
    loper_bjorn: null,
    cumulatief_start_km: 74,
    start_lat: TRACK[LEG_START_IDX[3]][0],
    start_lon: TRACK[LEG_START_IDX[3]][1],
    geplande_tijd: tijd("14:20"),
    cp_nummer: 4,
    adres: null,
    bijzonderheden: null,
  },
  {
    nr: 5,
    start_plaats: "Stavoren",
    afstand_km: 46,
    loper: "Lowie",
    loper_bjorn: null,
    cumulatief_start_km: 107,
    start_lat: TRACK[LEG_START_IDX[4]][0],
    start_lon: TRACK[LEG_START_IDX[4]][1],
    geplande_tijd: tijd("17:10"),
    cp_nummer: 5,
    adres: null,
    bijzonderheden: null,
  },
  {
    nr: 6,
    start_plaats: "Leeuwarden (finish)",
    afstand_km: null,
    loper: null,
    loper_bjorn: null,
    cumulatief_start_km: 153,
    start_lat: TRACK[LEG_START_IDX[5]][0],
    start_lon: TRACK[LEG_START_IDX[5]][1],
    geplande_tijd: tijd("19:30"),
    cp_nummer: null,
    adres: null,
    bijzonderheden: null,
  },
];

export const FIXTURE_LEG_SEGMENTS: LegSegment[] = FIXTURE_LEGS.map((leg, i) => {
  const startIdx = LEG_START_IDX[i];
  const endIdx = i + 1 < FIXTURE_LEGS.length ? LEG_START_IDX[i + 1] : startIdx;
  return {
    leg,
    positions: TRACK.slice(startIdx, endIdx + 1),
    // Not a real Minetti-model grade adjustment (no elevation samples in
    // this fixture) — just a plausible stand-in so the effort-legs plumbing
    // has non-zero numbers to work with.
    effortKm: leg.afstand_km !== null ? leg.afstand_km * 1.05 : 0,
  };
});

// A simplified stand-in for buildEffortLegs (segments.ts) — same shape,
// just skipping the real cumulative recompute since this fixture doesn't
// need pixel-accurate pace math, only plausible non-null numbers.
export const FIXTURE_EFFORT_LEGS: Leg[] = FIXTURE_LEG_SEGMENTS.reduce<Leg[]>((acc, { leg, effortKm }) => {
  const afstand_km = leg.afstand_km !== null ? effortKm : null;
  const prev = acc[acc.length - 1];
  const cumulatief_start_km = prev ? prev.cumulatief_start_km + (prev.afstand_km ?? 0) : 0;
  acc.push({ ...leg, afstand_km, cumulatief_start_km });
  return acc;
}, []);

export const FIXTURE_STATUSES = computeLegStatuses(FIXTURE_LEGS, FIXTURE_NOW);

// Two check-ins with a GPS pin (a "photo stop" slightly off the leg's own
// marker, same as a real /invoer submission with location) plus one without
// a pin, checked in well before FIXTURE_NOW (40 min for leg 3) so the
// live-estimate marker (see the "schatting" preview below) has visibly
// progressed along the polyline instead of sitting on top of the CP dot.
export const FIXTURE_CHECKINS: Checkin[] = [
  {
    party: "team",
    tijdstip: tijd("07:05"),
    leg_nr: 1,
    lat: 53.1978,
    lon: 5.7502,
    notitie: "Vertrokken, goed weer",
    invoerder: "Sjoerd",
  },
  {
    party: "team",
    tijdstip: tijd("10:45"),
    leg_nr: 2,
    lat: null,
    lon: null,
    notitie: null,
    invoerder: "Sjoerd",
  },
  {
    party: "team",
    tijdstip: tijd("11:30"),
    leg_nr: 3,
    lat: null,
    lon: null,
    notitie: null,
    invoerder: "Sjoerd",
  },
];

export const FIXTURE_CHECKIN_TIMES = firstCheckinTimesByLeg(FIXTURE_CHECKINS);
export const FIXTURE_CHECKINS_BY_LEG = firstCheckinByLeg(FIXTURE_CHECKINS);

// A fresh GPS fix roughly along the IJlst -> Sloten stretch, for the
// "live GPS" preview variant (solid dot). The "schatting" variant below
// passes an empty array instead, so RouteMap falls back to
// estimateLivePosition from FIXTURE_CHECKINS (dashed ring).
export const FIXTURE_LIVE_POSITIONS: LivePositionRow[] = [
  {
    party: "team",
    lat: 53.111,
    lon: 5.7233,
    recordedAt: new Date(FIXTURE_NOW - 30_000).toISOString(),
  },
];

export const FIXTURE_START: LatLng = TRACK[0];

// A second, tighter fixture over a ~19km contiguous stretch of the same GPX
// file (raw points, not the every-20th subsample above) — the full-route
// fixture above spans the whole ~150km loop, which fitBounds zooms out far
// enough that CP labels stay hidden (see labelModeForZoom); this one is
// small enough to auto-zoom past that threshold, purely so the permanent
// CP pill and hover tooltip are visible on the initial screenshot without
// needing an interactive zoom.
const CLOSEUP_TRACK: LatLng[] = [
  [53.20234, 5.7695], [53.20213, 5.76994], [53.20162, 5.76983], [53.20169, 5.76856],
  [53.20178, 5.76739], [53.20188, 5.76675], [53.20173, 5.76665], [53.20104, 5.76621],
  [53.19957, 5.76601], [53.19843, 5.76591], [53.19617, 5.76591], [53.19547, 5.76599],
  [53.19524, 5.76578], [53.19341, 5.76548], [53.1932, 5.76541], [53.19306, 5.76497],
  [53.19288, 5.76366], [53.19221, 5.75887], [53.19239, 5.75672], [53.19282, 5.75366],
  [53.19278, 5.75328], [53.19226, 5.75138], [53.19105, 5.74903], [53.19078, 5.74781],
  [53.19078, 5.74611], [53.19069, 5.74423], [53.19009, 5.73809], [53.1903, 5.73613],
  [53.18984, 5.73491], [53.18937, 5.7346], [53.1885, 5.73392], [53.18751, 5.73358],
  [53.18644, 5.73307], [53.18549, 5.73184], [53.18501, 5.73145], [53.18479, 5.73144],
  [53.18351, 5.73125], [53.18302, 5.73115], [53.18277, 5.73107], [53.18221, 5.73082],
  [53.18152, 5.73054], [53.1811, 5.73106], [53.18084, 5.73177], [53.18056, 5.73141],
  [53.18039, 5.73183], [53.1801, 5.73228], [53.17975, 5.73284], [53.17961, 5.73307],
  [53.17929, 5.73344], [53.17911, 5.73361], [53.1788, 5.73393], [53.17785, 5.73488],
  [53.1766, 5.73539], [53.17401, 5.73653], [53.17217, 5.73748], [53.17134, 5.73807],
  [53.16998, 5.73912], [53.16929, 5.73972], [53.16873, 5.74006], [53.16813, 5.74049],
  [53.16782, 5.74071], [53.16732, 5.74122], [53.1665, 5.74178], [53.16598, 5.74214],
  [53.16494, 5.74299], [53.16366, 5.74385], [53.16265, 5.74414], [53.1623, 5.74413],
  [53.16193, 5.74405], [53.16156, 5.744], [53.16091, 5.74409], [53.16024, 5.74421],
  [53.15975, 5.74429], [53.15931, 5.74439], [53.15869, 5.74455], [53.15607, 5.74505],
  [53.15441, 5.74533], [53.15413, 5.74538], [53.15256, 5.74554], [53.14979, 5.74595],
  [53.14875, 5.74589], [53.14849, 5.74577], [53.14814, 5.7457], [53.14762, 5.74559],
  [53.14718, 5.74552], [53.14645, 5.7454], [53.14609, 5.74535], [53.14549, 5.74518],
  [53.14474, 5.74457], [53.14431, 5.74405], [53.14393, 5.74312], [53.14317, 5.7413],
  [53.14269, 5.74008], [53.14156, 5.73796], [53.13957, 5.73641], [53.13696, 5.73419],
  [53.13472, 5.73219], [53.13376, 5.73136], [53.13186, 5.73018], [53.12971, 5.7302],
  [53.12857, 5.73018], [53.12656, 5.73022], [53.12503, 5.73018], [53.12346, 5.73096],
  [53.12174, 5.73215], [53.11972, 5.73402], [53.11809, 5.73534], [53.11745, 5.73588],
  [53.11624, 5.73666], [53.1158, 5.73674], [53.11486, 5.73704], [53.11272, 5.73637],
  [53.11215, 5.73581], [53.11143, 5.7348], [53.11096, 5.73423], [53.11075, 5.73397],
  [53.11045, 5.73358], [53.1102, 5.73328], [53.10989, 5.73363], [53.10961, 5.73408],
  [53.10932, 5.73457], [53.1082, 5.73663], [53.10752, 5.73797], [53.10654, 5.73616],
  [53.10575, 5.73713], [53.1047, 5.73513], [53.1031, 5.73134], [53.10256, 5.72941],
  [53.10065, 5.72663], [53.09988, 5.72453], [53.09788, 5.7223], [53.09641, 5.72067],
  [53.09537, 5.7186], [53.09369, 5.71516], [53.09341, 5.71444], [53.09345, 5.71431],
  [53.09336, 5.71515], [53.09173, 5.71785], [53.09099, 5.71837], [53.09069, 5.71842],
  [53.09043, 5.71868], [53.09064, 5.71902], [53.09043, 5.71868], [53.09, 5.71745],
  [53.08729, 5.71508], [53.08658, 5.7147], [53.08496, 5.71378], [53.08021, 5.71232],
  [53.07899, 5.71124], [53.07663, 5.70629], [53.07526, 5.70432], [53.07126, 5.70102],
  [53.07012, 5.6995], [53.06955, 5.699], [53.06939, 5.69839], [53.06735, 5.69443],
  [53.06547, 5.6904], [53.0644, 5.68869], [53.06221, 5.68671], [53.06034, 5.68413],
  [53.05941, 5.68284], [53.05797, 5.68147], [53.05754, 5.68132], [53.05749, 5.6805],
  [53.05787, 5.68028], [53.0578, 5.6798], [53.05769, 5.67926], [53.056, 5.6786],
  [53.05497, 5.67844], [53.05302, 5.67863], [53.0517, 5.67842], [53.05147, 5.67842],
  [53.05116, 5.67842], [53.05096, 5.67757], [53.05059, 5.67671], [53.05022, 5.6768],
  [53.04867, 5.67712], [53.04859, 5.67736], [53.04836, 5.67734], [53.04828, 5.67715],
  [53.04729, 5.67694], [53.04639, 5.67626], [53.04458, 5.67453], [53.04202, 5.67145],
  [53.04102, 5.66993], [53.04026, 5.66892], [53.03928, 5.66808], [53.03831, 5.6673],
  [53.03745, 5.66675], [53.03652, 5.66606], [53.03493, 5.66432], [53.03459, 5.66395],
  [53.03449, 5.66356], [53.03411, 5.661], [53.03391, 5.66107], [53.03372, 5.66045],
  [53.03393, 5.65868], [53.03384, 5.65779], [53.0339, 5.65728], [53.03399, 5.65709],
];

const CLOSEUP_LEG_START_IDX = [0, 40, 80, 120, 160, 199];
const CLOSEUP_NAMES = ["Leeuwarden", "Warga", "Grou", "Akkrum", "Heerenveen", "Wolvega (finish)"];
// Deliberately spread across FIXTURE_NOW (12:10) the same way the main
// fixture's times are, so this close-up shows the same voltooid/bezig/nog
// mix rather than everything reading "voltooid" (which a plain +1h-per-leg
// schedule would, since FIXTURE_NOW is well past all of them).
const CLOSEUP_TIMES = ["07:00", "07:40", "12:05", "13:00", "14:00", "15:00"];

export const CLOSEUP_LEGS: Leg[] = CLOSEUP_LEG_START_IDX.map((idx, i) => {
  const isFinish = i === CLOSEUP_LEG_START_IDX.length - 1;
  return {
    nr: i + 1,
    start_plaats: CLOSEUP_NAMES[i],
    afstand_km: isFinish ? null : 4,
    loper: isFinish ? null : "Lowie",
    loper_bjorn: null,
    cumulatief_start_km: i * 4,
    start_lat: CLOSEUP_TRACK[idx][0],
    start_lon: CLOSEUP_TRACK[idx][1],
    geplande_tijd: tijd(CLOSEUP_TIMES[i]),
    cp_nummer: isFinish ? null : i + 1,
    adres: null,
    bijzonderheden: null,
  };
});

export const CLOSEUP_LEG_SEGMENTS: LegSegment[] = CLOSEUP_LEGS.map((leg, i) => {
  const startIdx = CLOSEUP_LEG_START_IDX[i];
  const endIdx = i + 1 < CLOSEUP_LEGS.length ? CLOSEUP_LEG_START_IDX[i + 1] : startIdx;
  return {
    leg,
    positions: CLOSEUP_TRACK.slice(startIdx, endIdx + 1),
    effortKm: leg.afstand_km !== null ? leg.afstand_km * 1.05 : 0,
  };
});

export const CLOSEUP_EFFORT_LEGS: Leg[] = CLOSEUP_LEGS;

export const CLOSEUP_STATUSES = computeLegStatuses(CLOSEUP_LEGS, FIXTURE_NOW);
export const CLOSEUP_START: LatLng = CLOSEUP_TRACK[0];
