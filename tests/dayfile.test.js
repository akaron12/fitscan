'use strict';
/* Run: tests/run.sh   (uses the JavaScriptCore shell that ships with macOS; no Node needed)
   Or by hand: .../JavaScriptCore.framework/Versions/Current/Helpers/jsc dayfile.js tests/dayfile.test.js */
const { parse, serialize, create, toApp, fromApp, emitScalar, parseScalar } = DayFile;
let passed = 0, failed = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) passed++; else { failed++; print('FAIL: ' + msg + '\n   got:      ' + A + '\n   expected: ' + B); } };
const ok = (c, msg) => eq(!!c, true, msg);
const entries = m => parse.entries(m), raws = m => parse.rawItems(m);

const SPEC = `---
date: 2026-11-07
format: meal-log/1
---
# Plan for Friday

\`\`\`yaml
entries:
  - meal: breakfast
    status: planned
    food: Greek yogurt
    qty_g: 200
    kcal: 130
    p: 20
    c: 8
    f: 1
  - id: abc123
    meal: Lunch
    status: Eaten
    food: "Chicken: grilled"
    qty_g: 150
    kcal: 248
    p: 46
    c: 0
    f: 5
    note: skin removed # comment
    rev: 3
\`\`\`

Prepared by Claude.
`;

// 1. basic parse
let m = parse(SPEC);
eq(m.date, '2026-11-07', 'date'); eq(m.format, 'meal-log/1', 'format'); ok(!m.readOnly, 'not read-only');
eq(entries(m).length, 2, 'two entries'); eq(raws(m).length, 0, 'no raw entries'); eq(m.warnings, [], 'no warnings');
eq(entries(m)[0].status, 'planned', 'planned'); eq(entries(m)[0].id, undefined, 'missing id stays missing');
eq(entries(m)[1].meal, 'lunch', 'meal normalised to lowercase'); eq(entries(m)[1].status, 'eaten', 'status normalised');
eq(entries(m)[1].food, 'Chicken: grilled', 'quoted colon kept'); eq(entries(m)[1].note, 'skin removed', 'trailing comment stripped');
eq(entries(m)[1].rev, 3, 'rev');

// 2. round trip keeps prose and entries
let out = serialize(m); ok(out.includes('# Plan for Friday'), 'prose before kept'); ok(out.includes('Prepared by Claude.'), 'prose after kept');
let m2 = parse(out); eq(entries(m2), entries(m), 'entries survive a round trip'); eq(serialize(m2), out, 'serialize is stable (idempotent)');

// 3. unquoted colon => raw preserved verbatim, others still read
const BAD = SPEC.replace('food: "Chicken: grilled"', 'food: Chicken: grilled');
m = parse(BAD); eq(entries(m).length, 1, 'good entry still read'); eq(raws(m).length, 1, 'bad entry kept raw');
ok(raws(m)[0].raw.includes('food: Chicken: grilled'), 'raw text preserved'); ok(/colon/.test(raws(m)[0].error), 'error mentions colon');
out = serialize(m); ok(out.includes('    food: Chicken: grilled'), 'raw written back untouched'); eq(raws(parse(out)).length, 1, 'still raw after rewrite');

// 4. unknown keys pass through
m = parse(SPEC.replace('    rev: 3', '    rev: 3\n    recipe_url: https://example.com/r\n    cook_min: 20'));
eq(entries(m)[1].x, { recipe_url: 'https://example.com/r', cook_min: 20 }, 'unknown keys collected'); out = serialize(m);
ok(out.includes('recipe_url: "https://example.com/r"') || out.includes('recipe_url: https'), 'unknown key written back'); ok(out.includes('cook_min: 20'), 'unknown number written back');
eq(entries(parse(out))[1].x, entries(m)[1].x, 'unknown keys survive round trip');

// 5. scalars needing quotes round trip
for (const s of ['Soup: tomato', '#1 protein bar', '123', 'true', ' lead', 'trail ', 'say "hi"', "it's", 'null', '', 'a\\b', '- dash', 'line1\nline2', 'ok plain', 'Müsli 5%']) eq(parseScalar(emitScalar(s)), s, 'scalar round trip: ' + JSON.stringify(s));
eq(parseScalar('42'), 42, 'int'); eq(parseScalar('4.5'), 4.5, 'float'); eq(parseScalar('~'), null, 'tilde null'); eq(parseScalar("'a''b'"), "a'b", 'single quotes');

