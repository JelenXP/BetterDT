// Fair reviews – the math, without the game: price class, generations, price, value for money, innovation,
// the shown categories, the final rating, the innovation sales bonus, the innovative parts of a device and the rules
// and registry of the categories other mods add. Used by fair-reviews.js and
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
  const PRICE_WEIGHT = 2, SHOWN_MUL = 1.25, FINAL_JITTER = 0.45, VALUE_JITTER = 0.5, INNOV_JITTER = 0.3;
  // the final rating is the mean of REVIEWERS reviewers; each weighs every category a bit differently, a category
  // at or above the mean score of the device by STRONG_W, the others by WEAK_W
  const REVIEWERS = 4, STRONG_W = [1.0, 1.3], WEAK_W = [0.8, 1.1];
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
    const entries = Object.entries(scores), m = mean(entries.map(([, v]) => v));
    let total = 0;
    for (let r = 0; r < REVIEWERS; r++) {
      let s = 0, w = 0;
      for (const [c, v] of entries) {
        const [lo, hi] = v >= m ? STRONG_W : WEAK_W;
        const k = (c === 'price' ? PRICE_WEIGHT : 1) * (shown.includes(c) ? SHOWN_MUL : 1) * (lo + (hi - lo) * rng());
        s += v * k; w += k;
      }
      total += s / w;
    }
    return clamp(Math.round(total / REVIEWERS + (rng() * 2 - 1) * FINAL_JITTER), 1, 10);
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
    return c && inst(rt, c.array) ? { a: inst(rt, c.array), array: c.array, bornCol: c.bornCol } : null;
  }
  // generations behind the newest part on the market at `day` (negative: a part from the future), its born day, the
  // born day of the newest part on the market and its component array
  function generation(rt, gen, x, y, day) {
    const c = compOf(rt, gen, x, y);
    if (!c) return null;
    const row = Math.round(num(devAt(rt, gen, x, y, gen.col)));
    if (row < 0 || row >= c.a.width) return null;
    let n = 0;
    for (let i = 0; i < c.a.width; i++) if (num(c.a.getAt(i, c.bornCol)) <= day) n++;
    const newest = n > 0 ? num(c.a.getAt(n - 1, c.bornCol)) : 0;
    return { gens: n - 1 - row, born: num(c.a.getAt(row, c.bornCol)), newest, array: c.array };
  }
  // the innovative parts of a device: every distinct generational part born after `day` that the game itself would not
  // list yet (a row beyond the parts it counts on the market; a list with dates out of order can offer a future part),
  // from a list the designer limits by date (D.counters); some lists offer every researched part whatever its date,
  // those are ordinary research
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
        if (g && g.gens < 0 && g.born > day && D.counters[g.array]) borns.push(g.born);
      }
    }
    return { count: borns.length, borns };
  }

  // other mods' rules for the game's aspects of a type: a replaced category is left out, a moved one counts in
  // another category (parts-reviews.js: the phones' CPU load review, the laptops' storage reviews)
  function extraRules(aspects, rules) {
    let out = aspects;
    for (const r of rules) {
      if (r.replaces) out = out.filter(x => !r.replaces.includes(x.cat));
      if (r.moves) out = out.map(x => (r.moves[x.cat] ? { ...x, cat: r.moves[x.cat] } : x));
    }
    return out;
  }
  // categories and production cost hooks other mods add to the fair reviews while they run:
  // categories: id -> { engines: { reviewFn: { replaces, moves } }, score(fn, x, y) -> 0–10 or null,
  //                     text(score, lang) -> [review, summary] }
  // cost: hooks (fn, y, cost) -> the cost the price review judges the markup against, or undefined
  globalThis.BDTReviewExt = globalThis.BDTReviewExt || { categories: new Map(), cost: new Set() };

  globalThis.BDTReviewCore = Object.freeze({
    priceClass, genRange, uniform, innovationShift, priceLimits, priceBand, priceRange, overpriced, quality,
    valueScore, innovationBase, innovationScore, categoryScores, pickShown, finalRating, reviewBand, salesBonus,
    effectiveParts, generation, partsOf, extraRules, PRICE_WEIGHT, SHOWN_MUL,
  });
})();
