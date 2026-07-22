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
- `src/lib/useSimulatedNow.ts` — client-clock hook (tick elke N ms), met
  `?debugTime=<ISO-datum>`-override (zie "Debug mode" hieronder).
- `src/components/AppShell.tsx` — client component die once de statusklok +
  `computeLegStatuses` berekent en doorgeeft aan zowel `TopBar` als de kaart,
  zodat voortgang en status-kleuren gegarandeerd hetzelfde snapshot lezen.
- `src/components/TopBar.tsx` — vaste balk boven kaart + sidebar. Zodra er
  minstens 1 rij in `checkins` staat, toont de balk de **echte** status:
  afgelegde km + % (som van `afstand_km` van elke leg wiens eindpunt een
  check-in heeft), actueel gemiddeld tempo (afgelegde km / verstreken tijd
  sinds de eerste check-in) en een geschatte aankomsttijd (nu + resterende km
  / tempo). Met minder dan 2 check-ins is er nog geen betrouwbaar actueel
  tempo — de aankomstschatting valt dan terug op het geplande tempo, duidelijk
  gelabeld ("schatting o.b.v. gepland tempo"). Zolang `checkins` leeg is (vóór
  de racedag, de normale staat) blijft het oude, schema-gebaseerde gedrag
  staan: voortgang (`computeProgress` in `status.ts`, cumulatief_start_km van
  de laatst voltooide leg / 202 km) + gepland gemiddeld tempo, of — zolang leg
  1 nog niet gestart is — een countdown ("Nog X dagen tot de start", via
  `daysUntilStart`). Al deze berekeningen zitten in `src/lib/actualProgress.ts`
  (echt) resp. `src/lib/status.ts` (gepland/schema). Verder een link naar
  `/schema`, een deel-knop (Web Share API met clipboard-fallback +
  "Gekopieerd!"-bevestiging), en een donatieknop uit `NEXT_PUBLIC_DONATION_URL`
  — zonder die env var toont de knop een zichtbare TODO-placeholder in plaats
  van een hardcoded url. Op mobiel compact (alleen percentage/countdown +
  iconen), op desktop volledig uitgeschreven.
- `src/lib/actualProgress.ts` — alle berekeningen op basis van **echte**
  check-ins in plaats van het schema: `firstCheckinTimesByLeg` (eerste
  check-in per `leg_nr`), `computeActualProgress` (afgelegde km/%),
  `actualLegPaceKmh` (het werkelijke tempo van de zojuist gelopen etappe: de
  afstand van de vórige leg over de echte tijd tussen de check-in van de
  vorige en die van deze leg — alleen als check-ins voor beide bestaan),
  `actualAveragePaceKmh` en `estimateArrival` (valt terug op het geplande
  tempo zolang er nog geen 2 check-ins zijn).
- `src/components/RouteMapLoader.tsx` — laadt de kaart client-side (`next/dynamic`,
  `ssr: false`), omdat Leaflet niet server-side kan renderen.
- `src/components/LegSchedule.tsx` + `LegCard.tsx` — het side-menu: elke etappe
  is een kaart-blok. Detailniveau volgt de status: voltooid = compacte
  ingeklapte regel, bezig = automatisch volledig uitgeklapt en uitgelicht,
  nog-te-gaan = huidig niveau (klik om buddy/adres/bijzonderheden te tonen).
  Checkpoints (`cp_nummer` niet leeg) krijgen een badge en een groter bolletje.
  Bijzonderheden krijgen een opvallende "Let op"-waarschuwingsbox, niet
  weggemoffeld. Elke kaart toont daarnaast het werkelijke tempo
  (`actualLegPaceKmh`) waarmee die etappe is gelopen, maar alléén als er
  check-ins zijn voor zowel deze als de vorige leg — zonder die data toont de
  kaart niets (geen placeholder, geen schatting op basis van het schema; die
  is er bewust uitgehaald omdat 'm per leg tonen als puur-schema-getal als
  ruis/fout overkwam). Onder 768px breedte is het side-menu geen vaste
  33vw-kolom meer (die liet op een telefoon geen ruimte over voor de kaart)
  maar een `position: fixed` bottom sheet: standaard ingeklapt tot een 84px
  handvat met titel, tikken (of Enter/spatie) klapt 'm uit tot 75vh scrollbare
  hoogte. Een tik op de kaart klapt de sheet automatisch open via
  `selectFromMap` in `RouteMap.tsx`, zodat de detail die je net opvroeg ook
  zichtbaar wordt.
- `src/components/RouteMap.tsx` — de `react-leaflet`-kaart naast het side-menu:
  elk leg-segment en elke startmarker gekleurd naar dezelfde status; CP's
  krijgen een grotere marker met permanent badge-label. Klik op kaart of
  side-menu synchroniseert de selectie beide kanten op. CP-labels reageren op
  zoomniveau (`src/lib/mapLabels.ts`): volledig ("CP 1 · Leeuwarden") vanaf
  zoom 12, alleen het nummer tussen 10–11, helemaal verborgen (hover-only)
  daaronder. Coïnciderende markers — met name start/finish bij Leeuwarden —
  worden per coördinaat gegroepeerd en waaieren om en om links/rechts uit
  zodat hun labels nooit stapelen.
