# 11Stedentocht Live Track

Next.js (App Router) app die de 11Stedentocht wandelroute (204 km, komoot-export)
toont op een Leaflet-kaart. Dit is de basiskaart voor een latere fase met live
locatie en leg-indeling.

## Hoe het werkt

- `data/route.gpx` — de GPX-track (komoot-export, één track, geen waypoints).
- `src/lib/gpx.ts` — leest en parsed de GPX server-side (`fast-xml-parser`) tot
  een lijst van `[lat, lon]`-punten.
- `src/app/page.tsx` — server component die de route inleest en doorgeeft aan
  de kaart.
- `src/components/RouteMapLoader.tsx` — laadt de kaart client-side (`next/dynamic`,
  `ssr: false`), omdat Leaflet niet server-side kan renderen.
- `src/components/RouteMap.tsx` — de eigenlijke `react-leaflet`-kaart: OSM-tiles,
  de route als rode lijn (`Polyline`) en een start/finish-marker op het beginpunt
  (Leeuwarden, 53.202338 / 5.769497 — start = finish, het is een lus).

Geen backend of database: alles gebeurt front-end, de GPX wordt bij het bouwen/
draaien van de app van schijf gelezen.

## Lokaal draaien

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Route vervangen

Vervang `data/route.gpx` door een andere GPX-export (zelfde structuur: `<gpx><trk><trkseg><trkpt lat="…" lon="…">`)
om een andere route te tonen. Het startpunt wordt automatisch het eerste trackpoint.
