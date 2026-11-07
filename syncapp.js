'use strict';
/* App glue for Drive sync: engine instance, triggers (open, focus, online, after edits), the status pill and the Settings card.
   The engine itself (sync.js) knows nothing about the UI. */
const SyncApp = (() => {
  const EVER = 'fitscan.drive.everSignedIn';
  const flag = { get: () => { try { return localStorage.getItem(EVER) === '1'; } catch { return false; } }, set: () => { try { localStorage.setItem(EVER, '1'); } catch {} }, clear: () => { try { localStorage.removeItem(EVER); } catch {} } };
  const drive = DriveClient.create({ fetch: (...a) => fetch(...a), getToken: DriveAuth.getToken, store: DriveClient.localStore('fitscan.drive.') });
  const specText = async () => { const r = await fetch('docs/FORMAT.md', { cache: 'no-cache' }); return r.ok ? r.text() : null; };
  const engine = Sync.create({ drive, getS: () => S, persist: () => save(true), uid, today, specText });
  let timer = null, lastRenew = 0, oldDaysAsked = new Set();

  // ---------- running a sync ----------
  async function sync(reason) {
    if (!DriveAuth.getToken()) { paint(); return null; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { paint(); return null; }
    const r = await engine.syncNow({ visibleDate: ui.date });
    if ((r?.pulled || /pulled|merged/.test(r?.library || '')) && !sheetOpen()) rerender();
    paint(); refreshCard();
    return r;
  }
  /** Try to get a token without a prompt (works only if Google still has a session); never throws. */
  async function quietRenew() {
    if (!flag.get() || DriveAuth.getToken() || Date.now() - lastRenew < 60e3) return;
    lastRenew = Date.now(); try { await DriveAuth.renew(); } catch {}
  }
  async function connect() {
    try { await DriveAuth.signIn(); flag.set(); } catch (e) { if (e.kind !== 'superseded') toast(t('Anmeldung fehlgeschlagen: {m}', { m: e.message })); paint(); return; }
    await sync('sign-in');
  }
  async function wake(reason) { await quietRenew(); await sync(reason); }
  window.onLocalSave = () => { clearTimeout(timer); paint(); timer = setTimeout(() => sync('edit'), 2500); };
  window.onRendered = () => {   // looking at a day outside the sync window (14 days back, 7 ahead): fetch it once
    if (ui.tab === 'diary' && (ui.date < addDays(today(), -13) || ui.date > addDays(today(), 7)) && !oldDaysAsked.has(ui.date) && DriveAuth.getToken()) { oldDaysAsked.add(ui.date); sync('old-day'); }
    paint();
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake('focus'); });
  addEventListener('online', () => wake('online')); addEventListener('offline', paint);
  addEventListener('pageshow', e => { if (e.persisted) wake('pageshow'); });

  // ---------- status pill ----------
  function pillInfo() {
    const s = engine.status(), auth = DriveAuth.state(), n = s.pending, off = navigator.onLine === false;
    if (!flag.get() && auth === 'signed-out') return { cls: 'warn', text: t('Mit Drive verbinden'), act: 'connect' };
    if (s.state === 'syncing') return { cls: 'busy', text: t('Synchronisiere…'), act: null };
    if (auth !== 'ok') return { cls: 'warn', text: n ? t('{n} nicht synchronisiert · zum Anmelden tippen', { n }) : t('Zum Anmelden tippen'), act: 'connect' };
    if (off || s.state === 'offline') return { cls: 'warn', text: n ? t('{n} warten · offline', { n }) : t('Offline'), act: null };
    if (s.state === 'error') return { cls: 'err', text: t('Sync-Fehler · tippen'), act: 'sync' };
    if (n) return { cls: 'warn', text: t('{n} nicht synchronisiert', { n }), act: 'sync' };
    return { cls: 'ok', text: t('Synchronisiert'), act: 'sync' };
  }
  function paint() {
    const el = $('#syncPill'); if (!el) return; const p = pillInfo();
    el.className = 'sync-pill ' + p.cls; el.textContent = p.text; el.dataset.act = p.act || ''; el.title = engine.status().lastError || '';
  }
  document.addEventListener('click', e => { const el = e.target.closest('#syncPill'); if (!el) return; el.dataset.act === 'connect' ? connect() : el.dataset.act === 'sync' ? sync('tap') : null; });
  engine.onStatus(paint); DriveAuth.onChange(() => { paint(); refreshCard(); });

  // ---------- settings card ----------
  const fmtTime = ms => ms ? new Date(ms).toLocaleString(LOC(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  function cardHtml() {
    const s = engine.status(), auth = DriveAuth.state(), connected = auth === 'ok';
    const sub = connected ? (s.lastSync ? t('Zuletzt {t}', { t: fmtTime(s.lastSync) }) : t('Verbunden')) : flag.get() ? t('Anmeldung abgelaufen') : t('Nicht verbunden');
    const warn = [...s.warnings, ...Object.entries(s.blocked).map(([d, why]) => t('{d}: nicht synchronisiert ({w})', { d: d, w: why }))];
    return `${navRow('syncGo', connected ? 'repeat' : 'user', connected ? t('Jetzt synchronisieren') : t('Mit Google Drive verbinden'), sub, s.pending ? String(s.pending) : '')}
      ${s.suggestions ? navRow('syncSug', 'sparkle', t('Vorschläge von außerhalb'), t('Änderungen aus Drive, die deine Einträge nicht überschreiben durften'), String(s.suggestions)) : ''}
      ${connected ? navRow('syncOut', 'x', t('Abmelden'), t('Der Zugriff bleibt in deinem Google-Konto, bis du ihn dort entfernst')) : ''}
      ${s.lastError ? `<p class="hint pad warn">${esc(s.lastError)}</p>` : ''}${warn.length ? `<p class="hint pad">${warn.map(esc).join('<br>')}</p>` : ''}`;
  }
  function bindCard() {
    $('#syncGo')?.addEventListener('click', () => DriveAuth.state() === 'ok' ? sync('settings') : connect());
    $('#syncOut')?.addEventListener('click', () => { DriveAuth.signOut(); flag.clear(); toast(t('Abgemeldet')); refreshCard(); paint(); });
    $('#syncSug')?.addEventListener('click', suggestionsSheet);
  }
  function refreshCard() { const c = $('#syncCard'); if (c && ui.tab === 'profile') { c.innerHTML = cardHtml(); bindCard(); } }

  function suggestionsSheet() {
    const list = S.sync.suggestions;
    const row = (sg, i) => { const r = sg.remote, local = (S.entries[sg.date] || []).find(e => e.id === sg.id), name = r?.food || local?.food?.name || '?';
      return `<div class="row-item"><span class="grow"><span class="nm">${esc(name)}</span><span class="sub">${fmtDate(sg.date)} · ${esc(t(sg.reason))}${r ? ` · ${r.status} · ${de(r.qty_g)} g · ${de(r.kcal)} kcal` : ''}</span></span><button class="top-btn" data-dis="${i}">${t('Verwerfen')}</button></div>`; };
    openSheet(`${sheetHead(t('Vorschläge von außerhalb'), t('Diese Änderungen kamen aus Drive und haben deine Einträge nicht überschrieben.'))}
      ${list.length ? `<div class="card list">${list.map(row).join('')}</div>` : `<p class="hint">${t('Keine Vorschläge.')}</p>`}`, sh => {
      $$('[data-dis]', sh).forEach(b => b.onclick = () => { engine.dismissSuggestion(+b.dataset.dis); suggestionsSheet(); refreshCard(); });
    });
  }

  // ---------- start ----------
  paint(); if (flag.get()) wake('start');
  return { engine, drive, sync, connect, cardHtml, bindCard, paint };
})();
window.syncCardHtml = SyncApp.cardHtml; window.bindSyncCard = SyncApp.bindCard;
