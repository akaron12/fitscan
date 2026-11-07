'use strict';
/* Pure merge logic for one day (no I/O, no globals except DayFile). Plain script: globalThis.DayMerge.
   Rules (spec-meal-tracker.md, D7/D15/D19):
   - Entries are matched by id. An id-less remote entry is matched to a local entry on (meal, food, qty) before a new one is created.
   - "Missing never means deleted": only an explicit tombstone (deleted: true) deletes.
   - A 3-way merge against the content we last synced ("base") decides who changed what.
   - An edit made outside the app (same rev as at last sync) can never overwrite or delete an entry the user marked eaten;
     it is recorded as a suggestion instead.
   - If both sides changed the same entry since the last sync, this device wins and the other version is kept as a suggestion,
     so nothing is silently lost. */
(function (root) {
  const r1 = x => Math.round((+x || 0) * 10) / 10;
  const OPTIONAL = ['fiber', 'sugar', 'salt', 'nutriscore', 'nova', 'barcode', 'source', 'note'];

  /** Content fingerprint of a file-form entry (ignores id and rev). */
  function canon(fe) {
    const o = { meal: fe.meal, status: fe.status, food: String(fe.food || '').trim(), qty_g: r1(fe.qty_g), kcal: Math.round(+fe.kcal || 0), p: r1(fe.p), c: r1(fe.c), f: r1(fe.f) };
    for (const k of OPTIONAL) if (fe[k] != null && fe[k] !== '') o[k] = ['fiber', 'sugar', 'salt'].includes(k) ? r1(fe[k]) : fe[k];
    if (fe.x && Object.keys(fe.x).length) o.x = Object.keys(fe.x).sort().map(k => [k, fe.x[k]]);
    return JSON.stringify(o);
  }
  const keyOf = fe => [fe.meal, String(fe.food || '').trim().toLowerCase(), r1(fe.qty_g)].join('|');
  const fileOf = l => DayFile.fromApp(l);
  const tombFile = (id, t) => ({ id, meal: t.meal || 'snacks', status: 'eaten', deleted: true, rev: t.rev || 1 });

  /** Keep the local food snapshot (images, micronutrients…) when the remote entry is the same food. */
  function adoptRemote(l, r) {
    const a = DayFile.toApp(r);
    if (l && String(l.food?.name).toLowerCase() === String(r.food).toLowerCase()) {
      a.food = { ...l.food, n: a.food.n }; if (Math.abs((+l.g || 0) - r.qty_g) < 0.05) { a.label = l.label; if (l.unit) a.unit = l.unit; if (l.qty != null) a.qty = l.qty; }
    }
    return a;
  }

  /**
   * @param {object} p { date, local: appEntry[], localTombs: {id:{rev,at,meal}}, remote: parsed DayFile model | null,
   *                     base: {entries:{id:{canon,rev}}, tombs:{id:rev}} | null, uid, now }
   * `remote` is modified (ids are assigned on its entries); pass a freshly parsed model.
   * @returns {entries, tombs, items, localChanged, remoteNeedsUpdate, suggestions}
   */
  function mergeDay({ date, local, localTombs = {}, remote, base, uid, now = Date.now() }) {
    const B = base?.entries || {}, BT = base?.tombs || {}, hasBase = id => Object.prototype.hasOwnProperty.call(B, id);
    const rItems = remote ? remote.items : [], rEntries = rItems.filter(it => it.kind === 'entry').map(it => it.entry);
    const suggestions = [], suggest = (id, kind, remoteEntry, reason) => suggestions.push({ date, id, kind, remote: remoteEntry ? { ...remoteEntry } : null, reason, at: now });

    const original = rEntries.map(e => ({ ...e }));   // as read, before ids are assigned (to know whether Drive needs a write)
    // 1. give id-less remote entries an id (matching an existing local entry when it is clearly the same one)
    const used = new Set(rEntries.filter(e => e.id).map(e => e.id)), claimed = new Set();
    for (const fe of rEntries) if (!fe.id) {
      const hit = local.find(l => !used.has(l.id) && !claimed.has(l.id) && keyOf(fileOf(l)) === keyOf(fe));
      fe.id = hit ? hit.id : uid(); if (hit) claimed.add(hit.id); used.add(fe.id);
    }
    const L = new Map(local.map(e => [e.id, e])), R = new Map(), RT = new Map();
    for (const fe of rEntries) (fe.deleted ? RT : R).set(fe.id, fe);
    const ids = [...new Set([...L.keys(), ...R.keys(), ...RT.keys(), ...Object.keys(localTombs)])];

    const outApp = new Map(), outFile = new Map(), outTomb = {};
    const keepLocal = (id, rev) => { const l = L.get(id); if (rev != null) l.rev = rev; outApp.set(id, l); outFile.set(id, null); };   // file-form filled in step 3
    for (const id of ids) {
      const l = L.get(id), r = R.get(id), rt = RT.get(id), lt = localTombs[id], b = B[id];
      const lc = l ? canon(fileOf(l)) : null, rc = r ? canon(r) : null;
      if (l && r) {
        if (lc === rc) { l.rev = Math.max(l.rev || 1, r.rev || 1); outApp.set(id, l); outFile.set(id, r); continue; }
        const lChanged = !b || b.canon !== lc, rChanged = !b || b.canon !== rc;
        const external = !!b && rChanged && (r.rev || 1) <= b.rev;   // edited outside the app: the app always bumps rev
        if (rChanged && !lChanged) {
          if (l.status === 'eaten' && external) { suggest(id, 'change', r, 'Planned change to an entry you already ate'); keepLocal(id, Math.max(l.rev || 1, r.rev || 1) + 1); }
          else { const a = adoptRemote(l, r); a.id = id; a.rev = Math.max(l.rev || 1, r.rev || 1); outApp.set(id, a); outFile.set(id, r); }
        } else if (lChanged && !rChanged) keepLocal(id);
        else { suggest(id, 'conflict', r, 'Changed here and in Drive since the last sync; this device\'s version was kept'); keepLocal(id, Math.max(l.rev || 1, r.rev || 1) + 1); }
      } else if (l && !r) {
        if (rt) {
          const external = hasBase(id) && (rt.rev || 1) <= B[id].rev;
          if (hasBase(id) && b.canon === lc) {
            if (l.status === 'eaten' && external) { suggest(id, 'delete', null, 'Deletion of an entry you already ate'); keepLocal(id, Math.max(l.rev || 1, rt.rev || 1) + 1); }
            else outTomb[id] = { rev: rt.rev || 1, at: now, meal: rt.meal };   // deleted elsewhere, unchanged here: delete here too
          } else keepLocal(id, Math.max(l.rev || 1, rt.rev || 1) + 1);       // edited here: the edit beats the deletion
        } else keepLocal(id);                                                  // new here, or the remote file simply omits it
      } else if (!l && r) {
        if (lt) {
          if (hasBase(id) && b.canon !== rc) suggest(id, 'change', r, 'Changed in Drive after you deleted it here');
          outTomb[id] = { rev: Math.max(lt.rev || 1, r.rev || 1) + 1, at: lt.at || now, meal: lt.meal || r.meal };   // deleted here: delete wins
        } else { const a = adoptRemote(null, r); a.id = id; outApp.set(id, a); outFile.set(id, r); }                 // new from Drive (e.g. planned by Claude)
      } else {   // tombstones only
        if (lt && rt) outTomb[id] = { rev: Math.max(lt.rev || 1, rt.rev || 1), at: lt.at || now, meal: lt.meal || rt.meal };
        else if (rt) outTomb[id] = { rev: rt.rev || 1, at: now, meal: rt.meal };
        else if (lt && (hasBase(id) || BT[id] != null)) outTomb[id] = { ...lt };      // was synced before: tell Drive it is gone
        // a local tombstone for something that never reached Drive is dropped
      }
    }

    // 2. final file-form for every surviving entry (local wins keep remote's unknown keys)
    for (const [id, a] of outApp) if (outFile.get(id) == null) {
      const fe = fileOf(a), r = R.get(id); if (r?.x) fe.x = { ...r.x, ...(fe.x || {}) };
      outFile.set(id, { ...fe, id });
    }
    // 3. assemble the remote items: keep remote order and raw items, append new entries
    const items = [], placed = new Set();
    for (const it of rItems) {
      if (it.kind === 'raw') { items.push(it); continue; }
      const id = it.entry.id; placed.add(id);
      if (outTomb[id]) items.push({ kind: 'entry', entry: tombFile(id, outTomb[id]) });
      else if (outFile.get(id)) items.push({ kind: 'entry', entry: outFile.get(id) });
      else if (RT.has(id)) items.push(it);
    }
    for (const [id, fe] of outFile) if (!placed.has(id) && !outTomb[id]) { items.push({ kind: 'entry', entry: fe }); placed.add(id); }
    for (const [id, t] of Object.entries(outTomb)) if (!placed.has(id)) { items.push({ kind: 'entry', entry: tombFile(id, t) }); placed.add(id); }

    const entries = [...outApp.values()];
    const stable = o => Array.isArray(o) ? o.map(stable) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => [k, stable(o[k])])) : o;
    const sig = list => JSON.stringify(list.map(stable));   // key order must not matter (a rewritten file would otherwise look "changed" forever)
    const remoteNeedsUpdate = sig(items.filter(i => i.kind === 'entry').map(i => i.entry)) !== sig(original) || (!remote && items.length > 0);
    const localChanged = entries.length !== local.length || entries.some(e => !L.has(e.id) || L.get(e.id) !== e)
      || Object.keys(outTomb).length !== Object.keys(localTombs).length || Object.keys(outTomb).some(id => !localTombs[id] || localTombs[id].rev !== outTomb[id].rev);
    return { entries, tombs: outTomb, items, localChanged, remoteNeedsUpdate, suggestions };
  }

  /** Snapshot of what both sides now agree on, to use as the base of the next merge. */
  function makeBase(items) {
    const base = { entries: {}, tombs: {} };
    for (const it of items) if (it.kind === 'entry' && it.entry.id) { const e = it.entry; if (e.deleted) base.tombs[e.id] = e.rev || 1; else base.entries[e.id] = { canon: canon(e), rev: e.rev || 1 }; }
    return base;
  }

  /** Merge several parsed copies of the same day (duplicate files) into one model (the first is the base). */
  function unionModels(models, uid) {
    const acc = models[0];
    for (const m of models.slice(1)) {
      const have = new Map(parseEntries(acc).filter(e => e.id).map(e => [e.id, e]));
      for (const it of m.items) {
        if (it.kind === 'raw') { acc.items.push(it); continue; }
        const e = it.entry, mine = e.id && have.get(e.id);
        if (mine) {
          const win = (e.rev || 1) > (mine.rev || 1) || ((e.rev || 1) === (mine.rev || 1) && e.status === 'eaten' && mine.status !== 'eaten');
          if (win && !(mine.status === 'eaten' && e.status === 'planned')) { Object.keys(mine).forEach(k => delete mine[k]); Object.assign(mine, e); }
        } else if (!e.id) {
          const twin = parseEntries(acc).find(x => !x.deleted && !e.deleted && keyOf(x) === keyOf(e));
          if (!twin) { acc.items.push(it); }
        } else { acc.items.push(it); have.set(e.id, e); }
      }
      for (const w of m.warnings) acc.warnings.push(w);
    }
    return acc;
  }
  const parseEntries = m => m.items.filter(it => it.kind === 'entry').map(it => it.entry);

  root.DayMerge = { mergeDay, makeBase, unionModels, canon, keyOf };
})(typeof globalThis !== 'undefined' ? globalThis : this);
