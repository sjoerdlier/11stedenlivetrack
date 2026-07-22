# 11Stedentocht Live Track

Next.js (App Router) app die de 11Stedentocht wandelroute (204 km, komoot-export)
toont op een Leaflet-kaart. Lowie is het onderwerp: de route staat als één
doorlopende lijn met de verwachte tijd per startpunt; wie welk stuk loopt
(buddy) staat pas in de klik-detail. Basis voor een latere fase met live locatie.

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
- `src/app/page.tsx` — server component (`force-dynamic`, want de legs-data komt
  live uit Supabase) die route + legs combineert en doorgeeft aan de kaart.
- `src/components/RouteMapLoader.tsx` — laadt de kaart client-side (`next/dynamic`,
  `ssr: false`), omdat Leaflet niet server-side kan renderen.
- `src/components/RouteMap.tsx` — de `react-leaflet`-kaart: de hele route als
  één doorlopende lijn (één kleur, geen kleur-per-loper meer), een marker met
  plaatsnaam + verwachte tijd op elk leg-startpunt, een start/finish-marker op
  Leeuwarden, en een zijpaneel dat bij klikken op een segment/marker de
  verwachte tijd, afstand en cumulatieve afstand toont — met de buddy (loper)
  als losse, secundaire regel onderaan.

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
