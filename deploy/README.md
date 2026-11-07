# Deploy on the NAS

The NAS pulls a built site from GitHub. It does not build, and GitHub never
connects into the home network. The repository is public, so the NAS needs no
token.

## What the NAS serves

```text
~/homehq/
  repo/              shallow clone of the gh-pages branch
  releases/
    <sha>/           one built site per release
    bootstrap/       placeholder page
  current -> releases/<sha>
  data/              private JSON files, mounted at /sitedata and /data
  photos/            image files for the slideshow (in data/photos)
  nginx.conf
  pull.sh
  photos.py
  api.py
  pull.log
```

Two containers run from a private Docker network named `homehq`:

- `homehq-web`: `nginx:alpine`, published on port `8088`. It serves the site
  and proxies `/api/` to the API container.
- `homehq-api`: `python:3-alpine`, no published port. It reads and writes
  `data/shopping.json` for the shopping page.

`~/homehq/data` is mounted read-only in the web container at `/sitedata` and
read-write in the API container at `/data`. A deploy swaps the `current`
symlink, so data files stay in place.

## First setup

1. Copy this folder to the NAS, for example to `~/homehq-setup`.
2. Run the installer:

```bash
bash ~/homehq-setup/install.sh
```

The installer does these things:

- Creates the directories, the placeholder page and a sample shopping list.
- Creates the `homehq` Docker network.
- Starts the API container.
- Starts `nginx:alpine` as `homehq-web` on port `8088`.
- Adds a crontab entry that runs `pull.sh` every 5 minutes and `photos.py`
  every 10 minutes.
- Pulls the first release if `gh-pages` exists.

Run it again after a change to `nginx.conf`, `pull.sh`, `api.py` or
`photos.py`. The containers are replaced, and the cron entries are not
duplicated.

## Port

Port `8088` must be free. To use another port:

```bash
PORT=8090 bash ~/homehq-setup/install.sh
```

## Check

```bash
docker ps --filter name=homehq
curl -I http://127.0.0.1:8088/
curl http://127.0.0.1:8088/version.json
curl http://127.0.0.1:8088/api/shopping
tail -f ~/homehq/pull.log
```

## Data files

Put the private JSON files in `~/homehq/data`. The page requests them from
`/data/`. All are optional. A missing file shows an empty state.

| File | Shape |
| --- | --- |
| `config.json` | `{"place":"...","latitude":52.0,"longitude":-7.0,"timezone":"Europe/Dublin","catName":"...","theme":{"lightStart":"06:00","darkStart":"18:00"}}` |
| `shopping.json` | See below |
| `tasks.json` | `{"items":[{"text":"...","list":"Shopping","done":false}]}` |
| `photos.json` | Album config, see below |
| `bins.json` | Bin schedule and alert, see below |
| `state.json` | Bin confirmations, written by the API |
| `controls.json` | `{"controls":[{"id":"lights","label":"Lights","url":"http://.../run","icon":"L"}]}` |

Keep `config.json` out of the public repository. It holds the home location.

`controls.json` entries must accept `POST`. The frame sends a bodyless POST and
treats any 2xx or 3xx answer as success.

### Shopping list

The installer writes a sample list on the first run. The API reads and writes
the same file:

```text
GET  /api/shopping   -> the list
POST /api/shopping   -> replace the list
```

The write uses a temporary file and `os.replace`, so a reader never sees a
half-written list. The API runs as the owner of `~/homehq/data` and is not
published to the network. Only nginx can reach it.

Schema:

```json
{
  "rev": 1,
  "stores": [
    { "id": "tesco", "name": "Tesco" },
    { "id": "lidl", "name": "Lidl" }
  ],
  "items": [
    {
      "id": "bananas",
      "name": "Bananas",
      "note": "Bunch, not too ripe",
      "qty": 1,
      "category": "Produce",
      "store": "any",
      "done": false
    }
  ],
  "usuals": [
    { "name": "Milk", "category": "Dairy & Eggs" }
  ]
}
```

`store` is `any`, `tesco` or `lidl`. An `any` item counts towards every store.
`category` is one of Produce, Bakery, Dairy & Eggs, Meat & Fish, Pantry,
Frozen, Drinks, Household, Other.

