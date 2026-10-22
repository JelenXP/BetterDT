// Fair reviews – the math, without the game: price class, generations, price, value for money, innovation,
// the shown categories, the final rating, the innovation sales bonus and the innovative parts of a device. Used by fair-reviews.js and
// research-breakthroughs.js, and by the node tests (tests/review-core.test.mjs).
(() => {
  const round1 = (v) => Math.round(v * 10) / 10;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  // generations behind 0 (or a part from the future), 1, 2, 3, 4, 5+
  const GEN = {
    budget:   [[8, 10], [6, 7], [5, 6], [5, 6], [4, 5], [1, 3]],
    mid:      [[8, 10], [6, 7], [5, 6], [4, 5], [1, 3], [1, 3]],
    flagship: [[8, 10], [6, 7], [4, 5], [1, 3], [1, 3], [1, 3]],
  };
  const PRICE_BASE = [20, 30, 35, 40];
  const PRICE_SHIFT = { budget: -5, mid: 0, flagship: 10 };
  const PRICE_BANDS = [[9, 10], [7, 8], [5, 6], [3, 4], [1, 2]];
  const PRICE_WEIGHT = 2, SHOWN_MUL = 1.25, FINAL_JITTER = 0.3, VALUE_JITTER = 0.5, INNOV_JITTER = 0.3;
  const FADE_DAYS = 60;

  const priceClass = (share) => share <= 0.40 ? 'budget' : share <= 0.75 ? 'mid' : 'flagship';
  const genRange = (cls, gens) => GEN[cls][clamp(Math.floor(gens), 0, 5)];
  const uniform = (a, b, rng) => round1(a + (b - a) * rng());
  const innovationShift = (n) => 5 * Math.min(n, 3) + Math.max(0, Math.min(n, 10) - 3);
  const priceLimits = (cls, n) => PRICE_BASE.map(l => l + PRICE_SHIFT[cls] + innovationShift(n));
  const priceBand = (markup, limits) => limits.filter(l => markup >= l).length;
  const priceRange = (band) => PRICE_BANDS[band];
  const overpriced = (markup, limits) => markup >= limits[2];
  const quality = (gens) => gens.length ? mean(gens.map(g => Math.max(0, 1 - Math.max(0, g) / 6))) : 0.5;
  function valueScore(q, share, rng) {
    const r = q / share;
    const base = r >= 2 ? 10 : r >= 1.3 ? 8 + 2 * (r - 1.3) / 0.7 : r >= 0.9 ? 4 + 3 * (r - 0.9) / 0.4
      : r >= 0.3 ? 1 + 2 * (r - 0.3) / 0.6 : 1;
    return round1(clamp(base + (rng() * 2 - 1) * VALUE_JITTER, 1, 10));
  }
  const innovationBase = (n) => n <= 3 ? 7.5 + 0.5 * n : Math.min(10, 9 + 0.15 * (Math.min(n, 10) - 3));
  const innovationScore = (n, rng) => round1(clamp(innovationBase(n) + (rng() * 2 - 1) * INNOV_JITTER, 1, 10));
  function categoryScores(aspects) {
    const by = {};
    for (const x of aspects) (by[x.cat] = by[x.cat] || []).push(x.score);
    const out = {};
    for (const [c, v] of Object.entries(by)) out[c] = round1(mean(v));
    return out;
  }
  // 2 highest, then 2 lowest (lowest first); an overpriced price takes the place of the higher of the two lowest
  function pickShown(scores, priceOver) {
    const ids = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
    const best = ids.slice(0, 2);
    let worst = ids.slice(2).reverse().slice(0, 2);
    if (priceOver && !worst.includes('price')) worst = [worst[0], 'price'];
    if (priceOver && best.includes('price')) best.splice(best.indexOf('price'), 1, ids.find(i => !best.includes(i) && !worst.includes(i)));
    return [...best, ...worst];
  }
  function finalRating(scores, shown, rng) {
    let s = 0, w = 0;
    for (const [c, v] of Object.entries(scores)) {
      const k = (c === 'price' ? PRICE_WEIGHT : 1) * (shown.includes(c) ? SHOWN_MUL : 1);
      s += v * k; w += k;
    }
    return clamp(Math.round(s / w + (rng() * 2 - 1) * FINAL_JITTER), 1, 10);
  }
  // the game's closing phrase bands: score ≤ 3, 4–7, ≥ 8 (on the rounded score)
  const reviewBand = (score) => { const r = Math.round(score); return r <= 3 ? 0 : r <= 7 ? 1 : 2; };
  const salesBonus = (n) => n <= 2 ? 0.1 * n : n <= 3 ? 0.2 + 0.05 * (n - 2) : 0.25 + 0.02 * (Math.min(n, 10) - 3);
  const effectiveParts = (borns, day) => borns.reduce((s, b) => s + clamp(1 - (day - b) / FADE_DAYS, 0, 1), 0);

  // the parts of a device in the game (rt = the runtime, D = BDTReviewData): a column of the device – model aspects
  // read the design array at (x, model, col), the processors and graphics cards their own design array at (x, col)
  const inst = (rt, name) => rt.objects[name] && rt.objects[name].getFirstInstance();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const devAt = (rt, gen, x, y, col) => { const a = inst(rt, gen.src); return a ? (gen.model ? a.getAt(x, y, col) : a.getAt(x, col)) : 0; };
  // the component array of a generational aspect: some depend on a switch of the device (SSD or HDD)
  function compOf(rt, gen, x, y) {
    const c = gen.arrays.length > 1 ? gen.arrays.find(a => (String(devAt(rt, gen, x, y, a.when.col)) === 'ON') === a.when.on) : gen.arrays[0];
    return c && inst(rt, c.array) ? { a: inst(rt, c.array), bornCol: c.bornCol } : null;
  }
  // generations behind the newest part on the market at `day` (negative: a part from the future), and its born day
  function generation(rt, gen, x, y, day) {
    const c = compOf(rt, gen, x, y);
    if (!c) return null;
    const row = Math.round(num(devAt(rt, gen, x, y, gen.col)));
    if (row < 0 || row >= c.a.width) return null;
    let n = 0;
    for (let i = 0; i < c.a.width; i++) if (num(c.a.getAt(i, c.bornCol)) <= day) n++;
    return { gens: n - 1 - row, born: num(c.a.getAt(row, c.bornCol)) };
  }
  // the innovative parts of a device: every distinct generational part born after `day`
  function partsOf(rt, D, designArray, x, y, day) {
    const borns = [], seen = new Set();
    for (const e of Object.values(D.engines)) {
      if (e.device !== designArray) continue;
      for (const s of e.aspects) {
        if (!s.gen) continue;
        const k = s.gen.src + ':' + s.gen.col;
        if (seen.has(k)) continue;
        seen.add(k);
        const g = generation(rt, s.gen, x, y, day);
        if (g && g.born > day) borns.push(g.born);
      }
    }
    return { count: borns.length, borns };
  }

  globalThis.BDTReviewCore = Object.freeze({
    priceClass, genRange, uniform, innovationShift, priceLimits, priceBand, priceRange, overpriced, quality,
    valueScore, innovationBase, innovationScore, categoryScores, pickShown, finalRating, reviewBand, salesBonus,
    effectiveParts, generation, partsOf, PRICE_WEIGHT, SHOWN_MUL,
  });
})();
