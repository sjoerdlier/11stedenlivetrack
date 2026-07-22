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
  elke 30s (client-side klok). `isBeforeStart`/`raceStartTime` leiden de
  "nog niet begonnen"-staat af uit leg 1's `geplande_tijd` (géén losse
  hardcoded datum), gebruikt door `TopBar` (countdown) en `RouteMap` (loper op
  het startpunt).
- `src/lib/geo.ts` — gedeelde geo-wiskunde: `haversineMeters` (afstand tussen
  twee punten) en `bearingDeg` (kompaskoers van punt a naar punt b, 0=noord).
  Gebruikt door zowel `segments.ts` (leg-track knippen) als
  `runnerPosition.ts` (loper-positie en looprichting).
- `src/lib/runnerPosition.ts` — er is nog geen live GPS-feed, dus de positie
  van de loper wordt gesimuleerd: op de actieve leg wordt hij langs de track
  geplaatst naar verhouding van hoe ver de tijdsvensters (`geplande_tijd` van
  de leg tot die van de volgende) al verstreken zijn, met de looprichting
  (`bearingDeg`) afgeleid uit het naastliggende trackstuk.
- `src/app/page.tsx` — server component (`force-dynamic`, want de legs-data komt
  live uit Supabase) die route + legs combineert en doorgeeft aan `AppShell`.
- `src/lib/useNow.ts` — kleine client-clock hook (tick elke N ms), gebruikt om
  status live te houden zonder page reload. Ondersteunt een debug/simulatie-
  modus via de querystring (`?debug=…`) om het schema te versnellen zonder op
  de daadwerkelijke wandeldagen te wachten — zie "Debug/simulatiemodus" hieronder.
- `src/components/AppShell.tsx` — client component die once de statusklok +
  `computeLegStatuses` berekent en doorgeeft aan zowel `TopBar` als de kaart,
  zodat voortgang en status-kleuren gegarandeerd hetzelfde snapshot lezen.
