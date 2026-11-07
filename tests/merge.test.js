'use strict';
/* Tests for merge.js (needs dayfile.js loaded first; see tests/run.sh) */
let passed = 0, failed = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) passed++; else { failed++; print('FAIL: ' + msg + '\n   got:      ' + A + '\n   expected: ' + B); } };
const ok = (c, msg) => eq(!!c, true, msg);
const { mergeDay, makeBase, unionModels, canon } = DayMerge;
let n = 0; const uid = () => 'new' + (++n);

const fe = (o = {}) => ({ meal: 'lunch', status: 'planned', food: 'Rice', qty_g: 100, kcal: 130, p: 3, c: 28, f: 0.3, ...o });
const app = (o = {}) => { const e = DayFile.toApp(fe(o)); e.id = o.id || 'a1'; e.rev = o.rev || 1; return e; };
const model = (...entries) => DayFile.create('2026-11-07', entries);
const run = ({ local = [], tombs = {}, remote = null, base = null }) => mergeDay({ date: '2026-11-07', local, localTombs: tombs, remote, base, uid, now: 1000 });
const baseOf = (...entries) => makeBase(entries.map(entry => ({ kind: 'entry', entry })));
const byId = (r, id) => r.entries.find(e => e.id === id);
const fileEntries = r => r.items.filter(i => i.kind === 'entry').map(i => i.entry);

// 1. nothing to merge
let r = run({}); eq([r.entries.length, r.localChanged, r.remoteNeedsUpdate], [0, false, false], 'empty + empty');

// 2. new remote entry (planned by Claude) arrives locally; id gets assigned and must be written back
r = run({ remote: model(fe({ food: 'Salmon', kcal: 312, qty_g: 150, p: 33, c: 0, f: 19 })) });
eq(r.entries.length, 1, 'planned entry imported'); eq([r.entries[0].status, r.entries[0].id], ['planned', 'new1'], 'status and new id'); ok(r.localChanged, 'local changed'); ok(r.remoteNeedsUpdate, 'id has to be written back to Drive');
eq(fileEntries(r)[0].id, 'new1', 'file entry carries the new id');

// 3. new local entry goes to Drive
r = run({ local: [app({ id: 'x1', status: 'eaten' })], remote: model() }); eq([r.entries.length, r.remoteNeedsUpdate, r.localChanged], [1, true, false], 'local-only entry is pushed');
r = run({ local: [app({ id: 'x1', status: 'eaten' })], remote: null }); ok(r.remoteNeedsUpdate && fileEntries(r).length === 1, 'no remote file yet => create');

// 4. identical on both sides: no writes, no local change
let l = app({ id: 'a1', rev: 2 }), rm = model(fe({ id: 'a1', rev: 2 }));
r = run({ local: [l], remote: rm, base: baseOf(fe({ id: 'a1', rev: 2 })) }); eq([r.localChanged, r.remoteNeedsUpdate], [false, false], 'identical => idle');

// 5. id-less remote entry that matches a local entry reuses its id (no duplicate)
r = run({ local: [app({ id: 'mine', status: 'eaten' })], remote: model(fe({ status: 'eaten' })) }); eq(r.entries.map(e => e.id), ['mine'], 'matched by meal+food+qty'); ok(r.remoteNeedsUpdate, 'id written back');
r = run({ local: [app({ id: 'mine', status: 'eaten' })], remote: model(fe({ food: 'Pasta' })) }); eq(r.entries.length, 2, 'different food is a new entry');
n = 0; r = run({ remote: model(fe(), fe()) }); eq(r.entries.map(e => e.id), ['new1', 'new2'], 'two identical id-less remote entries stay two');

// 6. only remote changed (Claude edited a planned entry): remote wins
const b1 = baseOf(fe({ id: 'a1', rev: 1 }));
r = run({ local: [app({ id: 'a1' })], remote: model(fe({ id: 'a1', rev: 1, qty_g: 150, kcal: 195 })), base: b1 });
eq(byId(r, 'a1').g, 150, 'Claude\'s change to a planned entry is taken'); ok(r.localChanged && !r.remoteNeedsUpdate, 'local updated, nothing to push');

// 7. only local changed: local kept, Drive updated
const lEdited = app({ id: 'a1', rev: 2, qty_g: 200, kcal: 260 });
r = run({ local: [lEdited], remote: model(fe({ id: 'a1', rev: 1 })), base: b1 }); eq(byId(r, 'a1').g, 200, 'local edit kept'); ok(r.remoteNeedsUpdate && !r.localChanged, 'pushed');

