# Feature: Recents keeps a configurable window (default 30 days) of unique foods

Status: implemented 2026-11-08 (`recents.js`, merge/sync in `merge.js` and `sync.js`, tests in `tests/recents.test.js`).

## Problem
The Recent tab (`Zuletzt`) holds only the last 40 foods logged, a count cap rather than a time window. A heavy logging week pushes out foods eaten three weeks ago, so repeat foods have to be searched for again.

## Goal
Recent lists every unique food logged within a user-set window (default 30 days), sortable by recency or by most used, and synced across devices, so a food you eat regularly can be re-added in one tap with no lookup.

## Current behaviour
- `S.recents` is an array of food snapshots, newest first, deduped by `food.id`, sliced to 40 (`addEntry` in `core.js`, barcode resolve in `food.js`).
- Snapshots carry no timestamp.
- Quick entries (`src: 'quick'`) and pending barcode placeholders (`src: 'pending'`) are excluded.
- Recents is local only (decision D4, to be superseded) and is also a source for offline search and ranking (`core.js` `scoreFood`, `localSearch`).

## Decisions (2026-11-08)
1. **Sync**: recents sync across devices via `settings.md`, like favorites (supersedes the "recents local" part of D4).
2. **Re-add quantity**: defaults to the last quantity used for that food.
3. **Sorting**: the tab offers "Recent" (default) and "Most used" sorts.
4. **Window**: a setting, default 30 days, so it can be shortened if the list gets too long.
5. **Use counts**: approximate is fine (max-merge across devices, no per-use dates stored).
6. **Most used** counts only uses inside the window, not all time.

## Proposed behaviour
1. **Window**: a food is in Recent if it was logged within the last N days, N from the setting below (device local calendar date, as in D22). Foods older than that drop off.
2. **Unique**: one row per food id. Logging a food again moves it to the top, refreshes its last-used date and quantity, and increments its use count.
3. **No count cap**: the 40 limit goes away. A hard safety ceiling (e.g. 300) prevents unbounded growth; the oldest go first.
4. **Sort toggle** on the Recent tab:
   - *Recent*: most recently used first.
   - *Most used*: highest use count first, ties broken by most recent. The chosen sort is remembered on the device.
5. **Same exclusions**: quick entries and pending placeholders stay out. Editing or deleting a diary entry does not remove a food from Recent; only the window does.
6. **Re-add flow**: tapping a row opens the food sheet with the last-used quantity (`lastG`) as the default and the usual target meal.
7. **Setting "Keep recents for"**: options 7 / 14 / 30 / 60 / 90 days, default 30. Shortening it prunes on next load; lengthening it cannot bring back foods already pruned (they come back only through diary backfill or another device's synced copy). Synced in `settings.md` so both devices use the same window.

## Data model
Each recents snapshot gains:
- `last`: `YYYY-MM-DD` of the most recent log.
- `lastG`: grams of that log, plus `lastU` / `lastQ`: the unit (`g`, `ml`, `serv`, `pc`) and quantity typed, so "1.5 servings" comes back as 1.5 servings. Re-adding recomputes grams from the food's current serving size.
- `uses`: number of times logged within the window.

Pruning: on load, on each `addEntry`, and after each sync, drop snapshots with `last` older than the window.

**Use count**: incremented on each log. When the window rolls, a food that has been dropped starts again at 1. Counts are approximate by design, not recomputed from history.

**Migration**: existing snapshots have no `last`. On first run, backfill `last`, `lastG` and `uses` from `S.entries` where the diary has dated entries for that food. Snapshots with no matching diary entry get `last = today`, `uses = 1`, so nothing disappears on upgrade and they age out normally.

**Sync format** (`settings.md`, new `recents` section, documented in `FORMAT.md`):
```yaml
recents:
  - id: <food id>
    last: 2026-11-06
    lastG: 150
    uses: 7
    food: { ...snapshot... }
```
Merge per food id: newest `last` wins for `last`, `lastG` and the snapshot; `uses` takes the larger of the two sides (counts from two devices can't be summed without double-counting). Absence in an incoming file never deletes a food; only the window removes it, consistent with D7/D15. Unknown keys pass through (D21). The `recentsDays` setting is stored alongside goals.

## Sync trade-offs
- `settings.md` grows by one entry per recent food (up to a few hundred lines at 90 days). Acceptable, but keep snapshots compact: omit `img` and empty fields.
- Claude reads `settings.md` too, so FORMAT.md must say: recents are app-managed, do not edit.
- Drive's 14-day window applies to day files, not `settings.md`, so a new device gets the full recents list on first pull.

## Touch points
- `settings.js` / `sync.js` / `merge.js` / `dayfile.js`: new `recents` section and `recentsDays` setting in `settings.md`; merge rules above.
- `docs/FORMAT.md`: document the `recents` section.
- `core.js`: `addEntry`, state normalisation (`recents` filter, line ~70), `scoreFood` ranking (recency bonus currently uses array index).
- `food.js`: barcode resolve (line ~387), Recent tab rendering (line ~60).
- `tests/`: new test for window pruning, dedupe/move-to-top, migration backfill, and exclusion of quick/pending entries.
- `spec-meal-tracker.md`: add decision row, update D4 if sync is chosen.

## Acceptance criteria
- Logging 60 distinct foods over 3 weeks leaves all 60 in Recent.
- A food last logged 31 days ago is not shown; one logged 29 days ago is.
- Logging the same food five times in a month shows one row, at the top, with the latest date.
- Upgrading from the 40-cap version loses no existing recents.
- Quick entries and pending barcodes never appear.
- Recent still works fully offline.
- Changing "Keep recents for" to 7 days immediately hides foods last used 8+ days ago.
- Re-adding a food opens it with the quantity last used.
- "Most used" puts a food logged 7 times above one logged 3 times; ties go to the more recent.
- A food logged on the iPhone appears in Recent on the Mac after sync, and a stale file never removes it.
