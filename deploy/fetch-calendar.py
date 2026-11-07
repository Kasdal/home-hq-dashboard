#!/usr/bin/env python3
"""Fetch a private iCalendar feed and write calendar.json for the dashboard.

The feed URL is read from ~/homehq/data/calendar.url and is never printed.
Run from cron. Uses only the Python standard library.
"""

import json
import os
import sys
import urllib.request
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

DATA = os.environ.get("HOMEHQ_DATA") or os.path.join(os.path.expanduser("~"), "homehq", "data")
URL_FILE = os.path.join(DATA, "calendar.url")
CACHE_FILE = os.path.join(DATA, "calendar.ics")
OUT_FILE = os.path.join(DATA, "calendar.json")
CONFIG_FILE = os.path.join(DATA, "config.json")

WINDOW_DAYS = 14
MAX_EVENTS = 25
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]


def log(message):
    print(message, flush=True)


def load_timezone():
    try:
        with open(CONFIG_FILE, encoding="utf-8") as handle:
            name = json.load(handle).get("timezone")
        if name:
            return ZoneInfo(name)
    except Exception:
        pass
    return ZoneInfo("UTC")


def fetch_feed():
    if not os.path.exists(URL_FILE):
        return False
    with open(URL_FILE, encoding="utf-8") as handle:
        url = handle.read().strip()
    if not url:
        return False

    request = urllib.request.Request(url, headers={"User-Agent": "home-hq-dashboard/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            body = response.read()
    except Exception as error:
        log("feed fetch failed: %s" % type(error).__name__)
        return False

    with open(CACHE_FILE, "wb") as handle:
        handle.write(body)
    return True


def unfold(text):
    lines = []
    for raw in text.splitlines():
        if raw.startswith((" ", "\t")) and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw)
    return lines


def split_property(line):
    name_part, _, value = line.partition(":")
    params = {}
    parts = name_part.split(";")
    name = parts[0].upper()
    for part in parts[1:]:
        key, _, val = part.partition("=")
        params[key.upper()] = val
    return name, params, value


def parse_dt(value, params, zone):
    value = value.strip()
    if not value:
        return None, False
    if value.endswith("Z") and "T" in value:
        return datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc), False
    if "T" in value:
        dt = datetime.strptime(value[:15], "%Y%m%dT%H%M%S")
        tzid = params.get("TZID")
        if tzid:
            try:
                return dt.replace(tzinfo=ZoneInfo(tzid)), False
            except Exception:
                pass
        return dt.replace(tzinfo=zone), False
    return datetime.strptime(value[:8], "%Y%m%d").date(), True


def parse_duration(value):
    value = value.strip().upper()
    if not value.startswith("P"):
        return None
    sign = -1 if value.startswith("-") else 1
    value = value.lstrip("+-")
    days = hours = minutes = 0
    number = ""
    in_time = False
    for char in value[1:]:
        if char.isdigit():
            number += char
            continue
        if char == "T":
            in_time = True
            number = ""
            continue
        if not number:
            continue
        amount = int(number)
        number = ""
        if char == "D":
            days = amount
        elif char == "W":
            days = amount * 7
        elif char == "H":
            hours = amount
        elif char == "M" and in_time:
            minutes = amount
    return sign * timedelta(days=days, hours=hours, minutes=minutes)


def parse_rule(value):
    rule = {}
    for part in value.split(";"):
        key, _, val = part.partition("=")
        key = key.upper()
        if key == "FREQ":
            rule["FREQ"] = val.upper()
        elif key == "INTERVAL":
            rule["INTERVAL"] = max(1, int(val))
        elif key == "COUNT":
            rule["COUNT"] = int(val)
        elif key == "UNTIL":
            rule["UNTIL"] = val
        elif key == "BYDAY":
            rule["BYDAY"] = [item[-2:] for item in val.split(",") if item]
        elif key == "BYMONTHDAY":
            rule["BYMONTHDAY"] = [int(item) for item in val.split(",")]
        elif key == "BYMONTH":
            rule["BYMONTH"] = [int(item) for item in val.split(",")]
    return rule


