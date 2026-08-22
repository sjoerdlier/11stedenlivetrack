#!/usr/bin/env python3
"""Polls gps666.net's (undocumented) internal API for the QXGPS/GF21
tracker's last known position and forwards it to 11stedenlivetrack's
/api/live endpoint -- the same endpoint the Android app already POSTs to.
This is a stopgap: the tracker itself only talks to gps666.net's own
platform, so this bridges the gap without needing the device to support a
custom server.

Logs in on its own (rather than reusing a token captured from a browser)
because gps666.net's session tokens are IP-bound -- a token minted in a
browser on one machine gets rejected (401) when reused from a different
IP, so this needs its own login, done from wherever this script runs, to
get a token valid for *this* machine's IP. Re-logs in automatically on a
401, so it self-heals if the session expires mid-event.

Only pushes to /api/live when gps666.net reports a *new* GPS fix -- except
while the tracker is genuinely stationary (confirmed on 2026-08-21: gps666's
own dashboard showed the device still communicating minutes ago while its
last real fix was 1h38m old), in which case it periodically re-pushes the
same position as a heartbeat. Without that, a long stationary period (a
real checkpoint stop during the race, or just sitting on a desk during
testing) is indistinguishable on our side from the tracker having gone
completely silent -- both look like "no /api/live traffic" -- which is
exactly the failure mode /beheer's tracker-status panel exists to catch.
See HEARTBEAT_SECONDS/MAX_HEARTBEAT_WITHOUT_NEW_FIX_SECONDS below.

Fragile by nature (reverse-engineered from a browser HAR capture, not a
documented API) -- if gps666.net changes their frontend, this breaks.
Fine for a one-weekend event; not meant to be a permanent fixture.
"""
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

# -- gps666.net account + this app's live-tracking token --
# Read from the environment (see docker-compose.yml / .env.example), never
# hardcoded here -- this repo is public on GitHub.
GPS666_ACCOUNT = os.environ["GPS666_ACCOUNT"]
GPS666_PASSWORD = os.environ["GPS666_PASSWORD"]
LIVETRACK_TOKEN = os.environ["LIVETRACK_TOKEN"]

# -- 11stedenlivetrack.nl target --
LIVETRACK_URL = "https://11stedenlivetrack.vercel.app/api/live"
ROUTE = "11steden"
PARTY = "team"

POLL_SECONDS = 30

# How often to re-push the same position as a "still here" heartbeat while
# gps666.net keeps reporting the *same* fix (i.e. the tracker hasn't moved).
# Comfortably under 11stedenlivetrack's own LIVE_POSITION_MAX_AGE_MS (20
# minutes) so the site's staleness check never trips just because the
# walker/tracker is standing still.
HEARTBEAT_SECONDS = 10 * 60

