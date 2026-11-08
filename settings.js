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

  <div class="sec"><h4>${t('Zuletzt')}</h4></div>
  <div class="card list"><label class="row-item"><span class="grow"><span class="nm">${t('Zuletzt-Liste behalten')}</span><span class="sub">${t('Lebensmittel der letzten Tage zum schnellen Wiederhinzufügen')}</span></span><select class="mini-select" id="sRecents" aria-label="${t('Zuletzt-Liste behalten')}">${Recents.DAYS.map(d => `<option value="${d}" ${d === st.recentsDays ? 'selected' : ''}>${t('{n} Tage', { n: d })}</option>`).join('')}</select></label></div>

  <div class="sec"><h4>${t('Scanner')}</h4></div>
  <div class="card list">${switchRow('sBeep', t('Ton beim Scannen'), st.beep)}${switchRow('sCont', t('Serienscan'), st.continuousScan, t('Produkte direkt hinzufügen, Kamera bleibt offen'))}</div>

  <div class="sec"><h4>${t('Lebensmitteldatenbank')}</h4></div>
  <div class="card list"><label class="row-item"><span class="grow nm">USDA API-Key</span><span class="inline-in wide"><input id="sUsda" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${t('Key einfügen')}" value="${esc(USDA.getKey())}"></span></label>
    ${navRow('sUsdaTest', 'check', t('Key testen'), t('Sucht kurz nach „apple“'))}</div>
  <p class="hint pad">${t('Für Lebensmittel ohne Barcode (USDA FoodData Central, gemeinfrei). Kostenloser Key: fdc.nal.usda.gov/api-key-signup. Der Key bleibt nur auf diesem Gerät: kein Backup, keine Synchronisation.')}</p>

  <div class="sec"><h4>${t('Darstellung')}</h4></div>
  <div class="card list"><div class="row-item"><span class="grow nm">${t('Design')}</span>${seg('sTheme', [['light', t('Hell')], ['dark', t('Dunkel')], ['system', t('Auto')]], st.theme, 'sm')}</div></div>

  <div class="sec"><h4>${t('Synchronisation')}</h4></div>
  <div class="card list" id="syncCard">${window.syncCardHtml ? syncCardHtml() : ''}</div>

  <div class="sec"><h4>${t('Daten')}</h4></div>
  <div class="card list">${navRow('exJson', 'download', t('Backup exportieren'), t('Alle Daten als JSON-Datei'))}
    <label class="row-item nav"><span class="row-ic">${I('upload')}</span><span class="grow"><span class="nm">${t('Backup importieren')}</span><span class="sub">${t('Ersetzt die aktuellen Daten')}</span></span>${I('chevR', 'chev')}<input type="file" id="imJson" accept=".json,application/json" hidden></label>
    ${navRow('exCsv', 'file', t('Tagebuch als CSV'))}</div>
  <div class="card list"><button class="row-item danger-row" id="wipe">${t('Alle Daten löschen')}</button></div>
  <p class="foot">${t('Alles bleibt auf diesem Gerät – kein Konto, keine Cloud, keine Paywall.')}<br>${t('{p} Produkte offline · {b} Basis-Lebensmittel', { p: Object.keys(S.products).length, b: BASE_FOODS.length })} · <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a></p>
  <p class="foot">${t('Produktdaten © Open-Food-Facts-Mitwirkende, Lizenz')} <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL</a>. ${t('Allgemeine Lebensmittel: USDA FoodData Central (gemeinfrei).')}</p>`;

  $('#pGoals').onclick = goalsSheet; window.bindSyncCard?.();
  $('#sUsda').onchange = e => { USDA.setKey(e.target.value); e.target.value = USDA.getKey(); toast(t(USDA.getKey() ? 'USDA-Key gespeichert' : 'USDA-Key entfernt')); };
  $('#sUsdaTest').onclick = async () => {
    USDA.setKey($('#sUsda').value); $('#sUsda').value = USDA.getKey(); if (!USDA.getKey()) return toast(t('Bitte zuerst einen Key einfügen'));
    try { const r = await USDA.search('apple'); toast(t('Key funktioniert – {n} Treffer', { n: r.length })); }
    catch (e) { toast(t(USDA_MSG[e.kind] || USDA_MSG.http)); }
  };
  const sv = () => { st.beep = $('#sBeep').checked; st.continuousScan = $('#sCont').checked; save(); };
  $$('#sBeep,#sCont', v).forEach(i => i.onchange = sv);
  $('#sRecents').onchange = e => { setRecentsDays(+e.target.value); toast(t('Gespeichert')); };
  bindSeg(v, 'sTheme', th => { st.theme = th; save(); applyTheme(); });
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
    delete data.sync;   // sync bookkeeping belongs to this device only
    S = sanitize(data); save(); applyTheme(); rerender(); toast(t('Backup importiert'));
  };
  $('#wipe').onclick = async () => {
    if (!await confirmSheet({ title: t('Alle Daten löschen?'), text: t('Tagebuch, eigene Lebensmittel und Einstellungen werden von diesem Gerät entfernt. Das kann nicht rückgängig gemacht werden.'), ok: t('Alle Daten löschen'), danger: true })) return;
    const { theme } = S.settings; S = sanitize({}); S.settings.theme = theme; save(); ui.date = today(); render(); toast(t('Alle Daten gelöscht'));
  };
}

// ---------- Goals sheet ----------
function goalsSheet() {
  const g = S.goals;
  openSheet(`${sheetHead(t('Tagesziele'), t('Kalorien und Makros pro Tag.'))}<div class="form">
    <div class="grid2">${field('gK', t('Kalorien'), g.kcal, { unit: 'kcal' })}${field('gP', t('Protein'), g.p, { unit: 'g' })}${field('gC', t('Kohlenhydrate'), g.c, { unit: 'g' })}${field('gF', t('Fett'), g.f, { unit: 'g' })}</div>
    <p class="hint" id="gSum"></p><button class="btn block" id="gSave">${t('Speichern')}</button></div>`, sh => {
    // calories follow the macros (4/4/9) as soon as one of them is edited; type your own calories to override, clear the field for automatic
    bindMacroKcal(sh, g, true, { p: 'gP', c: 'gC', f: 'gF', k: 'gK', hint: 'gSum' }, false);
    $('#gSave').onclick = () => { const k = num($('#gK').value, 0, 10000); if (k < 800) return toast(t('Bitte mindestens 800 kcal'));
      S.goals = { kcal: Math.round(k), p: Math.round(num($('#gP').value, 0, 1000)), c: Math.round(num($('#gC').value, 0, 1500)), f: Math.round(num($('#gF').value, 0, 1000)), manual: true, rev: (S.goals.rev || 0) + 1 };
      save(); closeSheet(); rerender(); toast(t('Gespeichert')); };
  });
}

// ---------- Startup ----------
applyLang('en');   // English is the only language (the German source strings are internal lookup keys)
applyTheme();
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;   // false on the very first visit: nothing to update then
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {   // a new version took over: the page still runs the old code until it reloads
    if (hadController) toast(t('Update verfügbar'), { label: t('Neu laden'), fn: () => location.reload() }, 60000);
  });
}
window.FitScan = { lookupBarcode, searchOFF, dayTotals, decodeImageFile, scoreFood, streak, get state() { return S; } };
