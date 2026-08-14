import Anthropic from "@anthropic-ai/sdk";
import type { Leg } from "./legs";
import type { Checkin } from "./checkins";
import type { WeatherSnapshot } from "./weather";
import type { PartyConfig } from "./parties";
import { partiesForRoute } from "./parties";
import {
  actualAveragePaceKmh,
  computeActualProgress,
  currentScheduleDelta,
  estimateArrival,
  estimateArrivalForecast,
  firstCheckinTimesByLeg,
  type ArrivalForecast,
  type EstimatedArrival,
  type ScheduleDelta,
} from "./actualProgress";
import { daysUntilStart, totalPlannedPaceKmh, totalRouteKm } from "./status";
import {
  formatClockTime,
  formatKm,
  formatPaceKmh,
  formatScheduleDelta,
  formatTemperatureC,
  formatTimeOnly,
  formatWindKmh,
} from "./format";
import { routeConfig, type RouteSlug } from "./routes";
import { getCachedCheckins, getCachedLegs, getCachedWeather } from "./cachedData";
import { synthesizeSpeech } from "./googleTts";

// Cheap/fast model — this is a short, low-stakes factual summary, not a
// task that benefits from a larger model's extra reasoning.
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 500;

export interface PartySnapshot {
  label: string;
  percent: number;
  km: number;
  remainingKm: number;
  paceKmh: number | null;
  scheduleDelta: ScheduleDelta | null;
  arrival: EstimatedArrival | null;
  // A range instead of arrival's single instant, once enough legs have
  // been walked to resample a real spread from (see
  // estimateArrivalForecast) — null under the same "not enough data yet"
  // condition that also leaves arrival.basis as "gepland".
  arrivalForecast: ArrivalForecast | null;
  lastNote: string | null;
  // Where they last checked in, and where they're headed next (null once
  // that last check-in was the finish leg itself) — a place name is what
  // the map's moving marker actually conveys to a sighted visitor. A raw
  // percentage alone doesn't translate that; pairing it with "onderweg van
  // X naar Y" does.
  currentPlaats: string | null;
  nextPlaats: string | null;
}

// Mirrors the same computation TopBar/LegSchedule already do per party
// (computeActualProgress + actualAveragePaceKmh + estimateArrival +
// currentScheduleDelta) — kept here rather than imported as one combined
// helper since nothing else needs exactly this bundle. null before that
// party's first check-in, the same "not started yet" signal the rest of
// the site uses.
export function buildPartySnapshot(
  party: PartyConfig,
  legs: Leg[],
  partyCheckins: Checkin[],
  totalKm: number,
  plannedPaceKmh: number | null,
  now: number,
): PartySnapshot | null {
  if (partyCheckins.length === 0) return null;

  const checkinTimes = firstCheckinTimesByLeg(partyCheckins);
  const progress = computeActualProgress(legs, checkinTimes);
  const remainingKm = Math.max(0, totalKm - progress.km);
  const paceKmh = actualAveragePaceKmh(checkinTimes, progress.km, now);
  const arrival = estimateArrival(now, remainingKm, paceKmh, plannedPaceKmh, partyCheckins.length);
  const arrivalForecast = estimateArrivalForecast(legs, checkinTimes, now);
  const scheduleDelta = currentScheduleDelta(legs, checkinTimes);

  let lastNote: string | null = null;
  let lastNoteTime = -Infinity;
  for (const c of partyCheckins) {
    const t = new Date(c.tijdstip).getTime();
    if (c.notitie && t > lastNoteTime) {
      lastNoteTime = t;
      lastNote = c.notitie;
    }
  }

  // Same "latest reached leg" pick currentScheduleDelta makes internally,
  // redone here to also read off its place name (and the leg right after
  // it) rather than just its schedule delta.
  let currentPlaats: string | null = null;
  let nextPlaats: string | null = null;
  let latestIndex = -1;
  legs.forEach((leg, index) => {
    if (checkinTimes.has(leg.nr) && index > latestIndex) latestIndex = index;
  });
  if (latestIndex !== -1) {
    currentPlaats = legs[latestIndex].start_plaats;
    nextPlaats = legs[latestIndex + 1]?.start_plaats ?? null;
  }

  return {
    label: party.label,
    percent: progress.percent,
    km: progress.km,
    remainingKm,
    paceKmh,
    scheduleDelta,
    arrival,
    arrivalForecast,
    lastNote,
    currentPlaats,
    nextPlaats,
  };
}

export interface JournalInput {
  routeDescription: string;
  countdownDays: number | null;
  parties: { party: PartyConfig; snapshot: PartySnapshot | null }[];
  weather: WeatherSnapshot | null;
}

