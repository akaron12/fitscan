'use strict';
/* Sync engine tests: simulated devices + a simulated Claude editing files in a fake Drive.
   Run with tests/run.sh (loads dayfile, merge, driveclient, sync, fake-drive first). */
let passed = 0, failed = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) passed++; else { failed++; print('FAIL: ' + msg + '\n   got:      ' + A + '\n   expected: ' + B); } };
const ok = (c, msg) => eq(!!c, true, msg);
const TODAY = '2026-11-07', YEST = '2026-11-06';
const WRITE = c => (c.method === 'POST' || c.method === 'PATCH') && c.path.startsWith('/upload');
const fe = (o = {}) => ({ meal: 'lunch', status: 'planned', food: 'Rice', qty_g: 100, kcal: 130, p: 3, c: 28, f: 0.3, ...o });

function device(d, { name = 'dev', spec = null } = {}) {
  const S = { entries: {}, tombstones: {}, goals: { kcal: 2200, p: 140, c: 240, f: 75, manual: false }, foods: {}, favorites: {}, libTombs: { foods: {}, favs: {} } };
  let k = 0; const dev = { S, persists: 0, token: null, uid: () => name + (++k) };   // dev.token overrides the token this device sends (to simulate expiry)
  const drive = DriveClient.create({ fetch: d.fetch, getToken: () => dev.token || d.token, sleep: async () => {}, store: DriveClient.memStore() }); dev.drive = drive;
  dev.eng = Sync.create({ drive, getS: () => S, persist: () => { dev.persists++; }, uid: dev.uid, today: () => TODAY, specText: spec });
  return dev;
}
const entriesOf = (dev, date) => dev.S.entries[date] || [];
const eat = (dev, date, o = {}) => { const e = DayFile.toApp(fe({ status: 'eaten', ...o })); e.id = dev.uid(); e.rev = 1; (dev.S.entries[date] ||= []).push(e); return e; };
const setEntry = (dev, date, id, patch) => { const arr = dev.S.entries[date], i = arr.findIndex(e => e.id === id), cur = DayFile.fromApp(arr[i]); const n = DayFile.toApp({ ...cur, ...patch }); n.id = id; n.rev = arr[i].rev + 1; arr[i] = n; return n; };
const del = (dev, date, id) => { const arr = dev.S.entries[date], i = arr.findIndex(e => e.id === id), e = arr[i]; arr.splice(i, 1); (dev.S.tombstones[date] ||= {})[id] = { rev: e.rev + 1, at: 1, meal: e.meal }; };
const remoteFile = (d, date) => [...d.files.values()].find(f => f.name === date + '.md' && !f.trashed);
const remoteModel = (d, date) => { const f = remoteFile(d, date); return f ? DayFile.parse(f.content) : null; };
const remoteEntries = (d, date) => { const m = remoteModel(d, date); return m ? DayFile.parse.entries(m) : []; };
const mealFolder = d => [...d.files.values()].find(f => f.name === 'Meal Tracker');
/** Simulates Claude (or a hand edit): writes the whole file, like the Drive connector does. */
const claudeWrites = (d, date, text) => { const f = remoteFile(d, date); if (f) { f.content = text; f.modifiedTime = new Date(Date.parse(f.modifiedTime) + 3600e3).toISOString(); } else d.add(date + '.md', { parents: [mealFolder(d).id], content: text }); };
const setup = () => { const d = FakeDrive(); d.folder('AI Memory'); return d; };

const tests = [], test = (n, f) => tests.push([n, f]);

