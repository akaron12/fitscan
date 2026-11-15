'use strict';
/* Run with tests/run.sh (healthexport.js first). Sending a meal to Apple Health through the "Log Meal" shortcut. */
let passed = 0, failed = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) passed++; else { failed++; print('FAIL: ' + msg + '\n   got:      ' + A + '\n   expected: ' + B); } };
const H = HealthExport;

const e = (id, meal, n, status = 'eaten') => ({ id, meal, status, n });
const es = [e('a', 'lunch', { kcal: 300, p: 20.04, c: 10, f: 12 }), e('b', 'lunch', { kcal: 150.26, p: 5, c: 20, f: 3 }),
  e('c', 'lunch', { kcal: 500, p: 1, c: 1, f: 1 }, 'planned'), e('d', 'dinner', { kcal: 700, p: 40, c: 50, f: 30 })];
const nutrOf = x => x.n;

// unsent: eaten entries of this meal not sent yet; planned never count
eq(H.unsent(es, 'lunch', []).map(x => x.id), ['a', 'b'], 'eaten lunch entries, planned left out, other meals left out');
eq(H.unsent(es, 'lunch', ['a']).map(x => x.id), ['b'], 'an entry already sent is skipped');
eq(H.unsent(es, 'lunch', ['a', 'b']).length, 0, 'everything sent: nothing left');
eq([H.unsent(undefined, 'lunch', undefined).length, H.unsent(es, 'breakfast', null).length], [0, 0], 'no day or empty meal: nothing to send');

// totals: whole-meal sums, one decimal
eq(H.totals(H.unsent(es, 'lunch', []), nutrOf), { calories: 450.3, protein: 25, carbs: 30, fat: 15 }, 'sums the meal, rounded to 1 decimal');
eq(H.totals([], nutrOf), { calories: 0, protein: 0, carbs: 0, fat: 0 }, 'empty list: zeros');

// url: the same shape that was tested by hand on the iPhone (lowercase keys)
eq(H.url({ calories: 10, protein: 20, carbs: 30, fat: 40 }),
  'shortcuts://run-shortcut?name=Log%20Meal&input=text&text=%7B%22calories%22%3A10%2C%22protein%22%3A20%2C%22carbs%22%3A30%2C%22fat%22%3A40%7D', 'shortcut URL matches the tested one');

// url with a meal date: same keys plus date, so the shortcut can log on the meal's day
eq(H.url({ calories: 10, protein: 20, carbs: 30, fat: 40 }, '2026-11-12T12:30:00'),
  'shortcuts://run-shortcut?name=Log%20Meal&input=text&text=' + encodeURIComponent('{"calories":10,"protein":20,"carbs":30,"fat":40,"date":"2026-11-12T12:30:00"}'), 'date is added to the JSON');

// stamp: meal clock time on its own day; today never later than now
eq([H.stamp('2026-11-12', 'breakfast', '2026-11-15', '10:00'), H.stamp('2026-11-12', 'lunch', '2026-11-15', '10:00'),
  H.stamp('2026-11-12', 'dinner', '2026-11-15', '10:00'), H.stamp('2026-11-12', 'snacks', '2026-11-15', '10:00')],
  ['2026-11-12T08:00:00', '2026-11-12T12:30:00', '2026-11-12T19:00:00', '2026-11-12T15:30:00'], 'past day: typical meal times');
eq([H.stamp('2026-11-15', 'dinner', '2026-11-15', '10:05'), H.stamp('2026-11-15', 'breakfast', '2026-11-15', '10:05')],
  ['2026-11-15T10:05:00', '2026-11-15T08:00:00'], 'today: a meal time still ahead becomes now');
eq(H.stamp('2026-11-12', 'brunch', '2026-11-15', '10:00'), '2026-11-12T12:00:00', 'unknown meal falls back to noon');

// supported: iPhone/iPad only
eq([H.supported('Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X)'), H.supported('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), H.supported('')], [true, false, false], 'only iPhone/iPad');

// prune: drop junk and anything older than 60 days
eq(H.prune({ '2026-11-15': ['a', 3, 'b'], '2026-09-01': ['old'], 'junk': ['x'], '2026-11-14': 'nope' }, '2026-11-15'), { '2026-11-15': ['a', 'b'] }, 'prune keeps recent string ids only');
eq([H.prune(null, '2026-11-15'), H.prune([], '2026-11-15')], [{}, {}], 'bad input becomes an empty map');

print(`\n${passed} passed, ${failed} failed`);
if (failed) throw new Error(failed + ' check(s) failed');
