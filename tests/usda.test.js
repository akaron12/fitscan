'use strict';
/* Run with tests/run.sh (usda.js first). */
let passed = 0, failed = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) passed++; else { failed++; print('FAIL: ' + msg + '\n   got:      ' + A + '\n   expected: ' + B); } };
const ok = (c, msg) => eq(!!c, true, msg);
const N = (id, value) => ({ nutrientId: id, nutrientName: 'x', unitName: 'G', value });

// SR Legacy style item (energy 1008)
const chicken = { fdcId: 171077, description: 'Chicken, broilers or fryers,  breast, meat only, cooked, roasted', dataType: 'SR Legacy', foodNutrients: [N(1008, 165), N(1003, 31.02), N(1004, 3.57), N(1005, 0), N(1079, 0), N(1093, 74)] };
let f = USDA.parse(chicken);
eq([f.id, f.src, f.name], ['usda:171077', 'usda', 'Chicken, broilers or fryers, breast, meat only, cooked, roasted'], 'id, source and tidied name');
eq(f.n, { kcal: 165, p: 31, c: 0, f: 3.6, sug: 0, fib: 0, salt: 0.2 }, 'nutrition per 100 g (salt = sodium mg / 1000 x 2.5)');
eq(f.usda, { fdcId: 171077, dataType: 'SR Legacy' }, 'provenance kept');

// Foundation item: energy only as Atwater 2048, nutrients in the nested form
f = USDA.parse({ fdcId: 1, description: 'Egg, whole, raw', dataType: 'Foundation', foodNutrients: [{ nutrient: { id: 2048 }, amount: 143 }, { nutrient: { id: 1003 }, amount: 12.4 }, { nutrient: { id: 1004 }, amount: 9.96 }, { nutrient: { id: 1005 }, amount: 0.96 }, N(2000, 0.2)] });
eq([f.n.kcal, f.n.p, f.n.f, f.n.sug], [143, 12.4, 10, 0.2], 'Atwater energy and nested nutrient form accepted');
// energy missing: computed from macros 4/4/9
f = USDA.parse({ fdcId: 2, description: 'Mystery', foodNutrients: [N(1003, 10), N(1005, 20), N(1004, 5)] }); eq(f.n.kcal, 165, 'kcal computed from macros when missing');
// unusable items
eq(USDA.parse({ fdcId: 3, description: 'No nutrients', foodNutrients: [] }), null, 'no nutrition => dropped'); eq(USDA.parse({ description: 'No id' }), null, 'no id => dropped'); eq(USDA.parse(null), null, 'null');
ok(USDA.urlFor('chicken breast', 'KEY123').includes('api_key=KEY123') && USDA.urlFor('chicken breast', 'K').includes('query=chicken%20breast') && USDA.urlFor('x', 'K').includes('dataType=Foundation%2CSR%20Legacy%2CSurvey%20(FNDDS)'), 'url built and escaped');

const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const run = async () => {
  let called = null; const good = async (url, o) => { called = url; return resp(200, { foods: [chicken, chicken, { fdcId: 9, description: 'junk' }] }); };
  let r = await USDA.search('chicken', null, { key: 'K', fetch: good }); eq(r.length, 1, 'duplicates and unusable hits removed'); ok(called.includes('query=chicken'), 'query sent');
  const kind = async (deps, k, msg) => { try { await USDA.search('x', null, deps); failed++; print('FAIL: ' + msg + ' (no error)'); } catch (e) { eq(e.kind, k, msg); } };
  await kind({ key: '', fetch: good }, 'nokey', 'no key');
  await kind({ key: 'K', fetch: async () => resp(429, {}) }, 'rate', '429 => rate');
  await kind({ key: 'K', fetch: async () => resp(403, {}) }, 'key', '403 => key'); await kind({ key: 'K', fetch: async () => resp(400, {}) }, 'key', '400 => key');
  await kind({ key: 'K', fetch: async () => resp(500, {}) }, 'http', '500 => http'); await kind({ key: 'K', fetch: async () => { throw new TypeError('Failed to fetch'); } }, 'network', 'offline => network');
  try { await USDA.search('x', null, { key: 'K', fetch: async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; } }); failed++; } catch (e) { eq(e.name, 'AbortError', 'abort passes through untouched'); }
  eq(USDA.getKey(), '', 'no key without localStorage');
};
let done = false; run().then(() => { done = true; }).catch(e => { failed++; print('FAIL: threw ' + e); done = true; });
drainMicrotasks();
if (!done) throw new Error('async tests did not finish');
print(`\n${passed} passed, ${failed} failed`);
if (failed) throw new Error(failed + ' check(s) failed');
