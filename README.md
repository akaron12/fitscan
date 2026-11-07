# FitScan (meal tracker fork)

> Fork of [CorneliusKauffmann/fitscan](https://github.com/CorneliusKauffmann/fitscan) (MIT). Being reshaped into a lightweight personal meal tracker – see `spec-meal-tracker.md`. Weight, body measurements, water, fasting, onboarding and the weekly check-in have been removed.

**Free calorie & macro tracker – unlimited barcode scans, no paywall.**

FitScan is an installable web app (PWA) for tracking calories and macros (meal logging only). No account, no server, no subscription – all data stays on your device.

👉 **Live:** https://corneliuskauffmann.github.io/fitscan/

| Diary | Barcode scan | Weight trend | Food search |
|---|---|---|---|
| ![](screenshots/diary-en.png) | ![](screenshots/scan-result.png) | ![](screenshots/charts.png) | ![](screenshots/library.png) |

## Features
- **Unlimited barcode scanning** (EAN/UPC/QR) via camera (native `BarcodeDetector`, bundled ZXing fallback), photo or manual entry. **Continuous scan mode** adds products directly; beep + vibration, torch when supported; **scan history** works offline
- **Fast logging:** quick add of kcal/macros (editable later), multi-select add, portion presets (½/1/2 servings, grams, "same as last time"), copy a meal or all of yesterday, per-meal scan button, **undo** for every add, copy and delete
- **Big food library:** Open Food Facts search with smarter ranking (exact/brand matches, German products, complete data, your recents & favorites), **500+ built-in foods offline**, custom foods, recipes
- **Nutri-Score & NOVA** badges, **micronutrients** (vitamins, minerals, sodium, saturated fat… where OFF has data) per product and per day
- **Diary** with week strip, calorie ring, macro bars and logging streak; goals are set manually
- **Insights:** weekly averages vs. last week, days on target (±10 %), protein goal hits
- **Charts:** calories vs. goal, macros, protein, weekly averages – 7D/30D/90D/1Y/All
- **Backup** (JSON import/export), CSV export of the diary, delete all data – custom foods and recipes can be edited from their detail sheet
- **Clean, minimal design** in light, dark or automatic mode; **German & English UI** (auto-detected, switch in Profile); works offline – no account, no paywall, no tracking

## Run locally
Any static server works, e.g. `python3 -m http.server 8000` → http://localhost:8000. Camera scanning requires HTTPS or localhost.

## Deploy
Hosted on GitHub Pages (Settings → Pages → Deploy from branch `main`, folder `/ (root)`). All paths are relative, so it works under `/fitscan/`.

## Credits & license
Product data © Open Food Facts contributors (ODbL). Bundled: Chart.js (MIT), ZXing-js (Apache-2.0). Basic food values are approximations based on public-domain USDA data.
FitScan is released under the MIT License.
