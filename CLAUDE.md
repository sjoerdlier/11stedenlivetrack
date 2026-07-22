# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm install
npm run dev             # dev server, http://localhost:3000
npm run build           # production build (next build)
npm run lint            # eslint (eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit        # type check (no separate script for this)
```

There is no test suite/framework in this repo. Treat `npx tsc --noEmit`, `npm run lint`,
and `npm run build` as the verification bar for any change, plus a manual check in the
browser for anything UI-facing — `npm run build` catches most issues but not visual/UX
regressions.

Requires `.env.local` (see `.env.example`) with `SUPABASE_URL` and `SUPABASE_ANON_KEY` at
minimum — both `src/lib/legs.ts` and `src/lib/checkins.ts` throw immediately without them,
so the app won't run at all locally without a Supabase project. Optional env vars
(`NEXT_PUBLIC_DONATION_URL`, `NEXT_PUBLIC_GARMIN_LIVETRACK_URL`, `CHECKIN_PIN`) each
degrade to a visible placeholder/disabled state when unset rather than crashing — that's
intentional, not a bug to fix.

## Architecture

Three data sources feed the app, combined once per request in `src/app/page.tsx`
(`force-dynamic`, since two of the three are live): the GPX track (`data/route.gpx`,
static file, parsed by `src/lib/gpx.ts`), the `legs` table in Supabase (the schedule —
`src/lib/legs.ts`), and the `checkins` table in Supabase (real-world data entered via
`/invoer` during the actual event — `src/lib/checkins.ts`). `src/lib/segments.ts` cuts the
GPX track into one polyline per leg by walking forward through the track points from the
previous leg's index — a plain nearest-point search would mis-snap at spots the route
passes twice (e.g. Bartlehiem).

**Two parallel, non-overlapping "truth" systems** — don't mix them:
- `src/lib/status.ts` — schedule-derived: leg status (voltooid/bezig/nog-te-gaan),
  progress, planned pace, and the pre-start countdown, all computed from each leg's
  `geplande_tijd`.
- `src/lib/actualProgress.ts` — check-in-derived: real progress/pace/ETA computed from
  actual `checkins` rows instead of the schedule.

`src/components/TopBar.tsx` is where these two meet: it renders the schedule-based view
(progress bar + planned pace, or the countdown before leg 1 starts) until `checkins` has
at least one row, at which point it switches wholesale to the check-in-derived view. An
empty `checkins` table is the expected pre-race-day state, not an error condition.

`leg.afstand_km` is **forward-looking** — the distance from *this* leg's start to the
*next* leg's start, not the distance walked to arrive here. The finish row is last in the
`legs` list and has `afstand_km`/`loper` set to `null` (it's an endpoint, not a walkable
stage). Anything that sums or divides by leg distance needs to respect this direction —
see `actualLegPaceKmh` in `actualProgress.ts` for the pattern (it deliberately uses the
*previous* leg's distance against the elapsed time between two consecutive check-ins).

`src/components/AppShell.tsx` is the single place that computes shared derived state once
per render (`now` via `useSimulatedNow`, `statuses`, `checkinTimes`) and threads it down to
both `TopBar` and the map/sidebar tree (`RouteMapLoader` → `RouteMap` → `LegSchedule` →
`LegCard`), so every surface reads the same snapshot. `RouteMap` (react-leaflet) can't
render server-side, so it's loaded through `RouteMapLoader` via `next/dynamic` with
`ssr: false`.

`/invoer` is a PIN-gated fallback for manually logging check-ins if the Garmin LiveTrack
feed fails. The PIN (`CHECKIN_PIN`) never reaches the client: `/api/invoer/verify` sets an
httpOnly cookie containing a SHA-256 hash of it, and `/api/invoer` (the actual check-in
insert) recomputes and compares that hash server-side on every submit.

Debug mode: `?debugTime=<ISO date>` on any URL freezes "now" for the whole app via
`src/lib/useSimulatedNow.ts` — the single hook behind every time-based computation
(status colors, progress, the countdown). A future RunnerFigure PR (marker position along
the route) is expected to want its own time-simulation source and will likely conflict
with this file — that's anticipated, not something to design around.

This repo currently has no `main` branch — check `git remote show origin` (or ask) for the
actual default/integration branch before opening a PR.

All Dutch-locale formatting (`nl-NL` decimals with commas, `Europe/Amsterdam` timestamps)
goes through `src/lib/format.ts`; add new formatters there rather than inlining
`Intl`/`toLocaleString` calls elsewhere.
