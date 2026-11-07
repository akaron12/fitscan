# Meal Tracker (fork of FitScan)

A lightweight personal meal tracker (installable PWA): calories and macros, barcode scanning, works offline, optional sync to your own Google Drive so Claude can plan meals into your days.

> Fork of [CorneliusKauffmann/fitscan](https://github.com/CorneliusKauffmann/fitscan) (MIT, © 2026 Cornelius Kauffmann), reshaped into a meal-logging-only tracker. Design and decisions: [`spec-meal-tracker.md`](spec-meal-tracker.md).

👉 **Live:** https://akaron12.github.io/fitscan/

## What it does
- **Log meals:** calories, protein, carbs, fat; four fixed meals (breakfast, lunch, dinner, snacks); copy yesterday; undo for every change.
- **Quick entry:** type protein, carbs and fat and the calories fill in (4/4/9); override the calories if you like; optionally save it as a custom food.
- **Find foods:** barcode scanning (camera, photo or typed) via Open Food Facts; generic foods ("chicken breast raw") via USDA FoodData Central with your own free API key; 500+ built-in foods; custom foods, recipes, favorites.
- **Daily goals:** set kcal and macros; the diary shows what is left through the day.
- **Works offline:** everything you logged stays searchable; an unknown barcode scanned offline becomes a placeholder row that is looked up automatically when you are back online.
- **Planned meals:** Claude (in other chats) writes planned meals into a day's file in Drive; they show dimmed in the diary with a projected total, and one tap marks one as eaten. See [`docs/FORMAT.md`](docs/FORMAT.md) for the strict file format.
- **Google Drive sync (optional):** one markdown file per day plus a settings file with your goals, custom foods and favorites, in `AI Memory/Meal Tracker/`. Local storage stays the source; edits are merged entry by entry and never silently overwritten (an entry you marked eaten is protected from outside edits; anything blocked is listed as a suggestion).
- **Also:** Nutri-Score and NOVA badges, micronutrients, weekly insights and calorie/macro charts, JSON backup and CSV export, light/dark mode. English only.

Removed from FitScan: weight and body tracking, water, fasting, onboarding and the weekly check-in.

## Run locally
Any static server works, e.g. `python3 -m http.server 8000` → http://localhost:8000. Camera scanning and Google sign-in need HTTPS or localhost.

## Google Drive setup
One-time, about 10 minutes: [`docs/google-cloud-setup.md`](docs/google-cloud-setup.md). The app asks for the full `drive` scope (it has to see files Claude writes into your `AI Memory` folder). The access token lives in memory only. A strict Content-Security-Policy limits what the page can load and where it can send data.

## Tests
`sh tests/run.sh` runs all unit tests with the JavaScriptCore shell that ships with macOS (no Node needed): day-file format, Drive client (against a fake Drive), merge logic, sync engine, USDA parsing, security checks.

## Deploy
GitHub Pages. For automatic cache versioning, set Settings → Pages → Source to **GitHub Actions**; [`.github/workflows/pages.yml`](.github/workflows/pages.yml) then assembles the site, stamps the service-worker cache version with the commit and deploys. (Alternatively "Deploy from a branch" still works; bump `V` in `sw.js` by hand on each release.) All paths are relative, so it works under `/fitscan/`.

## Credits & license
Product data © Open Food Facts contributors, licensed under the [ODbL](https://opendatacommons.org/licenses/odbl/1-0/); product images CC BY-SA. Generic food data: USDA FoodData Central (public domain). Bundled: Chart.js (MIT), ZXing-js (Apache-2.0).
Released under the MIT License (see `LICENSE`; original copyright notice retained).
