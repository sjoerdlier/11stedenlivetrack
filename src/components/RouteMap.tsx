"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/gpx";
import type { LegSegment } from "@/lib/segments";
import { colorForLoper } from "@/lib/segments";
import styles from "./RouteMap.module.css";

const startFinishIcon = L.icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
        <path d="M16 0C7.2 0 0 7.2 0 16c0 11 16 26 16 26s16-15 16-26C32 7.2 24.8 0 16 0z" fill="#d62828"/>
        <circle cx="16" cy="16" r="8" fill="#ffffff"/>
      </svg>`
    ).toString("base64"),
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -38],
});

interface RouteMapProps {
  start: LatLng;
  legSegments: LegSegment[];
  runnerOrder: string[];
}

export default function RouteMap({ start, legSegments, runnerOrder }: RouteMapProps) {
  const [selectedNr, setSelectedNr] = useState<number | null>(null);
  const selected = legSegments.find((s) => s.leg.nr === selectedNr) ?? null;

  return (
    <div className={styles.wrapper}>
      <MapContainer center={start} zoom={11} className={styles.map} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {legSegments.map(({ leg, positions }) => (
          <Polyline
            key={`casing-${leg.nr}`}
            positions={positions}
            pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.9, lineCap: "round" }}
            interactive={false}
          />
        ))}

        {legSegments.map(({ leg, positions, color }) => (
          <Polyline
            key={`line-${leg.nr}`}
            positions={positions}
            pathOptions={{ color, weight: 5, opacity: 0.95, lineCap: "round" }}
            eventHandlers={{ click: () => setSelectedNr(leg.nr) }}
          />
        ))}

        {legSegments.map(({ leg, color }) => (
          <CircleMarker
            key={`marker-${leg.nr}`}
            center={[leg.start_lat, leg.start_lon]}
            radius={6}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 1 }}
            eventHandlers={{ click: () => setSelectedNr(leg.nr) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {leg.start_plaats}
            </Tooltip>
          </CircleMarker>
        ))}

        <Marker position={start} icon={startFinishIcon}>
          <Popup>
            Start / Finish — Leeuwarden
            <br />
            11Stedentocht wandelroute (204 km)
          </Popup>
        </Marker>
      </MapContainer>

      <div className={styles.panel}>
        {selected ? (
          <>
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setSelectedNr(null)}
              aria-label="Sluiten"
            >
              ✕
            </button>
            <div className={styles.panelTitle}>
              Leg {selected.leg.nr} — {selected.leg.start_plaats}
            </div>
            <div className={styles.legRow}>
              <span className={styles.legLabel}>Loper</span>
              <span>{selected.leg.loper}</span>
            </div>
            <div className={styles.legRow}>
              <span className={styles.legLabel}>Afstand</span>
              <span>{selected.leg.afstand_km} km</span>
            </div>
            <div className={styles.legRow}>
              <span className={styles.legLabel}>Cumulatief</span>
              <span>{selected.leg.cumulatief_start_km} km</span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.panelTitle}>11Stedentocht — legs</div>
            <div className={styles.hint}>Klik op een route-segment of startpunt voor details.</div>
            <div className={styles.legend}>
              {runnerOrder.map((loper) => (
                <div key={loper} className={styles.legendItem}>
                  <span
                    className={styles.swatch}
                    style={{ background: colorForLoper(loper, runnerOrder) }}
                  />
                  <span>{loper}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
