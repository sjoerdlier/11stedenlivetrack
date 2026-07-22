# 11Stedentocht Live Track

Next.js (App Router) app die de 11Stedentocht wandelroute (204 km, komoot-export)
toont op een Leaflet-kaart. Lowie is het onderwerp: een breed side-menu (~33vw)
toont het volledige schema als kaart-achtige blokken per etappe — tijd, afstand,
cumulatief, buddy, adres (met Google Maps-link) en bijzonderheden — de kaart
toont dezelfde status in kleur. Basis voor een latere fase met live locatie.

## Hoe het werkt

- `data/route.gpx` — de GPX-track (komoot-export, één track, geen waypoints).
- `src/lib/gpx.ts` — leest en parsed de GPX server-side (`fast-xml-parser`) tot
  een lijst van `[lat, lon]`-punten.
- `src/lib/legs.ts` — haalt alle legs (start_plaats, afstand_km, loper,
  geplande_tijd, cp_nummer, adres, bijzonderheden, start_lat/lon) server-side
  op uit de Supabase-tabel `legs`. `afstand_km`/`loper` zijn nullable (de
  finish-rij is geen te lopen etappe).
- `src/lib/segments.ts` — knipt de GPX-track in stukken per leg: zoekt voor elk
  leg-startpunt het dichtstbijzijnde trackpoint (voorwaarts vanaf het vorige leg,
  zodat plekken die de route twee keer passeert — zoals Bartlehiem — niet door
  elkaar lopen).
- `src/lib/format.ts` — formatteert `geplande_tijd` (timestamptz) als "za 18:32"
  (Europe/Amsterdam) en bouwt de Google Maps-link (`?q=lat,lon`) per stop.
- `src/lib/status.ts` — bepaalt client-side per leg de status (`voltooid` /
  `bezig` / `nog-te-gaan`) op basis van `geplande_tijd`: voltooid zodra de
  volgende leg z'n tijd voorbij is, bezig zodra de eigen tijd voorbij is,
  anders nog-te-gaan. Levert ook de gedeelde statuskleuren (grijs/blauw/wit) en
  labels — dezelfde module voedt zowel het side-menu als de kaart. Herberekent
  elke 30s (client-side klok).
- `src/app/page.tsx` — server component (`force-dynamic`, want de legs-data komt
  live uit Supabase) die route + legs combineert en doorgeeft aan `AppShell`.
- `src/lib/useNow.ts` — kleine client-clock hook (tick elke N ms), gebruikt om
  status live te houden zonder page reload.
- `src/components/AppShell.tsx` — client component die once de statusklok +
  `computeLegStatuses` berekent en doorgeeft aan zowel `TopBar` als de kaart,
  zodat voortgang en status-kleuren gegarandeerd hetzelfde snapshot lezen.
- `src/components/TopBar.tsx` — vaste balk boven kaart + sidebar: voortgang
  (`computeProgress` in `status.ts`, cumulatief_start_km van de laatst voltooide
  leg / 202 km), een link naar `/schema`, een deel-knop (Web Share API met
  clipboard-fallback + "Gekopieerd!"-bevestiging), en een donatieknop uit
  `NEXT_PUBLIC_DONATION_URL` — zonder die env var toont de knop een zichtbare
  TODO-placeholder in plaats van een hardcoded url. Op mobiel compact (alleen
  percentage + iconen), op desktop volledig uitgeschreven.
- `src/components/RouteMapLoader.tsx` — laadt de kaart client-side (`next/dynamic`,
  `ssr: false`), omdat Leaflet niet server-side kan renderen.
- `src/components/LegSchedule.tsx` + `LegCard.tsx` — het side-menu: elke etappe
  is een kaart-blok. Detailniveau volgt de status: voltooid = compacte
  ingeklapte regel, bezig = automatisch volledig uitgeklapt en uitgelicht,
  nog-te-gaan = huidig niveau (klik om buddy/adres/bijzonderheden te tonen).
  Checkpoints (`cp_nummer` niet leeg) krijgen een badge en een groter bolletje.
  Bijzonderheden krijgen een opvallende "Let op"-waarschuwingsbox, niet
  weggemoffeld.
- `src/components/RouteMap.tsx` — de `react-leaflet`-kaart naast het side-menu:
  elk leg-segment en elke startmarker gekleurd naar dezelfde status; CP's
  krijgen een grotere marker met permanent badge-label. Klik op kaart of
  side-menu synchroniseert de selectie beide kanten op.
- `src/app/schema/page.tsx` — losstaande, printbare lijstweergave van alle
  stops (server component, geen kaart, geen interactieve elementen): nr, CP,
  plaats, tijd, afstand, cumulatief, buddy, adres, bijzonderheden in een platte
  tabel. `@media print` zet 'm op A4 liggend, verbergt de "terug"-link en
  verkleint typografie zodat het schema op één vel past — als gewone webpagina
  blijft de tabel ook prima leesbaar. Bedoeld als scherm-loze achtervang
  (uitprinten voor in de auto).
- `src/components/LiveTrackPanel.tsx` — uit-/inklapbaar paneel naast de kaart
  met de Garmin LiveTrack-iframe (`NEXT_PUBLIC_GARMIN_LIVETRACK_URL`). Zonder
  die env var toont het paneel een placeholder in plaats van een kapotte
  iframe. Standaard dichtgeklapt (breedte 0, geen ruimte), togglebaar via de
  "Live"-knop in de topbar — die state leeft in `AppShell`. `RouteMap.tsx`
  bevat een kleine `MapResizeHandler` (ResizeObserver + `map.invalidateSize()`)
  omdat Leaflet zelf niet doorheeft dat zijn container breder/smaller wordt
  als dit paneel open- of dichtklapt.

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

## Donatieknop

`NEXT_PUBLIC_DONATION_URL` (in `.env.local` en in Vercel's Environment
Variables) bepaalt waar de "Doneer"-knop in de topbar naartoe linkt. Zonder
deze variabele blijft de knop zichtbaar maar niet-klikbaar met een TODO-label,
zodat een vergeten configuratie opvalt in plaats van stil te falen.

## Lokaal draaien

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Route vervangen

Vervang `data/route.gpx` door een andere GPX-export (zelfde structuur: `<gpx><trk><trkseg><trkpt lat="…" lon="…">`)
om een andere route te tonen. Het startpunt wordt automatisch het eerste trackpoint.
