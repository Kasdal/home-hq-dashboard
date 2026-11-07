#!/usr/bin/env python3
"""Build photos-index.json for the dashboard.

Source 1: a public Google Photos album share link in photos.json.
Source 2: local images in data/photos.

The album page is unofficial. google_album.py has all the parsing. Any error
keeps the last good cache and writes a clear message into the index.
"""

import hashlib
import json
import os
import sys
import time
import urllib.parse
import urllib.request

import google_album

DATA = os.environ.get("HOMEHQ_DATA") or os.path.join(os.path.expanduser("~"), "homehq", "data")
CONFIG_FILE = os.path.join(DATA, "photos.json")
CACHE_DIR = os.path.join(DATA, "photo-cache")
MANIFEST_FILE = os.path.join(CACHE_DIR, "manifest.json")
INDEX_FILE = os.path.join(DATA, "photos-index.json")
LOCAL_DIR = os.path.join(DATA, "photos")

MAX_PHOTOS = 200
MAX_IMAGE_BYTES = 15 * 1024 * 1024
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def log(message):
    print(message, flush=True)


def read_json(path, default):
    try:
        with open(path, encoding="utf-8-sig") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else default
    except Exception:
        return default


def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp = path + ".tmp"
    with open(temp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=1)
        handle.write("\n")
    os.replace(temp, path)


def load_config():
    try:
        with open(CONFIG_FILE, encoding="utf-8-sig") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except Exception as error:
        log("photos.json is not valid JSON: %s" % type(error).__name__)
        return {}


def image_extension(content_type, data):
    ctype = (content_type or "").split(";")[0].strip().lower()
    if ctype == "image/png":
        return ".png"
    if ctype == "image/webp":
        return ".webp"
    if ctype == "image/gif":
        return ".gif"
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return ".jpg"


def download_image(base_url):
    os.makedirs(CACHE_DIR, exist_ok=True)
    request = urllib.request.Request(
        google_album.sized_url(base_url),
        headers={"User-Agent": google_album.USER_AGENT, "Accept": "image/*"},
    )

    with urllib.request.urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise ValueError("HTTP %s" % response.status)
        content_type = response.headers.get("Content-Type", "")
        data = response.read(MAX_IMAGE_BYTES)

    if not data:
        raise ValueError("empty image")
    if content_type and not content_type.lower().startswith("image/"):
        raise ValueError("not an image: %s" % content_type)

    extension = image_extension(content_type, data)
    name = hashlib.sha1(base_url.encode("utf-8")).hexdigest()[:16] + extension
    target = os.path.join(CACHE_DIR, name)
    temp = os.path.join(CACHE_DIR, "." + name + ".tmp")

    with open(temp, "wb") as handle:
        handle.write(data)
    os.replace(temp, target)
    return name


