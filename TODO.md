# TODO

Open work for the Home HQ dashboard. Keep secrets and private data out of this file.

## Features

- [ ] **Tasks widget.** Add `tasks.json` and API read/write. Tick off items on the frame. Show the list in the Today widget.
- [ ] **Controls tiles.** Create `controls.json`. Decide which local URLs the tiles call. Send bodyless POST on tap.
- [ ] **Shared cat state.** Move cat feeding state from localStorage to `/api/state`. Let every device agree.
- [ ] **Shopping merge.** Replace last-write-wins with a merge on conflict. Keep the current polling pause.
- [ ] **Bin exceptions.** Add Christmas and bank-holiday overrides in `bins.json`. Data only.
- [ ] **Photo uploader.** Optional. Add drag-and-drop upload, or switch to a Google Drive folder for a stable API.

## Fixes and checks

- [ ] **Power-cycle boot test.** Turn the frame off at the wall. Confirm the dashboard opens alone.
- [x] **Masthead redesign.** Two-column header, clock left, weather right, shared rule baseline, night icons, compact hour labels. Awaiting a look on the frame.
- [ ] **Review the masthead on the frame.** Check light and dark, and check that the date row and both rules stay level.
- [ ] **Delete unused files.** Remove `data/photos.json.legacy` and `~/homehq/calendar.log`.
- [ ] **Photos page close button.** Add a close control. Today it relies on the rail.
- [ ] **Watch the frame.** The Settings screen appeared once during testing. Record any repeat.
