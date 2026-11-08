'use strict';
/* FitScan – UI shell: navigation, sheets, toasts and shared components. */
let ui = { tab: 'diary', date: today(), targetMeal: null, libTab: 'recent', query: '', chart: { metric: 'kcal', range: 30, type: 'bar', smooth: 'ma7' } };

// ---------- Toast ----------
function toast(msg, action, ms) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { el.classList.remove('show'); action.fn(); };
  el.classList.toggle('actionable', !!action); el.classList.add('show');
  clearTimeout(el._h); el._h = setTimeout(() => el.classList.remove('show'), ms || (action ? 5000 : 2200));
}
const undoable = (msg, fn) => toast(msg, { label: t('Rückgängig'), fn });

// ---------- Sheets ----------
let sheetTimer = null;
const sheetHead = (title, sub = '', extra = '') => `<header class="sh-head"><div class="grow"><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${extra}<button class="close" data-close aria-label="${t('Schließen')}">${I('x')}</button></header>`;
function openSheet(html, onMount, { keepScroll = false } = {}) {
  clearTimeout(sheetTimer);
  const sh = $('#sheet'), bd = $('#sheetBackdrop'), top = sh.scrollTop, wasOpen = !sh.classList.contains('hidden');
  sh.innerHTML = '<div class="grab"></div>' + html;
  sh.classList.remove('hidden', 'closing'); bd.classList.remove('hidden', 'closing');
  sh.classList.toggle('instant', wasOpen); sh.style.transform = '';
  sh.scrollTop = keepScroll ? top : 0;
  $$('[data-close]', sh).forEach(b => b.onclick = closeSheet);
  onMount && onMount(sh);
}
function closeSheet() {
  const sh = $('#sheet'), bd = $('#sheetBackdrop'); if (sh.classList.contains('hidden')) return;
  sh.classList.add('closing'); bd.classList.add('closing');
  sheetTimer = setTimeout(() => { sh.classList.add('hidden'); bd.classList.add('hidden'); sh.classList.remove('closing'); bd.classList.remove('closing'); sh.innerHTML = ''; }, 200);
}
const sheetOpen = () => !$('#sheet').classList.contains('hidden');
$('#sheetBackdrop').onclick = closeSheet;
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#scanner').classList.contains('hidden')) closeScanner(); else closeSheet(); } });
(() => { // drag the grabber / header down to dismiss
  const sh = $('#sheet'); let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { if (sh.scrollTop > 0 || !e.target.closest('.grab, .sh-head') || e.target.closest('button, input, select')) return; y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sh.addEventListener('touchend', () => { if (y0 == null) return; y0 = null; sh.style.transition = ''; if (dy > 90) closeSheet(); else sh.style.transform = ''; });
})();
function confirmSheet({ title, text = '', ok, danger = false }) {
  return new Promise(res => {
    openSheet(`${sheetHead(title)}${text ? `<p class="lead">${text}</p>` : ''}<div class="stack"><button class="btn block ${danger ? 'danger' : ''}" id="cfOk">${ok}</button><button class="btn block secondary" id="cfNo">${t('Abbrechen')}</button></div>`, () => {
      $('#cfOk').onclick = () => { closeSheet(); res(true); };
      $('#cfNo').onclick = () => { closeSheet(); res(false); };
    });
  });
}

// ---------- Theme ----------
const mqDark = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const th = S.settings.theme, dark = th === 'dark' || (th === 'system' && mqDark.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('meta[name=theme-color]').content = dark ? '#000000' : '#ffffff';
}
mqDark.addEventListener?.('change', () => { if (S.settings.theme === 'system') { applyTheme(); render(); } });

// ---------- Navigation ----------
const TITLES = { diary: 'Tagebuch', library: 'Lebensmittel', progress: 'Fortschritt', profile: 'Einstellungen' };
function go(tab, opts = {}) { if (tab !== 'library') endMulti(); ui.tab = tab; Object.assign(ui, opts); window.scrollTo(0, 0); render(); }
function render() {
  $$('.tabbar [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.tab));
  $('#pageTitle').textContent = t(TITLES[ui.tab]); $('#pageSub').textContent = ''; $('#topActions').innerHTML = '';
  ({ diary: renderDiary, library: renderLibrary, progress: renderProgress, profile: renderProfile })[ui.tab]($('#view'));
  $('#pageSub').classList.toggle('hidden', !$('#pageSub').textContent);
  try { window.onRendered?.(); } catch {}
}
function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y); }
function topAction(label, fn) { const b = Object.assign(document.createElement('button'), { className: 'top-btn', textContent: label }); b.onclick = fn; $('#topActions').appendChild(b); }
$$('.tabbar [data-tab]').forEach(b => b.onclick = () => b.dataset.tab === 'scan' ? openScanner() : go(b.dataset.tab));
addEventListener('scroll', () => $('.topbar').classList.toggle('scrolled', scrollY > 4), { passive: true });

