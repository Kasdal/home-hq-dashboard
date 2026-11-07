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
  data/              private JSON files, mounted at /sitedata
  nginx.conf
  pull.sh
  pull.log
```

`~/homehq/data` is mounted read-only into the container at `/sitedata` and
served as `/data/`. A deploy swaps the `current` symlink, so data files stay in
place.

## First setup

1. Copy this folder to the NAS, for example to `~/homehq-setup`.
2. Run the installer:

```bash
bash ~/homehq-setup/install.sh
```

The installer does four things:

- Creates the directories and the placeholder page.
- Starts `nginx:alpine` as `homehq-web` on port `8088`.
- Adds a crontab entry that runs `pull.sh` every 5 minutes.
- Pulls the first release if `gh-pages` exists.

Run it again after a change to `nginx.conf` or `pull.sh`. The container is
replaced, and the cron entry is not duplicated.

## Port

Port `8088` must be free. To use another port:

```bash
PORT=8090 bash ~/homehq-setup/install.sh
```

## Check

```bash
docker ps --filter name=homehq-web
curl -I http://127.0.0.1:8088/
curl http://127.0.0.1:8088/version.json
tail -f ~/homehq/pull.log
```

## Data files

Put the private JSON files in `~/homehq/data`. The page requests them from
`/data/`. All are optional. A missing file shows the empty state.

| File | Shape |
| --- | --- |
| `config.json` | `{"place":"...","latitude":46.0,"longitude":14.5,"timezone":"auto","catName":"..."}` |
| `calendar.json` | `{"events":[{"title":"...","start":"2026-11-12T08:30:00","end":"...","allDay":false}]}` |
| `tasks.json` | `{"items":[{"text":"...","list":"Shopping","done":false}]}` |
| `photos.json` | `{"photos":[{"src":"/data/photos/one.jpg","caption":"..."}]}` |
| `controls.json` | `{"controls":[{"id":"lights","label":"Lights","url":"http://.../run","icon":"L"}]}` |

Keep `config.json` out of the public repository. It holds the home location.

`controls.json` entries must accept `POST`. The frame sends a bodyless POST and
treats any 2xx or 3xx answer as success.

### Calendar feed

The installer copies `fetch-calendar.py` and adds a cron job every 15 minutes.
Put the private iCalendar URL in one file:

```bash
printf '%s\n' 'https://.../private-ics-link' > ~/homehq/data/calendar.url
chmod 600 ~/homehq/data/calendar.url
python3 ~/homehq/fetch-calendar.py
```

The script downloads the feed to `~/homehq/data/calendar.ics`, expands weekly
and monthly rules, applies `EXDATE` and moved events, and writes
`calendar.json`. If the download fails, it keeps the last good file. The URL
never reaches the page or the repository.

### Photos

Put images in `~/homehq/data/photos`. The installer adds a cron job every 10
minutes that rebuilds `photos.json` from that folder. Nested folders work.

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
docker stop homehq-web
docker rm homehq-web
crontab -e   # remove the pull.sh line
```
