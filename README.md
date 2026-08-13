# 11Stedentocht Live Track

Next.js (App Router) app die een wandelroute toont op een Leaflet-kaart, met een
breed side-menu (~33vw) dat het volledige schema als kaart-achtige blokken per
etappe toont — tijd, afstand, cumulatief, buddy, adres (met Google Maps-link) en
bijzonderheden — de kaart toont dezelfde status in kleur.

De app is gebouwd om meerdere routes naast elkaar te ondersteunen, omgeschakeld
met een knop bovenin (zie "Meerdere routes" hieronder) — op dit moment is dat
alleen de **11Stedentocht** (204 km, komoot-export, 29–30 augustus, Lowie als
onderwerp). Eerder testte een tijdelijke tweede/derde route (KAT100 Marathon
Trail + Endurance Trail, augustus) de livetrack-flow voor een ander evenement;
die zijn na afloop weer uit `ROUTES` gehaald (de historische legs/checkins
staan nog in Supabase, alleen niet meer bereikbaar vanuit de app) — de
route/party-machinerie zelf bleef generiek staan voor een volgende keer.

## Hoe het werkt

- `src/lib/routes.ts` — de configuratie voor alle routes (op dit moment alleen
  `11steden`): welk GPX-bestand, welke titel/labels, start-/finishplaats. Elke
  server component die route-afhankelijke data nodig heeft (kaart, schema,
  invoer) leest de actieve route uit de `?route=`-query-param
  (`parseRouteSlug`) en valt terug op `11steden` als die ontbreekt of onbekend
  is.
- `data/route.gpx` — de GPX-track (komoot-export, één track, geen
  waypoints).
- `src/lib/gpx.ts` — leest en parsed de GPX server-side (`fast-xml-parser`) tot
  een lijst van `[lat, lon]`-punten. `loadRoute(gpxFile)` neemt de bestandsnaam
  uit `routes.ts` mee.
