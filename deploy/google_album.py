#!/usr/bin/env python3
"""Read a public Google Photos share page and return image URLs.

This is the only module that knows the page format. Google can change it at any
time. If parsing breaks, the caller must keep the last good cache and show a
clear error.

Why not the official API:
- Since March 2025 the Library API only returns albums created by the app.
- The Picker API needs a person to select photos in a browser session.
See https://developers.google.com/photos/support/updates
"""

import html as html_module
import re
import urllib.error
import urllib.request

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
)

PHOTO_HOST = "lh3.googleusercontent.com"
MAX_PAGE_BYTES = 12 * 1024 * 1024

# Photo entries start with an AF1Qip media key, then an array whose first item
# is the full image URL. This skips owner avatars, which also use the same host.
ENTRY_PATTERN = re.compile(
    r'\[\s*"AF1Qip[^"]{10,}"\s*,\s*\[\s*"(https://lh[0-9]\.googleusercontent\.com/[A-Za-z0-9_\-]{16,})"'
)

# Fallback for a page format change: any lh3 image URL. Avatars use /a/<id>.
URL_PATTERN = re.compile(
    r"https:(?:\\/\\/|//)lh[0-9]\.googleusercontent\.com(?:\\/|/)([A-Za-z0-9_\-]{16,})"
)

TITLE_PATTERN = re.compile(r"<title>(.*?)</title>", re.DOTALL | re.IGNORECASE)


class AlbumError(Exception):
    pass


def parse_album_html(body):
    """Return full-size image base URLs, in page order, without duplicates."""
    if not body:
        return []

    text = html_module.unescape(body).replace("\\/", "/")
    seen = set()
    urls = []

    for match in ENTRY_PATTERN.finditer(text):
        url = match.group(1)
        if url in seen:
            continue
        seen.add(url)
        urls.append(url)

    if urls:
        return urls

    # Fallback. A rare owner avatar can slip in, which is better than no photos.
    for match in URL_PATTERN.finditer(text):
        image_id = match.group(1)
        if image_id in seen:
            continue
        seen.add(image_id)
        urls.append("https://%s/%s" % (PHOTO_HOST, image_id))

    return urls


def album_title(body):
    match = TITLE_PATTERN.search(body or "")
    if not match:
        return ""
    title = re.sub(r"\s+", " ", html_module.unescape(match.group(1))).strip()
    return title[:120]


def fetch_album(url, timeout=30):
    """Download a share page and return (image_urls, final_url, title)."""
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-IE,en;q=0.9",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            final_url = response.geturl()
            status = response.status
            body = response.read(MAX_PAGE_BYTES)
    except urllib.error.HTTPError as error:
        raise AlbumError("share page returned HTTP %s" % error.code)
    except urllib.error.URLError as error:
        raise AlbumError("network error: %s" % (error.reason or "unreachable"))
    except Exception as error:
        raise AlbumError("fetch failed: %s" % type(error).__name__)

    if status != 200:
        raise AlbumError("share page returned HTTP %s" % status)

    if "consent.google.com" in final_url:
        raise AlbumError("Google showed a consent page. Accept cookies in a browser once.")

    text = body.decode("utf-8", "replace")
    urls = parse_album_html(text)

    if not urls:
        raise AlbumError(
            "no photo URLs on the share page. The page format may have changed, "
            "or the album is not public."
        )

    return urls, final_url, album_title(text)


def sized_url(base, width=1920, height=1080):
    return "%s=w%d-h%d" % (base, width, height)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("usage: google_album.py <url-or-file>")
        raise SystemExit(2)

    target = sys.argv[1]
    if target.startswith("http"):
        images, final, title = fetch_album(target)
        print("final: %s" % final)
        print("title: %s" % title)
    else:
        with open(target, encoding="utf-8", errors="replace") as handle:
            images = parse_album_html(handle.read())
        print("title: %s" % album_title(open(target, encoding="utf-8", errors="replace").read()))

    print("images: %d" % len(images))
    for image in images[:10]:
        print(image)
