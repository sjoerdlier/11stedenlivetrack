# 11Stedentocht Live Track

Next.js (App Router) app die de 11Stedentocht wandelroute (204 km, komoot-export)
toont op een Leaflet-kaart. Lowie is het onderwerp: een vast side-menu toont het
volledige schema (22 etappes, tijd, afstand, status), de kaart toont dezelfde
status in kleur. Wie welk stuk loopt (buddy) staat pas in de klik-detail. Basis
voor een latere fase met live locatie.

## Hoe het werkt

- `data/route.gpx` — de GPX-track (komoot-export, één track, geen waypoints).
- `src/lib/gpx.ts` — leest en parsed de GPX server-side (`fast-xml-parser`) tot
  een lijst van `[lat, lon]`-punten.
- `src/lib/legs.ts` — haalt de 22 legs (start_plaats, afstand_km, loper,
  geplande_tijd, start_lat/lon) server-side op uit de Supabase-tabel `legs`.
- `src/lib/segments.ts` — knipt de GPX-track in stukken per leg: zoekt voor elk
  leg-startpunt het dichtstbijzijnde trackpoint (voorwaarts vanaf het vorige leg,
  zodat plekken die de route twee keer passeert — zoals Bartlehiem — niet door
  elkaar lopen).
- `src/lib/format.ts` — formatteert `geplande_tijd` (timestamptz) als "za 18:32"
  in de Europe/Amsterdam-tijdzone.
- `src/lib/status.ts` — bepaalt client-side per leg de status (`voltooid` /
  `bezig` / `nog-te-gaan`) op basis van `geplande_tijd`: voltooid zodra de
  volgende leg z'n tijd voorbij is, bezig zodra de eigen tijd voorbij is,
  anders nog-te-gaan. Levert ook de gedeelde statuskleuren (grijs/blauw/wit) en
  labels — dezelfde module voedt zowel het side-menu als de kaart, dus ze
  kunnen niet uit elkaar lopen. Herberekent elke 30s (client-side klok).
- `src/app/page.tsx` — server component (`force-dynamic`, want de legs-data komt
  live uit Supabase) die route + legs combineert en doorgeeft aan de kaart.
- `src/components/RouteMapLoader.tsx` — laadt de kaart client-side (`next/dynamic`,
  `ssr: false`), omdat Leaflet niet server-side kan renderen.
- `src/components/LegSchedule.tsx` — het side-menu: alle 22 legs op volgorde
  met statusstip, plaatsnaam, tijd en afstand. Klikken op een rij selecteert 'm
  (toont buddy + cumulatieve afstand inline) en synchroniseert met de kaart.
- `src/components/RouteMap.tsx` — de `react-leaflet`-kaart naast het side-menu:
  elk leg-segment en elke startmarker gekleurd naar dezelfde status als het
  side-menu, een start/finish-marker op Leeuwarden, en tweerichtings-selectie
  (klik op kaart scrollt het side-menu mee, en andersom).

## Supabase

De `legs`-tabel wordt gelezen met de **anon/public key** (alleen leesrechten
nodig, geen service role key). Nodig in `.env.local` (niet gecommit):

```bash
SUPABASE_URL=https://jouw-project.supabase.co
SUPABASE_ANON_KEY=jouw-anon-key
```

Zie `.env.example`. Voor een Vercel-deploy zet je dezelfde twee variabelen in
de project settings (Environment Variables) — zonder deze faalt de pagina met
een duidelijke foutmelding.

## Lokaal draaien

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Route vervangen

Vervang `data/route.gpx` door een andere GPX-export (zelfde structuur: `<gpx><trk><trkseg><trkpt lat="…" lon="…">`)
om een andere route te tonen. Het startpunt wordt automatisch het eerste trackpoint.
