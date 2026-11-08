'use strict';
/* Run with tests/run.sh (macros.js first). The rule is strict: calories are exactly what the macros give (4/4/9), plus 1 kcal of rounding. */
let passed = 0, failed = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) passed++; else { failed++; print('FAIL: ' + msg + '\n   got:      ' + A + '\n   expected: ' + B); } };

eq([Macros.kcal(0, 0, 0), Macros.kcal(10, 0, 0), Macros.kcal(135, 180, 60)], [0, 40, 1800], '4/4/9 calories (Adam\'s daily targets: 135/180/60 = 1,800)');
eq(Macros.kcal(0.3, 14, 0.2), 59, 'rounded to whole kcal: 1.2 + 56 + 1.8 = 59');

// fine: calories equal the macros
eq(Macros.check({ kcal: 0, p: 0, c: 0, f: 0 }), null, 'water: all zero is fine');
eq(Macros.check({ kcal: 900, p: 0, c: 0, f: 100 }), null, 'pure fat: 100 g x 9');
eq(Macros.check({ kcal: 400, p: 25, c: 30, f: 20 }), null, 'exact: 25*4 + 30*4 + 20*9 = 400');
eq(Macros.check({ kcal: 59, p: 0.3, c: 14, f: 0.2 }), null, 'decimals: 59');
eq(Macros.check({ kcal: 60, p: 0.3, c: 14, f: 0.2 }), null, '1 kcal of rounding is allowed');
eq(Macros.check({ kcal: 400, p: 50, c: 50, f: 0 }), null, 'exactly 100 g of macros is allowed');

// strict: anything beyond rounding is refused (these used to pass with a 10% tolerance)
eq(Macros.check({ kcal: 884, p: 0, c: 0, f: 100 }), { kind: 'kcal', calc: 900 }, 'olive-oil label 884 vs 900 is refused');
eq(Macros.check({ kcal: 250, p: 9, c: 49, f: 3 }), { kind: 'kcal', calc: 259 }, 'bread label 250 vs 259 is refused');
eq(Macros.check({ kcal: 365, p: 25, c: 30, f: 20 }), { kind: 'kcal', calc: 400 }, '9% off is refused');
eq(Macros.check({ kcal: 62, p: 0.3, c: 14, f: 0.2 }), { kind: 'kcal', calc: 59 }, '3 kcal off is refused');
eq(Macros.check({ kcal: 100, p: 25, c: 30, f: 20 }), { kind: 'kcal', calc: 400 }, 'far too few calories');
eq(Macros.check({ kcal: 900, p: 10, c: 10, f: 0 }), { kind: 'kcal', calc: 80 }, 'far too many calories');
eq(Macros.check({ kcal: 231, p: 0, c: 0, f: 0 }), { kind: 'kcal', calc: 0 }, 'alcohol with no macros is refused (Quick add allows an own calorie value)');
eq(Macros.check({ kcal: 0, p: 10, c: 10, f: 10 }), { kind: 'kcal', calc: 170 }, 'missing calories with macros set');

// too many grams in 100 g (checked first)
eq(Macros.check({ kcal: 970, p: 100, c: 30, f: 50 }), { kind: 'sum', total: 180 }, 'the "Custom" test food: 180 g of macros in 100 g is impossible');
eq(Macros.check({ kcal: 404, p: 50, c: 50, f: 1 }), { kind: 'sum', total: 101 }, 'just over 100 g');

print(`\n${passed} passed, ${failed} failed`);
if (failed) throw new Error(failed + ' check(s) failed');