def add_months(value, months):
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1
    day = min(value.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                          31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return value.replace(year=year, month=month, day=day)


def occurrences(start, rule, until_dt, limit_dt):
    freq = rule.get("FREQ")
    interval = rule.get("INTERVAL", 1)
    count = rule.get("COUNT")
    made = 0

    def allowed(cur):
        return until_dt is None or cur <= until_dt

    if freq == "DAILY":
        cur = start
        while cur <= limit_dt and allowed(cur):
            yield cur
            made += 1
            if count and made >= count:
                return
            cur += timedelta(days=interval)

    elif freq == "WEEKLY":
        days = rule.get("BYDAY") or [DAY_CODES[start.weekday()]]
        indexes = sorted(DAY_CODES.index(day) for day in days)
        week = start - timedelta(days=start.weekday())
        while week <= limit_dt:
            for index in indexes:
                cur = week + timedelta(days=index)
                if cur < start or not allowed(cur):
                    continue
                if cur > limit_dt:
                    return
                yield cur
                made += 1
                if count and made >= count:
                    return
            week += timedelta(weeks=interval)

    elif freq == "MONTHLY":
        cursor = start
        while cursor <= limit_dt and allowed(cursor):
            days = rule.get("BYMONTHDAY") or [start.day]
            for day in days:
                try:
                    cur = cursor.replace(day=day)
                except ValueError:
                    continue
                if cur < start or not allowed(cur):
                    continue
                yield cur
                made += 1
                if count and made >= count:
                    return
            cursor = add_months(cursor, interval)

    elif freq == "YEARLY":
        cursor = start
        while cursor <= limit_dt and allowed(cursor):
            months = rule.get("BYMONTH") or [start.month]
            if rule.get("BYMONTHDAY"):
                days = rule["BYMONTHDAY"]
            elif rule.get("BYMONTH"):
                days = [1]
            else:
                days = [start.day]
            for month in months:
                for day in days:
                    try:
                        cur = cursor.replace(month=month, day=day)
                    except ValueError:
                        continue
                    if cur < start or not allowed(cur):
                        continue
                    yield cur
                    made += 1
                    if count and made >= count:
                        return
            try:
                cursor = cursor.replace(year=cursor.year + interval)
            except ValueError:
                cursor = cursor.replace(year=cursor.year + interval, day=28)

    else:
        yield start


def parse_calendar(text, zone):
    lines = unfold(text)
    events = []
    current = None

    for line in lines:
        if line == "BEGIN:VEVENT":
            current = {"exdate": [], "rule": None, "recurrence_id": None, "override": False}
            continue
        if line == "END:VEVENT":
            if current and current.get("start") is not None:
                events.append(current)
            current = None
            continue
        if current is None or ":" not in line:
            continue

        name, params, value = split_property(line)
        if name == "SUMMARY":
            current["title"] = value.replace("\\,", ",").replace("\\n", " ").strip() or "Untitled"
        elif name == "LOCATION":
            current["location"] = value.replace("\\,", ",").strip()
        elif name == "DTSTART":
            current["start"], current["all_day"] = parse_dt(value, params, zone)
        elif name == "DTEND":
            current["end"], _ = parse_dt(value, params, zone)
        elif name == "DURATION":
            current["duration"] = parse_duration(value)
        elif name == "RRULE":
            current["rule"] = parse_rule(value)
        elif name == "EXDATE":
            for item in value.split(","):
                parsed, _ = parse_dt(item, params, zone)
                if parsed is not None:
                    current["exdate"].append(parsed)
        elif name == "RECURRENCE-ID":
            parsed, _ = parse_dt(value, params, zone)
            current["recurrence_id"] = parsed
            current["override"] = True
        elif name == "STATUS":
            current["status"] = value.upper()

    return events


def to_local(value, zone):
    if isinstance(value, date) and not isinstance(value, datetime):
        return datetime.combine(value, time.min).replace(tzinfo=zone)
    if value.tzinfo is None:
        return value.replace(tzinfo=zone)
    return value.astimezone(zone)


def main():
    zone = load_timezone()
    fetched = fetch_feed()

    source = CACHE_FILE if os.path.exists(CACHE_FILE) else None
    if source is None:
        log("no calendar.ics and no feed; nothing to do")
        return 1

    with open(source, encoding="utf-8", errors="replace") as handle:
        events = parse_calendar(handle.read(), zone)

    now = datetime.now(zone)
    limit = now + timedelta(days=WINDOW_DAYS)

    overrides = {}
    masters = []
    for event in events:
        if event.get("status") == "CANCELLED":
            continue
        if event.get("override") and event.get("recurrence_id") is not None:
            key = to_local(event["recurrence_id"], zone).strftime("%Y%m%dT%H%M%S")
            overrides[key] = event
        else:
            masters.append(event)

    output = []
    for event in masters:
        start = event["start"]
        all_day = event.get("all_day", False)
        start_dt = to_local(start, zone)
        duration = event.get("duration")
        if duration is None and event.get("end") is not None:
            end_dt = to_local(event["end"], zone)
            duration = end_dt - start_dt
        if duration is None:
            duration = timedelta(days=1) if all_day else timedelta(hours=1)

        rule = event.get("rule")
        if rule:
            until_value = rule.get("UNTIL")
            until_dt = None
            if until_value:
                until_dt, _ = parse_dt(until_value, {}, zone)
                until_dt = to_local(until_dt, zone)
            starts = list(occurrences(start_dt, rule, until_dt, limit))
        else:
            starts = [start_dt]

        excluded = {to_local(item, zone).strftime("%Y%m%dT%H%M%S") for item in event["exdate"]}

        for item in starts:
            key = item.strftime("%Y%m%dT%H%M%S")
            if key in excluded:
                continue
            replacement = overrides.get(key)
            if replacement is not None:
                rep_start = to_local(replacement["start"], zone)
                output.append({
                    "title": replacement.get("title") or event.get("title") or "Untitled",
                    "start": rep_start,
                    "end": rep_start + duration,
                    "allDay": replacement.get("all_day", all_day),
                    "location": replacement.get("location", ""),
                })
                continue
            if item + duration < now - timedelta(hours=12):
                continue
            output.append({
                "title": event.get("title") or "Untitled",
                "start": item,
                "end": item + duration,
                "allDay": all_day,
                "location": event.get("location", ""),
            })

    output.sort(key=lambda item: item["start"])
    output = output[:MAX_EVENTS]

    payload = {
        "updated": now.strftime("%Y-%m-%dT%H:%M:%S"),
        "source_fetched": fetched,
        "events": [
            {
                "title": item["title"],
                "start": item["start"].strftime("%Y-%m-%dT%H:%M:%S"),
                "end": item["end"].strftime("%Y-%m-%dT%H:%M:%S"),
                "allDay": bool(item["allDay"]),
                "location": item.get("location", ""),
            }
            for item in output
        ],
    }

    temp = OUT_FILE + ".tmp"
    with open(temp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=1)
    os.replace(temp, OUT_FILE)

    log("wrote %d events" % len(output))
    return 0


if __name__ == "__main__":
    sys.exit(main())