// The entire point of this prompt is that it must never say anything the
// facts below don't support — this is read aloud to blind/low-vision
// visitors as a factual update, not a piece of marketing copy, so a
// plausible-sounding invention here is a real harm, not just a rough edge.
export function buildPrompt(input: JournalInput): string {
  const lines: string[] = [
    `Je schrijft een kort, gesproken update-verslag over de ${input.routeDescription}, een tocht van 204 km die Lowie van Eck en Björn van Loon geblinddoekt lopen voor OOG voor Maja / het Oogfonds.`,
    "Je publiek bestaat vooral uit blinde en slechtziende luisteraars die dit laten voorlezen door een tekst-naar-spraak-stem. Zij zien de kaart, de voortgangsbalk en de kleuren op de site niet — vertaal wat daar te zien zou zijn in woorden. Noem daarom bij voorkeur wáár iemand is (bij welke plaats, of onderweg van welke plaats naar welke plaats) in plaats van alleen een percentage — een percentage mag er ter ondersteuning bij, maar nooit als enige aanduiding van positie.",
    "Gebruik nooit woorden die ervan uitgaan dat de luisteraar iets ziet, zoals \"hier is\", \"zoals je ziet\" of \"hierboven\".",
    "Blijf strikt feitelijk en neutraal: beschrijf alleen wat meetbaar is, geef geen mening en overdrijf niet.",
    "Gebruik UITSLUITEND de feiten hieronder. Verzin nooit een plaats, tijd, percentage of gebeurtenis die er niet letterlijk in staat. Ontbreekt iets, laat het dan gewoon weg in plaats van te gokken.",
    "Vermijd tekst die aanvoelt als AI-gegenereerd: geen hype-bijvoeglijke naamwoorden (\"indrukwekkend\", \"bijzonder\", \"prachtig\", \"betekenisvol\", \"fascinerend\", \"uitzonderlijk\"), geen stijve overgangswoorden (\"echter\", \"bovendien\", \"daarentegen\", \"niet alleen ... maar ook\"), en geen samenvattende slotzin (\"kortom\", \"al met al\"). Schrijf direct en gewoon, zoals je het aan iemand naast je zou vertellen.",
    "Schrijf vloeiend Nederlands, tegenwoordige tijd, ongeveer 100 tot 150 woorden, als één ononderbroken alinea zonder witregels.",
    "Dit is platte tekst voor een tekst-naar-spraak-stem, geen geschreven document: gebruik GEEN markdown-opmaak. Dus geen titel, geen #-kopjes, geen sterretjes voor vet/cursief, geen opsommingstekens — anders spreekt de stem die tekens letterlijk uit.",
    "",
    "Feiten:",
  ];

  if (input.countdownDays !== null) {
    lines.push(
      `- De tocht is nog niet begonnen: nog ${input.countdownDays} ${input.countdownDays === 1 ? "dag" : "dagen"} tot de start.`,
    );
    // Only worth explaining before the tocht starts — once it's underway,
    // the update itself demonstrates what it does, so this line drops out
    // (see the loop below, which only runs once a party has a snapshot).
    lines.push(
      "- Leg kort uit wat deze update doet zodra de tocht wel begonnen is: dan is hier steeds te horen tussen welke plaatsen Lowie en Björn onderweg zijn, hoeveel kilometer ze al gelopen hebben, hun tempo, of ze voor of achter op het schema liggen, en het weer onderweg.",
    );
  }

  const anyStarted = input.parties.some(({ snapshot }) => snapshot !== null);
  if (input.countdownDays === null && !anyStarted) {
    lines.push("- De tocht is begonnen, maar er zijn nog geen check-ins binnengekomen.");
  }

  for (const { party, snapshot } of input.parties) {
    if (!snapshot) continue;
    if (snapshot.nextPlaats) {
      lines.push(`- ${party.label} is onderweg van ${snapshot.currentPlaats} naar ${snapshot.nextPlaats}.`);
    } else if (snapshot.currentPlaats) {
      lines.push(`- ${party.label} heeft de finish bereikt, in ${snapshot.currentPlaats}.`);
    }
    lines.push(
      `- ${party.label}: ${formatKm(snapshot.km)} afgelegd (${Math.round(snapshot.percent)}% van de route), nog ${formatKm(snapshot.remainingKm)} te gaan.`,
    );
    if (snapshot.paceKmh !== null) {
      lines.push(`- ${party.label} loopt nu gemiddeld ${formatPaceKmh(snapshot.paceKmh)}.`);
    }
    if (snapshot.scheduleDelta) {
      lines.push(`- ${party.label} loopt ${formatScheduleDelta(snapshot.scheduleDelta)} op het geplande schema.`);
    }
    if (snapshot.arrivalForecast) {
      // A range instead of one falsely-precise instant — tell the model to
      // say so as a range, not just pick the median and drop the spread.
      lines.push(
        `- Verwachte aankomst van ${party.label} bij de finish: rond ${formatClockTime(snapshot.arrivalForecast.median)}, ergens tussen ${formatTimeOnly(snapshot.arrivalForecast.earliest)} en ${formatTimeOnly(snapshot.arrivalForecast.latest)}.`,
      );
    } else if (snapshot.arrival) {
      lines.push(`- Verwachte aankomst van ${party.label} bij de finish: rond ${formatClockTime(snapshot.arrival.time)}.`);
    }
    if (snapshot.lastNote) {
      lines.push(`- Laatste notitie bij een check-in van ${party.label}: "${snapshot.lastNote}"`);
    }
  }

  if (input.weather) {
    lines.push(
      `- Weer bij het startpunt van de route: ${formatTemperatureC(input.weather.temperatureC)}, ${input.weather.description}, ${formatWindKmh(input.weather.windKmh)}.`,
    );
  }

  return lines.join("\n");
}

