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
  const S = { entries: {}, tombstones: {}, goals: { kcal: 2200, p: 140, c: 240, f: 75, manual: false } };
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

let done = false, summary = '';
(async () => {
  for (const [name, fn] of tests) { const before = failed; try { await fn(); } catch (e) { failed++; print('FAIL: ' + name + ' threw ' + (e && e.stack || e)); } if (failed > before) print('  ^ in test: ' + name); }
  summary = `${passed} passed, ${failed} failed (${tests.length} tests)`; done = true;
})();
drainMicrotasks();
if (!done) throw new Error('async tests did not finish (a promise never resolved)');
print('\n' + summary);
if (failed) throw new Error(failed + ' check(s) failed');
