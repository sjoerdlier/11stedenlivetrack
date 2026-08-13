# Traccar (los GPS-trackertje, zonder Android-telefoon)

Een zelf-gehoste [Traccar](https://www.traccar.org/) instance die het GT06-protocol
(gesproken door veel budget GPS-trackers, waaronder het GF-21-toestel dat hier
gebruikt wordt) decodeert en elke nieuwe positie doorstuurt naar
`POST /api/live/traccar` op de site — dezelfde `live_positions`-tabel, dezelfde
kaart-marker, dezelfde freshness-logica als de Android-app, alleen een ander
apparaat dat de positie aanlevert. Bedoeld voor iemand die geen (Android-)telefoon
bij zich draagt tijdens de tocht.

## 1. Server draaien

Vereist een eigen VPS met een publiek IP en open poorten — dit **kan niet** op
Vercel (dat heeft geen raw TCP-poorten). Zie de Oracle Cloud Always Free
ARM-instance stappen die je al hebt (of een andere VPS).

Op die server, met Docker geïnstalleerd:

1. Kopieer dit hele `traccar/`-mapje naar de server (of clone de repo daar).
2. Open `docker-compose.yml` en vul in:
   - `CONFIG_FORWARD_URL`: `https://<jouw-site>/api/live/traccar?route=11steden&party=team`
   - `CONFIG_FORWARD_HEADER`: `Authorization: Bearer <token>` — genereer dit token
     via `/beheer` op de site, bij het live-tracking-tokenveld voor
     `(11steden, team)`. **Hetzelfde token als de Android-app gebruikt** — dit
     is geen los toestel-token, het is dezelfde persoon (Lowie) via een ander
     kanaal, dus één tokenslot per party klopt.
3. `docker compose up -d`
4. Check dat de webinterface bereikbaar is: `http://<server-ip>:8082` (eerste
   keer inloggen: admin/admin — verander dat wachtwoord meteen).

## 2. Het trackertje registreren in Traccar

1. Log in op de webinterface, ga naar **Devices → Add** (het plusje).
2. **Identifier**: het IMEI-nummer van het trackertje (staat vaak op een
   sticker onder de klep, of in de meegeleverde documentatie/app).
3. Naam: iets herkenbaars, bv. "Lowie GF21".
4. Opslaan. Traccar weet nu welk binnenkomend GT06-bericht bij welk apparaat hoort.

## 3. Het trackertje configureren (SMS)

Stop de simkaart (met SMS + data, zie de hoofd-README) in het toestel, zet 'm
aan, en stuur twee SMS'jes naar het telefoonnummer van die simkaart:

```
APN,<apn-naam-van-je-provider>#
```
```
SERVER,0,<server-ip>,5023,0#
```

Het toestel antwoordt op beide met "OK" als het gelukt is. Zie de handleiding
die je bij de verkoper hebt opgevraagd voor de exacte commando-syntax van dit
specifieke toestel — GT06-varianten wijken hier soms licht in af.

## 4. Testen

- Beweeg het toestel een beetje (of wacht op de eerste periodieke update) en
  check in Traccar's webinterface (**Devices**, of de kaart) of er een positie
  binnenkomt.
- Check daarna of diezelfde positie op de site zelf verschijnt (het live
  bolletje op de kaart, of `/beheer`'s laatste-update-tijd).
- Komt het niet aan bij Traccar: waarschijnlijk de SMS-configuratie (verkeerd
  IP/poort, of dit toestel gebruikt een net iets ander protocol dan verwacht).
- Komt het wel aan bij Traccar maar niet op de site: check
  `docker compose logs traccar` voor forwarding-fouten (bv. verkeerd token,
  verkeerde URL).

## Waarom niet gewoon de Android-app?

Deze route bestaat specifiek voor iemand die geen telefoon bij zich draagt
tijdens de tocht — een los trackertje is kleiner en heeft geen telefoon nodig.
Beide routes schrijven naar dezelfde `(route, party)`-plek, dus ze zijn
onderling inwisselbaar, niet iets waar je tussen moet kiezen voor de hele groep.