- `src/components/TopBar.tsx` — vaste balk boven kaart + sidebar: voortgang
  (`computeProgress` in `status.ts`, cumulatief_start_km van de laatst voltooide
  leg / 202 km), een link naar `/schema`, een deel-knop (Web Share API met
  clipboard-fallback + "Gekopieerd!"-bevestiging), en een donatieknop uit
  `NEXT_PUBLIC_DONATION_URL` — zonder die env var toont de knop een zichtbare
  TODO-placeholder in plaats van een hardcoded url. Op mobiel compact (alleen
  percentage + iconen), op desktop volledig uitgeschreven. Zolang de tocht nog
  niet begonnen is (`isBeforeStart`) toont dit blok een countdown ("Nog X
  dagen tot de start") in plaats van de voortgangsbalk.
- `src/components/RouteMapLoader.tsx` — laadt de kaart client-side (`next/dynamic`,
  `ssr: false`), omdat Leaflet niet server-side kan renderen.
- `src/components/RunnerFigure.tsx` — de geanimeerde SVG-rennerfiguur van
  Lowie: hoofd (cirkel), romp en twee losse armen/benen die elk om hun eigen
  gewricht (heup/schouder) roteren. Armen en benen zwaaien in CSS-keyframes
  in tegengestelde fase, cyclus van 500ms. Eén component voor zowel de
  compacte kaart-marker (klein, met `bounce` en `rotationDeg` naar de
  looprichting) als de uitvergrote detailweergave (`size` 4-5x groter, geen
  rotatie/bounce nodig — hier is de beenbeweging het duidelijkst zichtbaar).
- `src/components/LegSchedule.tsx` + `LegCard.tsx` — het side-menu: elke etappe
  is een kaart-blok. Detailniveau volgt de status: voltooid = compacte
  ingeklapte regel, bezig = automatisch volledig uitgeklapt en uitgelicht (met
  de uitvergrote `RunnerFigure` erbij), nog-te-gaan = huidig niveau (klik om
  buddy/adres/bijzonderheden te tonen). Checkpoints (`cp_nummer` niet leeg)
  krijgen een badge en een groter bolletje. Bijzonderheden krijgen een
  opvallende "Let op"-waarschuwingsbox, niet weggemoffeld.
- `src/components/RouteMap.tsx` — de `react-leaflet`-kaart naast het side-menu:
  elk leg-segment en elke startmarker gekleurd naar dezelfde status; CP's
  krijgen een grotere marker met permanent badge-label. Klik op kaart of
  side-menu synchroniseert de selectie beide kanten op. De actieve loper
  krijgt een eigen marker (`RunnerFigure` als Leaflet `divIcon`, geroteerd naar
  `bearingDeg`); een klik erop toont de uitvergrote detailweergave in een
  popup. Zolang de tocht nog niet begonnen is, staat deze marker alvast op het
  startpunt (leg 1) met de bounce-animatie aan maar de benen stil
  (`running={false}`) — aan het opwarmen, nog niet aan het lopen.
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

## /invoer — fallback check-in met PIN

Basiscamp-invoerformulier voor als de Garmin LiveTrack uitvalt, achter een
4-cijferige PIN:

- `src/lib/checkinAuth.ts` — de PIN zelf (`CHECKIN_PIN`, server-only) verlaat
  de server nooit. `/api/invoer/verify` vergelijkt de ingevoerde PIN
  server-side en zet bij een match een **httpOnly** cookie met een
  SHA-256-hash van de PIN (12u geldig) — nooit de PIN zelf, en niet vergelijkbaar
  vanuit client-JS. `/api/invoer` (de check-in-insert) herberekent diezelfde
  hash server-side uit `CHECKIN_PIN` en vergelijkt met de cookie op **elke**
  submit, dus een directe POST zonder geldige PIN-sessie geeft altijd 401 —
  geverifieerd met curl.
- `src/app/invoer/page.tsx` — server component, leest de cookie zodat een
  al-geautoriseerde sessie na een reload niet opnieuw hoeft in te loggen.
  Haalt legs op voor de dropdown; als Supabase daarbij faalt, blokkeert dat
  niet de PIN-poort zelf (legs-fout wordt pas zichtbaar in het formulier).
- `PinScreen.tsx` / `CheckinForm.tsx` / `InvoerClient.tsx` — PIN-scherm, en
  daarna het formulier (tijdstip default nu, leg-dropdown, optioneel lat/lon,
  notitie, naam invoerder). Bij succesvol opslaan: bevestiging tonen, formulier
  volledig leegmaken voor de volgende invoer.
- `src/lib/checkins.ts` — insert in de Supabase-tabel `checkins` met de
  bestaande anon key (zelfde patroon als `legs`/`loadLegs`).

**Aanname over het `checkins`-schema** (geen SQL meegestuurd dit keer): kolommen
`tijdstip` (timestamptz), `leg_nr` (int, verwijst naar `legs.nr`), `lat`/`lon`
(numeric, nullable), `notitie` (text, nullable), `invoerder` (text). Check dit
tegen je eigen tabel — als de kolomnamen afwijken, geeft de insert een
duidelijke Supabase-foutmelding in het formulier (geen silent failure), en is
`src/lib/checkins.ts` de enige plek die moet worden aangepast.

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

## Debug/simulatiemodus

Om de rennende marker en het schema te bekijken zonder op de echte
wandeldagen te wachten, kan de klok via de querystring versneld worden
(`src/lib/useNow.ts`):

- `?debug=1` — zet de simulatieklok aan, standaard 60x snelheid vanaf het
  moment van laden. Een volledige leg-tijdvenster van bijv. 2 uur schiet dan
  in ~2 minuten voorbij, inclusief de bewegende/roterende loper op de kaart.
- `?debug=<snelheid>` — eigen snelheidsfactor, bijv. `?debug=600` voor 10
  minuten schema per seconde.
- `&debugTime=2026-08-29T07:00:00` — start de simulatie op een gekozen
  moment (bijv. de officiële starttijd) in plaats van vanaf "nu", zodat elk
  punt in het schema op aanvraag te bekijken is.

Beide staten van de "nog niet begonnen"-weergave (`isBeforeStart` in
`status.ts`) zijn hiermee te bekijken zonder op de kalender te wachten:

- **Idle-staat** (vóór leg 1's `geplande_tijd`): standaard gedrag als de
  querystring leeg is, of expliciet met een `debugTime` vóór de starttijd,
  bijv. `?debug=1&debugTime=2026-08-01T00:00:00`. Toont de countdown in de
  topbar en de loper (bounce, stilstaande benen) op het startpunt.
- **Actieve staat**: `?debug=600&debugTime=2026-08-29T07:00:00` (of later)
  springt direct naar/voorbij de starttijd — countdown maakt plaats voor de
  voortgangsbalk en de loper begint te bewegen/rennen langs de actieve leg.

Voorbeeld: `http://localhost:3000/?debug=600&debugTime=2026-08-29T07:00:00`.

## Route vervangen

Vervang `data/route.gpx` door een andere GPX-export (zelfde structuur: `<gpx><trk><trkseg><trkpt lat="…" lon="…">`)
om een andere route te tonen. Het startpunt wordt automatisch het eerste trackpoint.
