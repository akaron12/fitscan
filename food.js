'use strict';
/* FitScan – foods: library & search, food sheet, custom foods, recipes, multi-select, barcode scanner. */
const LIB_TABS = [['recent', 'Zuletzt'], ['fav', 'Favoriten'], ['scans', 'Scans'], ['custom', 'Eigene'], ['recipes', 'Gerichte'], ['base', 'Basis']];
let multi = false, searchCtl = null, searchTimer = null;
const picked = new Map();

// ---------- Library ----------
function renderLibrary(v) {
  if (!LIB_TABS.some(x => x[0] === ui.libTab)) ui.libTab = 'recent';
  topAction(multi ? t('Fertig') : t('Auswählen'), () => { multi = !multi; picked.clear(); rerender(); });
  const meal = ui.targetMeal || mealDefault();
  v.innerHTML = `<div class="context">${t('Hinzufügen zu')} <select class="mini-select" id="ctxMeal" aria-label="${t('Mahlzeit')}">${MEALS.map(([k]) => `<option value="${k}" ${k === meal ? 'selected' : ''}>${mealName(k)}</option>`).join('')}</select><span>· ${dayLabel(ui.date)}</span></div>
    <div class="searchbar"><label class="search-field">${I('search')}<input id="lq" type="search" enterkeyhint="search" placeholder="${t('Lebensmittel oder Barcode')}" value="${esc(ui.query)}" autocomplete="off"></label>
    <button class="icon-btn" id="lScan" aria-label="${t('Scannen')}">${I('scan')}</button></div>
    <div class="chips${ui.query.trim() ? ' hidden' : ''}" id="lTabs">${LIB_TABS.map(([k, l]) => `<button class="chip${ui.libTab === k ? ' on' : ''}" data-lt="${k}">${t(l)}</button>`).join('')}</div>
    <div id="lList"></div>`;
  $('#ctxMeal').onchange = e => { ui.targetMeal = e.target.value; multiBar(); };
  $$('[data-lt]', v).forEach(b => b.onclick = () => { ui.libTab = b.dataset.lt; rerender(); });
  $('#lScan').onclick = openScanner;
  const lq = $('#lq');
  lq.oninput = () => { ui.query = lq.value; $('#lTabs').classList.toggle('hidden', !!ui.query.trim()); doSearch(); };
  lq.onkeydown = e => { if (e.key === 'Enter') { clearTimeout(searchTimer); lq.blur(); doSearch(true); } };
  fillLibList(); multiBar();
}
const actionRow = (id, icon, title, sub) => `<button class="row-item action" id="${id}"><span class="thumb acc">${I(icon)}</span><span class="grow"><span class="nm">${title}</span><span class="sub">${sub}</span></span>${I('chevR', 'chev')}</button>`;
function foodRow(f) {
  const sub = f.src === 'recipe' ? esc(f.brand) : [esc(f.brand || tFood(f.cat)), `${de(f.n.kcal)} kcal/100 g`, f.serving?.g ? esc(tFood(f.serving.label)) : ''].filter(Boolean).join(' · ');
  const tag = f.src === 'custom' ? `<span class="tag">${t('Eigenes')}</span>` : '';
  return `<div class="row-item food" data-fid="${esc(f.id)}">${multi ? `<span class="ck${picked.has(f.id) ? ' on' : ''}">${I('check')}</span>` : ''}${foodIcon(f)}<div class="grow"><div class="nm">${esc(f.name)}${nsMini(f.ns)}${tag}</div><div class="sub">${sub}</div></div>${multi ? '' : `<button class="add-btn" data-qa="${esc(f.id)}" aria-label="${t('Schnell hinzufügen')}">${I('plus')}</button>`}</div>`;
}
function bindList(root, list) {
  const find = id => list.find(x => x.id === id);
  $$('[data-fid]', root).forEach(r => r.onclick = e => {
    const f = find(r.dataset.fid); if (!f) return;
    if (f.src === 'off' && f.code) { S.products[f.code] ||= f; save(); }
    else if (f.src === 'usda') { S.products[f.id] ||= f; save(); }   // keep it searchable offline
    if (e.target.closest('[data-qa]')) return quickLog(f);
    if (!multi) return foodSheet(f);
    if (picked.has(f.id)) picked.delete(f.id); else picked.set(f.id, f);
    r.querySelector('.ck').classList.toggle('on', picked.has(f.id)); multiBar();
  });
}
function quickLog(f) {
  const p = defaultPortion(f), meal = ui.targetMeal || mealDefault(), date = ui.date;
  const e = addEntry(f, p.g, p.label, meal, date, { unit: p.unit, qty: p.qty });
  undoable(t('{name} · {k} kcal zu {m}', { name: f.name, k: de(nutr(f, p.g).kcal), m: mealName(meal) }), () => deleteSilently(date, e));
}
function fillLibList() {
  const el = $('#lList'); if (!el) return;
  if (ui.query.trim()) return doSearch(true);
  let list = [], top = '', empty = null, grouped = false;
  switch (ui.libTab) {
    case 'recent': top = actionRow('aQuick', 'zap', t('Schnelleintrag'), t('Nur Kalorien oder Makros')); list = S.recents; empty = ['clock', t('Hier erscheinen zuletzt eingetragene Lebensmittel.')]; break;
    case 'fav': list = Object.values(S.favorites); empty = ['star', t('Noch keine Favoriten. Tippe beim Lebensmittel auf den Stern.')]; break;
    case 'scans': list = dedupe(S.scanHistory.map(h => Object.values(S.foods).find(f => f.code === h.code) || S.products[h.code]).filter(Boolean)); empty = ['scan', t('Hier erscheinen deine gescannten Produkte – auch offline verfügbar.')]; break;
    case 'custom': top = actionRow('aCustom', 'plus', t('Eigenes Lebensmittel anlegen'), t('Mit Nährwerten von der Verpackung')); list = Object.values(S.foods); break;
    case 'recipes': top = actionRow('aRecipe', 'plus', t('Neues Gericht'), t('Mehrere Zutaten zu einer Portion kombinieren')); list = Object.values(S.recipes).map(recipeFood); break;
    case 'base': list = BASE_FOODS.slice().sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name)); grouped = true; break;
  }
  let rows = '';
  if (grouped) { let cat = null; for (const f of list) { if (f.cat !== cat) { cat = f.cat; rows += `<div class="list-h">${esc(tFood(cat))}</div>`; } rows += foodRow(f); } }
  else rows = list.map(foodRow).join('');
  el.innerHTML = (top ? `<div class="card list">${top}</div>` : '') + (list.length ? `<div class="card list">${rows}</div>` : empty ? emptyState(...empty) : '');
  if ($('#aQuick')) $('#aQuick').onclick = () => quickAddSheet(ui.targetMeal);
  if ($('#aCustom')) $('#aCustom').onclick = () => customFoodSheet();
  if ($('#aRecipe')) $('#aRecipe').onclick = () => recipeSheet();
  bindList(el, list);
}
function doSearch(now) {
  const q = ui.query.trim(), el = $('#lList'); if (!el) return;
  clearTimeout(searchTimer); searchCtl?.abort();
  if (!q) return fillLibList();
  if (/^\d{8,14}$/.test(q)) {
    el.innerHTML = `<div class="card list">${actionRow('aCode', 'scan', t('Barcode {c} nachschlagen', { c: esc(q) }), 'Open Food Facts')}</div>`;
    $('#aCode').onclick = () => handleBarcode(q); if (now) handleBarcode(q); return;
  }
  const loc = localSearch(q).slice(0, 12);
  const hasKey = !!USDA.getKey();   // generic foods (no barcode) come from USDA; packaged products from Open Food Facts
  el.innerHTML = `${loc.length ? `<div class="sec"><h4>${t('Bibliothek & Eigene')}</h4></div><div class="card list" id="locRes">${loc.map(foodRow).join('')}</div>` : ''}
    ${hasKey ? `<div class="sec"><h4>USDA FoodData Central</h4></div><div id="usdaRes"><div class="spinner"></div></div>`
      : `<button class="card banner" id="usdaOff"><span class="banner-ic">${I('database')}</span><span class="grow"><b>${t('USDA-Suche aktivieren')}</b><span class="sub">${t('Für Lebensmittel ohne Barcode, z. B. „Hähnchenbrust roh“: kostenlosen API-Key in den Einstellungen eintragen')}</span></span>${I('chevR', 'chev')}</button>`}
    <div class="sec"><h4>Open Food Facts</h4></div><div id="offRes"><div class="spinner"></div></div>`;
  if (loc.length) bindList($('#locRes'), loc);
  if ($('#usdaOff')) $('#usdaOff').onclick = () => go('profile');
  searchTimer = setTimeout(() => { const ctl = searchCtl = new AbortController(); showOFF(q, ctl); if (hasKey) showUSDA(q, ctl); }, now ? 0 : 400);
}
async function showOFF(q, ctl) {
  try {
    const res = await searchOFF(q, ctl.signal), box = $('#offRes'); if (ui.query.trim() !== q || !box) return;
    box.innerHTML = res.length ? `<div class="card list">${res.map(foodRow).join('')}</div>` : `<p class="hint">${t('Keine Produkte gefunden.')}</p>`;
    bindList(box, res);
  } catch (e) { if (e.name !== 'AbortError' && $('#offRes')) $('#offRes').innerHTML = `<p class="hint">${t('Online-Suche gerade nicht erreichbar. Lokale Treffer funktionieren trotzdem.')}</p>`; }
}
const USDA_MSG = { key: 'USDA hat den API-Key abgelehnt. Bitte in den Einstellungen prüfen.', rate: 'USDA-Limit erreicht (ca. 1.000 Suchen pro Stunde). Später erneut versuchen.', nokey: 'Kein USDA-API-Key hinterlegt.',
  network: 'USDA gerade nicht erreichbar. Lokale Treffer funktionieren trotzdem.', http: 'USDA-Suche gerade nicht möglich.' };