// 6. validation failures go to raw, never crash
const mk = body => `---\ndate: 2026-11-07\nformat: meal-log/1\n---\n\`\`\`yaml\nentries:\n${body}\n\`\`\`\n`;
const bad = {
  'invalid meal': '  - meal: brunch\n    status: planned\n    food: X\n    qty_g: 1\n    kcal: 1',
  'missing status': '  - meal: lunch\n    food: X\n    qty_g: 1\n    kcal: 1',
  'qty as text': '  - meal: lunch\n    status: eaten\n    food: X\n    qty_g: lots\n    kcal: 1',
  'kcal null': '  - meal: lunch\n    status: eaten\n    food: X\n    qty_g: 100\n    kcal: null',
  'zero qty': '  - meal: lunch\n    status: eaten\n    food: X\n    qty_g: 0\n    kcal: 5',
  'tab indent': '  - meal: lunch\n\tstatus: eaten\n    food: X\n    qty_g: 1\n    kcal: 1',
  'flow list': '  - meal: lunch\n    status: eaten\n    food: [a, b]\n    qty_g: 1\n    kcal: 1',
  'nested map': '  - meal: lunch\n    status: eaten\n    food: X\n    qty_g: 1\n    kcal: 1\n    extra:\n      a: 1',
  'duplicate key': '  - meal: lunch\n    meal: dinner\n    status: eaten\n    food: X\n    qty_g: 1\n    kcal: 1',
  'negative macro': '  - meal: lunch\n    status: eaten\n    food: X\n    qty_g: 1\n    kcal: 1\n    p: -3',
};
for (const [name, body] of Object.entries(bad)) { const r = parse(mk(body)); eq([entries(r).length, raws(r).length], [0, 1], 'raw: ' + name); ok(serialize(r).includes(body.split('\n')[0]), 'raw kept: ' + name); }

// 7. macros optional (default 0)
m = parse(mk('  - meal: snacks\n    status: planned\n    food: Apple\n    qty_g: 180\n    kcal: 95')); eq([entries(m)[0].p, entries(m)[0].c, entries(m)[0].f], [0, 0, 0], 'p/c/f default to 0');

// 8. newer format => read-only
m = parse(SPEC.replace('meal-log/1', 'meal-log/2')); ok(m.readOnly, 'newer format is read-only'); ok(m.warnings.some(w => /newer/.test(w)), 'warning about newer format');
ok(!parse(SPEC.replace('meal-log/1', 'meal-log/0')).readOnly, 'older format is fine');

// 9. no yaml block / unclosed block / prose only
m = parse('---\ndate: 2026-11-07\nformat: meal-log/1\n---\nJust notes, no block.\n'); eq(entries(m).length, 0, 'no entries'); ok(m.warnings.length > 0, 'warns about missing block'); ok(serialize(m).includes('Just notes'), 'notes preserved on write');
m = parse('---\ndate: 2026-11-07\nformat: meal-log/1\n---\n```yaml\nentries:\n  - meal: lunch\n'); ok(m.warnings.some(w => /not closed/.test(w)), 'unclosed block warned');
m = parse(''); eq([m.date, entries(m).length], [null, 0], 'empty file'); m = parse(null); eq(entries(m).length, 0, 'null input');

// 10. block that is not an entries list is kept untouched and refuses to be rewritten
m = parse(mk('').replace('entries:\n', 'meals:\n  - lunch\n')); ok(m.readOnly && m.blockRaw !== null, 'unknown block is read-only');
let threw = false; try { serialize(m); } catch { threw = true; } ok(threw, 'serialize refuses a file it could not read');
m = parse(mk('').replace('entries:\n', 'entries:\n  just text\n')); ok(m.readOnly && m.blockRaw !== null, 'entries that is not a list is read-only');