test('first sync with nothing anywhere: creates the folder, no day files, marks the device as synced', async () => {
  const d = setup(), a = device(d); const r = await a.eng.syncNow({ visibleDate: TODAY });
  ok(r.ok, 'ok'); ok(mealFolder(d), 'Meal Tracker created'); eq(d.count(WRITE), 0, 'nothing written'); ok(a.S.sync.synced, 'marked as synced'); eq(a.eng.status().state, 'idle', 'idle');
});
test('a local eaten entry is pushed once, then the next sync is quiet', async () => {
  const d = setup(), a = device(d), e = eat(a, TODAY, { food: 'Oats', qty_g: 60, kcal: 228 });
  eq(a.eng.pendingDays(), [TODAY], 'pending before sync'); const r = await a.eng.syncNow(); ok(r.ok && r.pushed === 1, 'pushed one day');
  const re = remoteEntries(d, TODAY); eq([re.length, re[0].id, re[0].status, re[0].food, re[0].kcal], [1, e.id, 'eaten', 'Oats', 228], 'file content');
  eq(a.eng.pendingDays(), [], 'nothing pending after'); const w = d.count(WRITE); await a.eng.syncNow(); eq(d.count(WRITE), w, 'second sync writes nothing');
});
test('Claude plans a meal (no id): it shows up planned, the id is written back, then it is quiet', async () => {
  const d = setup(), a = device(d); await a.eng.syncNow();
  claudeWrites(d, TODAY, '---\ndate: 2026-11-07\nformat: meal-log/1\n---\nPlan by Claude\n\n```yaml\nentries:\n  - meal: dinner\n    status: planned\n    food: Salmon\n    qty_g: 150\n    kcal: 312\n    p: 33\n    c: 0\n    f: 19\n```\n');
  const r = await a.eng.syncNow(); ok(r.ok, 'ok'); const l = entriesOf(a, TODAY); eq([l.length, l[0].status, l[0].food.name, l[0].g], [1, 'planned', 'Salmon', 150], 'planned entry imported');
  const re = remoteEntries(d, TODAY); eq(re[0].id, l[0].id, 'id written back to the file'); ok(remoteFile(d, TODAY).content.includes('Plan by Claude'), 'Claude\'s notes kept');
  const w = d.count(WRITE); await a.eng.syncNow(); eq(d.count(WRITE), w, 'quiet afterwards'); eq(a.eng.status().pending, 0, 'nothing pending');
});
test('after a storage wipe: pull-only hydrate, nothing is written, old days outside 90 days are not fetched', async () => {
  const d = setup(), a = device(d); eat(a, TODAY, { food: 'A' }); eat(a, YEST, { food: 'B' }); eat(a, '2026-10-01', { food: 'C' }); eat(a, '2025-01-01', { food: 'Ancient' });
  a.S.sync = { synced: true, lastSync: 1, days: {}, suggestions: [] }; await a.eng.syncNow({ visibleDate: '2025-01-01' }); const writesBefore = d.count(WRITE);
  const b = device(d, { name: 'fresh' }); const r = await b.eng.syncNow({ visibleDate: TODAY }); ok(r.ok, 'ok');
  eq(d.count(WRITE), writesBefore, 'hydrate wrote nothing'); eq(entriesOf(b, TODAY).length + entriesOf(b, YEST).length + entriesOf(b, '2026-10-01').length, 3, 'recent days restored'); eq(entriesOf(b, '2025-01-01').length, 0, 'ancient day not pulled');
  ok(b.S.sync.synced, 'marker set after the pull');
});
test('first sync with existing local data and a different remote day: nothing is lost either way', async () => {
  const d = setup(), a = device(d); await a.eng.syncNow(); claudeWrites(d, TODAY, DayFile.serialize(DayFile.create(TODAY, [fe({ id: 'r1', food: 'Remote' })])));
  const b = device(d, { name: 'b' }); eat(b, TODAY, { food: 'Local' }); await b.eng.syncNow({ visibleDate: TODAY });
  eq(entriesOf(b, TODAY).map(e => e.food.name).sort(), ['Local', 'Remote'], 'both on the device'); eq(remoteEntries(d, TODAY).map(e => e.food).sort(), ['Local', 'Remote'], 'both on Drive');
});
test('Claude plans ahead: the next 7 days are pulled automatically, later days only when opened', async () => {
  const d = setup(), a = device(d); await a.eng.syncNow();
  claudeWrites(d, '2026-11-08', DayFile.serialize(DayFile.create('2026-11-08', [fe({ food: 'Tomorrow' })])));
  claudeWrites(d, '2026-11-14', DayFile.serialize(DayFile.create('2026-11-14', [fe({ food: 'In a week' })])));
  claudeWrites(d, '2026-11-15', DayFile.serialize(DayFile.create('2026-11-15', [fe({ food: 'Too far' })])));
  await a.eng.syncNow();
  eq([entriesOf(a, '2026-11-08').length, entriesOf(a, '2026-11-14').length, entriesOf(a, '2026-11-15').length], [1, 1, 0], 'window is today + 7 days');
  await a.eng.syncNow({ visibleDate: '2026-11-15' }); eq(entriesOf(a, '2026-11-15').length, 1, 'opening a later day fetches it');
});
test('EATEN PROTECTION end to end: Claude re-plans an entry you already ate', async () => {
  const d = setup(), a = device(d), e = eat(a, TODAY, { food: 'Lunch bowl', qty_g: 300, kcal: 450 }); await a.eng.syncNow();
  const m = remoteModel(d, TODAY); const re = DayFile.parse.entries(m)[0]; re.status = 'planned'; re.qty_g = 500; re.kcal = 750; claudeWrites(d, TODAY, DayFile.serialize(m));
  await a.eng.syncNow(); const l = entriesOf(a, TODAY)[0];
  eq([l.status, l.g], ['eaten', 300], 'still eaten, same amount'); eq(remoteEntries(d, TODAY)[0].status, 'eaten', 'Drive corrected'); eq(a.S.sync.suggestions.length, 1, 'kept as a suggestion'); eq(a.S.sync.suggestions[0].remote.qty_g, 500, 'suggestion holds Claude\'s version');
  await a.eng.syncNow(); eq(a.S.sync.suggestions.length, 1, 'no duplicate suggestions');
});
test('STALE OVERWRITE: Claude writes back an old copy that lacks entries you added and confirmed', async () => {
  const d = setup(), a = device(d); eat(a, TODAY, { food: 'One' }); await a.eng.syncNow(); const stale = remoteFile(d, TODAY).content;
  eat(a, TODAY, { food: 'Two', meal: 'dinner' }); setEntry(a, TODAY, entriesOf(a, TODAY)[0].id, { qty_g: 120, kcal: 156 }); await a.eng.syncNow();
  claudeWrites(d, TODAY, stale); await a.eng.syncNow();
  eq(entriesOf(a, TODAY).map(e => e.food.name).sort(), ['One', 'Two'], 'nothing lost locally'); eq(remoteEntries(d, TODAY).map(e => e.food).sort(), ['One', 'Two'], 'Drive repaired'); eq(entriesOf(a, TODAY).find(e => e.food.name === 'One').g, 120, 'latest edit survives');
});
test('local edit and a different Claude edit are both kept', async () => {
  const d = setup(), a = device(d); const e1 = eat(a, TODAY, { food: 'A' }), e2 = eat(a, TODAY, { food: 'B', status: 'planned' }); await a.eng.syncNow();
  const m = remoteModel(d, TODAY), pe = DayFile.parse.entries(m).find(x => x.food === 'B'); pe.qty_g = 250; pe.kcal = 325; claudeWrites(d, TODAY, DayFile.serialize(m));
  setEntry(a, TODAY, e1.id, { qty_g: 140, kcal: 182 }); await a.eng.syncNow();
  eq([entriesOf(a, TODAY).find(e => e.food.name === 'A').g, entriesOf(a, TODAY).find(e => e.food.name === 'B').g], [140, 250], 'local and remote edits merged'); eq(remoteEntries(d, TODAY).map(e => e.qty_g).sort(), [140, 250], 'Drive has both');
});
test('two devices stay in step: add, edit, delete', async () => {
  const d = setup(), a = device(d, { name: 'A' }), b = device(d, { name: 'B' }); const e = eat(a, TODAY, { food: 'Shared' }); await a.eng.syncNow(); await b.eng.syncNow({ visibleDate: TODAY });
  eq(entriesOf(b, TODAY).map(x => x.food.name), ['Shared'], 'B received it'); setEntry(b, TODAY, e.id, { qty_g: 90, kcal: 117 }); await b.eng.syncNow(); await a.eng.syncNow(); eq(entriesOf(a, TODAY)[0].g, 90, 'A received the edit');
  del(a, TODAY, e.id); await a.eng.syncNow(); const m = remoteEntries(d, TODAY)[0]; eq([m.deleted, m.id], [true, e.id], 'tombstone in the file'); await b.eng.syncNow(); eq(entriesOf(b, TODAY).length, 0, 'B applied the deletion'); eq(Object.keys(b.S.tombstones[TODAY] || {}), [e.id], 'B remembers the tombstone');
  const w = d.count(WRITE); await a.eng.syncNow(); await b.eng.syncNow(); eq(d.count(WRITE), w, 'settled: no more writes');
});
test('a write that races with another writer is retried and nothing is lost', async () => {
  const d = setup(), a = device(d); eat(a, TODAY, { food: 'Mine' }); await a.eng.syncNow(); setEntry(a, TODAY, entriesOf(a, TODAY)[0].id, { qty_g: 110, kcal: 143 });
  let injected = false; d.beforeRequest = async ({ method, path, query }) => { if (!injected && method === 'GET' && path.startsWith('/drive/v3/files/') && /fields=/.test(query) && !/alt=media/.test(query)) { injected = true; const f = remoteFile(d, TODAY), m = DayFile.parse(f.content); m.items.push({ kind: 'entry', entry: fe({ id: 'late', food: 'Late from Claude' }) }); f.content = DayFile.serialize(m); f.modifiedTime = '2030-01-01T00:00:00.000Z'; } };
  const r = await a.eng.syncNow(); d.beforeRequest = null; ok(r.ok, 'ok after retry'); ok(injected, 'race was simulated');
  eq(remoteEntries(d, TODAY).map(e => e.food).sort(), ['Late from Claude', 'Mine'], 'both survive on Drive'); eq(entriesOf(a, TODAY).map(e => e.food.name).sort(), ['Late from Claude', 'Mine'], 'both locally');
});
test('a day in a newer format is never written and is reported; other days still sync', async () => {
  const d = setup(), a = device(d); eat(a, TODAY, { food: 'A' }); eat(a, YEST, { food: 'B' }); await a.eng.syncNow();
  const f = remoteFile(d, TODAY); f.content = f.content.replace('meal-log/1', 'meal-log/9'); f.modifiedTime = '2030-01-01T00:00:00.000Z'; const before = f.content;
  eat(a, TODAY, { food: 'New', meal: 'dinner' }); eat(a, YEST, { food: 'New2', meal: 'dinner' }); const r = await a.eng.syncNow();
  ok(r.ok, 'sync completes'); eq(remoteFile(d, TODAY).content, before, 'newer-format file untouched'); ok(a.eng.status().blocked[TODAY], 'blocked day reported'); eq(remoteEntries(d, YEST).length, 2, 'other day synced');
  eq(a.eng.pendingDays(), [], 'blocked day is not counted as waiting');
});
test('unreadable entries in a day file survive a sync untouched', async () => {
  const d = setup(), a = device(d); await a.eng.syncNow();
  claudeWrites(d, TODAY, '---\ndate: 2026-11-07\nformat: meal-log/1\n---\n```yaml\nentries:\n  - meal: lunch\n    status: planned\n    food: Soup: tomato\n    qty_g: 200\n    kcal: 90\n  - id: ok1\n    meal: dinner\n    status: planned\n    food: Fine\n    qty_g: 100\n    kcal: 100\n```\n');
  await a.eng.syncNow(); eat(a, TODAY, { food: 'Mine', meal: 'snacks' }); await a.eng.syncNow(); const c = remoteFile(d, TODAY).content;
  ok(c.includes('    food: Soup: tomato'), 'raw entry intact'); eq(entriesOf(a, TODAY).map(e => e.food.name).sort(), ['Fine', 'Mine'], 'readable entries synced');
});
test('offline: the app keeps working, shows what is pending, and catches up later', async () => {
  const d = setup(), a = device(d); await a.eng.syncNow(); eat(a, TODAY, { food: 'Plane snack' }); d.networkDown = true;
  let r = await a.eng.syncNow(); eq([r.ok, r.kind, a.eng.status().state, a.eng.status().pending], [false, 'network', 'offline', 1], 'offline state with one pending change'); eq(entriesOf(a, TODAY).length, 1, 'local data intact');
  d.networkDown = false; r = await a.eng.syncNow(); ok(r.ok, 'ok when back'); eq(remoteEntries(d, TODAY).length, 1, 'pushed'); eq(a.eng.status().pending, 0, 'nothing pending');
});
test('expired sign-in: state "auth", pending count stays, flushes after signing in again', async () => {
  const d = setup(), a = device(d); await a.eng.syncNow(); eat(a, TODAY, { food: 'X' }); a.token = 'expired';
  let r = await a.eng.syncNow(); eq([r.ok, a.eng.status().state, a.eng.status().pending], [false, 'auth', 1], 'auth state'); a.token = null; r = await a.eng.syncNow(); ok(r.ok, 'ok after sign-in'); eq(a.eng.status().pending, 0, 'flushed');
});
test('duplicate day files (two devices created it at once) are merged into one', async () => {
  const d = setup(), a = device(d); await a.eng.syncNow(); const mt = mealFolder(d).id;
  d.add(TODAY + '.md', { parents: [mt], content: DayFile.serialize(DayFile.create(TODAY, [fe({ id: 'x1', food: 'FromPhone' })])) });
  d.add(TODAY + '.md', { parents: [mt], content: DayFile.serialize(DayFile.create(TODAY, [fe({ id: 'x2', food: 'FromMac' })])) });
  const r = await a.eng.syncNow(); ok(r.ok, 'ok'); eq([...d.files.values()].filter(f => f.name === TODAY + '.md' && !f.trashed).length, 1, 'one live file'); eq(entriesOf(a, TODAY).map(e => e.food.name).sort(), ['FromMac', 'FromPhone'], 'both entries kept');
  ok(a.eng.status().warnings.some(w => /merged/.test(w)), 'user is told');
});
test('goals: pushed to settings.md, adopted by another device, hand edits adopted, defaults never pushed', async () => {
  const d = setup(), a = device(d, { name: 'A' }), b = device(d, { name: 'B' }); await a.eng.syncNow(); ok(![...d.files.values()].some(f => f.name === 'settings.md'), 'defaults are not pushed');
  a.S.goals = { kcal: 2400, p: 160, c: 250, f: 80, manual: true, rev: 1 }; await a.eng.syncNow(); const f = [...d.files.values()].find(x => x.name === 'settings.md'); ok(f && /kcal: 2400/.test(f.content) && /rev: 1/.test(f.content), 'settings.md written');
  await b.eng.syncNow(); eq([b.S.goals.kcal, b.S.goals.p, b.S.goals.manual, b.S.goals.rev], [2400, 160, true, 1], 'B adopted the goals');
  f.content = f.content.replace('kcal: 2400', 'kcal: 2300'); f.modifiedTime = '2031-01-01T00:00:00.000Z'; await a.eng.syncNow(); eq(a.S.goals.kcal, 2300, 'hand edit in Drive adopted');
  b.S.goals = { ...b.S.goals, kcal: 2500, rev: 5 }; await b.eng.syncNow(); await a.eng.syncNow(); eq([a.S.goals.kcal, a.S.goals.rev], [2500, 5], 'higher rev wins');
});
test('settings.md: unknown content is preserved when goals change', async () => {
  const t = 'Notes by me\n\n```yaml\nextra: keepme\ngoals:\n  kcal: 2000\n  p: 100\n  c: 200\n  f: 60\n  rev: 2\n```\nTail text\n'; const m = Sync.parseSettings(t); eq([m.goals.kcal, m.goals.rev], [2000, 2], 'parsed');
  const out = Sync.serializeSettings(m, { kcal: 2100, p: 100, c: 200, f: 60, rev: 3 }); ok(out.includes('extra: keepme') && out.includes('Tail text') && out.includes('Notes by me') && out.includes('kcal: 2100') && out.includes('rev: 3'), 'other content kept, goals updated');
  eq(Sync.parseSettings('nothing here').goals, null, 'no block => no goals');
});
test('FORMAT.md is uploaded once', async () => {
  const d = setup(), a = device(d, { spec: async () => Sync.SPEC_MARKER + ' -->\nhello' }); await a.eng.syncNow(); await a.eng.syncNow(); const fs = [...d.files.values()].filter(f => f.name === 'FORMAT.md'); eq(fs.length, 1, 'one FORMAT.md'); ok(fs[0].content.includes('hello'), 'content');
});
test('overlapping syncNow calls collapse into at most one follow-up run', async () => {
  const d = setup(), a = device(d); eat(a, TODAY, { food: 'X' }); const ps = [a.eng.syncNow(), a.eng.syncNow(), a.eng.syncNow()]; const rs = await Promise.all(ps); ok(rs.every(r => r.ok), 'all ok'); eq(remoteEntries(d, TODAY).length, 1, 'one entry, no duplicates'); eq([...d.files.values()].filter(f => f.name === TODAY + '.md').length, 1, 'one file');
});
test('status listeners are notified', async () => {
  const d = setup(), a = device(d), seen = []; a.eng.onStatus(s => seen.push(s.state)); await a.eng.syncNow(); ok(seen.includes('syncing') && seen.at(-1) === 'idle', 'syncing then idle');
});

