"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/gpx";
import type { LegSegment } from "@/lib/segments";
import { formatGeplandeTijd } from "@/lib/format";
import styles from "./RouteMap.module.css";

// Lowie is the subject of the map: one route color, not a color per buddy.
const ROUTE_COLOR = "#2a78d6";

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
}

export default function RouteMap({ start, legSegments }: RouteMapProps) {
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

        {legSegments.map(({ leg, positions }) => (
          <Polyline
            key={`line-${leg.nr}`}
            positions={positions}
            pathOptions={{ color: ROUTE_COLOR, weight: 5, opacity: 0.95, lineCap: "round" }}
            eventHandlers={{ click: () => setSelectedNr(leg.nr) }}
          />
        ))}

        {legSegments.map(({ leg }) => {
          const tijd = formatGeplandeTijd(leg.geplande_tijd);
          return (
            <CircleMarker
              key={`marker-${leg.nr}`}
              center={[leg.start_lat, leg.start_lon]}
              radius={6}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: ROUTE_COLOR, fillOpacity: 1 }}
              eventHandlers={{ click: () => setSelectedNr(leg.nr) }}
            >
              <Tooltip direction="bottom" offset={[0, 6]} permanent className={styles.timeLabel}>
                {leg.start_plaats}
                {tijd ? ` · ${tijd}` : ""}
              </Tooltip>
            </CircleMarker>
          );
        })}

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
            <div className={styles.panelTitle}>{selected.leg.start_plaats}</div>
            <div className={styles.legRow}>
              <span className={styles.legLabel}>Verwacht</span>
              <span>{formatGeplandeTijd(selected.leg.geplande_tijd) ?? "onbekend"}</span>
            </div>
            <div className={styles.legRow}>
              <span className={styles.legLabel}>Afstand</span>
              <span>{selected.leg.afstand_km} km</span>
            </div>
            <div className={styles.legRow}>
              <span className={styles.legLabel}>Cumulatief</span>
              <span>{selected.leg.cumulatief_start_km} km</span>
            </div>
            <div className={styles.divider} />
            <div className={styles.legRow}>
              <span className={styles.legLabel}>Buddy</span>
              <span>{selected.leg.loper}</span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.panelTitle}>Lowie — 11Stedentocht</div>
            <div className={styles.hint}>
              204 km, 22 etappes. Klik op de route of een startpunt voor de verwachte tijd en wie
              er meeloopt.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
