#!/usr/bin/env python3
"""Minimal shopping-list API for the Home HQ dashboard.

GET  /shopping  -> the current list
POST /shopping  -> replace the list and return it with a new revision

The file is written with a temporary file and os.replace, so a reader never
sees a half-written list. Only the standard library is used.
"""

import json
import os
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DATA_DIR = os.environ.get("DATA_DIR", "/data")
FILE = os.path.join(DATA_DIR, "shopping.json")
PORT = int(os.environ.get("PORT", "8099"))
MAX_BODY = 128 * 1024

LOCK = threading.Lock()

DEFAULT_DOC = {
    "rev": 1,
    "stores": [{"id": "tesco", "name": "Tesco"}, {"id": "lidl", "name": "Lidl"}],
    "items": [],
    "usuals": [],
}


def write_doc(doc):
    os.makedirs(DATA_DIR, exist_ok=True)
    handle, temp_path = tempfile.mkstemp(dir=DATA_DIR, prefix=".shopping-", suffix=".tmp")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            json.dump(doc, stream, ensure_ascii=False, indent=1)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_path, FILE)
        os.chmod(FILE, 0o644)
    except Exception:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
        raise


def read_doc():
    try:
        with open(FILE, encoding="utf-8") as stream:
            data = json.load(stream)
        if not isinstance(data, dict):
            raise ValueError("not an object")
        return data
    except FileNotFoundError:
        with LOCK:
            doc = dict(DEFAULT_DOC)
            write_doc(doc)
        return doc
    except Exception:
        return dict(DEFAULT_DOC)


def validate(doc):
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
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        clean_items.append(item)

    clean_usuals = []
    for usual in usuals:
        if not isinstance(usual, dict):
            continue
        name = str(usual.get("name", "")).strip()
        if not name:
            continue
        clean_usuals.append(usual)

    clean_stores = []
    for store in stores:
        if not isinstance(store, dict) or not store.get("id"):
            continue
        clean_stores.append({"id": str(store["id"]), "name": str(store.get("name") or store["id"])})

    return {
        "rev": int(time.time()),
        "stores": clean_stores or DEFAULT_DOC["stores"],
        "items": clean_items,
        "usuals": clean_usuals,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "HomeHQ/1.0"

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.rstrip("/") == "/health":
            self.send_json(200, {"ok": True})
            return
        if self.path.rstrip("/") != "/shopping":
            self.send_json(404, {"error": "not found"})
            return
        self.send_json(200, read_doc())

    def do_POST(self):
        if self.path.rstrip("/") != "/shopping":
            self.send_json(404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            self.send_json(413, {"error": "body too large or empty"})
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            clean = validate(payload)
        except Exception as error:
            self.send_json(400, {"error": str(error)})
            return

        with LOCK:
            try:
                write_doc(clean)
            except Exception as error:
                self.send_json(500, {"error": "write failed: %s" % type(error).__name__})
                return

        print("saved %d items" % len(clean["items"]), flush=True)
        self.send_json(200, clean)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(FILE):
        write_doc(dict(DEFAULT_DOC))
    print("shopping api on port %d, file %s" % (PORT, FILE), flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
