<!-- Managed by the Meal Tracker app. It is refreshed automatically; edits to this file are overwritten. -->
# Meal Tracker: file format (meal-log/1)

This folder (`AI Memory/Meal Tracker/`) is shared between the Meal Tracker app and Claude.
- The app writes what was eaten.
- Claude plans meals into each day's file.
- Both read each other's changes. Follow the rules below exactly: the app parses these files with a strict reader.

## Files
| File | Purpose | Who writes |
|---|---|---|
| `YYYY-MM-DD.md` | One day (the device's local calendar date) | app and Claude |
| `settings.md` | Daily goals, favorites, custom foods | **app only**. Claude reads it, never edits it |
| `FORMAT.md` | This spec | app |

## Daily goals (read these before planning)
`settings.md` contains a ```` ```yaml ```` block with `goals:` (`kcal`, `p`, `c`, `f`, in kcal and grams per day). Plan against those numbers.

## Day file layout
````markdown
---
date: 2026-11-07
format: meal-log/1
---
Any notes or headings you like (optional).

```yaml
entries:
  - id: m7k2x9a
    meal: breakfast
    status: planned
    food: Greek yogurt
    qty_g: 200
    kcal: 130
    p: 20
    c: 8
    f: 1
  - meal: lunch
    status: planned
    food: "Chicken: grilled"
    qty_g: 150
    kcal: 248
    p: 46
    c: 0
    f: 5
    note: skin removed
```
````

- Frontmatter: `date` (YYYY-MM-DD) and `format: meal-log/1`.
- Exactly one ```` ```yaml ```` block. It starts with `entries:` and is a list of entries. Text outside the block is kept as-is.
- Entries have exactly 2-space list indentation (`  - `) and 4-space continuation lines. Spaces only, never tabs.
- Values are plain scalars only: text, numbers, `true`/`false`. No nested maps, no `[lists]` or `{maps}`, no multi-line strings.

## Entry fields
| Key | Required | Meaning |
|---|---|---|
| `meal` | yes | `breakfast`, `lunch`, `dinner` or `snacks` |
| `status` | yes | `planned` (suggested by Claude) or `eaten` (confirmed by the user) |
| `food` | yes | Name of the food. **Put it in "double quotes" if it contains `:` or `#`**, or starts with a symbol |
| `qty_g` | yes | Amount in grams (number > 0) |
| `kcal` | yes | Calories for the whole amount (not per 100 g), number 0 or more |
| `p`, `c`, `f` | recommended | Protein, carbs, fat in grams for the whole amount (default 0) |
| `id` | optional | Stable id. Leave it off for new entries: the app assigns one on first read. **Never change or reuse an existing id** |
| `fiber`, `sugar`, `salt` | optional | Grams for the whole amount |
| `nutriscore`, `nova`, `barcode`, `source`, `note` | optional | Extra info. `note` is shown in the app |
| `rev` | app-owned | Revision counter. Keep it as it is |
| `deleted` | app-owned | `true` marks a deleted entry (a tombstone). Keep it |

Unknown keys are allowed and are kept by the app.

## Rules for Claude
1. **Always re-read the day file right before you write it.** Never write from an older copy. The user may have confirmed meals since you last read it.
2. **Only add or change `planned` entries.** Never edit, delete or re-order `eaten` entries, and never turn `eaten` back into `planned`. The app ignores such changes.
3. **Keep everything you do not understand**: other entries, ids, `rev`, `deleted`, unknown keys, text outside the block.
4. To remove a planned meal, delete its list item. The app only treats an explicit `deleted: true` as a deletion elsewhere, so a missing item may reappear if the app still has it. To be sure, leave the entry and set `note: "cancelled"`, or ask the user.
5. New entries: omit `id`; set `status: planned`; give `kcal`/`p`/`c`/`f` for the whole `qty_g`.
6. Check the arithmetic: roughly `kcal ≈ 4*p + 4*c + 9*f`.
7. If a file or entry is unclear, do not guess. Leave it untouched and tell the user.
8. If `format:` is higher than `meal-log/1`, do not write to the file.

## What the app does with your entries
- Planned entries show dimmed in the diary. They do not count toward the daily totals until the user confirms them with one tap.
- An entry that cannot be read is kept as raw text and shown with a warning. The usual causes are an unquoted colon in `food`, a tab, a missing field, or a non-number in a number field.
- Dates are the device's local calendar date.
