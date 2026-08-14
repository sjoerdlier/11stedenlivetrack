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
});
