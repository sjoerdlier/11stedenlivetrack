"use client";

import styles from "./LiveTrackPanel.module.css";

interface LiveTrackPanelProps {
  open: boolean;
  onClose: () => void;
  garminUrl: string | null;
}

export default function LiveTrackPanel({ open, onClose, garminUrl }: LiveTrackPanelProps) {
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
          {garminUrl ? (
            <iframe
              src={garminUrl}
              className={styles.iframe}
              title="Garmin LiveTrack"
              loading="lazy"
              allow="geolocation"
            />
          ) : (
            <div className={styles.placeholder}>
              <span className={styles.placeholderIcon} aria-hidden>
                📡
              </span>
              <p className={styles.placeholderText}>Nog geen Garmin LiveTrack-link ingesteld.</p>
              <p className={styles.placeholderHint}>Zie /beheer om er een toe te voegen.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
