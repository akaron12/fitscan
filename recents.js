'use strict';
/* Recents: the unique foods logged within a window of days (default 30), newest first, each with the date it was last logged,
   the amount of that log and how often it was logged. Pure functions on plain data (no DOM, no storage), so tests can run them.
   A recent is a food snapshot plus:  last 'YYYY-MM-DD' · lastG grams · lastU unit ('g'|'ml'|'serv'|'pc') · lastQ quantity in that unit · uses (>= 1).
   The list is always kept sorted by `last`, newest first. Plain script: globalThis.Recents (works in the browser and in jsc). */
(function (root) {
  const DAYS = [7, 14, 30, 60, 90], DEFAULT_DAYS = 30, MAX = 300, UNITS = ['g', 'ml', 'serv', 'pc'];
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const shift = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  /** A food is kept while its last log is on or after this date: with 30 days, 29 days ago is in, 31 days ago is out. */
  const cutoff = (today, days) => shift(today, -(DAYS.includes(+days) ? +days : DEFAULT_DAYS));
  const goodNum = (v, max) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max;
  const amount = (g, unit, qty) => {
    const o = {}; if (goodNum(+g, 2e4)) o.lastG = +g; if (UNITS.includes(unit) && goodNum(+qty, 1e4)) { o.lastU = unit; o.lastQ = +qty; } return o;
  };
  const byLast = (a, b) => a.last < b.last ? 1 : a.last > b.last ? -1 : 0;

  /** Drop what fell out of the window, and anything beyond the safety ceiling (the oldest go first). */
  function prune(list, today, days) {
    const c = cutoff(today, days);
    return list.filter(r => r.last >= c).slice(0, MAX);
  }

  /** Clean a stored list: one entry per food id, a valid `last` (today when missing), `uses` a whole number >= 1, amount fields valid or gone. Keeps the order, then sorts by `last` (stable). */
  function normalize(list, today) {
    const seen = new Set(), out = [];
    for (const r of list) {
      if (!r || typeof r !== 'object' || r.id == null || seen.has(r.id)) continue; seen.add(r.id);
      const { lastG, lastU, lastQ, ...rest } = r;
      out.push({ ...rest, last: DATE.test(r.last) ? (r.last > today ? today : r.last) : today, uses: Math.max(1, Math.floor(+r.uses) || 1), ...amount(lastG, lastU, lastQ) });
    }
    return out.map((r, i) => [r, i]).sort((a, b) => byLast(a[0], b[0]) || a[1] - b[1]).map(x => x[0]);
  }

  /** A food was logged for `date`: it moves to its place at the top, its use count goes up, and the amount becomes the one just used
   *  (unless it was logged for an earlier day than the last log: then only the count changes). Returns a new list. */
  function touch(list, snap, { date, today, days, g, unit, qty }) {
    const d = date > today ? today : date;
    if (!DATE.test(d) || d < cutoff(today, days)) return list;
    const old = list.find(x => x.id === snap.id), newer = !old || d >= old.last;
    const lastOf = o => amount(o.lastG, o.lastU, o.lastQ);
    const r = { ...snap, last: newer ? d : old.last, uses: (old?.uses || 0) + 1, ...(newer ? amount(g, unit, qty) : lastOf(old)) };
    const rest = list.filter(x => x.id !== snap.id), i = rest.findIndex(x => x.last <= r.last);
    rest.splice(i < 0 ? rest.length : i, 0, r);
    return prune(rest, today, days);
  }

  /** The list to show: inside the window, and either newest first ('recent') or most logged first ('used', ties: newest first). */
  function view(list, today, days, sort) {
    const l = prune(list, today, days);
    return sort === 'used' ? l.map((r, i) => [r, i]).sort((a, b) => (b[0].uses || 1) - (a[0].uses || 1) || a[1] - b[1]).map(x => x[0]) : l;
  }

  /** One-time upgrade from the old list (a count cap of 40, no dates): dates, amounts and use counts come from the diary, and foods eaten in
   *  the window that fell off the old list are added back. Old items the diary knows nothing about count as used today, so nothing vanishes on upgrade. */
  function migrate(list, entries, today, days) {
    const cut = cutoff(today, days), seen = new Map(); let seq = 0;
    for (const dk of Object.keys(entries || {}).sort()) {
      if (!DATE.test(dk) || dk < cut || !Array.isArray(entries[dk])) continue;
      for (const e of entries[dk]) {
        const f = e && e.food; if (!f || f.id == null || !f.n || e.status === 'planned' || f.src === 'quick' || f.src === 'pending') continue;
        seen.set(f.id, { food: f, last: dk > today ? today : dk, uses: (seen.get(f.id)?.uses || 0) + 1, a: amount(e.g, e.unit, e.qty), seq: ++seq });
      }
    }
    const out = [], used = new Set();
    list.forEach((r, i) => {
      used.add(r.id); const m = seen.get(r.id);
      out.push(m ? { ...r, last: m.last, uses: m.uses, ...m.a, _s: m.seq } : { ...r, last: DATE.test(r.last) ? r.last : today, _s: 1e9 - i });
    });
    for (const [id, m] of seen) if (!used.has(id)) out.push({ ...m.food, last: m.last, uses: m.uses, ...m.a, _s: m.seq });
    out.sort((a, b) => byLast(a, b) || b._s - a._s);
    return out.map(({ _s, ...r }) => r);
  }

  root.Recents = { DAYS, DEFAULT_DAYS, MAX, UNITS, cutoff, prune, normalize, touch, view, migrate, amount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