// Defensive cleanup for whatever markdown slips through despite the
// prompt's "no markdown" instruction — a stray "#" or "**" read aloud
// verbatim by a screen reader's voice would be jarring for exactly the
// audience this page serves, so this is enforced in code rather than
// trusted to the model alone. Also collapses the model's paragraph breaks
// into one flowing block of text, matching the "één ononderbroken alinea"
// instruction even when it isn't followed exactly.
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

// Never throws — a missing API key or an Anthropic hiccup during a live
// event shouldn't be able to take /update down, same contract as
// loadWeather's callers. Returns null for "nothing to show right now"; the
// page renders a plain "niet beschikbaar" message for that case.
export async function generateJournalText(input: JournalInput): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.4,
      messages: [{ role: "user", content: buildPrompt(input) }],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return stripMarkdown(text) || null;
  } catch (err) {
    console.error("generateJournalText: Anthropic API call failed", err);
    return null;
  }
}

export interface JournalResult {
  text: string;
  // Google Cloud TTS audio for `text`, base64-encoded MP3 — null when
  // GOOGLE_TTS_API_KEY isn't set or synthesis failed, in which case
  // ReadAloudPanel falls back to the free browser voice.
  audioBase64: string | null;
  // Which Google voice produced audioBase64 (e.g. "nl-NL-Wavenet-B") —
  // null whenever audioBase64 is. Surfaced in ?debugVoices=1 so a report
  // like "this sounds Flemish" can be checked against the actual voice ID
  // instead of guessed at.
  voiceName: string | null;
}

// The full pipeline for one route: gather the same live data the rest of
// the site already shows, have it narrated, then (best-effort) synthesized.
// Reads through the shared cachedData.ts loaders (same 20s/1800s cache
// buckets page.tsx and /api/poll use) rather than hitting Supabase/
// Open-Meteo directly, so generating a journal never pays for its own
// uncached round-trip. Callers (see app/update/page.tsx) wrap this again in
// a longer-lived unstable_cache keyed on route alone, so a burst of visitors
// clicking "Lees voor" within a few minutes of each other shares one
// Anthropic call and one Cloud TTS call instead of each paying for their
// own. voiceNameOverride (see /update?voice=<name>) forces a specific
// Google voice instead of the auto-picked one — only used to A/B a
// candidate voice on demand, not part of normal traffic.
export async function generateJournalForRoute(
  route: RouteSlug,
  voiceNameOverride?: string,
): Promise<JournalResult | null> {
  const config = routeConfig(route);
  const parties = partiesForRoute(route);
  const now = Date.now();

  const [legs, checkins] = await Promise.all([getCachedLegs(route), getCachedCheckins(route)]);

  const totalKm = totalRouteKm(legs);
  const plannedPaceKmh = totalPlannedPaceKmh(legs);
  const countdownDays = daysUntilStart(legs, now);

  const startLeg = legs[0];
  let weather: WeatherSnapshot | null = null;
  if (startLeg) {
    try {
      weather = await getCachedWeather(startLeg.start_lat, startLeg.start_lon);
    } catch (err) {
      console.error(`generateJournalForRoute(${route}): loading weather failed`, err);
      weather = null;
    }
  }

  const partySnapshots = parties.map((party) => ({
    party,
    snapshot: buildPartySnapshot(
      party,
      legs,
      checkins.filter((c) => c.party === party.slug),
      totalKm,
      plannedPaceKmh,
      now,
    ),
  }));

  const text = await generateJournalText({
    routeDescription: config.routeDescription,
    countdownDays,
    parties: partySnapshots,
    weather,
  });
  if (!text) return null;

  const synthesized = await synthesizeSpeech(text, voiceNameOverride);
  return {
    text,
    audioBase64: synthesized?.audioBase64 ?? null,
    voiceName: synthesized?.voiceName ?? null,
  };
}
