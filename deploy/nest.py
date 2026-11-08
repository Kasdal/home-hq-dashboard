#!/usr/bin/env python3
"""Fetch the indoor temperature from the Nest thermostat.

Uses the unofficial Nest web API, the same one the Nest app uses. It is not
supported by Google and can break at any time.

Credentials live in data/nest-credentials.json (private, never in the repo):
  Google account: {"type": "google", "issue_token": "...", "cookies": "SID=..."}
  Legacy Nest:    {"type": "nest", "access_token": "b..."}

Output: data/nest.json
  {"temperature": 21.5, "target": 20, "mode": "heat", "unit": "C", "updated": "..."}

Run: python3 nest.py
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

BASE = os.environ.get("HOMEHQ_DIR") or os.path.join(os.path.expanduser("~"), "homehq")
DATA_DIR = os.environ.get("DATA_DIR") or os.path.join(BASE, "data")
CONFIG_DIR = os.environ.get("HOMEHQ_CONFIG") or os.path.join(
    os.path.expanduser("~"), ".config", "homehq"
)
# Not under data/: nginx serves data/ on the LAN. The token must stay private.
CRED_PATH = os.environ.get("NEST_CREDENTIALS") or os.path.join(
    CONFIG_DIR, "nest-credentials.json"
)
OUT_PATH = os.path.join(DATA_DIR, "nest.json")
LOCK_PATH = os.path.join(DATA_DIR, ".nest.lock")

USER_AGENT = "Nest/5.87.0 (iOScom.nestlabs.jasper.release) os=26.4"
HOST = "https://home.nest.com"
ISSUE_JWT_URL = "https://nestauthproxyservice-pa.googleapis.com/v1/issue_jwt"
APP_LAUNCH_URL = HOST + "/api/0.1/user/{user_id}/app_launch"

KNOWN_BUCKETS = [
    "buckets",
    "delayed_topaz",
    "demand_response",
    "device",
    "device_alert_dialog",
    "geofence_info",
    "kryptonite",
    "link",
    "message",
    "message_center",
    "metadata",
    "occupancy",
    "quartz",
    "safety",
    "safety_summary",
    "rcs_settings",
    "schedule",
    "shared",
    "structure",
    "structure_metadata",
    "topaz",
    "topaz_resource",
    "track",
    "trip",
    "tuneups",
    "user",
    "user_settings",
    "where",
    "widget_track",
]


def read_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path, doc, mode=0o644):
    directory = os.path.dirname(path)
    temp = os.path.join(directory, ".%s.tmp" % os.path.basename(path))
    with open(temp, "w", encoding="utf-8") as handle:
        json.dump(doc, handle, indent=2)
        handle.write("\n")
    os.chmod(temp, mode)
    os.replace(temp, path)


def request_json(url, headers=None, data=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)


def cookie_jar(value):
    jar = {}
    for part in (value or "").split(";"):
        name, sep, val = part.strip().partition("=")
        if sep and name:
            jar[name] = val
    return jar


def is_expired_set_cookie(attributes):
    max_age = None
    expires = None
    for attribute in attributes:
        key, _, value = attribute.strip().partition("=")
        if key.lower() == "max-age":
            max_age = value.strip()
        elif key.lower() == "expires":
            expires = value.strip()
    if max_age is not None:
        try:
            return int(max_age) <= 0
        except ValueError:
            return False
    if expires:
        try:
            expiry = parsedate_to_datetime(expires)
        except (TypeError, ValueError):
            return False
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        return expiry <= datetime.now(timezone.utc)
    return False


def merge_cookies(cookies, set_cookie_headers):
    """Apply Set-Cookie headers to a Cookie header string."""
    jar = cookie_jar(cookies)
    changed = []
    for header in set_cookie_headers or []:
        pair, *attributes = header.split(";")
        name, sep, value = pair.partition("=")
        name = name.strip()
        value = value.strip()
        if not sep or not name:
            continue
        if is_expired_set_cookie(attributes):
            if jar.pop(name, None) is not None:
                changed.append(name)
        elif jar.get(name) != value:
            jar[name] = value
            changed.append(name)
    if not changed:
        return cookies, False
    return "; ".join("%s=%s" % (name, value) for name, value in jar.items()), True


def get_session(token):
    return request_json(
        HOST + "/session",
        headers={"Authorization": "Basic %s" % token, "User-Agent": USER_AGENT},
    )


def google_session(cred):
    issue_token = cred.get("issue_token")
    cookies = cred.get("cookies")
    if not issue_token or not cookies:
        raise RuntimeError("Google credentials need issue_token and cookies")

    req = urllib.request.Request(
        issue_token,
        headers={
            "Sec-Fetch-Mode": "cors",
            "User-Agent": USER_AGENT,
            "X-Requested-With": "XmlHttpRequest",
            "Referer": "https://accounts.google.com/o/oauth2/iframe",
            "cookie": cookies,
        },
    )
    with urllib.request.urlopen(req, timeout=25) as response:
        set_cookie = response.headers.get_all("Set-Cookie") or []
        body = json.load(response)

    updated, changed = merge_cookies(cookies, set_cookie)
    if changed:
        cred["cookies"] = updated
        write_json(CRED_PATH, cred, mode=0o600)

    if "error" in body:
        raise RuntimeError(body.get("detail") or body.get("error"))

    access_token = body.get("access_token")
    if not access_token:
        raise RuntimeError("Google did not return an access token")

    data = urllib.parse.urlencode(
        {
            "embed_google_oauth_access_token": "true",
            "expire_after": "3600s",
            "google_oauth_access_token": access_token,
            "policy_id": "authproxy-oauth-policy",
        }
    ).encode()
    result = request_json(
        ISSUE_JWT_URL,
        data=data,
        headers={
            "Authorization": "Bearer %s" % access_token,
            "User-Agent": USER_AGENT,
            "Referer": HOST,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    jwt = result.get("jwt")
    if not jwt:
        raise RuntimeError("No Nest JWT returned")
    return get_session(jwt)


def nest_session(cred):
    token = cred.get("access_token")
    if not token:
        raise RuntimeError("Legacy credentials need access_token")
    return get_session(token)


def fetch_buckets(session):
    body = json.dumps(
        {"known_bucket_types": KNOWN_BUCKETS, "known_bucket_versions": []}
    ).encode()
    return request_json(
        APP_LAUNCH_URL.format(user_id=session["userid"]),
        data=body,
        headers={
            "Authorization": "Basic %s" % session["access_token"],
            "X-nl-user-id": session["userid"],
            "X-nl-protocol-version": "1",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
    )


def to_celsius(value, scale):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if str(scale).upper().startswith("F"):
        number = (number - 32) * 5 / 9
    return round(number, 1)


def parse_buckets(doc):
    devices = {}
    shared = []
    for bucket in doc.get("updated_buckets") or []:
        key = bucket.get("object_key") or ""
        value = bucket.get("value") or {}
        if key.startswith("device."):
            devices[key.split(".", 1)[1]] = value
        elif key.startswith("shared."):
            shared.append((key.split(".", 1)[1], value))

    for device_id, value in shared:
        if value.get("current_temperature") is None:
            continue
        device = devices.get(device_id) or {}
        scale = device.get("temperature_scale") or value.get("temperature_scale") or "C"
        return {
            "temperature": to_celsius(value.get("current_temperature"), scale),
            "target": to_celsius(value.get("target_temperature"), scale),
            "mode": value.get("target_temperature_type")
            or device.get("hvac_mode")
            or "",
            "unit": "C",
            "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    raise RuntimeError("No thermostat temperature in the response")


def acquire_lock():
    try:
        import fcntl
    except ImportError:
        return None
    handle = open(LOCK_PATH, "w")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        handle.close()
        return None
    return handle


def main(argv):
    if len(argv) > 2 and argv[1] == "--parse":
        print(json.dumps(parse_buckets(read_json(argv[2])), indent=2))
        return 0

    lock = acquire_lock()
    if lock is None and os.path.exists(LOCK_PATH):
        print("Another nest.py run is active.", file=sys.stderr)
        return 0

    if not os.path.exists(CRED_PATH):
        print("Missing %s" % CRED_PATH, file=sys.stderr)
        return 1

    cred = read_json(CRED_PATH)
    kind = str(cred.get("type") or "google").lower()
    session = nest_session(cred) if kind == "nest" else google_session(cred)
    doc = fetch_buckets(session)
    out = parse_buckets(doc)
    write_json(OUT_PATH, out)
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except urllib.error.HTTPError as err:
        body = ""
        try:
            body = err.read().decode("utf-8", "replace")[:300]
        except Exception:
            pass
        print("HTTP %s: %s" % (err.code, body), file=sys.stderr)
        sys.exit(1)
    except Exception as err:  # noqa: BLE001 - cron wants one clear line
        print("nest.py failed: %s" % err, file=sys.stderr)
        sys.exit(1)