def sync_album(config, manifest):
    url = str(config.get("albumUrl") or "").strip()
    if not url:
        return manifest, "no-album"

    try:
        refresh = int(config.get("refreshMinutes") or 60)
    except (TypeError, ValueError):
        refresh = 60
    refresh = max(5, min(24 * 60, refresh))

    now = time.time()
    last = manifest.get("lastOk") or manifest.get("lastAttempt") or 0
    if (
        manifest.get("photos")
        and manifest.get("albumUrl") == url
        and not manifest.get("lastError")
        and now - last < refresh * 60
    ):
        return manifest, "fresh"

    manifest["albumUrl"] = url
    manifest["lastAttempt"] = now

    try:
        urls, final_url, title = google_album.fetch_album(url)
    except google_album.AlbumError as error:
        manifest["lastError"] = str(error)[:300]
        write_json(MANIFEST_FILE, manifest)
        log("album error: %s" % manifest["lastError"])
        return manifest, "album-error"
    except Exception as error:
        manifest["lastError"] = "unexpected error: %s" % type(error).__name__
        write_json(MANIFEST_FILE, manifest)
        log("album error: %s" % manifest["lastError"])
        return manifest, "album-error"

    previous = {
        entry.get("base"): entry
        for entry in manifest.get("photos", [])
        if isinstance(entry, dict) and entry.get("base")
    }

    entries = []
    downloaded = 0
    failed = 0

    for base in urls[:MAX_PHOTOS]:
        old = previous.get(base)
        old_file = old.get("file") if old else None
        if old_file and os.path.exists(os.path.join(CACHE_DIR, old_file)):
            entries.append({"base": base, "file": old_file})
            continue

        try:
            name = download_image(base)
            entries.append({"base": base, "file": name})
            downloaded += 1
        except Exception as error:
            failed += 1
            if failed <= 3:
                log("image download failed: %s" % type(error).__name__)
            if old_file and os.path.exists(os.path.join(CACHE_DIR, old_file)):
                entries.append({"base": base, "file": old_file})

    keep = {entry["file"] for entry in entries if entry.get("file")}
    if os.path.isdir(CACHE_DIR):
        for name in os.listdir(CACHE_DIR):
            if name == os.path.basename(MANIFEST_FILE):
                continue
            if name not in keep:
                try:
                    os.remove(os.path.join(CACHE_DIR, name))
                except OSError:
                    pass

    manifest.update(
        {
            "albumUrl": url,
            "photos": entries,
            "lastOk": now,
            "lastError": None if entries else "album returned no usable photos",
            "albumTitle": title,
            "finalUrl": final_url,
        }
    )
    write_json(MANIFEST_FILE, manifest)
    log(
        "album synced: %d photos, %d downloaded, %d failed"
        % (len(entries), downloaded, failed)
    )
    return manifest, "synced"


def local_photos():
    if not os.path.isdir(LOCAL_DIR):
        return []

    found = []
    for root, _dirs, names in os.walk(LOCAL_DIR):
        for name in names:
            if os.path.splitext(name)[1].lower() in IMAGE_EXTS:
                path = os.path.join(root, name)
                try:
                    found.append((os.path.getmtime(path), path))
                except OSError:
                    pass

    found.sort(reverse=True)
    photos = []
    for _mtime, path in found[:MAX_PHOTOS]:
        rel = os.path.relpath(path, LOCAL_DIR).replace(os.sep, "/")
        caption = os.path.splitext(os.path.basename(path))[0]
        caption = caption.replace("_", " ").replace("-", " ").strip()[:80]
        photos.append(
            {"src": "/data/photos/" + urllib.parse.quote(rel), "caption": caption}
        )
    return photos


def main():
    config = load_config()
    manifest = read_json(MANIFEST_FILE, {"photos": []})
    has_album = bool(str(config.get("albumUrl") or "").strip())

    if has_album:
        manifest, _state = sync_album(config, manifest)
    else:
        manifest = read_json(MANIFEST_FILE, {"photos": []})

    cache_photos = []
    for entry in manifest.get("photos", []):
        name = entry.get("file") if isinstance(entry, dict) else None
        if not name:
            continue
        if not os.path.exists(os.path.join(CACHE_DIR, name)):
            continue
        cache_photos.append(
            {"src": "/data/photo-cache/" + urllib.parse.quote(name), "caption": ""}
        )

    folder_photos = local_photos()

    if cache_photos:
        source = "album"
        photos = cache_photos
    elif folder_photos:
        source = "folder"
        photos = folder_photos
    else:
        source = "none"
        photos = []

    try:
        interval = int(config.get("intervalSeconds") or 20)
    except (TypeError, ValueError):
        interval = 20
    interval = max(5, min(600, interval))

    error = manifest.get("lastError") if has_album else None

    payload = {
        "photos": photos,
        "source": source,
        "error": error,
        "hasAlbum": has_album,
        "cached": bool(cache_photos and error),
        "albumTitle": manifest.get("albumTitle", ""),
        "intervalSeconds": interval,
        "updated": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    write_json(INDEX_FILE, payload)
    log(
        "index: %d photos, source=%s, error=%s"
        % (len(photos), source, (error or "none")[:80])
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
