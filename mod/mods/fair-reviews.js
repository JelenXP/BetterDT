// Fair reviews – the score of a device comes from all its aspects, and the reviews show its two best and two worst
// categories.
//
// The game's review function for the device type (ReviewsEngine_<Type>) still runs and pushes the aspect entries
// into ArrayReviews_Temp; after ReviewsEngineResults has picked its 4 reviews, everything is computed again from
// those entries and the device, and the 4 texts and scores are replaced:
//   - a generational aspect (the game compares the part with the newest one on the market) is scored by how many
//     generations the part is behind, with a scale that depends on the price class of the device (a budget phone
//     may have an older camera, a flagship may not); a part from the future scores like the newest one;
//   - the price aspect by the markup over the production cost, with limits that move with the class and with the
//     number of innovative parts (parts not on the market yet, see research-breakthroughs.js);
//   - a missing feature does not count against a budget device;
//   - other aspects keep the game's score range;
//   - two more categories: Value for money (quality of the parts against the price) and Innovation.
// The price class is the device's price against the flagship price of its type in that year (simulateDeviceCost).
// The rating the game stores and shows as the total is the mean of the 4 shown scores; while it does that, all 4
// hold the final rating, which weighs every category (the shown ones and the price more).
// Under the reviews a strip shows every category with its score; the 4 shown ones are framed.
BetterDTKit.mod('fair-reviews', {
  needs: {
    functions: ['simulateDeviceCost'],
    objects: ['ArrayReviews', 'ArrayReviews_Temp', 'ArrayReviews_DB', 'ArrayReviews_Text'],
    vars: ['DeviceTypeCreatingNow', 'ReviewDeviceNowID', 'DayTotal', 'Year', 'LanguageChoose',
      'ReviewRating_1', 'ReviewRating_2', 'ReviewRating_3', 'ReviewRating_4'],
    calls: ['ReviewsEngineResults', 'ReviewsTotal_ON'],
    actions: (globalThis.BDTReviewData || { ratingSids: [] }).ratingSids,
    check: () => !globalThis.BDTReviewData ? 'lib-review-data.js' : !globalThis.BDTReviewCore ? 'lib-review-core.js'
      : !globalThis.BDTReviewTexts ? 'lib-review-texts.js' : '',
  },
}, (rt, kit) => {
  if (globalThis.__bdtFairReviews) globalThis.__bdtFairReviews.dispose();
  const D = BDTReviewData, C = BDTReviewCore, T = BDTReviewTexts, gv = rt.globalVars;
  const byCreating = new Map(Object.entries(D.engines).map(([fn, e]) => [e.creating, fn]));
  const arr = (name) => rt.objects[name] && rt.objects[name].getFirstInstance();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const lang = () => { const l = Math.round(num(gv.LanguageChoose)); return l >= 0 && l < 15 ? l : 0; };
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  let last = null;
  const finals = new Map();   // fn + ':' + model -> final rating, for the stored rating

  const generation = (gen, x, y, day) => C.generation(rt, gen, x, y, day);
  const partsOf = (designArray, x, y, day) => C.partsOf(rt, D, designArray, x, y, day);

  function compute(fn) {
    const e = D.engines[fn], dev = arr(e.device), temp = arr('ArrayReviews_Temp'), db = arr('ArrayReviews_DB');
    const x = 0, y = Math.round(num(gv.ReviewDeviceNowID)), day = num(gv.DayTotal), rng = Math.random;
    const price = num(dev.getAt(x, y, e.priceCol)), cost = num(dev.getAt(x, y, e.costCol));
    const markup = cost > 0 ? (price / cost - 1) * 100 : 0;
    const flagship = num(simulateDeviceCost(e.costType, num(gv.Year), 'flagship', rt)) * 1.3;
    const share = flagship > 0 ? price / flagship : 0.5, cls = C.priceClass(share);
    const parts = partsOf(e.device, x, y, day).count;
    const limits = C.priceLimits(cls, parts);
    const range = (i) => [num(db.getAt(0, i)), num(db.getAt(1, i))];
    // the entries the game pushed, one per aspect range
    const seen = new Set(), aspects = [], gensList = [];
    for (let i = 0; i < temp.width; i++) {
      const idx = Math.round(num(temp.getAt(i, 0)));
      const s = e.aspects.find(a => a.a <= idx && idx <= a.b);
      if (!s || seen.has(s.a)) continue;
      seen.add(s.a);
      let score, band = null;
      if (s.kind === 'gen') {
        const g = generation(s.gen, x, y, day);
        if (!g) continue;
        gensList.push(g.gens);
        score = C.uniform(...C.genRange(cls, g.gens), rng);
      } else if (s.kind === 'price') {
        score = C.uniform(...C.priceRange(C.priceBand(markup, limits)), rng);
      } else {
        const [lo, hi] = range(idx);
        if (s.kind === 'yesno' && cls === 'budget' && hi <= 4) continue;
        score = C.uniform(lo, hi, rng);
        band = idx;
      }
      aspects.push({ a: s.a, group: s.group, kind: s.kind, cat: s.cat, score, idx: band ?? textFor(e, s, score, range) });
    }
    const scores = C.categoryScores(aspects);
    const hasPrice = e.aspects.some(a => a.kind === 'price');
    if (hasPrice) scores.value = C.valueScore(C.quality(gensList), share, rng);
    if (parts > 0) scores.innovation = C.innovationScore(parts, rng);
    const shown = C.pickShown(scores, hasPrice && 'price' in scores && C.overpriced(markup, limits));
    const final = C.finalRating(scores, shown, rng);
    return { fn, y, cls, share, markup, parts, scores, shown, final, aspects };
  }
  // the review text of a scored aspect: a range of its group whose score band fits the score (a generational aspect
  // or the price has its own score, not the one of the range the game drew)
  function textFor(e, s, score, range) {
    const members = e.aspects.filter(a => a.group === s.group);
    const fit = members.filter(a => { const [lo, hi] = range(a.a); return score >= 7.5 ? lo >= 8 : score < 3.5 ? hi <= 3 : lo >= 4 && lo <= 7; });
    const r = pick(fit.length ? fit : [s]);
    return randInt(r.a, r.b);
  }

  // the 4 reviews: text with the game's closing phrase for its score, summary, score
  function write(l) {
    const text = arr('ArrayReviews_Text'), rev = arr('ArrayReviews'), L = lang();
    l.shown.forEach((c, k) => {
      const score = l.scores[c], closing = rev.getAt(0, randInt(...D.closing[C.reviewBand(score)]));
      let review, summary;
      if (c === 'value' || c === 'innovation') {
        const [r, s] = c === 'value' ? pick(T.value[C.reviewBand(score)]) : pick(T.innovation);
        review = T.t(r, L); summary = T.t(s, L);
      } else {
        const own = l.aspects.filter(a => a.cat === c).sort((p, q) => p.score - q.score);
        const a = k < 2 ? own[own.length - 1] : own[0];
        review = String(rev.getAt(0, a.idx)); summary = String(rev.getAt(1, a.idx));
      }
      text.setAt(review + ' ' + closing, k, 0);
      text.setAt(summary, k, 1);
      gv['ReviewRating_' + (k + 1)] = Math.round(score);
    });
    finals.set(l.fn + ':' + l.y, l.final);
  }

  // review(fn) for tests: runs the game's review function first
  function review(fn) {
    rt.callFunction(fn);
    return (last = compute(fn));
  }

  kit.wrapCalls('ReviewsEngineResults', {
    after: () => {
      const fn = byCreating.get(String(gv.DeviceTypeCreatingNow));
      if (!fn || !arr(D.engines[fn].device)) return;
      last = compute(fn);
      write(last);
    },
  });
  // the total and the stored rating are the mean of ReviewRating_1..4: all four hold the final rating meanwhile
  let saved = null;
  const hold = {
    before: () => {
      const fn = byCreating.get(String(gv.DeviceTypeCreatingNow));
      const f = finals.get(fn + ':' + Math.round(num(gv.ReviewDeviceNowID)));
      if (f === undefined) return;
      saved = [1, 2, 3, 4].map(k => gv['ReviewRating_' + k]);
      for (const k of [1, 2, 3, 4]) gv['ReviewRating_' + k] = f;
    },
    after: () => {
      if (!saved) return;
      [1, 2, 3, 4].forEach((k, i) => { gv['ReviewRating_' + k] = saved[i]; });
      saved = null;
    },
  };
  kit.wrapCalls('ReviewsTotal_ON', hold);
  for (const sid of D.ratingSids) kit.wrapAction(sid, hold);

  // ── the breakdown strip on the review screen: every category with its score and a star filled by score / 10; the
  // 4 shown categories are framed, the number of innovative parts above them ─────────────────────────────────────
  const STAR = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z';
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  // the type's categories in display order, then price, value for money and innovation
  const order = (l) => [...D.engines[l.fn].categories, 'price', 'value', 'innovation'].filter(c => c in l.scores).map(c => [c, l.scores[c]]);
  function strip(l) {
    const L = lang(), el = document.createElement('div');
    el.id = 'bdt-review-strip';
    el.style.cssText = 'position:fixed;left:0;right:0;margin:0 auto;width:fit-content;max-width:96vw;display:flex;'
      + 'flex-direction:column;align-items:center;gap:.4vh;font-family:SofiaSansExtraCondensed-Medium,Oswald,"Segoe UI",sans-serif;color:#fff;pointer-events:none;z-index:50';
    if (l.parts > 0) {
      const p = document.createElement('div');
      p.textContent = T.t(T.innovativeParts, L).replace('{n}', l.parts);
      p.style.cssText = 'font-size:1.6vh;opacity:.9';
      el.append(p);
    }
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:.4vh .3vw;background:rgba(20,24,32,.82);'
      + 'border-radius:1vh;padding:.5vh .6vw';
    for (const [c, v] of order(l)) {
      const it = document.createElement('div'), pct = Math.max(0, Math.min(100, v * 10));
      it.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:5vw;padding:.2vh .3vw;'
        + 'border-radius:.6vh;border:.25vh solid ' + (l.shown.includes(c) ? '#f5c518' : 'transparent');
      it.innerHTML = `<div style="display:flex;align-items:center;gap:.3vw;font-size:2.2vh;font-family:SofiaSansExtraCondensed-Bold,SofiaSansExtraCondensed-Medium,Oswald,sans-serif">${v.toFixed(1)}`
        + `<svg viewBox="0 0 24 24" style="width:2.2vh;height:2.2vh"><defs><linearGradient id="bdt-g-${c}">`
        + `<stop offset="${pct}%" stop-color="#f5c518"/><stop offset="${pct}%" stop-color="#fff"/></linearGradient></defs>`
        + `<path d="${STAR}" fill="url(#bdt-g-${c})" stroke="#888" stroke-width=".8"/></svg></div>`
        + `<div style="font-size:1.6vh;opacity:.85;text-align:center;white-space:nowrap">${esc(T.t(T.cat[c], L))}</div>`;
      row.append(it);
    }
    el.append(row);
    return el;
  }
  let shownEl = null, shownKey = '';
  // just above the bottom edge of the game picture (the window may be letterboxed)
  function place() {
    const c = document.querySelector('canvas'), b = c ? c.getBoundingClientRect().bottom : innerHeight;
    shownEl.style.bottom = Math.max(0, innerHeight - b) + innerHeight * 0.012 + 'px';
  }
  function removeStrip() { if (shownEl) shownEl.remove(); shownEl = null; shownKey = ''; }
  const timer = setInterval(kit.guard(() => {
    const cls = String(gv.class);
    const on = last && (cls === 'REVIEWS' || cls === 'REVIEWS FINISH') && byCreating.get(String(gv.DeviceTypeCreatingNow)) === last.fn;
    if (!on) return removeStrip();
    const key = lang() + ':' + last.final + ':' + JSON.stringify(last.scores);
    if (key === shownKey && shownEl && shownEl.isConnected) return place();
    removeStrip();
    shownEl = strip(last); shownKey = key;
    document.body.append(shownEl);
    place();
  }), 250);
  kit.onStop(() => { clearInterval(timer); removeStrip(); });

  const api = { get last() { return last; }, review, compute, partsOf, dispose() { clearInterval(timer); removeStrip(); delete globalThis.__bdtFairReviews; } };
  globalThis.__bdtFairReviews = api;
  return () => api.dispose();
});
