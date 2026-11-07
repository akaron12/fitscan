'use strict';
/* Run: tests/run.sh   (loads dayfile.js, driveclient.js, tests/fake-drive.js, then this file) */
let passed = 0, failed = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) passed++; else { failed++; print('FAIL: ' + msg + '\n   got:      ' + A + '\n   expected: ' + B); } };
const ok = (c, msg) => eq(!!c, true, msg);
const rejects = async (p, kind, msg) => { try { await p; failed++; print('FAIL: ' + msg + ' (did not reject)'); } catch (e) { eq(e.kind, kind, msg); } };
const LIST = c => c.method === 'GET' && c.path === '/drive/v3/files';

function setup(opts) {
  const d = FakeDrive(opts), slept = [], store = DriveClient.memStore();
  const c = DriveClient.create({ fetch: d.fetch, getToken: () => d.token, sleep: async ms => { slept.push(ms); }, store });
  return { d, c, slept, store };
}
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('resolveFolders: finds AI Memory, creates Meal Tracker once, then uses the cache', async () => {
  const { d, c } = setup(); const root = d.folder('AI Memory');
  const r = await c.resolveFolders();
  eq(r.rootId, root.id, 'root id'); eq(r.warnings, [], 'no warnings');
  const made = [...d.files.values()].filter(f => f.name === 'Meal Tracker'); eq(made.length, 1, 'one Meal Tracker created'); eq(made[0].parents, [root.id], 'created inside AI Memory'); eq(r.folderId, made[0].id, 'folder id');
  const lists = d.count(LIST); const r2 = await c.resolveFolders(); eq(d.count(LIST), lists, 'second call does not list again'); eq(r2.folderId, r.folderId, 'same folder');
});
test('resolveFolders: no AI Memory => error, nothing created', async () => {
  const { d, c } = setup(); d.folder('Other');
  await rejects(c.resolveFolders(), 'noroot', 'noroot error'); eq(d.files.size, 1, 'nothing created');
});
test('resolveFolders: ignores a trashed AI Memory; warns about two live ones and takes the oldest', async () => {
  let { d, c } = setup(); d.folder('AI Memory', [], { trashed: true }); const live = d.folder('AI Memory');
  let r = await c.resolveFolders(); eq([r.rootId, r.warnings.length], [live.id, 0], 'trashed copy ignored');
  ({ d, c } = setup()); const a = d.folder('AI Memory'); d.folder('AI Memory'); r = await c.resolveFolders(); eq([r.rootId, r.warnings.length], [a.id, 1], 'oldest used with warning');
});
test('resolveFolders: duplicate Meal Tracker folders => oldest, with warning', async () => {
  const { d, c } = setup(); const root = d.folder('AI Memory'), first = d.folder('Meal Tracker', [root.id]); d.folder('Meal Tracker', [root.id]);
  const r = await c.resolveFolders(); eq(r.folderId, first.id, 'oldest folder'); eq(r.warnings.length, 1, 'warned');
});
test('resolveFolders: a Meal Tracker folder trashed behind our back is replaced', async () => {
  const { d, c } = setup(); d.folder('AI Memory'); const r1 = await c.resolveFolders(); d.files.get(r1.folderId).trashed = true;
  const r2 = await c.resolveFolders(); ok(r2.folderId !== r1.folderId, 'new folder created'); eq(d.files.get(r2.folderId).trashed, false, 'new one is live');
});
test('listFiles: pages through results, skips folders and trashed files, honours modifiedAfter', async () => {
  const { d, c } = setup({ pageSize: 2 }); const root = d.folder('AI Memory'), mt = d.folder('Meal Tracker', [root.id]);
  for (let i = 1; i <= 5; i++) d.add(`2026-01-0${i}.md`, { parents: [mt.id] });
  d.folder('sub', [mt.id]); d.add('gone.md', { parents: [mt.id], trashed: true }); d.add('elsewhere.md', { parents: [root.id] });
  const all = await c.listFiles(mt.id); eq(all.map(f => f.name), ['2026-01-01.md', '2026-01-02.md', '2026-01-03.md', '2026-01-04.md', '2026-01-05.md'], 'all five, oldest first');
  ok(d.count(LIST) >= 3, 'used several pages');
  const cutoff = all[2].modifiedTime; eq((await c.listFiles(mt.id, { modifiedAfter: cutoff })).map(f => f.name), ['2026-01-04.md', '2026-01-05.md'], 'modifiedAfter');
});
test('groupByName: duplicates are grouped oldest first', async () => {
  const { d, c } = setup(); const mt = d.folder('x'); const a = d.add('d.md', { parents: [mt.id] }), b = d.add('d.md', { parents: [mt.id] }), s = d.add('settings.md', { parents: [mt.id] });
  const g = c.groupByName([b, s, a].map(f => ({ id: f.id, name: f.name, createdTime: f.createdTime }))); eq(g['d.md'].map(f => f.id), [a.id, b.id], 'oldest first'); eq(g['settings.md'].length, 1, 'single');
});
test('writeFile/readFile: create then read back, including unicode and blank lines', async () => {
  const { d, c } = setup(); const root = d.folder('AI Memory'), { folderId } = await c.resolveFolders(); const text = 'Müsli 🍎\r\n\r\nzweite Zeile\n---\nend';
  const { file, duplicates } = await c.writeFile({ name: '2026-11-07.md', folderId, text }); eq(duplicates, [], 'no duplicates'); eq(await c.readFile(file.id), text, 'content round trips'); eq(file.parents, [folderId], 'in the app folder');
});
test('writeFile: update works; stale expectedModifiedTime => conflict and nothing overwritten', async () => {
  const { d, c } = setup(); d.folder('AI Memory'); const { folderId } = await c.resolveFolders();
  const { file } = await c.writeFile({ name: 'a.md', folderId, text: 'v1' });
  const u = await c.writeFile({ id: file.id, text: 'v2', expectedModifiedTime: file.modifiedTime }); eq(await c.readFile(file.id), 'v2', 'updated');
  d.files.get(file.id).content = 'edited elsewhere'; d.files.get(file.id).modifiedTime = '2030-01-01T00:00:00.000Z';
  await rejects(c.writeFile({ id: file.id, text: 'v3', expectedModifiedTime: u.file.modifiedTime }), 'conflict', 'conflict detected'); eq(await c.readFile(file.id), 'edited elsewhere', 'other writer\'s content kept');
});
test('writeFile: create that races with another writer reports the duplicate', async () => {
  const { d, c } = setup(); d.folder('AI Memory'); const { folderId } = await c.resolveFolders(); let injected = false;
  d.beforeRequest = async ({ method, path }) => { if (!injected && method === 'POST' && path.startsWith('/upload')) { injected = true; d.add('2026-11-07.md', { parents: [folderId], content: 'from other device' }); } };
  const { file, duplicates } = await c.writeFile({ name: '2026-11-07.md', folderId, text: 'mine' });
  eq(await c.readFile(file.id), 'from other device', 'oldest copy is the other one'); eq(duplicates.length, 1, 'our copy reported as duplicate');
});
test('resolveDuplicates: merges into the oldest, trashes the others afterwards', async () => {
  const { d, c } = setup(); const mt = d.folder('x'); const a = d.add('d.md', { parents: [mt.id], content: 'A' }), b = d.add('d.md', { parents: [mt.id], content: 'B' }), e = d.add('d.md', { parents: [mt.id], content: 'C' });
  const files = await c.findByName(mt.id, 'd.md'); const r = await c.resolveDuplicates(files, texts => texts.join('+'));
  eq(await c.readFile(a.id), 'A+B+C', 'merged into oldest'); eq(r.trashed, [b.id, e.id], 'others trashed'); eq([d.files.get(b.id).trashed, d.files.get(e.id).trashed, d.files.get(a.id).trashed], [true, true, false], 'trash flags');
  eq((await c.findByName(mt.id, 'd.md')).length, 1, 'one live copy left');
});
test('resolveDuplicates: if writing the merge fails, nothing is trashed', async () => {
  const { d, c } = setup(); const mt = d.folder('x'); const a = d.add('d.md', { parents: [mt.id], content: 'A' }), b = d.add('d.md', { parents: [mt.id], content: 'B' });
  const files = await c.findByName(mt.id, 'd.md'); d.beforeRequest = async ({ method }) => { if (method === 'PATCH') throw new TypeError('offline'); };
  await rejects(c.resolveDuplicates(files, t => t.join('+')), 'network', 'write failure surfaces'); eq([d.files.get(b.id).trashed, d.files.get(a.id).content], [false, 'A'], 'nothing trashed or changed');
  d.beforeRequest = null; await rejects(c.resolveDuplicates(files, () => { throw new Error('merge bug'); }).catch(e => { throw Object.assign(e, { kind: 'merge' }); }), 'merge', 'merge errors propagate'); eq(d.files.get(b.id).trashed, false, 'still not trashed');
});
test('errors: 401 is "auth" and is not retried', async () => {
  const { d, c } = setup(); const mt = d.folder('x'); d.token = 'rotated'; const before = d.calls.length;
  const c2 = DriveClient.create({ fetch: d.fetch, getToken: () => 'stale', store: DriveClient.memStore() }); await rejects(c2.listFiles(mt.id), 'auth', '401 => auth'); eq(d.calls.length - before, 1, 'single attempt');
});
test('errors: no token => auth without any request', async () => {
  const d = FakeDrive(); const c = DriveClient.create({ fetch: d.fetch, getToken: () => null }); await rejects(c.listFiles('x'), 'auth', 'no token'); eq(d.calls.length, 0, 'no request made');
});
test('errors: 429 is retried with backoff, then succeeds', async () => {
  const { d, c, slept } = setup(); const mt = d.folder('x'); d.add('a.md', { parents: [mt.id] }); d.failNext(429, 2);
  eq((await c.listFiles(mt.id)).length, 1, 'succeeds after retries'); eq(slept, [500, 1000], 'exponential backoff');
});
test('errors: persistent 500 => "server" after 3 retries; persistent rate-limit 403 => "rate"; plain 403 => "forbidden"; 404 => "notfound"', async () => {
  let { d, c, slept } = setup(); d.failNext(500, 4); await rejects(c.listFiles('x'), 'server', '500'); eq(slept.length, 3, 'three retries');
  ({ d, c } = setup()); d.failNext(403, 4, '{"error":{"errors":[{"reason":"userRateLimitExceeded"}]}}'); await rejects(c.listFiles('x'), 'rate', 'rate limit');
  ({ d, c, slept } = setup()); d.failNext(403, 1, 'The user does not have sufficient permissions'); await rejects(c.listFiles('x'), 'forbidden', '403'); eq(slept.length, 0, 'forbidden is not retried');
  ({ d, c } = setup()); await rejects(c.readFile('nope'), 'notfound', '404');
});
test('errors: fetch failure => "network"', async () => {
  const { d, c } = setup(); d.networkDown = true; await rejects(c.listFiles('x'), 'network', 'offline');
});
test('queries: names with apostrophes and backslashes are escaped', async () => {
  const { d, c } = setup(); const mt = d.folder('x'); d.add("O'Brien\\.md", { parents: [mt.id] });
  eq((await c.findByName(mt.id, "O'Brien\\.md")).length, 1, 'found');
});
test('locate: uses the cached id without listing; falls back to a lookup if the file was trashed', async () => {
  const { d, c } = setup(); d.folder('AI Memory'); const { folderId } = await c.resolveFolders(); const { file } = await c.writeFile({ name: 'a.md', folderId, text: 't' });
  const lists = d.count(LIST); const hit = await c.locate(folderId, 'a.md'); eq([hit.file.id, d.count(LIST)], [file.id, lists], 'cache hit, no listing');
  d.files.get(file.id).trashed = true; eq((await c.locate(folderId, 'a.md')).file, null, 'trashed file => not found');
  const again = await c.writeFile({ name: 'a.md', folderId, text: 'new' }); ok(again.file.id !== file.id, 'new file created after the old one was trashed');
});
test('syncSpecFile: create, unchanged, update while marked, leave foreign edits alone', async () => {
  const { d, c } = setup(); d.folder('AI Memory'); const { folderId } = await c.resolveFolders(); const M = '<!-- managed -->';
  eq(await c.syncSpecFile(folderId, 'FORMAT.md', M + '\nv1', M), 'created', 'created'); eq(await c.syncSpecFile(folderId, 'FORMAT.md', M + '\nv1', M), 'unchanged', 'unchanged');
  eq(await c.syncSpecFile(folderId, 'FORMAT.md', M + '\nv2', M), 'updated', 'updated'); const f = (await c.findByName(folderId, 'FORMAT.md'))[0]; eq(await c.readFile(f.id), M + '\nv2', 'new text stored');
  d.files.get(f.id).content = 'my own notes'; eq(await c.syncSpecFile(folderId, 'FORMAT.md', M + '\nv3', M), 'skipped', 'foreign file skipped'); eq(await c.readFile(f.id), 'my own notes', 'foreign content kept');
});
test('every request carries the bearer token', async () => {
  const { d, c } = setup(); d.folder('AI Memory'); const { folderId } = await c.resolveFolders(); await c.writeFile({ name: 'a.md', folderId, text: 't' });
  ok(d.calls.length > 3 && d.calls.every(x => x.auth === 'Bearer tok'), 'all calls authorised');
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
