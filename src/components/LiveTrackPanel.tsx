"use client";

import styles from "./LiveTrackPanel.module.css";

const GARMIN_URL = process.env.NEXT_PUBLIC_GARMIN_LIVETRACK_URL;

interface LiveTrackPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function LiveTrackPanel({ open, onClose }: LiveTrackPanelProps) {
  return (
    <div className={`${styles.panel} ${open ? styles.open : ""}`} aria-hidden={!open}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.title}>📡 Live locatie</span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Live locatie sluiten">
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {GARMIN_URL ? (
            <iframe
              src={GARMIN_URL}
              className={styles.iframe}
              title="Garmin LiveTrack — Lowie"
              loading="lazy"
              allow="geolocation"
            />
          ) : (
            <div className={styles.placeholder}>
              <span className={styles.placeholderIcon} aria-hidden>
                📡
              </span>
              <p className={styles.placeholderText}>Live locatie beschikbaar vanaf 29 augustus.</p>
              <p className={styles.placeholderHint}>
                Lowie deelt zijn Garmin LiveTrack-link op de dag zelf — deze komt hier dan automatisch te staan.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
