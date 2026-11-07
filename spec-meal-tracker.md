# Spec: Personal Meal Tracker (fork of FitScan)

Status: approved 2026-11-06. Baseline: CorneliusKauffmann/fitscan @ 97038ae (MIT, vanilla JS PWA, ~1,900 lines, no build, no tests).

## Overview
A lightweight, offline-first meal tracker replacing MyFitnessPal, meal logging only. Static PWA on GitHub Pages (iPhone + Mac). Syncs one markdown file per day to Google Drive so Claude (in other chats) can plan meals into those files.

## Goals / Non-Goals
Goals: calories + macros, barcode (Open Food Facts), USDA FoodData Central search, quick entry, daily goals with remaining amounts, full offline use, Drive sync, Claude-planned meals.
Non-goals: weight/body tracking, water, fasting, adaptive TDEE, onboarding/profile, backend server.

## FitScan: keep / remove / add
- Keep: diary UI and flow, barcode scanning (BarcodeDetector + ZXing), OFF search, 500+ built-in foods, custom foods, recipes, favorites, recents, Nutri-Score, NOVA, micronutrients, English-only UI (D23), light/dark.
- Remove: weight, measurements, weight charts, water, fasting, onboarding, profile, weekly check-in. Charts keep calories/macros only.
- Add: USDA search, live quick-entry kcal (4/4/9) with override + save as custom food, manual goals screen, Drive sync, planned/eaten status, offline barcode queue.

## Goals & meals
Manual kcal/protein/carbs/fat. Written to `settings.md`. Fixed meals: breakfast, lunch, dinner, snacks.

## Offline
Local storage is the source of truth. Unknown barcode offline creates a diary placeholder (0 kcal, "pending lookup"); optional manual numbers. On reconnect the lookup fills name/nutrition; user-typed numbers win. Lookups run through a single queue with backoff.

## Drive sync
- Auth: Google Identity Services token model, full `drive` scope, user's own Google Cloud OAuth client, app "In production" (unverified). Token in memory only (~1 h). Persistent pill "N changes not synced, tap to sign in"; queue flushes on next grant. Early spike: test sign-in on iPhone standalone; fallback = sign in via Safari.
- Folder: `AI Memory/Meal Tracker/` flat: `YYYY-MM-DD.md`, `settings.md` (goals, custom foods, favorites; merged per item by id), `FORMAT.md`.
- Triggers: pull+merge on open and focus; debounced push after each edit; manual "Sync now". Window: last 14 days + visible day via modifiedTime; tombstones expire after 60 days.
- Merge: by entry id; per-entry `rev` counter bumped only on app edits; Claude edits ordered by Drive modifiedTime. Newest wins, except `eaten` entries are never overwritten/removed by incoming `planned`; blocked changes listed in "Claude suggested changes". Only explicit tombstones delete; absence in an incoming file never deletes. Id-less entries matched on (meal, normalized food, qty_g) before creating new.
- File identity: cache Drive fileId per date; duplicate same-name files merged entry-wise into the oldest, extras trashed (not permanently deleted).
- Empty-start safety: request `navigator.storage.persist()`; keep a "has synced before" marker; if local data is missing, first sync is pull-only.
- Bad files: parse per entry; valid entries shown; invalid ones preserved as raw text with a warning and re-emitted untouched. Never overwrite a day that was not fully read without preserving unread parts.
- Unknown keys on entries kept and written back verbatim.
- Format version: app refuses to write a `format` newer than it supports (read-only banner).
- Dates: device local calendar date, stated in FORMAT.md.

## Day file format (meal-log/1)
```
---
date: 2026-11-07
format: meal-log/1
---
```yaml
entries:
  - id: optional
    meal: breakfast        # breakfast|lunch|dinner|snacks
    status: planned        # planned|eaten
    food: Greek yogurt
    qty_g: 200
    kcal: 130
    p: 20
    c: 8
    f: 1
    # optional: note, source, barcode, fiber, sugar, salt, nutriscore, nova, rev, deleted
```
```
FORMAT.md in the Drive folder documents this plus rules for Claude: edit only planned entries, leave others untouched, quote strings containing colons, do not rewrite stale copies (re-read first).

## Planned meals UX
Planned rows dimmed under each meal with projected total. Ring and "remaining" count eaten only. One tap check flips planned→eaten at planned amount; tap row to edit.

