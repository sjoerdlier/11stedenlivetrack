// Optional upgrade over the free browser voice (see voiceSelection.ts /
// ReadAloudPanel.tsx): when GOOGLE_TTS_API_KEY is set, /update's text is
// also synthesized server-side via Google Cloud Text-to-Speech, once per
// cache window (see the outer unstable_cache in app/update/page.tsx) and
// shared across every visitor — so this pays for one synthesis call per
// window, not one per visitor. Without the key, generateJournalForRoute
// simply returns null audio and ReadAloudPanel falls back to the browser's
// own voice exactly as before.

export interface GoogleVoiceInfo {
  name: string;
  languageCodes: string[];
}

// Neural2 > WaveNet > Standard — Google's actual quality tiers, checked in
// that order since not every tier is guaranteed to exist for nl-NL and the
// API gives no other quality signal on the voice object itself. Mirrors the
// name-pattern heuristic in voiceSelection.ts, but over Google's fixed tier
// vocabulary instead of a free-form browser voice name.
const PREFERRED_TIER_PATTERNS = [/neural2/i, /wavenet/i, /standard/i];

// Pure selection logic, split out from the network call so it's testable
// without mocking fetch.
export function pickPreferredVoiceName(voices: readonly GoogleVoiceInfo[]): string | null {
  const nlNl = voices.filter((v) => v.languageCodes.includes("nl-NL"));
  if (nlNl.length === 0) return null;

  for (const pattern of PREFERRED_TIER_PATTERNS) {
    const match = nlNl.find((v) => pattern.test(v.name));
    if (match) return match.name;
  }
  return nlNl[0].name;
}

async function fetchPreferredVoiceName(apiKey: string): Promise<string | null> {
  const res = await fetch("https://texttospeech.googleapis.com/v1/voices?languageCode=nl-NL", {
    headers: { "X-Goog-Api-Key": apiKey },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { voices?: GoogleVoiceInfo[] };
  return pickPreferredVoiceName(data.voices ?? []);
}

// Never throws — a missing key, exhausted quota, or any Cloud TTS hiccup
// falls back to the free browser voice, the same degrade-softly contract
// generateJournalText already has around a missing ANTHROPIC_API_KEY.
export async function synthesizeSpeech(text: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return null;

  try {
    const voiceName = await fetchPreferredVoiceName(apiKey);
    if (!voiceName) return null;

    const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "nl-NL", name: voiceName },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });
    if (!res.ok) {
      console.error("synthesizeSpeech: Cloud TTS returned", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as { audioContent?: string };
    return data.audioContent ?? null;
  } catch (err) {
    console.error("synthesizeSpeech: Cloud TTS call failed", err);
    return null;
  }
}
