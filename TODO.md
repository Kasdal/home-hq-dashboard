# TODO

Open work for the Home HQ dashboard. Keep secrets and private data out of this file.

## Features

- [ ] **Nest inside temperature.** Header block and `deploy/nest.py` are built. Blocked: the thermostat is in a home owned by another account, so the member token cannot read it. Needs the owner login or a re-add of the device. See `HANDOFF.md` section 14.
- [ ] **Tasks widget.** Add `tasks.json` and API read/write. Tick off items on the frame. Show the list in the Today widget. Owner will do this later.
- [ ] **Controls tiles.** Create `controls.json`. Decide which local URLs the tiles call. Send bodyless POST on tap.
- [x] **Cooking page.** `#cooking` rail item, card grid, live search and full-screen recipe view. Drag-and-drop add for images, PDFs, TXT and MD. Metadata in `data/recipes.json`, files in `data/recipes/files`. Tesseract and Poppler read recipe text. Edit and delete work on the frame.
- [x] **Manual recipes with local AI.** Paste free text, add an optional photo and tags, and press `Dodaj uz pomoc AI modela`. Qwen2.5 1.5B runs on the NAS and returns an editable preview. Save creates a manual recipe with ingredients, steps and notes. The model unloads after two idle minutes.
- [x] **Automatic structure for uploaded recipes.** After OCR, the LLM extracts title, ingredients, steps and notes. All recipe types use the same single-column view. The raw OCR text and original file stay. A failed structure shows a retry button. `llm.autoStructure` turns it off.
- [x] **Photo uploader.** Drag-and-drop page at `/upload/`. Saves JPEG, PNG and WebP files to `data/photos` through `POST /api/photos`. Uploads join the slideshow within about 10 minutes.
- [x] **Meal plan.** `#plan` page with a seven-day list and recipe picker. The Today middle column shows a Tonight / Tasks tab. "Surprise me" favors warm food at 18 °C or cooler and light food over 18 °C. "Add ingredients" writes the recipe lines to the shared shopping list. `data/plan.json` through `/api/plan`. Built and checked locally; not deployed.
- [ ] **Rain nowcast, cook mode, dates card.** Optional ideas with notes and costs. See `HANDOFF.md` section 16.
- [ ] **Shopping merge.** Replace last-write-wins with a merge on conflict. Keep the current polling pause.

## Data safety

- [x] **Off-site backup.** rclone copies `data` and the live scripts to Google Drive at 03:30 daily. The copy is plain files, so Drive shows them normally. Retention is 7 daily, 4 weekly and 12 monthly. The Nest credentials stay off the copy. Restore tested on 2026-11-08. See `deploy/README.md`.
- [ ] **Personal rclone client ID.** The installed rclone build uses the shared client ID. Google retires that ID during 2026. Create a client ID in the Google Cloud console, then run `rclone config reconnect gdrive:`.
- [ ] **Backup age on Settings.** Show the last copy time so a silent failure is visible on the frame.
- [ ] **Delete the old encrypted repository.** `gdrive:homehq-backup` holds one restic snapshot from 2026-11-08. Remove it after the plain copy has run for a while.

## Fixes and checks

- [ ] **Power-cycle boot test.** Turn the frame off at the wall. Confirm the dashboard opens alone.
- [x] **Masthead redesign.** Two-column header, clock left, weather right, shared rule baseline, night icons, compact hour labels. Approved by the owner.
- [x] **Delete unused files.** Removed `data/photos.json.legacy` and `~/homehq/calendar.log`.
- [ ] **Photos page close button.** Add a close control. Today it relies on the rail.
- [ ] **Watch the frame.** The Settings screen appeared once during testing. Record any repeat.

## Closed by the owner

- **Bin exceptions.** Not needed. Keep the default Thursday schedule.
- **Shared cat state.** Accepted as local to the frame.
