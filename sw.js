// Service worker: keeps the app shell available offline (cache-first, same-origin).
// V is the cache version. The deploy workflow stamps it from the commit (see .github/workflows/pages.yml), so every deploy
// gets a fresh cache; bump it by hand only for local testing. tests/security.test.js checks that SHELL lists every file index.html loads.
const V = 'fitscan-v12';
const SHELL = ['./', 'index.html', 'style.css', 'i18n.js', 'foods.js', 'icons.js', 'core.js', 'ui.js', 'usda.js', 'diary.js', 'food.js', 'progress.js', 'settings.js', 'dayfile.js', 'merge.js', 'driveclient.js', 'driveauth.js', 'sync.js', 'syncapp.js', 'docs/FORMAT.md', 'manifest.webmanifest', 'vendor/chart.umd.min.js', 'vendor/zxing.min.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];
self.addEventListener('install', e => {
  // One file at a time: a single missing file must not stop the whole install (cache.addAll is all-or-nothing).
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => console.warn('sw: could not cache', u))))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'fitscan-img').map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(e.request, cp)); return res; }).catch(() => caches.match('index.html'))));
    return;
  }
  if (u.hostname === 'images.openfoodfacts.org') {
    e.respondWith(caches.open('fitscan-img').then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; }))));
  }
});