# Caps how long an *unchanged* fix keeps getting re-pushed as a heartbeat.
# Without this, a tracker that goes genuinely offline (dead battery, no
# signal, powered down) -- but whose last known fix gps666.net keeps
# serving from its own cache -- would look "alive" on our site forever.
# 3 hours comfortably covers a real checkpoint stop (~10 min per the
# schedule) with a lot of margin, while still eventually going quiet --
# correctly -- if the underlying data really has been stale that long.
MAX_HEARTBEAT_WITHOUT_NEW_FIX_SECONDS = 3 * 60 * 60


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def mapi_call(sid, module: str, func: str, params: dict) -> dict:
    log(f"calling {module}.{func}")
    url = "https://www.gps666.net/mapi"
    if sid:
        # The token can contain URL-sensitive characters (e.g. "+", which
        # x-www-form-urlencoded parsing would otherwise read back as a
        # space) -- unencoded, that silently corrupts the token and the
        # very next call gets rejected even though login itself succeeded.
        url += f"?sid={urllib.parse.quote(sid, safe='')}"
    body = json.dumps({"params": params, "module": module, "func": func}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        # A bare urllib request has no browser-like fingerprint at all --
        # gps666.net (or a WAF in front of it) rejects that outright with a
        # bare HTTP 401, before even looking at the login credentials. These
        # headers are copied verbatim from a real browser's request (see the
        # HAR capture) to look like one.
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://gps666.net",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-GB,en;q=0.9,en-US;q=0.8",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0"
            ),
            "sec-ch-ua": '"Not=A?Brand";v="99", "Microsoft Edge";v="151", "Chromium";v="151"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def login():
    """Logs in fresh from wherever this script runs. Returns (sid, sfamily)."""
    pwd_md5 = hashlib.md5(GPS666_PASSWORD.encode("utf-8")).hexdigest()
    data = mapi_call(
        None,
        "user",
        "Login",
        {
            "account": GPS666_ACCOUNT,
            "pwd_md5": pwd_md5,
            "lang": "ch",
            "platform": "web",
            "type": 58,
            "info": "11stedenlivetrack-bridge",
        },
    )
    if data.get("errcode") != 0:
        raise RuntimeError(f"login failed: {data}")
    sid = data["sid"]
    log("logged in to gps666.net")

    # The browser's own flow calls GetFamilyList right after logging in and
    # uses *that* response's family sid from then on, rather than the one
    # already embedded in the Login response -- mirroring that exactly,
    # since reusing Login's own family sid directly kept getting rejected.
    family_data = mapi_call(
        sid, "family", "GetFamilyList", {"f_limit_size": 100, "g_limit_size": 100, "familyid": ""}
    )
    if family_data.get("errcode") != 0:
        raise RuntimeError(f"GetFamilyList failed: {family_data}")
    sfamily = family_data["familys"][0]["sid"]
    return sid, sfamily


def fetch_position(sid, sfamily):
    data = mapi_call(sid, "family", "GetRunInfo", {"limit_size": 500, "sfamily": sfamily})
    if data.get("errcode") != 0:
        raise RuntimeError(f"gps666 error: {data}")
    items = data.get("items") or []
    if not items:
        raise RuntimeError("no devices in GetRunInfo response")
    last_pos = json.loads(items[0]["last_pos"])
    lat_str, lon_str = last_pos["wgs"].split(",")
    return float(lat_str), float(lon_str), last_pos["time"]


def push_position(lat: float, lon: float, fix_time: float) -> None:
    body = json.dumps(
        {
            "route": ROUTE,
            "party": PARTY,
            "lat": lat,
            "lon": lon,
            "recordedAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(fix_time)),
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        LIVETRACK_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LIVETRACK_TOKEN}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        log(f"pushed {lat},{lon} -> {resp.read().decode('utf-8')}")


def main() -> None:
    sid = sfamily = None
    last_pushed_fix_time = None
    # Wall-clock (time.time()) bookkeeping, distinct from fix_time (which
    # comes from gps666.net and only changes when the device actually gets
    # a new GPS fix) -- these track *our own* push history instead.
    last_push_wall_time = 0.0
    last_real_fix_wall_time = 0.0

    while True:
        try:
            if sid is None:
                sid, sfamily = login()
            lat, lon, fix_time = fetch_position(sid, sfamily)
            now = time.time()

            if fix_time != last_pushed_fix_time:
                push_position(lat, lon, fix_time)
                last_pushed_fix_time = fix_time
                last_push_wall_time = now
                last_real_fix_wall_time = now
            elif (
                now - last_push_wall_time >= HEARTBEAT_SECONDS
                and now - last_real_fix_wall_time <= MAX_HEARTBEAT_WITHOUT_NEW_FIX_SECONDS
            ):
                # Same fix as last time (the tracker hasn't moved), but
                # gps666.net is still answering for this device -- push a
                # heartbeat at the *current* time (not the stale fix_time)
                # so live_positions' latest row keeps looking fresh instead
                # of quietly going stale just because nothing moved.
                push_position(lat, lon, now)
                last_push_wall_time = now
                log("no new fix -- pushed heartbeat at last known position")
            else:
                log("no new fix yet")
        except urllib.error.HTTPError as e:
            log(f"ERROR: HTTP {e.code} from {e.url}")
            sid = sfamily = None
        except Exception as e:  # noqa: BLE001 -- keep the loop alive no matter what
            log(f"ERROR: {e}")
            sid = sfamily = None
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
