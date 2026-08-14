"use client";

import { useEffect, useRef, useState } from "react";
import { pickBestDutchVoice } from "@/lib/voiceSelection";
import styles from "./ReadAloudPanel.module.css";

interface ReadAloudPanelProps {
  text: string | null;
  // Server-synthesized Google Cloud TTS audio for `text`, as a data: URI —
  // present only when GOOGLE_TTS_API_KEY is configured and synthesis
  // succeeded. Noticeably more human than the average installed browser
  // voice, so it's preferred whenever available; null falls back to the
  // Web Speech API path exactly as before.
  audioSrc: string | null;
  // Which Google voice produced audioSrc (e.g. "nl-NL-Wavenet-B") — shown
  // in the ?debugVoices=1 panel so a report like "this sounds Flemish" can
  // be checked against the real voice ID instead of guessed at.
  voiceName: string | null;
}

type PlaybackState = "idle" | "speaking" | "paused" | "error";

// Prefers server-generated Cloud TTS audio when available, falling back to
// the browser-native Web Speech API otherwise — free, no API key, no extra
// round-trip. Most devices already have a decent Dutch voice installed
// (Chrome/Edge's online "Google" voices, Windows' neural "(Natural)"
// voices, Apple's on-device voices) but the browser doesn't necessarily
// pick the best one by default — pickBestDutchVoice steers towards it
// instead of leaving that to chance.
export default function ReadAloudPanel({ text, audioSrc, voiceName }: ReadAloudPanelProps) {
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  // Same lazy-initializer pattern useSimulatedNow/AppShell's isDebugMode
  // use — computed once, SSR-safe (window is guarded, not read during the
  // render body directly).
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  // Covers browsers where getVoices() already has the full list on first
  // call (Firefox, Safari) — Chrome, which populates it asynchronously,
  // is covered by the voiceschanged listener below instead.
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(() =>
    typeof window !== "undefined" && "speechSynthesis" in window
      ? pickBestDutchVoice(window.speechSynthesis.getVoices())
      : null,
  );
  // ?debugVoices=1 — same query-flag convention as ?debugTime= (see
  // useSimulatedNow). The Web Speech API's actual voice list varies wildly
  // by device/OS/browser in ways no amount of guessing from a desk
  // reproduces, so this prints exactly what's installed instead — visit
  // this URL on the device in question and read/screenshot the list back.
  const [debugVoices] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debugVoices"),
  );
  const [allVoices, setAllVoices] = useState<SpeechSynthesisVoice[]>(() =>
    typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis.getVoices() : [],
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Flips once cloud audio playback has actually failed for this visit
  // (e.g. an old browser choking on the data: URI) — after that this panel
  // behaves exactly as if audioSrc had never been provided, rather than
  // retrying a path that just failed.
  const [cloudAudioFailed, setCloudAudioFailed] = useState(false);
  const usingCloudAudio = Boolean(audioSrc) && !cloudAudioFailed;

  useEffect(() => {
    if (!supported) return;
    function updateVoice() {
      const voices = window.speechSynthesis.getVoices();
      setVoice(pickBestDutchVoice(voices));
      setAllVoices(voices);
    }
    window.speechSynthesis.addEventListener("voiceschanged", updateVoice);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", updateVoice);
  }, [supported]);

  useEffect(() => {
    // Stops the voice if this page unmounts mid-sentence (route change) —
    // otherwise the browser (or the audio element) keeps talking over
    // whatever's shown next. Captured into a local so the cleanup closes
    // over the actual element rather than re-reading the ref (which may
    // already be null by the time this runs).
    const audioEl = audioRef.current;
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      audioEl?.pause();
    };
  }, []);

  function playBrowserVoice() {
    if (!text || !supported) {
      setPlayback("error");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "nl-NL";
    // Falls back to the browser's own default nl-NL voice when none of
    // the installed voices matched a preferred pattern (still correct,
    // just not necessarily the best-sounding one available).
    if (voice) utterance.voice = voice;
    utterance.onend = () => setPlayback("idle");
    utterance.onerror = (event) => {
      // "canceled"/"interrupted" fire on the *previous* utterance whenever
      // cancel() starts a new one or Stop is pressed — expected, not a
      // failure. Anything else (no matching voice installed, engine
      // unavailable) is a real failure worth telling the visitor about
      // instead of the button silently doing nothing, which on a device
      // with zero installed voices would otherwise look broken with no
      // explanation — exactly the wrong failure mode for the audience this
      // page is built for.
      if (event.error === "canceled" || event.error === "interrupted") return;
      console.error("ReadAloudPanel: speechSynthesis error", event.error);
      setPlayback("error");
    };
    window.speechSynthesis.speak(utterance);
    setPlayback("speaking");
  }

  function handlePlay() {
    if (!text) return;
    if (usingCloudAudio && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .then(() => setPlayback("speaking"))
        .catch(() => {
          setCloudAudioFailed(true);
          playBrowserVoice();
        });
      return;
    }
    playBrowserVoice();
  }

  function handlePause() {
    if (usingCloudAudio && audioRef.current) {
      audioRef.current.pause();
    } else {
      window.speechSynthesis.pause();
    }
    setPlayback("paused");
  }

  function handleResume() {
    if (usingCloudAudio && audioRef.current) {
      audioRef.current.play();
    } else {
      window.speechSynthesis.resume();
    }
    setPlayback("speaking");
  }

  function handleStop() {
    if (usingCloudAudio && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else {
      window.speechSynthesis.cancel();
    }
    setPlayback("idle");
  }

  if (!text) {
    return (
      <div className={styles.panel}>
        <p className={styles.unavailable}>
          Er is nu geen live update beschikbaar. Probeer het over een paar minuten opnieuw.
        </p>
      </div>
    );
  }

  const statusLabel =
    playback === "speaking" ? "Wordt voorgelezen" : playback === "paused" ? "Gepauzeerd" : null;
  const canPlay = usingCloudAudio || supported;

  return (
    <div className={styles.panel}>
      {usingCloudAudio && (
        <audio
          ref={audioRef}
          src={audioSrc ?? undefined}
          preload="none"
          onEnded={() => setPlayback("idle")}
          onError={() => {
            setCloudAudioFailed(true);
            setPlayback("idle");
          }}
        />
      )}
      <div className={styles.controls}>
        {canPlay ? (
          <>
            {(playback === "idle" || playback === "error") && (
              <button type="button" className={styles.playButton} onClick={handlePlay}>
                <span aria-hidden>🔊</span> Lees voor
              </button>
            )}
            {playback === "speaking" && (
              <button type="button" className={styles.playButton} onClick={handlePause}>
                <span aria-hidden>⏸</span> Pauzeer
              </button>
            )}
            {playback === "paused" && (
              <button type="button" className={styles.playButton} onClick={handleResume}>
                <span aria-hidden>▶</span> Hervat
              </button>
            )}
            {playback === "speaking" || playback === "paused" ? (
              <button type="button" className={styles.stopButton} onClick={handleStop}>
                Stop
              </button>
            ) : null}
          </>
        ) : (
          <p className={styles.noVoice}>
            Voorlezen wordt niet ondersteund in deze browser — de tekst staat hieronder.
          </p>
        )}
      </div>
      {playback === "error" && (
        <p className={styles.errorMsg} role="alert">
          Voorlezen is niet gelukt op dit apparaat — mogelijk is er geen Nederlandse stem
          geïnstalleerd. De tekst staat hieronder om zelf te lezen.
        </p>
      )}
      {/* Visually hidden — screen readers already track focus on the
          button that just relabeled itself (Pauzeer/Hervat), this is only
          for anyone who tabs away while it's still talking. */}
      <span className={styles.srOnly} aria-live="polite">
        {statusLabel}
      </span>
      <p className={styles.text}>{text}</p>
      {debugVoices && (
        <div className={styles.debugVoices}>
          <p className={styles.debugVoicesTitle}>
            {usingCloudAudio
              ? `Cloudstem actief (Google Cloud TTS, stem: ${voiceName ?? "onbekend"}) — browserstemmen op dit apparaat:`
              : `Beschikbare stemmen op dit apparaat (${allVoices.length}):`}
          </p>
          <ul className={styles.debugVoicesList}>
            {allVoices.map((v, i) => (
              <li key={`${v.name}-${v.lang}-${i}`}>
                {v.name} — {v.lang}
                {!usingCloudAudio && voice === v && " (gekozen)"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