- `src/app/schema/page.tsx` — losstaande, printbare lijstweergave van alle
  stops (server component, geen kaart, geen interactieve elementen): nr, CP,
  plaats, tijd, afstand, cumulatief, buddy, adres, bijzonderheden in een platte
  tabel. `@media print` zet 'm op A4 liggend, verbergt de "terug"-link en
  verkleint typografie zodat het schema op één vel past — als gewone webpagina
  blijft de tabel ook prima leesbaar. Bedoeld als scherm-loze achtervang
  (uitprinten voor in de auto). Onder 768px breedte staat de tabel (9 kolommen)
  in een `.tableScroll`-wrapper die zelf de horizontale scroll-container is —
  niet de `<table>`, want een table's intrinsieke content-breedte wint altijd
  van een percentage-breedte, dus er viel niets te scrollen totdat de wrapper
  erbij kwam. De "Plaats"-kolom blijft `position: sticky` links staan zodat
  duidelijk blijft welke stop je bekijkt tijdens het scrollen.
- `src/components/LiveTrackPanel.tsx` — uit-/inklapbaar paneel naast de kaart
  met de Garmin LiveTrack-iframe (`NEXT_PUBLIC_GARMIN_LIVETRACK_URL`). Zonder
  die env var toont het paneel een placeholder in plaats van een kapotte
  iframe. Standaard dichtgeklapt (breedte 0, geen ruimte), togglebaar via de
  "Live"-knop in de topbar — die state leeft in `AppShell`. `RouteMap.tsx`
  bevat een kleine `MapResizeHandler` (ResizeObserver + `map.invalidateSize()`)
  omdat Leaflet zelf niet doorheeft dat zijn container breder/smaller wordt
  als dit paneel open- of dichtklapt. Onder 768px breedte (320px vaste
  paneelbreedte was ~85% van een telefoonscherm, bovenop een sidebar die toen
  al geen ruimte overliet) wordt het een full-screen overlay die van onderaf
  omhoog schuift (`transform: translateY`), met een duidelijke 44×44px
  sluitknop rechtsboven.

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
- `src/lib/checkins.ts` — `insertCheckin` (insert) en `loadCheckins` (select,
  gesorteerd op `tijdstip`) tegen de Supabase-tabel `checkins`, met de
  bestaande anon key (zelfde patroon als `legs`/`loadLegs`). `loadCheckins`
  wordt op elke page-load in `src/app/page.tsx` aangeroepen en gevoed aan
  `AppShell` → `TopBar` + `LegSchedule`/`LegCard` (zie `actualProgress.ts`
  hierboven). Een lege tabel (vóór de racedag) is de normale staat, geen fout.

### Dit testen zonder op de racedag te wachten

Voeg testrijen toe aan `checkins` — via `/invoer` (PIN uit `CHECKIN_PIN`) of
rechtstreeks in de Supabase table editor — en herlaad `/`:

- **1 check-in** (bijv. leg 1, tijdstip nu): topbar schakelt over naar de
  echte statusbalk, maar "Afgelegd" blijft 0 km (er is nog geen leg *voltooid*)
  en de aankomstschatting valt terug op het geplande tempo.
- **2 check-ins** voor opeenvolgende legs (bijv. leg 1 om 08:00, leg 2 om
  12:30): "Afgelegd" springt naar `afstand_km` van leg 1, de topbar toont nu
  een actueel tempo, de aankomstschatting gebruikt dat tempo (niet meer het
  schema), en de kaart van leg 2 in de sidebar toont het werkelijke tempo van
  die etappe.
- **Sidebar zonder check-in voor een leg**: die kaart toont simpelweg geen
  tempo-regel (geen placeholder) — zo kun je ook testen dat legs die je
  oversLaat correct niets tonen.
- Voeg een `tijdstip` in het verleden toe (i.p.v. "nu") om een realistisch
  verstreken-tijd/tempo te simuleren zonder echt te hoeven wachten.

**Aanname over het `checkins`-schema** (geen SQL meegestuurd dit keer): kolommen
`tijdstip` (timestamptz), `leg_nr` (int, verwijst naar `legs.nr`), `lat`/`lon`
(numeric, nullable), `notitie` (text, nullable), `invoerder` (text). Check dit
tegen je eigen tabel — als de kolomnamen afwijken, geeft de insert een
duidelijke Supabase-foutmelding in het formulier (geen silent failure), en is
`src/lib/checkins.ts` de enige plek die moet worden aangepast.

## Debug mode

`?debugTime=<ISO-datum>` op elke URL (bijv. `/?debugTime=2026-08-29T13:30:00Z`)
vervangt "nu" overal in de app door die vaste waarde — geen live klok meer
zolang de parameter aanwezig is. Daarmee test je statuskleuren, voortgang en
de pre-start countdown zonder op de echte racedag te wachten:

- Vóór leg 1's `geplande_tijd`: `/?debugTime=2026-08-25T07:00:00Z` → countdown
  in de topbar ("Nog 4 dagen tot de start").
- Tijdens: `/?debugTime=2026-08-29T13:30:00Z` → normale voortgangsbalk en
  status­kleuren (grijs/blauw/wit) per leg, precies zoals op de dag zelf.
- Na afloop: een datum ruim na de laatste `geplande_tijd` → voortgang richting
  100%.

`useSimulatedNow` (`src/lib/useSimulatedNow.ts`) is de plek die dit
implementeert. **Let op voor een toekomstige samenvoeging met de
RunnerFigure-PR**: die zal vermoedelijk een eigen tijd-simulatiemechanisme
willen; dit bestand is bewust de plek waar dat samenkomt — een merge-conflict
hier is te verwachten, niet iets om te vermijden.

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
