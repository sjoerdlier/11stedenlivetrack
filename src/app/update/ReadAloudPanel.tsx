"use client";

import { useEffect, useState } from "react";
import styles from "./ReadAloudPanel.module.css";

interface ReadAloudPanelProps {
  text: string | null;
}

type PlaybackState = "idle" | "speaking" | "paused" | "error";

// Browser-native Web Speech API rather than a generated audio file — free,
// no API key, no extra round-trip, and it picks up whatever Dutch voice
// (and rate/pitch) the visitor's own device is already configured with,
// which for someone who already relies on a screen reader is often the
// voice they're used to rather than a one-size-fits-all synthesized clip.
export default function ReadAloudPanel({ text }: ReadAloudPanelProps) {
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  // Same lazy-initializer pattern useSimulatedNow/AppShell's isDebugMode
  // use — computed once, SSR-safe (window is guarded, not read during the
  // render body directly).
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);

  useEffect(() => {
    // Stops the voice if this page unmounts mid-sentence (route change) —
    // otherwise the browser keeps talking over whatever's shown next.
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function handlePlay() {
    if (!text || !supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "nl-NL";
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

  function handlePause() {
    window.speechSynthesis.pause();
    setPlayback("paused");
  }

  function handleResume() {
    window.speechSynthesis.resume();
    setPlayback("speaking");
  }

  function handleStop() {
    window.speechSynthesis.cancel();
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

  return (
    <div className={styles.panel}>
      <div className={styles.controls}>
        {supported ? (
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
    </div>
  );
}
