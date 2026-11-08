'use strict';
/* USDA FoodData Central search for generic (non-barcoded) foods: Foundation, SR Legacy and Survey (FNDDS) data, all per 100 g.
   The API key is the user's own free key. It lives in its own localStorage entry (not in the app data), so it is never part of
   a backup export and never synced to Drive. USDA data is public domain; the food id keeps the provenance ("usda:<fdcId>").
   Plain script: globalThis.USDA (works in the browser and in jsc for tests). */
(function (root) {
  const KEY_STORE = 'fitscan.usdaKey';
  const API = 'https://api.nal.usda.gov/fdc/v1/foods/search';
  const TYPES = 'Foundation,SR Legacy,Survey (FNDDS)';
  const round1 = x => Math.round((+x || 0) * 10) / 10;

  /** A key never contains whitespace. .trim() misses invisible characters that a phone paste can bring (zero-width space, word joiner, BOM), so strip them all, anywhere in the key. */
  const cleanKey = k => String(k == null ? '' : k).replace(/[\s\u200B-\u200D\u2060\uFEFF]/g, '');
  const getKey = () => { try { return cleanKey(localStorage.getItem(KEY_STORE)); } catch { return ''; } };
  const setKey = k => { try { const c = cleanKey(k); c ? localStorage.setItem(KEY_STORE, c) : localStorage.removeItem(KEY_STORE); } catch {} };

  /** One search hit -> app food (per 100 g), or null if it has no usable nutrition. */
  function parse(item) {
    if (!item || !item.fdcId || !item.description) return null;
    const by = {};
    for (const x of item.foodNutrients || []) { const id = x.nutrientId ?? x.nutrient?.id, v = x.value ?? x.amount; if (id != null && v != null && Number.isFinite(+v)) by[id] = +v; }
    const pick = ids => { for (const id of ids) if (by[id] != null) return by[id]; return null; };
    const p = pick([1003]), c = pick([1005]), f = pick([1004]);
    let kcal = pick([1008, 2047, 2048]);                               // Foundation foods report Atwater energy (2047/2048) instead of 1008
    if (kcal == null && p == null && c == null && f == null) return null;
    if (kcal == null) kcal = 4 * (p || 0) + 4 * (c || 0) + 9 * (f || 0);
    const na = pick([1093]);                                            // sodium in mg; salt = sodium x 2.5
    return { id: 'usda:' + item.fdcId, src: 'usda', code: '', name: String(item.description).replace(/\s+/g, ' ').trim(), brand: '', img: '', cat: 'USDA', quantity: '',
      n: { kcal: round1(kcal), p: round1(p), c: round1(c), f: round1(f), sug: round1(pick([2000, 1063])), fib: round1(pick([1079])), salt: round1(na != null ? na / 1000 * 2.5 : 0) },
      serving: null, hasNutr: true, de: false, compl: 0.8, usda: { fdcId: item.fdcId, dataType: item.dataType || '' } };
  }
  const urlFor = (q, key, pageSize = 25) => `${API}?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&pageSize=${pageSize}&dataType=${encodeURIComponent(TYPES)}`;

  /** kind: nokey | key (invalid or forbidden) | rate | network | http */
  const err = (kind, message) => Object.assign(new Error(message), { kind });
  /** Raw (unranked) search results. deps: { fetch, key } are injectable for tests. */
  async function search(q, signal, deps = {}) {
    const key = deps.key !== undefined ? deps.key : getKey(), doFetch = deps.fetch || ((...a) => fetch(...a));
    if (!key) throw err('nokey', 'No USDA API key set');
    let res;
    try { res = await doFetch(urlFor(q, key), { signal }); }
    catch (e) { if (e && e.name === 'AbortError') throw e; throw err('network', 'USDA is not reachable'); }
    if (res.status === 429) throw err('rate', 'USDA rate limit reached (about 1,000 searches per hour per key)');
    if (res.status === 401 || res.status === 403) throw err('key', 'USDA rejected the API key');
    if (!res.ok) throw err('http', 'USDA error ' + res.status);
    const j = await res.json(), seen = new Set(), out = [];
    for (const it of j.foods || []) { const f = parse(it); if (f && !seen.has(f.id)) { seen.add(f.id); out.push(f); } }
    return out;
  }
  root.USDA = { getKey, setKey, cleanKey, parse, search, urlFor, KEY_STORE };
})(typeof globalThis !== 'undefined' ? globalThis : this);
