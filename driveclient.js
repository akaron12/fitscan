'use strict';
/* Google Drive client for the Meal Tracker folder (AI Memory/Meal Tracker/).
   Plain script: attaches to globalThis.DriveClient. All I/O is injected so it can be tested against a fake Drive:
     DriveClient.create({ fetch, getToken, sleep?, store? })
   Rules (see spec-meal-tracker.md):
   - Never create "AI Memory" (it is the user's folder); creating "Meal Tracker" inside it is fine.
   - Drive allows duplicate file names, so we cache file ids, detect duplicates and merge them into the oldest copy.
   - A duplicate is only trashed (recoverable) after the merged content has been written successfully.
   - Writes can check that the file was not modified since we read it (conflict -> caller re-reads and merges). */
(function (root) {
  const API = 'https://www.googleapis.com', FOLDER = 'application/vnd.google-apps.folder';
  const ROOT_NAME = 'AI Memory', APP_FOLDER = 'Meal Tracker';
  const FIELDS = 'id,name,mimeType,parents,createdTime,modifiedTime,trashed';
  const DAY_FILE = /^\d{4}-\d{2}-\d{2}\.md$/;

  /** kind: auth | network | notfound | rate | server | forbidden | conflict | noroot | other */
  class DriveError extends Error { constructor(kind, message, status) { super(message); this.name = 'DriveError'; this.kind = kind; this.status = status; } }
  const qe = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");   // escape a value inside a Drive query string
  const byAge = (a, b) => a.createdTime < b.createdTime ? -1 : a.createdTime > b.createdTime ? 1 : a.id < b.id ? -1 : 1;
  const memStore = () => { const m = new Map(); return { get: k => m.has(k) ? m.get(k) : null, set: (k, v) => m.set(k, v), remove: k => m.delete(k) }; };
  function localStore(prefix = 'fitscan.drive.') {
    const safe = fn => { try { return fn(); } catch { return null; } };
    return { get: k => safe(() => localStorage.getItem(prefix + k)), set: (k, v) => safe(() => localStorage.setItem(prefix + k, v)), remove: k => safe(() => localStorage.removeItem(prefix + k)) };
  }
  let boundaryN = 0;

  function create({ fetch: fetchFn, getToken, sleep = ms => new Promise(r => setTimeout(r, ms)), store = memStore() }) {
    // ---------- HTTP with retry ----------
    async function req(path, init = {}, tries = 0) {
      const token = getToken(); if (!token) throw new DriveError('auth', 'Not signed in');
      let res;
      try { res = await fetchFn(API + path, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + token } }); }
      catch (e) { throw new DriveError('network', 'Network error: ' + (e.message || e)); }
      if (res.ok) return res;
      const text = await res.text().catch(() => ''), s = res.status;
      if (s === 401) throw new DriveError('auth', 'Sign-in expired', s);
      const rateLimited = s === 429 || (s === 403 && /rate ?limit|quota/i.test(text));
      if ((rateLimited || s >= 500) && tries < 3) { await sleep(500 * 2 ** tries); return req(path, init, tries + 1); }
      const msg = `Drive HTTP ${s}: ${text.slice(0, 200)}`;
      if (rateLimited) throw new DriveError('rate', msg, s);
      if (s >= 500) throw new DriveError('server', msg, s);
      if (s === 404) throw new DriveError('notfound', msg, s);
      if (s === 403) throw new DriveError('forbidden', msg, s);
      throw new DriveError('other', msg, s);
    }
    const json = async (path, init) => (await req(path, init)).json();
    const jsonInit = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    // ---------- Metadata ----------
    async function getMeta(id) { return json(`/drive/v3/files/${encodeURIComponent(id)}?fields=${FIELDS}`); }
    /** Meta for a cached id, or null when the file is gone, trashed or not in the expected folder. */
    async function verify(id, { parent } = {}) {
      try { const m = await getMeta(id); return m.trashed || (parent && !(m.parents || []).includes(parent)) ? null : m; }
      catch (e) { if (e.kind === 'notfound') return null; throw e; }
    }
    async function list(q, { orderByAge = false } = {}) {
      const out = []; let pageToken = '';
      do {
        const j = await json(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(`nextPageToken,files(${FIELDS})`)}&pageSize=1000${orderByAge ? '&orderBy=createdTime' : ''}${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`);
        out.push(...(j.files || [])); pageToken = j.nextPageToken || '';
      } while (pageToken);
      return out.sort(byAge);
    }
    const listFolders = (name, parent) => list(`name='${qe(name)}' and mimeType='${FOLDER}' and trashed=false${parent ? ` and '${parent}' in parents` : ''}`, { orderByAge: true });

    // ---------- Folders ----------
    /** Finds AI Memory (never creates it) and Meal Tracker (created if missing). Cached ids are re-checked. */
    async function resolveFolders() {
      const warnings = []; let rootId = store.get('rootId'), folderId = store.get('folderId');
      if (rootId && !(await verify(rootId))) { rootId = null; folderId = null; store.remove('rootId'); store.remove('folderId'); }
      if (!rootId) {
        const roots = await listFolders(ROOT_NAME);
        if (!roots.length) throw new DriveError('noroot', `No folder named "${ROOT_NAME}" was found in this Google account's Drive. Check that you signed in with the right account.`);
        if (roots.length > 1) warnings.push(`Found ${roots.length} folders named "${ROOT_NAME}"; using the oldest one.`);
        rootId = roots[0].id; store.set('rootId', rootId); folderId = null;
      }
      if (folderId && !(await verify(folderId, { parent: rootId }))) { folderId = null; store.remove('folderId'); }
      if (!folderId) {
        let found = await listFolders(APP_FOLDER, rootId);
        if (!found.length) {
          await json('/drive/v3/files?fields=id', jsonInit('POST', { name: APP_FOLDER, mimeType: FOLDER, parents: [rootId] }));
          found = await listFolders(APP_FOLDER, rootId);   // re-list: another device may have created one at the same time
        }
        if (found.length > 1) warnings.push(`Found ${found.length} folders named "${APP_FOLDER}"; using the oldest one. Files in the others are not synced.`);
        folderId = found[0].id; store.set('folderId', folderId);
      }
      return { rootId, folderId, warnings };
    }

    // ---------- Files ----------
    async function listFiles(folderId, { modifiedAfter } = {}) {
      let q = `'${folderId}' in parents and trashed=false and mimeType!='${FOLDER}'`;
      if (modifiedAfter) q += ` and modifiedTime > '${modifiedAfter}'`;
      return list(q);
    }
    const findByName = (folderId, name) => list(`name='${qe(name)}' and '${folderId}' in parents and trashed=false and mimeType!='${FOLDER}'`, { orderByAge: true });
    /** { 'name.md': [oldest, ...newer] } */
    function groupByName(files) { const g = {}; for (const f of [...files].sort(byAge)) (g[f.name] ||= []).push(f); return g; }
    async function readFile(id) { return (await req(`/drive/v3/files/${encodeURIComponent(id)}?alt=media`)).text(); }

    /** The file for a name: a still-valid cached id first (one cheap request, duplicates are not looked for: the
        sync pull groups duplicates from its folder listing), otherwise a lookup. Returns { file, duplicates } (file is null when absent). */
    async function locate(folderId, name) {
      const key = 'file:' + name, cached = store.get(key);
      if (cached) { const m = await verify(cached, { parent: folderId }); if (m) return { file: m, duplicates: [] }; store.remove(key); }
      const all = await findByName(folderId, name);
      if (all.length) store.set(key, all[0].id);
      return { file: all[0] || null, duplicates: all.slice(1) };
    }

    /** Create or update a text file. Update with expectedModifiedTime fails with kind "conflict" if the file changed meanwhile.
        Returns { file, duplicates } (duplicates only appear after a create that raced with another writer). */
    async function writeFile({ id, name, folderId, text, expectedModifiedTime }) {
      if (id) {
        if (expectedModifiedTime) { const m = await getMeta(id); if (m.modifiedTime !== expectedModifiedTime) throw new DriveError('conflict', `${m.name} changed on Drive since it was read`); }
        const file = await json(`/upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=media&fields=${FIELDS}`, { method: 'PATCH', headers: { 'Content-Type': 'text/markdown; charset=UTF-8' }, body: text });
        return { file, duplicates: [] };
      }
      const b = 'mt' + Date.now().toString(36) + (++boundaryN);
      const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId], mimeType: 'text/markdown' })}\r\n--${b}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n${text}\r\n--${b}--`;
      const made = await json(`/upload/drive/v3/files?uploadType=multipart&fields=${FIELDS}`, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
      const all = await findByName(folderId, name);   // Drive allows duplicate names: check we are the only one
      const file = all.length ? all[0] : made;
      store.set('file:' + name, file.id);
      return { file, duplicates: all.filter(f => f.id !== file.id) };
    }
    async function trash(id) { await json(`/drive/v3/files/${encodeURIComponent(id)}?fields=id`, jsonInit('PATCH', { trashed: true })); }

    /** Merge same-named duplicates into the oldest file (files[0]) and trash the rest. mergeFn(texts, files) returns the merged text.
        Nothing is trashed unless the merged content was written successfully. */
    async function resolveDuplicates(files, mergeFn) {
      const sorted = [...files].sort(byAge); if (sorted.length < 2) return { keep: sorted[0] || null, trashed: [] };
      const texts = await Promise.all(sorted.map(f => readFile(f.id)));
      const merged = await mergeFn(texts, sorted);
      const { file } = await writeFile({ id: sorted[0].id, text: merged, expectedModifiedTime: sorted[0].modifiedTime });
      const trashed = []; for (const f of sorted.slice(1)) { await trash(f.id); trashed.push(f.id); }
      store.set('file:' + sorted[0].name, file.id);
      return { keep: file, trashed };
    }

    /** App-owned spec file (FORMAT.md): created if missing, refreshed only while it still starts with our marker. */
    async function syncSpecFile(folderId, name, text, marker) {
      const { file } = await locate(folderId, name);
      if (!file) { await writeFile({ name, folderId, text }); return 'created'; }
      const current = await readFile(file.id);
      if (current === text) return 'unchanged';
      if (!current.startsWith(marker)) return 'skipped';   // someone else edited it: leave it alone
      await writeFile({ id: file.id, text, expectedModifiedTime: file.modifiedTime }); return 'updated';
    }

    const forgetCache = () => { for (const k of ['rootId', 'folderId']) store.remove(k); };
    return { resolveFolders, listFiles, findByName, groupByName, readFile, locate, writeFile, trash, resolveDuplicates, syncSpecFile, getMeta, verify, forgetCache, store };
  }
  root.DriveClient = { create, DriveError, localStore, memStore, DAY_FILE, ROOT_NAME, APP_FOLDER };
})(typeof globalThis !== 'undefined' ? globalThis : this);
