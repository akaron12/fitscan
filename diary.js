'use strict';
/* FitScan – diary: day summary, meals, quick add, day details. */
const dayLabel = d => d === today() ? t('Heute') : d === addDays(today(), -1) ? t('Gestern') : d === addDays(today(), 1) ? t('Morgen') : fmtDate(d);
const MACROS = [['p', 'Protein'], ['c', 'Kohlenhydrate'], ['f', 'Fett']];
const hasPlanned = d => (S.entries[d] || []).some(e => !isEaten(e));
const entryLabel = e => e.quick ? t('Schnelleintrag') : tFood(e.label || r0(e.g) + ' g');

function renderDiary(v) {
  const d = ui.date, tt = dayTotals(d), pt = plannedTotals(d), g = S.goals, rest = g.kcal - tt.kcal, es = S.entries[d] || [], st = streak();
  $('#pageTitle').textContent = [today(), addDays(today(), -1), addDays(today(), 1)].includes(d) ? dayLabel(d) : t('Tagebuch');
  $('#pageSub').textContent = fmtLong(d);
  if (d !== today()) topAction(t('Heute'), () => { ui.date = today(); render(); });

  const mon = addDays(d, -((new Date(d + 'T12:00:00').getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  let html = `<nav class="week"><button class="wk-nav" id="wkPrev" aria-label="${t('Vorherige Woche')}">${I('chevL')}</button>
    ${week.map(x => `<button class="wd${x === d ? ' on' : ''}${x === today() ? ' today' : ''}" data-day="${x}"><span class="wd-l">${new Date(x + 'T12:00:00').toLocaleDateString(LOC(), { weekday: 'narrow' })}</span><span class="wd-n">${+x.slice(8)}</span><i class="${isLogged(x) ? 'on' : hasPlanned(x) ? 'plan' : ''}"></i></button>`).join('')}
    <button class="wk-nav" id="wkNext" aria-label="${t('Nächste Woche')}">${I('chevR')}</button></nav>`;

  if (!S.goals.manual) html += `<button class="card banner" id="setupBanner"><span class="banner-ic">${I('target')}</span><span class="grow"><b>${t('Ziele festlegen')}</b><span class="sub">${t('Kalorien- und Makroziele eintragen')}</span></span>${I('chevR', 'chev')}</button>`;

  const mrow = (k, l) => { const over = tt[k] > g[k] * 1.05;
    return `<div class="mrow"><div class="lbl"><span>${t(l)}</span><span class="val${over ? ' over' : ''}"><b>${r0(tt[k])}</b> / ${g[k]} g</span></div><div class="bar"><i style="width:${Math.min(100, g[k] ? tt[k] / g[k] * 100 : 0)}%;background:var(--${k})"></i></div></div>`; };
  html += `<section class="card summary" id="sum" role="button" tabindex="0">
    <div class="sum-top"><div class="ring">${ring(tt.kcal, g.kcal, 140, 13)}<div class="center"><span class="big">${de(Math.abs(rest))}</span><span class="sub">${rest >= 0 ? t('kcal übrig') : t('kcal drüber')}</span></div></div>
    <div class="macros">${MACROS.map(([k, l]) => mrow(k, l)).join('')}</div></div>
    <div class="sum-foot"><span>${t('{a} von {b} kcal', { a: de(tt.kcal), b: de(g.kcal) })}</span>${st ? `<span class="streak" title="${t('Tage in Folge geloggt')}">${I('flame')}${st}</span>` : ''}<span class="grow"></span><span class="link">${t('Details')}${I('chevR')}</span></div>${projLine(tt, pt, g)}</section>`;

  if (!es.length && isLogged(addDays(d, -1))) html += `<button class="btn secondary block" id="copyDay">${I('undo')}${t('Ganzen Tag von gestern kopieren')}</button>`;

  for (const [id, name] of MEALS) {
    const me = es.filter(e => e.meal === id), eatenN = me.filter(isEaten).length, planned = me.filter(e => !isEaten(e));
    const kc = me.filter(isEaten).reduce((a, e) => a + nutr(e.food, e.g).kcal, 0), pk = planned.reduce((a, e) => a + nutr(e.food, e.g).kcal, 0);
    const canCopy = !me.length && (S.entries[addDays(d, -1)] || []).some(e => e.meal === id);
    html += `<section class="card meal"><header class="card-h"><h3>${t(name)}</h3><span class="card-v">${eatenN ? de(kc) + ' kcal' : ''}${pk ? `${eatenN ? ' ' : ''}<span class="plan-k">+${de(pk)} ${t('geplant')}</span>` : ''}</span></header>
      ${me.length ? `<div class="list">${me.map(entryRow).join('')}</div>` : ''}
      <footer class="meal-f"><button class="link-btn" data-add="${id}">${I('plus')}${t('Hinzufügen')}</button>${planned.length ? `<button class="link-btn" data-confirm="${id}">${I('check')}${t('Alle bestätigen')}</button>` : ''}${canCopy ? `<button class="link-btn quiet" data-copy="${id}">${t('Wie gestern')}</button>` : ''}<span class="grow"></span>
      <button class="icon-plain" data-quick="${id}" aria-label="${t('Schnelleintrag')}" title="${t('Schnelleintrag')}">${I('zap')}</button><button class="icon-plain" data-mscan="${id}" aria-label="${t('Scannen')}" title="${t('Scannen')}">${I('scan')}</button></footer></section>`;
  }

  v.innerHTML = html;

  $('#wkPrev').onclick = () => { ui.date = addDays(d, -7); render(); };
  $('#wkNext').onclick = () => { ui.date = addDays(d, 7); render(); };
  $$('[data-day]', v).forEach(b => b.onclick = () => { ui.date = b.dataset.day; render(); });
  if ($('#setupBanner')) $('#setupBanner').onclick = goalsSheet;
  $('#sum').onclick = () => dayDetailSheet(d);
  $('#sum').onkeydown = e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), dayDetailSheet(d));
  if ($('#copyDay')) $('#copyDay').onclick = () => copyEntries(S.entries[addDays(d, -1)], d);
  $$('[data-add]', v).forEach(b => b.onclick = () => go('library', { targetMeal: b.dataset.add, query: '' }));
  $$('[data-copy]', v).forEach(b => b.onclick = () => copyEntries((S.entries[addDays(d, -1)] || []).filter(e => e.meal === b.dataset.copy), d));
  $$('[data-quick]', v).forEach(b => b.onclick = () => quickAddSheet(b.dataset.quick));
  $$('[data-mscan]', v).forEach(b => b.onclick = () => { ui.targetMeal = b.dataset.mscan; openScanner(); });
  $$('[data-chk]', v).forEach(b => b.onclick = ev => { ev.stopPropagation(); const e = es.find(x => x.id === b.dataset.chk); if (e) confirmPlanned(d, [e]); });
  $$('[data-confirm]', v).forEach(b => b.onclick = () => confirmPlanned(d, es.filter(e => e.meal === b.dataset.confirm && !isEaten(e))));
  $$('[data-eid]', v).forEach(el => el.onclick = () => { const e = es.find(x => x.id === el.dataset.eid); if (!e) return; e.quick ? quickAddSheet(e.meal, e) : foodSheet(e.food, { entry: e, date: d }); });
}
function entryRow(e) {
  const n = nutr(e.food, e.g), planned = !isEaten(e), note = e.x?.note ? ` · ${esc(e.x.note)}` : '';
  return `<div class="row-item entry${planned ? ' planned' : ''}" data-eid="${e.id}">${foodIcon(e.food)}<div class="grow"><div class="nm">${esc(e.food.name)}</div><div class="sub">${planned ? `<span class="plan-tag">${t('Geplant')}</span> ` : ''}${esc(entryLabel(e))} · P ${r0(n.p)} · ${t('K')} ${r0(n.c)} · F ${r0(n.f)}${note}</div></div><div class="kcal">${de(n.kcal)}</div>${planned ? `<button class="chk" data-chk="${e.id}" aria-label="${t('Als gegessen bestätigen')}" title="${t('Als gegessen bestätigen')}">${I('check')}</button>` : ''}</div>`;
}
/** Eaten totals drive the ring; planned meals only show as a projection. */
function projLine(tt, pt, g) {
  if (!(pt.kcal > 0)) return '';
  const left = g.kcal - tt.kcal - pt.kcal;
  return `<div class="proj">${t(left >= 0 ? 'Mit Geplantem: {r} kcal übrig' : 'Mit Geplantem: {r} kcal drüber', { r: de(Math.abs(left)) })} · P ${r0(tt.p + pt.p)} / ${g.p} g</div>`;
}
/** One tap: planned -> eaten at the planned amount. Undo puts it back to planned. */
function confirmPlanned(date, list) {
  const todo = list.filter(e => !isEaten(e)); if (!todo.length) return;
  todo.forEach(e => touch(e, { status: 'eaten' })); save(); rerender();
  undoable(todo.length === 1 ? t('{name} bestätigt', { name: todo[0].food.name }) : t('{n} bestätigt', { n: todo.length }), () => { todo.forEach(e => touch(e, { status: 'planned' })); save(); rerender(); });
}
function copyEntries(src, to) {
  if (!src?.length) return;
  const copies = src.map(e => ({ ...e, id: uid(), status: 'eaten', rev: 1 })); (S.entries[to] ||= []).push(...copies); save(); rerender();
  undoable(t('{n} Einträge kopiert', { n: copies.length }), () => { copies.forEach(c => removeEntry(to, c)); save(); rerender(); });
}
function deleteEntry(date, e) {
  const i = removeEntry(date, e); if (i < 0) return;
  save(); closeSheet(); rerender();
  undoable(t('Eintrag gelöscht'), () => { restoreEntry(date, e, i); save(); rerender(); });
}

// ---------- Quick add ----------
function quickAddSheet(meal, entry = null) {
  meal = entry?.meal || meal || ui.targetMeal || mealDefault();
  const n = entry?.food.n || {}, date = ui.date;
  openSheet(`${sheetHead(t(entry ? 'Schnelleintrag bearbeiten' : 'Schnelleintrag'), t('Nur Kalorien oder Makros – z. B. im Restaurant.'))}
    <div class="form">${field('qaN', t('Bezeichnung'), entry?.food.name || '', { ph: t('Schnelleintrag'), mode: 'text' })}
    <div class="grid2">${field('qaK', t('Kalorien'), inputNum(n.kcal), { unit: 'kcal' })}${field('qaP', t('Protein'), inputNum(n.p), { unit: 'g' })}${field('qaC', t('Kohlenhydrate'), inputNum(n.c), { unit: 'g' })}${field('qaF', t('Fett'), inputNum(n.f), { unit: 'g' })}</div>
    <p class="hint" id="qaHint"></p>${mealSeg(meal, 'qaM')}
    <button class="btn block" id="qaSave">${t(entry ? 'Speichern' : 'Hinzufügen')}</button>${entry ? `<button class="btn plain danger-text block" id="qaDel">${t('Eintrag löschen')}</button>` : ''}</div>`, sh => {
    const v = id => num($('#' + id).value, 0, id === 'qaK' ? 20000 : 2000);
    const hint = () => { const k = v('qaP') * 4 + v('qaC') * 4 + v('qaF') * 9; $('#qaHint').textContent = k && !v('qaK') ? t('≈ {k} kcal aus Makros', { k: de(k) }) : ''; };
    $$('#qaK,#qaP,#qaC,#qaF', sh).forEach(i => i.oninput = hint);
    bindSeg(sh, 'qaM', m => meal = m);
    if (!entry) setTimeout(() => $('#qaK')?.focus(), 250);
    $('#qaSave').onclick = () => {
      const p = v('qaP'), c = v('qaC'), f = v('qaF'), kcal = v('qaK') || Math.round(p * 4 + c * 4 + f * 9);
      if (!kcal) return toast(t('Bitte Kalorien oder Makros eingeben'));
      const food = { id: entry?.food.id || 'quick:' + uid(), name: $('#qaN').value.trim() || t('Schnelleintrag'), cat: '', src: 'quick', n: { kcal, p, c, f, fib: 0, sug: 0, salt: 0 } };
      if (entry) { touch(entry, { food, meal }); save(); closeSheet(); rerender(); return toast(t('Gespeichert')); }
      const e = addEntry(food, 100, 'Schnelleintrag', meal, date, { quick: true });
      closeSheet(); ui.targetMeal = null; go('diary');
      undoable(t('{k} kcal hinzugefügt', { k: de(kcal) }), () => deleteSilently(date, e));
    };
    if (entry) $('#qaDel').onclick = () => deleteEntry(date, entry);
  });
}
function deleteSilently(date, e) { removeEntry(date, e); save(); rerender(); }

// ---------- Day details ----------
function dayDetailSheet(d) {
  const tt = dayTotals(d), mic = {}, cover = {}, es = (S.entries[d] || []).filter(isEaten), g = S.goals;
  for (const e of es) { const m = e.food.micro; if (!m) continue; for (const k in m) { mic[k] = (mic[k] || 0) + m[k] * e.g / 100; cover[k] = (cover[k] || 0) + 1; } }
  const kc = { p: tt.p * 4, c: tt.c * 4, f: tt.f * 9 }, tot = kc.p + kc.c + kc.f || 1;
  const row = (l, v, goal) => `<div class="row-item"><span class="grow">${l}</span><span class="row-val"><b>${v}</b>${goal ? `<span class="sub"> / ${goal}</span>` : ''}</span></div>`;
  openSheet(`${sheetHead(t('Tagesdetails'), fmtLong(d))}
    <div class="sec"><h4>${t('Makroverteilung')}</h4><span>${t('Anteil an Kalorien')}</span></div>
    <div class="card"><div class="macrobar">${MACROS.map(([k]) => `<i style="width:${kc[k] / tot * 100}%;background:var(--${k})"></i>`).join('')}</div>
    <div class="legend">${MACROS.map(([k, l]) => `<span><i class="dot" style="background:var(--${k})"></i>${t(l)} <b>${r0(kc[k] / tot * 100)} %</b></span>`).join('')}</div></div>
    <div class="sec"><h4>${t('Nährwerte')}</h4></div>
    <div class="card list">${row(t('Energie'), de(tt.kcal) + ' kcal', de(g.kcal) + ' kcal')}${row(t('Protein'), r0(tt.p) + ' g', g.p + ' g')}${row(t('Kohlenhydrate'), r0(tt.c) + ' g', g.c + ' g')}${row(t('davon Zucker'), r0(tt.sug) + ' g', '< 50 g')}${row(t('Fett'), r0(tt.f) + ' g', g.f + ' g')}${row(t('Ballaststoffe'), r0(tt.fib) + ' g', '≥ 30 g')}${row(t('Salz'), de(tt.salt, 1) + ' g', '< 6 g')}</div>
    <div class="sec"><h4>${t('Mikronährstoffe')}</h4></div>
    ${Object.keys(mic).length ? `<div class="card list">${MICROS.filter(m => mic[m[0]]).map(([k, l, u, f]) => `<div class="row-item"><span class="grow">${t(l)}</span><span class="sub">${t('{a} von {b} Einträgen', { a: cover[k], b: es.length })}</span><b class="row-val">${de(mic[k] * f, u === 'g' ? 1 : 0)} ${u}</b></div>`).join('')}</div>
      <p class="hint">${t('Nur aus Produkten mit Angaben von Open Food Facts.')}</p>` : `<p class="hint">${t('Keine Mikronährstoff-Daten für diesen Tag. Gescannte Produkte liefern oft Werte wie Natrium, Calcium oder Vitamine.')}</p>`}`);
}