// 11. CRLF, yml fence, comments, blank lines between items
m = parse(SPEC.replace(/\n/g, '\r\n').replace('```yaml', '```yml')); eq(entries(m).length, 2, 'CRLF and yml fence read');
m = parse(mk('  # a comment\n  - meal: lunch\n    status: eaten\n    food: A\n    qty_g: 10\n    kcal: 20\n\n  - meal: dinner\n    status: eaten\n    food: B\n    qty_g: 10\n    kcal: 20')); eq(entries(m).length, 2, 'comments and blank lines tolerated');

// 12. empty list
m = parse(mk('').replace('entries:\n', 'entries: []\n')); eq([entries(m).length, m.warnings.length], [0, 0], 'entries: [] is fine'); ok(serialize(m).includes('entries: []'), 'empty list written');

// 13. duplicate ids: later one loses its id
m = parse(mk('  - id: a\n    meal: lunch\n    status: eaten\n    food: A\n    qty_g: 10\n    kcal: 20\n  - id: a\n    meal: lunch\n    status: eaten\n    food: B\n    qty_g: 10\n    kcal: 20'));
eq([entries(m)[0].id, entries(m)[1].id], ['a', undefined], 'duplicate id dropped on the later entry'); ok(m.warnings.some(w => /duplicate id/.test(w)), 'duplicate warned');

// 14. tombstones
m = parse(mk('  - id: gone1\n    meal: lunch\n    deleted: true\n    rev: 4')); eq([entries(m)[0].deleted, entries(m)[0].rev, entries(m)[0].id], [true, 4, 'gone1'], 'tombstone parsed');
ok(serialize(m).includes('deleted: true'), 'tombstone written'); m = parse(mk('  - meal: lunch\n    deleted: true')); eq(raws(m).length, 1, 'tombstone without id is invalid');

// 15. multiple yaml blocks warn, second stays untouched
m = parse(SPEC + '\n```yaml\nentries:\n  - meal: dinner\n```\n'); ok(m.warnings.some(w => /more than one/.test(w)), 'second block warned'); ok(serialize(m).includes('meal: dinner'), 'second block preserved');

// 16. create() and app mapping
const fresh = create('2026-11-08', [{ meal: 'dinner', status: 'planned', food: 'Salmon', qty_g: 150, kcal: 312, p: 33, c: 0, f: 19 }]);
out = serialize(fresh); ok(out.startsWith('---\ndate: 2026-11-08\nformat: meal-log/1\n---\n```yaml\nentries:\n  - meal: dinner'), 'new file layout'); eq(entries(parse(out))[0].food, 'Salmon', 'new file parses back');
const appE = toApp(entries(parse(SPEC))[1]);
eq([appE.g, appE.status, appE.meal, appE.rev, appE.food.name, appE.food.src], [150, 'eaten', 'lunch', 3, 'Chicken: grilled', 'plan'], 'toApp basics');
ok(Math.abs(appE.food.n.kcal - 165.33) < 0.1 && Math.abs(appE.food.n.p - 30.67) < 0.1, 'per-100g nutrition derived'); eq(appE.x, { note: 'skin removed' }, 'note carried in x');
const back = fromApp({ ...appE, id: 'abc123' }); eq([back.kcal, back.p, back.qty_g, back.status, back.rev, back.note], [248, 46, 150, 'eaten', 3, 'skin removed'], 'fromApp restores values');
const full = fromApp({ id: 'z', meal: 'snacks', g: 50, rev: 2, food: { name: 'Bar', n: { kcal: 400, p: 20, c: 40, f: 15, fib: 10, sug: 20, salt: 1 }, ns: 'b', nova: 4, code: '123' } });
eq([full.kcal, full.fiber, full.sugar, full.salt, full.nutriscore, full.nova, full.barcode], [200, 5, 10, 0.5, 'b', 4, '123'], 'optional nutrition written');
eq(entries(parse(serialize(create('2026-11-09', [full]))))[0].barcode, '123', 'barcode round trips as text');

print(`\n${passed} passed, ${failed} failed`);
if (failed) throw new Error(failed + ' test(s) failed'); // jsc ignores quit(code); an uncaught error gives a non-zero exit