async function showUSDA(q, ctl) {
  try {
    const res = rank(await USDA.search(q, ctl.signal), q), box = $('#usdaRes'); if (ui.query.trim() !== q || !box) return;
    box.innerHTML = res.length ? `<div class="card list">${res.map(foodRow).join('')}</div>` : `<p class="hint">${t('Keine Treffer bei USDA.')}</p>`;
    bindList(box, res);
  } catch (e) { if (e.name === 'AbortError') return; const box = $('#usdaRes'); if (box) box.innerHTML = `<p class="hint">${t(USDA_MSG[e.kind] || USDA_MSG.http)}</p>`; }
}

// ---------- Multi-select ----------
function endMulti() { multi = false; picked.clear(); $('#multiBar')?.remove(); }
function multiBar() {
  if (!multi || ui.tab !== 'library') return $('#multiBar')?.remove();
  const bar = $('#multiBar') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'multiBar', className: 'multibar' }));
  const meal = ui.targetMeal || mealDefault();
  bar.innerHTML = `<span class="grow">${t('{n} ausgewählt', { n: picked.size })}</span><button class="btn sm" id="mbAdd" ${picked.size ? '' : 'disabled'}>${t('Zu {m} hinzufügen', { m: mealName(meal) })}</button>`;
  $('#mbAdd').onclick = () => {
    let k = 0; const n = picked.size, date = ui.date, added = [];
    for (const f of picked.values()) { const p = defaultPortion(f); added.push(addEntry(f, p.g, p.label, meal, date, { unit: p.unit, qty: p.qty })); k += nutr(f, p.g).kcal; }
    ui.targetMeal = null; go('diary');
    undoable(t('{n} Lebensmittel · {k} kcal hinzugefügt', { n, k: de(k) }), () => { added.forEach(x => removeEntry(date, x)); save(); rerender(); });
  };
}