The page polls every 30 seconds. It pauses polling for 5 seconds after a local
change and while a text field has focus, so a phone edit does not overwrite an
edit in progress.

If the API is down, the page keeps working from `/data/shopping.json` and a
local backup. Changes stay on that screen until the API returns.

### Photos

`photos.json` is the album config, not the photo list:

```json
{
  "albumUrl": "https://photos.app.goo.gl/...",
  "refreshMinutes": 60,
  "intervalSeconds": 20
}
```

The `photos.py` job runs every 10 minutes. It fetches the share page when the
refresh interval has passed, parses the image URLs, downloads them at
1920x1080 into `photo-cache/`, removes photos that left the album, and writes
`photos-index.json`. The page reads the index. `intervalSeconds` controls the
slideshow.

If the album cannot be read, the last cache stays. The card shows the cached
photos with a small "Cached" tag, or a friendly message if there is no cache.

#### Why not the Google Photos API

Since 31 March 2025 the Library API only returns albums that the app itself
created, and `photoslibrary.readonly` is removed. Shared-album methods return
`403 PERMISSION_DENIED`. The Picker API needs a person to open a picker and
select photos, which cannot run unattended.

Source: https://developers.google.com/photos/support/updates

The share-page importer is therefore unofficial. Google can change the page
format. All parsing lives in `google_album.py`. If it breaks, the log shows
`album error: no photo URLs on the share page` and the display keeps the
cache.

Limits of this approach:

- Only the first batch of photos is present in the HTML. Very large albums may
  not expose every photo without a browser.
- Google may show a consent page in the EU. If it does, the log says so.
- The image URLs are public while the album is shared.
- Video items show as their still frame.

#### Local folder fallback

Put JPG, PNG or WebP files in `~/homehq/data/photos`. Nested folders work. The
index uses the folder only when the album cache is empty. Keep the files small:
about 1600 pixels on the long side.

To sync a Windows folder to the NAS, use rclone:

```bash
rclone sync "C:\Users\you\Pictures\Frame" nas:/home/kas/homehq/data/photos --progress
```

Run it on a schedule with Task Scheduler. `rsync` over SSH works too.

A shared Google Drive folder is more reliable than a shared Google Photos
album, because Drive has an official API and a public folder link. It still
needs a small importer, but the format is stable. The local folder plus rclone
is the most reliable option.

### Bin schedule and alert

`bins.json` is optional. The defaults are Thursday pickup, alternating from
12 November 2026 (black), and an alert from 00:00 on the pickup day:

```json
{
  "weekday": 4,
  "alertStart": "00:00",
  "alertDayOffset": 0,
  "referenceDate": "2026-11-12",
  "referenceBin": "black",
  "endDate": null,
  "exceptions": [
    { "date": "2026-12-24", "bin": "black", "replaces": "2026-12-25" },
    { "date": "2027-01-01", "skip": true }
  ]
}
```

- `weekday`: 0 Sunday to 6 Saturday.
- `alertStart` and `alertDayOffset`: use `-1` and `"18:00"` for an evening
  reminder on the day before.
- `exceptions`: a shifted pickup on any date, a different bin, or `skip`.
  `replaces` removes the normal pickup for that date.
- `endDate`: stop after this date.

On the pickup day the card pulses until someone taps "Bin is outside". The
confirmation goes to `state.json` through `POST /api/state`, so every screen
agrees. A new date has no confirmation, so the alert starts fresh.

```text
GET  /api/state   -> {"bins":{"2026-11-12":{"confirmedAt":"..."}}}
POST /api/state   -> {"bin":{"date":"2026-11-12","confirmedAt":"2026-11-12T07:42:00"}}
```

### Tasks and controls

These files have no generator. Write them from another system, or edit them by
hand. Both are read every couple of minutes.

## Rollback

```bash
ls -1dt ~/homehq/releases/*
ln -sfn ~/homehq/releases/<old-sha> ~/homehq/current.new
mv -Tf ~/homehq/current.new ~/homehq/current
```

## Stop

```bash
docker stop homehq-web homehq-api
docker rm homehq-web homehq-api
crontab -e   # remove the pull.sh and photos.py lines
```

## Network access

`nginx.conf` allows private address ranges only and denies every other client.
The API has no published port. Do not forward port `8088` on the router.
