// Own parts – the math, without the game: the OS rating (free, paid and own OS, version age, support, own bonus),
// the processor and graphics ratings, the game's price factor of the sales and the sales ratio of an own chip's
// saving, and the designer cursors of an own chip; in the game, a released model's designer variables. Used by
// parts-reviews.js, own-chip-savings.js and the node tests (tests/parts-core.test.mjs).
(() => {
  const YEAR = 365;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round1 = (v) => Math.round(v * 10 + 1e-9) / 10;
  const OS = { FREE: [2.5, 4.5], PAID: [5, 9.5], OWN: [2, 1.5, 9], AGE_STEP: 0.5, AGE_MAX: 3, NO_SUPPORT: 3, OWN_BONUS: 0.5,
    OWN_PRIVATE: 1, OWN_SUPPORT_DAYS: 730 };
  // the weights of the designer's indicators (1–100) by device group, and of the GPU bars (0–1)
  const WEIGHTS = {
    mobile: { perf: 0.4, energy: 0.35, power: 0.15, gaming: 0.1 },
    laptop: { perf: 0.4, power: 0.3, energy: 0.2, gaming: 0.1 },
    console: { gaming: 0.45, power: 0.35, perf: 0.2 },
    other: { perf: 0.5, energy: 0.3, power: 0.2 },
  };
  const GPU_WEIGHTS = { gFlops: 0.4, gTex: 0.2, gFill: 0.2, gClock: 0.1, gVram: 0.1 };
  const OWN_CHIP = 0.5, SHARES = { 50: 0.5, 70: 0.7, 85: 0.85 }, DEFAULT_SHARE = 0.7;
  // languages with a decimal comma: ru de fr it es tr pt uk id pl
  const COMMA = new Set([1, 2, 3, 4, 5, 7, 8, 9, 10, 11]);

  // a fixed number in [0, 1) for a text (FNV-1a and a final mix)
  function seeded(text) {
    let h = 2166136261;
    for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const freeBase = (seedText) => OS.FREE[0] + (OS.FREE[1] - OS.FREE[0]) * seeded(seedText);
  // the licence price between the cheapest and the dearest paid licence of the market, on a log scale
  function paidBase(price, prices) {
    const p = prices.filter(v => v > 0);
    if (!(price > 0) || !p.length) return null;
    const lo = Math.min(...p), hi = Math.max(...p);
    if (hi <= lo) return (OS.PAID[0] + OS.PAID[1]) / 2;
    const t = clamp(Math.log(price / lo) / Math.log(hi / lo), 0, 1);
    return OS.PAID[0] + (OS.PAID[1] - OS.PAID[0]) * t;
  }
  // an own OS: from 2 with no rating, +1.5 for every tenfold ★ (its updates add up the rating), at most 9
  const ownBase = (stars) => Math.min(OS.OWN[2], OS.OWN[0] + OS.OWN[1] * Math.log10(Math.max(0, stars) + 1));
  const ownSupported = (lastRelease, day) => day - lastRelease <= OS.OWN_SUPPORT_DAYS;
  function osRating(o) {
    const years = Math.max(0, Math.floor((o.newestDay - o.versionDay) / YEAR));
    let r = o.base - Math.min(OS.AGE_MAX, OS.AGE_STEP * years) - (o.supported ? 0 : OS.NO_SUPPORT);
    if (o.own) r += o.private ? OS.OWN_PRIVATE : OS.OWN_BONUS;
    return round1(clamp(r, 0, 10));
  }
  // the weighted mean of the values there are (null when there is none)
  function weighted(values, w) {
    let s = 0, n = 0;
    for (const [k, v] of Object.entries(w)) {
      const x = values ? values[k] : null;
      if (x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x))) { s += v * Number(x); n += v; }
    }
    return n > 0 ? s / n : null;
  }
  const rated = (r, own) => (r === null ? null : round1(clamp(r + (own ? OWN_CHIP : 0), 0, 10)));
  const chipRating = (scores, group, own) => { const r = weighted(scores, WEIGHTS[group] || WEIGHTS.other); return rated(r === null ? null : r / 10, own); };
  const gpuRating = (bars, own) => { const r = weighted(bars, GPU_WEIGHTS); return rated(r === null ? null : r * 10, own); };
  // the game's price factor of the daily sales (_priceFactor, not exported): ((fair markup) / (price / cost))^EXP
  function priceFactor(cost, price, rating, cfg) {
    if (!(cost > 0) || !(price > 0)) return 1;
    const fair = cfg.PRICE_FAIR_BASE + cfg.PRICE_FAIR_PER_RATING * (rating > 0 ? rating : 0);
    if (!(fair > 0)) return 1;
    const f = clamp(Math.pow(fair / (price / cost), cfg.PRICE_EXP), cfg.PRICE_MIN_MULT, cfg.PRICE_MAX_MULT);
    return Number.isFinite(f) && f > 0 ? f : 1;
  }
  const refCost = (cost, saving, share) => cost + share * Math.max(0, saving);
  // F(cost, price, rating): the price factor
  function salesRatio(F, cost, ref, price, rating) {
    const a = F(cost, price, rating), b = F(ref, price, rating);
    return a > 0 && b > 0 ? b / a : 1;
  }
  // the designer's cursors of an own chip (as _pickOwnColumn reads them): the series in the order of the series list
  // (only series with chips count) and the chip among the chips of its series in array order, both 1-based;
  // chips = [{ id, series }] in array order, seriesIds in list order
  function ownCursor(chips, seriesIds, id) {
    let g = 0;
    for (const s of seriesIds) {
      const cols = [];
      chips.forEach((c, x) => { if (Number(c.series) === Number(s)) cols.push(x); });
      if (!cols.length) continue;
      g++;
      const k = cols.findIndex(x => Number(chips[x].id) === Number(id));
      if (k >= 0) return { series: g, model: k + 1, col: cols[k] };
    }
    return null;
  }
  const shareOf = (option) => SHARES[String(option)] ?? DEFAULT_SHARE;
  const fmt1 = (v, lang) => { const s = (Math.round(v * 10) / 10).toFixed(1); return COMMA.has(lang) ? s.replace('.', ',') : s; };

  // ── in the game (rt = the runtime, with BDTPartsData and BDTReviewData) ──
  const inst = (rt, name) => rt.objects[name] && rt.objects[name].getFirstInstance();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  // f runs with the global variables restored afterwards (the game's cost and score functions write some)
  function withVars(rt, f) {
    const gv = rt.globalVars, saved = {};
    for (const k of Object.keys(gv)) saved[k] = gv[k];
    try { return f(); } finally { for (const k of Object.keys(saved)) gv[k] = saved[k]; }
  }
  // which chips of the designer variables are own: { cpu, gpu }
  function ownChips(rt, fn) {
    const c = globalThis.BDTPartsData.engines[fn].chip, gv = rt.globalVars;
    if (!c) return { cpu: false, gpu: false };
    return { cpu: c.cpu.ownValue !== null && num(gv[c.cols[c.cpu.typeCol]]) === c.cpu.ownValue,
      gpu: !!c.gpu && num(gv[c.cols[c.gpu.typeCol]]) === c.gpu.ownValue };
  }
  // the designer's cursors of an own chip (the series and the chip in it) from its id
  function cursorOf(rt, find, id) {
    const chips = inst(rt, find.chips), series = inst(rt, find.series);
    if (!chips || !series) return null;
    const list = [], ids = [];
    for (let x = 0; x < chips.width; x++) list.push({ id: chips.getAt(x, 0), series: chips.getAt(x, 1) });
    for (let s = 0; s < series.width; s++) ids.push(series.getAt(s, 0));
    return ownCursor(list, ids, id);
  }
  // a phone's designer looks for an own chip in its chip list (Temp) while the list is filled, else by its id: the
  // list is emptied while f runs and restored afterwards
  function withoutTemp(rt, name, f) {
    const a = inst(rt, name);
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
  // the designer's variables from a released model's columns (its chip and OS, the cursors of an own chip, the day
  // of its release) while f runs; every variable is restored afterwards
  function withModel(rt, fn, x, y, f) {
    const P = globalThis.BDTPartsData, R = globalThis.BDTReviewData, p = P.engines[fn], dev = inst(rt, R.engines[fn].device), gv = rt.globalVars;
    return withVars(rt, () => {
      for (const part of [p.chip, p.os]) if (part) for (const [c, v] of Object.entries(part.cols)) gv[v] = dev.getAt(x, y, +c);
      const own = ownChips(rt, fn);
      for (const k of ['cpu', 'gpu']) {
        const find = own[k] && p.chip[k].find;
        if (!find || !find.cursors) continue;
        const cur = cursorOf(rt, find, gv[find.idVar]);
        if (cur) { gv[find.cursors[0]] = cur.series; gv[find.cursors[1]] = cur.model; }
      }
      const d = num(dev.getAt(x, y, R.releaseCol));
      if (d > 0) gv.DayTotal = d;
      const temp = p.chip && p.chip.cpu.find && p.chip.cpu.find.temp;
      return temp ? withoutTemp(rt, temp, f) : f();
    });
  }

  globalThis.BDTPartsCore = Object.freeze({ OS, WEIGHTS, GPU_WEIGHTS, seeded, freeBase, paidBase, ownBase, ownSupported,
    osRating, chipRating, gpuRating, priceFactor, refCost, salesRatio, ownCursor, shareOf, fmt1,
    withVars, ownChips, withModel });
})();
