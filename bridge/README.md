# gps666.net bridge

Polls gps666.net's (undocumented) internal API for Lowie's QXGPS/GF21
tracker and forwards each position to 11stedenlivetrack's `POST /api/live`
— the same endpoint the Android app already posts to. A stopgap: the
tracker only talks to gps666.net's own platform (it speaks the `JT/T808`
protocol, not the open GT06 protocol most consumer GPS trackers use), so
this bridges the gap instead of needing the device to support a custom
server.

Reverse-engineered from a browser HAR capture, not a documented API —
fragile by nature (if gps666.net changes their frontend, this breaks). Built
for one weekend (the 2026 Elfstedentocht), not meant to be a permanent
fixture.

An earlier version of this ran alongside a self-hosted
[Traccar](https://www.traccar.org/) instance, on the assumption the tracker
spoke the open GT06 protocol Traccar decodes — that assumption turned out to
be wrong (see above), so Traccar was never actually decoding a real position
from the device. That path (and `/api/live/traccar`) has since been removed;
this bridge is the only ingest path for this tracker now.

## Runs outside this repo's own deploys

This folder is versioned here so the script itself goes through normal
git/PR review, but it doesn't run on Vercel — it runs continuously on its
own always-on VM (currently a Google Cloud Platform instance), separate
from the Next.js app's own deploys.

## Deploying / updating

1. On the VM, inside a clone of this repo:
   ```bash
   git pull
   cd bridge
   ```
2. First-time setup only: copy `.env.example` to `.env` and fill in the
   real values — the gps666.net account/password, and the live-tracking
   bearer token for `(11steden, team)` (generate/copy it from `/beheer`).
   `.env` is gitignored (see the repo root's `.gitignore`'s `.env*` rule) —
   never commit it.
3. Start it:
   ```bash
   docker compose up -d
   ```
4. After a code change (e.g. this repo's `bridge.py` was updated and you
   `git pull`ed): since `bridge.py` is bind-mounted into the container, not
   baked into the image, a plain restart picks up the new file — no rebuild
   needed:
   ```bash
   docker compose restart gps666-bridge
   ```
5. Check it's actually running and pushing:
   ```bash
   docker compose logs -f gps666-bridge
   ```
   A healthy run logs a `pushed <lat>,<lon> -> ...` (or, while the tracker
   is stationary, `no new fix -- pushed heartbeat at last known position`)
   roughly every 30 seconds.

## Heartbeat behavior

`bridge.py` only forwards a *new* GPS fix by default — but a genuinely
stationary tracker (a checkpoint stop during the race, or just sitting on a
desk during testing) can keep communicating with gps666.net for hours
without gps666.net ever reporting a *new* fix, since its own "positioning
time" only updates on real movement. Without accounting for that, a
perfectly healthy but stationary tracker looks identical, on
11stedenlivetrack's own site, to one that's gone completely silent — both
just stop producing `/api/live` traffic.

To avoid that false alarm, the bridge re-pushes the same last-known position
as a heartbeat every `HEARTBEAT_SECONDS` (10 minutes) as long as gps666.net
keeps answering for the device, capped at
`MAX_HEARTBEAT_WITHOUT_NEW_FIX_SECONDS` (3 hours) — past that cap it goes
quiet again, on the assumption that something's *actually* wrong rather than
the tracker just being stationary for an unusually long time. See the
comments above those two constants in `bridge.py` for the full reasoning.
