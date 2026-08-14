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
  firstCheckinTimesByLeg,
  type EstimatedArrival,
  type ScheduleDelta,
} from "./actualProgress";
import { daysUntilStart, totalPlannedPaceKmh, totalRouteKm } from "./status";
import { formatClockTime, formatKm, formatPaceKmh, formatScheduleDelta, formatTemperatureC, formatWindKmh } from "./format";
import { routeConfig, type RouteSlug } from "./routes";
import { getCachedCheckins, getCachedLegs, getCachedWeather } from "./cachedData";

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
  lastNote: string | null;
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

  return {
    label: party.label,
    percent: progress.percent,
    km: progress.km,
    remainingKm,
    paceKmh,
    scheduleDelta,
    arrival,
    lastNote,
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
    "Je publiek bestaat vooral uit blinde en slechtziende luisteraars die dit verslag laten voorlezen door een tekst-naar-spraak-stem — beschrijf dus alles in woorden, ga er nooit van uit dat iemand een kaart, grafiek of voortgangsbalk ziet.",
    "Gebruik UITSLUITEND de feiten hieronder. Verzin nooit een plaats, tijd, percentage of gebeurtenis die er niet letterlijk in staat. Ontbreekt iets, laat het dan gewoon weg in plaats van te gokken.",
    "Schrijf vloeiend Nederlands, tegenwoordige tijd, ongeveer 100 tot 150 woorden, als één ononderbroken alinea zonder witregels — zoals een radioverslaggever het hardop zou vertellen.",
    "Dit is platte tekst voor een tekst-naar-spraak-stem, geen geschreven document: gebruik GEEN markdown-opmaak. Dus geen titel, geen #-kopjes, geen sterretjes voor vet/cursief, geen opsommingstekens — anders spreekt de stem die tekens letterlijk uit.",
    "",
    "Feiten:",
  ];

  if (input.countdownDays !== null) {
    lines.push(
      `- De tocht is nog niet begonnen: nog ${input.countdownDays} ${input.countdownDays === 1 ? "dag" : "dagen"} tot de start.`,
    );
  }

  const anyStarted = input.parties.some(({ snapshot }) => snapshot !== null);
  if (input.countdownDays === null && !anyStarted) {
    lines.push("- De tocht is begonnen, maar er zijn nog geen check-ins binnengekomen.");
  }

  for (const { party, snapshot } of input.parties) {
    if (!snapshot) continue;
    lines.push(
      `- ${party.label}: ${formatKm(snapshot.km)} afgelegd (${Math.round(snapshot.percent)}% van de route), nog ${formatKm(snapshot.remainingKm)} te gaan.`,
    );
    if (snapshot.paceKmh !== null) {
      lines.push(`- ${party.label} loopt nu gemiddeld ${formatPaceKmh(snapshot.paceKmh)}.`);
    }
    if (snapshot.scheduleDelta) {
      lines.push(`- ${party.label} loopt ${formatScheduleDelta(snapshot.scheduleDelta)} op het geplande schema.`);
    }
    if (snapshot.arrival) {
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

// The full pipeline for one route: gather the same live data the rest of
// the site already shows, then have it narrated. Reads through the shared
// cachedData.ts loaders (same 20s/1800s cache buckets page.tsx and
// /api/poll use) rather than hitting Supabase/Open-Meteo directly, so
// generating a journal never pays for its own uncached round-trip. Callers
// (see app/update/page.tsx) wrap this again in a longer-lived unstable_cache
// keyed on route alone, so a burst of visitors clicking "Lees voor" within
// a few minutes of each other shares one Anthropic call instead of each
// paying for their own.
export async function generateJournalForRoute(route: RouteSlug): Promise<string | null> {
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

  return generateJournalText({
    routeDescription: config.routeDescription,
    countdownDays,
    parties: partySnapshots,
    weather,
  });
}