// ---------- custom foods + favorites (settings.md) ----------
const settingsFile = d => [...d.files.values()].find(f => f.name === 'settings.md' && !f.trashed);
const settingsData = d => Sync.parseSettings(settingsFile(d).content).data;
const mkFood = (id, o = {}) => ({ id, src: 'custom', name: id, brand: '', cat: 'Eigene', code: '', n: { kcal: 100, p: 1, c: 2, f: 3, fib: 0, sug: 0, salt: 0 }, serving: null, rev: 1, ...o });
/** what core.js does when a food is saved / deleted / favorited */
const addFood = (dev, id, o = {}) => { const old = dev.S.foods[id]; dev.S.foods[id] = mkFood(id, { ...o, rev: (old?.rev || 0) + 1 }); delete dev.S.libTombs.foods[id]; };
const delFood = (dev, id) => { const old = dev.S.foods[id]; dev.S.libTombs.foods[id] = { rev: old.rev + 1, at: 1 }; delete dev.S.foods[id]; };
const addFav = (dev, id, o = {}) => { const old = dev.S.favorites[id]; dev.S.favorites[id] = mkFood(id, { src: 'off', ...o, rev: (old?.rev || 0) + 1 }); delete dev.S.libTombs.favs[id]; };
const delFav = (dev, id) => { const old = dev.S.favorites[id]; dev.S.libTombs.favs[id] = { rev: old.rev + 1, at: 1 }; delete dev.S.favorites[id]; };

