import { describe, expect, it } from "vitest";
import { pickBestDutchVoice, type VoiceLike } from "./voiceSelection";

describe("pickBestDutchVoice", () => {
  it("returns null when no Dutch voice is installed", () => {
    const voices: VoiceLike[] = [{ name: "Daniel", lang: "en-GB" }];
    expect(pickBestDutchVoice(voices)).toBeNull();
  });

  it("prefers a Google-branded voice over the classic system default", () => {
    const voices: VoiceLike[] = [
      { name: "Dutch", lang: "nl-NL" },
      { name: "Google Nederlands", lang: "nl-NL" },
    ];
    expect(pickBestDutchVoice(voices)?.name).toBe("Google Nederlands");
  });

  it("prefers a Windows-style '(Natural)' neural voice", () => {
    const voices: VoiceLike[] = [
      { name: "Microsoft Frank - Dutch (Netherlands)", lang: "nl-NL" },
      { name: "Microsoft Colette Online (Natural) - Dutch (Netherlands)", lang: "nl-NL" },
    ];
    expect(pickBestDutchVoice(voices)?.name).toBe("Microsoft Colette Online (Natural) - Dutch (Netherlands)");
  });

  it("falls back to nl-NL over nl-BE when no name signals a preferred engine", () => {
    const voices: VoiceLike[] = [
      { name: "Ellen", lang: "nl-BE" },
      { name: "Xander", lang: "nl-NL" },
    ];
    expect(pickBestDutchVoice(voices)?.name).toBe("Xander");
  });

  it("falls back to the first Dutch voice when nothing else distinguishes them", () => {
    const voices: VoiceLike[] = [
      { name: "Xander", lang: "nl-NL" },
      { name: "Claire", lang: "nl-NL" },
    ];
    expect(pickBestDutchVoice(voices)?.name).toBe("Xander");
  });

  it("still prefers nl-NL over nl-BE when the device reports Locale-style underscored tags", () => {
    // Android's system TTS engine reports "nl_BE"/"nl_NL" instead of the
    // BCP-47 "nl-BE"/"nl-NL" the spec calls for — a real device listed
    // "Nederlands België" (nl_BE) before "Nederlands Nederland" (nl_NL),
    // and without normalizing the separator this silently fell through to
    // whichever came first in the list instead of ever matching "nl-nl".
    const voices: VoiceLike[] = [
      { name: "Nederlands België", lang: "nl_BE" },
      { name: "Nederlands Nederland", lang: "nl_NL" },
    ];
    expect(pickBestDutchVoice(voices)?.name).toBe("Nederlands Nederland");
  });

  it("still detects a Dutch voice at all when its tag uses an underscore", () => {
    const voices: VoiceLike[] = [{ name: "Nederlands Nederland", lang: "nl_NL" }];
    expect(pickBestDutchVoice(voices)).not.toBeNull();
  });
});
