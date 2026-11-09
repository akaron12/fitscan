'use strict';
/* FitScan – core: state, storage, calculations, Open Food Facts. All data stays on the device (localStorage). */
const MEALS = [['breakfast', 'Frühstück'], ['lunch', 'Mittagessen'], ['dinner', 'Abendessen'], ['snacks', 'Snacks']];
const KEY = 'fitscan.v1';
try { if (!localStorage.getItem(KEY) && localStorage.getItem('naehrwerk.v1')) localStorage.setItem(KEY, localStorage.getItem('naehrwerk.v1')); } catch {}

// ---------- Utils ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r0 = x => Math.round(x || 0), r1 = x => Math.round((x || 0) * 10) / 10;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const iso = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
const today = () => iso(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const fmtDate = s => new Date(s + 'T12:00:00').toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'short' });
const fmtLong = s => new Date(s + 'T12:00:00').toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = s => new Date(s + 'T12:00:00').toLocaleDateString(LOC(), { day: 'numeric', month: 'numeric' });
const de = (x, d = 0) => (x ?? 0).toLocaleString(LOC(), { maximumFractionDigits: d, minimumFractionDigits: d });
const signed = (x, d = 0) => (x > 0 ? '+' : x < 0 ? '−' : '') + de(Math.abs(x), d);
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
const num = (v, min = 0, max = 1e5) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : 0; };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const mealName = id => t(MEALS.find(m => m[0] === id)?.[1] || 'Snacks');

// ---------- State ----------
const DEFAULT = () => ({ goals: { kcal: 2200, p: 140, c: 240, f: 75, manual: false }, entries: {}, tombstones: {}, libTombs: { foods: {}, favs: {} },
  foods: {}, products: {}, recipes: {}, recents: [], favorites: {}, scanHistory: [],
  settings: { theme: 'light' } });
