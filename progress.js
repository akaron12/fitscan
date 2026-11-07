'use strict';
/* FitScan – progress: calorie & macro charts and weekly insights. */
const METRICS = [['kcal', 'Kalorien'], ['macros', 'Makros'], ['protein', 'Protein'], ['weekly', 'Wochenschnitt']];
const RANGES = [[7, '7T'], [30, '30T'], [90, '90T'], [365, '1J'], [0, 'Alles']];
let chartObj = null;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function renderProgress(v) {
  const { cur, prev } = insights(), dk = cur.kcal - prev.kcal;
  v.innerHTML = `
  <section class="card chart-card">
    <div class="chips" id="cMetric">${METRICS.map(([k, l]) => `<button class="chip${ui.chart.metric === k ? ' on' : ''}" data-cm="${k}">${t(l)}</button>`).join('')}</div>
    ${seg('cRange', RANGES.map(([k, l]) => [k, t(l)]), ui.chart.range, 'sm')}
    <div class="chartbox"><canvas id="chart" role="img"></canvas></div>
    <div class="chart-foot"><p class="hint" id="cInfo"></p><div class="chart-opts" id="cOpts"></div></div></section>

  <div class="sec"><h4>${t('Diese Woche')}</h4><span>${t('{n} von 7 Tagen geloggt', { n: cur.n })}</span></div>
  <section class="card"><div class="grid2 gap">
    ${stat(t('Ø Kalorien'), cur.n ? de(cur.kcal) : '–', cur.n ? 'kcal' : '', prev.n && cur.n ? t('{d} vs. Vorwoche', { d: signed(dk) }) : '')}
    ${stat(t('Ø Protein'), cur.n ? r0(cur.p) : '–', cur.n ? 'g' : '', t('Ziel {g} g', { g: S.goals.p }))}
    ${stat(t('Im Zielbereich'), `${cur.adh}/${cur.n}`, '', t('Tage ±10 % vom Kalorienziel'))}
    ${stat(t('Proteinziel erreicht'), `${cur.ph}/${cur.n}`, '', t('Tage · Serie {s}', { s: streak() }))}</div></section>`;

  $$('[data-cm]', v).forEach(b => b.onclick = () => { ui.chart.metric = b.dataset.cm; $$('[data-cm]', v).forEach(x => x.classList.toggle('on', x === b)); drawChart(); });
  bindSeg(v, 'cRange', r => { ui.chart.range = +r; drawChart(); });
  drawChart();
}