// 8. EATEN PROTECTION: external edit of an eaten entry is blocked and suggested
const eatenBase = baseOf(fe({ id: 'e1', status: 'eaten', rev: 3 }));
r = run({ local: [app({ id: 'e1', status: 'eaten', rev: 3 })], remote: model(fe({ id: 'e1', status: 'planned', rev: 3, qty_g: 300, kcal: 390 })), base: eatenBase });
eq([byId(r, 'e1').status, byId(r, 'e1').g], ['eaten', 100], 'eaten entry untouched by an incoming planned version'); eq(r.suggestions.map(s => s.kind), ['change'], 'recorded as a suggestion'); ok(r.remoteNeedsUpdate, 'Drive is corrected'); ok(byId(r, 'e1').rev > 3, 'rev bumped so it dominates');
eq(fileEntries(r)[0].status, 'eaten', 'file shows eaten again');
// ...but an edit made by another instance of the app (rev bumped) is accepted
r = run({ local: [app({ id: 'e1', status: 'eaten', rev: 3 })], remote: model(fe({ id: 'e1', status: 'eaten', rev: 4, qty_g: 120, kcal: 156 })), base: eatenBase });
eq(byId(r, 'e1').g, 120, 'edit from another device (rev bumped) is accepted'); eq(r.suggestions.length, 0, 'no suggestion');
// planned -> eaten from another device is accepted
const pBase = baseOf(fe({ id: 'p1', rev: 1 }));
r = run({ local: [app({ id: 'p1' })], remote: model(fe({ id: 'p1', status: 'eaten', rev: 2 })), base: pBase }); eq(byId(r, 'p1').status, 'eaten', 'confirmation from another device is accepted');

// 9. both changed: this device wins, the other version is kept as a suggestion
r = run({ local: [app({ id: 'a1', rev: 2, qty_g: 200, kcal: 260 })], remote: model(fe({ id: 'a1', rev: 1, qty_g: 50, kcal: 65 })), base: b1 });
eq(byId(r, 'a1').g, 200, 'local wins a true conflict'); eq(r.suggestions.map(s => s.kind), ['conflict'], 'conflict recorded'); eq(r.suggestions[0].remote.qty_g, 50, 'remote version preserved in the suggestion'); ok(byId(r, 'a1').rev >= 3, 'rev dominates');

// 10. MISSING IS NOT DELETED: an entry absent from the remote file is kept and re-pushed
r = run({ local: [app({ id: 'a1' }), app({ id: 'a2', food: 'Egg', kcal: 80, qty_g: 50 })], remote: model(fe({ id: 'a1' })), base: baseOf(fe({ id: 'a1' }), fe({ id: 'a2', food: 'Egg', kcal: 80, qty_g: 50 })) });
eq(r.entries.map(e => e.id).sort(), ['a1', 'a2'], 'stale remote copy does not delete anything'); ok(r.remoteNeedsUpdate, 'missing entry restored in Drive'); eq(fileEntries(r).length, 2, 'both in the file');

// 11. tombstones
// 11a. deleted locally, unchanged remotely: tombstone is pushed
r = run({ local: [], tombs: { a1: { rev: 2, at: 5, meal: 'lunch' } }, remote: model(fe({ id: 'a1', rev: 1 })), base: b1 });
eq(r.entries.length, 0, 'stays deleted'); ok(r.remoteNeedsUpdate, 'Drive learns about the deletion'); eq([fileEntries(r)[0].deleted, fileEntries(r)[0].id, fileEntries(r)[0].meal], [true, 'a1', 'lunch'], 'tombstone written in place');
// 11b. deleted remotely (planned entry removed by an app on another device), unchanged here: deleted here too
r = run({ local: [app({ id: 'a1' })], remote: model({ id: 'a1', meal: 'lunch', status: 'eaten', deleted: true, rev: 2 }), base: b1 });
eq(r.entries.length, 0, 'remote deletion applied'); eq(r.tombs.a1.rev, 2, 'local tombstone recorded'); ok(r.localChanged, 'local changed');
// 11c. deleted remotely but edited here: the edit wins
r = run({ local: [app({ id: 'a1', rev: 2, qty_g: 150, kcal: 195 })], remote: model({ id: 'a1', meal: 'lunch', status: 'eaten', deleted: true, rev: 2 }), base: b1 });
eq(r.entries.map(e => e.id), ['a1'], 'edit beats an old deletion'); ok(r.remoteNeedsUpdate && !fileEntries(r)[0].deleted, 'entry replaces the tombstone');
// 11d. EATEN entry deleted from outside is protected
r = run({ local: [app({ id: 'e1', status: 'eaten', rev: 3 })], remote: model({ id: 'e1', meal: 'lunch', status: 'eaten', deleted: true, rev: 3 }), base: eatenBase });
eq(r.entries.map(e => e.id), ['e1'], 'eaten entry survives an external deletion'); eq(r.suggestions.map(s => s.kind), ['delete'], 'deletion suggested, not applied');
// 11e. deleted locally, remote entry changed since (Claude edited): delete wins, edit kept as suggestion
r = run({ local: [], tombs: { a1: { rev: 2, at: 5, meal: 'lunch' } }, remote: model(fe({ id: 'a1', rev: 1, qty_g: 80, kcal: 104 })), base: b1 });
eq(r.entries.length, 0, 'delete wins'); eq(r.suggestions.map(s => s.kind), ['change'], 'Claude\'s edit kept as a suggestion');
// 11f. tombstone for something that never reached Drive is dropped; one that was synced is kept
r = run({ local: [], tombs: { zz: { rev: 2, at: 5, meal: 'lunch' } }, remote: model(), base: null }); eq([Object.keys(r.tombs).length, r.remoteNeedsUpdate], [0, false], 'never-synced tombstone dropped');
r = run({ local: [], tombs: { a1: { rev: 2, at: 5, meal: 'lunch' } }, remote: model(), base: b1 }); eq([Object.keys(r.tombs), r.remoteNeedsUpdate], [['a1'], true], 'synced entry\'s tombstone is pushed');
// 11g. remote tombstone adopted locally
r = run({ local: [], remote: model({ id: 'a1', meal: 'lunch', status: 'eaten', deleted: true, rev: 5 }) }); eq(r.tombs.a1.rev, 5, 'remote tombstone remembered locally');

