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

  // ---------- library: custom foods + favorites (settings.md) ----------
  // Items are matched by id. The higher rev wins; equal revs with different content are decided by the content itself (the same
  // answer on every device, so they converge). Deleting leaves a tombstone with rev = last rev + 1; an item only survives a tombstone
  // if its rev is higher. Anything unreadable in the file is rejected as a whole (readLibrary) so we never write over hand edits we could not read.
  const LIB_ID = /^[A-Za-z0-9:_.-]{1,80}$/, NK = ['kcal', 'p', 'c', 'f', 'fib', 'sug', 'salt'];
  const stableJson = o => JSON.stringify(Array.isArray(o) ? o.map(stableObj) : stableObj(o));
  const stableObj = o => o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.keys(o).sort().map(k => [k, stableObj(o[k])])) : Array.isArray(o) ? o.map(stableObj) : o;
  const libCanon = f => { const { rev, ...rest } = f; return stableJson(rest); };

  /** A food from outside (the file) or from local storage, reduced to known fields. strict: reject wrong types instead of coercing. */
  function cleanFood(o, strict) {
    const bad = m => { throw new Error(m); };
    if (!o || typeof o !== 'object' || Array.isArray(o)) bad('not an object');
    if (typeof o.id !== 'string' || !LIB_ID.test(o.id)) bad('id missing or has unusual characters');
    if (typeof o.name !== 'string' || !o.name.trim()) bad('name missing');
    const str = (k, max) => { const v = o[k]; if (v == null || v === '') return ''; if (typeof v !== 'string') { if (strict) bad(k + ' must be text'); return ''; } return v.slice(0, max); };
    const num = (v, max, what) => { if (v == null) return 0; if (typeof v !== 'number' || !Number.isFinite(v)) { if (strict) bad(what + ' must be a number'); return 0; } return r1(Math.min(max, Math.max(0, v))); };
    let src = o.src == null ? 'custom' : o.src; if (typeof src !== 'string' || !/^[a-z]{1,12}$/.test(src)) { if (strict) bad('src invalid'); src = 'custom'; }
    const n0 = o.n && typeof o.n === 'object' && !Array.isArray(o.n) ? o.n : (strict ? bad('n (nutrition per 100 g) missing') : {});
    const f = { id: o.id, name: o.name.trim().slice(0, 200), brand: str('brand', 200), img: str('img', 500), cat: str('cat', 60), src, code: str('code', 40), quantity: str('quantity', 60),
      n: Object.fromEntries(NK.map(k => [k, num(n0[k], k === 'kcal' ? 20000 : 5000, 'n.' + k)])) };
    if (o.serving != null) {
      const s = o.serving; if (typeof s !== 'object' || Array.isArray(s)) { if (strict) bad('serving must be an object'); f.serving = null; }
      else { const g = num(s.g, 5000, 'serving.g'); if (!(g > 0)) { if (strict) bad('serving.g must be greater than 0'); f.serving = null; } else f.serving = { g, label: typeof s.label === 'string' ? s.label.slice(0, 100) : '' }; }
    } else f.serving = null;
    if (o.micro && typeof o.micro === 'object' && !Array.isArray(o.micro)) {
      const mic = {}; for (const [k, v] of Object.entries(o.micro).slice(0, 40)) { if (/^[a-z0-9-]{1,40}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) mic[k] = v; else if (strict) bad('micro.' + k + ' invalid'); }
      if (Object.keys(mic).length) f.micro = mic;
    } else if (o.micro != null && strict) bad('micro must be an object');
    if (o.ns != null) { if (typeof o.ns === 'string' && /^[a-e]$/.test(o.ns)) f.ns = o.ns; else if (strict) bad('ns must be a-e'); }
    if (o.nova != null) { if (Number.isInteger(o.nova) && o.nova >= 1 && o.nova <= 4) f.nova = o.nova; else if (strict) bad('nova must be 1-4'); }
    if (o.rev != null && !(Number.isInteger(o.rev) && o.rev >= 1)) { if (strict) bad('rev must be a whole number >= 1'); }
    f.rev = Number.isInteger(o.rev) && o.rev >= 1 ? o.rev : 1;
    return f;
  }

  // ---------- recents (settings.md): the foods logged within the window ----------
  // Matched by food id. The newer `last` wins (the same food, logged on two devices: whichever was logged later supplies the amount and the
  // snapshot); `uses` takes the larger count (counts from two devices cannot be added without counting twice). Nothing is ever deleted because
  // it is missing from the other side: only the window removes a food. The window itself is a setting {days, rev}: the higher rev wins.
  const REC_DATE = /^\d{4}-\d{2}-\d{2}$/, REC_DAYS = [7, 14, 30, 60, 90], REC_MAX = 300;
  function cleanRecent(o, strict) {
    const bad = m => { throw new Error(m); };
    const { rev, ...f } = cleanFood({ ...o, rev: undefined }, strict);
    if (typeof o.last !== 'string' || !REC_DATE.test(o.last)) bad('last must be a date (YYYY-MM-DD)');
    f.last = o.last;
    const good = (v, max) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max;
    if (o.uses != null && !(Number.isInteger(o.uses) && o.uses >= 1)) { if (strict) bad('uses must be a whole number >= 1'); }
    f.uses = Number.isInteger(o.uses) && o.uses >= 1 ? o.uses : 1;
    if (o.lastG != null) { if (good(o.lastG, 2e4)) f.lastG = r1(o.lastG); else if (strict) bad('lastG must be a number greater than 0'); }
    if (o.lastU != null || o.lastQ != null) {
      if (['g', 'ml', 'serv', 'pc'].includes(o.lastU) && good(o.lastQ, 1e4)) { f.lastU = o.lastU; f.lastQ = o.lastQ; } else if (strict) bad('lastU/lastQ invalid');
    }
    return f;
  }
  const recDays = d => d && typeof d === 'object' && REC_DAYS.includes(d.days) && Number.isInteger(d.rev) && d.rev >= 0 ? { days: d.days, rev: d.rev } : null;

  /** @param {object[]} Lraw local recents (newest first)  @param {object[]} R recents read from the file (strict-clean)  @param {string} cutoff oldest `last` still kept */
  function mergeRecents(Lraw, R, cutoff) {
    const L = new Map(), unsyncable = [];
    Lraw.forEach((raw, i) => { try { const c = cleanRecent(raw, false); if (!L.has(c.id)) L.set(c.id, { raw, c, i }); else unsyncable.push(raw); } catch { unsyncable.push(raw); } });
    const Rm = new Map(R.map((c, i) => [c.id, { c, i }])), items = [];
    for (const id of new Set([...L.keys(), ...Rm.keys()])) {
      const l = L.get(id), r = Rm.get(id);
      let from = l ? 'l' : 'r';
      if (l && r) from = l.c.last > r.c.last ? 'l' : l.c.last < r.c.last ? 'r' : (stableJson(l.c) >= stableJson(r.c) ? 'l' : 'r');
      const clean = { ...(from === 'l' ? l.c : r.c), uses: Math.max(l?.c.uses || 0, r?.c.uses || 0) };
      if (clean.last < cutoff) continue;
      items.push({ clean, local: from === 'l' ? { ...l.raw, ...clean } : { ...clean }, ord: l ? l.i : 1e6 + r.i });
    }
    const dateDesc = (a, b) => a.clean.last < b.clean.last ? 1 : a.clean.last > b.clean.last ? -1 : 0;
    const mine = items.slice().sort((a, b) => dateDesc(a, b) || a.ord - b.ord).slice(0, REC_MAX);
    const file = items.slice().sort((a, b) => dateDesc(a, b) || (a.clean.id < b.clean.id ? -1 : 1)).slice(0, REC_MAX).map(x => x.clean);   // same order on every device
    const before = [...L.values()].sort((a, b) => a.i - b.i).map(x => stableJson(x.c)), after = mine.map(x => stableJson(x.clean));
    return { local: [...mine.map(x => x.local), ...unsyncable.filter(u => !(typeof u?.last === 'string') || u.last >= cutoff)], file,
      localChanged: JSON.stringify(before) !== JSON.stringify(after),
      remoteNeedsUpdate: JSON.stringify(file.map(stableJson)) !== JSON.stringify(R.map(stableJson)) };
  }
  /** The window setting: higher rev wins; the same rev with different days is decided by the larger number (same answer everywhere). */
  function mergeRecentsDays(local, remote) {
    const l = recDays(local) || { days: 30, rev: 0 }, r = recDays(remote);
    let w = l; if (r && (r.rev > l.rev || (r.rev === l.rev && r.days > l.days))) w = r;
    return { days: w.days, rev: w.rev, localChanged: w.days !== l.days || w.rev !== l.rev, remoteNeedsUpdate: w.rev > 0 && (!r || r.days !== w.days || r.rev !== w.rev) };
  }

  /** Strictly parse the app-data JSON of settings.md. Returns {foods, favs, tombs} or {error}. */
  function readLibrary(data) {
    const out = { foods: {}, favs: {}, tombs: { foods: {}, favs: {} }, recents: [], days: null };
    if (data == null) return out;
    if (typeof data !== 'object' || Array.isArray(data)) return { error: 'app data must be an object' };
    const parts = [['customFoods', 'foods'], ['favorites', 'favs']];
    try {
      for (const [key, dst] of parts) {
        const arr = data[key]; if (arr == null) continue; if (!Array.isArray(arr)) throw new Error(key + ' must be a list');
        arr.forEach((it, i) => { try { const f = cleanFood(it, true); if (out[dst][f.id]) throw new Error('duplicate id ' + f.id); out[dst][f.id] = f; } catch (e) { throw new Error(`${key}[${i}]: ${e.message}`); } });
      }
      if (data.recents != null) {
        if (!Array.isArray(data.recents)) throw new Error('recents must be a list');
        const ids = new Set();
        data.recents.forEach((it, i) => { try { const f = cleanRecent(it, true); if (ids.has(f.id)) throw new Error('duplicate id ' + f.id); ids.add(f.id); out.recents.push(f); } catch (e) { throw new Error(`recents[${i}]: ${e.message}`); } });
      }
      if (data.recentsDays != null) { out.days = recDays(data.recentsDays); if (!out.days) throw new Error('recentsDays must be {days: 7|14|30|60|90, rev: whole number}'); }
      if (data.deleted != null) {
        if (typeof data.deleted !== 'object' || Array.isArray(data.deleted)) throw new Error('deleted must be an object');
        for (const [key, dst] of parts) { const m = data.deleted[key]; if (m == null) continue; if (typeof m !== 'object' || Array.isArray(m)) throw new Error(`deleted.${key} must be an object`);
          for (const [id, rev] of Object.entries(m)) { if (!LIB_ID.test(id) || !Number.isInteger(rev) || rev < 1) throw new Error(`deleted.${key}.${id} is invalid`); out.tombs[dst][id] = rev; } }
      }
    } catch (e) { return { error: e.message }; }
    return out;
  }

  function mergeColl(Lraw, LT, R, RT, now) {
    const L = {}; for (const [id, raw] of Object.entries(Lraw)) { try { L[id] = { raw, clean: cleanFood({ ...raw, id: raw.id || id }, false) }; } catch { /* cannot be synced: stays local, untouched */ } }
    const newLocal = { ...Lraw }, file = {}, tombs = {}, ids = new Set([...Object.keys(L), ...Object.keys(R), ...Object.keys(LT), ...Object.keys(RT)]);
    for (const id of ids) {
      const l = L[id]?.clean, r = R[id], T = Math.max(LT[id]?.rev || 0, RT[id] || 0);
      let from = null;
      if (l && r) from = l.rev > r.rev ? 'l' : l.rev < r.rev ? 'r' : (libCanon(l) >= libCanon(r) ? 'l' : 'r'); else if (l) from = 'l'; else if (r) from = 'r';
      const w = from === 'l' ? l : from === 'r' ? r : null;
      if (w && w.rev > T) {
        file[id] = w;
        if (from === 'r') newLocal[id] = { ...r };
        else if (L[id].raw.rev !== w.rev) L[id].raw.rev = w.rev;           // legacy items get a rev so later edits count
      } else { tombs[id] = { rev: T, at: LT[id]?.at || now }; if (newLocal[id] && L[id]) delete newLocal[id]; else if (newLocal[id] && !L[id]) { /* unsyncable local item: keep */ } }
    }
    const sameKeys = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => k in b); };
    const localChanged = !sameKeys(newLocal, Lraw) || Object.keys(newLocal).some(id => newLocal[id] !== Lraw[id]) || !sameKeys(tombs, LT) || Object.keys(tombs).some(id => tombs[id].rev !== LT[id].rev);
    const remoteTombs = Object.fromEntries(Object.entries(tombs).map(([id, t]) => [id, t.rev]));
    const remoteNeedsUpdate = !sameKeys(file, R) || Object.keys(file).some(id => stableJson(file[id]) !== stableJson(R[id])) || !sameKeys(remoteTombs, RT) || Object.keys(remoteTombs).some(id => remoteTombs[id] !== RT[id]);
    return { local: newLocal, file, tombs, localChanged, remoteNeedsUpdate };
  }

  /** @param {object} p { local:{foods,favs}, localTombs:{foods,favs}, remote:{foods,favs,tombs} (from readLibrary), now } */
  function mergeLibrary({ local, localTombs = {}, remote, now = Date.now(), today = null }) {
    const a = mergeColl(local.foods || {}, localTombs.foods || {}, remote.foods, remote.tombs.foods, now);
    const b = mergeColl(local.favs || {}, localTombs.favs || {}, remote.favs, remote.tombs.favs, now);
    // recents: only when the caller says what day it is (the window needs it)
    let rc = null;
    if (today) {
      const dm = mergeRecentsDays(local.days, remote.days), cut = Recents.cutoff(today, dm.days);
      rc = { dm, ...mergeRecents(local.recents || [], remote.recents || [], cut) };
    }
    const list = m => Object.keys(m).sort().map(id => m[id]), revs = t => Object.fromEntries(Object.keys(t).sort().map(id => [id, t[id].rev]));
    return { foods: a.local, favs: b.local, tombs: { foods: a.tombs, favs: b.tombs }, localChanged: a.localChanged || b.localChanged || !!(rc && (rc.localChanged || rc.dm.localChanged)),
      remoteNeedsUpdate: a.remoteNeedsUpdate || b.remoteNeedsUpdate || !!(rc && (rc.remoteNeedsUpdate || rc.dm.remoteNeedsUpdate)),
      recents: rc ? rc.local : local.recents, days: rc ? { days: rc.dm.days, rev: rc.dm.rev } : local.days,
      fileData: { customFoods: list(a.file), favorites: list(b.file), ...(rc && rc.file.length ? { recents: rc.file } : {}), ...(rc && rc.dm.rev > 0 ? { recentsDays: { days: rc.dm.days, rev: rc.dm.rev } } : {}),
        deleted: { customFoods: revs(a.tombs), favorites: revs(b.tombs) } } };
  }
  /** Fingerprint of the local library, to tell whether anything changed since the last sync. */
  function libSig({ foods = {}, favs = {}, tombs = {}, recents = [], days = null }) {
    const part = m => Object.keys(m).sort().map(id => { try { const c = cleanFood({ ...m[id], id: m[id].id || id }, false); return [id, c.rev, libCanon(c)]; } catch { return [id, 0, '']; } });
    const tb = t => Object.keys(t || {}).sort().map(id => [id, t[id].rev]);
    const rec = recents.map(r => { try { return stableJson(cleanRecent(r, false)); } catch { return null; } }).filter(Boolean);
    return stableJson({ f: part(foods), v: part(favs), tf: tb(tombs.foods), tv: tb(tombs.favs), ...(rec.length ? { r: rec } : {}), ...(days && days.rev > 0 ? { d: [days.days, days.rev] } : {}) });
  }

  root.DayMerge = { mergeDay, makeBase, unionModels, canon, keyOf, cleanFood, readLibrary, mergeLibrary, libSig, mergeRecents, mergeRecentsDays, cleanRecent };
})(typeof globalThis !== 'undefined' ? globalThis : this);