function chartOptions() {
  const C = ui.chart, el = $('#cOpts'); if (!el) return;
  const sel = (id, opts, val) => `<select class="mini-select" id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${t(l)}</option>`).join('')}</select>`;
  let html = '';
  if (['kcal', 'protein'].includes(C.metric)) html = sel('cType', [['line', 'Linie'], ['bar', 'Balken']], C.type) + sel('cSmooth', [['ma7', '7-Tage-Mittel'], ['none', 'Keine Glättung']], C.smooth);
  el.innerHTML = html;
  if ($('#cType')) $('#cType').onchange = e => { C.type = e.target.value; drawChart(); };
  if ($('#cSmooth')) $('#cSmooth').onchange = e => { C.smooth = e.target.value; drawChart(); };
}
function smoothArr(arr, mode) {
  if (mode === 'ma7') return arr.map((_, i) => avg(arr.slice(Math.max(0, i - 6), i + 1).filter(x => x != null)));
  return arr;
}
function drawChart() {
  const C = ui.chart, cv = $('#chart'); if (!cv) return; chartObj?.destroy(); chartOptions();
  const all = Object.keys(S.entries).filter(isLogged).sort();
  const end = today(); let start = C.range ? addDays(end, -C.range + 1) : (all[0] || addDays(end, -29));
  if (start > end) start = addDays(end, -29);
  const days = []; for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const col = { mut: css('--mut'), mut2: css('--mut2'), line: css('--line'), ink: css('--txt'), acc: css('--acc'), p: css('--p'), c: css('--c'), f: css('--f'), surf: css('--fill'), bg: css('--bg') };
  const fade = c => { const g = cv.getContext('2d').createLinearGradient(0, 0, 0, 240); g.addColorStop(0, c + '30'); g.addColorStop(1, c + '00'); return g; };
  const goalLine = (val, label = 'Ziel') => ({ type: 'line', label: t(label), data: days.map(() => val), borderColor: col.mut2, borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0 });
  const tot = {}; const totals = d => tot[d] ||= dayTotals(d);
  let datasets = [], labels = days.map(fmtShort), info = '', stacked = false, unit = '', dec = 0;
  if (C.metric === 'kcal' || C.metric === 'protein') {
    const k = C.metric === 'kcal' ? 'kcal' : 'p', c = k === 'kcal' ? col.acc : col.p, raw = days.map(d => isLogged(d) ? r0(totals(d)[k]) : null);
    datasets = [{ type: C.type, label: t(k === 'kcal' ? 'Kalorien' : 'Protein'), data: raw, borderColor: c, backgroundColor: C.type === 'bar' ? c : fade(c), fill: C.type === 'line', borderWidth: 2, borderRadius: 4, maxBarThickness: 18, tension: .3, pointRadius: 0, pointHoverRadius: 4, spanGaps: true }, goalLine(S.goals[k])];
    if (C.smooth !== 'none') datasets.push({ type: 'line', label: t('Geglättet'), data: smoothArr(raw, C.smooth), borderColor: col.ink, borderWidth: 1.5, pointRadius: 0, tension: .4, spanGaps: true });
    const vals = raw.filter(x => x != null); unit = k === 'kcal' ? 'kcal' : 'g';
    info = vals.length ? t('Ø {a} {u} an {n} geloggten Tagen', { a: de(avg(vals)), u: unit, n: vals.length }) : t('Keine Einträge in diesem Zeitraum.');
  } else if (C.metric === 'macros') {
    stacked = true; unit = 'kcal';
    const mk = (key, lbl, c, m) => ({ type: 'bar', label: t(lbl), data: days.map(d => isLogged(d) ? r0(totals(d)[key] * m) : null), backgroundColor: c, borderColor: col.surf, borderWidth: { top: 2 }, borderSkipped: false, borderRadius: 3, maxBarThickness: 18, stack: 's' });
    datasets = [mk('p', 'Protein', col.p, 4), mk('c', 'Kohlenhydrate', col.c, 4), mk('f', 'Fett', col.f, 9)];
    info = t('Kalorien aus Makros pro Tag (Protein und Kohlenhydrate × 4, Fett × 9).');
  } else if (C.metric === 'weekly') {
    const weeks = {};
    for (const d of days) { const mon = addDays(d, -((new Date(d + 'T12:00:00').getDay() + 6) % 7)); (weeks[mon] ||= []); if (isLogged(d)) weeks[mon].push(totals(d).kcal); }
    const keys = Object.keys(weeks).sort(); labels = keys.map(k => t('KW {d}', { d: fmtShort(k) })); unit = 'kcal';
    datasets = [{ type: 'bar', label: t('Ø kcal pro Tag'), data: keys.map(k => weeks[k].length ? r0(avg(weeks[k])) : null), backgroundColor: col.acc, borderRadius: 4, maxBarThickness: 32 },
      { ...goalLine(S.goals.kcal), data: keys.map(() => S.goals.kcal) }];
    info = t('Durchschnittliche Kalorien pro Woche im Vergleich zum Ziel.');
  }
  $('#cInfo').textContent = info;
  cv.setAttribute('aria-label', t(METRICS.find(m => m[0] === C.metric)[1]) + ' – ' + info);
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily; Chart.defaults.font.size = 11;
  chartObj = new Chart(cv, { data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: datasets.length > 1, position: 'bottom', align: 'start', labels: { color: col.mut, boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 14 } },
      tooltip: { backgroundColor: col.bg, titleColor: col.ink, bodyColor: col.ink, borderColor: col.line, borderWidth: 1, padding: 10, cornerRadius: 10, usePointStyle: true, boxPadding: 4,
        filter: it => it.parsed.y != null, callbacks: { label: c => ` ${c.dataset.label}: ${de(c.parsed.y, dec)} ${unit}` } } },
    scales: { x: { stacked, ticks: { color: col.mut, maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false }, border: { display: false } },
      y: { stacked, ticks: { color: col.mut, maxTicksLimit: 5 }, grid: { color: col.line }, border: { display: false }, beginAtZero: true } } } });
}