// ---------- Food sheet ----------
function foodSheet(food, { entry = null, date = ui.date } = {}) {
  const units = [['g', t('Gramm'), 1]];
  if (food.serving?.g) units.push(['serv', tFood(food.serving.label || 'Portion'), food.serving.g]);
  if (food.piece?.g) units.push(['pc', t('Stück'), food.piece.g]);
  if (/Getränke/.test(food.cat || '')) units.push(['ml', 'ml', 1]);
  let unit = entry ? (entry.unit || 'g') : (food.serving?.g ? 'serv' : 'g'), qty = entry ? (entry.qty ?? entry.g) : (food.serving?.g ? 1 : 100);
  if (!units.some(u => u[0] === unit)) { unit = 'g'; qty = entry ? entry.g : 100; }
  let meal = entry ? entry.meal : (ui.targetMeal || mealDefault());
  const presets = [];
  const last = !entry && Object.values(S.entries).flat().reverse().find(e => e.food.id === food.id && !e.quick);
  if (last) presets.push([t('Wie zuletzt'), last.unit || 'g', last.qty ?? last.g]);
  if (food.serving?.g) presets.push(['½', 'serv', 0.5], ['1×', 'serv', 1], ['2×', 'serv', 2]);
  presets.push(['50 g', 'g', 50], ['100 g', 'g', 100], ['150 g', 'g', 150], ['200 g', 'g', 200]);
  const editable = S.recipes[food.id] ? 'recipe' : S.foods[food.id] ? 'custom' : null;
  const sv = food.serving?.g ? nutr(food, food.serving.g) : null, n100 = food.n || {};
  const nrow = (l, k, u, dd, cls = '') => `<div class="row-item${cls}"><span class="grow">${l}</span><span class="row-val">${de(n100[k] || 0, dd)} ${u}</span>${sv ? `<span class="row-val">${de(sv[k], dd)} ${u}</span>` : ''}</div>`;
  const micros = food.micro ? MICROS.filter(m => food.micro[m[0]]).map(([k, l, u, f]) => `<div class="row-item micro"><span class="grow">${t(l)}</span><span class="row-val">${de(food.micro[k] * f, 1)} ${u}</span>${sv ? `<span class="row-val">${de(food.micro[k] * f * food.serving.g / 100, 1)} ${u}</span>` : ''}</div>`).join('') : '';
  const badges = food.ns || food.nova ? `<div class="badges">${nutriBadge(food.ns)}${food.nova ? `<span class="tag">NOVA ${food.nova}</span>` : ''}</div>` : '';
  openSheet(`<header class="sh-head food-head">${foodIcon(food, true)}<div class="grow"><h2>${esc(food.name)}</h2><p class="sub">${esc(food.brand || tFood(food.cat) || '')}${food.code ? ' · ' + esc(food.code) : ''}</p>${badges}</div>
      <button class="close" id="fsFav" aria-label="${t('Favorit')}">${I('star', S.favorites[food.id] ? 'fill' : '')}</button><button class="close" data-close aria-label="${t('Schließen')}">${I('x')}</button></header>
    <div class="live" id="fsLive"></div>
    <div class="amount"><input class="input qty" id="fsQty" type="text" inputmode="decimal" autocomplete="off" value="${inputNum(qty)}" aria-label="${t('Menge')}">
      <select class="input" id="fsUnit" aria-label="${t('Einheit')}">${units.map(u => `<option value="${u[0]}" ${u[0] === unit ? 'selected' : ''}>${esc(u[1])}${u[0] === 'serv' || u[0] === 'pc' ? ` (${de(u[2])} g)` : ''}</option>`).join('')}</select></div>
    <div class="chips presets">${presets.map((p, i) => `<button class="chip" data-pi="${i}">${esc(p[0])}</button>`).join('')}</div>
    ${mealSeg(meal, 'fsMeal')}
    ${entry && !isEaten(entry) ? `<button class="btn block" id="fsEat">${t('Als gegessen speichern')}</button>` : ''}
    <button class="btn ${entry && !isEaten(entry) ? 'secondary ' : ''}block" id="fsSave">${entry ? t('Speichern') : t('Zu {m} hinzufügen', { m: mealName(meal) })}</button>
    ${entry ? `<button class="btn plain danger-text block" id="fsDel">${t('Eintrag löschen')}</button>` : ''}
    ${editable ? `<button class="btn plain block" id="fsEdit">${t(editable === 'recipe' ? 'Gericht bearbeiten' : 'Lebensmittel bearbeiten')}</button>` : ''}
    <div class="sec"><h4>${t('Nährwerte')}</h4><span class="cols"><span>100 g</span>${sv ? `<span>${t('Portion')}</span>` : ''}</span></div>
    <div class="card list ntable">${nrow(t('Energie'), 'kcal', 'kcal', 0)}${nrow(t('Protein'), 'p', 'g', 1)}${nrow(t('Kohlenhydrate'), 'c', 'g', 1)}${nrow(t('davon Zucker'), 'sug', 'g', 1, ' micro')}${nrow(t('Fett'), 'f', 'g', 1)}${nrow(t('Ballaststoffe'), 'fib', 'g', 1)}${nrow(t('Salz'), 'salt', 'g', 2)}${micros}</div>
    ${food.src === 'off' ? `<p class="hint">${t('Daten: Open Food Facts (ODbL) – Angaben können unvollständig sein.')}</p>` : ''}`, sh => {
    const qi = $('#fsQty'), ui2 = $('#fsUnit');
    const grams = () => num(qi.value, 0, 1e4) * units.find(x => x[0] === ui2.value)[2];
    const live = () => { const n = nutr(food, grams());
      $('#fsLive').innerHTML = `<div class="live-k"><b>${de(n.kcal)}</b><span>kcal</span></div><div class="live-m">${MACROS.map(([k, l]) => `<span><i class="dot" style="background:var(--${k})"></i>${t(l)} <b>${de(n[k], 1)} g</b></span>`).join('')}</div>`; };
    qi.oninput = live;
    qi.onkeydown = e => e.key === 'Enter' && $('#fsSave').click();
    ui2.onchange = () => { const u = ui2.value; qi.value = u === 'g' || u === 'ml' ? r0(food.serving?.g || 100) : 1; live(); };
    live();
    $$('[data-pi]', sh).forEach(b => b.onclick = () => { const p = presets[+b.dataset.pi]; if (units.some(u => u[0] === p[1])) ui2.value = p[1]; qi.value = inputNum(p[2]); live(); $$('[data-pi]', sh).forEach(x => x.classList.toggle('on', x === b)); });
    bindSeg(sh, 'fsMeal', m => { meal = m; if (!entry) $('#fsSave').textContent = t('Zu {m} hinzufügen', { m: mealName(m) }); });
    $('#fsFav').onclick = () => { if (S.favorites[food.id]) delete S.favorites[food.id]; else S.favorites[food.id] = { ...food }; save(); $('#fsFav').innerHTML = I('star', S.favorites[food.id] ? 'fill' : ''); toast(t(S.favorites[food.id] ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt')); };
    const doSave = status => {
      const g = grams(); if (!(g > 0)) return toast(t('Bitte Menge eingeben')); if (g > 2e4) return toast(t('Menge zu groß'));
      const u = units.find(x => x[0] === ui2.value), q = num(qi.value, 0, 1e4);
      const label = u[0] === 'g' ? `${de(q)} g` : u[0] === 'ml' ? `${de(q)} ml` : `${de(q, q % 1 ? 1 : 0)} × ${u[0] === 'serv' ? food.serving.label || 'Portion' : 'Stück'}`;
      if (entry) { touch(entry, { g, label, meal, unit: u[0], qty: q, ...(status ? { status } : {}) }); save(); closeSheet(); rerender(); return toast(t('Gespeichert')); }
      const e = addEntry(food, g, label, meal, date, { unit: u[0], qty: q });
      closeSheet(); ui.targetMeal = null; go('diary', { date });
      undoable(t('{name} hinzugefügt', { name: food.name }), () => deleteSilently(date, e));
    };
    $('#fsSave').onclick = () => doSave(); if ($('#fsEat')) $('#fsEat').onclick = () => doSave('eaten');
    if (entry) $('#fsDel').onclick = () => deleteEntry(date, entry);
    if (editable) $('#fsEdit').onclick = () => editable === 'recipe' ? recipeSheet(S.recipes[food.id]) : customFoodSheet(S.foods[food.id]);
  });
}

// ---------- Custom foods ----------
function customFoodSheet(f = null, code = '') {
  const n = f?.n || {};
  openSheet(`${sheetHead(t(f ? 'Lebensmittel bearbeiten' : 'Eigenes Lebensmittel'), code ? t('Barcode {c} ist nicht bei Open Food Facts. Trage die Werte von der Verpackung ein – beim nächsten Scan wird das Produkt erkannt.', { c: esc(code) }) : '')}
    <div class="form">${field('cfName', t('Name'), f?.name || '', { ph: t('z. B. Omas Apfelkuchen'), mode: 'text' })}${field('cfBrand', t('Marke (optional)'), f?.brand || '', { mode: 'text' })}
    <div class="sec"><h4>${t('Nährwerte pro 100 g')}</h4></div>
    <div class="grid2">${field('cfK', t('Kalorien'), inputNum(n.kcal), { unit: 'kcal' })}${field('cfP', t('Protein'), inputNum(n.p), { unit: 'g' })}${field('cfC', t('Kohlenhydrate'), inputNum(n.c), { unit: 'g' })}${field('cfF', t('Fett'), inputNum(n.f), { unit: 'g' })}
      ${field('cfS', t('Zucker'), inputNum(n.sug), { unit: 'g' })}${field('cfB', t('Ballaststoffe'), inputNum(n.fib), { unit: 'g' })}${field('cfSa', t('Salz'), inputNum(n.salt), { unit: 'g' })}${field('cfServ', t('Portion'), inputNum(f?.serving?.g), { unit: 'g' })}</div>
    <button class="btn block" id="cfSave">${t('Speichern')}</button>${f ? `<button class="btn plain danger-text block" id="cfDel">${t('Löschen')}</button>` : ''}</div>`, () => {
    if (!f) setTimeout(() => $('#cfName')?.focus(), 250);
    $('#cfSave').onclick = () => {
      const name = $('#cfName').value.trim(); if (!name) return toast(t('Bitte Namen eingeben'));
      const v = id => num($('#' + id).value, 0, id === 'cfK' ? 900 : id === 'cfServ' ? 5000 : 100);
      const id = f?.id || 'cust:' + (code || uid());
      const food = { id, src: 'custom', code: code || f?.code || '', name, brand: $('#cfBrand').value.trim(), cat: 'Eigene', n: { kcal: v('cfK'), p: v('cfP'), c: v('cfC'), f: v('cfF'), sug: v('cfS'), fib: v('cfB'), salt: v('cfSa') }, serving: v('cfServ') ? { g: v('cfServ'), label: 'Portion' } : null };
      S.foods[id] = food; if (S.favorites[id]) S.favorites[id] = { ...food };
      save(); toast(t('Gespeichert')); if (ui.tab === 'library') rerender(); foodSheet(food);
    };
    if (f) $('#cfDel').onclick = async () => {
      if (!await confirmSheet({ title: t('„{n}“ löschen?', { n: esc(f.name) }), text: t('Bereits eingetragene Mahlzeiten bleiben erhalten.'), ok: t('Löschen'), danger: true })) return;
      delete S.foods[f.id]; delete S.favorites[f.id]; save(); rerender(); toast(t('Gelöscht'));
    };
  });
}

// ---------- Recipes ----------
function recipeSheet(r = null) {
  const rec = r ? JSON.parse(JSON.stringify(r)) : { id: 'rec:' + uid(), name: '', portions: 2, items: [] };
  const draw = (keepScroll = false) => {
    const f = recipeFood(rec), per = rec.items.length ? nutr(f, f.serving.g) : null;
    openSheet(`${sheetHead(t(r ? 'Gericht bearbeiten' : 'Neues Gericht'))}
      <div class="form">${field('rName', t('Name'), rec.name, { ph: t('z. B. Protein-Porridge'), mode: 'text' })}${field('rPort', t('Portionen'), rec.portions)}
      <div class="sec"><h4>${t('Zutaten')}</h4></div>
      <div class="card list">${rec.items.map((it, i) => `<div class="row-item"><div class="grow"><div class="nm">${esc(it.food.name)}</div><div class="sub">${de(nutr(it.food, it.g).kcal)} kcal</div></div>
        <span class="inline-in"><input data-ig="${i}" type="text" inputmode="decimal" autocomplete="off" value="${inputNum(it.g)}" aria-label="${t('Menge')}"><em>g</em></span><button class="icon-plain" data-ir="${i}" aria-label="${t('Entfernen')}">${I('x')}</button></div>`).join('') || `<p class="hint pad">${t('Noch keine Zutaten')}</p>`}</div>
      <label class="search-field">${I('search')}<input id="rq" type="search" placeholder="${t('Zutat suchen')}" autocomplete="off"></label><div id="rRes"></div>
      ${per ? `<div class="card"><div class="grid4">${stat(t('kcal/Portion'), de(per.kcal))}${MACROS.map(([k, l]) => stat(t(l), de(per[k]), 'g')).join('')}</div></div>` : ''}
      <button class="btn block" id="rSave">${t('Gericht speichern')}</button>${r ? `<button class="btn plain danger-text block" id="rDel">${t('Löschen')}</button>` : ''}</div>`, sh => {
      $('#rName').oninput = e => rec.name = e.target.value;
      $('#rPort').oninput = e => rec.portions = Math.max(1, num(e.target.value, 0, 100) || 1);
      $('#rPort').onchange = () => draw(true);
      $$('[data-ig]', sh).forEach(i => i.onchange = () => { rec.items[+i.dataset.ig].g = num(i.value, 0, 1e4); draw(true); });
      $$('[data-ir]', sh).forEach(b => b.onclick = () => { rec.items.splice(+b.dataset.ir, 1); draw(true); });
      $('#rq').oninput = e => {
        const res = e.target.value.trim() ? localSearch(e.target.value).filter(x => x.id !== rec.id).slice(0, 8) : [];
        $('#rRes').innerHTML = res.length ? `<div class="card list">${res.map(x => `<button class="row-item" data-add="${esc(x.id)}"><span class="grow"><span class="nm">${esc(x.name)}</span><span class="sub">${de(x.n.kcal)} kcal/100 g</span></span><span class="add-btn">${I('plus')}</span></button>`).join('')}</div>` : '';
        $$('[data-add]', $('#rRes')).forEach(el => el.onclick = () => { const x = res.find(y => y.id === el.dataset.add); rec.items.push({ g: x.serving?.g || 100, food: { id: x.id, name: x.name, n: x.n } }); draw(true); });
      };
      $('#rSave').onclick = () => {
        if (!rec.name.trim()) return toast(t('Bitte Namen eingeben')); if (!rec.items.length) return toast(t('Mindestens eine Zutat'));
        S.recipes[rec.id] = rec; save(); closeSheet(); ui.libTab = 'recipes'; if (ui.tab === 'library') rerender(); toast(t('Gericht gespeichert'));
      };
      if (r) $('#rDel').onclick = async () => {
        if (!await confirmSheet({ title: t('„{n}“ löschen?', { n: esc(rec.name) }), text: t('Bereits eingetragene Mahlzeiten bleiben erhalten.'), ok: t('Löschen'), danger: true })) return;
        delete S.recipes[rec.id]; delete S.favorites[rec.id]; save(); rerender(); toast(t('Gelöscht'));
      };
    }, { keepScroll });
  };
  draw();
}

// ---------- Barcode scanner ----------
let scanStream = null, scanLoop = null, zxReader = null, scanning = false, lastCode = '', lastAt = 0;
const zxHints = () => { const h = new Map(), F = ZXing.BarcodeFormat; h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.QR_CODE]); h.set(ZXing.DecodeHintType.TRY_HARDER, true); return h; };
const scanStatus = s => $('#scanStatus').textContent = s;
function scanModeUI() { const on = S.settings.continuousScan; $('#scanMode').classList.toggle('on', on); $('#scanModeL').textContent = t(on ? 'Serienscan an' : 'Serienscan aus'); }
async function openScanner() {
  $('#scanner').classList.remove('hidden'); $('#scanTray').innerHTML = ''; scanModeUI();
  scanStatus(t('Kamera wird gestartet…')); scanning = true; $('#scanTorch').style.visibility = 'hidden';
  const video = $('#scanVideo');
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error(t(location.protocol === 'https:' ? 'Kamera nicht verfügbar' : 'Kamera braucht HTTPS'));
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    if (!scanning) return stopStream();
    video.srcObject = scanStream; await video.play();
    scanStatus(t('Barcode in den Rahmen halten'));
    const caps = scanStream.getVideoTracks()[0]?.getCapabilities?.() || {}; $('#scanTorch').style.visibility = caps.torch ? 'visible' : 'hidden';
    if ('BarcodeDetector' in window) {
      const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] });
      const tick = async () => { if (!scanning) return; try { const r = await det.detect(video); if (r.length) onScanned(r[0].rawValue); } catch {} if (scanning) scanLoop = requestAnimationFrame(tick); };
      tick();
    } else {
      zxReader = new ZXing.BrowserMultiFormatReader(zxHints());
      zxReader.decodeFromVideoElementContinuously(video, res => { if (res && scanning) onScanned(res.getText()); });
    }
  } catch (e) { scanStatus(t('{e} – nutze „Nummer eingeben“ oder „Foto“.', { e: e.message || t('Kein Kamerazugriff') })); }
}
function stopStream() { scanning = false; cancelAnimationFrame(scanLoop); try { zxReader?.reset(); } catch {} zxReader = null; scanStream?.getTracks().forEach(tr => tr.stop()); scanStream = null; }
function closeScanner() {
  const added = $('#scanTray').children.length; stopStream(); $('#scanner').classList.add('hidden');
  if (added) { ui.targetMeal = null; go('diary'); }
}
function onScanned(raw) {
  const s = String(raw).trim(), code = /^\d{6,14}$/.test(s) ? s : (s.match(/\d{8,14}/) || [])[0];
  if (code && code === lastCode && Date.now() - lastAt < 2500) return;
  lastCode = code; lastAt = Date.now(); navigator.vibrate?.(60); beep();
  if (S.settings.continuousScan && code) { pushScan(code); return serialAdd(code); }
  stopStream(); $('#scanner').classList.add('hidden');
  if (code) handleBarcode(code);
  else openSheet(`${sheetHead(t('QR-Code erkannt'))}<p class="lead break">${esc(s)}</p><p class="hint">${t('Dieser Code enthält keine Produktnummer.')}</p>`);
}
async function serialAdd(code) {
  scanStatus(t('Suche {c}…', { c: code }));
  try {
    const p = (await lookupBarcode(code)).product;
    if (!p) return scanStatus(t('{c}: nicht gefunden', { c: code }));
    const pt = defaultPortion(p), meal = ui.targetMeal || mealDefault();
    addEntry(p, pt.g, pt.label, meal, ui.date, { unit: pt.unit, qty: pt.qty });
    $('#scanTray').insertAdjacentHTML('afterbegin', `<div class="tray-item">${I('check')}<span class="grow">${esc(p.name)}</span><b>${de(nutr(p, pt.g).kcal)} kcal</b></div>`);
    scanStatus(t('Hinzugefügt – nächsten Barcode scannen'));
  } catch {   // no connection: note the barcode as a placeholder row and keep scanning
    addPending(code, ui.targetMeal || mealDefault(), ui.date);
    $('#scanTray').insertAdjacentHTML('afterbegin', `<div class="tray-item">${I('clock')}<span class="grow">Barcode ${esc(code)}</span><b>⏳</b></div>`);
    scanStatus(t('Offline – wird später nachgeschlagen'));
  }
}
$('#scanClose').onclick = closeScanner;
$('#scanMode').onclick = () => { S.settings.continuousScan = !S.settings.continuousScan; save(); scanModeUI(); };
$('#scanTorch').onclick = async () => { const tr = scanStream?.getVideoTracks()[0]; if (!tr) return; try { tr._on = !tr._on; await tr.applyConstraints({ advanced: [{ torch: tr._on }] }); $('#scanTorch').classList.toggle('on', tr._on); } catch { toast(t('Licht nicht unterstützt')); } };
$('#scanManual').onclick = () => { closeScanner(); manualBarcode(); };
$('#scanFile').onchange = async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return; scanStatus(t('Foto wird gelesen…'));
  try { onScanned(await decodeImageFile(file)); } catch { scanStatus(t('Kein Barcode im Foto gefunden')); }
};
async function decodeImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    if ('BarcodeDetector' in window) { try { const r = await new BarcodeDetector().detect(img); if (r.length) return r[0].rawValue; } catch {} }
    return (await new ZXing.BrowserMultiFormatReader(zxHints()).decodeFromImageElement(img)).getText();
  } finally { URL.revokeObjectURL(url); }
}
function manualBarcode() {
  openSheet(`${sheetHead(t('Barcode eingeben'), t('Die Ziffern unter dem Strichcode (EAN/UPC, 8–13 Stellen).'))}
    <div class="form">${field('mbCode', t('Barcode'), '', { ph: '4000417025005', mode: 'numeric' })}<button class="btn block" id="mbGo">${t('Produkt suchen')}</button></div>`, () => {
    const goFn = () => { const c = $('#mbCode').value.replace(/\D/g, ''); if (c.length < 6) return toast(t('Ungültiger Code')); handleBarcode(c); };
    $('#mbGo').onclick = goFn; $('#mbCode').onkeydown = e => e.key === 'Enter' && goFn(); setTimeout(() => $('#mbCode')?.focus(), 250);
  });
}
async function handleBarcode(code) {
  code = String(code); pushScan(code);
  openSheet(`${sheetHead(t('Suche {c}…', { c: esc(code) }))}<div class="spinner"></div>`);
  try {
    const { product, cached } = await lookupBarcode(code);
    if (!product) return openSheet(`${sheetHead(t('Produkt nicht gefunden'))}<p class="lead">${t('Der Barcode {c} ist noch nicht bei Open Food Facts. Lege das Produkt selbst an – es wird lokal gespeichert und beim nächsten Scan erkannt.', { c: `<b>${esc(code)}</b>` })}</p>
      <button class="btn block" id="nfAdd">${t('Lebensmittel anlegen')}</button>`, () => $('#nfAdd').onclick = () => customFoodSheet(null, code));
    if (!product.hasNutr && product.src === 'off') toast(t('Hinweis: Für dieses Produkt fehlen Nährwerte – bitte prüfen'));
    else if (cached && product.src === 'off' && !navigator.onLine) toast(t('Aus lokalem Speicher (offline verfügbar)'));
    foodSheet(product);
  } catch (e) {
    const off = navigator.onLine === false;   // offline: noting the barcode for later is the main action
    openSheet(`${sheetHead(t('Keine Verbindung'))}<p class="lead">${t('Open Food Facts ist gerade nicht erreichbar. Versuche es gleich nochmal, merke den Barcode für später vor oder lege das Produkt selbst an.')}</p>
      <div class="stack"><button class="btn block${off ? '' : ' secondary'}" id="nfLater">${t('Später nachschlagen')}</button><button class="btn block${off ? ' secondary' : ''}" id="nfRetry">${t('Erneut versuchen')}</button><button class="btn block secondary" id="nfAdd">${t('Selbst anlegen')}</button></div>`,
      () => { $('#nfLater').onclick = () => pendingSheet(code); $('#nfRetry').onclick = () => handleBarcode(code); $('#nfAdd').onclick = () => customFoodSheet(null, code); });
  }
}

