// BetterDT – the "BetterDT" section in the game settings (Settings).
//
// The game's settings page is HTML built by the game (#gs-root: #gs-nav on the left, #gs-main-head and
// #gs-main-body on the right, #gs-foot at the bottom). We add a "BetterDT" group with two items to the
// navigation and render their pages with the same classes (gs-card, gs-row, gs-sw, gs-slider…), so they look
// like the game's. The game rebuilds the navigation on every change (innerHTML = ''), so a MutationObserver
// watches it. Settings are saved immediately (through the loader into mods\betterdt.ini). The game's own pages
// are saved immediately too (autoApply below), so their Apply button is hidden.
//
// It also shows two dialogs in the style of the game's news window: "BetterDT x.y.z is ready" (keep playing or
// restart the game now) and, after the loader reloaded a crashed game page, "The game crashed" with a bug report.
// After the game itself was updated, a third one says which mods still fit the new version. If a game update
// changes the settings page so that the section cannot be added, a "BetterDT" button opens the mods as a plain list.
//
// ── BetterDTKit: compatibility checks for mods (runs before the other mod files) ─────────────────────
// A mod registered with BetterDTKit.mod(name, spec, init) starts only once the game data is loaded (main menu)
// and only when everything it needs from the game is there:
//   spec.needs = { functions: [global functions], objects: [object types], vars: [global variables],
//                  calls: [event sheet functions], actions: [action SIDs],
//                  check: (rt) => problem text or '',
//                  arrays: { ArrayName: [min width, min height] }, dataCheck: (rt) => problem text or '' }
//                arrays and dataCheck are checked once a saved game is loaded (the company tables are empty in
//                the menu); a mod that fails them then is stopped
//   spec.texts = { index: 'English text' }   game texts; a moved text is found again by its English wording
//   spec.uids  = { uid: { layout, t: type, l: layer, w, h, x, y } }   instances on a layout; when the uid no
//                longer fits (type, layer, size), the instance of that type and layer with that size nearest to
//                x, y is used
// init(rt, kit) returns a dispose function. kit.guard(fn) wraps timers and listeners: errors are counted and after
// 20 of them the mod is stopped. kit.inst(uid), kit.text(index), kit.fail(problem), kit.warn(problem).
// kit.wrapCalls(eventFunction, { before, after }), kit.wrapAction(sid, …) and kit.wrapScript(scriptName, …) run
// code around the game's event sheet actions (every call site of an event function and the game scripts' calls of
// it, one action, the script action "EventGameplay_Event449_Act1" …); they are undone when the mod stops. An async
// action's after runs once it settled.
// kit.salesMultiplier(fn) multiplies the popularity of the player's devices while the game computes the daily sales
// (fn(salesArray, x, y) → factor; the mods' factors multiply).
// A mod that does not fit this game version is not started; the BetterDT settings say why.
//
// Added for mods by others (all optional, the calls above stay as they are; MODDING.md has the details):
//   spec.info = { title, description, version, author, options, requires }   texts are a string or
//                { en, ru, de, … }; a folder mod (mods\<folder>\mod.json) has the same fields in its manifest
//   kit.option(key)        the value of one of the mod's options (typed, default from spec.info / mod.json)
//   kit.on(event, [filter], fn)   tick, screen, leave, day, month, year, gameLoaded, gameClosed, language, option,
//                          setting; returns off(), removed when the mod stops
//   kit.table(name, fields), kit.game   game tables with named fields, money, date, screen, …
//   kit.ui                 css, el, shield, anchor, button, toast, dialog in the game's look; removed on stop
(() => {
  const B = globalThis.BetterDT;
  if (!B || globalThis.BetterDTKit) return;
  const MAX_ERRORS = 20;
  const mods = new Map();   // name -> { state: 'waiting'|'running'|'incompatible'|'failed', problems: [], … }
  const log = (...a) => B.log(...a);
  let rt = null, readyAt = 0;
  const readyWaiters = [];
  const layoutName = () => { try { return rt.layout.name; } catch { return ''; } };

  function dataReady() {
    try {
      const a = rt.objects.ArrayLanguage && rt.objects.ArrayLanguage.getFirstInstance();
      if (!a || a.height <= 1) return false;
      return layoutName() === 'MENU' || Number(rt.globalVars.DayTotal) > 0;
    } catch { return false; }
  }
  // time that passes while the game runs: a minimized window does not tick, so the game loads nothing meanwhile
  function runningClock() {
    let ms = 0, last = Date.now();
    return () => {
      const now = Date.now();
      if (document.visibilityState !== 'hidden') ms += now - last;
      last = now;
      return ms;
    };
  }
  function waitReady(cb) {
    if (readyAt) return cb();
    readyWaiters.push(cb);
    if (readyWaiters.length > 1) return;
    const waited = runningClock();
    (function poll() {
      // a renamed menu or table must not block the mods forever: after 60 s of play the checks run anyway
      if (dataReady() || waited() > 60000) {
        readyAt = Date.now();
        for (const f of readyWaiters.splice(0)) { try { f(); } catch (e) { console.error('[BetterDTKit]', e); } }
      } else setTimeout(poll, 300);
    })();
  }

  // game texts: index in game 1.3.0 -> index in this game version (-1 = not found)
  const textMap = new Map();
  function healText(idx, en) {
    if (textMap.has(idx)) return textMap.get(idx);
    let found = -1;
    try {
      const a = rt.objects.ArrayLanguage.getFirstInstance();
      if (String(a.getAt(0, idx)) === en) found = idx;
      else for (let y = 0; y < a.height; y++) if (String(a.getAt(0, y)) === en) { found = y; break; }
    } catch { }
    if (found >= 0 && found !== idx) log('[BetterDTKit] text', idx, 'moved to', found, JSON.stringify(en));
    textMap.set(idx, found);
    return found;
  }

  // A saved game is loaded after its required tables have been filled.  Since game 1.5, DayTotal becomes
  // positive before several of those tables are populated, so time alone is not a reliable signal.
  const gameWaiters = [];
  let gameSince = null, gameTimer = 0;
  function tablesReady(spec) {
    for (const [name, [w, h]] of Object.entries((spec.needs || {}).arrays || {})) {
      let a = null;
      try { a = rt.objects[name] && rt.objects[name].getFirstInstance(); } catch { }
      if (!a || a.width < (w || 0) || a.height < (h || 0)) return false;
    }
    return true;
  }
  function tablesEmpty(spec) {
    for (const name of Object.keys((spec.needs || {}).arrays || {})) {
      let a = null;
      try { a = rt.objects[name] && rt.objects[name].getFirstInstance(); } catch { }
      if (a && (a.width === 0 || a.height === 0)) return true;
    }
    return false;
  }
  function whenGameLoaded(spec, cb) {
    gameWaiters.push({ spec, cb });
    if (gameTimer) return;
    gameTimer = setInterval(() => {
      if (!(Number(rt.globalVars.DayTotal) > 0)) { gameSince = null; return; }
      if (!gameSince) { gameSince = runningClock(); return; }
      const since = gameSince();
      if (since < 2000) return;
      // Keep waiting only for tables that have not arrived yet.  The timeout lets checkData still report a
      // genuinely incompatible game instead of leaving a mod in the waiting state forever.
      const force = since >= 60000;
      for (let i = gameWaiters.length - 1; i >= 0; i--) {
        const w = gameWaiters[i];
        // an empty table (0 rows or columns) is not loaded yet (a new game being set up, a save still loading):
        // keep waiting for it even after the timeout, only a filled table of the wrong size is incompatible
        if ((!force && !tablesReady(w.spec)) || tablesEmpty(w.spec)) continue;
        gameWaiters.splice(i, 1);
        try { w.cb(); } catch (e) { console.error('[BetterDTKit]', e); }
      }
      if (!gameWaiters.length) { clearInterval(gameTimer); gameTimer = 0; }
    }, 500);
  }

  // The event sheet manager is not reachable from the runtime's public API. It is captured while the runtime looks
  // up a function block: the prototype method is patched for the length of one callFunction of a name that does
  // not exist.
  let esmCache = null;
  function eventSheets() {
    if (esmCache) return esmCache;
    const P = self.C3 && self.C3.EventSheetManager && self.C3.EventSheetManager.prototype;
    if (!P || !rt || typeof P.GetFunctionBlockByName !== 'function') return null;
    const orig = P.GetFunctionBlockByName;
    P.GetFunctionBlockByName = function () { esmCache = this; return orig.apply(this, arguments); };
    try { rt.callFunction('betterdt-probe'); } catch { } finally { P.GetFunctionBlockByName = orig; }
    return esmCache;
  }
  // Function-call actions bind the function's event block at start, so a call is changed by wrapping each call site.
  function callSites(fnName) {
    const esm = eventSheets(), fb = esm && esm.GetFunctionBlockByName(fnName);
    if (!fb) return [];
    const eb = fb.GetEventBlock(), out = [];
    for (const act of esm._actsBySid.values()) if (act._callEventBlock === eb) out.push(act);
    return out;
  }
  // Script actions have no SID and hold their function bound ("bound EventGameplay_Event449_Act1"), so they are
  // found by name in the event blocks.
  function scriptActs(name) {
    const esm = eventSheets(), out = [];
    if (esm) for (const b of esm._blocksBySid.values()) for (const act of b._actions || []) {
      if (act._func && act._func.name === 'bound ' + name) out.push(act);
    }
    return out;
  }
  // wraps act.Run; returns the undo function
  function wrapRun(act, before, after) {
    const orig = act.Run;
    act.Run = function () {
      if (before) before(act);
      const r = orig.apply(this, arguments);
      if (after) {
        if (r && typeof r.then === 'function') return r.then(v => { after(act); return v; });
        after(act);
      }
      return r;
    };
    return () => { act.Run = orig; };
  }
  // The game's scripts call event functions with runtime.callFunction (the reviews screen calls ReviewsEngineResults
  // again for a private CPU), which no call site sees: runtime.callFunction is patched once and runs the handlers of
  // the name around the call. Returns the undo function.
  const scriptCalls = new Map();   // function name -> Set of { before, after }
  function wrapScriptCalls(fnName, before, after) {
    if (!rt) return () => { };
    if (!Object.prototype.hasOwnProperty.call(rt, 'callFunction')) {
      const orig = rt.callFunction;
      rt.callFunction = function (name) {
        const hs = scriptCalls.get(name);
        if (!hs || !hs.size) return orig.apply(this, arguments);
        const list = [...hs];
        for (const h of list) if (h.before) h.before();
        const r = orig.apply(this, arguments);
        const done = () => { for (const h of list) if (h.after) h.after(); };
        if (r && typeof r.then === 'function') return r.then(v => { done(); return v; });
        done();
        return r;
      };
    }
    const h = { before, after };
    if (!scriptCalls.has(fnName)) scriptCalls.set(fnName, new Set());
    scriptCalls.get(fnName).add(h);
    return () => { const hs = scriptCalls.get(fnName); if (hs) hs.delete(h); };
  }

  // ── popularity multipliers of the daily sales (kit.salesMultiplier) ─────────────────────────────────────
  // While the game's daily sales script runs, reading the popularity of a device (z = 2 of its sales array)
  // gives it × the product of the mods' multipliers; the value written back keeps the game's own decay.
  const POP = 2, salesMuls = new Set();
  let salesHooked = false, popPatched = [];
  const salesArrays = () => {
    const D = globalThis.BDTReviewData;
    return D ? [...new Set(Object.values(D.engines).map(e => e.device))].filter(n => n !== 'ArrayGamepads') : [];
  };
  function popFactor(name, x, y) {
    let f = 1;
    for (const s of salesMuls) {
      const v = Number(s.fn(name, x, y));
      if (Number.isFinite(v) && v >= 0) f *= v;
    }
    return f;
  }
  function popOn(names = salesArrays()) {
    if (!salesMuls.size || popPatched.length) return;
    for (const name of names) {
      const a = rt && rt.objects[name] && rt.objects[name].getFirstInstance();
      if (!a || Object.prototype.hasOwnProperty.call(a, 'getAt')) continue;
      const get = a.getAt, set = a.setAt, read = new Map();
      a.getAt = function (x, y, z) {
        const v = get.apply(this, arguments);
        if (z !== POP || !(v > 0)) return v;
        const f = popFactor(name, x, y);
        if (f === 1) return v;
        read.set(x + ':' + y, { v, f });
        return v * f;
      };
      a.setAt = function (v, x, y, z) {
        const r = z === POP && read.get(x + ':' + y);
        if (r) { v = Math.max(0, v - r.v * (r.f - 1)); read.delete(x + ':' + y); }
        return set.apply(this, [v, x, y, z]);
      };
      popPatched.push(a);
    }
  }
  function popOff() { for (const a of popPatched) { delete a.getAt; delete a.setAt; } popPatched = []; }
  // the sales script is wrapped once for all mods and stays wrapped (it does nothing without multipliers)
  function hookSales() {
    if (salesHooked) return true;
    const D = globalThis.BDTReviewData, acts = D ? scriptActs(D.salesScript) : [];
    for (const a of acts) {
      wrapRun(a, () => { try { popOn(); } catch (e) { console.error('[BetterDTKit] sales', e); } }, () => popOff());
    }
    salesHooked = acts.length > 0;
    return salesHooked;
  }

  function check(spec) {
    const p = [], n = spec.needs || {};
    for (const f of n.functions || []) if (typeof globalThis[f] !== 'function') p.push('function ' + f);
    for (const o of n.objects || []) if (!rt.objects[o]) p.push('object ' + o);
    for (const v of n.vars || []) if (!(v in rt.globalVars)) p.push('variable ' + v);
    if ((n.calls || []).length || (n.actions || []).length) {
      const e = eventSheets();
      if (!e) p.push('event sheets');
      else {
        for (const f of n.calls || []) if (!e.GetFunctionBlockByName(f)) p.push('event function ' + f);
        for (const s of n.actions || []) if (!e.GetActionBySID(s)) p.push('action ' + s);
      }
    }
    for (const name of Object.keys(n.arrays || {})) if (!rt.objects[name]) p.push('table ' + name);
    for (const [idx, en] of Object.entries(spec.texts || {})) if (healText(Number(idx), en) < 0) p.push(`text ${idx} "${en}"`);
    if (n.check) { try { const r = n.check(rt); if (r) p.push(String(r)); } catch (e) { p.push('check: ' + e); } }
    return p;
  }
  function checkData(spec) {
    const p = [], n = spec.needs || {};
    for (const [name, [w, h]] of Object.entries(n.arrays || {})) {
      let a = null;
      try { a = rt.objects[name] && rt.objects[name].getFirstInstance(); } catch { }
      if (!a) p.push('table ' + name);
      else if (a.width < (w || 0) || a.height < (h || 0)) p.push(`table ${name} ${a.width}×${a.height} (expected ${w || 0}×${h || 0})`);
    }
    if (n.dataCheck) { try { const r = n.dataCheck(rt); if (r) p.push(String(r)); } catch (e) { p.push('check: ' + e); } }
    return p;
  }

  // ── metadata: mod.json of a folder mod or spec.info of a single-file mod ─────────────────────────
  const LANGS = ['en', 'ru', 'de', 'fr', 'it', 'es', 'hi', 'tr', 'pt', 'uk', 'id', 'pl', 'zh', 'ko', 'ja'];
  // the runtime of the first started mod, or the game's own before that (the settings page asks early)
  const langIdx = () => {
    try { const n = Math.round(Number((rt || globalThis.runtime).globalVars.LanguageChoose)); return n >= 0 && n < 15 ? n : 0; } catch { return 0; }
  };
  // a text of a manifest: 'text' or { en: 'text', de: 'Text', … }
  function localize(v) {
    if (v === undefined || v === null) return '';
    if (typeof v !== 'object') return String(v);
    const x = v[LANGS[langIdx()]] ?? v.en ?? Object.values(v)[0];
    return x === undefined || x === null ? '' : String(x);
  }
  // "1.2.3" or a beta "1.2.3-beta.4", which is older than the release 1.2.3
  function cmpVersion(a, b) {
    const parse = (v) => {
      const [num, pre] = String(v).split('-beta.');
      return { n: num.split('.').map(n => parseInt(n, 10) || 0), pre: pre === undefined ? Infinity : parseInt(pre, 10) || 0 };
    };
    const x = parse(a), y = parse(b);
    for (let i = 0; i < Math.max(x.n.length, y.n.length); i++) { const d = (x.n[i] || 0) - (y.n[i] || 0); if (d) return Math.sign(d); }
    return x.pre === y.pre ? 0 : x.pre > y.pre ? 1 : -1;
  }
  const folderMod = (name) => (B.mods || []).find(f => f.folder && f.file === name) || null;
  function infoOf(name) {
    const f = folderMod(name), m = mods.get(name);
    const i = (f && f.manifest) || (m && m.spec && m.spec.info);
    return i && typeof i === 'object' ? i : null;
  }
  // options with full keys: 'days' of the mod 'my-mod' is stored as my-mod.days
  function optionsOf(name) {
    const i = infoOf(name);
    return (i && Array.isArray(i.options) ? i.options : []).filter(o => o && typeof o.key === 'string' && o.key).map(o => {
      const key = o.key.includes('.') ? o.key : name + '.' + o.key;
      const type = o.type || (typeof o.default === 'boolean' ? 'bool' : Array.isArray(o.choices) ? 'choice' : 'range');
      const choices = (Array.isArray(o.choices) ? o.choices : []).map(c => (c && typeof c === 'object' ? c : { value: c, label: String(c) }));
      return { ...o, key, type, choices };
    });
  }
  function optionValue(o) {
    const S = B.settings;
    if (o.type === 'bool') return S.bool(o.key, !!o.default);
    if (o.type === 'range') {
      let n = S.num(o.key, Number(o.default) || 0);
      if (typeof o.min === 'number') n = Math.max(o.min, n);
      if (typeof o.max === 'number') n = Math.min(o.max, n);
      return n;
    }
    if (o.type === 'choice') {
      const v = S.get(o.key), c = o.choices.find(c => String(c.value) === String(v));
      return c ? c.value : o.default;
    }
    return S.get(o.key, o.default);
  }
  function checkRequires(name) {
    const i = infoOf(name), q = i && i.requires, p = [];
    if (!q || typeof q !== 'object') return p;
    if (q.betterdt && cmpVersion(B.version, q.betterdt) < 0) p.push('BetterDT ' + q.betterdt + ' or newer');
    const gv = api.gameVersion;
    if (q.game && gv && cmpVersion(gv, q.game) < 0) p.push('game ' + q.game + ' or newer');
    return p;
  }

  // ── events: one tick listener for all mods ──────────────────────────────────────────────────────
  // Every subscription remembers what it has seen, so a new one also gets the current screen / loaded game.
  const subs = new Set();
  let dispatching = false, settingsHooked = false;
  function gameState() {
    const g = rt.globalVars, n = (v) => Number(g[v]) || 0;
    return { screen: layoutName(), total: n('DayTotal'), day: n('Day'), month: n('Month'), year: n('Year'), lang: langIdx() };
  }
  const isLoad = (from, to) => to > 0 && (!(from > 0) || to < from || to - from > 40);   // another save, not days passing
  function dispatch() {
    if (!subs.size) return;
    let st;
    try { st = gameState(); } catch { return; }
    for (const s of [...subs]) {
      if (!subs.has(s)) continue;
      const seen = s.seen;
      switch (s.type) {
        case 'tick': s.fn(rt.dt); break;
        case 'screen':
          if (seen === st.screen) break;
          s.seen = st.screen;
          if (!s.filter || s.filter === st.screen) s.fn(st.screen, seen);
          break;
        case 'leave':
          if (seen === st.screen) break;
          s.seen = st.screen;
          if (seen !== undefined && (!s.filter || s.filter === seen)) s.fn(seen, st.screen);
          break;
        case 'gameLoaded':
          if (st.screen === 'LOADING GAME') break;   // the date is set before the save's tables are
          s.seen = st.total;
          if (seen === undefined ? st.total > 0 : isLoad(seen, st.total)) s.fn(dateOf(st));
          break;
        case 'gameClosed':
          s.seen = st.total;
          if (seen > 0 && !(st.total > 0)) s.fn();
          break;
        case 'day': case 'month': case 'year': {
          s.seen = st;
          if (!seen || !(st.total > 0) || isLoad(seen.total, st.total) || st.total === seen.total) break;
          if (s.type === 'day' || (s.type === 'month' ? st.month !== seen.month || st.year !== seen.year : st.year !== seen.year)) s.fn(dateOf(st));
          break;
        }
        case 'language':
          if (seen === st.lang) break;
          s.seen = st.lang;
          if (seen !== undefined) s.fn(st.lang, LANGS[st.lang]);
          break;
      }
    }
  }
  const dateOf = (st) => ({ day: st.day, month: st.month, year: st.year, total: st.total });
  function startDispatch() {
    if (dispatching || !rt) return;
    dispatching = true;
    rt.addEventListener('tick', dispatch);
  }
  function hookSettings() {
    if (settingsHooked) return;
    settingsHooked = true;
    B.settings.onChange((key, value) => {
      for (const s of [...subs]) {
        if (s.type === 'setting' && (!s.filter || s.filter === key)) s.fn(key, value);
        if (s.type === 'option' && s.filter === key) s.fn(optionValue(s.option), key);
      }
    });
  }

  // ── tables ──────────────────────────────────────────────────────────────────────────────────────
  // kit.table('ArrayCountries', { name: 0, tax: 2 }): x = record (country, company, employee …), y = field
  function table(name, fields) {
    const F = fields || {};
    const inst = () => { try { const o = rt.objects[name]; return o ? o.getFirstInstance() : null; } catch { return null; } };
    const t = {
      name,
      fields: F,
      get exists() { return !!inst(); },
      get width() { const a = inst(); return a ? a.width : 0; },
      get height() { const a = inst(); return a ? a.height : 0; },
      get(x, y, z = 0) { const a = inst(); return a ? a.getAt(x, typeof y === 'string' ? F[y] : y, z) : undefined; },
      set(x, y, v) { const a = inst(); if (a) a.setAt(v, x, typeof y === 'string' ? F[y] : y); },
      column(x) { const a = inst(); return a ? Array.from({ length: a.height }, (_, y) => a.getAt(x, y)) : []; },
      row(y) { const a = inst(); return a ? Array.from({ length: a.width }, (_, x) => a.getAt(x, y)) : []; },
      record(x) {
        const rec = { id: x };
        for (const k of Object.keys(F)) {
          Object.defineProperty(rec, k, { enumerable: true, get: () => t.get(x, F[k]), set: (v) => t.set(x, F[k], v) });
        }
        return rec;
      },
      records() { return Array.from({ length: t.width }, (_, x) => t.record(x)); },
      find(fn) { return t.records().find(fn) || null; },
      filter(fn) { return t.records().filter(fn); },
    };
    return t;
  }

  // ── named game data (from the BetterDT mods, checked in game 1.6) ──────────────────────────────────
  const TABLES = {
    countries: ['ArrayCountries', { name: 0, money: 1, tax: 2, costOfProduction: 3, trade: 4, tech: 5 }],
    research: ['ArrayResearch', { points: 1, money: 2 }],
    myResearch: ['ArrayMyResearch', { level: 0 }],
    employees: ['ArrayEmployees', { profession: 4 }],
    employeeSkills: ['ArrayEmployees_Characters', { design: 0, speed: 1, research: 2 }],
    myEmployees: ['ArrayMyEmployees', { id: 0 }],
    companies: ['ArrayCompanyNames', { defaultName: 0, name: 1 }],
    shares: ['ArrayInvesting', { total: 4, ownedCompany: 7, offer: 8 }],
    myShares: ['ArrayInvestingMyStocks', { owned: 0 }],
    stores: ['ArrayMyShops', { level: 0, count: 1 }],
  };
  function makeGame() {
    const g = () => rt.globalVars, num = (k) => Number(g()[k]) || 0;
    const tables = {};
    for (const [k, [name, fields]] of Object.entries(TABLES)) Object.defineProperty(tables, k, { enumerable: true, get: () => table(name, fields) });
    return Object.freeze({
      get money() { return num('Budget'); }, set money(v) { g().Budget = Number(v); },
      get researchPoints() { return num('ResearchCoins'); }, set researchPoints(v) { g().ResearchCoins = Number(v); },
      get date() { return { day: num('Day'), month: num('Month'), year: num('Year'), total: num('DayTotal') }; },
      get inGame() { return num('DayTotal') > 0; },
      get screen() { return layoutName(); },
      get language() { return langIdx(); },
      get lang() { return LANGS[langIdx()]; },
      get company() { return { name: String(g().CompanyName ?? ''), countryId: num('CompanyCountryID') }; },
      get speed() { try { return Number(globalThis.getGameSpeed()) || 1; } catch { return 1; } },
      set speed(v) { if (typeof globalThis.setGameSpeed === 'function') globalThis.setGameSpeed(Number(v)); },
      get version() { return api.gameVersion; },
      tables,
      // hired employees: { id, profession, design, speed, research }
      employees() {
        const my = tables.myEmployees, e = tables.employees, c = tables.employeeSkills, out = [];
        for (let x = 0; x < my.width; x++) {
          const id = Math.round(Number(my.get(x, 0)));
          if (!Number.isFinite(id)) continue;
          out.push({ id, profession: String(e.get(id, 'profession') ?? ''), design: Number(c.get(id, 'design')) || 0,
            speed: Number(c.get(id, 'speed')) || 0, research: Number(c.get(id, 'research')) || 0 });
        }
        return out;
      },
    });
  }

  // ── UI in the game's look ───────────────────────────────────────────────────────────────────────
  const FONT = 'SofiaSansExtraCondensed-Medium, Oswald, "Segoe UI", sans-serif';
  function uiCss() {
    if (document.getElementById('bdt-kit-ui-css')) return;
    const s = document.createElement('style');
    s.id = 'bdt-kit-ui-css';
    // --bdt-s: the game's scale (design size 1920 × 1080)
    s.textContent = `
.bdt-ui-btn { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
  min-width: calc(var(--bdt-s, 1) * 160px); height: calc(var(--bdt-s, 1) * 50px); padding: 0 calc(var(--bdt-s, 1) * 24px);
  border-radius: calc(var(--bdt-s, 1) * 8px); font: calc(var(--bdt-s, 1) * 25px)/1 ${FONT}; color: #fff; white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, .35); cursor: pointer; user-select: none;
  background: linear-gradient(180deg, #a8d418 0%, #63b303 100%); box-shadow: 0 6px 18px -6px rgba(120, 190, 20, .55);
  transition: transform .16s ease, filter .16s ease; }
.bdt-ui-btn.bdt-ui-red { background: linear-gradient(180deg, #ff6b7f 0%, #e8455c 100%); box-shadow: 0 6px 18px -6px rgba(230, 70, 90, .55); }
.bdt-ui-btn.bdt-ui-grey { background: linear-gradient(180deg, #5d6878 0%, #434c5a 100%); box-shadow: 0 6px 18px -6px rgba(0, 0, 0, .55); }
.bdt-ui-btn:hover { transform: translateY(-2px); filter: brightness(1.12); }
.bdt-ui-btn:active { transform: translateY(0) scale(.96); filter: brightness(.95); }
.bdt-ui-btn.bdt-ui-off { pointer-events: none; opacity: .55; }
.bdt-ui-toasts { position: fixed; right: calc(var(--bdt-s, 1) * 28px); bottom: calc(var(--bdt-s, 1) * 28px); z-index: 2147482000;
  display: flex; flex-direction: column; align-items: flex-end; gap: calc(var(--bdt-s, 1) * 10px); pointer-events: none; }
.bdt-ui-toast { max-width: calc(var(--bdt-s, 1) * 520px); padding: calc(var(--bdt-s, 1) * 12px) calc(var(--bdt-s, 1) * 18px);
  border-radius: calc(var(--bdt-s, 1) * 10px); background: rgba(12, 15, 22, .86); border: 1px solid rgba(255, 255, 255, .10);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, .6); color: #fff; font: calc(var(--bdt-s, 1) * 22px)/1.3 ${FONT};
  animation: bdt-ui-in .3s cubic-bezier(.30, 1.35, .45, 1) both; }
.bdt-ui-toast.bdt-ui-good { border-color: rgba(168, 212, 24, .7); }
.bdt-ui-toast.bdt-ui-bad { border-color: rgba(255, 107, 127, .8); }
.bdt-ui-toast.bdt-ui-out { opacity: 0; transition: opacity .3s ease; }
@keyframes bdt-ui-in { from { opacity: 0; transform: translateY(16px); } }
`;
    document.head.appendChild(s);
    const scale = () => document.documentElement.style.setProperty('--bdt-s', Math.min(innerWidth / 1920, innerHeight / 1080).toFixed(4));
    scale();
    addEventListener('resize', scale);
  }
  const SHIELD = ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'contextmenu', 'touchstart', 'touchend'];
  const KEYS = ['keydown', 'keyup', 'keypress'];

  const near = (a, b, tol) => b === undefined || Math.abs(a - b) <= tol;
  const fits = (i, s) => !!i && i.objectType.name === s.t && i.layer.name === s.l && near(i.width, s.w, 2) && near(i.height, s.h, 2);
  const alive = (i) => { try { return rt.getInstanceByUid(i.uid) === i; } catch { return false; } };

  function mod(name, spec, init) {
    const m = { name, spec, state: 'waiting', problems: [], errors: 0, dispose: null, warned: new Set(), cache: new Map(), undo: [] };
    mods.set(name, m);
    function stop(state, problem) {
      if (m.state !== 'running' && m.state !== 'waiting') return;
      m.state = state;
      if (problem) m.problems.push(problem);
      log('[BetterDTKit] mod', name, state + ':', problem);
      for (const u of m.undo.splice(0).reverse()) { try { u(); } catch { } }
      if (m.dispose) { try { m.dispose(); } catch (e) { console.error('[BetterDT] mod', name, 'dispose:', e); } }
    }
    const kit = {
      guard(fn) {
        return function () {
          if (m.state !== 'running') return undefined;
          try { return fn.apply(this, arguments); } catch (e) {
            m.errors++;
            console.error('[BetterDT] mod', name, 'error', m.errors + '/' + MAX_ERRORS + ':', e);
            if (m.errors >= MAX_ERRORS) stop('failed', String((e && e.message) || e));
            return undefined;
          }
        };
      },
      // instances are looked up once per layout visit (before the mod moves or resizes them) and then cached
      inst(uid) {
        const s = spec.uids && spec.uids[uid];
        let i = m.cache.get(uid);
        if (i && alive(i)) return i;
        i = null;
        try { i = rt.getInstanceByUid(uid); } catch { }
        if (s && !fits(i, s)) {
          let best = null, bd = Infinity;
          try {
            for (const c of rt.objects[s.t].getAllInstances()) {
              if (!fits(c, s)) continue;
              const d = Math.hypot(c.x - (s.x ?? c.x), c.y - (s.y ?? c.y));
              if (d < bd) { bd = d; best = c; }
            }
          } catch { }
          if (best) kit.warn(`instance ${uid} found as ${best.uid}`);
          else if (s.layout && layoutName() === s.layout) kit.warn(`instance ${uid} (${s.t}) not found on ${s.layout}`);
          i = best;
        }
        if (i) m.cache.set(uid, i);
        return i;
      },
      text(idx) {
        const en = spec.texts && spec.texts[idx];
        const y = en === undefined ? idx : healText(idx, en);
        if (y < 0) return '';
        try {
          const n = Number(rt.globalVars.LanguageChoose);
          return String(rt.objects.ArrayLanguage.getFirstInstance().getAt(n >= 0 && n < 15 ? n : 0, y));
        } catch { return ''; }
      },
      warn(problem) {
        if (m.warned.has(problem)) return;
        m.warned.add(problem);
        m.problems.push(problem);
        log('[BetterDTKit]', name + ':', problem);
      },
      fail(problem) { stop('incompatible', problem); },
      wrapCalls(fnName, h) {
        const acts = callSites(fnName), before = h.before && kit.guard(h.before), after = h.after && kit.guard(h.after);
        for (const a of acts) m.undo.push(wrapRun(a, before, after));
        if (acts.length) m.undo.push(wrapScriptCalls(fnName, before, after));
        return acts.length;
      },
      wrapAction(sid, h) {
        const e = eventSheets(), a = e && e.GetActionBySID(sid);
        if (!a) return false;
        m.undo.push(wrapRun(a, h.before && kit.guard(h.before), h.after && kit.guard(h.after)));
        return true;
      },
      wrapScript(name, h) {
        const acts = scriptActs(name);
        for (const a of acts) m.undo.push(wrapRun(a, h.before && kit.guard(h.before), h.after && kit.guard(h.after)));
        return acts.length;
      },
      // undone when the mod stops, before its dispose
      onStop(fn) { m.undo.push(fn); },
      // multiplies the popularity of the player's devices while the game computes the daily sales:
      // fn(salesArray, x, y) → factor (1 = unchanged); returns off(), undone when the mod stops
      salesMultiplier(fn) {
        hookSales();
        const s = { fn: kit.guard(fn) };
        salesMuls.add(s);
        const off = () => { salesMuls.delete(s); };
        m.undo.push(off);
        return off;
      },

      // the value of one of this mod's options ('days' or 'my-mod.days')
      option(key) {
        const full = String(key).includes('.') ? String(key) : name + '.' + key;
        const o = optionsOf(name).find(x => x.key === full);
        return o ? optionValue(o) : B.settings.get(full);
      },
      // kit.on('day', fn), kit.on('screen', 'INVESTING STOCK', fn) … ; returns off()
      on(type, filter, fn) {
        if (typeof filter === 'function') { fn = filter; filter = undefined; }
        const known = ['tick', 'screen', 'leave', 'day', 'month', 'year', 'gameLoaded', 'gameClosed', 'language', 'option', 'setting'];
        if (!known.includes(type)) throw new Error('kit.on: unknown event ' + type);
        const s = { type, filter, fn: kit.guard(fn), seen: undefined };
        if (type === 'option') {
          s.filter = String(filter).includes('.') ? String(filter) : name + '.' + filter;
          s.option = optionsOf(name).find(x => x.key === s.filter) || { key: s.filter, type: 'text' };
        }
        subs.add(s);
        if (type === 'option' || type === 'setting') hookSettings(); else startDispatch();
        const off = () => { subs.delete(s); };
        m.undo.push(off);
        return off;
      },
      table,
      game: makeGame(),
    };
    // kit.ui: everything it creates is removed when the mod stops
    const ui = {
      font: FONT,
      css(text) {
        const s = document.createElement('style');
        s.textContent = text;
        document.head.appendChild(s);
        m.undo.push(() => s.remove());
        return s;
      },
      // el('div', { className: 'my-panel', textContent: 'Hi', style: { left: '10px' }, onclick: fn }, parent)
      // parent: an element, null = not attached, default document.body
      el(tag, props, parent) {
        const e = document.createElement(tag);
        for (const [k, v] of Object.entries(props || {})) {
          if (k === 'style' && v && typeof v === 'object') Object.assign(e.style, v);
          else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), kit.guard(v));
          else if (k in e) e[k] = v;
          else e.setAttribute(k, v);
        }
        if (parent !== null) (parent || document.body).appendChild(e);
        m.undo.push(() => e.remove());
        return e;
      },
      // clicks (and keys, unless keys is false) on the element do not reach the game
      shield(e, keys = true) {
        const stop = (ev) => ev.stopPropagation();
        for (const t of SHIELD.concat(keys ? KEYS : [])) e.addEventListener(t, stop);
        return e;
      },
      // keeps a fixed element at x, y of a layer of the game (design pixels); hidden on screens without that layer.
      // opts.screen: only on this screen; opts.scale: scale the element with the game (transform-origin: top left)
      anchor(e, layer, x, y, opts = {}) {
        e.style.position = 'fixed';
        if (opts.scale) e.style.transformOrigin = '0 0';
        const off = kit.on('tick', () => {
          let l = null;
          try { l = (!opts.screen || layoutName() === opts.screen) && rt.layout.getLayer(layer); } catch { }
          if (!l) { e.style.display = 'none'; return; }
          const [cx, cy] = l.layerToCssPx(x, y);
          e.style.display = '';
          e.style.left = cx + 'px';
          e.style.top = cy + 'px';
          if (opts.scale) e.style.transform = 'scale(' + ((l.layerToCssPx(x + 1000, y)[0] - cx) / 1000).toFixed(4) + ')';
        });
        return off;
      },
      // a button in the look of the game's dialog buttons: opts.color 'green' (default), 'red', 'grey'
      button(label, onClick, opts = {}) {
        uiCss();
        const b = ui.el('div', { className: 'bdt-ui-btn' + (opts.color && opts.color !== 'green' ? ' bdt-ui-' + opts.color : ''), textContent: label },
          opts.parent === undefined ? null : opts.parent);
        ui.shield(b, false);
        b.addEventListener('click', kit.guard((ev) => { globalThis.tapMain?.(); if (onClick) onClick(ev); }));
        return b;
      },
      // a short message in the bottom right corner; opts.ms (default 4000), opts.type 'good' / 'bad'
      toast(text, opts = {}) {
        uiCss();
        let box = document.querySelector('.bdt-ui-toasts');
        if (!box) { box = document.createElement('div'); box.className = 'bdt-ui-toasts'; document.body.appendChild(box); }
        const t = document.createElement('div');
        t.className = 'bdt-ui-toast' + (opts.type ? ' bdt-ui-' + opts.type : '');
        t.textContent = text;
        box.appendChild(t);
        const remove = () => { t.remove(); if (box && !box.children.length) box.remove(); };
        const timer = setTimeout(() => { t.classList.add('bdt-ui-out'); setTimeout(remove, 320); }, opts.ms || 4000);
        m.undo.push(() => { clearTimeout(timer); remove(); });
        return t;
      },
      // the BetterDT dialog: resolves with the index of the clicked button (waits while another dialog is open)
      dialog({ title = '', text = '', buttons = [{ label: 'OK', go: true }], content } = {}) {
        return new Promise((resolve) => {
          const open = () => {
            if (m.state !== 'running') return;
            const D = globalThis.BetterDTUI;
            const list = buttons.map((b, i) => ({ label: b.label, go: !!b.go, cb: () => resolve(i) }));
            const d = D && D.dialog(title, text, list, content && kit.guard(content));
            if (!d) setTimeout(open, 400);
          };
          open();
        });
      },
    };
    kit.ui = ui;
    B.register(name, (runtime) => {
      rt = runtime;
      waitReady(() => {
        const p = checkRequires(name).concat(check(spec));
        if (p.length) {
          m.problems.push(...p); m.state = 'incompatible';
          log('[BetterDTKit] mod', name, 'not started, missing:', p.join(', '));
          return;
        }
        m.state = 'running';
        try {
          const d = init(rt, kit);
          m.dispose = typeof d === 'function' ? d : d && typeof d.dispose === 'function' ? () => d.dispose() : null;
          log('[BetterDTKit] started', name);
        } catch (e) { console.error('[BetterDT] mod', name, 'failed:', e); stop('failed', 'start: ' + ((e && e.message) || e)); }
        const n = spec.needs || {};
        if (Object.keys(n.arrays || {}).length || n.dataCheck) whenGameLoaded(spec, () => {
          const q = checkData(spec);
          if (q.length) stop('incompatible', q.join(', '));
        });
      });
    });
  }

  const api = {
    mod,
    // for the settings page: metadata and options of a mod (folder or single file), texts in the player's language
    info: (name) => infoOf(name),
    options: (name) => optionsOf(name),
    localize: (v) => localize(v),
    eventSheets: () => eventSheets(),
    // true once the game's daily sales script is wrapped for kit.salesMultiplier
    salesReady: () => hookSales(),
    // for tests: patch / unpatch the popularity reads by hand, the current factor of a device
    _sales: { on: (names) => popOn(names), off: () => popOff(), factor: (n, x, y) => popFactor(n, x, y) },
    status: () => [...mods.values()].map(m => ({ name: m.name, state: m.state, problems: m.problems.slice() })),
    // cb runs once the game data is loaded and the mods have been checked
    whenReady(runtime, cb) { rt = rt || runtime; waitReady(() => setTimeout(cb, 0)); },
    get gameVersion() { try { return String(rt.projectVersion || ''); } catch { return ''; } },
  };
  Object.defineProperty(globalThis, 'BetterDTKit', { value: Object.freeze(api), writable: false, configurable: false });
})();

