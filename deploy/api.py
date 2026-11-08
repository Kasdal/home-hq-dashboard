#!/usr/bin/env python3
"""Minimal data API for the Home HQ dashboard.

GET    /shopping  -> the current shopping list
POST   /shopping  -> replace the shopping list
GET    /state     -> shared state (bin confirmations)
POST   /state     -> confirm one bin day
GET    /photos    -> uploaded photos in data/photos
POST   /photos    -> upload one image, raw body, ?name=file.jpg
POST   /photos?kind=recipe -> upload one recipe, creates an entry in recipes.json
DELETE /photos    -> remove one upload, ?name=file.jpg
GET    /recipes   -> recipe metadata and text
POST   /recipes   -> update titles, tags and notes
DELETE /recipes   -> remove one recipe and its files, ?id=...

Files are written with a temporary file and os.replace, so a reader never sees
a half-written document. Only the standard library is used. OCR calls the
tesseract and poppler command line tools when the container has them.
"""

import glob
import hashlib
import json
import os
import queue
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DATA_DIR = os.environ.get("DATA_DIR", "/data")
SHOPPING_FILE = os.path.join(DATA_DIR, "shopping.json")
STATE_FILE = os.path.join(DATA_DIR, "state.json")
PHOTOS_DIR = os.path.join(DATA_DIR, "photos")
INDEX_FILE = os.path.join(DATA_DIR, "photos-index.json")
RECIPES_FILE = os.path.join(DATA_DIR, "recipes.json")
RECIPE_FILES = os.path.join(DATA_DIR, "recipes", "files")
RECIPE_THUMBS = os.path.join(DATA_DIR, "recipes", "thumbs")
PORT = int(os.environ.get("PORT", "8099"))
MAX_BODY = 128 * 1024
MAX_UPLOAD = 20 * 1024 * 1024
STATE_KEEP_DAYS = 60
MAX_RECIPE_TEXT = 20000
OCR_TIMEOUT = 120
OCR_PAGES = 10
PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
RECIPE_TEXT_EXTS = {".txt", ".md", ".markdown"}

LOCK = threading.Lock()

DEFAULT_SHOPPING = {
    "rev": 1,
    "stores": [{"id": "tesco", "name": "Tesco"}, {"id": "lidl", "name": "Lidl"}],
    "items": [],
    "usuals": [],
}

DEFAULT_STATE = {"bins": {}}
DEFAULT_RECIPES = {"rev": 1, "recipes": []}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
STAMP_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$")

OCR_QUEUE = queue.Queue()


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
        # Do not take LOCK here. Some callers already hold it. The write is
        # atomic, so a rare duplicate default write is harmless.
        doc = dict(default)
        write_doc(path, doc)
        return doc
    except Exception:
        return dict(default)


SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._ -]+")


def image_extension(data):
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


def safe_stem(raw_name):
    name = os.path.basename(str(raw_name or "").replace("\\", "/"))
    stem = os.path.splitext(name)[0]
    stem = SAFE_NAME_RE.sub("", stem).strip(" .-_")
    stem = re.sub(r"[\s_]+", "-", stem)
    return stem[:60] or "photo"


def photo_caption(name):
    stem = os.path.splitext(name)[0]
    return stem.replace("_", " ").replace("-", " ").strip()[:80]


def photo_src(name):
    return "/data/photos/" + urllib.parse.quote(name)


