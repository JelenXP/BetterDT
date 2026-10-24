// Research breakthroughs – a finished lab project can research parts before the market has them.
//
// When a lab project ends, the points it made (collected ones too) decide how many breakthroughs it gives (0–3, more
// points give more). Each one raises a research category by one level ahead of the parts on the market: the next part
// of that category, normally available 10 to 460 days later, can be built into devices now. A category the player is
// far behind in cannot get one. A part further ahead is drawn more often (up to 190 days), and categories of the
// device types the player released in the last two years three times as often.
// The parts come as the game's own news in the office (the game waits while it is open, Auto continue closes it).
// The device designer lists a category's parts up to the number of parts on the market; for a category researched
// ahead that number is raised to the research level, so the future parts are offered.
// A device with innovative parts (born after its release) sells more: its popularity counts 10 % more per part while
// the sales are computed, fading out within 60 days after the part reached the market. Fair reviews also scores
// innovation (fair-reviews.js).
BetterDTKit.mod('research-breakthroughs', {
  needs: {
    calls: ['ResearchInvestEngine'],
    objects: ['ArrayMyResearch', 'ArrayMyResearch_Invest', 'ArrayLanguage', 'ArrayGameAssistant'],
    vars: ['DayTotal', 'LanguageChoose', 'ArrayFunctionsOpened', 'AssistantTheme', 'AssistantTitle', 'AssistantText',
      'AssistantImage', 'AssistantButtons', 'AssistantButtonsText_1', 'class', 'ResearchInvest_AvarageEarnings'],
    actions: Object.values((globalThis.BDTReviewData || { counters: {} }).counters).flat(),
    check: () => !globalThis.BDTReviewData ? 'lib-review-data.js' : !globalThis.BDTReviewCore ? 'lib-review-core.js'
      : !globalThis.BDTReviewTexts ? 'lib-review-texts.js' : !globalThis.BDTBreakthroughCore ? 'lib-breakthrough-core.js'
      : !globalThis.BetterDTUI ? 'BetterDTUI' : '',
  },
}, (rt, kit) => {
  if (globalThis.__bdtBreakthroughs) globalThis.__bdtBreakthroughs.dispose();
  const D = BDTReviewData, C = BDTReviewCore, B = BDTBreakthroughCore, T = BDTReviewTexts, gv = rt.globalVars;
  const arr = (name) => rt.objects[name] && rt.objects[name].getFirstInstance();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const lang = () => { const l = Math.round(num(gv.LanguageChoose)); return l >= 0 && l < 15 ? l : 0; };
  const today = () => num(gv.DayTotal);
  const level = (id) => Math.round(num(arr('ArrayMyResearch').getAt(+id)));
  const idsOf = {};   // component array -> research ids
  for (const [id, r] of Object.entries(D.research)) (idsOf[r.array] ||= []).push(id);

  // born days of the rows of a component array, cached for the day
  let bornDay = -1, bornCache = new Map();
  function borns(array, col) {
    if (bornDay !== today()) { bornDay = today(); bornCache = new Map(); }
    let b = bornCache.get(array);
    if (!b) {
      const a = arr(array);
      b = [];
      if (a) for (let i = 0; i < a.width; i++) b.push(num(a.getAt(i, col)));
      bornCache.set(array, b);
    }
    return b;
  }

  // ── which categories can get a breakthrough ───────────────────────────────────────────────────────────────────────
  function released() {
    const out = new Set(), from = today() - 730;
    for (const e of Object.values(D.engines)) {
      const a = arr(e.device);
      if (!a || out.has(e.creating)) continue;
      for (let x = 0; x < a.width && !out.has(e.creating); x++) for (let y = 0; y < a.height; y++) {
        if (num(a.getAt(x, y, e.costCol)) > 0 && num(a.getAt(x, y, D.releaseCol)) >= from) { out.add(e.creating); break; }
      }
    }
    return out;
  }
  function candidates() {
    const rel = released(), out = [];
    for (const [id, r] of Object.entries(D.research)) {
      if (r.start > today() || !D.counters[r.array]) continue;
      const t = B.target(level(id), borns(r.array, r.bornCol), today(), r.cost);
      const lead = t && borns(r.array, r.bornCol)[t.row] - today();
      if (t) out.push({ id, w: B.relevance(rel, r.creating) * B.leadWeight(lead), t });
    }
    return out;
  }

  // ── a finished project ────────────────────────────────────────────────────────────────────────────────────────────
  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];   // the game's year: 365 days from day 1 of 2008
  function dateOf(day) {
    let rest = Math.max(0, day - 1), m = 0;
    const y = 2008 + Math.floor(rest / 365);
    rest %= 365;
    while (rest >= DAYS[m]) rest -= DAYS[m++];
    return String(rest + 1).padStart(2, '0') + '.' + String(m + 1).padStart(2, '0') + '.' + y;
  }
  const lines = (out) => out.map(g => T.t(T.breakthroughLine, lang())
    .replace('{part}', String(arr('ArrayLanguage').getAt(lang(), D.research[g.id].nameText)).replace(/\[[^\]]*\]/g, '').trim())
    .replace('{date}', dateOf(g.born))).join('\n');
  // The news goes into the game's assistant queue (ArrayGameAssistant, its theme in column 0), like the game's own
  // news: it shows in the office on the next day, the game waits while it is open, and Auto continue can close it.
  // The theme carries the parts (research id and born day), so a saved game still has them. The game shows a theme
  // it does not know as a plain NEWS window; its text is filled in just before the game shows it.
  const THEME = 'BETTERDT BREAKTHROUGH', SHOW_SCRIPT = 'EventAssistant_Event1709_Act1';
  function queue(out) {
    const q = arr('ArrayGameAssistant');
    if (!q) return false;
    const w = q.width, h = Math.max(2, q.height);
    q.setSize(w + 1, h, Math.max(1, q.depth));
    for (let i = w; i > 0; i--) for (let j = 0; j < h; j++) q.setAt(q.getAt(i - 1, j), i, j);
    q.setAt(THEME + ':' + out.map(g => g.id + '@' + g.born).join(','), 0, 0);
    q.setAt(1, 0, 1);
    for (let j = 2; j < h; j++) q.setAt(0, 0, j);
    return true;
  }
  function fill() {
    const th = String(gv.AssistantTheme);
    if (!th.startsWith(THEME + ':')) return;
    const out = th.slice(THEME.length + 1).split(',').map(s => s.split('@')).filter(([id]) => D.research[id]).map(([id, born]) => ({ id, born: +born }));
    let title = T.t(T.breakthroughTitle, lang());
    try { title = title.toLocaleUpperCase(); } catch { }
    gv.AssistantTitle = title;
    gv.AssistantText = lines(out);
    gv.AssistantImage = '-999';
    gv.AssistantButtons = 1;
    gv.AssistantButtonsText_1 = 'OK';
  }
  const queued = kit.wrapScript(SHOW_SCRIPT, { before: fill }) > 0;
  if (!queued) kit.warn('news script not found, the breakthroughs show in a dialog of their own');
  // without the game's news: a dialog of its own, tried again while another one is open
  const pending = [];
  function showDialog() {
    if (!pending.length) return;
    if (BetterDTUI.dialog(T.t(T.breakthroughTitle, lang()), lines(pending), [{ label: 'OK', go: true, cb() {} }])) {
      pending.length = 0;
      const t = document.querySelector('#bdt-dlg .bdt-text');
      if (t) t.style.whiteSpace = 'pre-line';
    }
  }
  const retry = setInterval(kit.guard(showDialog), 1000);
  function announce(out) {
    if (queued && queue(out)) return;
    pending.push(...out);
    showDialog();
  }
  function finish(Y, rng = Math.random, opts = {}) {
    const cands = candidates(), ids = B.pick(cands, B.attempts(Y, rng), rng), R = arr('ArrayMyResearch'), out = [];
    for (const id of ids) {
      const t = cands.find(c => c.id === id).t, r = D.research[id];
      R.setAt(t.level, +id);
      out.push({ id, row: t.row, level: t.level, born: borns(r.array, r.bornCol)[t.row] });
    }
    if (!opts.quiet) {
      // the last 10 projects, to see later what they gave
      api.lastProject = { Y, day: today(), out };
      api.projects = [...api.projects, api.lastProject].slice(-10);
      BetterDT.log('lab project ended, yield', Y, 'breakthroughs', out.map(g => g.id + '→' + g.level).join(' ') || 'none');
    }
    if (out.length && !opts.quiet) announce(out);
    return out;
  }
  // The yield of a project is every point the lab made during it: the pool is capped by the lab's size and collecting
  // empties it, so the daily growth of the pool is summed up (collected points count, points over the cap do not).
  // A project the mod saw only part of (a game loaded in the middle of it) counts its days seen for the whole project.
  const PROJECT_DAYS = 30;
  let invest = null, lab = { made: 0, seen: 0, first: 0, last: -1 };
  kit.wrapCalls('ResearchInvestEngine', {
    before() { const a = arr('ArrayMyResearch_Invest'); invest = { pool: num(a.getAt(0, 0)), days: num(a.getAt(0, 1)) }; },
    after() {
      const was = invest; invest = null;
      if (!was || was.days <= 0) return;
      const a = arr('ArrayMyResearch_Invest'), days = num(a.getAt(0, 1));
      // a new project: more days left than the day before
      if (lab.last < 0 || was.days > lab.last) lab = { made: 0, seen: 0, first: was.days, last: -1 };
      lab.made += Math.max(0, num(a.getAt(0, 0)) - was.pool);
      lab.seen++;
      lab.last = was.days;
      if (was.days !== 1 || days !== 0) return;
      const Y = lab.first >= PROJECT_DAYS ? lab.made : lab.made * PROJECT_DAYS / lab.seen;
      lab = { made: 0, seen: 0, first: 0, last: -1 };
      if (Y > 0) finish(Math.round(Y));
    },
  });

  // ── the designer lists the parts up to the research level ─────────────────────────────────────────────────────────
  // the list counts the parts on the market into ArrayFunctionsOpened, starting from the value set here
  function extra(array) {
    const ids = idsOf[array] || [], r = D.research[ids[0]];
    if (!r) return 0;
    const b = borns(array, r.bornCol), A = B.datedCount(b, today());
    let L = 0;
    for (const id of ids) L = Math.max(L, level(id));
    // only rows that a breakthrough can give: born up to 460 days ahead
    let n = A;
    while (n < L && n < b.length && b[n] <= today() + B.AHEAD_DAYS) n++;
    return n - A;
  }
  for (const [array, sids] of Object.entries(D.counters)) {
    for (const sid of sids) kit.wrapAction(sid, { after() { const n = extra(array); if (n > 0) gv.ArrayFunctionsOpened = n; } });
  }

  // ── innovative devices sell more ──────────────────────────────────────────────────────────────────────────────────
  let bonusDay = -1, bonusCache = new Map();
  function bonus(name, x, y) {
    if (api.testBonus) return api.testBonus(name, x, y);
    if (bonusDay !== today()) { bonusDay = today(); bonusCache = new Map(); }
    const k = name + ':' + x + ':' + y;
    let b = bonusCache.get(k);
    if (b === undefined) {
      const a = arr(name), rel = num(a.getAt(x, y, D.releaseCol));
      b = rel > 0 ? C.salesBonus(C.effectiveParts(C.partsOf(rt, D, name, x, y, rel).borns, today())) : 0;
      bonusCache.set(k, b);
    }
    return b;
  }
  kit.salesMultiplier((name, x, y) => (api.salesOff ? 1 : 1 + bonus(name, x, y)));
  if (!BetterDTKit.salesReady()) kit.warn('daily sales script not found, no sales bonus');

  // ── the research investing screen: what a project would give ─────────────────────────────────────────────────────
  // The screen is drawn on the game's canvas (class RESEARCH INVEST). Under its window a panel shows the points a
  // project makes (the game's average income × 30 days, or for a running project the points made so far and the rest
  // at that pace) and the breakthrough chances for them; it follows the average income, so it changes with the amount
  // like the game's number does. The game's info line below moves down to make room while the screen is open.
  const alive = (i) => { try { return rt.getInstanceByUid(i.uid) === i; } catch { return false; } };
  const SCREEN = 'RESEARCH INVEST', BACK = 'RESEARCH INVEST (Back)', TOP = 'RESEARCH INVEST (Top)', INFO_SHIFT = 70;
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const pct = (p) => Math.round(p * 100) + ' %';
  function projectYield() {
    const a = arr('ArrayMyResearch_Invest'), days = a ? num(a.getAt(0, 1)) : 0;
    if (days > 0 && lab.seen > 0) return lab.made + lab.made / lab.seen * days;
    return num(gv.ResearchInvest_AvarageEarnings) * PROJECT_DAYS;
  }
  // the window (the biggest frame on the back layer) and the info line (the text under it), looked up once per visit
  function screenParts() {
    let win = null, info = null;
    for (const name of Object.keys(rt.objects)) {
      let all;
      try { all = rt.objects[name].getAllInstances(); } catch { continue; }
      for (const i of all) {
        const ln = i.layer && i.layer.name;
        if (ln === BACK && i.width < 1500 && i.height > 300 && (!win || i.width * i.height > win.width * win.height)) win = i;
        else if (ln === TOP && typeof i.text === 'string' && (!info || i.y > info.y)) info = i;
      }
    }
    return win && { win, info: info && info.y > win.y + win.height / 2 ? { inst: info, y: info.y } : null };
  }
  let screen = null, labEl = null, labRaf = 0;
  function labPanel() {
    const el = document.createElement('div');
    el.id = 'bdt-lab-chances';
    el.style.cssText = 'position:fixed;z-index:5;pointer-events:none;box-sizing:border-box;display:flex;flex-direction:column;'
      + 'justify-content:center;background:rgba(18,28,24,.62);color:#fff;font-family:SofiaSansExtraCondensed-Medium,Oswald,sans-serif;'
      + 'backdrop-filter:blur(6px)';
    el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:1em">'
      + '<b class="t" style="font-family:SofiaSansExtraCondensed-Bold,SofiaSansExtraCondensed-Medium,Oswald,sans-serif;'
      + 'text-transform:uppercase;letter-spacing:.04em"></b><span class="p"></span></div>'
      + '<div class="c"></div><div class="h" style="opacity:.7"></div>';
    document.body.append(el);
    return el;
  }
  function labFrame() {
    labRaf = 0;
    if (!screen || !labEl) return;
    const { win } = screen, L = win.layer, s = L.layerToCssPx(1920, 0)[0] - L.layerToCssPx(0, 0)[0];
    const k = s / 1920, bottom = win.y + win.height / 2;
    const [x0, y0] = L.layerToCssPx(win.x - win.width / 2, bottom + 12), [x1] = L.layerToCssPx(win.x + win.width / 2, 0);
    Object.assign(labEl.style, {
      left: x0 + 'px', top: y0 + 'px', width: x1 - x0 + 'px', height: 112 * k + 'px', padding: `0 ${28 * k}px`,
      borderRadius: 12 * k + 'px', fontSize: 26 * k + 'px', lineHeight: 1.25, opacity: String(win.opacity),
    });
    labEl.querySelector('.t').style.fontSize = 28 * k + 'px';
    labEl.querySelector('.h').style.fontSize = 20 * k + 'px';
    const Y = projectYield(), p = B.K.map(kk => B.chance(Y, kk)), l = lang(), y = (v) => `<span style="color:#FFD800">${v}</span>`;
    const c = T.t(T.labChance, l).replace('{a}', y(pct(p[0]))).replace('{b}', y(pct(p[0] * p[1]))).replace('{c}', y(pct(p[0] * p[1] * p[2])));
    const html = [T.t(T.labTitle, l), T.t(T.labPoints, l).replace('{n}', fmt(Y)), c, T.t(T.labHint, l)];
    ['.t', '.p', '.c', '.h'].forEach((sel, i) => {
      const e = labEl.querySelector(sel);
      if (e.innerHTML !== html[i]) e.innerHTML = html[i];
    });
    labRaf = requestAnimationFrame(guardedLabFrame);
  }
  const guardedLabFrame = kit.guard(labFrame);
  function labHide() {
    if (labRaf) cancelAnimationFrame(labRaf);
    labRaf = 0;
    if (labEl) labEl.remove();
    labEl = null;
    if (screen && screen.info) { try { screen.info.inst.y = screen.info.y; } catch { } }
    screen = null;
  }
  const labTimer = setInterval(kit.guard(() => {
    const open = String(gv.class) === SCREEN;
    if (!open) { if (screen) labHide(); return; }
    if (screen && !alive(screen.win)) labHide();
    if (!screen) {
      screen = screenParts();
      if (!screen) return;
      if (screen.info) screen.info.inst.y = screen.info.y + INFO_SHIFT;
      labEl = labPanel();
    }
    if (!labRaf) labFrame();
  }), 150);
  kit.onStop(() => { clearInterval(labTimer); labHide(); });

  const api = {
    salesOff: false, testBonus: null, lastProject: null, projects: [], get lab() { return lab; }, finish, announce, candidates, extra, bonus,
    projectYield,
    dispose() { clearInterval(retry); clearInterval(labTimer); labHide(); delete globalThis.__bdtBreakthroughs; },
  };
  globalThis.__bdtBreakthroughs = api;
  return () => api.dispose();
});
