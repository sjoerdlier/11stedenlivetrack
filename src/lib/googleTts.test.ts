import { afterEach, describe, expect, it } from "vitest";
import { pickPreferredVoiceName, synthesizeSpeech, type GoogleVoiceInfo } from "./googleTts";

describe("pickPreferredVoiceName", () => {
  it("returns null when no nl-NL voice is present", () => {
    const voices: GoogleVoiceInfo[] = [{ name: "en-US-Standard-A", languageCodes: ["en-US"] }];
    expect(pickPreferredVoiceName(voices)).toBeNull();
  });

  it("prefers Neural2 over WaveNet and Standard", () => {
    const voices: GoogleVoiceInfo[] = [
      { name: "nl-NL-Standard-A", languageCodes: ["nl-NL"] },
      { name: "nl-NL-Wavenet-B", languageCodes: ["nl-NL"] },
      { name: "nl-NL-Neural2-C", languageCodes: ["nl-NL"] },
    ];
    expect(pickPreferredVoiceName(voices)).toBe("nl-NL-Neural2-C");
  });

  it("prefers WaveNet over Standard when no Neural2 voice exists", () => {
    const voices: GoogleVoiceInfo[] = [
      { name: "nl-NL-Standard-A", languageCodes: ["nl-NL"] },
      { name: "nl-NL-Wavenet-B", languageCodes: ["nl-NL"] },
    ];
    expect(pickPreferredVoiceName(voices)).toBe("nl-NL-Wavenet-B");
  });

  it("falls back to the first nl-NL voice when no tier pattern matches", () => {
    const voices: GoogleVoiceInfo[] = [
      { name: "nl-NL-Studio-A", languageCodes: ["nl-NL"] },
      { name: "nl-NL-Studio-B", languageCodes: ["nl-NL"] },
    ];
    expect(pickPreferredVoiceName(voices)).toBe("nl-NL-Studio-A");
  });

  it("ignores a voice whose languageCodes cover a different Dutch locale", () => {
    const voices: GoogleVoiceInfo[] = [{ name: "nl-BE-Standard-A", languageCodes: ["nl-BE"] }];
    expect(pickPreferredVoiceName(voices)).toBeNull();
  });
});

describe("synthesizeSpeech", () => {
  const originalKey = process.env.GOOGLE_TTS_API_KEY;

  afterEach(() => {
    process.env.GOOGLE_TTS_API_KEY = originalKey;
  });

  it("returns null without ever calling the API when no key is configured", async () => {
    delete process.env.GOOGLE_TTS_API_KEY;
    await expect(synthesizeSpeech("Test tekst.")).resolves.toBeNull();
  });
});
