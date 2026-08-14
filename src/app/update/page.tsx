import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { generateJournalForRoute } from "@/lib/aiJournal";
import { listNlNlVoiceNames } from "@/lib/googleTts";
import { parseRouteSlug, routeConfig, socialMetadata } from "@/lib/routes";
import ReadAloudPanel from "./ReadAloudPanel";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

// Wrapped again on top of generateJournalForRoute's own (already-cached)
// data reads — this outer cache is what actually saves an Anthropic call
// (and, when GOOGLE_TTS_API_KEY is set, a Cloud TTS call): a burst of
// visitors opening /update within a few minutes of each other (e.g. right
// after a "check dit uit" share) all get the same generated text and audio
// instead of each triggering their own. 5 minutes is short enough to stay
// well ahead of how often check-ins actually arrive during the event (legs
// are roughly 1.5-3 hours apart on foot), so nobody hears a stale update for
// long, while keeping both APIs' free-tier usage comfortably within quota
// for a page that could see bursty live-event traffic.
const getCachedJournal = unstable_cache(generateJournalForRoute, ["ai-journal"], { revalidate: 300 });

interface UpdatePageProps {
  // voice: forces a specific Google TTS voice (see /lib/googleTts.ts) to A/B
  // candidates against a "sounds Flemish" style report without a redeploy.
  // debugVoices: also lists every available nl-NL voice name so a new
  // candidate can be picked without guessing at what exists.
  searchParams: Promise<{ route?: string; voice?: string; debugVoices?: string }>;
}

export async function generateMetadata({ searchParams }: UpdatePageProps): Promise<Metadata> {
  const { route } = await searchParams;
  const config = routeConfig(parseRouteSlug(route));
  return socialMetadata(
    `Live update — ${config.pageTitle}`,
    `Gesproken live-update van de ${config.routeDescription}, voorgelezen door de browser.`,
  );
}

export default async function UpdatePage({ searchParams }: UpdatePageProps) {
  const { route, voice, debugVoices } = await searchParams;
  const activeRoute = parseRouteSlug(route);
  const config = routeConfig(activeRoute);

  // A missing ANTHROPIC_API_KEY/GOOGLE_TTS_API_KEY or an API hiccup already
  // resolves to null (text) / null (audio) inside generateJournalForRoute —
  // this try/catch only guards against the outer unstable_cache/Next
  // machinery itself failing, so /update degrades to its own "niet
  // beschikbaar" state instead of the whole page erroring out.
  let text: string | null = null;
  let audioSrc: string | null = null;
  let voiceName: string | null = null;
  try {
    // ?voice=<name> forces a specific candidate voice — routed through the
    // same cache, keyed on (route, voice) together, so it never disturbs
    // the normal cached entry visitors without that param get.
    const result = await getCachedJournal(activeRoute, voice);
    if (result) {
      text = result.text;
      audioSrc = result.audioBase64 ? `data:audio/mpeg;base64,${result.audioBase64}` : null;
      voiceName = result.voiceName;
    }
  } catch (err) {
    console.error(`UpdatePage(${activeRoute}): generating AI journal failed`, err);
  }

  let availableVoiceNames: string[] = [];
  if (debugVoices) {
    try {
      availableVoiceNames = await listNlNlVoiceNames();
    } catch (err) {
      console.error(`UpdatePage(${activeRoute}): listing nl-NL voices failed`, err);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.nav}>
        <Link href={`/?route=${activeRoute}`}>← Terug naar de kaart</Link>
      </div>
      <h1 className={styles.title}>Live update</h1>
      <p className={styles.subtitle}>{config.pageTitle}</p>
      <ReadAloudPanel
        text={text}
        audioSrc={audioSrc}
        voiceName={voiceName}
        availableVoiceNames={availableVoiceNames}
      />
    </main>
  );
}