// Advance the date after midnight if the app stays open
let lastToday = today();
const dayTick = () => { const d = today(); if (d !== lastToday) { if (ui.date === lastToday) ui.date = d; lastToday = d; if (!$('#onb')) rerender(); } };
setInterval(dayTick, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) dayTick(); });

// ---------- Components ----------
function ring(val, goal, size, stroke, color = 'var(--acc)') {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, pct = Math.min(1, goal ? val / goal : 0), c = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${r}" stroke="var(--track)" stroke-width="${stroke}" fill="none"/>
  <circle cx="${c}" cy="${c}" r="${r}" stroke="${val > goal * 1.02 ? 'var(--danger)' : color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>`;
}
function foodIcon(f, big = false) {
  const cls = `thumb${big ? ' big' : ''}`, initial = esc(String(f.name || '?').trim().charAt(0).toUpperCase());
  if (f.img) return `<img class="${cls} img" src="${esc(f.img)}" loading="lazy" alt="${initial}">`;   // a broken image falls back to the initial: see the capture listener below (no inline handlers: CSP)
  const ic = f.src === 'recipe' ? 'utensils' : f.src === 'custom' ? 'pen' : f.src === 'quick' ? 'zap' : null;
  return `<div class="${cls}">${ic ? I(ic) : initial}</div>`;
}
// Image load errors do not bubble, so listen in the capture phase. Replaces the broken <img> by a lettered tile.
document.addEventListener('error', e => {
  const im = e.target; if (!(im instanceof HTMLImageElement) || !im.classList.contains('img')) return;
  im.replaceWith(Object.assign(document.createElement('div'), { className: im.className.replace(/\bimg\b/, '').trim(), textContent: im.alt }));
}, true);
const isNs = g => typeof g === 'string' && /^[a-e]$/.test(g);   // never trust a lookup key from outside data (e.g. "constructor")
const nsMini = g => isNs(g) ? `<span class="nsm" style="background:${NS_COL[g]}">${g.toUpperCase()}</span>` : '';
const nutriBadge = g => isNs(g) ? `<span class="ns" style="background:${NS_COL[g]}">Nutri-Score ${g.toUpperCase()}</span>` : '';
const seg = (id, opts, val, cls = '') => `<div class="seg ${cls}" id="${id}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(v) === String(val) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
function bindSeg(root, id, fn) { $$(`#${id} button`, root).forEach(b => b.onclick = () => { $$(`#${id} button`, root).forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.v); }); }
const segVal = (root, id) => $(`#${id} .on`, root)?.dataset.v;
const MEAL_SHORT = { breakfast: 'Frühstück', lunch: 'Mittag', dinner: 'Abend', snacks: 'Snacks' };
const mealSeg = (meal, id = 'mealSeg') => seg(id, MEALS.map(([k]) => [k, t(MEAL_SHORT[k])]), meal);
const field = (id, label, val = '', { unit = '', ph = '', mode = 'decimal' } = {}) => `<label class="field"><span>${label}</span><span class="field-in"><input id="${id}" type="text" inputmode="${mode}" autocomplete="off" value="${esc(val ?? '')}" placeholder="${esc(ph)}">${unit ? `<em>${unit}</em>` : ''}</span></label>`;
const inputNum = x => x == null || x === '' ? '' : String(r1(x));   // decimal point (typed commas are still accepted by num())
const emptyState = (icon, text) => `<div class="empty">${I(icon)}<p>${text}</p></div>`;
const navRow = (id, icon, title, sub = '', val = '') => `<button class="row-item nav" id="${id}">${icon ? `<span class="row-ic">${I(icon)}</span>` : ''}<span class="grow"><span class="nm">${title}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span>${val ? `<span class="row-val">${val}</span>` : ''}${I('chevR', 'chev')}</button>`;
const stat = (label, value, unit = '', note = '') => `<div class="stat"><span class="stat-l">${label}</span><span class="stat-v">${value}${unit ? `<small>${unit}</small>` : ''}</span>${note ? `<span class="stat-n">${note}</span>` : ''}</div>`;
const beep = () => { if (!S.settings.beep) return; try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = 1320; g.gain.setValueAtTime(.18, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .14); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + .15); setTimeout(() => a.close(), 300); } catch {} };