// 12. raw (unreadable) items are kept in place and never touched
const withRaw = DayFile.parse('---\ndate: 2026-11-07\nformat: meal-log/1\n---\n```yaml\nentries:\n  - id: g1\n    meal: lunch\n    status: planned\n    food: Good\n    qty_g: 10\n    kcal: 20\n  - meal: lunch\n    status: planned\n    food: Bad: unquoted\n    qty_g: 10\n    kcal: 20\n```\n');
r = run({ local: [app({ id: 'x9', status: 'eaten', food: 'Mine' })], remote: withRaw });
eq(r.items.map(i => i.kind), ['entry', 'raw', 'entry'], 'raw item stays in its position, new entry appended'); ok(r.items[1].raw.includes('Bad: unquoted'), 'raw text intact');

// 13. unknown keys of a remote entry survive when the local side wins
const withX = fe({ id: 'a1', rev: 1, x: { recipe: 'https://x' } });
r = run({ local: [app({ id: 'a1', rev: 2, qty_g: 200, kcal: 260 })], remote: model(withX), base: baseOf(withX) }); eq(fileEntries(r)[0].x, { recipe: 'https://x' }, 'remote-only keys preserved');
// ...and unknown keys from Claude on a new entry reach the app entry
r = run({ remote: model(fe({ note: 'less salt', x: { extra: 'v' } })) }); eq(r.entries[0].x, { note: 'less salt', extra: 'v' }, 'note + unknown keys land in x');

// 14. adopting a remote change keeps the local food snapshot (images, micronutrients)
const rich = app({ id: 'a1' }); rich.food.img = 'http://img'; rich.food.micro = { sodium: 1 };
r = run({ local: [rich], remote: model(fe({ id: 'a1', rev: 1, qty_g: 150, kcal: 195 })), base: b1 }); eq([byId(r, 'a1').food.img, byId(r, 'a1').g], ['http://img', 150], 'snapshot extras kept, quantity updated');

// 15. makeBase and canon
const mb = makeBase([{ kind: 'entry', entry: fe({ id: 'q', rev: 4 }) }, { kind: 'entry', entry: { id: 't', meal: 'lunch', status: 'eaten', deleted: true, rev: 6 } }, { kind: 'raw', raw: 'x' }]);
eq([Object.keys(mb.entries), mb.entries.q.rev, mb.tombs.t], [['q'], 4, 6], 'base records entries and tombstones, skips raw');
eq(canon(fe({ id: 'a', rev: 1 })), canon(fe({ id: 'b', rev: 9 })), 'canon ignores id and rev'); ok(canon(fe()) !== canon(fe({ qty_g: 101 })), 'canon sees content');
eq(canon(fe({ p: 3.04 })), canon(fe({ p: 3 })), 'canon rounds macros to 0.1');

// 16. unionModels (duplicate files of the same day)
const m1 = model(fe({ id: 'a1', rev: 1 })), m2 = model(fe({ id: 'a1', rev: 2, qty_g: 150, kcal: 195 }), fe({ id: 'b1', food: 'Egg' }));
let u = unionModels([m1, m2], uid); eq(DayFile.parse.entries(u).map(e => [e.id, e.qty_g]), [['a1', 150], ['b1', 100]], 'higher rev wins; new ids appended');
u = unionModels([model(fe({ id: 'a1', status: 'eaten', rev: 3 })), model(fe({ id: 'a1', status: 'planned', rev: 9 }))], uid); eq(DayFile.parse.entries(u)[0].status, 'eaten', 'planned never beats eaten in a union');
u = unionModels([model(fe({ id: 'a1' })), model(fe())], uid); eq(DayFile.parse.entries(u).length, 1, 'id-less twin is not duplicated');
u = unionModels([model(fe({ id: 'a1' })), model({ id: 'a1', meal: 'lunch', status: 'eaten', deleted: true, rev: 5 })], uid); eq(DayFile.parse.entries(u)[0].deleted, true, 'newer tombstone wins in a union');

print(`\n${passed} passed, ${failed} failed`);
if (failed) throw new Error(failed + ' check(s) failed');