- `src/lib/legs.ts` — haalt alle legs (start_plaats, afstand_km, loper,
  geplande_tijd, cp_nummer, adres, bijzonderheden, start_lat/lon) server-side
  op uit de Supabase-tabel `legs`, gefilterd op de actieve `route`.
  `afstand_km`/`loper` zijn nullable (de finish-rij is geen te lopen etappe).
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
  live uit Supabase) die de actieve route uit `?route=` haalt, de bijbehorende
  GPX + legs + checkins combineert en doorgeeft aan `AppShell`.
  `generateMetadata` stelt hier ook de `<title>`/`description` per route in.
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
  de laatst voltooide leg / de totale routelengte) + gepland gemiddeld tempo,
  of — zolang leg 1 nog niet gestart is — een countdown ("Nog X dagen tot de
  start", via `daysUntilStart`). De totale routelengte (`totalRouteKm`) is
  géén hardcoded constante maar de `cumulatief_start_km` van de laatste
  (finish-)leg, zodat elke route zijn eigen correcte afstand toont. Al deze
  berekeningen zitten in `src/lib/actualProgress.ts` (echt) resp.
  `src/lib/status.ts` (gepland/schema). Verder de routeswitcher (zie
  "Meerdere routes"), een link naar `/schema`, een deel-knop (Web Share API
  met clipboard-fallback + "Gekopieerd!"-bevestiging), en een donatieknop uit
  `NEXT_PUBLIC_DONATION_URL` — zonder die env var toont de knop een zichtbare
  TODO-placeholder in plaats van een hardcoded url. Op mobiel compact (alleen
  percentage/countdown + iconen), op desktop volledig uitgeschreven; de
  actie-rij zelf is een eigen horizontale scroll-container zodat op een smalle
  telefoon niets buiten beeld valt.
- `src/lib/actualProgress.ts` — alle berekeningen op basis van **echte**
  check-ins in plaats van het schema: `firstCheckinTimesByLeg` (eerste
  check-in per `leg_nr`), `computeActualProgress` (afgelegde km/%),
  `actualLegPaceKmh` (het werkelijke tempo over een etappe: de afstand van de
  leg vóór de gegeven index over de echte tijd tussen de check-in van die
  vorige leg en die van de gegeven leg — alleen als check-ins voor beide
  bestaan), `actualAveragePaceKmh` en `estimateArrival` (valt terug op het
  geplande tempo zolang er nog geen 2 check-ins zijn). `computeLegTiming`
  bouwt hierop voort voor de leg-kaarten in de sidebar: per leg
  `stopMinutes` (10 bij een CP, anders 0 — voorlopig een vaste aanname,
  geen aparte databron), `vertrekGepland` (`geplande_tijd` + stopMinutes),
  `tempoGepland` (`afstand_km` van déze leg over de geplande duur tot
  vertrek bij de vólgende leg), `aankomstWerkelijk` (de check-in-tijd van
  déze leg), `vertrekWerkelijk` (`aankomstWerkelijk` + stopMinutes) en
  `tempoWerkelijk` — dat laatste is `actualLegPaceKmh` op de vólgende
  leg-index, zodat het dezelfde etappe meet als `tempoGepland` (this→next),
  niet de etappe die net gelopen is om hier aan te komen (prev→this).

## Hoogtegecorrigeerd tempo (Grade Adjusted Pace)

Elk tempo-cijfer dat je ziet (topbar, leg-kaart, het live bolletje op de kaart) is
hoogtegecorrigeerd, geen platte km/u — een klimstuk laat het tempo dus niet gewoon
"langzaam" lijken zoals de ruwe afstand/tijd dat zou doen.

- `src/lib/geo.ts` — `gradeAdjustedKm(points, elevations)` loopt punt voor punt door een
  GPX-track en kost elke kleine stap op basis van zíjn eigen hellingspercentage, via het
  metabole-kostenmodel van Minetti et al. (2002) — hetzelfde model dat de meeste "Grade
  Adjusted Pace"-tools gebruiken. Punt-voor-punt in plaats van op basis van het netto
  hoogteverschil van een hele leg, want een leg die evenveel klimt als daalt heeft netto
  ~0m hoogtewinst maar is wél degelijk zwaarder dan vlak. Ontbrekende hoogtedata voor een
  puntenpaar valt terug op de ruwe afstand (factor 1) in plaats van dat stukje te laten
  vallen.
- `src/lib/segments.ts` — `buildLegSegments` roept dit nu per leg aan (op de ruwe,
  ongesimplificeerde puntenreeks, vóór de Douglas-Peucker-simplificatie die alleen de
  getekende lijn raakt) en zet het resultaat op `LegSegment.effortKm`. `buildEffortLegs`
  bouwt daaruit een tweede `Leg[]` — identiek aan de originele legs, behalve dat
  `afstand_km`/`cumulatief_start_km` vervangen zijn door de hoogtegecorrigeerde
  equivalenten (cumulatief opnieuw opgebouwd; de finish-leg's `afstand_km` blijft `null`,
  dezelfde conventie als altijd).
- Elke tempo/ETA-functie in `actualProgress.ts`, `status.ts` en `liveMarker.ts` leest al
  generiek `leg.afstand_km`/`cumulatief_start_km` — dus die functies zelf zijn **niet**
  aangepast. `src/components/AppShell.tsx` bouwt `effortLegs` één keer via `useMemo`
  (naast `legs`, hetzelfde patroon als `statuses`/`checkinTimes`) en geeft 'm door aan
  `TopBar` en de kaart/sidebar-boom. Overal waar die functies worden aangeroepen voor een
  tempo- of ETA-cijfer gaat `effortLegs` erin; overal waar een kilometer wordt **getoond**
  (voortgangsbalk, "X km totaal", de route-popup) blijft het de echte `legs` — die twee
  nooit door elkaar halen. `TopBar.tsx` en `LegCard.tsx` hebben een `title`-tooltip op elk
  "Tempo"-label ("Hoogtegecorrigeerd tempo — houdt rekening met klimmen en dalen.") zodat
  dit ontdekbaar is zonder de tekst zelf langer te maken (belangrijk op mobiel, waar de
  topbar al krap staat).
- Tests voor `gradeAdjustedKm` en `buildEffortLegs` zitten in `src/lib/segments.test.ts`,
  naast de bestaande `buildLegSegments`-tests (geen apart `geo.test.ts`).

- `src/components/RouteMapLoader.tsx` — laadt de kaart client-side (`next/dynamic`,
  `ssr: false`), omdat Leaflet niet server-side kan renderen.
- `src/components/LegSchedule.tsx` + `LegCard.tsx` — het side-menu: elke etappe
  is een kaart-blok. Compact (voltooid en niet aangeklikt) blijft een
  ingeklapte regel — plaats, CP-badge, geplande tijd. Elke andere kaart
  (bezig, nog-te-gaan, of een voltooide kaart die is aangeklikt) toont in één
  oogopslag de volledige structuur, zonder extra klik: plaatsnaam + CP-badge +
  statuslabel, afstand deze leg · cumulatieve afstand, een Gepland/Werkelijk-
  tabel (Aankomst/Vertrek/Tempo — `computeLegTiming`, hierboven), een
  stopregel ("Stop: 10 min (CP)") als het een checkpoint is, de buddy-badge en
  het adres. De Werkelijk-kolom toont "–" (niet vetgedrukt, om 'm duidelijk
  als placeholder te onderscheiden van een echte waarde) zolang er geen
  check-in is — nooit een misleidende 0 of een schatting. Checkpoints
  (`cp_nummer` niet leeg) krijgen een badge en een groter bolletje.
  Bijzonderheden krijgen een opvallende "Let op"-waarschuwingsbox, niet
  weggemoffeld. Onder 768px breedte is het side-menu geen vaste
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
  met de Garmin LiveTrack-iframe. De link komt niet uit een env var maar uit
  Supabase (`settings`-tabel, één per `(route, party)`), instelbaar via
  `/beheer` — zie verderop. Zonder ingestelde link toont het paneel een
  placeholder in plaats van een kapotte iframe. Standaard dichtgeklapt
  (breedte 0, geen ruimte), togglebaar via de
  "Live"-knop in de topbar — die state leeft in `AppShell`. `RouteMap.tsx`
  bevat een kleine `MapResizeHandler` (ResizeObserver + `map.invalidateSize()`)
  omdat Leaflet zelf niet doorheeft dat zijn container breder/smaller wordt
  als dit paneel open- of dichtklapt. Onder 768px breedte (320px vaste
  paneelbreedte was ~85% van een telefoonscherm, bovenop een sidebar die toen
  al geen ruimte overliet) wordt het een full-screen overlay die van onderaf
  omhoog schuift (`transform: translateY`), met een duidelijke 44×44px
  sluitknop rechtsboven.

## Live GPS-tracking (los van Garmin)

Garmin LiveTrack bleek geen toegankelijke API te hebben om iemand anders'
sessie uit te lezen — daarom bestaat er een eigen, kleine pijplijn ernaast:

- Supabase `live_positions`-tabel: één rij per `(route, party)`, alleen de
  laatst gerapporteerde positie (geen trackgeschiedenis).
- `POST /api/live` (`src/app/api/live/route.ts`) — token-geauthenticeerd
  per `(route, party)`; zonder ingesteld token in `/beheer` is een party
  standaard dicht, niet open met een raadbare sleutel.
- `/beheer` heeft een live-tracking-tokenveld per `(route, party)`, met een
  "genereer nieuw token"-knop.
- `RouteMap`'s live bolletje geeft voorrang aan een verse (<3 min,
  `isLivePositionFresh` in `src/lib/liveMarker.ts`) `live_positions`-rij
  boven de bestaande check-in-gebaseerde schatting; valt terug op die
  schatting zodra een tracker stopt met rapporteren. Tempo/ETA blijven wel
  op check-ins gebaseerd — een los, groter stuk werk om ook uit
  opeenvolgende GPS-punten af te leiden, bewust niet in deze v1 meegenomen.
