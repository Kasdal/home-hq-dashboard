#!/usr/bin/env python3
"""Write photos.json from the images in ~/homehq/data/photos.

Newest files first. Runs from cron and costs almost nothing.
"""

import json
import os
import sys
import urllib.parse

DATA = os.environ.get("HOMEHQ_DATA") or os.path.join(os.path.expanduser("~"), "homehq", "data")
PHOTO_DIR = os.path.join(DATA, "photos")
OUT_FILE = os.path.join(DATA, "photos.json")
EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PHOTOS = 200


def caption(name):
    stem = os.path.splitext(os.path.basename(name))[0]
    clean = stem.replace("_", " ").replace("-", " ").strip()
    return clean[:80]


def main():
    items = []
    if os.path.isdir(PHOTO_DIR):
        for root, _dirs, names in os.walk(PHOTO_DIR):
            for name in names:
                if os.path.splitext(name)[1].lower() in EXTS:
                    path = os.path.join(root, name)
                    try:
                        items.append((os.path.getmtime(path), path))
                    except OSError:
                        pass

    items.sort(reverse=True)
    items = items[:MAX_PHOTOS]

    photos = []
    for _mtime, path in items:
        rel = os.path.relpath(path, PHOTO_DIR).replace(os.sep, "/")
        src = "/data/photos/" + urllib.parse.quote(rel)
        photos.append({"src": src, "caption": caption(path)})

    payload = {"count": len(photos), "photos": photos}
    temp = OUT_FILE + ".tmp"
    with open(temp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=1)
    os.replace(temp, OUT_FILE)

    print("wrote %d photos" % len(photos), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
