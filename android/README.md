# Livetrack Tracker (Android)

A minimal Android app that shares a phone's GPS position with the
11Stedentocht livetrack site every ~30 seconds — the Garmin-LiveTrack
alternative, since Garmin has no accessible API for another app to read a
LiveTrack session (see the main repo's `src/app/api/live/route.ts` for the
receiving end).

**This project was written without ever being compiled.** The sandbox this
was built in has no Android SDK and can't reach Google's SDK download
servers, so there was no way to build or run it there. It's written
carefully and reviewed by hand, but the first real build (yours, in Android
Studio) is also its first real build, full stop — budget time for at least
one round of "fix a Gradle/SDK version mismatch" before it runs.

## What it does

A calm status screen — brand colors and type matching the site itself —
that shows one of three panels depending on state:

- **Not set up yet**: the four fields (server URL, route, "who are you",
  and a live-tracking token from `/beheer`) live on a separate settings
  screen behind the gear icon, not on the main screen. The empty state
  points there.
- **Permission primer**: shown once, the first time you ever tap "Start
  livetracking" — explains *why* the app is about to ask for background
  location and a battery-optimization exemption, before the OS dialogs
  themselves show up.
- **Hero**: a pulsing marker plus live status (active/idle/error), how long
  you've been sharing, how long ago the last update landed, which
  route/party you're sharing as, and a "bekijk mezelf op de kaart" link
  straight to the site.

Once started, a foreground service (a persistent notification, so it's
never silently killed) requests a location update roughly every 30 seconds
and POSTs it to `<server-url>/api/live`. Stop it the same way.

A few reliability details that aren't visible as separate screens:

- **Survives a reboot.** If the phone restarts while tracking was on,
  `BootReceiver` resumes the foreground service automatically instead of
  leaving sharing silently off until someone notices.
- **Themed splash screen** on cold start (via `core-splashscreen`), and a
  proper adaptive launcher icon — no more generic default icon in the app
  drawer.
- **Dark mode** follows the phone's system setting, using the same
  light/dark token pairs as the website.

## Building it

1. Install [Android Studio](https://developer.android.com/studio) (any
   recent version).
2. Open this `android/` folder as a project (**not** the repo root — this
   is a separate Gradle project from the Next.js app next to it).
3. Let Gradle sync. **There's no `gradlew`/`gradle-wrapper.jar` checked
   in** — those are binary files this environment couldn't fetch reliably,
   so they're deliberately left out rather than committing something
   possibly-broken. Android Studio will offer to generate the wrapper on
   first open ("Gradle wrapper not found — create wrapper task?" or
   similar); accept that, or run `gradle wrapper` yourself if you have
   Gradle installed locally. The root `build.gradle.kts` pins Android
   Gradle Plugin 8.5.2 / Kotlin 1.9.24 — if Android Studio's sync wants to
   bump these, that's fine, just re-sync after.
4. Build → Run on a real phone (a background-location foreground service
   is meaningless on the emulator — test on the device you'll actually
   wear during the tocht).

## Setting it up for someone to actually use

1. On the site, go to `/beheer`, generate a live-tracking token for their
   `(route, party)`, save.
2. In the app, tap the gear icon: server URL
   (`https://11stedenlivetrack.vercel.app`), route slug (e.g. `11steden`),
   party slug (e.g. `team` — see `src/lib/parties.ts` in the main repo for
   the exact slugs currently configured), and paste that token in, then
   save.
3. Back on the main screen, tap "Start livetracking". The first time ever,
   you'll see a short explanation screen before anything else happens —
   after that: location permission, then (Android 10+) a *second* prompt
   for background location access, then a battery-optimization exemption
   screen for this app specifically. All three matter — skipping any of
   them is the most likely reason tracking stops working once the phone's
   screen is off for a while.

## The background-location reliability problem, and what this does about it

This was flagged as the real risk before building it at all: Android
manufacturers (Samsung, Xiaomi, Huawei, OnePlus, and others) layer their
own aggressive battery managers on top of stock Android, and those will
kill a background app's process regardless of what the app itself does —
the standard `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` exemption this app
requests only covers *stock Android's* Doze/App Standby, not those
manufacturer-specific killers.

If tracking mysteriously stops on a specific phone, the fix is almost
always in that phone's own settings, not this app — the phrase to search
for is generally **"[phone brand] auto-start manager"** or **"battery
manager whitelist"**. A few well-known ones:

- **Samsung**: Settings → Apps → Livetrack Tracker → Battery →
  "Unrestricted" (not "Optimized").
- **Xiaomi/MIUI**: Security app → Battery → App battery saver → find the
  app → "No restrictions". Also Settings → Apps → Manage apps →
  Livetrack Tracker → Autostart → enable.
- **Huawei**: Settings → Battery → App launch → Livetrack Tracker → manage
  manually → enable all three toggles (auto-launch, secondary launch, run
  in background).
- **OnePlus/Oppo**: Settings → Battery → Battery optimization → find the
  app → "Don't optimize".

[dontkillmyapp.com](https://dontkillmyapp.com) has an up-to-date,
per-manufacturer list if a phone isn't listed above.

**Recommendation**: test this on each phone that will actually use it
*before* race day — start tracking, lock the phone, leave it alone for at
least 30-60 minutes, and check `/beheer` or the site's live marker to
confirm updates kept arriving the whole time. That's the only way to know
a given phone's battery manager isn't quietly killing it.

## HTTPS only

The manifest sets `android:usesCleartextTraffic="false"`, so this only
talks to `https://` URLs. That's correct for the real deployed site — but
it also means pointing the "server URL" field at a plain-`http://` local
dev server (e.g. `http://192.168.1.x:3000`) will fail silently-ish (a
network error with no obvious cause). Test against the real Vercel URL, or
temporarily allow cleartext for a specific local IP via a network security
config if you really need to test against `next dev`.
