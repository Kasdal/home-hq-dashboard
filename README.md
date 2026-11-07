# Home HQ dashboard

A family dashboard for a wall-mounted photo frame. Static site, small bundle,
no framework server.

- **Stack:** Vite 8, Svelte 5, plain CSS.
- **Target:** 1280x800 landscape, Android 6, WebView 106.
- **Host:** a small nginx container on the home NAS.
- **Build:** GitHub Actions on each push to `main`.

## What it shows

| Widget | Source |
| --- | --- |
| Clock and date | Device clock |
| Weather | Open-Meteo, no API key |
| Garbage bins | Built-in Thursday schedule, alternating black and green |
| Cat feeding | Two rounds per day, stored in the browser |
| Calendar | `/data/calendar.json` |
| Tasks | `/data/tasks.json` |
| Photos | `/data/photos.json` |
| Home controls | `/data/controls.json` |

Private data comes from the NAS at runtime. The repository stays public and
holds no secrets, home address or location.

## Local development

```bash
npm install
npm run dev
```

Open the printed address at 1280x800. To see widgets with data, create
`public/data/` and copy the JSON shapes from [deploy/README.md](deploy/README.md).
That folder is ignored by git.

```bash
npm run check   # bin parity and cat feed cycle tests
npm run build   # production build in dist/
npm run preview # serve the build on port 4173
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

- Garbage pickup is every Thursday. The bins alternate each week. The pickup
  on 2026-11-12 is black, then green, then black, and so on. Change
  `BLACK_REFERENCE` in `src/lib/time.js` to shift the pattern.
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