def patch_index(add=None, remove=None):
    """Keep photos-index.json in step right after an upload or delete.

    photos.py rebuilds the whole index from data/photos every 10 minutes, so
    this is only a bridge for the time in between.
    """
    try:
        with open(INDEX_FILE, encoding="utf-8-sig") as stream:
            doc = json.load(stream)
        if not isinstance(doc, dict):
            doc = {}
    except Exception:
        doc = {}

    photos = [p for p in doc.get("photos", []) if isinstance(p, dict)]
    if remove:
        target = photo_src(remove)
        photos = [p for p in photos if p.get("src") != target]
    if add:
        target = photo_src(add)
        photos = [p for p in photos if p.get("src") != target]
        photos.insert(0, {"src": target, "caption": photo_caption(add)})

    doc["photos"] = photos[:300]
    doc.setdefault("source", "folder")
    doc.setdefault("error", None)
    doc.setdefault("hasAlbum", False)
    doc.setdefault("cached", False)
    doc.setdefault("albumTitle", "")
    doc.setdefault("intervalSeconds", 20)
    doc["updated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    write_doc(INDEX_FILE, doc)


def save_upload(raw_name, data):
    extension = image_extension(data)
    if not extension:
        raise ValueError("image must be JPEG, PNG or WebP")

    os.makedirs(PHOTOS_DIR, exist_ok=True)
    stem = safe_stem(raw_name)
    digest = hashlib.sha1(data).hexdigest()

    name = stem + extension
    path = os.path.join(PHOTOS_DIR, name)
    for index in range(1, 51):
        if not os.path.exists(path):
            break
        try:
            with open(path, "rb") as stream:
                same = hashlib.sha1(stream.read()).hexdigest() == digest
        except OSError:
            same = False
        if same:
            return name, True
        name = "%s-%d%s" % (stem, index + 1, extension)
        path = os.path.join(PHOTOS_DIR, name)
    else:
        raise ValueError("too many files with this name")

    handle, temp_path = tempfile.mkstemp(dir=PHOTOS_DIR, prefix=".upload-", suffix=".tmp")
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(data)
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
    return name, False


def list_uploads():
    try:
        names = os.listdir(PHOTOS_DIR)
    except OSError:
        return []

    items = []
    for name in names:
        if os.path.splitext(name)[1].lower() not in PHOTO_EXTS:
            continue
        path = os.path.join(PHOTOS_DIR, name)
        if not os.path.isfile(path):
            continue
        try:
            stat = os.stat(path)
        except OSError:
            continue
        items.append(
            {
                "name": name,
                "size": stat.st_size,
                "modified": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(stat.st_mtime)),
                "url": photo_src(name),
            }
        )
    items.sort(key=lambda item: item["modified"], reverse=True)
    return items


def delete_upload(raw_name):
    name = os.path.basename(str(raw_name or "").replace("\\", "/"))
    if not name or name != str(raw_name) or os.path.splitext(name)[1].lower() not in PHOTO_EXTS:
        raise ValueError("bad file name")

    path = os.path.join(PHOTOS_DIR, name)
    if not os.path.isfile(path):
        raise FileNotFoundError(name)
    os.remove(path)


def recipe_title(raw_name):
    name = os.path.basename(str(raw_name or "").replace("\\", "/"))
    title = os.path.splitext(name)[0]
    title = title.replace("_", " ").replace("-", " ").strip()
    return title[:120] or "Untitled recipe"


def recipe_kind(data, raw_name):
    extension = image_extension(data)
    if extension:
        mime = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}[extension]
        return "image", extension, mime

    if data[:5] == b"%PDF-":
        return "pdf", ".pdf", "application/pdf"

    name_ext = os.path.splitext(
        os.path.basename(str(raw_name or "").replace("\\", "/"))
    )[1].lower()
    if name_ext in RECIPE_TEXT_EXTS:
        if b"\x00" in data:
            raise ValueError("text file contains binary data")
        mime = "text/markdown" if name_ext in (".md", ".markdown") else "text/plain"
        return "text", name_ext, mime

    raise ValueError("file must be an image, PDF, TXT or MD")


def recipe_src(name):
    return "/data/recipes/files/" + urllib.parse.quote(name)


def recipe_thumb_src(name):
    return "/data/recipes/thumbs/" + urllib.parse.quote(name)


def decode_text(data):
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("utf-8", "replace")


def write_bytes(directory, name, data):
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, name)
    handle, temp_path = tempfile.mkstemp(dir=directory, prefix=".upload-", suffix=".tmp")
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(data)
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
    return path


def make_image_thumb(source, target):
    try:
        from PIL import Image

        with Image.open(source) as image:
            image = image.convert("RGB")
            image.thumbnail((600, 600))
            image.save(target, "JPEG", quality=82)
        return True
    except Exception as error:
        print("recipe thumb failed: %s" % type(error).__name__, flush=True)
        return False


