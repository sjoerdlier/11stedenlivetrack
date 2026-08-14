export interface VoiceLike {
  name: string;
  lang: string;
}

// The Web Speech API exposes no quality field, so this is a best-effort
// heuristic over voice *names* — not standardized across browsers/OSes,
// but a few patterns reliably signal a higher-quality (often cloud-backed
// or neural) voice over the classic robotic system default: Chrome/Edge's
// "Google ..." online voices, Windows' "... (Natural)" neural voices, and
// Android's WaveNet-based voices. Apple's own Dutch voices (Xander/Claire/
// Fenna) don't advertise quality in the name at all — they're already the
// best (and only) option on that platform, so no pattern is needed there.
const PREFERRED_NAME_PATTERNS = [/google/i, /natural/i, /neural/i, /wavenet/i, /online/i];

// The Web Speech API spec calls for BCP-47 tags ("nl-NL"), but several
// real implementations — notably Android's system TTS engine — report
// Java Locale-style tags ("nl_NL") instead. Normalizing the separator
// before comparing is what makes the nl-NL/nl-BE preference below (and the
// Dutch-detection filter) actually work on those devices instead of
// silently never matching.
function normalizeLang(lang: string): string {
  return lang.toLowerCase().replace(/_/g, "-");
}

// Picks the best-sounding installed Dutch voice available for free, rather
// than leaving it to whichever one the browser lists first — that's often
// an older, more robotic voice even when a much better one is installed
// right alongside it. Returns null if no Dutch voice exists at all,
// letting the caller fall back to the browser's own default voice choice.
export function pickBestDutchVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  const dutch = voices.filter((v) => normalizeLang(v.lang).startsWith("nl"));
  if (dutch.length === 0) return null;

  for (const pattern of PREFERRED_NAME_PATTERNS) {
    const match = dutch.find((v) => pattern.test(v.name));
    if (match) return match;
  }

  // No name signaled a preferred engine — nl-NL (Netherlands) over e.g.
  // nl-BE (Belgian Dutch) if both exist, else whichever Dutch voice is
  // first.
  return dutch.find((v) => normalizeLang(v.lang) === "nl-nl") ?? dutch[0];
}