- `android/` — een losstaand Android Studio-project (Kotlin): een
  minimale app die elke ~30s de locatie ophaalt en naar `/api/live` post.
  Geschreven zonder ooit gecompileerd te zijn (deze sandbox had geen
  Android SDK) — zie `android/README.md` voor bouwinstructies en bekende
  aandachtspunten (met name achtergrond-locatie-betrouwbaarheid per
  telefoonmerk).
- `POST /api/live/traccar` (`src/app/api/live/traccar/route.ts`) — voor wie
  geen (Android-)telefoon bij zich draagt: een los GPS-trackertje (GT06-
  protocol) via een zelf-gehoste [Traccar](https://www.traccar.org/)
  instance, die elke gedecodeerde positie doorstuurt naar deze route. Zelfde
  `live_positions`-tabel en token per `(route, party)` als de Android-app —
  zie `traccar/README.md` voor de volledige opzet (server, apparaat
  registreren, SMS-configuratie van het trackertje).

## Meerdere routes

De app ondersteunt meerdere routes naast elkaar, ook al is er op dit moment
maar één actief (`11steden`) — de machinerie hieronder bleef staan nadat een
eerdere tweede/derde route (KAT100) na afloop van dat evenement weer uit
`ROUTES` is gehaald.

- `src/lib/routes.ts` — de enige plek die routes definieert: `slug`,
  `navLabel` (routeswitcher-knop), `pageTitle`, `gpxFile`,
  `startFinishPlaats` en `routeDescription` (kaart-popup/metadata-tekst).
  Nieuwe route toevoegen = een entry aan `ROUTES` plus een GPX-bestand in
  `data/` plus rijen in Supabase — verder hoeft nergens een route
  hardcoded te worden, alle componenten lezen deze config. Route weer
  weghalen = precies andersom: de entry uit `ROUTES` (en eventueel uit
  `PARTIES_BY_ROUTE` in `parties.ts`), de bijbehorende GPX uit `data/` — de
  Supabase-rijen (`legs`/`checkins`) kunnen gewoon blijven staan, die worden
  simpelweg niet meer opgevraagd zodra er geen route meer naar verwijst.
- De actieve route zit in de `?route=`-query-param (`11steden` is de
  default/fallback). `TopBar` rendert per route in `ROUTES` een knop die
  linkt naar `/?route=<slug>`; die knop draagt de route ook door naar
  `/schema` en `/invoer` zodat je niet per pagina opnieuw hoeft te
  wisselen. Met maar één route in `ROUTES` is er dus ook maar één knop (of,
  afhankelijk van hoe dat gerenderd wordt, geen zichtbare switcher).
- **Supabase**: `legs` en `checkins` hebben een `route`-kolom (`text`).
  `legs`' primary key is samengesteld — `(route, nr)`, niet alleen `nr` —
  en `checkins.leg_nr` verwijst via een samengestelde foreign key
  `(route, leg_nr) → legs(route, nr)`. Zonder die samenstelling zouden
  "leg 1" van twee verschillende routes tegen dezelfde rij botsen. Elke
  query (`loadLegs`, `loadCheckins`, `insertCheckin`) filtert expliciet op
  `route` — er is geen impliciete aanname dat er maar één route in de
  tabel voorkomt.
- Een route met een checkpoint dat de track twee keer passeert werkt zonder
  extra code: `segments.ts` zoekt toch al voorwaarts vanaf de vorige leg
  (zie de Bartlehiem-uitleg hierboven), dus de tweede passage snapt gewoon
  naar het juiste, latere stuk track.

## /invoer — fallback check-in met PIN

Basiscamp-invoerformulier voor als de Garmin LiveTrack uitvalt, achter een
4-cijferige PIN:

- `src/lib/checkinAuth.ts` — de PIN zelf verlaat de server nooit. De actuele
  PIN-hash komt uit de Supabase `settings`-tabel (ingesteld via `/beheer`,
  zie verderop), met de `CHECKIN_PIN`-env var als bootstrap-fallback zolang
  niemand via `/beheer` een PIN heeft gezet. `/api/invoer/verify` vergelijkt
  de ingevoerde PIN server-side en zet bij een match een **httpOnly** cookie
  met een SHA-256-hash van de PIN (12u geldig) — nooit de PIN zelf, en niet
  vergelijkbaar vanuit client-JS. `/api/invoer` (de check-in-insert)
  herberekent diezelfde hash server-side en vergelijkt met de cookie op
  **elke** submit, dus een directe POST zonder geldige PIN-sessie geeft altijd
  401 — geverifieerd met curl.
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

## /beheer — Garmin-links en PIN zelf beheren

PIN-gated instellingenscherm (zelfde PIN/cookie als `/invoer`) zodat een
organisator zonder Vercel-toegang of redeploy twee dingen kan bijwerken:

- **Garmin LiveTrack-links** — één veld per `(route, party)`-combinatie,
  automatisch gegenereerd uit `ROUTES` × `PARTIES_BY_ROUTE`
  (`allRouteParties()` in `src/lib/parties.ts`) — een nieuwe party krijgt dus
  vanzelf een werkend veld hier, zonder verdere code.
- **De check-in-PIN** — laat het veld leeg om de huidige PIN te behouden.
  Bij een wijziging wordt ook meteen de sessie-cookie van de invoerder zelf
  ververst, zodat die niet per ongeluk wordt uitgelogd door zijn eigen
  wijziging.

Beide worden opgeslagen in de Supabase `settings`-tabel (`key`/`value`,
`src/lib/settings.ts`) en zijn direct van kracht — geen redeploy nodig.
`/invoer` linkt er met een klein "⚙ Instellingen"-linkje naar door.

### Dit testen zonder op de racedag te wachten

Voeg testrijen toe aan `checkins` — via `/invoer` of
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

**`checkins`-schema**: `route` (text, bijv. `'11steden'`), `tijdstip`
(timestamptz), `leg_nr` (int, verwijst samen met `route` naar `legs`), `lat`/`lon`
(numeric, nullable), `notitie` (text, nullable), `invoerder` (text). Wijkt je
eigen tabel af, dan geeft de insert een duidelijke Supabase-foutmelding in het
formulier (geen silent failure), en is `src/lib/checkins.ts` de enige plek die
moet worden aangepast.

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

**Row Level Security**: `checkins` heeft zowel een insert- als een
select-policy voor `anon`: insert voor `/api/invoer`, select zodat de
kaart/sidebar het net ingevoerde check-in ook weer kan tonen — zonder die
select-policy slaagt de insert wel, maar blijft de kaart 'm nooit tonen
(stille failure, geen foutmelding).

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

## Route vervangen of toevoegen

Een bestaande route vervangen: zet een andere GPX-export (zelfde structuur:
`<gpx><trk><trkseg><trkpt lat="…" lon="…">`) op het pad dat `routes.ts` voor
die route noemt. Het startpunt wordt automatisch het eerste trackpoint.

Een tweede (of volgende) route toevoegen:

1. GPX-bestand in `data/` zetten.
2. Entry toevoegen aan `ROUTES` in `src/lib/routes.ts` (slug, labels,
   `gpxFile`, start/finish-tekst).
3. Rijen voor die `route`-slug toevoegen aan de Supabase-tabel `legs` (zie
   "Meerdere routes" hierboven voor de samengestelde primary key).

De routeswitcher in de topbar rendert automatisch een knop per entry in
`ROUTES` — daar hoeft niets voor aangepast te worden.