// Data removed from the app (weight, water, fasting, profile, check-ins) is dropped on load.
const STATUSES = ['planned', 'eaten'], TOMBSTONE_TTL_DAYS = 60;
const REMOVED_KEYS = ['profile', 'weights', 'water', 'measures', 'checkins', 'fast', 'fastLog'];
function sanitize(o) {
  const d = DEFAULT(); if (!isObj(o)) o = {};
  const s = Object.assign(d, o);
  for (const k of REMOVED_KEYS) delete s[k];
  for (const k of ['goals', 'entries', 'foods', 'products', 'recipes', 'favorites', 'settings']) if (!isObj(s[k])) s[k] = DEFAULT()[k];
  for (const k of ['recents', 'scanHistory']) if (!Array.isArray(s[k])) s[k] = [];
  for (const k of ['kcal', 'p', 'c', 'f']) s.goals[k] = Number.isFinite(+s.goals[k]) ? +s.goals[k] : DEFAULT().goals[k];
  if (Number.isFinite(+s.goals.rev)) s.goals.rev = +s.goals.rev; else delete s.goals.rev;
  // Drive sync bookkeeping (see sync.js). Never copied between devices: a backup import or wipe resets it.
  const sy = isObj(s.sync) ? s.sync : {};
  s.sync = { synced: !!sy.synced, lastSync: +sy.lastSync || 0, days: isObj(sy.days) ? sy.days : {}, suggestions: Array.isArray(sy.suggestions) ? sy.suggestions : [], ...(Number.isFinite(+sy.goalsSyncedRev) ? { goalsSyncedRev: +sy.goalsSyncedRev } : {}) };
  for (const [dk, es] of Object.entries(s.entries)) {
    if (!Array.isArray(es)) { delete s.entries[dk]; continue; }
    const seen = new Set();
    // Unknown fields on an entry are kept as-is (Claude may add notes etc.); only the known ones are normalised.
    s.entries[dk] = es.filter(e => isObj(e) && isObj(e.food) && isObj(e.food.n) && Number.isFinite(+e.g)).map(e => {
      if (!e.id || seen.has(e.id) || !/^[A-Za-z0-9_-]{1,64}$/.test(String(e.id))) e.id = uid(); seen.add(e.id);   // ids go into HTML attributes: boring characters only (a backup or file could carry anything)
      if (!STATUSES.includes(e.status)) e.status = 'eaten';
      e.rev = Math.max(1, Math.floor(+e.rev) || 1);
      return e;
    });
  }
  // Tombstones (deleted entry ids per day) let a later sync tell "deleted" from "never seen". They expire after 60 days.
  if (!isObj(s.tombstones)) s.tombstones = {};
  const cutoff = Date.now() - TOMBSTONE_TTL_DAYS * 864e5;
  // Same for deleted custom foods / favorites: s.libTombs = { foods: {id: {rev, at}}, favs: {...} }
  if (!isObj(s.libTombs)) s.libTombs = {};
  for (const k of ['foods', 'favs']) {
    if (!isObj(s.libTombs[k])) s.libTombs[k] = {};
    for (const [id, tb] of Object.entries(s.libTombs[k])) if (!isObj(tb) || !(+tb.rev >= 1) || !(+tb.at > cutoff)) delete s.libTombs[k][id];
  }
  for (const [dk, m] of Object.entries(s.tombstones)) {
    if (!isObj(m)) { delete s.tombstones[dk]; continue; }
    for (const [id, tb] of Object.entries(m)) if (!isObj(tb) || !(+tb.at > cutoff)) delete m[id];
    if (!Object.keys(m).length) delete s.tombstones[dk];
  }
  const st = s.settings;
  for (const k of ['waterGoal', 'glass', 'fastTarget', 'showWater', 'showFasting', 'onboarded', 'planStart', 'lang']) delete st[k];
  st.continuousScan ??= false; st.beep ??= true;
  // v6: new light design – earlier versions defaulted to dark, so switch everyone to light once.
  if (st.ui !== 6) { st.theme = 'light'; st.ui = 6; }
  if (!['light', 'dark', 'system'].includes(st.theme)) st.theme = 'light';
  // Recents: a window of days (a setting, synced), a sort, and the one-time upgrade from the old list of 40 (no dates) using the diary.
  st.recentsDays = Recents.DAYS.includes(+st.recentsDays) ? +st.recentsDays : Recents.DEFAULT_DAYS;
  st.recentsRev = Math.max(0, Math.floor(+st.recentsRev) || 0);
  if (!['recent', 'used'].includes(st.recentsSort)) st.recentsSort = 'recent';
  let rec = s.recents.filter(f => isObj(f) && isObj(f.n) && f.id != null);
  if (!st.recentsV2) { rec = Recents.migrate(rec, s.entries, today(), st.recentsDays); st.recentsV2 = true; }
  s.recents = Recents.prune(Recents.normalize(rec, today()), today(), st.recentsDays);
  s.version = 6;
  return s;
}
function load() { try { return sanitize(JSON.parse(localStorage.getItem(KEY))); } catch { return DEFAULT(); } }
// save(true) = quiet: used by the sync engine so its own writes do not trigger another sync.
function save(quiet) {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast(t('Speicher voll – bitte Backup exportieren')); }
  if (quiet !== true) try { window.onLocalSave?.(); } catch {}
}
let S = load();

