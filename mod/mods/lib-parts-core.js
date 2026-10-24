// Own parts – the math, without the game: the OS rating (free, paid and own OS, version age, support, own bonus),
// the processor and graphics ratings, the game's price factor of the sales and the sales ratio of an own chip's
// saving, and the designer cursors of an own chip. Used by parts-reviews.js, own-chip-savings.js and the node tests
// (tests/parts-core.test.mjs).
(() => {
  const YEAR = 365;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round1 = (v) => Math.round(v * 10 + 1e-9) / 10;
  const OS = { FREE: [2.5, 4.5], PAID: [5, 9.5], H: 1000, AGE_STEP: 0.5, AGE_MAX: 3, NO_SUPPORT: 3, OWN: 0.5,
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
  const ownBase = (stars) => (stars > 0 ? 10 * stars / (stars + OS.H) : 0);
  const ownSupported = (lastRelease, day) => day - lastRelease <= OS.OWN_SUPPORT_DAYS;
  function osRating(o) {
    const years = Math.max(0, Math.floor((o.newestDay - o.versionDay) / YEAR));
    let r = o.base - Math.min(OS.AGE_MAX, OS.AGE_STEP * years) - (o.supported ? 0 : OS.NO_SUPPORT);
    if (o.own) r += o.private ? OS.OWN_PRIVATE : OS.OWN;
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

  globalThis.BDTPartsCore = Object.freeze({ OS, WEIGHTS, GPU_WEIGHTS, seeded, freeBase, paidBase, ownBase, ownSupported,
    osRating, chipRating, gpuRating, priceFactor, refCost, salesRatio, ownCursor, shareOf, fmt1 });
})();
