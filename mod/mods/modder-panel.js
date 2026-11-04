// Modder panel – F10 with Modder tools on (Settings → BetterDT → Mods): what a modder needs to know about the game,
// without developer tools or the game's code. Tabs:
// - Variables: the game's global variables by name or by value ("what holds 300 000 000?"), live; a click edits one.
// - Changes: Start, do something in the game, Stop: which variables and table cells changed, from what to what, with
//   the code for a mod (kit.table with the row named).
// - Tables: every table of the game with its size, as a grid; rows can be named and copied as kit.table(…).
// - Texts: the game's texts by wording, with their index, all languages and the code (spec.texts, kit.text).
// - Functions: the game's global functions with their parameters; one can be called with arguments.
// - Calls: Record, do something in the game, Stop: which game functions and event sheet functions ran, in order, with
//   their arguments and results, and the code to hook into one (kit.wrapCalls or a replaced function). The functions
//   are wrapped only while recording.
// - Console: runs JavaScript in the game (rt, kit and BetterDT at hand), shows what the mods log and their errors.
// The panel is HTML over the game; it is not the browser's developer tools and opens no debugging port.
BetterDTKit.mod('modder-panel', {}, (rt, kit) => {
  const B = BetterDT, S = B.settings, K = BetterDTKit, C = globalThis.BDTModderCore;
  const on = () => S.bool('modder.on', false);
  const gv = rt.globalVars;
  const MAX_ROWS = 300, MAX_TABLE_CELLS = 300000, MAX_RECORDS = 20000;

  kit.ui.css(`
#bdt-mp { position: fixed; z-index: 2147483500; top: 3vh; right: 1vw; width: min(46vw, 900px); height: 94vh; display: none;
  flex-direction: column; border-radius: 10px; background: rgba(10, 13, 20, .96); border: 1px solid rgba(255, 255, 255, .16);
  box-shadow: 0 12px 40px rgba(0, 0, 0, .6); color: #e8ecf4; font: 13px/1.45 Consolas, "Cascadia Mono", monospace; }
#bdt-mp.bdt-mp-on { display: flex; }
#bdt-mp .mp-head { display: flex; align-items: center; gap: 4px; padding: 8px 8px 0; border-bottom: 1px solid rgba(255, 255, 255, .12); flex-wrap: wrap; }
#bdt-mp .mp-tab { padding: 6px 10px; border-radius: 7px 7px 0 0; cursor: pointer; color: #9aa3b5; }
#bdt-mp .mp-tab:hover { color: #fff; }
#bdt-mp .mp-tab.mp-cur { background: rgba(255, 255, 255, .1); color: #ffd34d; }
#bdt-mp .mp-x { margin-left: auto; padding: 4px 10px; cursor: pointer; color: #9aa3b5; font-size: 16px; }
#bdt-mp .mp-x:hover { color: #fff; }
#bdt-mp .mp-body { flex: 1; overflow: auto; padding: 10px 12px; }
#bdt-mp .mp-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
#bdt-mp input[type=text], #bdt-mp textarea { background: rgba(0, 0, 0, .45); color: #fff; border: 1px solid rgba(255, 255, 255, .2);
  border-radius: 6px; padding: 5px 8px; font: inherit; outline: none; }
#bdt-mp input[type=text]:focus, #bdt-mp textarea:focus { border-color: #ffd34d; }
#bdt-mp .mp-btn { padding: 4px 10px; border-radius: 6px; background: rgba(255, 255, 255, .1); cursor: pointer; white-space: nowrap; }
#bdt-mp .mp-btn:hover { background: rgba(255, 255, 255, .2); }
#bdt-mp .mp-btn.mp-go { background: #3d8b1e; }
#bdt-mp .mp-btn.mp-stop { background: #a8323a; }
#bdt-mp .mp-row { display: flex; gap: 10px; padding: 2px 4px; border-radius: 4px; align-items: baseline; }
#bdt-mp .mp-row:hover { background: rgba(255, 255, 255, .06); }
#bdt-mp .mp-k { color: #8ea1ff; flex: 0 0 auto; }
#bdt-mp .mp-v { color: #e8ecf4; overflow-wrap: anywhere; flex: 1; }
#bdt-mp .mp-d { color: #9aa3b5; }
#bdt-mp .mp-y { color: #ffd34d; }
#bdt-mp .mp-g { color: #a8d418; }
#bdt-mp .mp-r { color: #ff7768; }
#bdt-mp .mp-a { cursor: pointer; }
#bdt-mp .mp-a:hover { text-decoration: underline; }
#bdt-mp .mp-box { margin: 4px 0 8px 16px; padding: 8px; border-radius: 6px; background: rgba(255, 255, 255, .05); }
#bdt-mp pre { margin: 4px 0; white-space: pre-wrap; overflow-wrap: anywhere; color: #cfd6e4; }
#bdt-mp table { border-collapse: collapse; }
#bdt-mp td, #bdt-mp th { border: 1px solid rgba(255, 255, 255, .1); padding: 2px 6px; text-align: left; white-space: nowrap; max-width: 220px;
  overflow: hidden; text-overflow: ellipsis; }
#bdt-mp th { color: #9aa3b5; font-weight: normal; }
#bdt-mp td input[type=text] { width: 110px; padding: 1px 4px; }
#bdt-mp .mp-log { white-space: pre-wrap; overflow-wrap: anywhere; padding: 1px 0; border-bottom: 1px solid rgba(255, 255, 255, .05); }
#bdt-mp .mp-note { position: absolute; bottom: 8px; left: 12px; color: #a8d418; }`);

  // ── the panel ──────────────────────────────────────────────────────────────────────────────────
  const el = (tag, cls, parent, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const panel = kit.ui.el('div', { id: 'bdt-mp' });
  kit.ui.shield(panel);
  const head = el('div', 'mp-head', panel), body = el('div', 'mp-body', panel), note = el('div', 'mp-note', panel);
  let noteTimer = 0;
  function say(text) { note.textContent = text; clearTimeout(noteTimer); noteTimer = setTimeout(() => { note.textContent = ''; }, 1800); }
  kit.onStop(() => clearTimeout(noteTimer));

  function copy(text, what) {
    const done = () => say('Copied: ' + what);
    const fallback = () => {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { }
      ta.remove(); done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  const btn = (parent, label, fn, cls = '') => {
    const b = el('span', 'mp-btn ' + cls, parent, label);
    b.addEventListener('click', kit.guard(fn));
    return b;
  };
  const input = (parent, placeholder, width = 260) => {
    const i = el('input', '', parent);
    i.type = 'text'; i.placeholder = placeholder; i.spellcheck = false; i.style.width = width + 'px';
    return i;
  };
  const preview = (v, d = 1) => { try { return C.preview(v, d); } catch (e) { return String(e && e.message); } };

  const TABS = ['Variables', 'Changes', 'Tables', 'Texts', 'Functions', 'Calls', 'Console'];
  const render = { Variables: renderVars, Changes: renderChanges, Tables: renderTables, Texts: renderTexts, Functions: renderFunctions, Calls: renderCalls, Console: renderConsole };
  let current = 'Variables', refresh = null;
  const tabEls = TABS.map(name => {
    const t = el('span', 'mp-tab', head, name);
    t.addEventListener('click', kit.guard(() => open(name)));
    return t;
  });
  const x = el('span', 'mp-x', head, '✕');
  x.title = 'Close (F10)';
  x.addEventListener('click', kit.guard(() => show(false)));

  function open(name) {
    current = name;
    tabEls.forEach((t, i) => t.classList.toggle('mp-cur', TABS[i] === name));
    body.innerHTML = '';
    body.style.display = ''; body.style.flexDirection = '';
    refresh = null;
    render[name](body);
  }
  let shown = false;
  function show(v) {
    shown = v;
    panel.classList.toggle('bdt-mp-on', v);
    if (v) open(current);
    else refresh = null;
  }
  // F10 opens and closes the panel; the game does not get it
  const onKey = (e) => {
    if (e.key !== 'F10' || !on()) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'keydown' && !e.repeat) show(!shown);
  };
  addEventListener('keydown', onKey, true);
  addEventListener('keyup', onKey, true);
  kit.onStop(() => { removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); });
  // the shown values are read again twice a second; the panel closes when the tools are turned off
  let lastRefresh = 0;
  kit.on('tick', () => {
    if (shown && !on()) show(false);
    if (!shown || !refresh || performance.now() - lastRefresh < 500) return;
    lastRefresh = performance.now();
    refresh();
  });

  // ── Variables ──────────────────────────────────────────────────────────────────────────────────
  const screenName = () => { try { return rt.layout.name; } catch { return ''; } };
  // a value as the user typed it: a number when it looks like one ("300 000 000" too), else the text
  const parseValue = (s) => { const n = Number(String(s).replace(/[\s,_]/g, '')); return s.trim() !== '' && Number.isFinite(n) ? n : s; };
  function matchesValue(v, q) {
    const n = parseValue(q);
    if (typeof n === 'number') {
      const x = Number(v);
      return typeof v !== 'boolean' && v !== '' && Number.isFinite(x) && Math.abs(x - n) <= Math.max(0.5, Math.abs(n) * 0.005);
    }
    return String(v).toLowerCase().includes(String(q).toLowerCase());
  }
  function renderVars(root) {
    const bar = el('div', 'mp-bar', root);
    const q = input(bar, 'name or value…');
    const byVal = el('label', 'mp-d', bar);
    const cb = el('input', '', byVal); cb.type = 'checkbox';
    byVal.append(' by value');
    const where = el('div', 'mp-d', root);
    const list = el('div', '', root);
    let rows = [];
    function search() {
      list.innerHTML = '';
      const s = q.value.trim(), names = Object.keys(gv);
      const hits = !s ? names : names.filter(n => (cb.checked ? matchesValue(gv[n], s) : n.toLowerCase().includes(s.toLowerCase())));
      rows = hits.slice(0, MAX_ROWS).map(n => {
        const r = el('div', 'mp-row', list);
        el('span', 'mp-k mp-a', r, n).addEventListener('click', kit.guard(() => copy(`rt.globalVars.${n}`, n)));
        const v = el('span', 'mp-v mp-a', r);
        v.title = 'Click to change';
        v.addEventListener('click', kit.guard(() => edit(n, v)));
        return { n, v };
      });
      if (hits.length > MAX_ROWS) el('div', 'mp-d', list, `… ${hits.length - MAX_ROWS} more, search to narrow it down`);
      paint();
    }
    function paint() {
      where.textContent = `Screen: ${screenName()} · ${Object.keys(gv).length} variables · click a name to copy it`;
      for (const r of rows) if (!r.v.querySelector('input')) r.v.textContent = preview(gv[r.n]);
    }
    function edit(n, v) {
      if (v.querySelector('input')) return;
      const old = gv[n], i = input(null, '', 200);
      i.value = String(old);
      v.textContent = '';
      v.appendChild(i);
      i.focus(); i.select();
      const done = (save) => {
        if (save) {
          const val = typeof old === 'number' ? parseValue(i.value) : i.value;
          gv[n] = typeof old === 'number' && typeof val !== 'number' ? old : val;
          say(`${n} = ${preview(gv[n])}`);
        }
        i.remove(); paint();
      };
      i.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
      i.addEventListener('blur', () => done(false));
    }
    q.addEventListener('input', kit.guard(search));
    cb.addEventListener('change', kit.guard(search));
    search();
    refresh = paint;
    q.focus();
  }

  // ── Changes ────────────────────────────────────────────────────────────────────────────────────
  const arrays = () => Object.keys(rt.objects).filter(n => n.startsWith('Array')).sort();
  const firstInst = (n) => { try { return rt.objects[n].getFirstInstance(); } catch { return null; } };
  function snapshot() {
    const vars = {}, tables = {};
    for (const [k, v] of Object.entries(gv)) vars[k] = v;
    for (const n of arrays()) {
      const a = firstInst(n);
      if (!a || n === 'ArrayLanguage' || a.width * a.height > MAX_TABLE_CELLS) continue;
      const cols = [];
      for (let x = 0; x < a.width; x++) { const c = []; for (let y = 0; y < a.height; y++) c.push(a.getAt(x, y)); cols.push(c); }
      tables[n] = cols;
    }
    return { vars, tables };
  }
  let before = null, changes = null;
  function renderChanges(root) {
    const bar = el('div', 'mp-bar', root);
    const info = el('div', 'mp-d', root);
    const list = el('div', '', root);
    const paint = () => {
      bar.innerHTML = '';
      if (before) btn(bar, '■ Stop', () => { changes = C.diff(before, snapshot()); before = null; paint(); }, 'mp-stop');
      else btn(bar, '● Start', () => { before = snapshot(); changes = null; paint(); }, 'mp-go');
      info.textContent = before ? 'Watching. Do something in the game, then Stop.'
        : changes ? `${changes.filter(c => c.kind !== 'more').length} changes · click one for the code` : 'Start, do something in the game (buy, hire, wait a day), then Stop: the variables and table cells that changed are listed.';
      list.innerHTML = '';
      for (const c of changes || []) {
        const r = el('div', 'mp-row', list);
        if (c.kind === 'more') { el('span', 'mp-d', r, `… ${c.count} more`); continue; }
        if (c.kind === 'var') {
          el('span', 'mp-k mp-a', r, c.name).addEventListener('click', kit.guard(() => copy(`rt.globalVars.${c.name}`, c.name)));
        } else {
          const label = c.kind === 'size' ? `${c.table} size` : `${c.table} [x ${c.x}, y ${c.y}]`;
          const k = el('span', 'mp-k mp-a', r, label);
          if (c.kind === 'cell') k.addEventListener('click', kit.guard(() => copy(C.tableCode(c.table, { field: c.y }) + `\nt.get(${c.x}, 'field');`, 'kit.table')));
        }
        const v = el('span', 'mp-v', r);
        el('span', 'mp-r', v, preview(c.from, 0));
        el('span', 'mp-d', v, ' → ');
        el('span', 'mp-g', v, preview(c.to, 0));
        if (typeof c.from === 'number' && typeof c.to === 'number') {
          const d = c.to - c.from;
          el('span', 'mp-d', v, `  (${d > 0 ? '+' : ''}${+d.toFixed(4)})`);
        }
      }
    };
    paint();
  }

  // ── Tables ─────────────────────────────────────────────────────────────────────────────────────
  const tableFields = {};   // table -> { y: name } named in the panel
  function renderTables(root) {
    const bar = el('div', 'mp-bar', root);
    const q = input(bar, 'table name…', 220);
    const list = el('div', '', root), view = el('div', '', root);
    function search() {
      list.innerHTML = '';
      view.innerHTML = '';
      const s = q.value.trim().toLowerCase();
      const hits = arrays().filter(n => n.toLowerCase().includes(s));
      for (const n of hits.slice(0, MAX_ROWS)) {
        const a = firstInst(n), r = el('div', 'mp-row', list);
        el('span', 'mp-k mp-a', r, n).addEventListener('click', kit.guard(() => grid(n)));
        el('span', 'mp-d', r, a ? `${a.width} × ${a.height}` : 'no instance');
      }
    }
    function grid(n, x0 = 0, y0 = 0) {
      const a = firstInst(n);
      if (!a) return;
      list.innerHTML = '';
      view.innerHTML = '';
      const W = 10, H = 40, fields = tableFields[n] || (tableFields[n] = {});
      const nav = el('div', 'mp-bar', view);
      btn(nav, '← tables', search);
      el('span', 'mp-y', nav, `${n} · ${a.width} columns (x) × ${a.height} rows (y)`);
      btn(nav, '◀', () => grid(n, Math.max(0, x0 - W), y0));
      btn(nav, '▶', () => grid(n, Math.min(Math.max(0, a.width - 1), x0 + W), y0));
      btn(nav, '▲', () => grid(n, x0, Math.max(0, y0 - H)));
      btn(nav, '▼', () => grid(n, x0, Math.min(Math.max(0, a.height - 1), y0 + H)));
      btn(nav, 'Copy kit.table', () => {
        const f = {};
        for (const [y, name] of Object.entries(fields)) if (name) f[name] = Number(y);
        copy(C.tableCode(n, f), 'kit.table');
      });
      el('div', 'mp-d', view, 'Most tables keep one record per column (x) and its fields in rows (y). Name the rows you understand, then copy the code.');
      const t = el('table', '', view), hr = el('tr', '', t);
      el('th', '', hr, 'y \\ x'); el('th', '', hr, 'field name');
      for (let x = x0; x < Math.min(a.width, x0 + W); x++) el('th', '', hr, String(x));
      const cells = [];
      for (let y = y0; y < Math.min(a.height, y0 + H); y++) {
        const tr = el('tr', '', t);
        el('th', '', tr, String(y));
        const fi = input(el('td', '', tr), '');
        fi.value = fields[y] || '';
        fi.addEventListener('input', () => { fields[y] = fi.value.trim(); });
        for (let x = x0; x < Math.min(a.width, x0 + W); x++) {
          const td = el('td', '', tr);
          cells.push([td, x, y]);
        }
      }
      const paint = () => { for (const [td, x, y] of cells) { const v = a.getAt(x, y); const s = preview(v, 0); if (td.textContent !== s) { td.textContent = s; td.title = s; } } };
      paint();
      refresh = paint;
    }
    q.addEventListener('input', kit.guard(search));
    search();
    q.focus();
  }

  // ── Texts ──────────────────────────────────────────────────────────────────────────────────────
  const LANGS = ['en', 'ru', 'de', 'fr', 'it', 'es', 'hi', 'tr', 'pt-BR', 'uk', 'id', 'pl', 'zh', 'ko', 'ja'];
  function renderTexts(root) {
    const L = firstInst('ArrayLanguage');
    const bar = el('div', 'mp-bar', root);
    const q = input(bar, 'part of a text (any language)…', 320);
    const list = el('div', '', root);
    const lang = () => { const l = Math.round(Number(gv.LanguageChoose)); return l >= 0 && l < 15 ? l : 0; };
    function search() {
      list.innerHTML = '';
      const s = q.value.trim().toLowerCase();
      if (!L || s.length < 2) { el('div', 'mp-d', list, L ? 'Type at least 2 letters.' : 'The game texts are not loaded yet.'); return; }
      let n = 0;
      for (let y = 0; y < L.height && n < MAX_ROWS; y++) {
        const en = String(L.getAt(0, y)), cur = String(L.getAt(lang(), y));
        if (!en.toLowerCase().includes(s) && !cur.toLowerCase().includes(s)) continue;
        n++;
        const r = el('div', 'mp-row', list);
        el('span', 'mp-k mp-a', r, String(y)).addEventListener('click', kit.guard(() => details(y, r)));
        el('span', 'mp-v', r, en + (lang() && cur !== en ? '  ·  ' + cur : ''));
      }
      if (!n) el('div', 'mp-d', list, 'Not found.');
    }
    function details(y, r) {
      const next = r.nextSibling;
      if (next && next.classList && next.classList.contains('mp-box')) { next.remove(); return; }
      const box = el('div', 'mp-box');
      r.after(box);
      btn(el('div', 'mp-bar', box), 'Copy code', () => copy(C.textCode(y, String(L.getAt(0, y))), 'kit.text'));
      for (let l = 0; l < Math.min(15, L.width); l++) {
        const row = el('div', 'mp-row', box);
        el('span', 'mp-d', row, LANGS[l].padEnd(6));
        el('span', 'mp-v', row, String(L.getAt(l, y)));
      }
    }
    q.addEventListener('input', kit.guard(search));
    search();
    q.focus();
  }

  // ── Functions ──────────────────────────────────────────────────────────────────────────────────
  const isNative = (f) => { try { return /\[native code\]\s*\}$/.test(Function.prototype.toString.call(f)); } catch { return true; } };
  const OWN = /^(BetterDT|BDT|__dt|__bdt|DTMods)/;
  // the game's global functions (written in its scripts, not the browser's or BetterDT's)
  let fnCache = null;
  function gameFunctions() {
    if (fnCache) return fnCache;
    const out = [];
    for (const n of Object.getOwnPropertyNames(globalThis)) {
      if (OWN.test(n)) continue;
      let d;
      try { d = Object.getOwnPropertyDescriptor(globalThis, n); } catch { continue; }
      if (!d || typeof d.value !== 'function' || isNative(d.value) || /^class\b/.test(Function.prototype.toString.call(d.value))) continue;
      out.push(n);
    }
    return (fnCache = out.sort((a, b) => a.localeCompare(b)));
  }
  // a typed argument: JavaScript ('abc' needs quotes, 5, [1, 2], rt.globalVars.Budget); empty = undefined
  const argValue = (s) => (s.trim() === '' ? undefined : new Function('rt', 'kit', 'return (' + s + '\n)')(rt, kit));
  function renderFunctions(root) {
    const bar = el('div', 'mp-bar', root);
    const q = input(bar, 'function name…', 260);
    const info = el('div', 'mp-d', root, '');
    const list = el('div', '', root);
    function search() {
      list.innerHTML = '';
      const s = q.value.trim().toLowerCase(), all = gameFunctions();
      info.textContent = `${all.length} game functions · click one to call it. Calling a function changes the game the way the game itself would: try it on a save you do not mind losing.`;
      const hits = all.filter(n => n.toLowerCase().includes(s));
      for (const n of hits.slice(0, MAX_ROWS)) {
        const r = el('div', 'mp-row', list);
        el('span', 'mp-k mp-a', r, n).addEventListener('click', kit.guard(() => details(n, r)));
        el('span', 'mp-d', r, '(' + C.params(globalThis[n]).join(', ') + ')');
      }
      if (hits.length > MAX_ROWS) el('div', 'mp-d', list, `… ${hits.length - MAX_ROWS} more, search to narrow it down`);
    }
    function details(n, r) {
      const next = r.nextSibling;
      if (next && next.classList && next.classList.contains('mp-box')) { next.remove(); return; }
      const box = el('div', 'mp-box');
      r.after(box);
      const ps = C.params(globalThis[n]), ins = [];
      for (const p of ps) {
        const row = el('div', 'mp-bar', box);
        el('span', 'mp-k', row, p.padEnd(12));
        ins.push(input(row, "JavaScript: 5, 'text', [1, 2] (empty: none)", 300));
      }
      const acts = el('div', 'mp-bar', box), out = el('pre', '', box);
      btn(acts, '▶ Call', async () => {
        let args;
        try { args = ins.map(i => argValue(i.value)); } catch (e) { out.textContent = 'Argument: ' + e.message; out.className = 'mp-r'; return; }
        try {
          let v = globalThis[n](...args);
          if (v && typeof v.then === 'function') v = await v;
          out.className = 'mp-g'; out.textContent = '→ ' + preview(v, 2);
        } catch (e) { out.className = 'mp-r'; out.textContent = (e && e.name) + ': ' + (e && e.message); }
      }, 'mp-go');
      btn(acts, 'Copy call', () => copy(`${n}(${ps.filter(p => p !== '…').join(', ')})`, n));
      btn(acts, 'Copy code to replace it', () => copy(C.replaceCode(n, ps), 'replace ' + n));
    }
    q.addEventListener('input', kit.guard(search));
    search();
    q.focus();
  }

  // ── Calls ──────────────────────────────────────────────────────────────────────────────────────
  let recording = null, records = [], stopEvents = null;
  const restore = [];
  function startRecording(js, events) {
    records = [];
    recording = { at: performance.now() };
    if (js) {
      for (const n of gameFunctions()) {
        const d = Object.getOwnPropertyDescriptor(globalThis, n);
        if (!d || !d.writable || !d.configurable) continue;
        const f = d.value;
        const w = function (...a) {
          if (recording && records.length < MAX_RECORDS) records.push({ name: n, kind: 'js', args: a.map(v => preview(v, 0)).join(', '), result: '' });
          const rec = records[records.length - 1];
          const r = new.target ? Reflect.construct(f, a, new.target) : f.apply(this, a);
          if (rec && rec.name === n && recording) rec.result = preview(r, 0);
          return r;
        };
        globalThis[n] = w;
        restore.push(() => { if (globalThis[n] === w) globalThis[n] = f; });
      }
    }
    if (events && K.traceEventCalls) stopEvents = K.traceEventCalls((name) => {
      if (recording && records.length < MAX_RECORDS) records.push({ name, kind: 'event', args: '', result: '' });
    });
  }
  function stopRecording() {
    for (const r of restore.splice(0)) { try { r(); } catch { } }
    if (stopEvents) { stopEvents(); stopEvents = null; }
    recording = null;
  }
  kit.onStop(stopRecording);
  function renderCalls(root) {
    const bar = el('div', 'mp-bar', root);
    const opts = el('div', 'mp-bar', root);
    const box = (label, def) => { const l = el('label', 'mp-d', opts); const c = el('input', '', l); c.type = 'checkbox'; c.checked = def; l.append(' ' + label); return c; };
    const js = box('game functions', true), ev = box('event sheet functions', true);
    const q = input(opts, 'filter…', 180);
    const info = el('div', 'mp-d', root), list = el('div', '', root);
    const paint = () => {
      bar.innerHTML = '';
      if (recording) btn(bar, '■ Stop', () => { stopRecording(); paint(); }, 'mp-stop');
      else btn(bar, '● Record', () => { startRecording(js.checked, ev.checked); paint(); }, 'mp-go');
      if (recording) { info.textContent = `Recording… ${records.length} calls. Do something in the game, then Stop.`; list.innerHTML = ''; return; }
      const s = q.value.trim().toLowerCase();
      const calls = C.collapse(records.filter(r => r.name.toLowerCase().includes(s)));
      info.textContent = records.length ? `${records.length} calls${records.length >= MAX_RECORDS ? ' (the first ' + MAX_RECORDS + ')' : ''} · click one for the code to hook into it`
        : 'Record, do something in the game (click a button, wait a day), then Stop: the functions that ran are listed in order.';
      list.innerHTML = '';
      for (const c of calls.slice(0, 2000)) {
        const r = el('div', 'mp-row', list);
        const k = el('span', 'mp-k mp-a', r, (c.kind === 'event' ? '◆ ' : 'ƒ ') + c.name);
        k.title = c.kind === 'event' ? 'event sheet function: copy kit.wrapCalls' : 'game function: copy the code to replace it';
        k.addEventListener('click', kit.guard(() => copy(c.kind === 'event' ? C.wrapCallsCode(c.name) : C.replaceCode(c.name, C.params(globalThis[c.name] || (() => { }))), c.name)));
        el('span', 'mp-v', r, (c.kind === 'js' ? '(' + c.args + ')' + (c.result && c.result !== 'undefined' ? ' → ' + c.result : '') : '') + (c.n > 1 ? `  × ${c.n}` : ''));
      }
      if (calls.length > 2000) el('div', 'mp-d', list, `… ${calls.length - 2000} more, filter to narrow it down`);
    };
    q.addEventListener('input', kit.guard(paint));
    paint();
    refresh = () => { if (recording) info.textContent = `Recording… ${records.length} calls. Do something in the game, then Stop.`; };
  }

  // ── Console ────────────────────────────────────────────────────────────────────────────────────
  const lines = [], history = [];
  let logEl = null;
  function addLine(text, cls = '') {
    lines.push([text, cls]);
    if (lines.length > 500) lines.shift();
    if (logEl && logEl.isConnected) { el('div', 'mp-log ' + cls, logEl, text); while (logEl.childNodes.length > 500) logEl.firstChild.remove(); logEl.scrollTop = logEl.scrollHeight; }
  }
  // what the mods log, and their errors, are shown in the console too (while the tools are on)
  const origLog = console.log, origWarn = console.warn, origError = console.error;
  const fmt = (args) => args.map(a => (typeof a === 'string' ? a : preview(a, 1))).join(' ');
  console.log = function (...a) { if (on()) addLine(fmt(a), 'mp-d'); return origLog.apply(this, a); };
  console.warn = function (...a) { if (on()) addLine(fmt(a), 'mp-y'); return origWarn.apply(this, a); };
  console.error = function (...a) { if (on()) addLine(fmt(a), 'mp-r'); return origError.apply(this, a); };
  kit.onStop(() => { console.log = origLog; console.warn = origWarn; console.error = origError; });
  if (K.onError) kit.onStop(K.onError((name, e) => { if (on()) addLine(`mod ${name}: ${e.file ? e.file + ':' + e.line + ' ' : ''}${e.message}`, 'mp-r'); }));

  const AsyncFunction = (async () => { }).constructor;
  async function run(code) {
    addLine('> ' + code, 'mp-y');
    let fn;
    // an expression gives its value; statements run as they are (let/const live for this one run: use globalThis.x)
    try { fn = new AsyncFunction('rt', 'kit', 'BetterDT', 'return (' + code + '\n)'); } catch {
      try { fn = new AsyncFunction('rt', 'kit', 'BetterDT', code); } catch (e) { addLine(e.name + ': ' + e.message, 'mp-r'); return; }
    }
    try { addLine('← ' + preview(await fn(rt, kit, B), 2), 'mp-g'); } catch (e) { addLine((e && e.name) + ': ' + (e && e.message), 'mp-r'); }
  }
  function renderConsole(root) {
    root.style.display = 'flex'; root.style.flexDirection = 'column';
    logEl = el('div', '', root);
    logEl.style.flex = '1'; logEl.style.overflow = 'auto';
    if (!lines.length) addLine('JavaScript runs in the game: rt is the runtime, kit this panel\'s kit, BetterDT the loader. Enter runs, Shift+Enter a new line, ↑ ↓ the history. Examples: rt.globalVars.Budget · rt.layout.name · kit.game.employees()', 'mp-d');
    for (const [t, c] of lines) el('div', 'mp-log ' + c, logEl, t);
    const ta = el('textarea', '', root);
    ta.rows = 3; ta.spellcheck = false; ta.style.marginTop = '8px';
    let h = history.length;
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const code = ta.value.trim();
        if (!code) return;
        history.push(code); h = history.length; ta.value = '';
        run(code);
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !ta.value.includes('\n')) {
        e.preventDefault();
        h = Math.max(0, Math.min(history.length, h + (e.key === 'ArrowUp' ? -1 : 1)));
        ta.value = history[h] || '';
      }
    });
    logEl.scrollTop = logEl.scrollHeight;
    ta.focus();
  }
});
