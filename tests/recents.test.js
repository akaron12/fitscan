'use strict';
/* Run with tests/run.sh (recents.js, dayfile.js, merge.js first). Recents: a window of days, unique foods, last amount, use counts, sync merge. */
let passed = 0, failed = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) passed++; else { failed++; print('FAIL: ' + msg + '\n   got:      ' + A + '\n   expected: ' + B); } };
const ok = (c, msg) => eq(!!c, true, msg);

const TODAY = '2026-11-08', R = Recents;
const day = n => { const d = new Date(TODAY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const food = (id, extra = {}) => ({ id, name: 'Food ' + id, brand: '', img: '', cat: '', n: { kcal: 100, p: 5, c: 10, f: 3 }, serving: null, src: 'off', code: '', ...extra });
const log = (list, id, ago, o = {}) => R.touch(list, food(id), { date: day(ago), today: TODAY, days: 30, g: 100, unit: 'g', qty: 100, ...o });
const ids = l => l.map(r => r.id);

// ---- window
eq([R.cutoff(TODAY, 30), R.cutoff(TODAY, 7), R.cutoff(TODAY, 999)], [day(30), day(7), day(30)], 'cutoff: N days back; an unknown setting falls back to 30');
let l = []; l = log(l, 'a', 29); l = log(l, 'b', 31);
eq(ids(l), ['a'], 'logged 29 days ago is in, 31 days ago never gets in (acceptance)');
eq(ids(R.prune([{ id: 'a', last: day(29) }, { id: 'b', last: day(31) }, { id: 'c', last: day(30) }], TODAY, 30)), ['a', 'c'], 'prune: older than the window drops off, the edge day stays');
eq(ids(R.prune([{ id: 'a', last: day(10) }, { id: 'b', last: day(3) }], TODAY, 7)), ['b'], 'a shorter window hides older foods at once');
eq(ids(R.prune([{ id: 'a', last: day(80) }], TODAY, 90)), ['a'], '90 days keeps what 30 would have dropped');

// ---- no count cap, unique, newest first
l = []; for (let i = 0; i < 60; i++) l = log(l, 'f' + i, 21 - Math.floor(i / 3));
eq(l.length, 60, '60 distinct foods over 3 weeks: all 60 stay (the old cap was 40)');
l = []; for (let i = 0; i < R.MAX + 20; i++) l = log(l, 'm' + i, 0);
eq(l.length, R.MAX, 'a safety ceiling stops runaway growth');
l = []; l = log(l, 'a', 5); l = log(l, 'b', 3); l = log(l, 'a', 1);
eq([ids(l), l[0].uses, l[0].last], [['a', 'b'], 2, day(1)], 'logging a food again: one row, moved to the top, count up, date refreshed');
l = []; for (let i = 0; i < 5; i++) l = log(l, 'a', 0);
eq([l.length, l[0].uses], [1, 5], 'five logs of one food in a month: one row');
l = []; l = log(l, 'a', 0); l = log(l, 'b', 4); l = log(l, 'c', 2);
eq(ids(l), ['a', 'c', 'b'], 'newest day first, whatever order they were logged in');
l = log([], 'a', -3);
eq(l[0].last, TODAY, 'a future day counts as today');

// ---- last amount
l = log([], 'a', 2, { g: 150, unit: 'serv', qty: 1.5 }); l = log(l, 'a', 1, { g: 40, unit: 'g', qty: 40 });
eq([l[0].lastG, l[0].lastU, l[0].lastQ], [40, 'g', 40], 'the amount of the latest log is remembered');
l = log(l, 'a', 6, { g: 999, unit: 'g', qty: 999 });
eq([l[0].lastG, l[0].uses, l[0].last], [40, 3, day(1)], 'logging an earlier day later keeps the latest amount and date, only the count goes up');
eq(R.touch([], food('a'), { date: day(0), today: TODAY, days: 30, g: -5, unit: 'zz', qty: 'x' })[0].lastU, undefined, 'a bad amount is not stored');

// ---- sort
l = []; l = log(l, 'a', 5); l = log(l, 'a', 5); l = log(l, 'a', 4); l = log(l, 'b', 1); l = log(l, 'c', 0); l = log(l, 'b', 0); l = log(l, 'c', 0);
eq(ids(R.view(l, TODAY, 30, 'recent')), ['c', 'b', 'a'], 'view: recent = newest first');
eq(ids(R.view(l, TODAY, 30, 'used')), ['a', 'c', 'b'].slice(0, 3), 'view: most used = highest count first');
l = log([], 'x', 0); l = log(l, 'y', 0); l = log(l, 'z', 0);
eq(ids(R.view(l, TODAY, 30, 'used')), ['z', 'y', 'x'], 'most used: equal counts, newest first');
eq(ids(R.view([{ id: 'old', last: day(20), uses: 9 }, { id: 'new', last: day(1), uses: 1 }], TODAY, 7, 'used')), ['new'], 'most used follows the window too');

// ---- normalize
eq(R.normalize([food('a'), food('a'), { id: 'b', last: day(3), uses: 'x', lastU: 'bad' }, null], TODAY).map(r => [r.id, r.last, r.uses, r.lastU]), [['a', TODAY, 1, undefined], ['b', day(3), 1, undefined]], 'normalize: dedupes, fills last and uses, drops junk');

// ---- migration from the old list of 40 (no dates)
const e = (id, g, o = {}) => ({ id: 'e' + id + g, status: 'eaten', g, unit: 'g', qty: g, food: food(id), ...o });
const entries = { [day(10)]: [e('a', 100), e('b', 50)], [day(2)]: [e('a', 120)], [day(40)]: [e('z', 100)], [day(1)]: [e('p', 10, { status: 'planned' }), { id: 'q', status: 'eaten', g: 1, food: food('q', { src: 'quick' }) }] };
const old = [food('b'), food('a'), food('lost')];
const mig = R.migrate(old, entries, TODAY, 30);
eq(ids(mig), ['lost', 'a', 'b'], 'migrate: foods with no diary entry count as used today; the rest are ordered by the diary');
eq(mig.find(r => r.id === 'a'), { ...food('a'), last: day(2), uses: 2, lastG: 120, lastU: 'g', lastQ: 120 }, 'migrate: date, count and last amount come from the diary');
const ent2 = { [day(5)]: [e('n', 30)] };
eq(ids(R.migrate([], ent2, TODAY, 30)), ['n'], 'migrate: foods eaten in the window that fell off the old list come back');
eq(ids(R.migrate([], entries, TODAY, 30)).sort(), ['a', 'b'], 'migrate: not planned, not quick entries, not older than the window');
eq(ids(R.migrate([], { [day(40)]: [e('z', 1)] }, TODAY, 60)), ['z'], 'migrate: a longer window reaches further back');

// ---- sync merge (DayMerge)
const rec = (id, last, o = {}) => ({ ...food(id), last, uses: 1, ...o });
const cut = R.cutoff(TODAY, 30);
let m = DayMerge.mergeRecents([rec('a', day(1))], [], cut);
eq([m.localChanged, m.remoteNeedsUpdate, m.file.map(f => f.id)], [false, true, ['a']], 'merge: a local-only recent is pushed');
m = DayMerge.mergeRecents([], [DayMerge.cleanRecent(rec('r', day(2)), true)], cut);
eq([m.localChanged, m.remoteNeedsUpdate, ids(m.local)], [true, false, ['r']], 'merge: a remote-only recent is pulled (a new device gets the list)');
m = DayMerge.mergeRecents([rec('a', day(5), { lastG: 10, lastU: 'g', lastQ: 10, uses: 3 })], [DayMerge.cleanRecent(rec('a', day(1), { lastG: 99, lastU: 'g', lastQ: 99, uses: 2 }), true)], cut);
eq([m.local[0].last, m.local[0].lastG, m.local[0].uses], [day(1), 99, 3], 'merge: the later log supplies the date and amount, the larger count wins');
const A = [rec('a', day(1), { lastG: 10, lastU: 'g', lastQ: 10 })], B = [DayMerge.cleanRecent(rec('a', day(1), { lastG: 20, lastU: 'g', lastQ: 20 }), true)];
eq(DayMerge.mergeRecents(A, B, cut).file, DayMerge.mergeRecents(B, A, cut).file, 'merge: a tie on the same day is decided the same way on both devices');
m = DayMerge.mergeRecents([rec('a', day(1))], [], cut); const fileA = m.file;
eq(DayMerge.mergeRecents([rec('a', day(1))], fileA, cut).remoteNeedsUpdate, false, 'merge: nothing to write when both sides agree');
m = DayMerge.mergeRecents([rec('keep', day(1))], [DayMerge.cleanRecent(rec('x', day(2)), true)], cut);
eq(ids(m.local).sort(), ['keep', 'x'], 'merge: absence on the other side never deletes (a stale file cannot remove a recent)');
m = DayMerge.mergeRecents([rec('old', day(40))], [DayMerge.cleanRecent(rec('old2', day(45)), true)], cut);
eq([m.local.length, m.file.length, m.remoteNeedsUpdate], [0, 0, true], 'merge: only the window removes foods, from both sides');
m = DayMerge.mergeRecents([{ id: 'bad' }, rec('ok', day(1))], [], cut);
eq([m.file.map(f => f.id), ids(m.local)], [['ok'], ['ok', 'bad']], 'merge: an unsyncable local item stays local and is not written');

// days setting
eq(DayMerge.mergeRecentsDays({ days: 30, rev: 0 }, null), { days: 30, rev: 0, localChanged: false, remoteNeedsUpdate: false }, 'days: untouched default is never written');
eq(DayMerge.mergeRecentsDays({ days: 14, rev: 1 }, null).remoteNeedsUpdate, true, 'days: a changed setting is pushed');
eq(DayMerge.mergeRecentsDays({ days: 30, rev: 0 }, { days: 60, rev: 2 }), { days: 60, rev: 2, localChanged: true, remoteNeedsUpdate: false }, 'days: the higher rev wins, the other device adopts it');
eq(DayMerge.mergeRecentsDays({ days: 14, rev: 3 }, { days: 60, rev: 2 }).days, 14, 'days: local newer wins');
eq(DayMerge.mergeRecentsDays({ days: 14, rev: 2 }, { days: 60, rev: 2 }).days, 60, 'days: same rev, different days: the larger, on both devices');

// whole library merge + file reading
const mlib = (local, remote) => DayMerge.mergeLibrary({ local, remote: DayMerge.readLibrary(remote), today: TODAY });
let lm = mlib({ foods: {}, favs: {}, recents: [rec('a', day(1))], days: { days: 14, rev: 1 } }, null);
eq([lm.fileData.recents.map(f => f.id), lm.fileData.recentsDays, lm.remoteNeedsUpdate], [['a'], { days: 14, rev: 1 }, true], 'library: recents and the window are written to the file');
lm = mlib({ foods: {}, favs: {}, recents: [], days: { days: 30, rev: 0 } }, { recents: [rec('r', day(2))], recentsDays: { days: 60, rev: 2 } });
eq([ids(lm.recents), lm.days], [['r'], { days: 60, rev: 2 }], 'library: a fresh device pulls the list and the window');
lm = mlib({ foods: {}, favs: {}, recents: [], days: { days: 30, rev: 0 } }, { recents: [rec('old', day(50))], recentsDays: { days: 60, rev: 1 } });
eq(ids(lm.recents), ['old'], 'library: the window from the file decides what is pulled');
eq(DayMerge.readLibrary({ recents: [{ ...rec('a', day(1)), last: 'yesterday' }] }).error != null, true, 'file: a bad date is rejected as a whole');
eq(DayMerge.readLibrary({ recents: [rec('a', day(1)), rec('a', day(2))] }).error != null, true, 'file: a duplicate id is rejected');
eq(DayMerge.readLibrary({ recentsDays: { days: 5, rev: 1 } }).error != null, true, 'file: a window that is not an option is rejected');
eq(DayMerge.readLibrary({ recents: 'x' }).error != null, true, 'file: recents must be a list');
const s0 = DayMerge.libSig({ foods: {}, favs: {}, tombs: {} });
ok(s0 !== DayMerge.libSig({ foods: {}, favs: {}, tombs: {}, recents: [rec('a', day(1))] }), 'libSig sees a new recent');
ok(s0 !== DayMerge.libSig({ foods: {}, favs: {}, tombs: {}, days: { days: 14, rev: 1 } }), 'libSig sees the window change');
eq(s0, DayMerge.libSig({ foods: {}, favs: {}, tombs: {}, recents: [], days: { days: 30, rev: 0 } }), 'libSig: an empty list and the default window leave the old fingerprint alone');

print(`\n${passed} passed, ${failed} failed`);
if (failed) throw new Error('recents tests failed');