BetterDT.register('betterdt-settings', (rt) => {
  const B = globalThis.BetterDT, S = B.settings, KIT = globalThis.BetterDTKit;
  // a single-file mod is registered as its file name without .js, a folder mod as its folder name
  const kitName = (file) => file.replace(/\.js$/, '');
  const kitStatus = (file) => (KIT ? KIT.status().find(m => m.name === kitName(file)) : null);
  // title, description, author and options that a mod by someone else brings (mod.json or spec.info)
  const kitInfo = (file) => (KIT && KIT.info ? KIT.info(kitName(file)) : null);
  const PAGES = ['bdt-general', 'bdt-mods'];

  // language order as in the game (LanguageChoose): en ru de fr it es hi tr pt-BR uk id pl zh ko ja
  const TXT = {
    general: ['General', 'Общие', 'Allgemein', 'Général', 'Generale', 'General', 'सामान्य', 'Genel', 'Geral', 'Загальні', 'Umum', 'Ogólne', '常规', '일반', '一般'],
    mods: ['Mods', 'Моды', 'Mods', 'Mods', 'Mod', 'Mods', 'मॉड', 'Modlar', 'Mods', 'Моди', 'Mod', 'Mody', '模组', '모드', 'MOD'],
    hint: ['Changes are saved immediately', 'Изменения сохраняются сразу', 'Änderungen werden sofort gespeichert', 'Les modifications sont enregistrées immédiatement',
      'Le modifiche vengono salvate subito', 'Los cambios se guardan al instante', 'बदलाव तुरंत सहेजे जाते हैं', 'Değişiklikler hemen kaydedilir', 'As alterações são salvas na hora',
      'Зміни зберігаються одразу', 'Perubahan langsung disimpan', 'Zmiany zapisują się od razu', '更改会立即保存', '변경 사항은 즉시 저장됩니다', '変更はすぐに保存されます'],
    version: ['Version', 'Версия', 'Version', 'Version', 'Versione', 'Versión', 'संस्करण', 'Sürüm', 'Versão', 'Версія', 'Versi', 'Wersja', '版本', '버전', 'バージョン'],
    autoUpdate: ['Automatic updates', 'Автообновление', 'Automatische Updates', 'Mises à jour automatiques', 'Aggiornamenti automatici', 'Actualizaciones automáticas',
      'स्वचालित अपडेट', 'Otomatik güncellemeler', 'Atualizações automáticas', 'Автооновлення', 'Pembaruan otomatis', 'Automatyczne aktualizacje', '自动更新', '자동 업데이트', '自動アップデート'],
    autoUpdateHint: ['Checks GitHub when the game starts and installs new versions', 'При запуске игры проверяет GitHub и ставит новые версии',
      'Prüft beim Spielstart GitHub und installiert neue Versionen', 'Vérifie GitHub au lancement et installe les nouvelles versions',
      'All’avvio controlla GitHub e installa le nuove versioni', 'Al iniciar el juego revisa GitHub e instala versiones nuevas',
      'गेम शुरू होने पर GitHub जाँचता है और नए संस्करण इंस्टॉल करता है', 'Oyun açılırken GitHub’ı kontrol eder ve yeni sürümleri kurar',
      'Ao iniciar o jogo verifica o GitHub e instala novas versões', 'Під час запуску гри перевіряє GitHub і ставить нові версії',
      'Memeriksa GitHub saat game dimulai dan memasang versi baru', 'Przy starcie gry sprawdza GitHub i instaluje nowe wersje',
      '游戏启动时检查 GitHub 并安装新版本', '게임 시작 시 GitHub를 확인하고 새 버전을 설치합니다', '起動時に GitHub を確認し、新しいバージョンを入れます'],
    beta: ['Beta versions', 'Бета-версии', 'Beta-Versionen', 'Versions bêta', 'Versioni beta', 'Versiones beta', 'बीटा संस्करण', 'Beta sürümler', 'Versões beta',
      'Бета-версії', 'Versi beta', 'Wersje beta', '测试版', '베타 버전', 'ベータ版'],
    betaHint: ['Test versions before the official release – they may have bugs', 'Тестовые версии до официального выпуска – возможны ошибки',
      'Testversionen vor der offiziellen Veröffentlichung – können Fehler haben', 'Versions de test avant la sortie officielle – elles peuvent avoir des bugs',
      'Versioni di prova prima dell’uscita ufficiale – possono avere bug', 'Versiones de prueba antes del lanzamiento oficial: pueden tener errores',
      'आधिकारिक रिलीज़ से पहले परीक्षण संस्करण – इनमें बग हो सकते हैं', 'Resmî sürümden önce test sürümleri – hata içerebilir',
      'Versões de teste antes do lançamento oficial – podem ter bugs', 'Тестові версії до офіційного випуску – можливі помилки',
      'Versi uji sebelum rilis resmi – mungkin ada bug', 'Wersje testowe przed oficjalnym wydaniem – mogą mieć błędy', '正式发布前的测试版本，可能有错误',
      '정식 출시 전 테스트 버전 – 버그가 있을 수 있습니다', '正式リリース前のテスト版（不具合がある場合があります）'],
    betaBack: ['Back to official', 'Вернуть официальную', 'Zurück zur offiziellen', 'Revenir à l’officielle', 'Torna all’ufficiale', 'Volver a la oficial',
      'आधिकारिक पर लौटें', 'Resmî sürüme dön', 'Voltar à oficial', 'Повернути офіційну', 'Kembali ke resmi', 'Wróć do oficjalnej', '恢复正式版', '정식 버전으로', '正式版に戻す'],
    check: ['Check now', 'Проверить', 'Jetzt prüfen', 'Vérifier', 'Controlla ora', 'Comprobar', 'अभी जाँचें', 'Şimdi kontrol et', 'Verificar', 'Перевірити', 'Periksa', 'Sprawdź', '立即检查', '지금 확인', '今すぐ確認'],
    updates: ['Updates', 'Обновления', 'Updates', 'Mises à jour', 'Aggiornamenti', 'Actualizaciones', 'अपडेट', 'Güncellemeler', 'Atualizações', 'Оновлення',
      'Pembaruan', 'Aktualizacje', '更新', '업데이트', 'アップデート'],
    checking: ['Checking…', 'Проверка…', 'Wird geprüft…', 'Vérification…', 'Controllo…', 'Comprobando…', 'जाँच हो रही है…', 'Kontrol ediliyor…', 'Verificando…', 'Перевірка…', 'Memeriksa…', 'Sprawdzanie…', '正在检查…', '확인 중…', '確認中…'],
    uptodate: ['You have the latest version', 'Установлена последняя версия', 'Neueste Version installiert', 'Vous avez la dernière version', 'Hai l’ultima versione',
      'Tienes la última versión', 'नवीनतम संस्करण है', 'En son sürüm kurulu', 'Você tem a versão mais recente', 'Встановлено останню версію', 'Versi terbaru sudah terpasang',
      'Masz najnowszą wersję', '已是最新版本', '최신 버전입니다', '最新バージョンです'],
    available: ['Version {v} is available', 'Доступна версия {v}', 'Version {v} ist verfügbar', 'La version {v} est disponible', 'È disponibile la versione {v}',
      'La versión {v} está disponible', 'संस्करण {v} उपलब्ध है', '{v} sürümü mevcut', 'A versão {v} está disponível', 'Доступна версія {v}', 'Versi {v} tersedia',
      'Dostępna jest wersja {v}', '有新版本 {v}', '{v} 버전을 사용할 수 있습니다', 'バージョン {v} があります'],
    downloading: ['Downloading {v}…', 'Загрузка {v}…', '{v} wird geladen…', 'Téléchargement de {v}…', 'Download di {v}…', 'Descargando {v}…', '{v} डाउनलोड हो रहा है…',
      '{v} indiriliyor…', 'Baixando {v}…', 'Завантаження {v}…', 'Mengunduh {v}…', 'Pobieranie {v}…', '正在下载 {v}…', '{v} 다운로드 중…', '{v} をダウンロード中…'],
    installed: ['Version {v} installed – restart the game', 'Версия {v} установлена – перезапустите игру', 'Version {v} installiert – Spiel neu starten',
      'Version {v} installée – relancez le jeu', 'Versione {v} installata – riavvia il gioco', 'Versión {v} instalada: reinicia el juego',
      'संस्करण {v} इंस्टॉल हुआ – गेम फिर से शुरू करें', '{v} sürümü kuruldu – oyunu yeniden başlatın', 'Versão {v} instalada – reinicie o jogo',
      'Версію {v} встановлено – перезапустіть гру', 'Versi {v} terpasang – mulai ulang game', 'Zainstalowano wersję {v} – uruchom grę ponownie',
      '已安装 {v} – 请重启游戏', '{v} 버전 설치됨 – 게임을 다시 시작하세요', '{v} をインストールしました – ゲームを再起動してください'],
    failed: ['Update failed: {e}', 'Ошибка обновления: {e}', 'Update fehlgeschlagen: {e}', 'Échec de la mise à jour : {e}', 'Aggiornamento non riuscito: {e}',
      'Error al actualizar: {e}', 'अपडेट विफल: {e}', 'Güncelleme başarısız: {e}', 'Falha na atualização: {e}', 'Помилка оновлення: {e}', 'Pembaruan gagal: {e}',
      'Aktualizacja nieudana: {e}', '更新失败：{e}', '업데이트 실패: {e}', 'アップデート失敗: {e}'],
    noRelease: ['No published release on GitHub yet', 'На GitHub пока нет опубликованной версии', 'Noch keine veröffentlichte Version auf GitHub',
      'Aucune version publiée sur GitHub', 'Nessuna versione pubblicata su GitHub', 'Aún no hay versión publicada en GitHub', 'GitHub पर अभी कोई प्रकाशित संस्करण नहीं',
      'GitHub’da yayımlanmış sürüm yok', 'Ainda não há versão publicada no GitHub', 'На GitHub ще немає опублікованої версії', 'Belum ada rilis di GitHub',
      'Brak opublikowanej wersji na GitHubie', 'GitHub 上还没有发布版本', 'GitHub에 게시된 버전이 아직 없습니다', 'GitHub に公開版はまだありません'],
    gpu: ['High-performance GPU', 'Мощная видеокарта', 'Leistungsstarke GPU', 'GPU haute performance', 'GPU ad alte prestazioni', 'GPU de alto rendimiento',
      'हाई-परफ़ॉर्मेंस GPU', 'Yüksek performanslı GPU', 'GPU de alto desempenho', 'Потужна відеокарта', 'GPU performa tinggi', 'Wydajna karta graficzna', '高性能显卡', '고성능 GPU', '高性能 GPU'],
    gpuHint: ['Render on the dedicated graphics card (laptops with two GPUs)', 'Рисовать на дискретной видеокарте (ноутбуки с двумя GPU)',
      'Auf der dedizierten Grafikkarte rendern (Laptops mit zwei GPUs)', 'Rendu sur la carte graphique dédiée (portables à deux GPU)',
      'Rendering sulla scheda video dedicata (portatili con due GPU)', 'Renderizar en la gráfica dedicada (portátiles con dos GPU)',
      'डेडिकेटेड ग्राफ़िक्स कार्ड पर रेंडर करें (दो GPU वाले लैपटॉप)', 'Harici ekran kartında çiz (iki GPU’lu dizüstüler)',
      'Renderizar na placa de vídeo dedicada (notebooks com duas GPUs)', 'Малювати на дискретній відеокарті (ноутбуки з двома GPU)',
      'Render di kartu grafis khusus (laptop dengan dua GPU)', 'Renderuj na dedykowanej karcie (laptopy z dwiema kartami)',
      '使用独立显卡渲染（双显卡笔记本）', '외장 그래픽카드로 렌더링 (GPU가 둘인 노트북)', '専用 GPU で描画（GPU が2つあるノートPC）'],
    folder: ['Mods folder', 'Папка модов', 'Mod-Ordner', 'Dossier des mods', 'Cartella mod', 'Carpeta de mods', 'मॉड फ़ोल्डर', 'Mod klasörü', 'Pasta de mods', 'Тека модів',
      'Folder mod', 'Folder modów', '模组文件夹', '모드 폴더', 'MOD フォルダー'],
    open: ['Open', 'Открыть', 'Öffnen', 'Ouvrir', 'Apri', 'Abrir', 'खोलें', 'Aç', 'Abrir', 'Відкрити', 'Buka', 'Otwórz', '打开', '열기', '開く'],
    log: ['Log', 'Журнал', 'Protokoll', 'Journal', 'Registro', 'Registro', 'लॉग', 'Günlük', 'Registro', 'Журнал', 'Log', 'Dziennik', '日志', '로그', 'ログ'],
    community: ['Community', 'Сообщество', 'Community', 'Communauté', 'Community', 'Comunidad', 'समुदाय', 'Topluluk', 'Comunidade',
      'Спільнота', 'Komunitas', 'Społeczność', '社区', '커뮤니티', 'コミュニティ'],
    communityHint: ['Questions, ideas and bug reports', 'Вопросы, идеи и сообщения об ошибках', 'Fragen, Ideen und Fehlerberichte',
      'Questions, idées et signalements de bugs', 'Domande, idee e segnalazioni di bug', 'Preguntas, ideas y reportes de errores',
      'सवाल, सुझाव और बग रिपोर्ट', 'Sorular, fikirler ve hata bildirimleri', 'Perguntas, ideias e relatos de bugs',
      'Питання, ідеї та повідомлення про помилки', 'Pertanyaan, ide, dan laporan bug', 'Pytania, pomysły i zgłoszenia błędów',
      '问题、想法和错误报告', '질문, 아이디어, 버그 신고', '質問、アイデア、不具合の報告'],
    updDiscord: ['Ideas, questions or a bug? Join us on', 'Идеи, вопросы или ошибка? Присоединяйтесь к нам в',
      'Ideen, Fragen oder ein Fehler? Komm zu uns auf', 'Des idées, des questions ou un bug ? Rejoignez-nous sur',
      'Idee, domande o un bug? Unisciti a noi su', '¿Ideas, preguntas o un error? Únete a nosotros en',
      'सुझाव, सवाल या कोई बग? हमसे जुड़ें', 'Fikir, soru ya da hata mı var? Bize katılın:',
      'Ideias, dúvidas ou um bug? Junte-se a nós no', 'Ідеї, питання чи помилка? Приєднуйтесь до нас у',
      'Ada ide, pertanyaan, atau bug? Gabung dengan kami di', 'Pomysły, pytania albo błąd? Dołącz do nas na',
      '有想法、问题或发现错误？欢迎加入我们的', '아이디어, 질문, 버그가 있나요? 함께해요:', 'アイデア・質問・不具合は'],
    releases: ['Releases', 'Версии', 'Versionen', 'Versions', 'Versioni', 'Versiones', 'संस्करण', 'Sürümler', 'Versões', 'Версії', 'Rilis', 'Wydania', '版本发布', '릴리스', 'リリース'],
    modsHint: ['Turning a mod on or off takes effect after a restart', 'Включение и выключение модов сработает после перезапуска',
      'Ein- und Ausschalten wirkt nach einem Neustart', 'Activer ou désactiver un mod prend effet après un redémarrage',
      'Attivare o disattivare una mod ha effetto dopo il riavvio', 'Activar o desactivar un mod surte efecto tras reiniciar',
      'मॉड चालू या बंद करना रीस्टार्ट के बाद लागू होगा', 'Mod açma/kapama yeniden başlatınca geçerli olur',
      'Ligar ou desligar um mod vale após reiniciar', 'Увімкнення і вимкнення модів спрацює після перезапуску',
      'Menyalakan atau mematikan mod berlaku setelah mulai ulang', 'Włączenie lub wyłączenie moda zadziała po restarcie',
      '启用或禁用模组需重启后生效', '모드 켜기/끄기는 다시 시작한 후 적용됩니다', 'MOD のオン/オフは再起動後に反映されます'],
    options: ['Options', 'Параметры', 'Optionen', 'Options', 'Opzioni', 'Opciones', 'विकल्प', 'Seçenekler', 'Opções', 'Параметри', 'Opsi', 'Opcje', '选项', '옵션', 'オプション'],
    badManifest: ['mod.json is not valid JSON', 'mod.json — неверный JSON', 'mod.json ist kein gültiges JSON', 'mod.json n’est pas un JSON valide',
      'mod.json non è un JSON valido', 'mod.json no es un JSON válido', 'mod.json मान्य JSON नहीं है', 'mod.json geçerli bir JSON değil',
      'mod.json não é um JSON válido', 'mod.json — некоректний JSON', 'mod.json bukan JSON yang valid', 'mod.json nie jest poprawnym JSON',
      'mod.json 不是有效的 JSON', 'mod.json이 올바른 JSON이 아닙니다', 'mod.json が正しい JSON ではありません'],
    custom: ['Custom mod','Свой мод', 'Eigener Mod', 'Mod personnel', 'Mod personale', 'Mod propio', 'कस्टम मॉड', 'Özel mod', 'Mod próprio', 'Власний мод',
      'Mod kustom', 'Własny mod', '自定义模组', '사용자 모드', 'カスタム MOD'],
    restart: ['Restart the game to apply the change', 'Перезапустите игру, чтобы применить', 'Starte das Spiel neu, um es zu übernehmen',
      'Relancez le jeu pour appliquer', 'Riavvia il gioco per applicare', 'Reinicia el juego para aplicar', 'लागू करने के लिए गेम फिर से शुरू करें',
      'Uygulamak için oyunu yeniden başlatın', 'Reinicie o jogo para aplicar', 'Перезапустіть гру, щоб застосувати', 'Mulai ulang game untuk menerapkan',
      'Uruchom grę ponownie, aby zastosować', '重启游戏后生效', '적용하려면 게임을 다시 시작하세요', '反映するにはゲームを再起動してください'],
    saved: ['Saved', 'Сохранено', 'Gespeichert', 'Enregistré', 'Salvato', 'Guardado', 'सहेजा गया', 'Kaydedildi', 'Salvo', 'Збережено', 'Tersimpan', 'Zapisano', '已保存', '저장됨', '保存しました'],
    'os-perf': ['Smoother OS upgrades', 'Плавные улучшения ОС', 'Flüssigere OS-Upgrades', 'Améliorations d’OS plus fluides', 'Aggiornamenti OS più fluidi',
      'Mejoras de SO más fluidas', 'स्मूद OS अपग्रेड', 'Daha akıcı OS geliştirmeleri', 'Melhorias de SO mais fluidas', 'Плавні покращення ОС', 'Upgrade OS lebih mulus',
      'Płynniejsze ulepszenia OS', '更流畅的系统升级', '더 부드러운 OS 업그레이드', 'OS アップグレードを軽く'],
    'os-perf.d': ['Same OS upgrade cards without the heavy blur filters', 'Те же карточки улучшений ОС без тяжёлого размытия',
      'Gleiche OS-Karten ohne schwere Weichzeichner', 'Mêmes cartes d’OS sans les flous coûteux', 'Stesse schede OS senza i filtri di sfocatura pesanti',
      'Las mismas tarjetas de SO sin desenfoques pesados', 'वही OS कार्ड, भारी ब्लर के बिना', 'Aynı OS kartları, ağır bulanıklık olmadan',
      'Os mesmos cartões de SO sem desfoques pesados', 'Ті самі картки ОС без важкого розмиття', 'Kartu OS yang sama tanpa blur berat',
      'Te same karty OS bez ciężkiego rozmycia', '相同的系统升级卡片，去掉了沉重的模糊', '같은 OS 카드, 무거운 블러 없이', '同じ OS カードを重いぼかしなしで'],
    'hire-tools': ['Hiring tools', 'Найм сотрудников', 'Einstellungs-Werkzeuge', 'Outils d’embauche', 'Strumenti di assunzione', 'Herramientas de contratación',
      'भर्ती टूल', 'İşe alım araçları', 'Ferramentas de contratação', 'Найм працівників', 'Alat rekrutmen', 'Narzędzia rekrutacji', '招聘工具', '채용 도구', '採用ツール'],
    'hire-tools.d': ['FIND EMPLOYEES: search until the office is full, auto-hire', 'ПОИСК: искать до заполнения офиса, автонайм',
      'MITARBEITER SUCHEN: suchen bis das Büro voll ist, Auto-Einstellen', 'RECHERCHE : chercher jusqu’à remplir le bureau, embauche auto',
      'CERCA: cerca finché l’ufficio è pieno, assunzione auto', 'BUSCAR: buscar hasta llenar la oficina, contratación auto',
      'खोज: ऑफ़िस भरने तक खोजें, स्वतः नियुक्ति', 'ARA: ofis dolana kadar ara, otomatik işe al', 'BUSCAR: procurar até lotar o escritório, contratação auto',
      'ПОШУК: шукати до заповнення офісу, автонайм', 'CARI: cari sampai kantor penuh, rekrut otomatis', 'SZUKAJ: szukaj do zapełnienia biura, autozatrudnianie',
      '寻找员工：搜到办公室满员，自动雇佣', '직원 찾기: 사무실이 찰 때까지 검색, 자동 채용', '社員探し：オフィスが埋まるまで検索、自動採用'],
    'hire-tools.autoHire': ['Hire everyone found automatically', 'Сразу нанимать всех найденных', 'Alle Gefundenen automatisch einstellen',
      'Embaucher automatiquement les candidats trouvés', 'Assumi automaticamente chi viene trovato', 'Contratar automáticamente a los encontrados',
      'मिले सभी को स्वतः नियुक्त करें', 'Bulunanları otomatik işe al', 'Contratar automaticamente os encontrados', 'Одразу наймати всіх знайдених',
      'Rekrut otomatis semua yang ditemukan', 'Automatycznie zatrudniaj znalezionych', '自动雇佣找到的所有人', '찾은 사람 자동 채용', '見つけた人を自動で採用'],
    'train-all': ['Train all', 'Обучить всех', 'Alle schulen', 'Tout former', 'Forma tutti', 'Entrenar a todos', 'सभी को प्रशिक्षित करें', 'Hepsini eğit', 'Treinar todos',
      'Навчити всіх', 'Latih semua', 'Szkol wszystkich', '全部培训', '모두 교육', '全員を研修'],
    'train-all.d': ['UPGRADE EMPLOYEES: one button trains everyone of all professions to the max', 'УЛУЧШЕНИЕ: одна кнопка обучает всех сотрудников всех профессий до максимума',
      'MITARBEITER VERBESSERN: ein Knopf schult alle Mitarbeiter aller Berufe aufs Maximum', 'AMÉLIORER : un bouton forme tous les employés de tous les métiers au maximum',
      'MIGLIORA: un pulsante forma tutti i dipendenti di tutte le professioni al massimo', 'MEJORAR: un botón entrena a todos los empleados de todas las profesiones al máximo',
      'अपग्रेड: एक बटन सभी पेशों के सभी कर्मचारियों को अधिकतम तक प्रशिक्षित करता है', 'GELİŞTİR: tek tuşla tüm mesleklerdeki herkes maksimuma', 'MELHORAR: um botão treina todos de todas as profissões ao máximo',
      'ПОКРАЩЕННЯ: одна кнопка навчає всіх працівників усіх професій до максимуму', 'TINGKATKAN: satu tombol melatih semua karyawan semua profesi ke maksimum',
      'ULEPSZ: jeden przycisk szkoli wszystkich pracowników wszystkich zawodów do maksimum', '升级员工：一键把所有职业的员工培训到满级', '직원 강화: 버튼 하나로 모든 직종의 직원을 최대까지', '社員強化：ボタン1つで全職種の全員を最大まで'],
    'train-all.mute': ['Mute the click sounds while training', 'Без звуков кликов во время обучения', 'Klickgeräusche beim Schulen stummschalten',
      'Couper les sons de clic pendant la formation', 'Silenzia i clic durante la formazione', 'Silenciar los clics durante el entrenamiento',
      'प्रशिक्षण के दौरान क्लिक ध्वनियाँ बंद', 'Eğitim sırasında tık seslerini kapat', 'Silenciar os cliques durante o treino', 'Без звуків кліків під час навчання',
      'Matikan suara klik saat pelatihan', 'Wycisz kliknięcia podczas szkolenia', '培训时静音点击声', '교육 중 클릭 소리 끄기', '研修中のクリック音を消す'],
    updTitle: ['BetterDT {v} is ready', 'BetterDT {v} готов', 'BetterDT {v} ist bereit', 'BetterDT {v} est prêt', 'BetterDT {v} è pronto', 'BetterDT {v} está listo',
      'BetterDT {v} तैयार है', 'BetterDT {v} hazır', 'BetterDT {v} está pronto', 'BetterDT {v} готовий', 'BetterDT {v} siap', 'BetterDT {v} jest gotowy',
      'BetterDT {v} 已就绪', 'BetterDT {v} 준비 완료', 'BetterDT {v} の準備ができました'],
    updText: ['The new version starts the next time you launch the game. Restart now to use it right away – if you are playing, save first.',
      'Новая версия запустится при следующем запуске игры. Перезапустите сейчас, чтобы использовать её сразу – если вы играете, сначала сохранитесь.',
      'Die neue Version startet beim nächsten Spielstart. Starte jetzt neu, um sie sofort zu nutzen – wenn du gerade spielst, speichere vorher.',
      'La nouvelle version démarrera au prochain lancement du jeu. Redémarrez maintenant pour l’utiliser tout de suite – si vous jouez, sauvegardez d’abord.',
      'La nuova versione partirà al prossimo avvio del gioco. Riavvia ora per usarla subito – se stai giocando, salva prima.',
      'La nueva versión se iniciará la próxima vez que abras el juego. Reinicia ahora para usarla ya; si estás jugando, guarda antes.',
      'नया संस्करण अगली बार गेम शुरू करने पर चलेगा। इसे अभी इस्तेमाल करने के लिए फिर से शुरू करें – अगर आप खेल रहे हैं, तो पहले सेव करें।',
      'Yeni sürüm oyunu bir sonraki açışınızda başlar. Hemen kullanmak için şimdi yeniden başlatın – oynuyorsanız önce kaydedin.',
      'A nova versão será usada na próxima vez que você abrir o jogo. Reinicie agora para usá-la já – se estiver jogando, salve antes.',
      'Нова версія запуститься під час наступного запуску гри. Перезапустіть зараз, щоб скористатися нею одразу – якщо ви граєте, спершу збережіться.',
      'Versi baru akan dipakai saat game dibuka lagi. Mulai ulang sekarang untuk langsung memakainya – jika sedang bermain, simpan dulu.',
      'Nowa wersja uruchomi się przy następnym starcie gry. Uruchom ponownie teraz, aby używać jej od razu – jeśli grasz, najpierw zapisz grę.',
      '新版本将在下次启动游戏时生效。立即重启即可马上使用——如果正在游戏中，请先存档。',
      '새 버전은 다음에 게임을 시작할 때 적용됩니다. 바로 사용하려면 지금 다시 시작하세요. 플레이 중이라면 먼저 저장하세요.',
      '新しいバージョンは次回ゲームを起動したときに使われます。すぐ使うには今すぐ再起動してください。プレイ中なら先にセーブしてください。'],
    later: ['Keep playing', 'Продолжить игру', 'Weiterspielen', 'Continuer à jouer', 'Continua a giocare', 'Seguir jugando', 'खेलना जारी रखें', 'Oynamaya devam et',
      'Continuar jogando', 'Продовжити гру', 'Lanjut bermain', 'Graj dalej', '继续游戏', '계속 플레이', 'このまま遊ぶ'],
    restart: ['Restart now', 'Перезапустить', 'Jetzt neu starten', 'Redémarrer', 'Riavvia ora', 'Reiniciar ahora', 'अभी फिर से शुरू करें', 'Şimdi yeniden başlat',
      'Reiniciar agora', 'Перезапустити', 'Mulai ulang', 'Uruchom ponownie', '立即重启', '지금 다시 시작', '今すぐ再起動'],
    crashTitle: ['The game crashed', 'Сбой игры', 'Das Spiel ist abgestürzt', 'Le jeu a planté', 'Il gioco si è bloccato', 'El juego se ha bloqueado', 'गेम क्रैश हो गया',
      'Oyun çöktü', 'O jogo travou', 'Збій гри', 'Game mengalami crash', 'Gra uległa awarii', '游戏崩溃了', '게임이 충돌했습니다', 'ゲームがクラッシュしました'],
    crashText: ['The game screen stopped working (white screen), so BetterDT reloaded the game. Load your last save to continue.',
      'Экран игры перестал работать (белый экран), поэтому BetterDT перезагрузил игру. Загрузите последнее сохранение, чтобы продолжить.',
      'Der Spielbildschirm funktionierte nicht mehr (weißer Bildschirm), deshalb hat BetterDT das Spiel neu geladen. Lade deinen letzten Spielstand, um weiterzuspielen.',
      'L’écran du jeu a cessé de fonctionner (écran blanc), BetterDT a donc rechargé le jeu. Chargez votre dernière sauvegarde pour continuer.',
      'La schermata del gioco ha smesso di funzionare (schermo bianco), quindi BetterDT ha ricaricato il gioco. Carica l’ultimo salvataggio per continuare.',
      'La pantalla del juego dejó de funcionar (pantalla blanca), así que BetterDT recargó el juego. Carga tu última partida guardada para continuar.',
      'गेम की स्क्रीन ने काम करना बंद कर दिया (सफ़ेद स्क्रीन), इसलिए BetterDT ने गेम फिर से लोड किया। जारी रखने के लिए अपना आख़िरी सेव लोड करें।',
      'Oyun ekranı çalışmayı durdurdu (beyaz ekran), bu yüzden BetterDT oyunu yeniden yükledi. Devam etmek için son kaydınızı yükleyin.',
      'A tela do jogo parou de funcionar (tela branca), então o BetterDT recarregou o jogo. Carregue seu último save para continuar.',
      'Екран гри перестав працювати (білий екран), тому BetterDT перезавантажив гру. Завантажте останнє збереження, щоб продовжити.',
      'Layar game berhenti bekerja (layar putih), jadi BetterDT memuat ulang game. Muat simpanan terakhir untuk melanjutkan.',
      'Ekran gry przestał działać (biały ekran), więc BetterDT wczytał grę ponownie. Wczytaj ostatni zapis, aby kontynuować.',
      '游戏画面停止工作（白屏），BetterDT 已重新加载游戏。请读取最近的存档继续。',
      '게임 화면이 멈춰서(흰 화면) BetterDT가 게임을 다시 불러왔습니다. 마지막 저장을 불러와 계속하세요.',
      'ゲーム画面が動かなくなった（白い画面）ため、BetterDT がゲームを再読み込みしました。最後のセーブをロードして続けてください。'],
    crashHint: ['“Report problem” opens a prefilled report on GitHub and copies it, so you can also paste it into the Steam discussion.',
      '«Сообщить о проблеме» откроет готовый отчёт на GitHub и скопирует его – его можно вставить и в обсуждение в Steam.',
      '„Problem melden“ öffnet einen vorausgefüllten Bericht auf GitHub und kopiert ihn, damit du ihn auch in die Steam-Diskussion einfügen kannst.',
      '« Signaler le problème » ouvre un rapport prérempli sur GitHub et le copie, pour le coller aussi dans la discussion Steam.',
      '“Segnala il problema” apre una segnalazione precompilata su GitHub e la copia, così puoi incollarla anche nella discussione di Steam.',
      '«Informar del problema» abre un informe ya rellenado en GitHub y lo copia, para que también puedas pegarlo en la discusión de Steam.',
      '“समस्या की रिपोर्ट करें” GitHub पर भरी हुई रिपोर्ट खोलता है और उसे कॉपी करता है, ताकि आप उसे Steam चर्चा में भी चिपका सकें।',
      '“Sorunu bildir” GitHub’da hazır bir rapor açar ve kopyalar; Steam tartışmasına da yapıştırabilirsiniz.',
      '“Relatar problema” abre um relatório preenchido no GitHub e o copia, para você também colar na discussão da Steam.',
      '«Повідомити про проблему» відкриє готовий звіт на GitHub і скопіює його – його можна вставити й в обговорення в Steam.',
      '“Laporkan masalah” membuka laporan yang sudah terisi di GitHub dan menyalinnya, jadi bisa juga ditempel di diskusi Steam.',
      '„Zgłoś problem” otwiera wypełniony raport na GitHubie i kopiuje go, więc możesz go też wkleić do dyskusji na Steamie.',
      '“报告问题”会在 GitHub 上打开已填好的报告并复制它，你也可以把它粘贴到 Steam 讨论区。',
      '“문제 신고”는 GitHub에 미리 채워진 보고서를 열고 복사해 두므로 Steam 토론에도 붙여 넣을 수 있습니다.',
      '「問題を報告」は記入済みのレポートを GitHub で開いてコピーします。Steam のディスカッションにも貼り付けられます。'],
    ok: ['OK', 'ОК', 'OK', 'OK', 'OK', 'Aceptar', 'ठीक है', 'Tamam', 'OK', 'Гаразд', 'OK', 'OK', '确定', '확인', 'OK'],
    report: ['Report problem', 'Сообщить о проблеме', 'Problem melden', 'Signaler le problème', 'Segnala il problema', 'Informar del problema',
      'समस्या की रिपोर्ट करें', 'Sorunu bildir', 'Relatar problema', 'Повідомити про проблему', 'Laporkan masalah', 'Zgłoś problem', '报告问题', '문제 신고', '問題を報告'],
    autosave: ['Autosave', 'Автосохранение', 'Automatisches Speichern', 'Sauvegarde auto', 'Salvataggio automatico', 'Autoguardado', 'ऑटो-सेव',
      'Otomatik kayıt', 'Salvamento automático', 'Автозбереження', 'Simpan otomatis', 'Autozapis', '自动存档', '자동 저장', 'オートセーブ'],
    'autosave.d': ['Replaces the game\'s autosave choice (30 to 365 days) with any interval from 5 to 360 game days',
      'Заменяет выбор автосохранения игры (30–365 дней) любым интервалом от 5 до 360 игровых дней',
      'Ersetzt die Autospeicher-Auswahl des Spiels (30–365 Tage) durch jeden Abstand von 5 bis 360 Spieltagen',
      'Remplace le choix de sauvegarde auto du jeu (30 à 365 jours) par n\'importe quel intervalle de 5 à 360 jours de jeu',
      'Sostituisce la scelta di salvataggio automatico del gioco (30–365 giorni) con qualsiasi intervallo da 5 a 360 giorni di gioco',
      'Sustituye la opción de autoguardado del juego (30 a 365 días) por cualquier intervalo de 5 a 360 días de juego',
      'गेम के ऑटो-सेव विकल्प (30–365 दिन) की जगह 5 से 360 गेम दिनों का कोई भी अंतराल',
      'Oyunun otomatik kayıt seçimini (30–365 gün) 5 ile 360 oyun günü arasındaki herhangi bir aralıkla değiştirir',
      'Substitui a escolha de salvamento automático do jogo (30 a 365 dias) por qualquer intervalo de 5 a 360 dias de jogo',
      'Замінює вибір автозбереження гри (30–365 днів) будь-яким інтервалом від 5 до 360 ігрових днів',
      'Mengganti pilihan simpan otomatis game (30–365 hari) dengan interval apa pun dari 5 sampai 360 hari game',
      'Zastępuje wybór autozapisu gry (30–365 dni) dowolnym odstępem od 5 do 360 dni gry',
      '用 5 到 360 个游戏日之间的任意间隔取代游戏的自动存档选项（30–365 天）',
      '게임의 자동 저장 선택(30–365일)을 5~360 게임 일 사이의 원하는 주기로 바꿉니다',
      'ゲームのオートセーブ間隔（30〜365日）を、5〜360ゲーム日の好きな間隔に置き換えます'],
    'research-all': ['Research all', 'Исследовать все', 'Alles erforschen', 'Tout rechercher', 'Ricerca tutto', 'Investigar todo',
      'सब पर शोध करें', 'Tümünü araştır', 'Pesquisar tudo', 'Дослідити все', 'Riset semua', 'Zbadaj wszystko', '全部研究', '모두 연구', 'すべて研究'],
    'research-all.d': ['RESEARCH LAB: next to the game\'s button (now "Research tab"), "Research all" researches everything on all tabs',
      'ЛАБОРАТОРИЯ: рядом с кнопкой игры (теперь «Исследовать вкладку») «Исследовать все» исследует всё на всех вкладках',
      'FORSCHUNGSLABOR: neben der Spiel-Schaltfläche (jetzt „Tab erforschen“) erforscht „Alles erforschen“ alles auf allen Tabs',
      'LABORATOIRE : à côté du bouton du jeu (désormais « Rechercher l\'onglet »), « Tout rechercher » recherche tout dans tous les onglets',
      'LABORATORIO: accanto al pulsante del gioco (ora «Ricerca scheda»), «Ricerca tutto» ricerca tutto in tutte le schede',
      'LABORATORIO: junto al botón del juego (ahora «Investigar pestaña»), «Investigar todo» investiga todo en todas las pestañas',
      'प्रयोगशाला: गेम के बटन (अब "टैब पर शोध करें") के बगल में "सब पर शोध करें" सभी टैब पर सब कुछ शोध करता है',
      'LABORATUVAR: oyunun düğmesinin (artık "Sekmeyi araştır") yanında "Tümünü araştır" tüm sekmelerdeki her şeyi araştırır',
      'LABORATÓRIO: ao lado do botão do jogo (agora "Pesquisar aba"), "Pesquisar tudo" pesquisa tudo em todas as abas',
      'ЛАБОРАТОРІЯ: поруч із кнопкою гри (тепер «Дослідити вкладку») «Дослідити все» досліджує все на всіх вкладках',
      'LAB RISET: di samping tombol game (sekarang "Riset tab"), "Riset semua" meriset semuanya di semua tab',
      'LABORATORIUM: obok przycisku gry (teraz „Zbadaj kartę”) „Zbadaj wszystko” bada wszystko na wszystkich kartach',
      '研究实验室：在游戏按钮（现为“研究此页”）旁，“全部研究”会研究所有分页的全部内容',
      '연구실: 게임 버튼(이제 "탭 연구") 옆의 "모두 연구"가 모든 탭의 모든 항목을 연구합니다',
      '研究室：ゲームのボタン（「タブを研究」に変更）の隣の「すべて研究」が、全タブのすべてを研究します'],
    'game-speed': ['Faster game speed', 'Быстрая скорость игры', 'Schnelleres Spieltempo', 'Vitesse du jeu plus rapide', 'Velocità di gioco più alta',
      'Velocidad de juego más rápida', 'तेज़ गेम स्पीड', 'Daha hızlı oyun', 'Velocidade de jogo maior', 'Швидша гра',
      'Kecepatan game lebih cepat', 'Szybsza gra', '更快的游戏速度', '더 빠른 게임 속도', 'より速いゲーム速度'],
    'game-speed.d': ['The speed button in the corner also offers the speeds turned on below, each in its own colour',
      'Кнопка скорости в углу предлагает также скорости, включённые ниже, каждую своим цветом',
      'Der Tempo-Knopf in der Ecke bietet auch die unten eingeschalteten Tempi, jedes in eigener Farbe',
      'Le bouton de vitesse dans le coin propose aussi les vitesses activées ci-dessous, chacune de sa couleur',
      'Il pulsante della velocità nell’angolo offre anche le velocità attivate qui sotto, ognuna col suo colore',
      'El botón de velocidad de la esquina ofrece también las velocidades activadas abajo, cada una con su color',
      'कोने का स्पीड बटन नीचे चालू की गई स्पीड भी देता है, हर एक अपने रंग में',
      'Köşedeki hız düğmesi aşağıda açılan hızları da sunar, her biri kendi renginde',
      'O botão de velocidade no canto também oferece as velocidades ativadas abaixo, cada uma com sua cor',
      'Кнопка швидкості в куті пропонує також швидкості, увімкнені нижче, кожну своїм кольором',
      'Tombol kecepatan di pojok juga menawarkan kecepatan yang diaktifkan di bawah, masing-masing dengan warnanya',
      'Przycisk prędkości w rogu oferuje też prędkości włączone poniżej, każdą w innym kolorze',
      '角落的速度按钮也提供下面开启的速度，每种速度一种颜色', '모서리의 속도 버튼에서 아래에서 켠 속도도 고를 수 있으며 속도마다 색이 다릅니다',
      '隅の速度ボタンで下でオンにした速度も選べます（速度ごとに色が違います）'],
    gameVer: ['Game version', 'Версия игры', 'Spielversion', 'Version du jeu', 'Versione del gioco', 'Versión del juego', 'गेम संस्करण', 'Oyun sürümü',
      'Versão do jogo', 'Версія гри', 'Versi game', 'Wersja gry', '游戏版本', '게임 버전', 'ゲームのバージョン'],
    stIncompat: ['Does not fit this game version, turned off', 'Не подходит к этой версии игры, отключён', 'Passt nicht zu dieser Spielversion, ausgeschaltet',
      'Incompatible avec cette version du jeu, désactivé', 'Non compatibile con questa versione del gioco, disattivato', 'No es compatible con esta versión del juego, desactivado',
      'इस गेम संस्करण से मेल नहीं खाता, बंद किया गया', 'Bu oyun sürümüne uymuyor, kapatıldı', 'Não é compatível com esta versão do jogo, desativado',
      'Не підходить до цієї версії гри, вимкнено', 'Tidak cocok dengan versi game ini, dimatikan', 'Nie pasuje do tej wersji gry, wyłączony',
      '与此游戏版本不兼容，已关闭', '이 게임 버전과 맞지 않아 꺼졌습니다', 'このゲームバージョンに対応していないためオフにしました'],
    stFailed: ['Stopped after repeated errors', 'Остановлен после повторных ошибок', 'Nach wiederholten Fehlern angehalten', 'Arrêté après des erreurs répétées',
      'Fermato dopo errori ripetuti', 'Detenido tras errores repetidos', 'बार-बार त्रुटियों के बाद रोका गया', 'Tekrarlanan hatalardan sonra durduruldu',
      'Parado após erros repetidos', 'Зупинено після повторних помилок', 'Dihentikan setelah kesalahan berulang', 'Zatrzymany po powtarzających się błędach',
      '多次出错后已停止', '반복된 오류로 중지되었습니다', 'エラーが続いたため停止しました'],
    stWarn: ['Works, but something in the game has changed', 'Работает, но в игре что-то изменилось', 'Läuft, aber im Spiel hat sich etwas geändert',
      'Fonctionne, mais quelque chose a changé dans le jeu', 'Funziona, ma qualcosa nel gioco è cambiato', 'Funciona, pero algo ha cambiado en el juego',
      'चल रहा है, पर गेम में कुछ बदल गया है', 'Çalışıyor ama oyunda bir şey değişmiş', 'Funciona, mas algo mudou no jogo',
      'Працює, але в грі щось змінилося', 'Berjalan, tetapi ada yang berubah di game', 'Działa, ale coś w grze się zmieniło',
      '可以运行，但游戏有所变化', '작동하지만 게임에서 무언가 바뀌었습니다', '動作していますが、ゲーム側で何かが変わっています'],
    verTitle: ['The game has been updated', 'Игра обновилась', 'Das Spiel wurde aktualisiert', 'Le jeu a été mis à jour', 'Il gioco è stato aggiornato',
      'El juego se ha actualizado', 'गेम अपडेट हो गया है', 'Oyun güncellendi', 'O jogo foi atualizado', 'Гру оновлено', 'Game telah diperbarui',
      'Gra została zaktualizowana', '游戏已更新', '게임이 업데이트되었습니다', 'ゲームがアップデートされました'],
    verText: ['Devices Tycoon {a} → {b}. BetterDT has checked its mods.', 'Devices Tycoon {a} → {b}. BetterDT проверил свои моды.',
      'Devices Tycoon {a} → {b}. BetterDT hat seine Mods geprüft.', 'Devices Tycoon {a} → {b}. BetterDT a vérifié ses mods.',
      'Devices Tycoon {a} → {b}. BetterDT ha controllato le sue mod.', 'Devices Tycoon {a} → {b}. BetterDT ha revisado sus mods.',
      'Devices Tycoon {a} → {b}. BetterDT ने अपने मॉड जाँचे।', 'Devices Tycoon {a} → {b}. BetterDT modlarını kontrol etti.',
      'Devices Tycoon {a} → {b}. O BetterDT verificou seus mods.', 'Devices Tycoon {a} → {b}. BetterDT перевірив свої моди.',
      'Devices Tycoon {a} → {b}. BetterDT telah memeriksa mod-nya.', 'Devices Tycoon {a} → {b}. BetterDT sprawdził swoje mody.',
      'Devices Tycoon {a} → {b}。BetterDT 已检查其模组。', 'Devices Tycoon {a} → {b}. BetterDT가 모드를 확인했습니다.', 'Devices Tycoon {a} → {b}。BetterDT が MOD を確認しました。'],
    verAllOk: ['All mods work.', 'Все моды работают.', 'Alle Mods funktionieren.', 'Tous les mods fonctionnent.', 'Tutte le mod funzionano.', 'Todos los mods funcionan.',
      'सभी मॉड काम कर रहे हैं।', 'Tüm modlar çalışıyor.', 'Todos os mods funcionam.', 'Усі моди працюють.', 'Semua mod berfungsi.', 'Wszystkie mody działają.',
      '所有模组均正常。', '모든 모드가 작동합니다.', 'すべての MOD が動作しています。'],
    verOff: ['Turned off until a BetterDT update fixes them: {list}', 'Отключены до обновления BetterDT: {list}', 'Bis zu einem BetterDT-Update ausgeschaltet: {list}',
      "Désactivés jusqu'à une mise à jour de BetterDT : {list}", 'Disattivate fino a un aggiornamento di BetterDT: {list}', 'Desactivados hasta una actualización de BetterDT: {list}',
      'BetterDT अपडेट तक बंद: {list}', 'BetterDT güncellemesine kadar kapalı: {list}', 'Desativados até uma atualização do BetterDT: {list}',
      'Вимкнено до оновлення BetterDT: {list}', 'Dimatikan sampai pembaruan BetterDT: {list}', 'Wyłączone do aktualizacji BetterDT: {list}',
      '在 BetterDT 更新前已关闭：{list}', 'BetterDT 업데이트 전까지 꺼짐: {list}', 'BetterDT のアップデートまでオフ：{list}'],
    fbTitle: ['BetterDT mods', 'Моды BetterDT', 'BetterDT-Mods', 'Mods BetterDT', 'Mod di BetterDT', 'Mods de BetterDT', 'BetterDT मॉड', 'BetterDT modları',
      'Mods do BetterDT', 'Моди BetterDT', 'Mod BetterDT', 'Mody BetterDT', 'BetterDT 模组', 'BetterDT 모드', 'BetterDT の MOD'],
    fbText: ["The game's settings page has changed, so here is a simple list. Changes take effect after a restart.",
      'Страница настроек игры изменилась, поэтому здесь простой список. Изменения сработают после перезапуска.',
      'Die Einstellungsseite des Spiels hat sich geändert, deshalb hier eine einfache Liste. Änderungen wirken nach einem Neustart.',
      'La page des paramètres du jeu a changé, voici donc une liste simple. Les changements prennent effet après un redémarrage.',
      'La pagina delle impostazioni del gioco è cambiata, quindi ecco un semplice elenco. Le modifiche valgono dopo il riavvio.',
      'La página de ajustes del juego ha cambiado, así que aquí hay una lista sencilla. Los cambios se aplican tras reiniciar.',
      'गेम का सेटिंग पेज बदल गया है, इसलिए यहाँ एक सरल सूची है। बदलाव रीस्टार्ट के बाद लागू होंगे।',
      'Oyunun ayarlar sayfası değişti, bu yüzden burada basit bir liste var. Değişiklikler yeniden başlatınca geçerli olur.',
      'A página de configurações do jogo mudou, então aqui está uma lista simples. As alterações valem após reiniciar.',
      'Сторінка налаштувань гри змінилася, тому тут простий список. Зміни запрацюють після перезапуску.',
      'Halaman pengaturan game berubah, jadi ini daftar sederhana. Perubahan berlaku setelah dimulai ulang.',
      'Strona ustawień gry się zmieniła, więc tu jest prosta lista. Zmiany zadziałają po ponownym uruchomieniu.',
      '游戏的设置页面已改变，因此这里提供一个简单列表。更改将在重启后生效。',
      '게임 설정 페이지가 바뀌어 간단한 목록을 표시합니다. 변경 사항은 재시작 후 적용됩니다.',
      'ゲームの設定画面が変わったため、簡易リストを表示しています。変更は再起動後に反映されます。'],
    'low-end': ['Low-end mode', 'Режим для слабых ПК', 'Modus für schwache PCs', 'Mode PC modeste', 'Modalità PC datati', 'Modo para PC modestos',
      'कमज़ोर पीसी मोड', 'Düşük donanım modu', 'Modo para PCs fracos', 'Режим для слабких ПК', 'Mode PC lawas', 'Tryb dla słabszych PC', '低配模式', '저사양 모드', '低スペックモード'],
    'low-end.d': ['Lighter rendering for older computers', 'Облегчённая отрисовка для старых компьютеров', 'Leichtere Darstellung für ältere Computer',
      'Rendu plus léger pour les ordinateurs anciens', 'Grafica più leggera per computer datati', 'Renderizado más ligero para ordenadores antiguos',
      'पुराने कंप्यूटरों के लिए हल्की रेंडरिंग', 'Eski bilgisayarlar için daha hafif çizim', 'Renderização mais leve para computadores antigos',
      'Легше відмальовування для старих комп’ютерів', 'Tampilan lebih ringan untuk komputer lama', 'Lżejsze renderowanie dla starszych komputerów',
      '为旧电脑减轻渲染负担', '오래된 컴퓨터를 위한 가벼운 렌더링', '古いパソコン向けに描画を軽くします'],
    'low-end.fps': ['Limit to 30 FPS', 'Ограничить до 30 FPS', 'Auf 30 FPS begrenzen', 'Limiter à 30 FPS', 'Limita a 30 FPS', 'Limitar a 30 FPS',
      '30 FPS तक सीमित करें', '30 FPS ile sınırla', 'Limitar a 30 FPS', 'Обмежити до 30 FPS', 'Batasi ke 30 FPS', 'Ogranicz do 30 FPS', '限制为 30 FPS', '30 FPS로 제한', '30 FPS に制限'],
    'low-end.blur': ['Turn off blur', 'Отключить размытие', 'Unschärfe ausschalten', 'Désactiver le flou', 'Disattiva la sfocatura', 'Desactivar el desenfoque',
      'ब्लर बंद करें', 'Bulanıklığı kapat', 'Desativar o desfoque', 'Вимкнути розмиття', 'Matikan efek blur', 'Wyłącz rozmycie', '关闭模糊效果', '흐림 효과 끄기', 'ぼかしをオフ'],
    'living-market': ['Living market', 'Живой рынок', 'Lebendiger Markt', 'Marché vivant', 'Mercato vivo',
      'Mercado vivo', 'जीवंत बाज़ार', 'Canlı pazar', 'Mercado vivo', 'Живий ринок', 'Pasar hidup', 'Żywy rynek',
      '动态市场', '살아있는 시장', '生きた市場'],
    'living-market.d': ['Old and much-sold devices sell less, most of all in categories you dominate. New models with current parts win the customers back',
      'Старые и массово проданные устройства продаются хуже, сильнее всего там, где вы лидируете. Новые модели с актуальными деталями возвращают покупателей',
      'Alte und oft verkaufte Geräte verkaufen sich schlechter, am stärksten dort, wo du dominierst. Neue Modelle mit aktuellen Teilen holen die Kunden zurück',
      'Les appareils anciens et très vendus se vendent moins, surtout là où vous dominez. Les nouveaux modèles aux pièces récentes reconquièrent les clients',
      'I dispositivi vecchi e molto venduti vendono meno, soprattutto dove domini. I nuovi modelli con componenti attuali riconquistano i clienti',
      'Los dispositivos viejos y muy vendidos venden menos, sobre todo donde dominas. Los modelos nuevos con piezas actuales recuperan a los clientes',
      'पुराने और बहुत बिके डिवाइस कम बिकते हैं, खासकर जहाँ आपका दबदबा है। नए पुर्ज़ों वाले नए मॉडल ग्राहकों को वापस लाते हैं',
      'Eski ve çok satılmış cihazlar daha az satar, en çok hâkim olduğun kategorilerde. Güncel parçalı yeni modeller müşterileri geri kazanır',
      'Aparelhos antigos e muito vendidos vendem menos, sobretudo onde você domina. Modelos novos com peças atuais reconquistam os clientes',
      'Старі й масово продані пристрої продаються гірше, найбільше там, де ви домінуєте. Нові моделі з актуальними деталями повертають покупців',
      'Perangkat lama dan yang sudah banyak terjual makin kurang laku, terutama di kategori yang Anda kuasai. Model baru dengan komponen terkini merebut kembali pelanggan',
      'Stare i często kupowane urządzenia sprzedają się słabiej, najbardziej tam, gdzie dominujesz. Nowe modele z aktualnymi częściami odzyskują klientów',
      '旧的和已大量售出的设备销量下降，在你占主导的品类中最明显。采用最新部件的新型号能赢回顾客',
      '오래되고 많이 팔린 기기는 덜 팔리며, 지배 중인 카테고리에서 가장 심합니다. 최신 부품을 쓴 새 모델이 고객을 되찾습니다',
      '古くて売れすぎたデバイスは売れにくくなり、支配しているカテゴリほど顕著です。最新パーツの新モデルが顧客を取り戻します'],
    'parts-reviews': ['Parts in reviews', 'Детали в обзорах', 'Bauteile in Tests', 'Composants dans les tests', 'Componenti nelle recensioni',
      'Componentes en las reseñas', 'समीक्षाओं में पुर्ज़े', 'İncelemelerde parçalar', 'Peças nas análises', 'Деталі в оглядах', 'Komponen dalam ulasan',
      'Podzespoły w recenzjach', '评测中的部件', '리뷰 속 부품', 'レビューの部品評価'],
    'parts-reviews.d': ['Reviewers rate the operating system, the CPU and a laptop GPU: a cheap or outdated OS and a weak CPU or GPU lower the rating, your own OS, CPU and GPU get a bonus. Needs Fair reviews',
      'Обозреватели оценивают операционную систему, CPU и GPU ноутбуков: дешёвая или устаревшая ОС и слабый CPU или GPU снижают оценку, ваши собственные ОС, CPU и GPU получают бонус. Нужны «Честные обзоры»',
      'Tester bewerten Betriebssystem, CPU und die GPU von Laptops: ein billiges oder veraltetes OS und eine schwache CPU oder GPU senken die Wertung, eigenes OS, eigene CPU und GPU bekommen einen Bonus. Benötigt Faire Tests',
      'Les testeurs notent le système d’exploitation, le CPU et le GPU des portables : un OS bon marché ou dépassé et un CPU ou GPU faible baissent la note, votre propre OS, CPU et GPU ont un bonus. Nécessite Tests équitables',
      'I recensori valutano sistema operativo, CPU e la GPU dei portatili: un OS economico o datato e una CPU o GPU debole abbassano il voto, il tuo OS, la tua CPU e GPU hanno un bonus. Richiede Recensioni eque',
      'Los críticos valoran el sistema operativo, la CPU y la GPU de los portátiles: un SO barato o anticuado y una CPU o GPU débil bajan la nota, tu propio SO, CPU y GPU reciben un extra. Requiere Reseñas justas',
      'समीक्षक ऑपरेटिंग सिस्टम, CPU और लैपटॉप के GPU को रेट करते हैं: सस्ता या पुराना OS और कमज़ोर CPU या GPU रेटिंग घटाते हैं, आपके अपने OS, CPU और GPU को बोनस मिलता है। निष्पक्ष समीक्षाएँ ज़रूरी',
      'Eleştirmenler işletim sistemini, CPU’yu ve dizüstülerin GPU’sunu puanlar: ucuz ya da eski bir OS ve zayıf bir CPU veya GPU puanı düşürür, kendi OS, CPU ve GPU’n bonus alır. Adil incelemeler gerekir',
      'Os críticos avaliam o sistema operacional, a CPU e a GPU dos notebooks: um SO barato ou desatualizado e uma CPU ou GPU fraca baixam a nota, seu próprio SO, CPU e GPU ganham bônus. Requer Análises justas',
      'Оглядачі оцінюють операційну систему, CPU і GPU ноутбуків: дешева чи застаріла ОС і слабкий CPU чи GPU знижують оцінку, ваші власні ОС, CPU і GPU отримують бонус. Потрібні «Чесні огляди»',
      'Pengulas menilai sistem operasi, CPU, dan GPU laptop: OS murah atau usang dan CPU atau GPU lemah menurunkan nilai, OS, CPU, dan GPU buatanmu mendapat bonus. Memerlukan Ulasan adil',
      'Recenzenci oceniają system operacyjny, CPU i GPU laptopów: tani lub przestarzały system i słaby CPU lub GPU obniżają ocenę, własny system, CPU i GPU dostają premię. Wymaga Uczciwych recenzji',
      '评测者会给操作系统、CPU 和笔记本的 GPU 打分：便宜或过时的系统和较弱的 CPU 或 GPU 会拉低评分，自研系统、CPU 和 GPU 有加分。需要「公正评测」',
      '리뷰어가 운영체제, CPU, 노트북 GPU를 평가합니다. 저렴하거나 오래된 OS와 약한 CPU나 GPU는 점수를 낮추고, 자체 OS, CPU, GPU는 보너스를 받습니다. 공정한 리뷰 필요',
      'レビュアーがOS、CPU、ノートPCのGPUを評価します。安価・旧式のOSや非力なCPU・GPUは評価を下げ、自社OS・CPU・GPUにはボーナス。公正なレビューが必要'],
    'own-chip-savings': ['Own CPU/GPU savings', 'Экономия на своих CPU/GPU', 'Ersparnis eigener CPU/GPU', 'Économies des CPU/GPU maison', 'Risparmio di CPU/GPU propri',
      'Ahorro de CPU/GPU propios', 'अपने CPU/GPU से बचत', 'Kendi CPU/GPU tasarrufu', 'Economia de CPU/GPU próprios', 'Економія на власних CPU/GPU', 'Penghematan CPU/GPU sendiri',
      'Oszczędność na własnych CPU/GPU', '自研 CPU/GPU 节省', '자체 CPU/GPU 절감', '自社CPU/GPUの節約'],
    'own-chip-savings.d': ['Your own CPU or GPU makes a device cheaper to build. Part of the saving can go into the price without buyers and reviewers taking it as overpriced',
      'Собственный CPU или GPU удешевляет производство устройства. Часть экономии можно заложить в цену, и покупатели с обозревателями не сочтут её завышенной',
      'Eine eigene CPU oder GPU macht die Herstellung billiger. Ein Teil der Ersparnis darf in den Preis, ohne dass Käufer und Tester ihn als überteuert ansehen',
      'Un CPU ou un GPU maison rend l’appareil moins cher à produire. Une partie de l’économie peut passer dans le prix sans que les acheteurs et les testeurs le jugent trop cher',
      'Una CPU o una GPU propria rende il dispositivo più economico da produrre. Parte del risparmio può finire nel prezzo senza che acquirenti e recensori lo considerino troppo caro',
      'Una CPU o una GPU propia abarata la fabricación. Parte del ahorro puede ir al precio sin que compradores ni críticos lo consideren caro',
      'आपका अपना CPU या GPU डिवाइस बनाना सस्ता करता है। बचत का कुछ हिस्सा कीमत में जा सकता है, खरीदार और समीक्षक इसे महंगा नहीं मानेंगे',
      'Kendi CPU veya GPU’n cihazın üretimini ucuzlatır. Tasarrufun bir kısmı fiyata eklenebilir; alıcılar ve eleştirmenler pahalı bulmaz',
      'Uma CPU ou GPU própria barateia a produção. Parte da economia pode ir para o preço sem que compradores e críticos o achem caro',
      'Власний CPU чи GPU здешевлює виробництво пристрою. Частину економії можна закласти в ціну, і покупці з оглядачами не вважатимуть її завищеною',
      'CPU atau GPU buatanmu membuat perangkat lebih murah diproduksi. Sebagian penghematan bisa masuk ke harga tanpa pembeli dan pengulas menganggapnya kemahalan',
      'Własny CPU lub GPU obniża koszt produkcji. Część oszczędności może trafić do ceny, a kupujący i recenzenci nie uznają jej za zawyżoną',
      '自研 CPU 或 GPU 能降低设备的生产成本。部分节省可以计入售价，买家和评测者不会觉得定价过高',
      '자체 CPU나 GPU는 기기 생산비를 낮춥니다. 절감액 일부를 가격에 반영해도 구매자와 리뷰어가 비싸다고 여기지 않습니다',
      '自社CPUやGPUで製造コストが下がります。節約分の一部を価格に乗せても、購入者やレビュアーに割高とは見なされません'],
    'dev-inspector': ['Inspector (for modders)', 'Инспектор (для моддеров)', 'Inspektor (für Modder)', 'Inspecteur (pour moddeurs)',
      'Ispettore (per modder)', 'Inspector (para modders)', 'इंस्पेक्टर (मॉडर्स के लिए)', 'Denetçi (mod yapımcıları için)',
      'Inspetor (para modders)', 'Інспектор (для моддерів)', 'Inspektor (untuk modder)', 'Inspektor (dla modderów)',
      '检查器（供模组作者使用）', '인스펙터 (모더용)', 'インスペクター（MOD作者向け）'],
    'dev-inspector.d': ['F9 shows what is under the cursor: object type, UID, layer, position, variables. Ctrl+C copies it for a mod',
      'F9 показывает, что под курсором: тип объекта, UID, слой, позицию, переменные. Ctrl+C копирует это для мода',
      'F9 zeigt, was unter dem Mauszeiger ist: Objekttyp, UID, Ebene, Position, Variablen. Strg+C kopiert es für einen Mod',
      'F9 montre ce qui est sous le curseur : type d’objet, UID, calque, position, variables. Ctrl+C le copie pour un mod',
      'F9 mostra cosa c’è sotto il cursore: tipo di oggetto, UID, livello, posizione, variabili. Ctrl+C lo copia per una mod',
      'F9 muestra lo que hay bajo el cursor: tipo de objeto, UID, capa, posición, variables. Ctrl+C lo copia para un mod',
      'F9 दिखाता है कि कर्सर के नीचे क्या है: ऑब्जेक्ट प्रकार, UID, लेयर, स्थिति, वेरिएबल। Ctrl+C इसे मॉड के लिए कॉपी करता है',
      'F9 imlecin altındakini gösterir: nesne türü, UID, katman, konum, değişkenler. Ctrl+C bunu bir mod için kopyalar',
      'F9 mostra o que está sob o cursor: tipo de objeto, UID, camada, posição, variáveis. Ctrl+C copia para um mod',
      'F9 показує, що під курсором: тип об’єкта, UID, шар, позицію, змінні. Ctrl+C копіює це для мода',
      'F9 menampilkan apa yang ada di bawah kursor: jenis objek, UID, lapisan, posisi, variabel. Ctrl+C menyalinnya untuk mod',
      'F9 pokazuje, co jest pod kursorem: typ obiektu, UID, warstwę, pozycję, zmienne. Ctrl+C kopiuje to dla moda',
      'F9 显示光标下的内容：对象类型、UID、图层、位置、变量。Ctrl+C 复制给模组使用',
      'F9로 커서 아래의 객체 유형, UID, 레이어, 위치, 변수를 표시합니다. Ctrl+C로 모드용으로 복사합니다',
      'F9でカーソルの下にあるもの（オブジェクトの種類、UID、レイヤー、位置、変数）を表示。Ctrl+CでMOD用にコピー'],
    'custom-start': ['Custom start',
      'Свой старт',
      'Eigener Start',
      'Départ libre',
      'Inizio libero',
      'Inicio libre',
      'अपनी शुरुआत',
      'Özel başlangıç',
      'Início livre',
      'Свій старт',
      'Mulai bebas',
      'Własny start',
      '自定义开局',
      '사용자 시작',
      'カスタム開始'],
    'custom-start.d': ['NEW GAME: start in any month and year; research and rivals are set between the game\'s start years',
      'НОВАЯ ИГРА: старт в любом месяце и году; исследования и конкуренты — между стартовыми годами игры',
      'NEUES SPIEL: Start in jedem Monat und Jahr; Forschung und Konkurrenz liegen zwischen den Startjahren des Spiels',
      'NOUVELLE PARTIE : départ à n\'importe quel mois et année ; recherche et rivaux entre les années de départ du jeu',
      'NUOVA PARTITA: inizio in qualsiasi mese e anno; ricerca e rivali tra gli anni di partenza del gioco',
      'NUEVA PARTIDA: empieza en cualquier mes y año; investigación y rivales entre los años de inicio del juego',
      'नया गेम: किसी भी महीने और साल में शुरू करें; रिसर्च और प्रतिद्वंद्वी गेम के शुरुआती सालों के बीच',
      'YENİ OYUN: herhangi bir ay ve yılda başla; araştırma ve rakipler oyunun başlangıç yılları arasında',
      'NOVO JOGO: comece em qualquer mês e ano; pesquisa e rivais entre os anos iniciais do jogo',
      'НОВА ГРА: старт у будь-якому місяці й році; дослідження й конкуренти — між стартовими роками гри',
      'GAME BARU: mulai di bulan dan tahun apa saja; riset dan pesaing di antara tahun awal game',
      'NOWA GRA: start w dowolnym miesiącu i roku; badania i rywale pomiędzy latami startowymi gry',
      '新游戏：可在任意年月开局；研究和对手介于游戏的起始年份之间',
      '새 게임: 아무 연월에서나 시작; 연구와 경쟁사는 게임의 시작 연도 사이로 맞춰집니다',
      'ニューゲーム：好きな年月から開始。研究とライバルはゲームの開始年の間に調整'],
    'country-effects': ['Country effects',
      'Эффекты страны',
      'Ländereffekte',
      'Effets du pays',
      'Effetti del paese',
      'Efectos del país',
      'देश के प्रभाव',
      'Ülke etkileri',
      'Efeitos do país',
      'Ефекти країни',
      'Efek negara',
      'Efekty kraju',
      '国家效果',
      '국가 효과',
      '国の効果'],
    'country-effects.d': ['The company\'s country: lower cost of production = lower salaries, more international trade = more sales',
      'Страна компании: ниже стоимость производства = ниже зарплаты, больше международной торговли = больше продаж',
      'Land der Firma: niedrigere Herstellungskosten = niedrigere Gehälter, mehr internationaler Handel = mehr Verkäufe',
      'Pays de l\'entreprise : coût de production plus bas = salaires plus bas, plus de commerce international = plus de ventes',
      'Paese dell\'azienda: costo di produzione più basso = stipendi più bassi, più commercio internazionale = più vendite',
      'País de la empresa: menor costo de producción = salarios más bajos, más comercio internacional = más ventas',
      'कंपनी का देश: कम उत्पादन लागत = कम वेतन, ज़्यादा अंतरराष्ट्रीय व्यापार = ज़्यादा बिक्री',
      'Şirketin ülkesi: daha düşük üretim maliyeti = daha düşük maaşlar, daha fazla uluslararası ticaret = daha çok satış',
      'País da empresa: menor custo de produção = salários menores, mais comércio internacional = mais vendas',
      'Країна компанії: нижча вартість виробництва = нижчі зарплати, більше міжнародної торгівлі = більше продажів',
      'Negara perusahaan: biaya produksi lebih rendah = gaji lebih rendah, perdagangan internasional lebih tinggi = penjualan lebih banyak',
      'Kraj firmy: niższy koszt produkcji = niższe pensje, więcej handlu międzynarodowego = większa sprzedaż',
      '公司所在国家：生产成本越低工资越低，国际贸易越高销量越多',
      '회사 국가: 생산 비용이 낮을수록 급여가 낮고, 국제 무역이 높을수록 판매가 늘어납니다',
      '会社の国：生産コストが低いほど給与が安く、国際貿易が高いほど販売が増える'],
    'country-picker': ['Country picker',
      'Выбор страны',
      'Länderauswahl',
      'Choix du pays',
      'Scelta del paese',
      'Elección de país',
      'देश चुनना',
      'Ülke seçimi',
      'Escolha do país',
      'Вибір країни',
      'Pilih negara',
      'Wybór kraju',
      '国家选择',
      '국가 선택',
      '国の選択'],
    'country-picker.d': ['NEW GAME: country cards show tax, research and effects; sort by what you need, the best three get a star',
      'НОВАЯ ИГРА: на карточках стран налог, исследования и эффекты; сортировка по нужному, лучшие три со звездой',
      'NEUES SPIEL: Länderkarten zeigen Steuer, Forschung und Effekte; nach Bedarf sortieren, die besten drei mit Stern',
      'NOUVELLE PARTIE : les cartes des pays montrent impôt, recherche et effets ; tri selon vos besoins, les trois meilleurs étoilés',
      'NUOVA PARTITA: le schede dei paesi mostrano tasse, ricerca ed effetti; ordina come ti serve, i migliori tre con la stella',
      'NUEVA PARTIDA: las tarjetas de países muestran impuesto, investigación y efectos; ordena según lo que necesites, los tres mejores con estrella',
      'नया गेम: देश के कार्ड पर कर, रिसर्च और प्रभाव; ज़रूरत के हिसाब से क्रम, सबसे अच्छे तीन पर सितारा',
      'YENİ OYUN: ülke kartlarında vergi, araştırma ve etkiler; ihtiyaca göre sırala, en iyi üçü yıldızlı',
      'NOVO JOGO: os cartões dos países mostram imposto, pesquisa e efeitos; ordene pelo que precisa, os três melhores com estrela',
      'НОВА ГРА: на картках країн податок, дослідження й ефекти; сортування за потребою, найкращі три із зіркою',
      'GAME BARU: kartu negara menampilkan pajak, riset, dan efek; urutkan sesuai kebutuhan, tiga terbaik diberi bintang',
      'NOWA GRA: karty krajów pokazują podatek, badania i efekty; sortuj według potrzeb, trzy najlepsze z gwiazdką',
      '新游戏：国家卡片显示税率、研究和效果；按需求排序，前三名带星标',
      '새 게임: 국가 카드에 세금, 연구, 효과 표시; 필요에 맞게 정렬, 상위 3개에 별표',
      'ニューゲーム：国のカードに税率・研究・効果を表示。目的別に並べ替え、上位3つに星'],
    'fair-reviews': ['Fair reviews',
      'Честные обзоры',
      'Faire Testberichte',
      'Critiques équitables',
      'Recensioni eque',
      'Reseñas justas',
      'निष्पक्ष समीक्षाएँ',
      'Adil incelemeler',
      'Análises justas',
      'Чесні огляди',
      'Ulasan adil',
      'Uczciwe recenzje',
      '公正评测',
      '공정한 리뷰',
      '公正なレビュー'],
    'fair-reviews.d': ['The rating comes from all parts of a device. Reviews show its two best and two worst categories, with a breakdown of all of them',
      'Оценка складывается из всех компонентов устройства. Обзоры показывают две лучшие и две худшие категории и разбор всех категорий',
      'Die Wertung ergibt sich aus allen Bauteilen eines Geräts. Die Tests zeigen die zwei besten und zwei schlechtesten Kategorien und eine Übersicht aller',
      'La note vient de tous les composants de l\'appareil. Les critiques montrent ses deux meilleures et deux pires catégories, avec le détail de toutes',
      'Il voto deriva da tutti i componenti del dispositivo. Le recensioni mostrano le due categorie migliori e le due peggiori, con il dettaglio di tutte',
      'La nota sale de todos los componentes del dispositivo. Las reseñas muestran sus dos mejores y dos peores categorías, con el desglose de todas',
      'रेटिंग डिवाइस के सभी पार्ट्स से बनती है। समीक्षाएँ दो सबसे अच्छी और दो सबसे कमज़ोर श्रेणियाँ दिखाती हैं, साथ में सभी का ब्योरा',
      'Puan cihazın tüm parçalarından gelir. İncelemeler en iyi iki ve en kötü iki kategoriyi ve hepsinin dökümünü gösterir',
      'A nota vem de todos os componentes do aparelho. As análises mostram as duas melhores e as duas piores categorias, com o detalhe de todas',
      'Оцінка складається з усіх компонентів пристрою. Огляди показують дві найкращі й дві найгірші категорії та розбір усіх категорій',
      'Nilai berasal dari semua komponen perangkat. Ulasan menampilkan dua kategori terbaik dan dua terburuk, beserta rincian semuanya',
      'Ocena wynika ze wszystkich podzespołów urządzenia. Recenzje pokazują dwie najlepsze i dwie najgorsze kategorie oraz rozbicie wszystkich',
      '评分来自设备的所有部件。评测显示最好的两项和最差的两项，并列出所有类别的明细',
      '평점은 기기의 모든 부품으로 정해집니다. 리뷰는 가장 좋은 두 항목과 가장 나쁜 두 항목을 보여 주고, 모든 항목의 내역도 표시합니다',
      '評価はデバイスの全パーツから決まります。レビューは最も良い2項目と悪い2項目を示し、全項目の内訳も表示します'],
    'research-breakthroughs': ['Research breakthroughs',
      'Прорывы в исследованиях',
      'Forschungsdurchbrüche',
      'Percées scientifiques',
      'Svolte nella ricerca',
      'Avances en investigación',
      'रिसर्च में बड़ी सफलताएँ',
      'Araştırma atılımları',
      'Avanços na pesquisa',
      'Прориви в дослідженнях',
      'Terobosan riset',
      'Przełomy w badaniach',
      '研究突破',
      '연구 돌파구',
      '研究のブレークスルー'],
    'research-breakthroughs.d': ['A finished lab project can research parts up to a year early. Innovative devices get better reviews and sell more',
      'Завершённый проект лаборатории может открыть компоненты на год раньше. Инновационные устройства получают лучшие обзоры и продаются лучше',
      'Ein abgeschlossenes Laborprojekt kann Bauteile bis zu einem Jahr früher erforschen. Innovative Geräte bekommen bessere Tests und verkaufen sich besser',
      'Un projet de labo terminé peut rechercher des composants jusqu\'à un an plus tôt. Les appareils innovants ont de meilleures critiques et se vendent mieux',
      'Un progetto di laboratorio concluso può ricercare componenti fino a un anno prima. I dispositivi innovativi ricevono recensioni migliori e vendono di più',
      'Un proyecto de laboratorio terminado puede investigar componentes hasta un año antes. Los dispositivos innovadores reciben mejores reseñas y venden más',
      'पूरा हुआ लैब प्रोजेक्ट पार्ट्स को एक साल तक पहले रिसर्च कर सकता है। इनोवेटिव डिवाइस को बेहतर समीक्षाएँ और ज़्यादा बिक्री मिलती है',
      'Biten bir laboratuvar projesi parçaları bir yıla kadar erken araştırabilir. Yenilikçi cihazlar daha iyi inceleme alır ve daha çok satar',
      'Um projeto de laboratório concluído pode pesquisar componentes até um ano antes. Aparelhos inovadores recebem análises melhores e vendem mais',
      'Завершений проєкт лабораторії може відкрити компоненти на рік раніше. Інноваційні пристрої отримують кращі огляди й продаються краще',
      'Proyek lab yang selesai bisa meriset komponen hingga setahun lebih awal. Perangkat inovatif mendapat ulasan lebih baik dan lebih laris',
      'Ukończony projekt laboratorium może zbadać podzespoły nawet rok wcześniej. Innowacyjne urządzenia dostają lepsze recenzje i lepiej się sprzedają',
      '完成的实验室项目可以提前最多一年研究出部件。创新设备评测更好、销量更高',
      '완료된 연구소 프로젝트는 부품을 최대 1년 일찍 연구할 수 있습니다. 혁신적인 기기는 더 좋은 리뷰를 받고 더 많이 팔립니다',
      '完了したラボのプロジェクトはパーツを最大1年早く研究できます。革新的なデバイスはレビューが良くなり、よく売れます'],
    'lab-invest': ['Bigger lab investments', 'Крупные вложения в лабораторию', 'Größere Laborinvestitionen', 'Investissements de labo plus gros',
      'Investimenti di laboratorio più grandi', 'Inversiones de laboratorio mayores', 'बड़े लैब निवेश', 'Daha büyük laboratuvar yatırımları',
      'Investimentos maiores no laboratório', 'Більші вкладення в лабораторію', 'Investasi lab lebih besar', 'Większe inwestycje w laboratorium',
      '更大的实验室投资', '더 큰 연구소 투자', 'より大きなラボ投資'],
    'lab-invest.d': ['RESEARCH LAB: invest up to $1B in a project instead of $25M; over $25M every doubling gives 25 % more points',
      'ЛАБОРАТОРИЯ: вкладывайте в проект до $1 млрд вместо $25 млн; выше $25 млн каждое удвоение даёт на 25 % больше очков',
      'FORSCHUNGSLABOR: bis zu 1 Mrd. $ statt 25 Mio. $ in ein Projekt; über 25 Mio. $ bringt jede Verdopplung 25 % mehr Punkte',
      'LABO : investissez jusqu’à 1 Md $ par projet au lieu de 25 M $ ; au-delà de 25 M $, chaque doublement donne 25 % de points en plus',
      'LABORATORIO: investi fino a 1 mld $ in un progetto invece di 25 mln $; oltre 25 mln $ ogni raddoppio dà il 25 % di punti in più',
      'LABORATORIO: invierte hasta 1000 M$ en un proyecto en vez de 25 M$; por encima de 25 M$ cada duplicación da un 25 % más de puntos',
      'रिसर्च लैब: एक प्रोजेक्ट में $25M की जगह $1B तक निवेश करें; $25M से ऊपर हर दोगुना करने पर 25 % ज़्यादा अंक',
      'ARAŞTIRMA LABORATUVARI: bir projeye 25 M$ yerine 1 milyar $’a kadar yatırın; 25 M$ üstünde her ikiye katlama %25 daha fazla puan verir',
      'LABORATÓRIO: invista até US$ 1 bi em um projeto em vez de US$ 25 mi; acima de US$ 25 mi cada dobro dá 25 % mais pontos',
      'ЛАБОРАТОРІЯ: вкладайте в проєкт до $1 млрд замість $25 млн; понад $25 млн кожне подвоєння дає на 25 % більше очок',
      'LAB RISET: investasikan hingga $1 miliar per proyek, bukan $25 juta; di atas $25 juta setiap kelipatan dua memberi 25 % poin lebih',
      'LABORATORIUM: inwestuj w projekt do 1 mld $ zamiast 25 mln $; powyżej 25 mln $ każde podwojenie daje 25 % więcej punktów',
      '研究实验室：每个项目最多可投资 10 亿美元，而不是 2500 万；超过 2500 万后，每翻一倍点数多 25 %',
      '연구소: 프로젝트에 2,500만 달러 대신 최대 10억 달러까지 투자; 2,500만 달러를 넘으면 두 배마다 포인트 25 % 증가',
      '研究所：1 プロジェクトに 2500 万ドルではなく最大 10 億ドルまで投資できます。2500 万ドルを超えると、2 倍ごとにポイントが 25 % 増えます'],
    'steady-hover': ['Steady hover', 'Устойчивое наведение', 'Ruhiges Hovern', 'Survol stable', 'Hover stabile', 'Hover estable',
      'स्थिर होवर', 'Sabit üzerine gelme', 'Hover estável', 'Стійке наведення', 'Hover stabil', 'Stabilne najechanie', '稳定悬停',
      '안정적인 호버', '安定したホバー'],
    'steady-hover.d': ['Editor labels no longer shake when the cursor is on their first letters',
      'Подписи в редакторах больше не дрожат, когда курсор на первых буквах',
      'Beschriftungen im Editor zittern nicht mehr, wenn der Cursor auf den ersten Buchstaben ist',
      'Les libellés des éditeurs ne tremblent plus quand le curseur est sur leurs premières lettres',
      'Le etichette degli editor non tremano più quando il cursore è sulle prime lettere',
      'Las etiquetas de los editores ya no tiemblan con el cursor sobre sus primeras letras',
      'कर्सर पहले अक्षरों पर हो तो एडिटर के लेबल अब नहीं काँपते',
      'İmleç ilk harflerdeyken editör etiketleri artık titremiyor',
      'Os rótulos dos editores não tremem mais com o cursor nas primeiras letras',
      'Підписи в редакторах більше не тремтять, коли курсор на перших літерах',
      'Label editor tidak lagi bergetar saat kursor di huruf pertamanya',
      'Etykiety w edytorach nie drgają już, gdy kursor jest na pierwszych literach',
      '光标停在编辑器标签开头时，文字不再抖动',
      '커서가 첫 글자에 있을 때 편집기 라벨이 더 이상 떨리지 않습니다',
      'カーソルが先頭の文字にあってもエディターのラベルが震えなくなります'],
    'list-search': ['Search and scroll bars', 'Поиск и полосы прокрутки', 'Suche und Bildlaufleisten', 'Recherche et barres de défilement',
      'Ricerca e barre di scorrimento', 'Búsqueda y barras de desplazamiento', 'खोज और स्क्रॉल बार', 'Arama ve kaydırma çubukları',
      'Pesquisa e barras de rolagem', 'Пошук і смуги прокрутки', 'Pencarian dan bilah gulir', 'Wyszukiwanie i paski przewijania',
      '搜索和滚动条', '검색과 스크롤바', '検索とスクロールバー'],
    'list-search.d': ['RESEARCH: search all tabs, a scroll bar for the tabs. INVESTING: find a company, a scroll bar for the list',
      'ИССЛЕДОВАНИЯ: поиск по всем вкладкам, полоса прокрутки вкладок. ИНВЕСТИЦИИ: поиск компании, полоса прокрутки списка',
      'FORSCHUNG: Suche über alle Tabs, Bildlaufleiste für die Tabs. INVESTIEREN: Firma suchen, Bildlaufleiste für die Liste',
      'RECHERCHE : chercher dans tous les onglets, barre de défilement des onglets. INVESTIR : trouver une société, barre de défilement de la liste',
      'RICERCA: cerca in tutte le schede, barra di scorrimento delle schede. INVESTIMENTI: trova un’azienda, barra di scorrimento della lista',
      'INVESTIGACIÓN: buscar en todas las pestañas, barra de desplazamiento de pestañas. INVERSIÓN: buscar una empresa, barra de desplazamiento de la lista',
      'रिसर्च: सभी टैब में खोज, टैब के लिए स्क्रॉल बार। निवेश: कंपनी खोजें, सूची के लिए स्क्रॉल बार',
      'ARAŞTIRMA: tüm sekmelerde ara, sekmeler için kaydırma çubuğu. YATIRIM: şirket bul, liste için kaydırma çubuğu',
      'PESQUISA: buscar em todas as abas, barra de rolagem das abas. INVESTIMENTO: encontrar uma empresa, barra de rolagem da lista',
      'ДОСЛІДЖЕННЯ: пошук у всіх вкладках, смуга прокрутки вкладок. ІНВЕСТИЦІЇ: пошук компанії, смуга прокрутки списку',
      'RISET: cari di semua tab, bilah gulir untuk tab. INVESTASI: cari perusahaan, bilah gulir untuk daftar',
      'BADANIA: szukaj we wszystkich kartach, pasek przewijania kart. INWESTYCJE: znajdź firmę, pasek przewijania listy',
      '研究：在所有分页中搜索，分页列表加滚动条。投资：查找公司，公司列表加滚动条',
      '연구: 모든 탭에서 검색, 탭 목록 스크롤바. 투자: 회사 찾기, 목록 스크롤바',
      '研究：全タブを検索、タブ一覧にスクロールバー。投資：会社を検索、一覧にスクロールバー'],
    'auto-continue': ['Auto continue',
      'Автопродолжение',
      'Automatisch weiter',
      'Continuer auto',
      'Continua auto',
      'Continuar auto',
      'स्वतः जारी',
      'Otomatik devam',
      'Continuar auto',
      'Автопродовження',
      'Lanjut otomatis',
      'Auto dalej',
      '自动继续',
      '자동 계속',
      '自動で続行'],
    'auto-continue.d': ['NEWS: a checkbox next to OK closes news with a single OK by itself, a few seconds after the text is typed',
      'НОВОСТИ: галочка рядом с OK сама закрывает новости с одной кнопкой OK через несколько секунд после вывода текста',
      'NEWS: ein Häkchen neben OK schließt Nachrichten mit nur OK von selbst, einige Sekunden nach dem Text',
      'NEWS : une case à côté de OK ferme seule les nouvelles à un seul bouton OK, quelques secondes après le texte',
      'NEWS: una casella accanto a OK chiude da sola le notizie con un solo OK, pochi secondi dopo il testo',
      'NEWS: una casilla junto a OK cierra sola las noticias con un único OK, unos segundos después del texto',
      'NEWS: OK के पास का चेकबॉक्स केवल OK वाली खबरों को टेक्स्ट के कुछ सेकंड बाद अपने आप बंद करता है',
      'NEWS: OK yanındaki kutu, tek OK düğmeli haberleri metinden birkaç saniye sonra kendiliğinden kapatır',
      'NEWS: uma caixa ao lado de OK fecha sozinha as notícias com um único OK, alguns segundos após o texto',
      'НОВИНИ: позначка біля OK сама закриває новини з однією кнопкою OK за кілька секунд після тексту',
      'NEWS: kotak centang di samping OK menutup berita dengan satu OK sendiri, beberapa detik setelah teks',
      'NEWS: pole obok OK samo zamyka wiadomości z jednym OK kilka sekund po wypisaniu tekstu',
      'NEWS：OK 旁的复选框会在文字显示完几秒后自动关闭只有 OK 的新闻',
      'NEWS: OK 옆 체크박스가 OK 하나뿐인 뉴스를 글이 다 나온 뒤 몇 초 후 자동으로 닫습니다',
      'NEWS：OK の横のチェックで、OK だけのニュースを文字表示の数秒後に自動で閉じます'],
    'auto-continue.on': ['Close news with a single OK by itself',
      'Закрывать новости с одной кнопкой OK автоматически',
      'Nachrichten mit nur OK von selbst schließen',
      'Fermer seules les nouvelles à un seul OK',
      'Chiudi da solo le notizie con un solo OK',
      'Cerrar solas las noticias con un único OK',
      'केवल OK वाली खबरें अपने आप बंद करें',
      'Tek OK düğmeli haberleri kendiliğinden kapat',
      'Fechar sozinho as notícias com um único OK',
      'Закривати новини з однією кнопкою OK автоматично',
      'Tutup berita dengan satu OK otomatis',
      'Zamykaj same wiadomości z jednym OK',
      '自动关闭只有 OK 的新闻',
      'OK 하나뿐인 뉴스 자동으로 닫기',
      'OK だけのニュースを自動で閉じる'],
    'auto-continue.secs': ['Seconds before OK',
      'Секунд до OK',
      'Sekunden bis OK',
      'Secondes avant OK',
      'Secondi prima di OK',
      'Segundos antes de OK',
      'OK से पहले सेकंड',
      'OK\'den önce saniye',
      'Segundos antes do OK',
      'Секунд до OK',
      'Detik sebelum OK',
      'Sekundy do OK',
      'OK 前的秒数',
      'OK 전 초',
      'OK までの秒数'],
    'no-ending': ['Endless game', 'Бесконечная игра', 'Endloses Spiel', 'Partie sans fin', 'Partita infinita', 'Partida infinita',
      'अंतहीन खेल', 'Sonsuz oyun', 'Jogo infinito', 'Нескінченна гра', 'Permainan tanpa akhir', 'Gra bez końca', '无尽模式', '끝없는 게임', 'エンドレスゲーム'],
    'no-ending.d': ['Keep playing after the end of the game in 2101', 'Играть дальше после конца игры в 2101 году',
      'Nach dem Spielende 2101 weiterspielen', 'Continuer à jouer après la fin du jeu en 2101', 'Continua a giocare dopo la fine del gioco nel 2101',
      'Seguir jugando tras el final del juego en 2101', '2101 में खेल खत्म होने के बाद भी खेलते रहें', '2101’deki oyun sonundan sonra oynamaya devam et',
      'Continuar jogando depois do fim do jogo em 2101', 'Грати далі після кінця гри у 2101 році', 'Terus bermain setelah game berakhir di 2101',
      'Graj dalej po końcu gry w 2101 roku', '在 2101 年游戏结束后继续游玩', '2101년 게임 종료 후에도 계속 플레이', '2101年のゲーム終了後もプレイを続ける'],
    'no-ending.skip': ['Skip the final screen', 'Пропустить финальный экран', 'Abschlussbildschirm überspringen', "Passer l'écran final",
      'Salta la schermata finale', 'Omitir la pantalla final', 'अंतिम स्क्रीन छोड़ें', 'Son ekranı atla', 'Pular a tela final', 'Пропустити фінальний екран',
      'Lewati layar akhir', 'Pomiń ekran końcowy', '跳过结束画面', '마지막 화면 건너뛰기', '最終画面をスキップ'],
    'real-names': ['Real company names', 'Настоящие названия компаний', 'Echte Firmennamen', "Vrais noms d'entreprises",
      'Nomi reali delle aziende', 'Nombres reales de empresas', 'असली कंपनी नाम', 'Gerçek şirket adları', 'Nomes reais das empresas',
      'Справжні назви компаній', 'Nama perusahaan asli', 'Prawdziwe nazwy firm', '真实公司名称', '실제 회사 이름', '実在の会社名'],
    'real-names.d': ['Other companies get their real names (Sony, Intel, …)', 'Другие компании получают настоящие названия (Sony, Intel, …)',
      'Andere Firmen bekommen ihre echten Namen (Sony, Intel, …)', "Les autres entreprises prennent leur vrai nom (Sony, Intel, …)",
      'Le altre aziende hanno i loro nomi reali (Sony, Intel, …)', 'Las demás empresas reciben sus nombres reales (Sony, Intel, …)',
      'दूसरी कंपनियों को उनके असली नाम मिलते हैं (Sony, Intel, …)', 'Diğer şirketler gerçek adlarını alır (Sony, Intel, …)',
      'As outras empresas recebem seus nomes reais (Sony, Intel, …)', 'Інші компанії отримують справжні назви (Sony, Intel, …)',
      'Perusahaan lain memakai nama aslinya (Sony, Intel, …)', 'Inne firmy dostają prawdziwe nazwy (Sony, Intel, …)',
      '其他公司使用真实名称（Sony、Intel……）', '다른 회사들이 실제 이름을 사용합니다 (Sony, Intel, …)', '他の会社が実在の名前になります（Sony、Intel など）'],
    'store-upgrade-all': ['All stores to max',
      'Все магазины на максимум',
      'Alle Läden aufs Maximum',
      'Tous les magasins au maximum',
      'Tutti i negozi al massimo',
      'Todas las tiendas al máximo',
      'सभी स्टोर अधिकतम तक',
      'Tüm mağazalar maksimuma',
      'Todas as lojas ao máximo',
      'Усі магазини на максимум',
      'Semua toko ke maksimal',
      'Wszystkie sklepy na maksa',
      '所有门店升到最高',
      '모든 매장 최대로',
      '全店舗を最大まで'],
    'store-upgrade-all.d': ['MY STORES: next to the game\'s "Upgrade all", "All to max" upgrades every store again and again while the money lasts',
      'МОИ МАГАЗИНЫ: рядом с «Улучшить все» игры кнопка «Всё на максимум» улучшает все магазины снова и снова, пока хватает денег',
      'MEINE LÄDEN: neben „Alle verbessern“ des Spiels verbessert „Alles aufs Maximum“ alle Läden immer wieder, solange das Geld reicht',
      'MES MAGASINS : à côté de « Tout améliorer » du jeu, « Tout au maximum » améliore tous les magasins encore et encore tant que l’argent suffit',
      'I MIEI NEGOZI: accanto a «Migliora tutto» del gioco, «Tutto al massimo» migliora tutti i negozi più volte finché bastano i soldi',
      'MIS TIENDAS: junto a «Mejorar todo» del juego, «Todo al máximo» mejora todas las tiendas una y otra vez mientras alcance el dinero',
      'मेरे स्टोर: गेम के "सभी अपग्रेड करें" के बगल में "सब अधिकतम तक" पैसे रहने तक सभी स्टोर बार-बार अपग्रेड करता है',
      'MAĞAZALARIM: oyunun "Tümünü geliştir" düğmesinin yanında "Hepsi maksimuma" para yettikçe tüm mağazaları tekrar tekrar geliştirir',
      'MINHAS LOJAS: ao lado de "Melhorar tudo" do jogo, "Tudo no máximo" melhora todas as lojas várias vezes enquanto houver dinheiro',
      'МОЇ МАГАЗИНИ: поруч із «Покращити все» гри кнопка «Усе на максимум» покращує всі магазини знову і знову, поки вистачає грошей',
      'TOKO SAYA: di samping "Tingkatkan semua" dari game, "Semua ke maksimal" meningkatkan semua toko berulang kali selama uang cukup',
      'MOJE SKLEPY: obok „Ulepsz wszystko” z gry „Wszystko na maksa” ulepsza wszystkie sklepy raz za razem, dopóki starcza pieniędzy',
      '我的门店：在游戏的“全部升级”旁，“全部升到最高”会在资金足够时反复升级所有门店',
      '내 매장: 게임의 "모두 업그레이드" 옆의 "모두 최대로"가 돈이 허락하는 한 모든 매장을 계속 업그레이드합니다',
      'マイストア：ゲームの「すべてアップグレード」の隣の「すべて最大まで」が、資金が続く限り全店舗を繰り返しアップグレードします'],
    'unlimited-shares': ['Unlimited shares', 'Неограниченные акции', 'Unbegrenzte Aktien', 'Actions illimitées', 'Azioni illimitate',
      'Acciones ilimitadas', 'असीमित शेयर', 'Sınırsız hisse', 'Ações ilimitadas', 'Необмежені акції', 'Saham tanpa batas', 'Nielimitowane akcje',
      '无限股票', '무제한 주식', '株の購入上限なし'],
    'unlimited-shares.d': ['INVESTING: buy as many shares as your money allows, up to the game\'s 49 % limit, in one purchase',
      'ИНВЕСТИЦИИ: покупайте столько акций, сколько позволяют деньги, до лимита игры 49 % за одну покупку',
      'INVESTITIONEN: so viele Aktien kaufen, wie das Geld erlaubt, bis zur Spielgrenze von 49 % in einem Kauf',
      'INVESTISSEMENTS : achetez autant d’actions que votre argent le permet, jusqu’à la limite de 49 % du jeu, en un seul achat',
      'INVESTIMENTI: compra tutte le azioni che i soldi consentono, fino al limite del 49 % del gioco, in un solo acquisto',
      'INVERSIONES: compra tantas acciones como permita tu dinero, hasta el límite del 49 % del juego, en una sola compra',
      'निवेश: जितने पैसे हों उतने शेयर खरीदें, गेम की 49 % सीमा तक, एक ही खरीद में',
      'YATIRIM: paranın yettiği kadar hisseyi, oyunun %49 sınırına kadar tek seferde al',
      'INVESTIMENTOS: compre quantas ações o dinheiro permitir, até o limite de 49 % do jogo, numa só compra',
      'ІНВЕСТИЦІЇ: купуйте стільки акцій, скільки дозволяють гроші, до ліміту гри 49 % за одну покупку',
      'INVESTASI: beli saham sebanyak yang uangmu mampu, sampai batas 49 % dari game, dalam satu pembelian',
      'INWESTYCJE: kupuj tyle akcji, na ile starcza pieniędzy, do limitu gry 49 %, w jednym zakupie',
      '投资：在一次购买中买入资金允许的全部股票，直到游戏的 49% 上限',
      '투자: 돈이 허락하는 만큼 주식을 한 번에 구매 (게임의 49% 한도까지)',
      '投資：資金の許す限りの株を、ゲームの上限 49% まで一度に購入'],
    'fixed-fps': ['Fixed FPS without slowdown, above 165',
      'Фиксированный FPS без замедления, выше 165',
      'Fester FPS-Wert ohne Verlangsamung, über 165',
      'FPS fixe sans ralentissement, au-delà de 165',
      'FPS fisso senza rallentamenti, oltre 165',
      'FPS fijo sin ralentización, por encima de 165',
      'फिक्स्ड FPS बिना धीमेपन के, 165 से ऊपर',
      'Yavaşlamadan sabit FPS, 165 üstü',
      'FPS fixo sem lentidão, acima de 165',
      'Фіксований FPS без уповільнення, понад 165',
      'FPS tetap tanpa melambat, di atas 165',
      'Stały FPS bez spowolnienia, powyżej 165',
      '固定帧率不变慢，可超过 165',
      '느려지지 않는 고정 FPS, 165 이상',
      '固定FPSでも遅くならず、165超も可能'],
    'fixed-fps.d': ['A high fixed FPS no longer slows the game down, so the game\'s 165 FPS limit can go higher',
      'Высокий фиксированный FPS больше не замедляет игру, поэтому лимит игры 165 FPS можно поднять',
      'Ein hoher fester FPS-Wert verlangsamt das Spiel nicht mehr, daher kann die Spielgrenze von 165 FPS höher sein',
      'Un FPS fixe élevé ne ralentit plus la partie, la limite de 165 FPS du jeu peut donc être dépassée',
      'Un FPS fisso alto non rallenta più il gioco, quindi il limite di 165 FPS del gioco può salire',
      'Un FPS fijo alto ya no ralentiza la partida, así que el límite de 165 FPS del juego puede subir',
      'ऊँचा फिक्स्ड FPS अब गेम को धीमा नहीं करता, इसलिए गेम की 165 FPS सीमा बढ़ाई जा सकती है',
      'Yüksek sabit FPS artık oyunu yavaşlatmıyor, bu yüzden oyunun 165 FPS sınırı aşılabilir',
      'Um FPS fixo alto não deixa mais o jogo lento, então o limite de 165 FPS do jogo pode subir',
      'Високий фіксований FPS більше не уповільнює гру, тож ліміт гри 165 FPS можна підняти',
      'FPS tetap yang tinggi tidak lagi memperlambat game, jadi batas 165 FPS dari game bisa dinaikkan',
      'Wysoki stały FPS nie spowalnia już gry, więc limit gry 165 FPS można podnieść',
      '高固定帧率不再让游戏变慢，因此可以突破游戏 165 FPS 的上限',
      '높은 고정 FPS가 더 이상 게임을 느리게 하지 않아 게임의 165 FPS 한도를 높일 수 있습니다',
      '高い固定FPSでもゲームが遅くならないので、ゲームの上限165 FPSを超えられます'],
    credit: ['Original mod by {n}', 'Автор оригинального мода: {n}', 'Ursprünglicher Mod von {n}', 'Mod original de {n}', 'Mod originale di {n}',
      'Mod original de {n}', 'मूल मॉड: {n}', 'Orijinal mod: {n}', 'Mod original de {n}', 'Автор оригінального мода: {n}', 'Mod asli oleh {n}',
      'Oryginalny mod: {n}', '原始模组作者：{n}', '원본 모드 제작: {n}', '元のMOD作者：{n}'],
    'autosave.days': ['Save every (game days)', 'Сохранять каждые (игровых дней)', 'Speichern alle (Spieltage)', 'Sauvegarder tous les (jours de jeu)',
      'Salva ogni (giorni di gioco)', 'Guardar cada (días de juego)', 'हर (गेम दिन) में सेव करें', 'Kaydetme aralığı (oyun günü)', 'Salvar a cada (dias de jogo)',
      'Зберігати кожні (ігрових днів)', 'Simpan setiap (hari game)', 'Zapisuj co (dni gry)', '每隔（游戏日）存档', '저장 주기 (게임 일)', 'セーブ間隔（ゲーム日）'],
    'fixed-fps.max': ['FPS when the game\'s limit is 165',
      'FPS, когда лимит игры 165',
      'FPS, wenn die Spielgrenze 165 ist',
      'FPS quand la limite du jeu est 165',
      'FPS quando il limite del gioco è 165',
      'FPS cuando el límite del juego es 165',
      'गेम की सीमा 165 होने पर FPS',
      'Oyunun sınırı 165 iken FPS',
      'FPS quando o limite do jogo é 165',
      'FPS, коли ліміт гри 165',
      'FPS saat batas game 165',
      'FPS, gdy limit gry to 165',
      '游戏上限为 165 时的帧率',
      '게임 한도가 165일 때 FPS',
      'ゲームの上限が165のときのFPS'],
  };
  const lang = () => { const n = Number(rt.globalVars.LanguageChoose); return n >= 0 && n < 15 ? n : 0; };
  const t = (k, vars) => {
    let s = (TXT[k] || [k])[lang()] || TXT[k][0];
    if (vars) for (const v in vars) s = s.replace('{' + v + '}', vars[v]);
    return s;
  };

  // per-mod options (key in betterdt.ini, type, default)
  const OPTIONS = {
    'hire-tools.js': [{ key: 'hire-tools.autoHire', type: 'bool', def: false }],
    'train-all.js': [{ key: 'train-all.mute', type: 'bool', def: true }],
    'autosave.js': [{ key: 'autosave.days', type: 'range', def: 90, min: 5, max: 360, step: 5 }],
    'fixed-fps.js': [{ key: 'fixed-fps.max', type: 'range', def: 165, min: 165, max: 360, step: 5 }],
    'low-end.js': [{ key: 'low-end.fps', type: 'bool', def: false }, { key: 'low-end.blur', type: 'bool', def: false }],
    'no-ending.js': [{ key: 'no-ending.skip', type: 'bool', def: false }],
    // the speeds the button cycles through after the game's ×1, ×1.25, ×1.5 (the label is the speed in every language)
    'game-speed.js': [2, 3, 4, 5, 6, 8, 10].map(v => ({ key: 'game-speed.x' + v, type: 'bool', def: v <= 3, label: '×' + v })),
    'auto-continue.js': [{ key: 'auto-continue.on', type: 'bool', def: false },
      { key: 'auto-continue.secs', type: 'range', def: 3, min: 1, max: 10, step: 1 }],
  };
  // mods that always load but stay idle until turned on: the mod's own switch sets this key (no restart needed)
  const SWITCH = { 'dev-inspector.js': { key: 'dev-inspector.on', def: false } };
  const modOn = (f) => (SWITCH[f] ? S.bool(SWITCH[f].key, SWITCH[f].def) : S.bool('mod.' + f, true));
  const setModOn = (f, v) => (SWITCH[f] ? save(SWITCH[f].key, v) : save('mod.' + f, v));
  // mods based on someone else's work: shown under the mod in the settings
  const CREDITS = { 'no-ending.js': 'M1lan.', 'unlimited-shares.js': 'M1lan.' };
  // what only takes effect after a restart: state at game start
  const boot = { gpu: S.bool('gpu', true) };
  for (const m of B.mods) boot['mod.' + m.file] = m.enabled;
  const needsRestart = () => {
    if (S.bool('gpu', true) !== boot.gpu) return true;
    for (const m of B.mods) if (S.bool('mod.' + m.file, true) !== boot['mod.' + m.file]) return true;
    return false;
  };

  const ICONS = {
    'bdt-general': 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z',
    'bdt-mods': 'M10 2a2 2 0 012 2v1h4a1 1 0 011 1v4h1a2 2 0 110 4h-1v4a1 1 0 01-1 1h-4v-1a2 2 0 10-4 0v1H4a1 1 0 01-1-1v-4h1a2 2 0 100-4H3V6a1 1 0 011-1h4V4a2 2 0 012-2z',
  };

  let root = null, nav = null, active = null, prevPage = null, navObs = null, poll = 0, savedFoot = null;

  const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
  const mask = (e, path) => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='" + path + "'/></svg>";
    const url = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
    e.style.webkitMaskImage = url; e.style.maskImage = url;
  };

  // ── navigation ────────────────────────────────────────────────────────────────────────────────
  function addNav() {
    if (!nav || nav.querySelector('.bdt-nav')) return;
    const head = el('div', 'gs-nav-group bdt-nav', nav);
    head.textContent = 'BetterDT';
    for (const p of PAGES) {
      const it = el('div', 'gs-nav-item bdt-nav' + (active === p ? ' gs-nav-on' : ''), nav);
      it.dataset.page = p;
      mask(el('div', 'gs-nav-ic', it), ICONS[p]);
      el('div', 'gs-nav-text', it).textContent = t(p === 'bdt-general' ? 'general' : 'mods');
    }
    if (active) for (const e of nav.querySelectorAll('.gs-nav-item:not(.bdt-nav)')) e.classList.remove('gs-nav-on');
  }

  function onNavClick(ev) {
    const it = ev.target.closest && ev.target.closest('.gs-nav-item');
    if (!it || !nav.contains(it)) return;
    const page = it.dataset.page;
    if (PAGES.includes(page)) {
      ev.stopPropagation();
      if (active === page) return;
      globalThis.tapMain?.();
      if (!active) {
        const on = nav.querySelector('.gs-nav-item.gs-nav-on:not(.bdt-nav)');
        prevPage = on ? on.dataset.page : prevPage;
        saveFoot();
      }
      active = page;
      for (const e of nav.querySelectorAll('.gs-nav-item')) e.classList.toggle('gs-nav-on', e === it);
      render();
      return;
    }
    if (!active) return;
    // leaving to a game page: the game itself only switches to a page other than its last one
    active = null;
    stopPoll();
    restoreFoot();
    if (page === prevPage) {
      ev.stopPropagation();
      globalThis.tapMain?.();
      try { globalThis.setGameSettingsPage?.(page) || globalThis.refreshGameSettingsPage?.(); } catch (e) { console.error(e); }
    }
  }

  // the game rebuilt the navigation (language change, Apply…) → add our group back, re-render our page
  function onNavRebuilt() {
    if (!nav.querySelector('.bdt-nav')) {
      addNav();
      if (active) render(true);
    }
  }

  // ── footer (status) ──────────────────────────────────────────────────────────────────────────
  function saveFoot() {
    const st = root.querySelector('.gs-status'), tx = root.querySelector('.gs-status-text');
    savedFoot = st && tx ? { cls: st.className, text: tx.textContent } : null;
  }
  function restoreFoot() {
    const st = root && root.querySelector('.gs-status'), tx = root && root.querySelector('.gs-status-text');
    if (st && tx && savedFoot) { st.className = savedFoot.cls; tx.textContent = savedFoot.text; }
    savedFoot = null;
  }
  let toastTimer = 0;
  function status(flash) {
    const st = root.querySelector('.gs-status'), tx = root.querySelector('.gs-status-text');
    if (!st || !tx) return;
    clearTimeout(toastTimer);
    const warn = needsRestart();
    const msg = flash && !warn ? t('saved') : warn ? t('restart') : '';
    tx.textContent = msg;
    st.classList.toggle('gs-status-ok', !!msg && !warn);
    st.classList.toggle('gs-status-warn', warn);
    st.classList.toggle('gs-status-idle', !msg);
    if (flash && !warn) toastTimer = setTimeout(() => { if (active) status(false); }, 1800);
  }

  // ── controls in the game's style ─────────────────────────────────────────────────────────────
  function row(card, name, hint) {
    const r = el('div', 'gs-row', card), l = el('div', 'gs-row-label', r);
    el('div', 'gs-row-name', l).textContent = name;
    if (hint) el('div', 'gs-row-hint', l).textContent = hint;
    return el('div', 'gs-row-ctl', r);
  }
  function sw(ctl, on, cb) {
    const s = el('div', 'gs-sw', ctl);
    const paint = () => s.classList.toggle('gs-sw-on', on);
    paint();
    s.addEventListener('click', () => { globalThis.tapTurn?.(); on = !on; paint(); cb(on); });
    return s;
  }
  function slider(ctl, min, max, step, val, cb) {
    const w = el('div', 'gs-slider', ctl), i = document.createElement('input');
    i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = val; i.className = 'gs-range';
    w.appendChild(i);
    const v = el('div', 'gs-slider-val', w);
    const paint = () => { v.textContent = i.value; i.style.setProperty('--fill', ((i.value - min) / (max - min) * 100).toFixed(2) + '%'); };
    paint();
    i.addEventListener('input', paint);
    i.addEventListener('change', () => cb(Number(i.value)));
    return i;
  }
  // one of several values: a row of the game's small buttons, the chosen one lit
  function choice(ctl, choices, val, cb) {
    const bs = choices.map(c => {
      const b = btn(ctl, c.label, () => { val = c.value; paint(); cb(c.value); });
      b.classList.add('bdt-choice');
      return b;
    });
    const paint = () => choices.forEach((c, i) => bs[i].classList.toggle('bdt-chosen', String(c.value) === String(val)));
    paint();
  }
  function btn(ctl, label, cb) {
    const b = el('div', 'gs-btn gs-btn-ghost', ctl);
    b.textContent = label;
    b.addEventListener('click', () => { if (b.classList.contains('gs-btn-off')) return; globalThis.tapMain?.(); cb(b); });
    return b;
  }
  const save = (k, v) => S.set(k, v).then(() => { if (active) status(true); }, (e) => console.error('[BetterDT] save', k, e));

  // ── pages ───────────────────────────────────────────────────────────────────────────────────
  function render(noAnim) {
    const head = root.querySelector('#gs-main-head'), body = root.querySelector('#gs-main-body');
    if (!head || !body) return;
    head.innerHTML = ''; body.innerHTML = ''; body.scrollTop = 0;
    const h = el('div', 'gs-h-row', head), ti = el('div', 'gs-h-titles', h);
    el('div', 'gs-h1', ti).textContent = active === 'bdt-general' ? 'BetterDT' : t('mods');
    el('div', 'gs-h-sub', ti).textContent = active === 'bdt-general' ? t('hint') : t('modsHint');
    if (active === 'bdt-general') renderGeneral(body); else renderMods(body);
    body.classList.remove('gs-anim');
    if (!noAnim) { void body.offsetWidth; body.classList.add('gs-anim'); }
    status(false);
  }

  let updRow = null;
  function renderGeneral(body) {
    const c1 = el('div', 'gs-card', body);
    const vctl = row(c1, t('version'));
    const isBeta = String(B.version).includes('-beta.');
    el('div', 'gs-row-hint bdt-val', vctl).textContent = 'v' + B.version + (isBeta ? ' (beta)' : '');
    btn(vctl, t('releases'), () => B.api('open', { what: 'github' }));
    // beta channel (channel=beta in betterdt.ini): updates also install betas (GitHub pre-releases)
    const bctl = row(c1, t('beta'), t('betaHint'));
    const paintBeta = (on) => {
      bctl.innerHTML = '';
      // out of the channel on a beta: go back to the latest official version (also an older one)
      if (!on && isBeta) btn(bctl, t('betaBack'), () => { B.api('check', { stable: 1 }).then(startPoll); });
      sw(bctl, on, (v) => {
        const saved = save('channel', v ? 'beta' : 'stable');
        paintBeta(v);
        // turned on: look for a beta right away, like "Check now" (after the setting is stored)
        if (v && S.bool('autoupdate', true)) saved.then(() => B.api('check')).then(startPoll);
      });
    };
    paintBeta(S.get('channel', '') === 'beta');
    el('div', 'gs-row-hint bdt-val', row(c1, t('gameVer'))).textContent = KIT ? KIT.gameVersion || '?' : '?';
    btn(row(c1, t('community'), t('communityHint')), 'Discord', () => B.api('open', { what: 'discord' }));

    sw(row(c1, t('autoUpdate'), t('autoUpdateHint')), S.bool('autoupdate', true), (on) => save('autoupdate', on));
    updRow = row(c1, t('updates')).parentNode;
    paintUpdate();

    const c2 = el('div', 'gs-card', body);
    sw(row(c2, t('gpu'), t('gpuHint')), S.bool('gpu', true), (on) => save('gpu', on));
    const fctl = row(c2, t('folder'));
    btn(fctl, t('log'), () => B.api('open', { what: 'log' }));
    btn(fctl, t('open'), () => B.api('open', { what: 'folder' }));
  }

  function updText(u) {
    const v = u.latest || '';
    switch (u.state) {
      case 'checking': return t('checking');
      case 'uptodate': return t('uptodate');
      case 'available': return t('available', { v });
      case 'downloading': return t('downloading', { v });
      case 'installed': return t('installed', { v });
      case 'error': return u.error === 'no public release' ? t('noRelease') : t('failed', { e: u.error });
      default: return '';
    }
  }
  function paintUpdate() {
    if (!updRow || !updRow.isConnected) return;
    const u = B.state.update || {};
    const name = updRow.querySelector('.gs-row-name');
    const label = updRow.querySelector('.gs-row-label');
    let hint = label.querySelector('.gs-row-hint');
    const txt = updText(u);
    if (txt && !hint) hint = el('div', 'gs-row-hint', label);
    if (hint) { hint.textContent = txt; hint.classList.toggle('bdt-warn', u.state === 'error'); hint.classList.toggle('bdt-good', u.state === 'installed' || u.state === 'uptodate'); }
    name.textContent = t('updates');
    const ctl = updRow.querySelector('.gs-row-ctl');
    ctl.innerHTML = '';
    // "Check now" downloads and installs a newer version right away (then the restart dialog shows)
    const b = btn(ctl, t('check'), () => { B.api('check').then(startPoll); });
    b.classList.toggle('gs-btn-off', !!u.busy || u.state === 'installed');
  }
  function startPoll() {
    paintUpdate();
    if (poll) return;
    poll = setInterval(() => {
      B.api('state').then((s) => {
        paintUpdate();
        checkDialogs(s);
        if (!s.update || !s.update.busy || !active) stopPoll();
      }, stopPoll);
    }, 600);
  }
  function stopPoll() { clearInterval(poll); poll = 0; }

  function modTitle(file) {
    const id = kitName(file), i = kitInfo(file);
    if (TXT[id]) return t(id);
    return (i && i.title && KIT.localize(i.title)) || file;
  }
  function modDesc(file) {
    const id = kitName(file), i = kitInfo(file);
    if (TXT[id + '.d']) return t(id + '.d');
    const by = i ? [i.version ? 'v' + i.version : '', i.author ? KIT.localize(i.author) : ''].filter(Boolean).join(', ') : '';
    const d = i && i.description ? KIT.localize(i.description) : '';
    return [d, t('custom') + ' · ' + file + (by ? ' · ' + by : '')].filter(Boolean).join('\n');
  }
  // options of a mod by someone else, in the same form as OPTIONS (labels already translated)
  function modOptions(file) {
    if (OPTIONS[file]) return OPTIONS[file];
    if (!KIT || !KIT.options) return [];
    return KIT.options(kitName(file)).filter(o => o.type === 'bool' || o.type === 'range' || o.type === 'choice').map(o => ({
      key: o.key, type: o.type, def: o.type === 'bool' ? !!o.default : o.default,
      min: Number(o.min ?? 0), max: Number(o.max ?? 100), step: Number(o.step ?? 1),
      label: KIT.localize(o.label) || o.key, hint: KIT.localize(o.hint),
      choices: (o.choices || []).map(c => ({ value: c.value, label: KIT.localize(c.label ?? c.value) })),
    }));
  }

  function renderMods(body) {
    for (const m of B.mods) {
      if (m.file === 'betterdt-settings.js' || m.file.startsWith('lib-')) continue;
      const card = el('div', 'gs-card', body);
      const mctl = row(card, modTitle(m.file), modDesc(m.file));
      sw(mctl, modOn(m.file), (v) => { setModOn(m.file, v); paintOpts(); });
      if (CREDITS[m.file]) {
        el('div', 'gs-row-hint bdt-credit', mctl.parentNode.querySelector('.gs-row-label')).textContent = t('credit', { n: CREDITS[m.file] });
      }
      // a folder mod whose mod.json is not valid JSON: its files still load, but without title and options
      if (m.folder && !m.manifest) el('div', 'gs-row-hint bdt-warn', mctl.parentNode.querySelector('.gs-row-label')).textContent = t('badManifest');
      // what the compatibility check found (BetterDTKit)
      const st = m.enabled && kitStatus(m.file);
      if (st && (st.state !== 'running' || st.problems.length)) {
        const key = st.state === 'incompatible' ? 'stIncompat' : st.state === 'failed' ? 'stFailed' : st.state === 'running' ? 'stWarn' : '';
        if (key) {
          const h = el('div', 'gs-row-hint bdt-warn', mctl.parentNode.querySelector('.gs-row-label'));
          h.textContent = t(key) + (st.problems.length ? ': ' + st.problems.join('; ') : '');
        }
      }
      const opts = [];
      for (const o of modOptions(m.file)) {
        const ctl = row(card, o.label || t(o.key), o.hint);
        const r = ctl.parentNode;
        r.classList.add('bdt-opt');
        opts.push(r);
        if (o.type === 'bool') sw(ctl, S.bool(o.key, o.def), (v) => save(o.key, v));
        else if (o.type === 'choice') choice(ctl, o.choices, S.get(o.key, o.def), (v) => save(o.key, v));
        else slider(ctl, o.min, o.max, o.step, S.num(o.key, o.def), (v) => save(o.key, v));
      }
      const paintOpts = () => { const off = !modOn(m.file); for (const r of opts) r.classList.toggle('gs-row-off', off); };
      paintOpts();
    }
  }

  // ── dialogs: new version ready, game page crashed ──────────────────────────────────────────────
  // Look of the game's own news window (#office-news-*): dark blurred panel, centered text, coloured buttons.
  // Built in 1920×1080 units and scaled with the window like the game's HTML overlays.
  function dialogCss() {
    if (document.getElementById('betterdt-dialog-css')) return;
    const s = el('style', '', document.head);
    s.id = 'betterdt-dialog-css';
    s.textContent = `
#bdt-dlg { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center;
  font-family: "SofiaSansExtraCondensed-Medium", "Oswald", "Segoe UI", sans-serif; }
#bdt-dlg .bdt-dim { position: absolute; inset: 0; background: rgba(4, 10, 20, .46); animation: bdt-fade .24s ease both; }
#bdt-dlg .bdt-panel { position: relative; width: 820px; transform: scale(var(--bdt-scale, 1)); }
#bdt-dlg .bdt-blur { position: absolute; inset: 0; border-radius: 16px; background: rgba(12, 15, 22, .72);
  backdrop-filter: blur(16px) saturate(1.25); border: 1px solid rgba(255, 255, 255, .10);
  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, .65), inset 0 0 24px -8px rgba(255, 255, 255, .18); animation: bdt-fade .22s ease both; }
#bdt-dlg .bdt-content { position: relative; box-sizing: border-box; padding: 28px 52px 32px; text-align: center; color: #fff;
  animation: bdt-open .34s cubic-bezier(.30, 1.35, .45, 1) both; }
#bdt-dlg .bdt-title { font-size: 36px; text-shadow: 0 2px 8px rgba(0, 0, 0, .5); }
#bdt-dlg .bdt-divider { height: 1px; margin: 16px 0 14px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, .28) 18%, rgba(255, 255, 255, .28) 82%, transparent 100%); }
#bdt-dlg .bdt-text { font-size: 26px; line-height: 1.45; text-shadow: 0 2px 6px rgba(0, 0, 0, .45); }
#bdt-dlg .bdt-notes { margin: 14px auto 0; display: inline-block; text-align: left; font-size: 22px; line-height: 1.4; opacity: .8; }
#bdt-dlg .bdt-hint { margin-top: 14px; font-size: 20px; line-height: 1.35; opacity: .65; }
#bdt-dlg .bdt-community { margin-top: 18px; font-size: 20px; line-height: 1.35; opacity: .75; }
#bdt-dlg .bdt-link { color: #8ea1ff; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
#bdt-dlg .bdt-link:hover { color: #b3c0ff; }
#bdt-dlg .bdt-buttons { display: flex; justify-content: center; gap: 40px; margin-top: 24px; }
#bdt-dlg .bdt-btn { box-sizing: border-box; min-width: 240px; padding: 0 28px; height: 50px; line-height: 50px; border-radius: 8px;
  font-size: 25px; color: #fff; text-shadow: 0 1px 3px rgba(0, 0, 0, .35); cursor: pointer; user-select: none;
  background: linear-gradient(180deg, #5d6878 0%, #434c5a 100%); box-shadow: 0 6px 18px -6px rgba(0, 0, 0, .55);
  transition: transform .16s ease, filter .16s ease, box-shadow .16s ease; }
#bdt-dlg .bdt-btn.bdt-go { background: linear-gradient(180deg, #a8d418 0%, #63b303 100%); box-shadow: 0 6px 18px -6px rgba(120, 190, 20, .55); }
#bdt-dlg .bdt-btn:hover { transform: translateY(-2px); filter: brightness(1.12); }
#bdt-dlg .bdt-btn:active { transform: translateY(0) scale(.96); filter: brightness(.95); }
#bdt-dlg .bdt-btn.bdt-off { pointer-events: none; opacity: .55; }
@keyframes bdt-fade { from { opacity: 0; } }
@keyframes bdt-open { from { opacity: 0; transform: translateY(26px) scale(.94); } }
`;
  }
  let dlg = null;
  function dialog(title, text, extra, buttons) {
    if (dlg) return null;
    dialogCss();
    dlg = el('div', '', document.body);
    dlg.id = 'bdt-dlg';
    el('div', 'bdt-dim', dlg);
    const panel = el('div', 'bdt-panel', dlg);
    el('div', 'bdt-blur', panel);
    const c = el('div', 'bdt-content', panel);
    el('div', 'bdt-title', c).textContent = title;
    el('div', 'bdt-divider', c);
    el('div', 'bdt-text', c).textContent = text;
    if (extra) extra(c);
    const row = el('div', 'bdt-buttons', c);
    const scale = () => { if (dlg) dlg.style.setProperty('--bdt-scale', Math.min(innerWidth / 1920, innerHeight / 1080).toFixed(4)); };
    scale();
    addEventListener('resize', scale);
    const close = () => { removeEventListener('resize', scale); dlg?.remove(); dlg = null; nextDialog(); };
    for (const b of buttons) {
      const e = el('div', 'bdt-btn' + (b.go ? ' bdt-go' : ''), row);
      e.textContent = b.label;
      e.addEventListener('click', () => {
        globalThis.tapMain?.();
        for (const x of row.children) x.classList.add('bdt-off');
        Promise.resolve(b.cb()).catch(() => {}).then(() => { if (!b.keep) close(); });
      });
    }
    return dlg;
  }
  // for other mods (BetterDT itself is frozen by the loader):
  // BetterDTUI.dialog(title, text, [{ label, go, cb }], extra(contentElement)); null while another one is open
  globalThis.BetterDTUI = Object.freeze({ dialog: (title, text, buttons, extra) => dialog(title, text, extra, buttons) });

  function showUpdate(u) {
    dialog(t('updTitle', { v: u.latest }), t('updText'), (c) => {
      const notes = String(u.notes || '').split('\n').filter(Boolean);
      if (notes.length) { const n = el('div', 'bdt-notes', c); for (const line of notes) el('div', '', n).textContent = '• ' + line; }
      // a quiet pointer to the Discord, only here (an update is read by everybody, once)
      const d = el('div', 'bdt-community', c);
      d.append(t('updDiscord') + ' ');
      const a = el('span', 'bdt-link', d);
      a.textContent = 'Discord';
      a.addEventListener('click', () => { globalThis.tapMain?.(); B.api('open', { what: 'discord' }); });
    }, [
      { label: t('later'), cb: () => B.api('update-ack') },
      { label: t('restart'), go: true, keep: true, cb: () => B.api('update-ack').then(() => B.api('restart')) },
    ]);
  }
  function showCrash() {
    dialog(t('crashTitle'), t('crashText'), (c) => { el('div', 'bdt-hint', c).textContent = t('crashHint'); }, [
      { label: t('report'), cb: () => B.api('report').then(() => B.api('crash-ack')) },
      { label: t('ok'), go: true, cb: () => B.api('crash-ack') },
    ]);
  }
  // Shown only in the main menu (never in the middle of a game, and only after the game's settings with the
  // language are loaded). A crash comes first; a ready update right after that dialog is closed.
  const inMenu = () => { try { return rt.layout.name === 'MENU'; } catch { return false; } };
  function checkDialogs(s) {
    if (!s || dlg || !inMenu()) return;
    if (s.crash) showCrash();
    else if (s.update && s.update.state === 'installed' && !s.update.acked) showUpdate(s.update);
    else if (gameUpdated) showGameUpdated();
  }

  // the game itself was updated since the last start: say which mods still run (once, after the checks)
  let gameUpdated = null;
  if (KIT) KIT.whenReady(rt, () => {
    const v = KIT.gameVersion, prev = String(S.get('game.version', ''));
    if (!v || v === prev) return;
    if (prev) gameUpdated = { a: prev, b: v };
    S.set('game.version', v);
    BetterDT.log('game version', prev || '(first start)', '->', v);
  });
  function showGameUpdated() {
    const { a, b } = gameUpdated;
    gameUpdated = null;
    const off = B.mods.filter(m => m.enabled).map(m => kitStatus(m.file))
      .filter(st => st && (st.state === 'incompatible' || st.state === 'failed')).map(st => modTitle(st.name + '.js'));
    dialog(t('verTitle'), t('verText', { a, b }), (c) => {
      el('div', 'bdt-hint', c).textContent = off.length ? t('verOff', { list: off.join(', ') }) : t('verAllOk');
    }, [{ label: t('ok'), go: true, cb: () => { } }]);
  }
  const nextDialog = () => B.api('state').then(checkDialogs, () => {});
  setInterval(() => { if (!dlg && inMenu()) nextDialog(); }, 2000);

  // what the game is doing, so that a crash report can say it (sent every 15 s, kept in memory by the loader)
  setInterval(() => {
    const gv = rt.globalVars;
    let layout = '';
    try { layout = rt.layout.name; } catch { }
    const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : '';
    const mods = KIT ? KIT.status().filter(m => m.state !== 'running' && m.state !== 'waiting').map(m => m.name + ' (' + m.state + ')').join(', ') : '';
    B.api('beat', { layout, day: gv.DayTotal ?? '', year: gv.Year ?? '', heap, dom: document.getElementsByTagName('*').length,
      game: KIT ? KIT.gameVersion : '', mods: mods.slice(0, 200) }).catch(() => {});
  }, 15000);

  // ── hooking into the settings page ───────────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('betterdt-settings-css')) return;
    const s = el('style', '', document.head);
    s.id = 'betterdt-settings-css';
    s.textContent = `
#gs-root .gs-nav-group.bdt-nav { color: rgb(var(--acc)); }
#gs-root .gs-row-ctl .gs-btn + .gs-btn { margin-left: calc(var(--gs, 1) * 10px); }
#gs-root .bdt-val { margin-right: calc(var(--gs, 1) * 14px); font-size: calc(var(--gs, 1) * 22px); opacity: .85; }
#gs-root .gs-row-hint.bdt-warn { color: rgb(var(--warn)); opacity: 1; }
#gs-root .gs-row-hint.bdt-good { color: rgb(var(--good)); opacity: 1; }
#gs-root .gs-row-hint { white-space: pre-line; }
#gs-root .gs-btn.bdt-choice { margin-left: calc(var(--gs, 1) * 6px); opacity: .7; }
#gs-root .gs-btn.bdt-choice.bdt-chosen { opacity: 1; background: linear-gradient(180deg, #a8d418 0%, #63b303 100%); color: #fff; border-color: transparent; }
#gs-root .gs-row.bdt-opt .gs-row-name { padding-left: calc(var(--gs, 1) * 18px); opacity: .9; }
#gs-root.bdt-autoapply #gs-apply { visibility: hidden; }
`;
  }

  // The game's own pages keep changes in a draft until Apply. We apply the draft as soon as a control changes
  // it, so every setting (also ones a game update adds) is saved right away and Apply is hidden. The game
  // tells whether its draft differs from what is saved (debugGameSettings().dirty) and saves it with
  // applyGameSettings(), which shows its own "Applied". Without these functions Apply stays as it is.
  function autoApply(r) {
    if (r.__bdtAutoApply || typeof globalThis.applyGameSettings !== 'function' || typeof globalThis.debugGameSettings !== 'function') return;
    r.__bdtAutoApply = true;
    r.classList.add('bdt-autoapply');
    let held = false, timer = 0;
    const run = () => {
      timer = 0;
      // a slider still being dragged: the game re-renders the page on apply, so wait until it is let go
      if (held || !r.isConnected) return;
      let dirty = false;
      try { dirty = !!globalThis.debugGameSettings().dirty; } catch (e) { return; }
      if (dirty) try { globalThis.applyGameSettings(); } catch (e) { console.error('[BetterDT] apply settings', e); }
    };
    const later = () => { if (!timer) timer = setTimeout(run, 0); };
    r.addEventListener('pointerdown', () => { held = true; }, true);
    window.addEventListener('pointerup', () => { if (held) { held = false; later(); } }, true);
    // capture: the game stops some clicks (its checkboxes) before they reach #gs-root; we check after its handlers
    for (const type of ['click', 'change', 'keyup']) r.addEventListener(type, later, true);
  }

  function attach() {
    const r = document.getElementById('gs-root');
    const n = r && r.querySelector('#gs-nav');
    if (!n || n === nav) return;
    if (navObs) navObs.disconnect();
    root = r; nav = n; active = null; prevPage = null; savedFoot = null;
    css();
    nav.addEventListener('click', onNavClick, true);
    navObs = new MutationObserver(onNavRebuilt);
    navObs.observe(nav, { childList: true });
    addNav();
    autoApply(r);
  }
  // the settings page: the SETTINGS layout (main menu) or, since game 1.6, a window over the game (pause menu)
  let settingsSince = 0;
  setInterval(() => {
    let name = '';
    try { name = rt.layout.name; } catch { return; }
    const page = document.getElementById('gs-root');
    if (name === 'SETTINGS' || (page && page.getClientRects().length)) {
      attach();
      // a game update changed the settings page so that the BetterDT section cannot be added: offer a plain list
      if (!settingsSince) settingsSince = Date.now();
      fallbackButton(name === 'SETTINGS' && !nav && Date.now() - settingsSince > 3000);
    } else {
      settingsSince = 0;
      fallbackButton(false);
      if (nav) { if (navObs) navObs.disconnect(); navObs = null; nav = root = null; active = null; stopPoll(); }
    }
  }, 200);

  // ── fallback: the mods as a simple list in a dialog ─────────────────────────────────────────────
  let fbBtn = null;
  function fallbackButton(show) {
    if (!show) { if (fbBtn) { fbBtn.remove(); fbBtn = null; } return; }
    if (fbBtn) return;
    fbBtn = el('div', '', document.body);
    fbBtn.id = 'bdt-fallback';
    fbBtn.textContent = 'BetterDT';
    fbBtn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147482000;padding:10px 20px;border-radius:8px;cursor:pointer;' +
      'font:20px "SofiaSansExtraCondensed-Bold","Segoe UI",sans-serif;color:#fff;background:linear-gradient(180deg,#a8d418 0%,#63b303 100%);' +
      'box-shadow:0 6px 18px -6px rgba(0,0,0,.55)';
    fbBtn.addEventListener('click', () => { globalThis.tapMain?.(); fallbackDialog(); });
  }
  function fallbackDialog() {
    dialog(t('fbTitle'), t('fbText'), (c) => {
      const list = el('div', 'bdt-notes', c);
      for (const m of B.mods) {
        if (m.file === 'betterdt-settings.js' || m.file.startsWith('lib-')) continue;
        const line = el('label', '', list);
        line.style.cssText = 'display:block;cursor:pointer;margin:4px 0';
        const box = el('input', '', line);
        box.type = 'checkbox';
        box.checked = modOn(m.file);
        box.style.cssText = 'width:20px;height:20px;margin-right:10px;vertical-align:middle';
        box.addEventListener('change', () => (SWITCH[m.file] ? S.set(SWITCH[m.file].key, box.checked) : S.set('mod.' + m.file, box.checked)));
        const st = m.enabled && kitStatus(m.file);
        const bad = st && (st.state === 'incompatible' || st.state === 'failed');
        el('span', '', line).textContent = modTitle(m.file) + (bad ? ' – ' + t(st.state === 'failed' ? 'stFailed' : 'stIncompat') : '');
      }
    }, [{ label: t('ok'), go: true, cb: () => { } }]);
  }

  // "Saved" in the footer for a mod's control on a game page (e.g. the autosave slider), like the game's "Applied"
  let flashTimer = 0;
  function flash() {
    const r = document.getElementById('gs-root');
    const st = r && r.querySelector('.gs-status'), tx = r && r.querySelector('.gs-status-text');
    if (!st || !tx) return;
    if (active) { status(true); return; }
    clearTimeout(flashTimer);
    tx.textContent = t('saved');
    st.classList.add('gs-status-ok'); st.classList.remove('gs-status-warn', 'gs-status-idle');
    flashTimer = setTimeout(() => {
      if (tx.textContent !== t('saved')) return;
      tx.textContent = '';
      st.classList.remove('gs-status-ok'); st.classList.add('gs-status-idle');
    }, 1800);
  }

  globalThis.__betterdtSettings = { get active() { return active; }, open(p) { attach(); nav?.querySelector(`[data-page="${p}"]`)?.click(); }, flash };
});