// ---------- Offline barcodes: a placeholder row now, looked up automatically when back online ----------
const pendingFood = (code, n = {}) => ({ id: 'pending:' + code, src: 'pending', code, name: 'Barcode ' + code, brand: '', img: '', cat: '', serving: null,
  n: { kcal: n.kcal || 0, p: n.p || 0, c: n.c || 0, f: n.f || 0, fib: 0, sug: 0, salt: 0 } });
/** Values typed by the user are for the amount eaten; the placeholder amount is 100 g, so they are stored 1:1. */
function addPending(code, meal, date, n = null) {
  return addEntry(pendingFood(code, n || {}), 100, '100 g', meal, date, { pending: { manual: !!(n && n.kcal > 0) } });
}
function pendingSheet(code) {
  let meal = ui.targetMeal || mealDefault(); const date = ui.date;
  openSheet(`${sheetHead(t('Barcode {c} vormerken', { c: esc(code) }), t('Der Eintrag erscheint sofort im Tagebuch und wird nachgeschlagen, sobald du wieder online bist.'))}
    <div class="form"><p class="hint">${t('Optional: Werte für die gegessene Menge schon jetzt eintragen. Eigene Werte haben später Vorrang, nur der Name wird ergänzt.')}</p>
    ${macroGridHtml({})}${mealSeg(meal, 'pbM')}<button class="btn block" id="pbAdd">${t('Zum Tagebuch hinzufügen')}</button></div>`, sh => {
    const mk = bindMacroKcal(sh, {}, false); bindSeg(sh, 'pbM', m => meal = m);
    $('#pbAdd').onclick = () => {
      const { p, c, f, kcal } = mk.vals(), e = addPending(code, meal, date, p || c || f || kcal ? { kcal, p, c, f } : null);
      closeSheet(); ui.targetMeal = null; go('diary', { date });
      undoable(t('Barcode {c} vorgemerkt', { c: code }), () => deleteSilently(date, e));
    };
  });
}
let resolving = false;
/** Looks up every placeholder entry. Your own numbers win (only name/brand/image are filled in); otherwise the product's
    nutrition replaces the zeros. Network errors leave the placeholder for the next attempt; "not found" is remembered. */
