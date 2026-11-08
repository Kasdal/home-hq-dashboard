# Home HQ dashboard

A family dashboard for a wall-mounted photo frame. Static site, small bundle,
no framework server.

- **Stack:** Vite 8, Svelte 5, plain CSS.
- **Target:** 1280x800 landscape, Android 6, WebView 106. Also fills 1920x1080.
- **Host:** a small nginx container and a tiny data API on the home NAS.
- **Build:** GitHub Actions on each push to `main`.

<img width="2575" height="1159" alt="Image" src="https://github.com/user-attachments/assets/39b48bf4-91d2-48a9-8b77-4820a4995667" />

## Pages

| Page | Contents |
| --- | --- |
| Today | Big clock and weather, garbage, shopping, tasks, photos, cat feeding, controls |
| Shopping | Full shared list with store filter, quantities and usuals |
| Cooking | Recipe grid, live search, full-screen recipe view, drag-and-drop add |
| Plan | Seven-day meal plan, recipe picker, Surprise me, add ingredients |
| Photos | Full-screen slideshow |
| Controls | Large tiles for home actions |
| Settings | Light / Auto / Dark theme and build information |

The navigation rail uses hash routes: `#today`, `#shopping`, `#cooking`,
`#plan`, `#photos`, `#controls`, `#settings`.

## Today widgets

| Widget | Source |
| --- | --- |
| Clock and weather | Device clock, Open-Meteo (no API key), hourly strip |
| Garbage bins | Thursday schedule from `/data/bins.json`, with bin-day alert |
| Shopping | `/data/shopping.json` through `/api/shopping` |
| Tasks | `/data/tasks.json` |
| Tonight | `/data/plan.json` through `/api/plan` |
| Photos | Google Photos album, cache or local folder |
| Cat feeding | Two rounds per day, stored in the browser |
| Inside temperature | Nest thermostat, from `/data/nest.json` |
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

Add photos from a PC with the drag-and-drop page at `http://<nas>:8088/upload/`.
It saves JPEG, PNG and WebP files to `~/homehq/data/photos`, and they join the
slideshow. You can also copy files into that folder directly. A shared Google
Drive folder is more reliable than a Google Photos album, because Drive has an
official API. See [deploy/README.md](deploy/README.md).

## Cooking

The Cooking page keeps recipes in `/data/recipes.json`. Drop images, PDFs, TXT
or MD files on the page, or use "+ Add recipe". One file makes one recipe. The
limit is 20 MB per file. The page shows a card grid and a live search over
titles, tags, notes and extracted text.

A background worker on the NAS reads text from images and PDFs with Tesseract
and Poppler. TXT and MD files are read directly. Text is capped at 20,000
characters. The API image needs about 100 MB extra for the tools.

After the text is ready, the same local LLM structures uploaded recipes into
title, ingredients, steps and notes. The cap for the model input is 4,000
characters. The original file and the full OCR text stay available. The API
drops AI items that do not appear in the source text, so invented steps are
rejected. A failed structure keeps the raw text and shows a retry button. The
setting `llm.autoStructure` turns the background step off.

All recipe types use the same single-column view: image or photo, title, meta,
tags, Ingredients, Preparation and Notes. A PDF has an original-file panel on a
PC. The frame shows the structured text. The raw OCR text stays in a collapsible
panel. Edit works for title, tags, ingredients, steps and notes. Delete removes
the entry, file and thumbnail.

The page also has a "Paste recipe" form. Paste any recipe text up to 4,000
characters, add an optional photo and tags, then press `Dodaj uz pomoc AI
modela`. A local Qwen2.5 1.5B model reads the title, ingredients and steps. It
keeps the full quantity and unit, converts to metric units only, and puts
calories and macros in Notes. The result appears as an editable preview. Save
uploads the photo and creates the manual recipe. The model runs on the NAS and
unloads after two idle minutes. A short recipe takes about 10-20 seconds. A long
page can take about a minute. The model uses about 1.5-2 GB RAM during a parse.
Set `llm.enabled` to false in `/data/config.json` to turn it off.

The recipe file lives in `~/homehq/data/recipes/files`. The page works on the
frame and on a PC. Android WebView cannot show PDFs, so the frame shows the
extracted text instead.

## Meal plan

The Plan page at `#plan` holds one recipe per day for the next seven days. Tap
a day, then pick a recipe on the right. The search matches title, tags,
ingredients and steps.

"Surprise me" picks a recipe for the selected day or for one row. A day over
18 °C counts as warm and favors light dishes such as salad, grill or cold food.
A day at 18 °C or cooler favors soups, stews, roasts and baked dishes. With no
match, the pick is random. The pick avoids the current meal and the previous
day's meal when it can.

"Add ingredients" writes the recipe ingredients to the shared shopping list.
The amount goes into the note, for example "500 g · Sarma". Items already on
the open list are skipped. The same action is in the recipe view as "Add to
shopping".

The Today page shows tonight's meal in the middle column. The Tasks tab sits
next to it. The Tonight card shows the meal, the climate hint, Add ingredients
and Surprise me.

The plan lives in `/data/plan.json` through `/api/plan`. The page polls every
60 seconds and keeps a local backup. The file is part of the NAS backup. A
deleted recipe keeps its title snapshot and shows "Recipe removed" until the
day is cleared.

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
npm run check   # bin, cat and meal plan tests
npm run build   # production build in dist/
npm run preview # serve the build on port 4173
```

The API is optional in dev. Start it on port 8099 to test shopping, recipes and
uploads:

```powershell
$env:DATA_DIR = "public/data"; python deploy/api.py
```

The Vite proxy sends `/api` to it. Without the API, the page falls back to the
static files in `public/data` and keeps local changes in the browser. Tesseract
and Poppler are not in the local Python, so recipe OCR needs the NAS container.
Text and Markdown recipes work locally.

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

A change to `deploy/api.py` needs the installer on the NAS. A static site pull
does not reload the API process. See [deploy/README.md](deploy/README.md).

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
