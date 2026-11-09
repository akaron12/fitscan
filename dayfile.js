'use strict';
/* Day file (meal-log/1): parse and serialize one day's markdown file.
   Format spec: docs/FORMAT.md. Design rules (see spec-meal-tracker.md):
   - Never lose data: an entry that cannot be read is kept as raw text and written back untouched.
   - Unknown keys on an entry are kept and written back.
   - Text outside the YAML block (notes, headings) is kept verbatim.
   - A file with a newer format version than we support is read-only.
   Plain script: attaches to globalThis.DayFile (works in the browser and in jsc). */
(function (root) {
  const SUPPORTED_FORMAT = 1;
  const MEAL_IDS = ['breakfast', 'lunch', 'dinner', 'snacks'];
  const STATUS_IDS = ['planned', 'eaten'];
  const KEY_ORDER = ['id', 'meal', 'status', 'food', 'qty_g', 'kcal', 'p', 'c', 'f', 'fiber', 'sugar', 'salt', 'nutriscore', 'nova', 'barcode', 'source', 'note', 'rev', 'deleted'];
  const NUM_KEYS = ['qty_g', 'kcal', 'p', 'c', 'f', 'fiber', 'sugar', 'salt', 'nova', 'rev'];
  const isNum = x => typeof x === 'number' && Number.isFinite(x);

  // ---------- Scalars (a small, strict YAML subset) ----------
  class YamlError extends Error {}
  function parseScalar(s) {
    s = s.trim();
    if (s === '' || s === '~' || s === 'null') return null;
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s[0] === '"') {
      const m = /^"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$/.exec(s);
      if (!m) throw new YamlError('bad double-quoted string');
      try { return JSON.parse('"' + m[1] + '"'); } catch { throw new YamlError('bad escape in string'); }
    }
    if (s[0] === "'") {
      const m = /^'((?:[^']|'')*)'\s*(?:#.*)?$/.exec(s);
      if (!m) throw new YamlError('bad single-quoted string');
      return m[1].replace(/''/g, "'");
    }
    if ('[{|>&*!%@`'.includes(s[0])) throw new YamlError('unsupported YAML syntax: ' + s[0]);
    s = s.replace(/\s+#.*$/, '');                       // trailing comment
    if (/: |:$/.test(s)) throw new YamlError('unquoted colon in value (wrap the text in "double quotes")');
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  }
  function needsQuotes(s) {
    return s === '' || /^\s|\s$/.test(s) || /[:#"'\\\n\r\t]/.test(s) || /^[-?\[\]{}|>&*!%@`,~]/.test(s)
      || /^(null|true|false|~|yes|no|on|off)$/i.test(s) || /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s) || /^0x/i.test(s);
  }
  function emitScalar(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
    const s = String(v);
    return needsQuotes(s) ? JSON.stringify(s) : s;
  }

  // ---------- One list item -> object ----------
  function parseItem(lines, itemIndent) {
    const obj = {}, pad = ' '.repeat(itemIndent + 2);
    lines.forEach((line, i) => {
      if (/^\s*#/.test(line) || line.trim() === '') return;
      if (/\t/.test(line.match(/^\s*/)[0])) throw new YamlError('tab used for indentation');
      let body;
      if (i === 0) body = line.slice(itemIndent).replace(/^- ?/, '');
      else { if (!line.startsWith(pad)) throw new YamlError('unexpected indentation'); body = line.slice(pad.length); }
      if (/^\s/.test(body)) throw new YamlError('nested or misindented content is not supported');
      const m = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/.exec(body);
      if (!m) throw new YamlError('expected "key: value"');
      if (Object.prototype.hasOwnProperty.call(obj, m[1])) throw new YamlError('duplicate key ' + m[1]);
      obj[m[1]] = parseScalar(m[2] ?? '');
    });
    return obj;
  }

  // ---------- Entry validation / normalisation ----------
  function normaliseEntry(o) {
    const e = {}, x = {};
    for (const [k, v] of Object.entries(o)) (KEY_ORDER.includes(k) ? e : x)[k] = v;
    if (e.id !== undefined && e.id !== null) {
      e.id = String(e.id);   // ids end up in HTML attributes and as map keys: keep them boring
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(e.id)) throw new YamlError('id may only contain letters, digits, - and _ (max 64 characters)');
    } else delete e.id;
    const lower = v => typeof v === 'string' ? v.trim().toLowerCase() : v;
    e.meal = lower(e.meal); e.status = lower(e.status);
    if (!MEAL_IDS.includes(e.meal)) throw new YamlError(`meal must be one of ${MEAL_IDS.join(', ')}`);
    if (e.deleted === true) { if (!e.id) throw new YamlError('a deleted entry needs an id'); e.status = STATUS_IDS.includes(e.status) ? e.status : 'eaten'; }
    else if (!STATUS_IDS.includes(e.status)) throw new YamlError('status must be planned or eaten');
    if (typeof e.food !== 'string' || !e.food.trim()) { if (e.deleted !== true) throw new YamlError('food (a name) is required'); }
    for (const k of NUM_KEYS) if (e[k] !== undefined && e[k] !== null && !isNum(e[k])) throw new YamlError(`${k} must be a number`);
    if (e.deleted !== true) {
      if (!(e.qty_g > 0)) throw new YamlError('qty_g must be a number greater than 0');
      if (!isNum(e.kcal) || e.kcal < 0) throw new YamlError('kcal must be a number (0 or more)');
      for (const k of ['p', 'c', 'f']) { if (e[k] == null) e[k] = 0; if (e[k] < 0) throw new YamlError(k + ' must not be negative'); }
    }
    if (e.nutriscore != null) { e.nutriscore = String(e.nutriscore).trim().toLowerCase(); if (!/^[a-e]$/.test(e.nutriscore)) throw new YamlError('nutriscore must be a, b, c, d or e'); }
    if (e.nova != null && !(Number.isInteger(e.nova) && e.nova >= 1 && e.nova <= 4)) throw new YamlError('nova must be 1, 2, 3 or 4');
    if (e.rev != null) e.rev = Math.max(1, Math.floor(e.rev)); else delete e.rev;
    for (const k of Object.keys(e)) if (e[k] === null || e[k] === undefined) delete e[k];
    if (e.deleted !== true) delete e.deleted;
    return Object.keys(x).length ? { ...e, x } : e;
  }

  // ---------- Whole file ----------
  function splitLines(text) { return String(text ?? '').replace(/\r\n?/g, '\n').split('\n'); }
  function parse(text) {
    const lines = splitLines(text), m = { date: null, format: null, readOnly: false, warnings: [], fm: [], before: '', after: '', items: [], hasBlock: false, blockRaw: null };
    let i = 0;
    // frontmatter
    if (lines[0]?.trim() === '---') {
      const end = lines.indexOf('---', 1);
      if (end > 0) {
        m.fm = lines.slice(1, end); i = end + 1;
        for (const l of m.fm) {
          const kv = /^(\w+):\s*(.*?)\s*$/.exec(l); if (!kv) continue;
          if (kv[1] === 'date') m.date = parseScalar(kv[2]);
          if (kv[1] === 'format') m.format = parseScalar(kv[2]);
        }
      } else m.warnings.push('frontmatter is not closed with ---');
    }
    if (m.date != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(m.date))) { m.warnings.push('date is not YYYY-MM-DD'); }
    const fv = /^meal-log\/(\d+)$/.exec(String(m.format ?? ''));
    if (m.format != null && !fv) m.warnings.push('unknown format value: ' + m.format);
    if (fv && +fv[1] > SUPPORTED_FORMAT) { m.readOnly = true; m.warnings.push(`format ${m.format} is newer than this app understands (read-only)`); }
    // first yaml fence
    let start = -1, stop = -1;
    for (let j = i; j < lines.length; j++) {
      if (start < 0 && /^```\s*(yaml|yml)\s*$/i.test(lines[j].trim())) start = j;
      else if (start >= 0 && /^```\s*$/.test(lines[j].trim())) { stop = j; break; }
    }
    if (start < 0 || stop < 0) {
      m.before = lines.slice(i).join('\n');
      if (start >= 0) m.warnings.push('yaml block is not closed with ```'); else if (m.before.trim()) m.warnings.push('no yaml block found');
      return m;
    }
    m.hasBlock = true;
    m.before = lines.slice(i, start).join('\n'); m.after = lines.slice(stop + 1).join('\n');
    if (/```\s*(yaml|yml)/i.test(m.after)) m.warnings.push('more than one yaml block; only the first is read');
    const body = lines.slice(start + 1, stop);
    const first = body.findIndex(l => l.trim() !== '' && !/^\s*#/.test(l));
    if (first < 0 || !/^entries:\s*(\[\s*\])?\s*(#.*)?$/.test(body[first])) {
      m.blockRaw = body.join('\n'); m.warnings.push('yaml block does not start with "entries:" (kept untouched)'); m.readOnly = true; return m;
    }
    if (/\[\s*\]/.test(body[first])) { m.preEntries = body.slice(0, first).join('\n'); return m; }
    m.preEntries = body.slice(0, first).join('\n');
    // split items
    const rest = body.slice(first + 1), groups = []; let indent = null;
    for (const l of rest) {
      const im = /^(\s*)- ?/.exec(l);
      if (im && (indent === null || im[1].length === indent)) { indent ??= im[1].length; groups.push({ lines: [l] }); }
      else if (groups.length) groups.at(-1).lines.push(l);
      else if (l.trim() !== '' && !/^\s*#/.test(l)) { m.blockRaw = body.join('\n'); m.warnings.push('entries is not a list (kept untouched)'); m.readOnly = true; m.items = []; return m; }
    }
    const seen = new Set();
    for (const g of groups) {
      while (g.lines.length && g.lines.at(-1).trim() === '') g.lines.pop();   // trailing blanks are not part of the item
      try {
        const e = normaliseEntry(parseItem(g.lines, indent));
        if (e.id) { if (seen.has(e.id)) { m.warnings.push(`duplicate id ${e.id}; the later one gets a new id on sync`); delete e.id; } else seen.add(e.id); }
        m.items.push({ kind: 'entry', entry: e });
      } catch (err) {
        if (!(err instanceof YamlError)) throw err;
        m.items.push({ kind: 'raw', raw: g.lines.join('\n'), error: err.message });
        m.warnings.push('entry kept as raw text: ' + err.message);
      }
    }
    return m;
  }
  parse.entries = m => m.items.filter(it => it.kind === 'entry').map(it => it.entry);
  parse.rawItems = m => m.items.filter(it => it.kind === 'raw');

  // ---------- Serialize ----------
  function emitEntry(e) {
    const keys = [...KEY_ORDER.filter(k => e[k] !== undefined && e[k] !== null), ...Object.keys(e.x || {})];
    const val = k => KEY_ORDER.includes(k) ? e[k] : e.x[k];
    return keys.map((k, i) => `${i ? '    ' : '  - '}${k}: ${emitScalar(val(k))}`).join('\n');
  }
  function serialize(m) {
    if (m.readOnly && m.blockRaw != null) throw new Error('refusing to write a file that was not read as a whole');
    const out = [];
    const fm = m.fm?.length ? m.fm : [`date: ${m.date}`, `format: meal-log/${SUPPORTED_FORMAT}`];
    out.push('---', ...fm, '---');
    if (m.before) out.push(m.before);
    out.push('```yaml');
    if (m.preEntries) out.push(m.preEntries);
    if (!m.items.length) out.push('entries: []');
    else { out.push('entries:'); for (const it of m.items) out.push(it.kind === 'entry' ? emitEntry(it.entry) : it.raw); }
    out.push('```');
    if (m.after) out.push(m.after);
    return out.join('\n').replace(/\n*$/, '\n');
  }
  function create(date, entries = []) {
    return { date, format: 'meal-log/' + SUPPORTED_FORMAT, readOnly: false, warnings: [], fm: [], before: '', after: '', items: entries.map(entry => ({ kind: 'entry', entry })), hasBlock: true, blockRaw: null };
  }

  // ---------- App entry <-> file entry ----------
  const r1 = x => Math.round((+x || 0) * 10) / 10;
  const per100 = (v, g) => g > 0 ? (+v || 0) / g * 100 : 0;
  function toApp(fe) {
    const g = fe.qty_g, slug = String(fe.food).toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '');
    const food = { id: 'file:' + slug, name: fe.food, brand: '', img: '', cat: '', src: 'plan', code: fe.barcode || '', serving: null,
      n: { kcal: per100(fe.kcal, g), p: per100(fe.p, g), c: per100(fe.c, g), f: per100(fe.f, g), fib: per100(fe.fiber, g), sug: per100(fe.sugar, g), salt: per100(fe.salt, g) } };
    if (fe.nutriscore) food.ns = fe.nutriscore; if (fe.nova) food.nova = fe.nova;
    const e = { id: fe.id, meal: fe.meal, status: fe.status, rev: fe.rev || 1, g, label: `${r1(g)} g`, food };
    const extra = {}; if (fe.note) extra.note = fe.note; if (fe.source) extra.source = fe.source; if (fe.x) Object.assign(extra, fe.x);
    if (Object.keys(extra).length) e.x = extra;
    return e;
  }
  function fromApp(e) {
    const k = (+e.g || 0) / 100, n = e.food?.n || {}, o = { id: e.id, meal: e.meal, status: e.status || 'eaten', food: e.food?.name || '', qty_g: r1(e.g), kcal: Math.round((+n.kcal || 0) * k), p: r1((+n.p || 0) * k), c: r1((+n.c || 0) * k), f: r1((+n.f || 0) * k) };
    for (const [key, src] of [['fiber', 'fib'], ['sugar', 'sug'], ['salt', 'salt']]) { const v = r1((+n[src] || 0) * k); if (v) o[key] = v; }
    if (e.food?.ns) o.nutriscore = e.food.ns; if (e.food?.nova) o.nova = +e.food.nova;
    if (e.food?.code) o.barcode = e.food.code;
    o.rev = e.rev || 1;
    if (e.x) { const { note, source, ...rest } = e.x; if (note) o.note = note; if (source) o.source = source; if (Object.keys(rest).length) o.x = rest; }
    return o;
  }

  // ---------- Day Summary Markdown (for clipboard / AI chats) ----------
  function toSummary(date, entries = [], goals = null) {
    const r0 = x => Math.round(x || 0), r1 = x => Math.round((x || 0) * 10) / 10;
    const eaten = entries.filter(e => e.status !== 'planned');
    const planned = entries.filter(e => e.status === 'planned');

    const nutrOf = e => {
      const k = (+e.g || 0) / 100, n = e.food?.n || {};
      return {
        kcal: Math.round((+n.kcal || 0) * k),
        p: r1((+n.p || 0) * k),
        c: r1((+n.c || 0) * k),
        f: r1((+n.f || 0) * k)
      };
    };

    const sum = list => list.reduce((acc, e) => {
      const n = nutrOf(e);
      acc.kcal += n.kcal; acc.p += n.p; acc.c += n.c; acc.f += n.f;
      return acc;
    }, { kcal: 0, p: 0, c: 0, f: 0 });

    const eTot = sum(eaten), pTot = sum(planned);
    const out = [`# Meal Log: ${date}`, ''];

    if (goals && (goals.kcal > 0 || goals.p > 0 || goals.c > 0 || goals.f > 0)) {
      const leftKcal = goals.kcal - eTot.kcal;
      const leftP = goals.p - r0(eTot.p);
      const leftC = goals.c - r0(eTot.c);
      const leftF = goals.f - r0(eTot.f);
      out.push('## Daily Targets & Status');
      out.push(`- Calories: ${eTot.kcal} / ${goals.kcal} kcal (${leftKcal >= 0 ? `${leftKcal} kcal left` : `${Math.abs(leftKcal)} kcal over`})`);
      out.push(`- Protein: ${r0(eTot.p)} / ${goals.p} g (${leftP >= 0 ? `${leftP} g left` : `${Math.abs(leftP)} g over`})`);
      out.push(`- Carbs: ${r0(eTot.c)} / ${goals.c} g (${leftC >= 0 ? `${leftC} g left` : `${Math.abs(leftC)} g over`})`);
      out.push(`- Fat: ${r0(eTot.f)} / ${goals.f} g (${leftF >= 0 ? `${leftF} g left` : `${Math.abs(leftF)} g over`})`);
      if (planned.length > 0) {
        out.push(`- Projected with planned meals: ${eTot.kcal + pTot.kcal} kcal | P ${r0(eTot.p + pTot.p)}g | C ${r0(eTot.c + pTot.c)}g | F ${r0(eTot.f + pTot.f)}g`);
      }
      out.push('');
    } else {
      out.push('## Daily Status');
      out.push(`- Calories: ${eTot.kcal} kcal | Protein: ${r0(eTot.p)} g | Carbs: ${r0(eTot.c)} g | Fat: ${r0(eTot.f)} g`);
      if (planned.length > 0) {
        out.push(`- Projected with planned meals: ${eTot.kcal + pTot.kcal} kcal | P ${r0(eTot.p + pTot.p)}g | C ${r0(eTot.c + pTot.c)}g | F ${r0(eTot.f + pTot.f)}g`);
      }
      out.push('');
    }

    out.push('## Meals');
    const MEAL_NAMES = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks' };
    const order = ['breakfast', 'lunch', 'dinner', 'snacks'];

    for (const mId of order) {
      const mealEntries = entries.filter(e => e.meal === mId);
      const mEaten = mealEntries.filter(e => e.status !== 'planned');
      const mPlanned = mealEntries.filter(e => e.status === 'planned');
      const mTot = sum(mEaten), mPlanTot = sum(mPlanned);

      const headerParts = [];
      if (mEaten.length) headerParts.push(`${mTot.kcal} kcal · P ${r0(mTot.p)}g · C ${r0(mTot.c)}g · F ${r0(mTot.f)}g`);
      if (mPlanned.length) headerParts.push(`Planned: +${mPlanTot.kcal} kcal · P ${r0(mPlanTot.p)}g · C ${r0(mPlanTot.c)}g · F ${r0(mPlanTot.f)}g`);
      const sub = headerParts.length ? ` (${headerParts.join(' | ')})` : '';

      out.push(`### ${MEAL_NAMES[mId] || mId}${sub}`);
      if (!mealEntries.length) {
        out.push('*(none)*');
      } else {
        for (const e of mealEntries) {
          const n = nutrOf(e);
          const name = e.food?.name || 'Food';
          const qty = e.label || `${r1(e.g)} g`;
          const prefix = e.status === 'planned' ? '[Planned] ' : '';
          const note = e.x?.note ? ` · Note: ${e.x.note}` : '';
          out.push(`- ${prefix}${name} (${qty}): ${n.kcal} kcal | P ${r1(n.p)}g | C ${r1(n.c)}g | F ${r1(n.f)}g${note}`);
        }
      }
      out.push('');
    }

    return out.join('\n').trim() + '\n';
  }

  root.DayFile = { SUPPORTED_FORMAT, MEAL_IDS, STATUS_IDS, parse, serialize, create, toApp, fromApp, toSummary, emitScalar, parseScalar };
})(typeof globalThis !== 'undefined' ? globalThis : this);