test('library: foods and favorites travel between two devices (add, edit, delete)', async () => {
  const d = setup(), a = device(d, { name: 'A' }), b = device(d, { name: 'B' });
  addFood(a, 'cust:bowl', { name: 'Bowl' }); addFav(a, 'off:123', { name: 'Oats' }); eq(a.eng.status().pending, 1, 'a waiting settings change is counted');
  await a.eng.syncNow(); eq(a.eng.status().pending, 0, 'pushed'); const dta = settingsData(d); eq([dta.customFoods.map(f => f.id), dta.favorites.map(f => f.id)], [['cust:bowl'], ['off:123']], 'both in settings.md');
  const r = await b.eng.syncNow(); eq([Object.keys(b.S.foods), Object.keys(b.S.favorites), r.library], [['cust:bowl'], ['off:123'], 'pulled'], 'B received them'); eq(b.eng.status().pending, 0, 'B has nothing waiting');
  addFood(b, 'cust:bowl', { name: 'Bowl XL' }); await b.eng.syncNow(); await a.eng.syncNow(); eq(a.S.foods['cust:bowl'].name, 'Bowl XL', 'A got the edit'); eq(a.S.foods['cust:bowl'].rev, 2, 'with its rev');
  delFood(a, 'cust:bowl'); delFav(a, 'off:123'); await a.eng.syncNow(); const dd = settingsData(d); eq([dd.customFoods.length, dd.favorites.length, dd.deleted.customFoods['cust:bowl'], dd.deleted.favorites['off:123']], [0, 0, 3, 2], 'tombstones in the file');
  await b.eng.syncNow(); eq([Object.keys(b.S.foods), Object.keys(b.S.favorites), Object.keys(b.S.libTombs.foods)], [[], [], ['cust:bowl']], 'B applied the deletions');
  const w = d.count(WRITE); await a.eng.syncNow(); await b.eng.syncNow(); eq(d.count(WRITE), w, 'settled: no more writes');
});
test('library: an edit made after another device deleted the food brings it back', async () => {
  const d = setup(), a = device(d, { name: 'A' }), b = device(d, { name: 'B' }); addFood(a, 'cust:x', { name: 'X' }); await a.eng.syncNow(); await b.eng.syncNow();
  delFood(a, 'cust:x'); await a.eng.syncNow();                                        // tombstone rev 2
  addFood(b, 'cust:x', { name: 'X edited' }); addFood(b, 'cust:x', { name: 'X edited twice' });   // B (offline) edits twice: rev 3
  await b.eng.syncNow(); eq(b.S.foods['cust:x'].name, 'X edited twice', 'B keeps its newer edit'); await a.eng.syncNow(); eq(a.S.foods['cust:x']?.name, 'X edited twice', 'and A gets the food back');
});
test('library: first sync on a fresh device pulls the library and writes nothing', async () => {
  const d = setup(), a = device(d, { name: 'A' }); addFood(a, 'cust:1'); addFav(a, 'off:9'); await a.eng.syncNow(); const w = d.count(WRITE);
  const b = device(d, { name: 'fresh' }); await b.eng.syncNow(); eq(d.count(WRITE), w, 'hydrate wrote nothing'); eq([Object.keys(b.S.foods), Object.keys(b.S.favorites)], [['cust:1'], ['off:9']], 'library restored');
});
test('library: goals-only file stays free of an app-data block; foods added later extend it; text around the blocks is kept', async () => {
  const d = setup(), a = device(d); a.S.goals = { kcal: 2400, p: 160, c: 250, f: 80, manual: true, rev: 1 }; await a.eng.syncNow(); ok(!/```json/.test(settingsFile(d).content), 'no json block without a library');
  const f = settingsFile(d); f.content = f.content.replace('# Meal Tracker settings', '# My own heading\nHand-written note.'); f.modifiedTime = '2031-01-01T00:00:00.000Z';
  addFood(a, 'cust:y', { name: 'Y' }); await a.eng.syncNow(); const c = settingsFile(d).content; ok(/```json/.test(c) && c.includes('"cust:y"'), 'json block added'); ok(c.includes('Hand-written note.') && c.includes('# My own heading') && /kcal: 2400/.test(c), 'goals and hand-written text survive');
  ok(c.includes('## Custom foods and favorites'), 'a heading explains the block');
});
test('library: an unreadable app-data block is never overwritten (goals still sync, days still sync, user is told)', async () => {
  const d = setup(), a = device(d); a.S.goals = { kcal: 2400, p: 160, c: 250, f: 80, manual: true, rev: 1 }; addFood(a, 'cust:z', { name: 'Z' }); await a.eng.syncNow();
  const f = settingsFile(d); f.content = f.content.replace(/```json[\s\S]*?```/, '```json\n{ "customFoods": [ { "id": "ok", "name": "Hand edit", "n": { "kcal": "lots" } } ] }\n```'); f.modifiedTime = '2031-01-01T00:00:00.000Z'; const broken = f.content.match(/```json[\s\S]*?```/)[0];
  a.S.goals = { ...a.S.goals, kcal: 2500, rev: 2 }; addFood(a, 'cust:w', { name: 'W' }); eat(a, TODAY, { food: 'Day entry' }); const r = await a.eng.syncNow();
  ok(r.ok, 'sync completes'); eq(r.library, 'unreadable', 'reported unreadable'); ok(settingsFile(d).content.includes(broken), 'the unreadable block is byte-for-byte intact'); ok(/kcal: 2500/.test(settingsFile(d).content), 'goals were still written');
  ok(a.eng.status().blocked['settings.md'] && a.eng.status().warnings.some(w => /not synced/.test(w)), 'user is told'); eq(remoteEntries(d, TODAY).length, 1, 'days sync normally'); eq(a.eng.status().pending, 0, 'blocked library is not counted as waiting');
  eq(Object.keys(a.S.foods).sort(), ['cust:w', 'cust:z'], 'local foods untouched');
});
test('library: hostile items in the file block the library instead of entering the app', async () => {
  const d = setup(), a = device(d); await a.eng.syncNow(); const mt = mealFolder(d).id;
  d.add('settings.md', { parents: [mt], content: '---\nformat: meal-settings/1\n---\n```json\n{ "customFoods": [ { "id": "<img src=x onerror=alert(1)>", "name": "Evil", "n": { "kcal": 1 } } ] }\n```\n' });
  const r = await a.eng.syncNow(); eq([r.library, Object.keys(a.S.foods)], ['unreadable', []], 'rejected as a whole');
  const hostile = '```json\n{ "customFoods": [ { "id": "ok1", "name": "<script>alert(1)</script>", "img": "javascript:alert(1)", "evil": "dropped", "n": { "kcal": 50, "p": 1 } } ] }\n```'; const f = settingsFile(d); f.content = '---\nformat: meal-settings/1\n---\n' + hostile + '\n'; f.modifiedTime = '2032-01-01T00:00:00.000Z';
  await a.eng.syncNow(); const got = a.S.foods.ok1; eq([got.name, 'evil' in got, got.rev], ['<script>alert(1)</script>', false, 1], 'text stays text, unknown keys are dropped');
});
test('library: a write that races with another writer is retried and both changes survive', async () => {
  const d = setup(), a = device(d, { name: 'A' }), b = device(d, { name: 'B' }); addFood(a, 'cust:a1'); await a.eng.syncNow(); await b.eng.syncNow();
  addFood(a, 'cust:a2'); let injected = false;
  d.beforeRequest = async ({ method, path, query }) => { if (!injected && method === 'GET' && path.startsWith('/drive/v3/files/') && /fields=/.test(query) && !/alt=media/.test(query)) { const f = settingsFile(d); if (f) { injected = true; const data = Sync.parseSettings(f.content).data; data.favorites.push(mkFood('off:from-b', { src: 'off', rev: 1 })); f.content = Sync.serializeSettings(Sync.parseSettings(f.content), null, data).replace(/^/, ''); f.modifiedTime = '2030-01-01T00:00:00.000Z'; } } };
  const r = await a.eng.syncNow(); d.beforeRequest = null; ok(r.ok && injected, 'ok after retry'); const dta = settingsData(d); eq([dta.customFoods.map(f => f.id), dta.favorites.map(f => f.id)], [['cust:a1', 'cust:a2'], ['off:from-b']], 'both changes in the file'); ok('off:from-b' in a.S.favorites, 'and on the device');
});
test('library: parse/serialize keep unknown top-level keys and intro text', async () => {
  const t = '---\nformat: meal-settings/1\n---\nIntro\n\n```yaml\nextra: keepme\ngoals:\n  kcal: 2000\n  p: 100\n  c: 200\n  f: 60\n  rev: 2\n```\nBetween\n```json\n{ "customFoods": [], "favorites": [], "deleted": {}, "note": { "k": 1 } }\n```\nTail\n';
  const m = Sync.parseSettings(t); eq([m.goals.kcal, m.hasData, m.dataError], [2000, true, null], 'parsed');
  const out = Sync.serializeSettings(m, { kcal: 2100, p: 100, c: 200, f: 60, rev: 3 }, { customFoods: [mkFood('c1')], favorites: [], deleted: { customFoods: {}, favorites: {} } });
  ok(out.includes('Intro') && out.includes('Between') && out.includes('Tail') && out.includes('extra: keepme') && out.includes('kcal: 2100') && out.includes('"note": {"k":1}') && out.includes('"c1"'), 'content around and unknown keys kept');
  const re = Sync.parseSettings(out); eq([re.data.customFoods.length, re.data.note, re.goals.rev], [1, { k: 1 }, 3], 'round trip');
  eq(Sync.serializeSettings(Sync.parseSettings(t), { kcal: 2000, p: 100, c: 200, f: 60, rev: 2 }, undefined).includes('"note": { "k": 1 }'), true, 'with data undefined the json block is copied untouched');
});

let done = false, summary = '';
(async () => {
  for (const [name, fn] of tests) { const before = failed; try { await fn(); } catch (e) { failed++; print('FAIL: ' + name + ' threw ' + (e && e.stack || e)); } if (failed > before) print('  ^ in test: ' + name); }
  summary = `${passed} passed, ${failed} failed (${tests.length} tests)`; done = true;
})();
drainMicrotasks();
if (!done) throw new Error('async tests did not finish (a promise never resolved)');
print('\n' + summary);
if (failed) throw new Error(failed + ' check(s) failed');
