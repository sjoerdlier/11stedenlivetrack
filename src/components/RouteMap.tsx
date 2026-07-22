"use client";

import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/gpx";

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
  points: LatLng[];
  start: LatLng;
}

export default function RouteMap({ points, start }: RouteMapProps) {
  return (
    <MapContainer
      center={start}
      zoom={11}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={points} pathOptions={{ color: "#d62828", weight: 4 }} />
      <Marker position={start} icon={startFinishIcon}>
        <Popup>
          Start / Finish — Leeuwarden
          <br />
          11Stedentocht wandelroute (204 km)
        </Popup>
      </Marker>
    </MapContainer>
  );
}
