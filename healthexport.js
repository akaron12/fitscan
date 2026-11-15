'use strict';
/* Send a meal's eaten totals to Apple Health through Adam's iPhone shortcut "Log Meal".
   The shortcut takes JSON text {"calories","protein","carbs","fat"} (lowercase keys, whole-meal totals) and logs
   Dietary Energy, Protein, Carbohydrates and Total Fat with the current time. A web app cannot write to Health itself.
   Which entries were already sent is kept per device in S.hk = { 'YYYY-MM-DD': [entry ids] }: it is not synced,
   because only the phone that ran the shortcut knows. An entry edited after sending is not sent again (Health has no undo here).
   Plain script: globalThis.HealthExport (works in the browser and in jsc for tests). */
(function (root) {
  const SHORTCUT = 'Log Meal', KEEP_DAYS = 60;
  const r1 = x => Math.round((+x || 0) * 10) / 10;
  /** Eaten entries of one meal that this device has not sent yet. Planned entries never count. */
  const unsent = (entries, meal, sentIds) => {
    const done = new Set(sentIds || []);
    return (entries || []).filter(e => e && e.meal === meal && e.status !== 'planned' && !done.has(e.id));
  };
  /** Whole-meal totals. nutrOf(entry) -> { kcal, p, c, f } for the entry's amount. */
  const totals = (list, nutrOf) => {
    const o = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const e of list) { const n = nutrOf(e) || {}; o.calories += +n.kcal || 0; o.protein += +n.p || 0; o.carbs += +n.c || 0; o.fat += +n.f || 0; }
    for (const k in o) o[k] = r1(o[k]);
    return o;
  };
  const url = tot => 'shortcuts://run-shortcut?name=' + encodeURIComponent(SHORTCUT) + '&input=text&text=' + encodeURIComponent(JSON.stringify(tot));
  /** Only on iPhone/iPad: the shortcut's Health actions do not exist on a Mac. */
  const supported = ua => /iPhone|iPad|iPod/.test(ua || '');
  /** Clean S.hk: keep only arrays of ids for real dates within the last KEEP_DAYS days (todayStr 'YYYY-MM-DD'). */
  const prune = (hk, todayStr) => {
    const out = {}; if (!hk || typeof hk !== 'object') return out;
    const cut = new Date(todayStr + 'T12:00:00Z'); cut.setUTCDate(cut.getUTCDate() - KEEP_DAYS);
    const cutStr = cut.toISOString().slice(0, 10);
    for (const [d, ids] of Object.entries(hk)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= cutStr && Array.isArray(ids)) out[d] = ids.filter(x => typeof x === 'string');
    return out;
  };
  root.HealthExport = { SHORTCUT, unsent, totals, url, supported, prune };
})(globalThis);