async function resolvePending() {
  if (resolving || navigator.onLine === false) return; resolving = true; let found = 0, missing = 0;
  try {
    for (const es of Object.values(S.entries)) for (const e of es) {
      if (e.food?.src !== 'pending' || e.pending?.notFound) continue;
      let res; try { res = await lookupBarcode(e.food.code); } catch { continue; }
      if (!res.product) { e.pending = { ...(e.pending || {}), notFound: true }; missing++; continue; }
      const p = res.product, manual = e.pending?.manual ?? (e.food.n.kcal > 0);
      const snap = { id: p.id, name: p.name, brand: p.brand || '', img: p.img || '', cat: p.cat || '', n: manual ? e.food.n : p.n, serving: p.serving || null, src: p.src, code: p.code };
      if (p.micro && !manual) snap.micro = p.micro; if (p.ns) snap.ns = p.ns; if (p.nova) snap.nova = p.nova;
      touch(e, { food: snap }); delete e.pending; S.recents = [snap, ...S.recents.filter(x => x.id !== snap.id)].slice(0, 40); found++;
    }
  } finally { resolving = false; }
  if (found || missing) { save(); if (!sheetOpen() && !$('#onb')) rerender(); }
  if (found) toast(t('{n} Barcode(s) nachgeschlagen – bitte Menge prüfen', { n: found }));
}
addEventListener('online', () => resolvePending());
document.addEventListener('visibilitychange', () => { if (!document.hidden) resolvePending(); });
setTimeout(resolvePending, 2000);
