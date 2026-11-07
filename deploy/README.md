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
| `config.json` | `{"place":"...","latitude":52.0,"longitude":-7.0,"timezone":"Europe/Dublin","catName":"..."}` |
| `shopping.json` | See below |
| `tasks.json` | `{"items":[{"text":"...","list":"Shopping","done":false}]}` |
| `photos.json` | `{"photos":[{"src":"/data/photos/one.jpg","caption":"..."}]}` |
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

Put images in `~/homehq/data/photos`. A cron job every 10 minutes rebuilds
`photos.json` from that folder. Nested folders work.

Keep the files small: about 1600 pixels on the long side and JPEG. The frame
has little memory, and a wall of 8 MB photos makes the rotation slow.

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
