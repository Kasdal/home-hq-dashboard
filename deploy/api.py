#!/usr/bin/env python3
"""Minimal data API for the Home HQ dashboard.

GET  /shopping  -> the current shopping list
POST /shopping  -> replace the shopping list
GET  /state     -> shared state (bin confirmations)
POST /state     -> confirm one bin day

Files are written with a temporary file and os.replace, so a reader never sees
a half-written document. Only the standard library is used.
"""

import json
import os
import re
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DATA_DIR = os.environ.get("DATA_DIR", "/data")
SHOPPING_FILE = os.path.join(DATA_DIR, "shopping.json")
STATE_FILE = os.path.join(DATA_DIR, "state.json")
PORT = int(os.environ.get("PORT", "8099"))
MAX_BODY = 128 * 1024
STATE_KEEP_DAYS = 60

LOCK = threading.Lock()

DEFAULT_SHOPPING = {
    "rev": 1,
    "stores": [{"id": "tesco", "name": "Tesco"}, {"id": "lidl", "name": "Lidl"}],
    "items": [],
    "usuals": [],
}

DEFAULT_STATE = {"bins": {}}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
STAMP_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$")


def write_doc(path, doc):
    os.makedirs(DATA_DIR, exist_ok=True)
    handle, temp_path = tempfile.mkstemp(dir=DATA_DIR, prefix=".homehq-", suffix=".tmp")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            json.dump(doc, stream, ensure_ascii=False, indent=1)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_path, path)
        os.chmod(path, 0o644)
    except Exception:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
        raise


def read_doc(path, default):
    try:
        with open(path, encoding="utf-8-sig") as stream:
            data = json.load(stream)
        return data if isinstance(data, dict) else dict(default)
    except FileNotFoundError:
        with LOCK:
            doc = dict(default)
            write_doc(path, doc)
        return doc
    except Exception:
        return dict(default)


def validate_shopping(doc):
    if not isinstance(doc, dict):
        raise ValueError("body must be an object")

    items = doc.get("items")
    usuals = doc.get("usuals")
    stores = doc.get("stores")
    if not isinstance(items, list) or not isinstance(usuals, list) or not isinstance(stores, list):
        raise ValueError("items, usuals and stores must be lists")
    if len(items) > 500 or len(usuals) > 60 or len(stores) > 10:
        raise ValueError("too many entries")

    clean_items = []
    for item in items:
        if not isinstance(item, dict):
            continue
        if not str(item.get("name", "")).strip():
            continue
        clean_items.append(item)

    clean_usuals = []
    for usual in usuals:
        if not isinstance(usual, dict):
            continue
        if not str(usual.get("name", "")).strip():
            continue
        clean_usuals.append(usual)

    clean_stores = []
    for store in stores:
        if not isinstance(store, dict) or not store.get("id"):
            continue
        clean_stores.append({"id": str(store["id"]), "name": str(store.get("name") or store["id"])})

    return {
        "rev": int(time.time()),
        "stores": clean_stores or DEFAULT_SHOPPING["stores"],
        "items": clean_items,
        "usuals": clean_usuals,
    }


def prune_state(doc):
    bins = doc.get("bins")
    if not isinstance(bins, dict):
        return {"bins": {}}

    cutoff = time.strftime("%Y-%m-%d", time.localtime(time.time() - STATE_KEEP_DAYS * 86400))
    kept = {}
    for date, entry in bins.items():
        if not DATE_RE.match(str(date)) or str(date) < cutoff:
            continue
        if isinstance(entry, dict) and entry.get("confirmedAt"):
            kept[str(date)] = {"confirmedAt": str(entry["confirmedAt"])[:19]}
    return {"bins": kept}


class Handler(BaseHTTPRequestHandler):
    server_version = "HomeHQ/1.1"

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.rstrip("/")

        if path == "/health":
            self.send_json(200, {"ok": True})
            return

        if path == "/shopping":
            self.send_json(200, read_doc(SHOPPING_FILE, DEFAULT_SHOPPING))
            return

        if path == "/state":
            doc = read_doc(STATE_FILE, DEFAULT_STATE)
            doc = prune_state(doc)
            self.send_json(200, doc)
            return

        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        path = self.path.rstrip("/")

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0

        if length <= 0 or length > MAX_BODY:
            self.send_json(413, {"error": "body too large or empty"})
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception as error:
            self.send_json(400, {"error": "bad JSON: %s" % type(error).__name__})
            return

        if path == "/shopping":
            try:
                clean = validate_shopping(payload)
            except Exception as error:
                self.send_json(400, {"error": str(error)})
                return

            with LOCK:
                try:
                    write_doc(SHOPPING_FILE, clean)
                except Exception as error:
                    self.send_json(500, {"error": "write failed: %s" % type(error).__name__})
                    return

            print("shopping: saved %d items" % len(clean["items"]), flush=True)
            self.send_json(200, clean)
            return

        if path == "/state":
            bin_entry = payload.get("bin") if isinstance(payload, dict) else None
            if not isinstance(bin_entry, dict):
                self.send_json(400, {"error": "expected {bin:{date,confirmedAt}}"})
                return

            date = str(bin_entry.get("date", ""))
            confirmed = str(bin_entry.get("confirmedAt", ""))

            if not DATE_RE.match(date):
                self.send_json(400, {"error": "date must be YYYY-MM-DD"})
                return
            if not STAMP_RE.match(confirmed):
                self.send_json(400, {"error": "confirmedAt must be a local date-time"})
                return

            with LOCK:
                doc = prune_state(read_doc(STATE_FILE, DEFAULT_STATE))
                doc["bins"][date] = {"confirmedAt": confirmed[:19]}
                try:
                    write_doc(STATE_FILE, doc)
                except Exception as error:
                    self.send_json(500, {"error": "write failed: %s" % type(error).__name__})
                    return

            print("state: bin %s confirmed" % date, flush=True)
            self.send_json(200, doc)
            return

        self.send_json(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    read_doc(SHOPPING_FILE, DEFAULT_SHOPPING)
    read_doc(STATE_FILE, DEFAULT_STATE)
    print("homehq api on port %d, data %s" % (PORT, DATA_DIR), flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
