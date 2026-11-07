# Home HQ dashboard

A family dashboard for a wall-mounted photo frame. Static site, small bundle,
no framework server.

- **Stack:** Vite 8, Svelte 5, plain CSS.
- **Target:** 1280x800 landscape, Android 6, WebView 106. Also fills 1920x1080.
- **Host:** a small nginx container and a tiny shopping API on the home NAS.
- **Build:** GitHub Actions on each push to `main`.

## Pages

| Page | Contents |
| --- | --- |
| Today | Big clock and weather, garbage, shopping, tasks, photos, cat feeding, controls |
| Shopping | Full shared list with store filter, quantities and usuals |
| Photos | Full-screen slideshow |
| Controls | Large tiles for home actions |
| Settings | Light / Auto / Dark theme and build information |

The navigation rail uses hash routes: `#today`, `#shopping`, `#photos`,
`#controls`, `#settings`.

## Today widgets

| Widget | Source |
| --- | --- |
| Clock and weather | Device clock, Open-Meteo (no API key), hourly strip |
| Garbage bins | Thursday schedule from `/data/bins.json`, with bin-day alert |
| Shopping | `/data/shopping.json` through `/api/shopping` |
| Tasks | `/data/tasks.json` |
| Photos | Google Photos album, cache or local folder |
| Cat feeding | Two rounds per day, stored in the browser |
| Home controls | `/data/controls.json` |

Private data comes from the NAS at runtime. The repository stays public and
holds no secrets, home address or location.

## Theme

Auto is the default. It uses light 06:00–18:00 and dark outside that window,
in the local time zone. Both times come from `theme` in `/data/config.json`.
The Settings page offers Light, Auto and Dark. The choice is stored in the
browser. Auto rechecks every 15 seconds and fades between themes without a
reload.

Fonts are served from the NAS: Anton and Playfair Display, both under the SIL
Open Font License. See `public/fonts/OFL.txt`.

## Photos

`/data/photos.json` holds a public Google Photos album link. A NAS job fetches
the share page, caches the images at 1920x1080 and rebuilds the slideshow
index. The cache keeps the wall display working when the network drops. If the
album cannot be read, the card shows the cached photos or a clear message.

Google closed programmatic album access in March 2025: the Library API only
returns app-created albums, and the Picker API needs a person to select photos.
The share-page importer is unofficial. It lives in `deploy/google_album.py`, so
a format change touches one file.

Fallback: put JPG, PNG or WebP files in `~/homehq/data/photos`. A shared Google
Drive folder is more reliable than a Google Photos album, because Drive has an
official API. See [deploy/README.md](deploy/README.md).

## Sleep screen

After two minutes without a tap or key, the dashboard becomes a full-screen
photo slideshow. Photos crossfade and fit the screen, with no zoom or crop. The
time shows at the bottom left in 24-hour form. The temperature, a warmth word and
the condition show at the bottom right. A tap or key returns to the dashboard.

Set `sleepAfterMinutes` in `/data/config.json` to change the delay. Use `0` to
turn the sleep screen off. With no photos loaded, the dashboard stays awake.

## Local development

```bash
npm install
npm run dev
```

Open the printed address at 1280x800. To see widgets with data, create
`public/data/` and copy `deploy/sample-shopping.json` to
`public/data/shopping.json`. That folder is ignored by git.

```bash
npm run check   # bin parity and cat feed cycle tests
npm run build   # production build in dist/
npm run preview # serve the build on port 4173
```

The shopping API is not available in dev. The page falls back to
`public/data/shopping.json` and keeps local changes in the browser.

### Simulate a time

Add `?now=` before the hash to run the clock from another time. The clock
advances from there in real time.

```text
http://localhost:5173/?now=2026-11-12T08:00#today
```

Use it to check the bin-day alert (Thursday), the theme switch at 06:00 and
18:00, and the cat feed rounds.

### Simulate the sleep screen

Add `?sleep=` before the hash with a number of seconds. The sleep screen starts
after that delay.

```text
http://localhost:5173/?sleep=5#today
```

## How a deploy works

1. A push to `main` starts `.github/workflows/deploy.yml`.
2. The workflow installs, checks and builds the site.
3. It writes `dist/version.json` with the commit SHA.
4. It publishes `dist/` to the `gh-pages` branch.
5. The NAS runs `pull.sh` every 5 minutes, copies the new release and swaps a
   symlink.
6. The page polls `/version.json` once a minute and reloads itself when the SHA
   changes.

The NAS pulls. Nothing on the internet connects into the home network.

## Schedule rules

- Garbage pickup is every Thursday by default. The bins alternate each week.
  The pickup on 2026-11-12 is black, then green, then black, and so on. Change
  the reference date, the weekday, exceptions and the alert start in
  `/data/bins.json`. On the pickup day the card pulses until someone confirms
  the bin is outside. The confirmation is stored in `/data/state.json`.
- Cat feeding has two rounds: 05:00 to 17:00 and 17:00 to 05:00. The question
  returns at each boundary. A fed round keeps the happy cat until the next
  boundary.

## Frame constraints

- WebView 106: no `oklch()`, `color-mix()`, CSS nesting or `:has()`.
- Keep the page light. The frame has an Allwinner A33 and little memory.
- The page must work without internet for its static shell.

## NAS setup

See [deploy/README.md](deploy/README.md).

## License

Apache 2.0. See [LICENSE](LICENSE).
