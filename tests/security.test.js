'use strict';
/* Static checks on the shipped files (run with tests/run.sh; uses jsc's read()). They keep three promises:
   1. the Content-Security-Policy stays strict and lists every host the code talks to;
   2. no inline scripts or inline event handlers sneak back in (the CSP would silently break them);
   3. the service worker caches every file index.html loads (a forgotten file means a broken offline app). */
let passed = 0, failed = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) passed++; else { failed++; print('FAIL: ' + msg + '\n   got:      ' + A + '\n   expected: ' + B); } };
const ok = (c, msg) => eq(!!c, true, msg);

const html = read('index.html'), sw = read('sw.js');
const APP_JS = ['i18n.js', 'icons.js', 'core.js', 'ui.js', 'usda.js', 'swipe.js', 'macros.js', 'recents.js', 'diary.js', 'food.js', 'progress.js', 'settings.js', 'dayfile.js', 'merge.js', 'driveclient.js', 'driveauth.js', 'sync.js', 'syncapp.js', 'sw.js'];

// ---- 1. CSP ----
const cspM = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html); ok(cspM, 'index.html has a Content-Security-Policy meta tag');
const csp = cspM ? cspM[1] : '', dir = {}; csp.split(';').map(s => s.trim()).filter(Boolean).forEach(d => { const [k, ...v] = d.split(/\s+/); dir[k] = v; });
eq(dir['default-src'], ["'self'"], "default-src is 'self'"); eq(dir['object-src'], ["'none'"], 'no plugins'); eq(dir['base-uri'], ["'none'"], 'no <base> tricks'); eq(dir['form-action'], ["'none'"], 'no form posts');
ok(dir['script-src'] && !dir['script-src'].includes("'unsafe-inline'") && !dir['script-src'].includes("'unsafe-eval'"), 'script-src allows neither inline nor eval');
eq(dir['script-src'], ["'self'", 'https://accounts.google.com/gsi/client'], 'scripts: own files and Google sign-in only');
ok(!(dir['style-src-elem'] || []).includes("'unsafe-inline'"), 'style elements are not inline-able (only style attributes are)'); eq(dir['style-src-attr'], ["'unsafe-inline'"], 'inline style attributes (bars/rings) are allowed');
ok(!csp.includes('*') , 'no wildcards'); ok(!/http:\/\//.test(csp), 'https only');

// every host the code talks to must be in the CSP
const hostsIn = src => [...new Set((src.match(/https?:\/\/[a-zA-Z0-9.-]+/g) || []))];
const allowed = csp.match(/https:\/\/[a-zA-Z0-9.-]+/g) || [];
const IGNORE = new Set(['https://opendatacommons.org', 'https://fdc.nal.usda.gov']);   // only appear as plain links / text, never fetched
for (const f of APP_JS) for (const h of hostsIn(read(f))) if (!IGNORE.has(h)) ok(allowed.includes(h), `${f} uses ${h}: it must be listed in the CSP`);
ok(allowed.includes('https://images.openfoodfacts.org'), 'product images host allowed');

// ---- 2. no inline scripts or handlers ----
const inlineScripts = (html.match(/<script(?![^>]*\ssrc=)[^>]*>/g) || []); eq(inlineScripts, [], 'no inline <script> in index.html');
ok(!/\son[a-z]+\s*=\s*["']/i.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'no inline event handler attributes in index.html');
for (const f of APP_JS) { const src = read(f); ok(!/\son(click|error|load|input|change|submit|mouse[a-z]+|key[a-z]+|focus|blur)\s*=\s*["'\\]/i.test(src.replace(/\.on[a-z]+\s*=\s*/g, '')), `${f}: no inline on*= handler in HTML strings`); ok(!/javascript:/i.test(src), `${f}: no javascript: URLs`); ok(!/\beval\s*\(|new Function\s*\(/.test(src), `${f}: no eval / new Function`); ok(!/document\.write/.test(src), `${f}: no document.write`); }

// A key handler must never return false: browsers read that as "cancel the keypress", which silently blocks typing (this hit the quantity
// box on iPhone: `qi.onkeydown = e => e.key === 'Enter' && save()` returns false for every other key). Use a block body: `e => { if (...) ... }`.
for (const f of APP_JS) { const bad = [...read(f).matchAll(/\.on(key(?:down|up|press))\s*=\s*(?:\([^)]*\)|\w+)\s*=>(?!\s*\{)[^\n;]*/g)].map(m => m[0].slice(0, 80)); eq(bad, [], `${f}: key handlers use a block body (an expression body can return false and cancel typing)`); }

// ---- 3. service worker cache list vs index.html ----
const shell = eval(/const SHELL = (\[[^\]]*\])/.exec(sw)[1]);
const loaded = [...html.matchAll(/<script[^>]+src="([^"]+)"/g), ...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map(m => m[1]).filter(u => !/^https?:/.test(u));
for (const u of loaded) { if (u.endsWith('.svg') || u.includes('favicon')) continue; ok(shell.includes(u), `service worker caches ${u}`); }
ok(shell.includes('docs/FORMAT.md'), 'FORMAT.md is cached (the app uploads it to Drive)'); ok(/^const V = '[^']+';/m.test(sw), "sw.js has a stampable 'const V = ...;' line");
for (const f of shell) if (f !== './') ok(!!tryRead(f), `cached file exists: ${f}`);
function tryRead(f) { try { return f.match(/\.(png|svg)$/) ? 'binary' : read(f); } catch { return null; } }
// the workflow stamps with sed on exactly that line
const wf = read('.github/workflows/pages.yml'); ok(wf.includes("^const V = '[^']*'"), 'workflow stamps the same line shape that sw.js has');

print(`\n${passed} passed, ${failed} failed`);
if (failed) throw new Error(failed + ' check(s) failed');