## Security Considerations
- Full-Drive scope accepted by the user (D6). Token memory-only; never persisted.
- All external strings (OFF, USDA, Drive files) escaped; strict CSP meta (no inline script; connect-src allowlist: Google APIs, OFF, USDA) enforced by a test (D14).
- USDA key stored locally only, never synced or committed.
- Serve from a repo-specific Pages path; do not share origin with other apps.

## Operations
GitHub Action stamps service-worker cache version from commit; "update available" prompt. Attribution line (ODbL) in Settings; provenance (source + id) stored on foods; 429 handling with visible message.

## Decisions Log
| ID | Topic | Decision | Rationale | Source | Date |
|---|---|---|---|---|---|
| D1 | Features dropped | Weight/body/charts, water, fasting; check-in by dependency | Meal logging only | Interview | 2026-11-06 |
| D2 | Goals | Manual entry only | Claude plans against fixed goals | Interview | 2026-11-06 |
| D3 | Meals | Fixed four | Strict format | Interview | 2026-11-06 |
| D4 | Favorites/custom foods | Sync via settings.md; recents local | Shared across devices | Interview | 2026-11-06 |
| D5 | Folder | AI Memory/Meal Tracker/ flat | One-lookup per day | Interview | 2026-11-06 |
| D6 | Google access | Full drive scope, own OAuth client, in production | Claude-written files must be visible | Interview | 2026-11-06 |
| D7 | Conflicts | Per-entry newest wins; eaten protected; tombstones | Never lose eaten data | Interview | 2026-11-06 |
| D8 | File format | Fenced YAML per day | Robust parsing | Interview | 2026-11-06 |
| D9 | Offline barcode | Placeholder + optional manual numbers | Keeps meal visible | Interview | 2026-11-06 |
| D10 | USDA key | User pastes own key | No secret in public repo | Interview | 2026-11-06 |
| D11 | Planned totals | Eaten counts; planned separate | Accurate remaining | Interview | 2026-11-06 |
| D12 | Sync timing | Open/focus/edit + manual | Plans appear promptly | Interview | 2026-11-06 |
| D13 | Bad YAML | Per-entry parse, preserve raw | No silent loss | Red Team | 2026-11-06 |
| D14 | XSS hardening | Escape all + strict CSP | Drive-wide token | Red Team | 2026-11-06 |
| D15 | Stale Claude write | Missing ≠ deleted; match id-less | Eaten protection | Red Team | 2026-11-06 |
| D16 | Storage eviction | persist() + pull-first hydrate | Avoid pushing blanks | Red Team | 2026-11-06 |
| D17 | Token expiry | Unsynced pill, auto-retry, iOS spike | No silent failure | Red Team | 2026-11-06 |
| D18 | Duplicate files | fileId cache, merge, trash extras | Drive allows dup names | Red Team | 2026-11-06 |
| D19 | Ordering | rev counter + Drive modifiedTime | Clock skew | Red Team | 2026-11-06 |
| D20 | SW/format versioning | Auto cache version, update prompt, refuse newer format | Stale clients | Red Team | 2026-11-06 |
| D21 | Extra fields | Passthrough + optional schema keys | Round-trip safety | Red Team | 2026-11-06 |
| D22 | Minor risks | Rolling window + 60d tombstones; local dates; attribution/backoff | Defaults adopted | Red Team | 2026-11-06 |
| D23 | Language | English only: no language switch, English formats, built-in foods and serving names renamed to English, Open Food Facts search no longer tuned for Germany. German strings stay in the code as internal lookup keys | User asked to remove German (replaces the earlier assumption to keep DE/EN) | Interview | 2026-11-07 |

## Dependency Graph & Implementation Order
1. Fork, strip removed features, rename (no deps).
2. Data model: add status/rev/id, passthrough bag, remove weight/water/fast (needs 1).
3. Quick entry + goals screen + remaining display (needs 2).
4. USDA search + offline barcode queue (needs 2).
5. Day-file YAML parser/serializer + FORMAT.md + tests (needs 2).
6. Auth spike on iPhone standalone (independent; do early).
7. Drive client: file ids, list/read/write, dedupe (needs 5, 6).
8. Merge engine + sync triggers + unsynced pill + hydrate safety (needs 7).
9. Planned-meals UI + suggested-changes list (needs 5, 8).
10. CSP, escaping audit, SW versioning Action, attribution (needs all).
