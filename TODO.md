# TODO

Open work for the Home HQ dashboard. Keep secrets and private data out of this file.

## Features

- [ ] **Nest inside temperature.** Header block and `deploy/nest.py` are built. Blocked: the thermostat is in a home owned by another account, so the member token cannot read it. Needs the owner login or a re-add of the device. See `HANDOFF.md` section 14.
- [ ] **Tasks widget.** Add `tasks.json` and API read/write. Tick off items on the frame. Show the list in the Today widget. Owner will do this later.
- [ ] **Controls tiles.** Create `controls.json`. Decide which local URLs the tiles call. Send bodyless POST on tap.
- [x] **Photo uploader.** Drag-and-drop page at `/upload/`. Saves JPEG, PNG and WebP files to `data/photos` through `POST /api/photos`. Uploads join the slideshow within about 10 minutes.
- [ ] **Shopping merge.** Replace last-write-wins with a merge on conflict. Keep the current polling pause.

## Fixes and checks

- [ ] **Power-cycle boot test.** Turn the frame off at the wall. Confirm the dashboard opens alone.
- [x] **Masthead redesign.** Two-column header, clock left, weather right, shared rule baseline, night icons, compact hour labels. Checked on the frame in light and dark.
- [x] **Delete unused files.** Removed `data/photos.json.legacy` and `~/homehq/calendar.log`.
- [ ] **Photos page close button.** Add a close control. Today it relies on the rail.
- [ ] **Watch the frame.** The Settings screen appeared once during testing. Record any repeat.

## Closed by the owner

- **Bin exceptions.** Not needed. Keep the default Thursday schedule.
- **Shared cat state.** Accepted as local to the frame.
