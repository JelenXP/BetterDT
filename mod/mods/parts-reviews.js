// Parts in reviews – the operating system and the processor (and a laptop's graphics card) are reviewed like the
// other parts of a device (fair-reviews.js shows them as categories of the same weight).
// OS (phones, tablets, laptops, watches, TV), 0–10:
//   a free OS gets a fixed base of 2.5–4.5 per OS family and game, a paid one 5–9.5 by its licence price against the
//   other paid licences on the market (log scale), an own OS 10 × ★ / (★ + H) from the rating its updates gave it;
//   −0.5 for every year the chosen version is older than the newest OS version on the market (at most −3), −3 without
//   support (a third-party version past its end of support, an own OS not updated for 2 years), +0.5 for an own OS,
//   +1 for an own PRIVATE OS. The OS page of the device designer shows the rating next to the chosen OS.
// Processor, 0–10: the designer's indicators of the chip (power, performance, gaming, energy) weighted by the device
//   type, +0.5 for an own chip; a laptop's graphics card from the designer's graphics bars likewise. It replaces the
//   phones' and tablets' CPU load review (the game never computes the load, so it always gave 8–10); the laptops'
//   storage reviews, which the game files under the processor, count as memory.
// A released model is rated from its columns: the designer's variables are set from them for a moment (with the day
// of its release and the cursors of an own chip) and every variable is restored afterwards.
BetterDTKit.mod('parts-reviews', {
  needs: {
    vars: ['DayTotal', 'LanguageChoose', 'OperationSystemID', 'OperationSystem_Text', 'OperationSystemVersion_Text'],
    check: () => !globalThis.BDTPartsData ? 'lib-parts-data.js' : !globalThis.BDTPartsCore ? 'lib-parts-core.js'
      : !globalThis.BDTReviewExt ? 'lib-review-core.js' : !(globalThis.BDTReviewTexts && BDTReviewTexts.parts) ? 'lib-review-texts.js'
      : !globalThis.__bdtFairReviews ? 'fair-reviews.js' : '',
  },
}, (rt, kit) => {
  if (globalThis.__bdtPartsReviews) globalThis.__bdtPartsReviews.dispose();
  const P = BDTPartsData, M = BDTPartsCore, X = BDTReviewExt, T = BDTReviewTexts, R = BDTReviewData, gv = rt.globalVars;
  const arr = (name) => rt.objects[name] && rt.objects[name].getFirstInstance();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const lang = () => { const l = Math.round(num(gv.LanguageChoose)); return l >= 0 && l < 15 ? l : 0; };
  const today = () => num(gv.DayTotal);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const releaseDay = (fn, x, y) => { const d = num(arr(R.engines[fn].device).getAt(x, y, R.releaseCol)); return d > 0 ? d : today(); };

  // the designer's cursors of an own chip (the series and the chip in it) from its id
  function cursorOf(find, id) {
    const chips = arr(find.chips), series = arr(find.series);
    if (!chips || !series) return null;
    const list = [], ids = [];
    for (let x = 0; x < chips.width; x++) list.push({ id: chips.getAt(x, 0), series: chips.getAt(x, 1) });
    for (let s = 0; s < series.width; s++) ids.push(series.getAt(s, 0));
    return M.ownCursor(list, ids, id);
  }
  // a phone's designer looks for an own chip in its chip list (Temp) while the list is filled, else by its id: the
  // list is emptied while f runs and restored afterwards
  function withoutTemp(name, f) {
    const a = arr(name);
    if (!a || a.height < 56) return f();
    const w = a.width, h = a.height, d = a.depth, data = [];
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) data.push(a.getAt(x, y, z));
    a.setSize(w, 1, d);
    try { return f(); } finally {
      a.setSize(w, h, d);
      let i = 0;
      for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) a.setAt(data[i++], x, y, z);
    }
  }
  // the designer's variables from a released model's columns while f runs (every variable restored afterwards)
  function withModel(fn, x, y, f) {
    const p = P.engines[fn], dev = arr(R.engines[fn].device);
    const saved = {};
    for (const k of Object.keys(gv)) saved[k] = gv[k];
    try {
      for (const part of [p.chip, p.os]) if (part) for (const [c, v] of Object.entries(part.cols)) gv[v] = dev.getAt(x, y, +c);
      for (const k of ['cpu', 'gpu']) {
        const c = p.chip && p.chip[k], find = c && c.find;
        if (!find || !find.cursors || num(gv[p.chip.cols[c.typeCol]]) !== c.ownValue) continue;
        const cur = cursorOf(find, gv[find.idVar]);
        if (cur) { gv[find.cursors[0]] = cur.series; gv[find.cursors[1]] = cur.model; }
      }
      gv.DayTotal = releaseDay(fn, x, y);
      const temp = p.chip && p.chip.cpu.find && p.chip.cpu.find.temp;
      return temp ? withoutTemp(temp, f) : f();
    } finally { for (const k of Object.keys(saved)) gv[k] = saved[k]; }
  }

  // ── OS ──
  const seedOf = () => String(gv.CompanyName ?? '') + ':' + Math.round(today() - num(globalThis.getCampaignDaysLived?.()));
  function market(family, day) {
    const o = P.osArrays[family], a = arr(o.array), f = o.fields, list = [];
    if (a) for (let x = 0; x < a.width; x++) {
      const start = num(a.getAt(x, f.start));
      if (start > day || a.getAt(x, f.id) === '') continue;
      list.push({ id: num(a.getAt(x, f.id)), version: String(a.getAt(x, f.version)), start, end: num(a.getAt(x, f.end)) });
    }
    return list;
  }
  function licencePrice(id) {
    const a = arr(P.license.array), f = P.license.fields;
    if (a) for (let x = 0; x < a.width; x++) if (num(a.getAt(x, f.id)) === id) return num(a.getAt(x, f.price));
    return 0;
  }
  // the player's OS of a family: its released versions (the newest first) with rating ★, licence and release day
  function ownOs(family) {
    const a = arr(P.osArrays[family].own), f = P.ownOs.fields, list = [];
    if (a) for (let x = 0; x < a.width; x++) {
      const release = num(a.getAt(x, f.release));
      if (release <= 0 || a.getAt(x, f.name) === '') continue;
      list.push({ name: String(a.getAt(x, f.name)), version: String(a.getAt(x, f.version)), stars: num(a.getAt(x, f.rating)),
        private: String(a.getAt(x, f.license)) === P.ownOs.privateValue, release });
    }
    return list;
  }
  // the rating of the OS the designer variables hold now (an own OS is known by its name, its version by the name of
  // the version)
  function osNow(fn, day) {
    const e = P.engines[fn];
    if (!e || !e.os) return null;
    const list = market(e.os.family, day), own = ownOs(e.os.family);
    const newest = Math.max(0, ...list.map(o => o.start), ...own.filter(o => o.release <= day).map(o => o.release));
    const name = String(gv.OperationSystem_Text), version = String(gv.OperationSystemVersion_Text);
    const mine = own.filter(o => o.name === name);
    if (mine.length) {
      // the game keeps only the last versions: an older one counts as the oldest kept, without an age penalty
      const known = mine.find(o => o.version === version), v = known || mine[mine.length - 1];
      const last = mine.find(o => o.release <= day);
      return M.osRating({ base: M.ownBase(v.stars), versionDay: known ? Math.min(v.release, day) : newest, newestDay: newest,
        supported: last ? M.ownSupported(last.release, day) : true, own: true, private: v.private });
    }
    const id = num(gv.OperationSystemID);
    const row = list.find(o => o.id === id && o.version === version) || list.filter(o => o.id === id).pop();
    if (!row) return null;
    const price = licencePrice(id), paid = M.paidBase(price, [...new Set(list.map(o => o.id))].map(licencePrice));
    const base = paid ?? M.freeBase(seedOf() + ':' + e.os.family + ':' + id);
    return M.osRating({ base, versionDay: row.start, newestDay: newest, supported: !(row.end > 0 && row.end < day), own: false, private: false });
  }
  const osOf = (fn, src) => (src === 'editor' ? osNow(fn, today()) : withModel(fn, src.x, src.y, () => osNow(fn, today())));

  // ── processor and graphics ──
  function chipNow(fn) {
    const c = P.engines[fn] && P.engines[fn].chip, f = c && globalThis[c.scoreFn];
    if (typeof f !== 'function') return null;
    const s = f(rt);
    if (!s) return null;
    const ownCpu = c.cpu.ownValue !== null && num(gv[c.cols[c.cpu.typeCol]]) === c.cpu.ownValue;
    let gpu = null;
    if (c.gpu && typeof globalThis[c.gpuBars] === 'function') {
      const b = globalThis[c.gpuBars](rt);
      gpu = b && b.bars ? M.gpuRating(b.bars, num(gv[c.cols[c.gpu.typeCol]]) === c.gpu.ownValue) : null;
    }
    return { cpu: M.chipRating(s, c.group, ownCpu), gpu };
  }
  const chipOf = (fn, src) => (src === 'editor' ? chipNow(fn) : withModel(fn, src.x, src.y, () => chipNow(fn)));

  // ── the categories of the fair reviews ──
  const memo = new Map();   // fn:x:y -> { os, cpu, gpu } of one day
  function ratings(fn, x, y) {
    const k = fn + ':' + x + ':' + y;
    if (!memo.has(k)) {
      const r = withModel(fn, x, y, () => ({ os: osNow(fn, today()), ...(chipNow(fn) || {}) }));
      memo.set(k, { os: r.os ?? null, cpu: r.cpu ?? null, gpu: r.gpu ?? null });
    }
    return memo.get(k);
  }
  kit.on('day', () => memo.clear());
  const text = (id) => (score, L) => { const [r, s] = pick(T.parts[id][BDTReviewCore.reviewBand(score)]); return [T.t(r, L), T.t(s, L)]; };
  const enginesWith = (key, rule) => Object.fromEntries(Object.entries(P.engines).filter(([, e]) => key(e)).map(([fn]) => [fn, rule(fn)]));
  const cpuRule = (fn) => (fn === 'ReviewsEngine_Smartphones' || fn === 'ReviewsEngine_Tablets' ? { replaces: ['cpu'] }
    : fn === 'ReviewsEngine_Laptops' ? { moves: { cpu: 'memory' } } : {});
  const defs = {
    os: { engines: enginesWith(e => e.os, () => ({})), score: (fn, x, y) => ratings(fn, x, y).os, text: text('os') },
    cpu: { engines: enginesWith(e => e.chip, cpuRule), score: (fn, x, y) => ratings(fn, x, y).cpu, text: text('cpu') },
    gpu: { engines: enginesWith(e => e.chip && e.chip.gpu, () => ({})), score: (fn, x, y) => ratings(fn, x, y).gpu, text: text('gpu') },
  };
  for (const [id, d] of Object.entries(defs)) X.categories.set(id, d);
  const unregister = () => { for (const [id, d] of Object.entries(defs)) if (X.categories.get(id) === d) X.categories.delete(id); };

  // Task 7 adds the OS rating in the designer here

  const api = { osOf, chipOf, osNow, withModel, ratings, dispose() { unregister(); memo.clear(); delete globalThis.__bdtPartsReviews; } };
  globalThis.__bdtPartsReviews = api;
  kit.onStop(() => api.dispose());
  return () => api.dispose();
});
