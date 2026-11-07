'use strict';
/* FitScan – settings: daily goals, scanner, appearance, data import/export, startup. */
const switchRow = (id, title, on, sub = '') => `<label class="row-item"><span class="grow"><span class="nm">${title}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span><input type="checkbox" class="switch" id="${id}" ${on ? 'checked' : ''}></label>`;

function renderProfile(v) {
  const g = S.goals, st = S.settings;
  v.innerHTML = `
  <section class="card plan-card"><span class="sub">${t('Dein Tagesziel')}</span><div class="plan-k"><b>${de(g.kcal)}</b> kcal</div>
    <div class="legend">${MACROS.map(([k, l]) => `<span><i class="dot" style="background:var(--${k})"></i>${t(l)} <b>${g[k]} g</b></span>`).join('')}</div></section>

  <div class="sec"><h4>${t('Ziele')}</h4></div>
  <div class="card list">${navRow('pGoals', 'target', t('Tagesziele anpassen'), t('Kalorien und Makros manuell festlegen'))}</div>

  <div class="sec"><h4>${t('Scanner')}</h4></div>
  <div class="card list">${switchRow('sBeep', t('Ton beim Scannen'), st.beep)}${switchRow('sCont', t('Serienscan'), st.continuousScan, t('Produkte direkt hinzufügen, Kamera bleibt offen'))}</div>

  <div class="sec"><h4>${t('Darstellung')}</h4></div>
  <div class="card list"><div class="row-item"><span class="grow nm">${t('Design')}</span>${seg('sTheme', [['light', t('Hell')], ['dark', t('Dunkel')], ['system', t('Auto')]], st.theme, 'sm')}</div>
    <div class="row-item"><span class="grow nm">${t('Sprache')}</span>${seg('sLang', [['de', 'Deutsch'], ['en', 'English']], LANG, 'sm')}</div></div>

  <div class="sec"><h4>${t('Daten')}</h4></div>
  <div class="card list">${navRow('exJson', 'download', t('Backup exportieren'), t('Alle Daten als JSON-Datei'))}
    <label class="row-item nav"><span class="row-ic">${I('upload')}</span><span class="grow"><span class="nm">${t('Backup importieren')}</span><span class="sub">${t('Ersetzt die aktuellen Daten')}</span></span>${I('chevR', 'chev')}<input type="file" id="imJson" accept=".json,application/json" hidden></label>
    ${navRow('exCsv', 'file', t('Tagebuch als CSV'))}</div>
  <div class="card list"><button class="row-item danger-row" id="wipe">${t('Alle Daten löschen')}</button></div>
  <p class="foot">${t('Alles bleibt auf diesem Gerät – kein Konto, keine Cloud, keine Paywall.')}<br>${t('{p} Produkte offline · {b} Basis-Lebensmittel', { p: Object.keys(S.products).length, b: BASE_FOODS.length })} · <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a></p>`;

  $('#pGoals').onclick = goalsSheet;
  const sv = () => { st.beep = $('#sBeep').checked; st.continuousScan = $('#sCont').checked; save(); };
  $$('#sBeep,#sCont', v).forEach(i => i.onchange = sv);
  bindSeg(v, 'sTheme', th => { st.theme = th; save(); applyTheme(); });
  bindSeg(v, 'sLang', l => { setLang(l); save(); rerender(); });
  $('#exJson').onclick = () => download(`fitscan-backup-${today()}.json`, JSON.stringify({ app: 'fitscan', version: 4, exported: new Date().toISOString(), data: S }, null, 1), 'application/json');
  $('#exCsv').onclick = () => {
    const rows = [['Datum', 'Mahlzeit', 'Lebensmittel', 'Marke', 'Menge (g)', 'kcal', 'Protein (g)', 'Kohlenhydrate (g)', 'Fett (g)', 'Zucker (g)', 'Ballaststoffe (g)', 'Salz (g)'].map(x => t(x))];
    for (const d of Object.keys(S.entries).sort()) for (const e of S.entries[d]) { const n = nutr(e.food, e.g); rows.push([d, mealName(e.meal), e.food.name, e.food.brand, r1(e.g), r0(n.kcal), r1(n.p), r1(n.c), r1(n.f), r1(n.sug), r1(n.fib), r1(n.salt)]); }
    download(`fitscan-diary-${today()}.csv`, csv(rows), 'text/csv');
  };
  $('#imJson').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let data; try { const j = JSON.parse(await f.text()); data = j.data || j; if (!data.entries || !data.goals) throw 0; } catch { return toast(t('Ungültige Backup-Datei')); }
    if (!await confirmSheet({ title: t('Backup importieren?'), text: t('Deine aktuellen Daten werden durch das Backup ersetzt.'), ok: t('Importieren') })) return;
    const keepLang = S.settings.lang; S = sanitize(data); S.settings.lang ||= keepLang; save(); setLang(S.settings.lang || LANG); applyTheme(); rerender(); toast(t('Backup importiert'));
  };
  $('#wipe').onclick = async () => {
    if (!await confirmSheet({ title: t('Alle Daten löschen?'), text: t('Tagebuch, eigene Lebensmittel und Einstellungen werden von diesem Gerät entfernt. Das kann nicht rückgängig gemacht werden.'), ok: t('Alle Daten löschen'), danger: true })) return;
    const { theme, lang } = S.settings; S = sanitize({}); Object.assign(S.settings, { theme, lang }); save(); ui.date = today(); render(); toast(t('Alle Daten gelöscht'));
  };
}

// ---------- Goals sheet ----------
function goalsSheet() {
  const g = S.goals;
  openSheet(`${sheetHead(t('Tagesziele'), t('Kalorien und Makros pro Tag.'))}<div class="form">
    <div class="grid2">${field('gK', t('Kalorien'), g.kcal, { unit: 'kcal' })}${field('gP', t('Protein'), g.p, { unit: 'g' })}${field('gC', t('Kohlenhydrate'), g.c, { unit: 'g' })}${field('gF', t('Fett'), g.f, { unit: 'g' })}</div>
    <p class="hint" id="gSum"></p><button class="btn block" id="gSave">${t('Speichern')}</button></div>`, sh => {
    const gs = () => { const k = num($('#gP').value) * 4 + num($('#gC').value) * 4 + num($('#gF').value) * 9, goal = num($('#gK').value);
      $('#gSum').textContent = t('Makros ergeben {a} kcal (Ziel {b} kcal)', { a: de(k), b: de(goal) }); $('#gSum').classList.toggle('warn', Math.abs(k - goal) > goal * 0.05); };
    $$('input', sh).forEach(i => i.oninput = gs); gs();
    $('#gSave').onclick = () => { const k = num($('#gK').value, 0, 10000); if (k < 800) return toast(t('Bitte mindestens 800 kcal'));
      S.goals = { kcal: Math.round(k), p: Math.round(num($('#gP').value, 0, 1000)), c: Math.round(num($('#gC').value, 0, 1500)), f: Math.round(num($('#gF').value, 0, 1000)), manual: true };
      save(); closeSheet(); rerender(); toast(t('Gespeichert')); };
  });
}

// ---------- Startup ----------
function setLang(l) { S.settings.lang = l; applyLang(l); }
setLang(S.settings.lang || (/^de\b/i.test(navigator.language || '') ? 'de' : 'en'));
applyTheme();
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.FitScan = { lookupBarcode, searchOFF, dayTotals, decodeImageFile, scoreFood, streak, get state() { return S; } };
