'use strict';
/* English-only checks. Run via tests/run.sh (loads i18n.js and foods.js first).
   The UI is English only. The German strings in the code are internal lookup keys into the EN table in i18n.js,
   so what matters is that every key has an English entry and nothing German leaks to the screen. */
let passed = 0, failed = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) passed++; else { failed++; print('FAIL: ' + msg + '\n   got:      ' + A + '\n   expected: ' + B); } };
const ok = (c, msg) => eq(!!c, true, msg);

const FILES = ['core.js', 'ui.js', 'diary.js', 'food.js', 'progress.js', 'settings.js', 'syncapp.js', 'usda.js', 'sync.js', 'driveauth.js', 'index.html'];
const unesc = s => s.replace(/\\(['"`\\])/g, '$1');

// 1. language is English, and stays English
eq([LANG, LOC()], ['en', 'en-US'], 'LANG is en and dates/numbers use en-US'); eq(t('Tagebuch'), 'Diary', 't() returns English'); eq(t('{n} nicht synchronisiert', { n: 3 }), '3 not synced', 'placeholders work');
ok(/LANG = 'en';/.test(read('i18n.js').split('function applyLang')[1]), 'applyLang always selects English');

// 2. every translated string has an English entry
const found = new Map();
for (const f of FILES) {
  const src = read(f); let m;
  const re = /\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g; while ((m = re.exec(src))) { const s = unesc(m[2]); if (!found.has(s)) found.set(s, f); }
  const re2 = /data-tl?="([^"]*)"/g; while ((m = re2.exec(src))) if (!found.has(m[1])) found.set(m[1], f);
}
const missing = [...found].filter(([s]) => EN[s] == null && s.trim() && !/^[\s\d.,:;%/·×+\-–—→()\[\]{}$]+$/.test(s));
eq(missing.map(([s, f]) => f + ': ' + s), [], 'every t("…") string has an English entry (' + found.size + ' checked)');
// keys used dynamically (tab titles, meal names, chart labels, micronutrients, error messages)
const dynamic = ['Tagebuch', 'Lebensmittel', 'Fortschritt', 'Einstellungen', 'Frühstück', 'Mittagessen', 'Abendessen', 'Snacks', 'Mittag', 'Abend', 'Kalorien', 'Makros', 'Protein', 'Wochenschnitt', '7T', '30T', '90T', '1J', 'Alles',
  'Gesättigte Fettsäuren', 'Natrium', 'Cholesterin', 'Kalium', 'Calcium', 'Magnesium', 'Eisen', 'Zink', 'Vitamin A', 'Vitamin C', 'Vitamin D', 'Vitamin E', 'Vitamin B12', 'Vitamin B6', 'Folat', 'Koffein',
  'Milchprodukte', 'Obst', 'Gemüse', 'Getreide', 'Beilagen', 'Brot', 'Käse', 'Fette', 'Eier', 'Fleisch', 'Wurst', 'Fisch', 'Hülsenfrüchte', 'Nüsse', 'Süßes', 'Supplemente', 'Getränke', 'Saucen', 'Trockenobst', 'Snacks', 'Eigene', 'Gerichte'];
eq(dynamic.filter(k => EN[k] == null && tFood(k) === k && /[äöüß]|^(Obst|Brot|Fette|Eier|Fisch|Wurst|Gemüse|Käse)$/.test(k)), [], 'dynamic keys (titles, meals, micronutrients, categories) are translated');

// 3. built-in foods are English
const GERMAN_LETTERS = /[äöüßÄÖÜ]/, ALLOWED_NAMES = ['Leberkäse (meatloaf)', 'Dürüm wrap', 'Butterkäse (mild cheese)', 'Franzbrötchen (cinnamon pastry)'];   // names of German foods, with an English description
eq(BASE_FOODS.length > 400, true, 'built-in foods loaded (' + BASE_FOODS.length + ')');
eq(BASE_FOODS.filter(f => GERMAN_LETTERS.test(f.name) && !ALLOWED_NAMES.includes(f.name)).map(f => f.name), [], 'no German letters in food names (except named German foods)');
eq(BASE_FOODS.filter(f => f.serving && (GERMAN_LETTERS.test(f.serving.label) || /\b(Stück|Scheibe|Schale|Glas|Tasse|Dose|Becher|Riegel|Flasche|Handvoll|Portion|Packung|Zehe|Stange|Brötchen|Keks|Teller)\b/.test(f.serving.label))).map(f => f.name + ': ' + f.serving.label), [], 'serving labels are English');
eq(BASE_FOODS.filter(f => /\b(roh|gekocht|gebraten|ungesüßt|getrocknet|mit|ohne|und|Käse|Brot|Soße|Suppe|Salat|Kuchen)\b/.test(f.name)).map(f => f.name).slice(0, 5), [], 'no common German words left in food names');
const GERMAN_NAMES = JSON.parse(read('tests/german-food-names.json'));   // every original German name that differs from its English name
ok(GERMAN_NAMES.length > 400, 'list of original German food names loaded (' + GERMAN_NAMES.length + ')');
eq(BASE_FOODS.filter(f => GERMAN_NAMES.includes(f.name)).map(f => f.name), [], 'no food still carries its original German name (also catches names without umlauts, e.g. "Apfel")');
eq(new Set(BASE_FOODS.map(f => f.name)).size, BASE_FOODS.length, 'food names are unique');
ok(BASE_FOODS.every(f => f.n.kcal >= 0 && f.n.kcal < 950 && typeof f.cat === 'string' && f.cat.length), 'food data intact');
eq(BASE_FOODS.filter(f => EN[f.cat] == null && f.cat !== 'Gerichte').map(f => f.cat).filter((c, i, a) => a.indexOf(c) === i), [], 'every food category has an English label');

// 4. no Germany tuning in the code, no German locale
for (const f of ['core.js', 'ui.js', 'diary.js', 'food.js', 'settings.js', 'progress.js', 'syncapp.js']) {
  const src = read(f); ok(!/de-DE/.test(src), f + ': no de-DE locale'); ok(!/en:germany|countries_tags_en=germany|lc=de|langs=de|product_name_de|generic_name_de/.test(src), f + ': no Germany-specific search or language parameters');
}
ok(!/Sprache|sLang|'Deutsch'/.test(read('settings.js')), 'no language switch in Settings');
ok(/<html lang="en"/.test(read('index.html')), 'index.html declares English');

// 5. static page text already matches the English text (no German flash before the script runs)
const html = read('index.html'), badStatic = []; let mm;
const re3 = /data-t="([^"]+)"[^>]*>([^<]*)</g; while ((mm = re3.exec(html))) { const want = EN[mm[1]] ?? mm[1]; if (mm[2].trim() !== want) badStatic.push(`${mm[1]}: shows "${mm[2].trim()}", should be "${want}"`); }
eq(badStatic, [], 'static text in index.html equals its English entry'); ok(/<h1 id="pageTitle">Diary<\/h1>/.test(html), 'page title placeholder is English');

print(`\n${passed} passed, ${failed} failed`);
if (failed) throw new Error(failed + ' check(s) failed');