def make_pdf_thumb(source, target):
    temp_dir = tempfile.mkdtemp(dir=RECIPE_THUMBS, prefix=".thumb-")
    try:
        prefix = os.path.join(temp_dir, "page")
        subprocess.run(
            [
                "pdftoppm",
                "-jpeg",
                "-singlefile",
                "-f",
                "1",
                "-l",
                "1",
                "-scale-to",
                "600",
                source,
                prefix,
            ],
            check=True,
            timeout=60,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        produced = prefix + ".jpg"
        if not os.path.exists(produced):
            return False
        os.replace(produced, target)
        return True
    except Exception as error:
        print("pdf thumb failed: %s" % type(error).__name__, flush=True)
        return False
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def save_recipe_upload(raw_name, data):
    kind, extension, mime = recipe_kind(data, raw_name)
    os.makedirs(RECIPE_FILES, exist_ok=True)
    os.makedirs(RECIPE_THUMBS, exist_ok=True)

    recipe_id = secrets.token_hex(4)
    stem = safe_stem(raw_name)
    name = "%s-%s%s" % (stem, recipe_id[:6], extension)
    path = write_bytes(RECIPE_FILES, name, data)

    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    text = ""
    text_source = ""
    text_status = "pending"
    text_at = ""

    if kind == "text":
        text = decode_text(data)[:MAX_RECIPE_TEXT]
        text_source = "file"
        text_status = "ready"
        text_at = now

    thumb = ""
    thumb_name = recipe_id + ".jpg"
    thumb_path = os.path.join(RECIPE_THUMBS, thumb_name)
    if kind == "image" and make_image_thumb(path, thumb_path):
        thumb = thumb_name
    elif kind == "pdf" and make_pdf_thumb(path, thumb_path):
        thumb = thumb_name

    recipe = {
        "id": recipe_id,
        "title": recipe_title(raw_name),
        "tags": [],
        "notes": "",
        "file": name,
        "type": kind,
        "mime": mime,
        "size": len(data),
        "addedAt": now,
        "thumb": thumb,
        "text": text,
        "textSource": text_source,
        "textStatus": text_status,
        "textAt": text_at,
    }

    with LOCK:
        doc = read_doc(RECIPES_FILE, DEFAULT_RECIPES)
        recipes = [r for r in doc.get("recipes", []) if isinstance(r, dict)]
        recipes.append(recipe)
        doc["recipes"] = recipes
        doc["rev"] = int(time.time())
        write_doc(RECIPES_FILE, doc)

    return recipe


def run_text_ocr(path, timeout=OCR_TIMEOUT):
    result = subprocess.run(
        ["tesseract", path, "stdout", "-l", "eng+hrv"],
        check=True,
        timeout=timeout,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    return result.stdout.decode("utf-8", "replace")


def extract_pdf_text(path):
    deadline = time.time() + OCR_TIMEOUT

    def remaining():
        left = deadline - time.time()
        if left <= 0:
            raise TimeoutError("recipe text deadline")
        return left

    result = subprocess.run(
        ["pdftotext", "-layout", path, "-"],
        check=True,
        timeout=remaining(),
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    text = result.stdout.decode("utf-8", "replace").replace("\f", "\n").strip()
    if len(text) >= 40:
        return text, "pdf"

    temp_dir = tempfile.mkdtemp(prefix="homehq-pdf-")
    try:
        prefix = os.path.join(temp_dir, "page")
        subprocess.run(
            [
                "pdftoppm",
                "-jpeg",
                "-r",
                "150",
                "-f",
                "1",
                "-l",
                str(OCR_PAGES),
                path,
                prefix,
            ],
            check=True,
            timeout=remaining(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        pages = sorted(
            glob.glob(prefix + "-*.jpg"),
            key=lambda item: int(re.search(r"-(\d+)\.jpg$", item).group(1)),
        )
        chunks = [run_text_ocr(page, remaining()) for page in pages]
        return "\n\n".join(chunks).strip(), "ocr"
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def update_recipe_text(recipe_id, text, source, status, thumb=None):
    with LOCK:
        doc = read_doc(RECIPES_FILE, DEFAULT_RECIPES)
        for recipe in doc.get("recipes", []):
            if isinstance(recipe, dict) and recipe.get("id") == recipe_id:
                recipe["text"] = text[:MAX_RECIPE_TEXT]
                recipe["textSource"] = source
                recipe["textStatus"] = status
                recipe["textAt"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                if thumb:
                    recipe["thumb"] = thumb
                doc["rev"] = int(time.time())
                write_doc(RECIPES_FILE, doc)
                return True
    return False


def process_recipe(recipe_id):
    with LOCK:
        doc = read_doc(RECIPES_FILE, DEFAULT_RECIPES)
        recipe = next(
            (
                item
                for item in doc.get("recipes", [])
                if isinstance(item, dict) and item.get("id") == recipe_id
            ),
            None,
        )
        if not recipe or recipe.get("textStatus") != "pending":
            return
        snapshot = dict(recipe)

    path = os.path.join(RECIPE_FILES, snapshot.get("file", ""))
    if not os.path.isfile(path):
        update_recipe_text(recipe_id, "", "", "failed")
        return

    thumb = None
    if not snapshot.get("thumb"):
        thumb_name = recipe_id + ".jpg"
        thumb_path = os.path.join(RECIPE_THUMBS, thumb_name)
        if snapshot.get("type") == "pdf" and make_pdf_thumb(path, thumb_path):
            thumb = thumb_name
        elif snapshot.get("type") == "image" and make_image_thumb(path, thumb_path):
            thumb = thumb_name

    try:
        if snapshot.get("type") == "image":
            text, source = run_text_ocr(path), "ocr"
        elif snapshot.get("type") == "pdf":
            text, source = extract_pdf_text(path)
        else:
            text, source = "", ""
        status = "ready"
    except Exception as error:
        print(
            "recipe text failed for %s: %s" % (recipe_id, type(error).__name__),
            flush=True,
        )
        text, source, status = "", "", "failed"

    update_recipe_text(recipe_id, text, source, status, thumb)


def pending_recipe_ids():
    doc = read_doc(RECIPES_FILE, DEFAULT_RECIPES)
    return [
        item["id"]
        for item in doc.get("recipes", [])
        if isinstance(item, dict) and item.get("id") and item.get("textStatus") == "pending"
    ]


def recipe_worker():
    for recipe_id in pending_recipe_ids():
        OCR_QUEUE.put(recipe_id)

    while True:
        try:
            recipe_id = OCR_QUEUE.get(timeout=60)
        except queue.Empty:
            for pending in pending_recipe_ids():
                OCR_QUEUE.put(pending)
            continue
        try:
            process_recipe(recipe_id)
        except Exception as error:
            print(
                "recipe worker error for %s: %s" % (recipe_id, type(error).__name__),
                flush=True,
            )


def validate_recipes(payload, current):
    if not isinstance(payload, dict):
        raise ValueError("body must be an object")
    incoming = payload.get("recipes")
    if not isinstance(incoming, list):
        raise ValueError("recipes must be a list")

    by_id = {}
    for recipe in current.get("recipes", []):
        if isinstance(recipe, dict) and recipe.get("id"):
            by_id[str(recipe["id"])] = recipe

    clean = []
    seen = set()
    for item in incoming:
        if not isinstance(item, dict):
            continue
        recipe_id = str(item.get("id", ""))
        old = by_id.get(recipe_id)
        if not old or recipe_id in seen:
            continue
        seen.add(recipe_id)

        title = str(item.get("title", "")).strip()[:120]
        if not title:
            title = str(old.get("title") or "Untitled recipe")

        raw_tags = item.get("tags")
        if isinstance(raw_tags, str):
            raw_tags = raw_tags.split(",")
        tags = []
        if isinstance(raw_tags, list):
            for tag in raw_tags:
                value = str(tag).strip()[:30]
                if value and value.lower() not in [known.lower() for known in tags]:
                    tags.append(value)

        merged = dict(old)
        merged["title"] = title
        merged["tags"] = tags[:20]
        merged["notes"] = str(item.get("notes", ""))[:2000]
        clean.append(merged)

    for recipe_id, old in by_id.items():
        if recipe_id not in seen:
            clean.append(old)

    return {"rev": int(time.time()), "recipes": clean}


def remove_recipe(recipe_id):
    with LOCK:
        doc = read_doc(RECIPES_FILE, DEFAULT_RECIPES)
        recipes = [r for r in doc.get("recipes", []) if isinstance(r, dict)]
        recipe = next((r for r in recipes if r.get("id") == recipe_id), None)
        if not recipe:
            raise FileNotFoundError(recipe_id)
        doc["recipes"] = [r for r in recipes if r.get("id") != recipe_id]
        doc["rev"] = int(time.time())
        write_doc(RECIPES_FILE, doc)

    for name, folder in (
        (recipe.get("file"), RECIPE_FILES),
        (recipe.get("thumb"), RECIPE_THUMBS),
    ):
        if not name:
            continue
        try:
            os.remove(os.path.join(folder, name))
        except OSError:
            pass
    return recipe


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
    server_version = "HomeHQ/1.2"

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def request_path(self):
        parsed = urllib.parse.urlparse(self.path)
        return parsed.path.rstrip("/") or "/", urllib.parse.parse_qs(parsed.query)

    def do_GET(self):
        path, _query = self.request_path()

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

        if path == "/photos":
            self.send_json(200, {"photos": list_uploads(), "maxBytes": MAX_UPLOAD})
            return

        if path == "/recipes":
            self.send_json(200, read_doc(RECIPES_FILE, DEFAULT_RECIPES))
            return

        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        path, query = self.request_path()

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0

        if path == "/photos":
            if length <= 0:
                self.send_json(413, {"error": "empty body"})
                return
            if length > MAX_UPLOAD:
                self.send_json(413, {"error": "file is larger than 20 MB"})
                return

            data = self.rfile.read(length)
            raw_name = (query.get("name") or ["photo"])[0]
            kind = (query.get("kind") or [""])[0].lower()

            if kind == "recipe":
                try:
                    recipe = save_recipe_upload(raw_name, data)
                except ValueError as error:
                    self.send_json(400, {"error": str(error)})
                    return
                except Exception as error:
                    self.send_json(500, {"error": "write failed: %s" % type(error).__name__})
                    return

                if recipe.get("textStatus") == "pending":
                    OCR_QUEUE.put(recipe["id"])
                print(
                    "recipes: saved %s (%s, %d bytes)"
                    % (recipe["file"], recipe["type"], recipe["size"]),
                    flush=True,
                )
                self.send_json(
                    200,
                    {
                        "recipe": recipe,
                        "fileUrl": recipe_src(recipe["file"]),
                        "thumbUrl": recipe_thumb_src(recipe["thumb"])
                        if recipe.get("thumb")
                        else "",
                    },
                )
                return

            with LOCK:
                try:
                    name, existed = save_upload(raw_name, data)
                except ValueError as error:
                    self.send_json(400, {"error": str(error)})
                    return
                except Exception as error:
                    self.send_json(500, {"error": "write failed: %s" % type(error).__name__})
                    return
                try:
                    patch_index(add=name)
                except Exception as error:
                    print("photos: index update failed: %s" % type(error).__name__, flush=True)

            print(
                "photos: %s %s (%d bytes)"
                % ("kept" if existed else "saved", name, len(data)),
                flush=True,
            )
            self.send_json(200, {"name": name, "existed": existed, "url": photo_src(name)})
            return

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

        if path == "/recipes":
            with LOCK:
                current = read_doc(RECIPES_FILE, DEFAULT_RECIPES)
                try:
                    clean = validate_recipes(payload, current)
                except Exception as error:
                    self.send_json(400, {"error": str(error)})
                    return
                try:
                    write_doc(RECIPES_FILE, clean)
                except Exception as error:
                    self.send_json(500, {"error": "write failed: %s" % type(error).__name__})
                    return

            print("recipes: saved %d entries" % len(clean["recipes"]), flush=True)
            self.send_json(200, clean)
            return

        self.send_json(404, {"error": "not found"})

    def do_DELETE(self):
        path, query = self.request_path()

        if path == "/photos":
            raw_name = (query.get("name") or [""])[0]
            with LOCK:
                try:
                    delete_upload(raw_name)
                except ValueError as error:
                    self.send_json(400, {"error": str(error)})
                    return
                except FileNotFoundError:
                    self.send_json(404, {"error": "no such photo"})
                    return
                except Exception as error:
                    self.send_json(500, {"error": "delete failed: %s" % type(error).__name__})
                    return
                try:
                    patch_index(remove=raw_name)
                except Exception as error:
                    print("photos: index update failed: %s" % type(error).__name__, flush=True)

            print("photos: deleted %s" % raw_name, flush=True)
            self.send_json(200, {"ok": True})
            return

        if path == "/recipes":
            recipe_id = (query.get("id") or [""])[0]
            if not recipe_id:
                self.send_json(400, {"error": "id is required"})
                return
            try:
                recipe = remove_recipe(recipe_id)
            except FileNotFoundError:
                self.send_json(404, {"error": "no such recipe"})
                return
            except Exception as error:
                self.send_json(500, {"error": "delete failed: %s" % type(error).__name__})
                return

            print("recipes: deleted %s (%s)" % (recipe_id, recipe.get("file")), flush=True)
            self.send_json(200, {"ok": True, "id": recipe_id})
            return

        self.send_json(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    os.makedirs(RECIPE_FILES, exist_ok=True)
    os.makedirs(RECIPE_THUMBS, exist_ok=True)
    read_doc(SHOPPING_FILE, DEFAULT_SHOPPING)
    read_doc(STATE_FILE, DEFAULT_STATE)
    read_doc(RECIPES_FILE, DEFAULT_RECIPES)

    for tool in ("tesseract", "pdftotext", "pdftoppm"):
        if not shutil.which(tool):
            print("warning: %s is missing, text extraction will fail" % tool, flush=True)

    threading.Thread(target=recipe_worker, daemon=True, name="recipe-worker").start()
    print("homehq api on port %d, data %s" % (PORT, DATA_DIR), flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