// ---------- Nutrition ----------
const NKEYS = ['kcal', 'p', 'c', 'f', 'fib', 'sug', 'salt'];
const nutr = (food, g) => { const k = (+g || 0) / 100, n = food?.n || {}, o = {}; for (const key of NKEYS) o[key] = (+n[key] || 0) * k; o.nc = Math.max(0, o.c - o.fib); return o; };
// Totals, goals and "logged" only count eaten entries; planned ones are shown separately (projected totals).
const isEaten = e => e.status !== 'planned';
function totalsOf(entries) {
  const tot = Object.fromEntries(NKEYS.map(k => [k, 0]));
  for (const e of entries) { const n = nutr(e.food, e.g); for (const k of NKEYS) tot[k] += n[k]; }
  tot.nc = Math.max(0, tot.c - tot.fib);
  return tot;
}
const dayTotals = date => totalsOf((S.entries[date] || []).filter(isEaten));
const plannedTotals = date => totalsOf((S.entries[date] || []).filter(e => !isEaten(e)));
const isLogged = d => (S.entries[d] || []).some(isEaten);
function streak() { let n = 0, d = today(); if (!isLogged(d)) d = addDays(d, -1); while (isLogged(d)) { n++; d = addDays(d, -1); } return n; }
function mealDefault() { const h = new Date().getHours(); return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks'; }

// Recents: the food, with the day and amount of this log, goes to the top of the list (see recents.js).
const rememberRecent = (snap, date, g, unit, qty) => { S.recents = Recents.touch(S.recents, snap, { date, today: today(), days: S.settings.recentsDays, g, unit, qty }); };
const recentsList = () => Recents.view(S.recents, today(), S.settings.recentsDays, S.settings.recentsSort);
function setRecentsDays(days) {   // the revision lets a sync tell which device changed it last
  S.settings.recentsDays = days; S.settings.recentsRev = (S.settings.recentsRev || 0) + 1;
  S.recents = Recents.prune(S.recents, today(), days); save();
}
function addEntry(food, g, label, meal, date = ui.date, extra = {}) {
  const snap = { id: food.id, name: food.name, brand: food.brand || '', img: food.img || '', cat: food.cat || '', n: food.n, serving: food.serving || null, src: food.src, code: food.code || '' };
  if (food.micro) snap.micro = food.micro; if (food.ns) snap.ns = food.ns; if (food.nova) snap.nova = food.nova;
  const e = { id: uid(), meal, status: 'eaten', rev: 1, g, label, food: snap, ...extra };
  (S.entries[date] ||= []).push(e);
  if (food.src !== 'quick' && food.src !== 'pending') rememberRecent(snap, date, g, extra.unit, extra.qty);
  save(); return e;
}
// Every app-side change to an entry bumps its revision, so a later sync can order edits without trusting device clocks.
function touch(e, patch = {}) { Object.assign(e, patch); e.rev = (+e.rev || 0) + 1; return e; }
// Deleting leaves a tombstone, so a stale copy of the day can't bring the entry back.
function removeEntry(date, e) {
  const arr = S.entries[date] || [], i = arr.indexOf(e); if (i < 0) return -1;
  arr.splice(i, 1); touch(e);
  ((S.tombstones[date] ||= {})[e.id] = { rev: e.rev, at: Date.now(), meal: e.meal });
  return i;
}
function restoreEntry(date, e, i = -1) {
  if (S.tombstones[date]) { delete S.tombstones[date][e.id]; if (!Object.keys(S.tombstones[date]).length) delete S.tombstones[date]; }
  touch(e); const arr = (S.entries[date] ||= []); arr.splice(i < 0 ? arr.length : i, 0, e);
}
// ---------- Library (custom foods + favorites): revisions and tombstones so Drive sync can merge item by item ----------
const libRev = (obj, tomb) => Math.max(obj?.rev || 0, tomb?.rev || 0) + 1;
/** Add or update a favorite (a snapshot of the food). Its rev counts favorite changes only, not edits of the food itself. */
function setFavorite(food) {
  const tomb = S.libTombs.favs[food.id], rev = libRev(S.favorites[food.id], tomb);
  delete S.libTombs.favs[food.id]; S.favorites[food.id] = { ...food, rev };
}
function removeFavorite(id) {
  const old = S.favorites[id]; if (!old) return;
  S.libTombs.favs[id] = { rev: (old.rev || 0) + 1, at: Date.now() }; delete S.favorites[id];
}
/** Create or update a custom food; keeps its favorite snapshot in step. */
function saveCustomFood(food) {
  const tomb = S.libTombs.foods[food.id]; food.rev = libRev(S.foods[food.id], tomb);
  delete S.libTombs.foods[food.id]; S.foods[food.id] = food;
  if (S.favorites[food.id]) setFavorite(food);
}
function deleteCustomFood(id) {
  const old = S.foods[id]; if (old) S.libTombs.foods[id] = { rev: (old.rev || 0) + 1, at: Date.now() };
  delete S.foods[id]; removeFavorite(id);
}
// The amount to start from when adding a food again: what you used last time (recents), else one serving or 100 g.
function startPortion(f) {
  const d = defaultPortion(f), rc = S.recents.find(r => r.id === f.id), q = rc?.lastQ, u = rc?.lastU;
  if (!(q > 0)) return d;
  const per = u === 'g' || u === 'ml' ? 1 : u === 'serv' ? f.serving?.g : u === 'pc' ? f.piece?.g : 0;
  if (!(per > 0)) return d;
  const label = u === 'g' ? `${de(q)} g` : u === 'ml' ? `${de(q)} ml` : `${de(q, q % 1 ? 1 : 0)} × ${u === 'serv' ? f.serving.label || 'Portion' : 'Stück'}`;
  return { g: q * per, label, unit: u, qty: q };
}
const defaultPortion = f => f.serving?.g ? { g: f.serving.g, label: `1 × ${f.serving.label}`, unit: 'serv', qty: 1 } : { g: 100, label: '100 g', unit: 'g', qty: 100 };
// ---------- Weekly insights ----------
function insights() {
  const days = n => Array.from({ length: n }, (_, i) => addDays(today(), -i)), g = S.goals;
  const stat = arr => { const tt = arr.filter(isLogged).map(dayTotals), a = k => avg(tt.map(x => x[k])) || 0;
    return { n: tt.length, kcal: a('kcal'), p: a('p'), adh: tt.filter(x => Math.abs(x.kcal - g.kcal) <= g.kcal * 0.1).length, ph: tt.filter(x => x.p >= g.p * 0.9).length }; };
  return { cur: stat(days(7)), prev: stat(days(14).slice(7)) };
}

// ---------- Open Food Facts ----------
const MICROS = [['saturated-fat', 'Gesättigte Fettsäuren', 'g', 1], ['sodium', 'Natrium', 'mg', 1000], ['cholesterol', 'Cholesterin', 'mg', 1000], ['potassium', 'Kalium', 'mg', 1000], ['calcium', 'Calcium', 'mg', 1000],
  ['magnesium', 'Magnesium', 'mg', 1000], ['iron', 'Eisen', 'mg', 1000], ['zinc', 'Zink', 'mg', 1000], ['vitamin-a', 'Vitamin A', 'µg', 1e6], ['vitamin-c', 'Vitamin C', 'mg', 1000], ['vitamin-d', 'Vitamin D', 'µg', 1e6],
  ['vitamin-e', 'Vitamin E', 'mg', 1000], ['vitamin-b12', 'Vitamin B12', 'µg', 1e6], ['vitamin-b6', 'Vitamin B6', 'mg', 1000], ['folates', 'Folat', 'µg', 1e6], ['caffeine', 'Koffein', 'mg', 1000]];
const NS_COL = { a: '#038141', b: '#85bb2f', c: '#fecb02', d: '#ee8100', e: '#e63e11' };
const OFF_FIELDS = 'code,product_name,product_name_en,generic_name_en,brands,image_front_small_url,image_front_url,nutriments,serving_size,serving_quantity,quantity,countries_tags,nutriscore_grade,nova_group,completeness';
function parseOFF(p, code) {
  if (!p) return null;
  const nm = p.nutriments || {}, n = k => { const x = parseFloat(nm[k]); return isFinite(x) ? x : 0; };
  let kcal = n('energy-kcal_100g'); if (!kcal && n('energy_100g')) kcal = n('energy_100g') / 4.184;
  const name = p.product_name_en || p.product_name || p.generic_name_en || 'Unnamed product', sq = parseFloat(p.serving_quantity);
  const brand = Array.isArray(p.brands) ? p.brands.join(', ') : (p.brands || '');
  const f = { id: 'off:' + (p.code || code), src: 'off', code: p.code || code, name: name.trim(), brand: brand.split(',').slice(0, 2).join(', ').trim(), img: p.image_front_small_url || p.image_front_url || '',
    cat: '', quantity: p.quantity || '', n: { kcal: r1(kcal), p: n('proteins_100g'), c: n('carbohydrates_100g'), f: n('fat_100g'), sug: n('sugars_100g'), fib: n('fiber_100g'), salt: n('salt_100g') },
    serving: sq > 0 ? { g: sq, label: p.serving_size ? 'Portion: ' + String(p.serving_size).replace(/^1 (portion|serving)\s*/i, '').replace(/^\((.*)\)$/, '$1') : 'Portion' } : null,
    hasNutr: !!(kcal || nm.proteins_100g != null) };
  const mic = {}; for (const [k] of MICROS) { const v = parseFloat(nm[k + '_100g']); if (isFinite(v) && v > 0) mic[k] = v; }
  if (Object.keys(mic).length) f.micro = mic;
  if (/^[a-e]$/.test(p.nutriscore_grade || '')) f.ns = p.nutriscore_grade;
  if (p.nova_group) f.nova = +p.nova_group;
  f.compl = +p.completeness || 0;
  return f;
}
async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, '');
  const custom = Object.values(S.foods).find(f => f.code === code); if (custom) return { product: custom, cached: true };
  if (S.products[code]) return { product: S.products[code], cached: true };
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}&lc=en`, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return { product: null };
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (j.status !== 1 || !j.product) return { product: null };
  const prod = parseOFF(j.product, code); S.products[code] = prod; save();
  return { product: prod, cached: false };
}
const dedupe = arr => { const s = new Set(); return arr.filter(x => !s.has(x.id) && s.add(x.id)); };
async function searchOFF(q, signal) {
  const qs = encodeURIComponent(q), F = `&fields=${OFF_FIELDS}`;
  const sal = async extra => { const r = await fetch(`https://search.openfoodfacts.org/search?q=${qs}${extra}&langs=en&page_size=30${F}`, { signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return (await r.json()).hits || []; };
  const cgi = async () => { const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${qs}&search_simple=1&json=1&page_size=30&lc=en${F}`, { signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return (await r.json()).products || []; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const tries = [() => sal(''), cgi,
    async () => { await wait(1200); return sal(''); }, async () => { await wait(2000); return cgi(); }];
  let err;
  for (const tryFn of tries) {
    try { const list = dedupe((await tryFn()).map(p => parseOFF(p)).filter(x => x && x.hasNutr)); return rank(list, q); }
    catch (e) { if (e?.name === 'AbortError') throw e; err = e; }
  }
  throw err || new Error('offline');
}

// ---------- Search & ranking ----------
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
function scoreFood(f, q) {
  const nq = norm(q).trim(), name = norm(f.name), brand = norm(f.brand), words = nq.split(/\s+/).filter(Boolean);
  let s = 0;
  if (name === nq) s += 100; else if (name.startsWith(nq)) s += 60; else if (new RegExp('\\b' + nq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(name)) s += 40;
  if (words.every(w => (name + ' ' + brand).includes(w))) s += 25;
  if (brand && words.some(w => brand.includes(w))) s += 15;
  if (f.n && f.n.kcal > 0) s += 10;
  if (f.img) s += 5; if (f.serving?.g) s += 5; if (f.ns) s += 3; s += Math.min(10, (f.compl || 0) * 10);
  if (f.src === 'custom' || f.src === 'recipe') s += 30;
  const rc = S.recents.findIndex(r => r.id === f.id); if (rc >= 0) s += 30 - rc * 0.5;
  if (S.favorites[f.id]) s += 25;
  return s - Math.max(0, name.length - 40) * 0.3;
}
const rank = (list, q) => list.map(f => [scoreFood(f, q), f]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
function localSearch(q) {
  const nq = norm(q).split(/\s+/).filter(Boolean);
  const pool = dedupe([...Object.values(S.recipes).map(recipeFood), ...Object.values(S.foods), ...Object.values(S.products), ...S.recents, ...BASE_FOODS].filter(Boolean));   // recents: everything you logged is searchable offline
  return rank(pool.filter(f => nq.every(w => norm(f.name + ' ' + (f.brand || '') + ' ' + (f.cat || '')).includes(w))), q).slice(0, 40);
}
function recipeFood(r) {
  if (!r) return null;
  const tot = Object.fromEntries(NKEYS.map(k => [k, 0])); let g = 0;
  for (const it of r.items) { const n = nutr(it.food, it.g); for (const k in tot) tot[k] += n[k]; g += it.g; }
  const per100 = {}; for (const k in tot) per100[k] = g ? r1(tot[k] / g * 100) : 0;
  const portions = r.portions || 1;
  return { id: r.id, src: 'recipe', name: r.name, cat: 'Gericht', brand: t('{n} Zutaten · {k} kcal/Portion', { n: r.items.length, k: de(tot.kcal / portions) }), n: per100, serving: { g: g / portions, label: 'Portion' } };
}
function pushScan(code) { S.scanHistory = [{ code, t: Date.now() }, ...S.scanHistory.filter(h => h.code !== code)].slice(0, 100); save(); }

// ---------- Export ----------
const csv = rows => '﻿' + rows.map(r => r.map(x => { const s = String(x ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\n');
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
