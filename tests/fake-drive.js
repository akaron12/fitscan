'use strict';
/* A tiny in-memory stand-in for the parts of the Google Drive v3 REST API that driveclient.js uses.
   Supports: files.list (the q patterns we use, orderBy createdTime, paging), files.get (meta + alt=media),
   files.create (metadata and multipart upload), media update, trash, plus fault injection. */
function FakeDrive({ pageSize = 100 } = {}) {
  const files = new Map(); let n = 0, tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 0, 1) + (++tick) * 60000).toISOString();
  const d = { files, calls: [], failQueue: [], networkDown: false, beforeRequest: null, pageSize, token: 'tok' };
  const id = () => 'id' + (++n);
  d.add = (name, { parents = [], mimeType = 'text/markdown', content = '', trashed = false } = {}) => {
    const f = { id: id(), name, parents, mimeType, content, trashed, createdTime: stamp(), modifiedTime: null }; f.modifiedTime = f.createdTime; files.set(f.id, f); return f;
  };
  d.folder = (name, parents = [], opts = {}) => d.add(name, { ...opts, parents, mimeType: 'application/vnd.google-apps.folder' });
  d.failNext = (status, count = 1, body = '') => { for (let i = 0; i < count; i++) d.failQueue.push({ status, body }); };
  d.count = pred => d.calls.filter(pred).length;
  const meta = f => ({ id: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents, createdTime: f.createdTime, modifiedTime: f.modifiedTime, trashed: f.trashed, size: String(f.content.length) });
  const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => (typeof body === 'string' ? JSON.parse(body) : body), text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
  const unq = s => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');

  // jsc has no URL class: a tiny parser for https://host/path?query
  const parseUrl = url => {
    const m = /^https?:\/\/[^/]+([^?#]*)(?:\?([^#]*))?/.exec(url), params = {};
    for (const kv of (m[2] || '').split('&').filter(Boolean)) { const i = kv.indexOf('='); params[decodeURIComponent(kv.slice(0, i < 0 ? kv.length : i))] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); }
    return { pathname: m[1], search: m[2] ? '?' + m[2] : '', searchParams: { get: k => (k in params ? params[k] : null) } };
  };
  d.fetch = async (url, init = {}) => {
    const u = parseUrl(url), path = u.pathname, method = (init.method || 'GET').toUpperCase(), headers = init.headers || {};
    d.calls.push({ method, path, query: u.search, auth: headers.Authorization });
    if (d.networkDown) throw new TypeError('Failed to fetch');
    if (d.beforeRequest) await d.beforeRequest({ method, path, init });
    if (d.failQueue.length) { const f = d.failQueue.shift(); return resp(f.status, f.body || { error: { message: 'injected ' + f.status } }); }
    if (headers.Authorization !== 'Bearer ' + d.token) return resp(401, { error: { message: 'Invalid Credentials' } });
    let m;
    if (method === 'GET' && path === '/drive/v3/files') {
      const q = u.searchParams.get('q') || '';
      let list = [...files.values()];
      if (/trashed=false/.test(q)) list = list.filter(f => !f.trashed);
      let r;
      if ((r = /name='((?:[^'\\]|\\.)*)'/.exec(q))) list = list.filter(f => f.name === unq(r[1]));
      if ((r = /mimeType='([^']*)'/.exec(q))) list = list.filter(f => f.mimeType === r[1]);
      if ((r = /mimeType!='([^']*)'/.exec(q))) list = list.filter(f => f.mimeType !== r[1]);
      if ((r = /'([^']*)' in parents/.exec(q))) list = list.filter(f => f.parents.includes(r[1]));
      if ((r = /modifiedTime > '([^']*)'/.exec(q))) list = list.filter(f => f.modifiedTime > r[1]);
      list.sort((a, b) => a.createdTime < b.createdTime ? -1 : 1);
      const size = Math.min(+u.searchParams.get('pageSize') || 100, d.pageSize), from = +(u.searchParams.get('pageToken') || 0), page = list.slice(from, from + size);
      return resp(200, { files: page.map(meta), ...(from + size < list.length ? { nextPageToken: String(from + size) } : {}) });
    }
    if (method === 'GET' && (m = /^\/drive\/v3\/files\/([^/]+)$/.exec(path))) {
      const f = files.get(m[1]); if (!f) return resp(404, { error: { message: 'File not found' } });
      return u.searchParams.get('alt') === 'media' ? resp(200, f.content) : resp(200, meta(f));
    }
    if (method === 'POST' && path === '/drive/v3/files') { const b = JSON.parse(init.body), f = d.add(b.name, { parents: b.parents || [], mimeType: b.mimeType || 'text/plain' }); return resp(200, meta(f)); }
    if (method === 'POST' && path === '/upload/drive/v3/files') {
      const ct = headers['Content-Type'] || '', bd = /boundary=(.+)$/.exec(ct)[1], parts = init.body.split('--' + bd).filter(p => /Content-Type/i.test(p));
      const metaJson = JSON.parse(parts[0].split(/\r\n\r\n/)[1].replace(/\r\n$/, '')), content = parts[1].split(/\r\n\r\n/).slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
      const f = d.add(metaJson.name, { parents: metaJson.parents || [], mimeType: metaJson.mimeType || 'text/plain', content }); return resp(200, meta(f));
    }
    if (method === 'PATCH' && (m = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(path))) {
      const f = files.get(m[1]); if (!f) return resp(404, { error: { message: 'File not found' } });
      f.content = init.body; f.modifiedTime = stamp(); return resp(200, meta(f));
    }
    if (method === 'PATCH' && (m = /^\/drive\/v3\/files\/([^/]+)$/.exec(path))) {
      const f = files.get(m[1]); if (!f) return resp(404, { error: { message: 'File not found' } });
      const b = JSON.parse(init.body); if ('trashed' in b) f.trashed = !!b.trashed; f.modifiedTime = stamp(); return resp(200, meta(f));
    }
    return resp(400, { error: { message: 'fake drive: unsupported ' + method + ' ' + path } });
  };
  return d;
}
globalThis.FakeDrive = FakeDrive;
