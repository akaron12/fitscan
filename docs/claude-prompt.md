# Meal Tracker: Claude System Prompt & Guide

This guide explains how to configure and use Claude as your personal nutritionist and meal planner alongside the **Meal Tracker** PWA.

---

## 1. How Claude and Meal Tracker Work Together

There are two primary ways to collaborate with Claude:

### A. Google Drive Sync (Automated, File-Based)
* If Google Drive Sync is connected in Settings, the app syncs files with Google Drive under `AI Memory/Meal Tracker/`:
  * `settings.md`: Contains your daily calorie/macro goals, starred favorite foods, custom foods, and recent foods.
  * `YYYY-MM-DD.md`: Each day's meal log.
* When you ask Claude (e.g. in a Claude chat with Drive access or a Claude desktop session) to plan your meals, Claude inspects `settings.md` and writes planned entries into `YYYY-MM-DD.md`.
* On your phone, planned meals show dimmed in the Diary with projected totals. One tap confirms them as eaten.

### B. Direct Chat Paste (Instant, No Setup Required)
* When you are having a conversation with Claude and want advice or dinner ideas:
  1. Open the Diary tab on your phone or computer.
  2. Tap the summary ring card (or **Details**).
  3. Tap **"Copy day for Claude"**.
  4. Paste the formatted summary directly into your Claude chat.
* Claude reads your goals, eaten totals, and remaining calories/macros, and suggests exact foods and portion sizes.

---

## 2. Ready-to-Use Claude System Prompt

Copy the block below and paste it into:
* Claude's **Custom Instructions** (User Profile → "What instructions should Claude follow?"), or
* A **Claude Project**'s project instructions.

```markdown
You are an expert personal nutritionist and meal planner assisting me with my Meal Tracker app.

## Core Rules & Nutrition Science
1. Four fixed meals: `breakfast`, `lunch`, `dinner`, `snacks`.
2. Strict 4/4/9 macro calculation:
   - Calories = 4 × protein (g) + 4 × carbs (g) + 9 × fat (g).
   - Never hallucinate calorie totals that do not match the macros.
3. When suggesting meals or foods, always specify:
   - Target meal (`breakfast`, `lunch`, `dinner`, `snacks`)
   - Food name
   - Quantity in grams (`qty_g`)
   - Calories (`kcal`), protein (`p`), carbs (`c`), fat (`f`) in grams.

## Mode 1: When I Paste a Day Log
- Read my "Daily Targets & Status" (remaining calories, protein, carbs, fat).
- Propose meals or snacks that hit my remaining goals precisely without exceeding fat or calories.
- Give practical, easy-to-cook or whole-food options.
- If requested, format suggested additions as a `meal-log/1` YAML block.

## Mode 2: When Editing Files in Google Drive (`AI Memory/Meal Tracker/`)
- Read `settings.md` first to check my daily goals, favorites, custom foods, and recents. Prefer planning with foods I already eat and star.
- In `YYYY-MM-DD.md`:
  - Only add or modify entries with `status: planned`.
  - NEVER modify, overwrite, or delete any entry with `status: eaten` (eaten entries are sacred and protected).
  - Use strict `meal-log/1` YAML format: 2-space indentation (`  - `), no tabs, wrap strings containing colons in double quotes (e.g., `food: "Chicken: grilled"`).
```

---

## 3. Example Chat Prompts

### Example 1: Fill the Rest of the Day
> *"Here is what I've eaten today so far:*
>
> *[Paste copied Day Log]*
>
> *What should I make for dinner to hit my protein goal without going over my calorie limit?"*

### Example 2: Plan Tomorrow
> *"Plan my meals for tomorrow (2026-11-09) to hit my goals (2,200 kcal, 140g P, 240g C, 75g F). Prefer simple meals with high protein and whole foods."*

### Example 3: Restaurant Meal Estimation
> *"I'm at an Italian restaurant for lunch and had chicken parmesan with a side of pasta. Estimate the portion sizes and macros so I can quick-add it to Meal Tracker, and tell me how to adjust my dinner."*

---

## 4. Day File Format Reference (`meal-log/1`)

When Claude outputs planned meals for Drive or for manual review, each entry must follow this schema:

```yaml
entries:
  - meal: breakfast        # breakfast | lunch | dinner | snacks
    status: planned        # always 'planned' for AI suggestions
    food: Greek yogurt
    qty_g: 200
    kcal: 130
    p: 20
    c: 8
    f: 1
    note: optional note
```

See [`docs/FORMAT.md`](FORMAT.md) for the complete Google Drive file specification and merge behavior.
