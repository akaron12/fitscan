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
const DEFAULT = () => ({ goals: { kcal: 2200, p: 140, c: 240, f: 75, manual: false }, entries: {},
  foods: {}, products: {}, recipes: {}, recents: [], favorites: {}, scanHistory: [],
  settings: { theme: 'light', lang: null } });
// Data removed from the app (weight, water, fasting, profile, check-ins) is dropped on load.
const REMOVED_KEYS = ['profile', 'weights', 'water', 'measures', 'checkins', 'fast', 'fastLog'];
function sanitize(o) {
  const d = DEFAULT(); if (!isObj(o)) o = {};
  const s = Object.assign(d, o);
  for (const k of REMOVED_KEYS) delete s[k];
  for (const k of ['goals', 'entries', 'foods', 'products', 'recipes', 'favorites', 'settings']) if (!isObj(s[k])) s[k] = DEFAULT()[k];
  for (const k of ['recents', 'scanHistory']) if (!Array.isArray(s[k])) s[k] = [];
  for (const k of ['kcal', 'p', 'c', 'f']) s.goals[k] = Number.isFinite(+s.goals[k]) ? +s.goals[k] : DEFAULT().goals[k];
  for (const [dk, es] of Object.entries(s.entries)) { if (!Array.isArray(es)) { delete s.entries[dk]; continue; } s.entries[dk] = es.filter(e => isObj(e) && isObj(e.food) && isObj(e.food.n) && Number.isFinite(+e.g)); }
  s.recents = s.recents.filter(f => isObj(f) && isObj(f.n));
  const st = s.settings;
  for (const k of ['waterGoal', 'glass', 'fastTarget', 'showWater', 'showFasting', 'onboarded', 'planStart']) delete st[k];
  st.continuousScan ??= false; st.beep ??= true;
  // v6: new light design – earlier versions defaulted to dark, so switch everyone to light once.
  if (st.ui !== 6) { st.theme = 'light'; st.ui = 6; }
  if (!['light', 'dark', 'system'].includes(st.theme)) st.theme = 'light';
  s.version = 4;
  return s;
}
function load() { try { return sanitize(JSON.parse(localStorage.getItem(KEY))); } catch { return DEFAULT(); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast(t('Speicher voll – bitte Backup exportieren')); } }
let S = load();

// ---------- Nutrition ----------
const NKEYS = ['kcal', 'p', 'c', 'f', 'fib', 'sug', 'salt'];
const nutr = (food, g) => { const k = (+g || 0) / 100, n = food?.n || {}, o = {}; for (const key of NKEYS) o[key] = (+n[key] || 0) * k; return o; };
function dayTotals(date) {
  const tot = Object.fromEntries(NKEYS.map(k => [k, 0]));
  for (const e of S.entries[date] || []) { const n = nutr(e.food, e.g); for (const k in tot) tot[k] += n[k]; }
  return tot;
}
const isLogged = d => (S.entries[d] || []).length > 0;
function streak() { let n = 0, d = today(); if (!isLogged(d)) d = addDays(d, -1); while (isLogged(d)) { n++; d = addDays(d, -1); } return n; }
function mealDefault() { const h = new Date().getHours(); return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks'; }

function addEntry(food, g, label, meal, date = ui.date, extra = {}) {
  const snap = { id: food.id, name: food.name, brand: food.brand || '', img: food.img || '', cat: food.cat || '', n: food.n, serving: food.serving || null, src: food.src, code: food.code || '' };
  if (food.micro) snap.micro = food.micro; if (food.ns) snap.ns = food.ns; if (food.nova) snap.nova = food.nova;
  const e = { id: uid(), meal, g, label, food: snap, ...extra };
  (S.entries[date] ||= []).push(e);
  if (food.src !== 'quick') S.recents = [snap, ...S.recents.filter(x => x.id !== snap.id)].slice(0, 40);
  save(); return e;
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
const OFF_FIELDS = 'code,product_name,product_name_de,generic_name_de,brands,image_front_small_url,image_front_url,nutriments,serving_size,serving_quantity,quantity,countries_tags,nutriscore_grade,nova_group,completeness';
function parseOFF(p, code) {
  if (!p) return null;
  const nm = p.nutriments || {}, n = k => { const x = parseFloat(nm[k]); return isFinite(x) ? x : 0; };
  let kcal = n('energy-kcal_100g'); if (!kcal && n('energy_100g')) kcal = n('energy_100g') / 4.184;
  const name = p.product_name_de || p.product_name || p.generic_name_de || 'Unbenanntes Produkt', sq = parseFloat(p.serving_quantity);
  const brand = Array.isArray(p.brands) ? p.brands.join(', ') : (p.brands || '');
  const f = { id: 'off:' + (p.code || code), src: 'off', code: p.code || code, name: name.trim(), brand: brand.split(',').slice(0, 2).join(', ').trim(), img: p.image_front_small_url || p.image_front_url || '',
    cat: '', quantity: p.quantity || '', n: { kcal: r1(kcal), p: n('proteins_100g'), c: n('carbohydrates_100g'), f: n('fat_100g'), sug: n('sugars_100g'), fib: n('fiber_100g'), salt: n('salt_100g') },
    serving: sq > 0 ? { g: sq, label: p.serving_size ? 'Portion: ' + String(p.serving_size).replace(/^1 (portion|serving)\s*/i, '').replace(/^\((.*)\)$/, '$1') : 'Portion' } : null,
    hasNutr: !!(kcal || nm.proteins_100g != null) };
  const mic = {}; for (const [k] of MICROS) { const v = parseFloat(nm[k + '_100g']); if (isFinite(v) && v > 0) mic[k] = v; }
  if (Object.keys(mic).length) f.micro = mic;
  if (/^[a-e]$/.test(p.nutriscore_grade || '')) f.ns = p.nutriscore_grade;
  if (p.nova_group) f.nova = +p.nova_group;
  f.de = Array.isArray(p.countries_tags) && p.countries_tags.includes('en:germany');
  f.compl = +p.completeness || 0;
  return f;
}
async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, '');
  const custom = Object.values(S.foods).find(f => f.code === code); if (custom) return { product: custom, cached: true };
  if (S.products[code]) return { product: S.products[code], cached: true };
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}&lc=de`, { headers: { Accept: 'application/json' } });
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
  const sal = async extra => { const r = await fetch(`https://search.openfoodfacts.org/search?q=${qs}${extra}&langs=de,en&page_size=30${F}`, { signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return (await r.json()).hits || []; };
  const cgi = async () => { const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${qs}&search_simple=1&json=1&page_size=30&countries_tags_en=germany&lc=de${F}`, { signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return (await r.json()).products || []; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const tries = [async () => { let h = await sal('%20countries_tags:%22en:germany%22'); if (h.length < 5) h = h.concat(await sal('')); return h; }, cgi,
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
  if (f.de) s += 20;
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
  const pool = dedupe([...Object.values(S.recipes).map(recipeFood), ...Object.values(S.foods), ...Object.values(S.products), ...BASE_FOODS].filter(Boolean));
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
