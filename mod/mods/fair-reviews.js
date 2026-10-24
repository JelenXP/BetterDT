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
//   - two more categories: Value for money (quality of the parts against the price) and Innovation;
//   - a PRIVATE CPU (not sold) has no price review and no value for money, as in the game.
// The price class is the device's price against the flagship price of its type in that year (simulateDeviceCost).
// The rating the game stores and shows as the total is the mean of the 4 shown scores; while it does that, all 4
// hold the final rating: the mean of 4 reviewers, each weighing every category a bit differently (the shown ones, the
// price and the strong ones more). The average badges of the review screen show the final rating too.
// The upper row of reviews is headed "Best ratings", the lower one "Worst ratings". Under the reviews a strip shows
// every category with its score once all 4 reviews are in; the 2 best are framed green, the 2 worst red.
// Other mods can add categories and the cost the price review judges the markup against (BDTReviewExt,
// lib-review-core.js): parts-reviews.js adds the operating system, the processor and the graphics card,
// own-chip-savings.js the cost.
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

  // a PRIVATE CPU is not sold, so it has no price to review: the game drops its price reviews (the licence is in
  // the CPU editor array at y = 54) and so does this (no price, no value for money)
  const CPU_ARRAYS = { 'CPU SMARTPHONES': 'ArrayMyCPU_Smartphones', 'CPU LAPTOPS': 'ArrayMyCPU_Laptops', 'CPU CONSOLES': 'ArrayMyCPU_Consoles', 'CPU VR': 'ArrayMyCPU_VR' };
  const CPU_LICENSE_Y = 54;
  function privateCpu(e) {
    const a = CPU_ARRAYS[e.creating] && arr(CPU_ARRAYS[e.creating]);
    try { return !!a && a.height > CPU_LICENSE_Y && String(a.getAt(0, CPU_LICENSE_Y, 0) ?? '').trim() === 'PRIVATE'; } catch { return false; }
  }
  const generation = (gen, x, y, day) => C.generation(rt, gen, x, y, day);
  const partsOf = (designArray, x, y, day) => C.partsOf(rt, D, designArray, x, y, day);

  function compute(fn) {
    const e = D.engines[fn], dev = arr(e.device), temp = arr('ArrayReviews_Temp'), db = arr('ArrayReviews_DB');
    const x = 0, y = Math.round(num(gv.ReviewDeviceNowID)), day = num(gv.DayTotal), rng = Math.random;
    const X = globalThis.BDTReviewExt, extra = [...X.categories].filter(([, d]) => d.engines[fn]);
    const price = num(dev.getAt(x, y, e.priceCol));
    // the cost the markup is judged against: the production cost, or another mod's reference cost
    let cost = num(dev.getAt(x, y, e.costCol));
    for (const hook of X.cost) { const v = hook(fn, y, cost); if (Number.isFinite(v) && v > 0) cost = v; }
    const markup = cost > 0 ? (price / cost - 1) * 100 : 0;
    const flagship = num(simulateDeviceCost(e.costType, num(gv.Year), 'flagship', rt)) * 1.3;
    const share = flagship > 0 ? price / flagship : 0.5, cls = C.priceClass(share);
    const parts = partsOf(e.device, x, y, day).count;
    const limits = C.priceLimits(cls, parts);
    const range = (i) => [num(db.getAt(0, i)), num(db.getAt(1, i))];
    const priced = !privateCpu(e);
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
        if (!priced) continue;
        score = C.uniform(...C.priceRange(C.priceBand(markup, limits)), rng);
      } else {
        const [lo, hi] = range(idx);
        if (s.kind === 'yesno' && cls === 'budget' && hi <= 4) continue;
        score = C.uniform(lo, hi, rng);
        band = idx;
      }
      aspects.push({ a: s.a, group: s.group, kind: s.kind, cat: s.cat, score, idx: band ?? textFor(e, s, score, range) });
    }
    const kept = C.extraRules(aspects, extra.map(([, d]) => d.engines[fn]));
    const scores = C.categoryScores(kept);
    for (const [id, d] of extra) { const s = d.score(fn, x, y); if (Number.isFinite(s)) scores[id] = s; }
    const hasPrice = priced && e.aspects.some(a => a.kind === 'price');
    if (hasPrice) scores.value = C.valueScore(C.quality(gensList), share, rng);
    if (parts > 0) scores.innovation = C.innovationScore(parts, rng);
    const shown = C.pickShown(scores, hasPrice && 'price' in scores && C.overpriced(markup, limits));
    const final = C.finalRating(scores, shown, rng);
    return { fn, y, cls, share, markup, parts, priced, scores, shown, final, aspects: kept };
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
      const ext = globalThis.BDTReviewExt.categories.get(c);
      if (ext) {
        [review, summary] = ext.text(score, L);
      } else if (c === 'value' || c === 'innovation') {
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
  // 2 best categories are framed green and the 2 worst red, the number of innovative parts above them ─────────────
  const BEST = '#3ddc84', WORST = '#ff4f6d';
  const STAR = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z';
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  // the type's categories in display order, the ones other mods add, then price, value for money and innovation
  const order = (l) => [...D.engines[l.fn].categories, ...globalThis.BDTReviewExt.categories.keys(), 'price', 'value', 'innovation']
    .filter((c, i, a) => a.indexOf(c) === i && c in l.scores).map(c => [c, l.scores[c]]);
  // the animations: the strip rises, its items come in one by one, the stars fill up, then the frames light up
  const CSS = `
@keyframes bdt-rise { from { opacity: 0; transform: translateY(2.5vh); } }
@keyframes bdt-pop { from { opacity: 0; transform: translateY(1.5vh) scale(.85); } }
@keyframes bdt-fill { from { width: 0; } }
@keyframes bdt-frame { from { border-color: transparent; box-shadow: none; } 50% { box-shadow: 0 0 2.2vh var(--bdt-c); } }
#bdt-review-strip { animation: bdt-rise .45s ease-out both; }
#bdt-review-strip .bdt-item { animation: bdt-pop .35s cubic-bezier(.2, .9, .3, 1.3) both; }
#bdt-review-strip .bdt-fill { animation: bdt-fill .6s ease-out both; }
#bdt-review-strip .bdt-mark { animation: bdt-pop .35s cubic-bezier(.2, .9, .3, 1.3) both, bdt-frame .9s ease-out both; }
`;
  function css() {
    if (document.getElementById('bdt-review-css')) return;
    const s = document.createElement('style');
    s.id = 'bdt-review-css';
    s.textContent = CSS;
    document.head.append(s);
  }
  const star = (fill, w) => `<svg viewBox="0 0 24 24" style="width:${w};height:${w};display:block"><path d="${STAR}" fill="${fill}" stroke="#888" stroke-width=".8"/></svg>`;
  function strip(l) {
    const L = lang(), el = document.createElement('div');
    el.id = 'bdt-review-strip';
    el.style.cssText = 'position:absolute;left:0;right:0;margin:0 auto;width:fit-content;max-width:96%;display:flex;'
      + 'flex-direction:column;align-items:center;gap:.4vh;font-family:SofiaSansExtraCondensed-Medium,Oswald,"Segoe UI",sans-serif;color:#fff';
    if (l.parts > 0) {
      const p = document.createElement('div');
      p.textContent = T.t(T.innovativeParts, L).replace('{n}', l.parts);
      p.style.cssText = 'font-size:1.6vh;opacity:.9';
      el.append(p);
    }
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:.4vh .3vw;background:rgba(20,24,32,.82);'
      + 'border-radius:1vh;padding:.5vh .6vw';
    const items = order(l), end = 0.3 + items.length * 0.07;
    items.forEach(([c, v], i) => {
      const it = document.createElement('div'), pct = Math.max(0, Math.min(100, v * 10));
      const frame = l.shown.slice(0, 2).includes(c) ? BEST : l.shown.slice(2).includes(c) ? WORST : '';
      const delay = 0.3 + i * 0.07;
      it.className = frame ? 'bdt-item bdt-mark' : 'bdt-item';
      it.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:5vw;padding:.2vh .3vw;'
        + 'border-radius:.6vh;border:.25vh solid ' + (frame || 'transparent') + ';--bdt-c:' + (frame || 'transparent') + ';'
        + 'animation-delay:' + delay + 's' + (frame ? ',' + end + 's' : '');
      it.innerHTML = `<div style="display:flex;align-items:center;gap:.3vw;font-size:2.2vh;font-family:SofiaSansExtraCondensed-Bold,SofiaSansExtraCondensed-Medium,Oswald,sans-serif">${v.toFixed(1)}`
        + `<span style="position:relative;width:2.2vh;height:2.2vh">${star('#fff', '2.2vh')}`
        + `<span class="bdt-fill" style="position:absolute;left:0;top:0;height:100%;width:${pct}%;overflow:hidden;animation-delay:${delay + 0.15}s">${star('#f5c518', '2.2vh')}</span></span></div>`
        + `<div style="font-size:1.6vh;opacity:.85;text-align:center;white-space:nowrap">${esc(T.t(T.cat[c], L))}</div>`;
      row.append(it);
    });
    el.append(row);
    return el;
  }
  // a heading over a row of reviews: the text between two lines as wide as the row
  function heading(text, color) {
    const h = document.createElement('div');
    h.className = 'bdt-review-heading';
    h.style.cssText = 'position:absolute;display:flex;align-items:center;gap:1.2vw;transform:translateY(-50%);'
      + 'font-family:SofiaSansExtraCondensed-Bold,SofiaSansExtraCondensed-Medium,Oswald,sans-serif;text-transform:uppercase;'
      + 'letter-spacing:.12em;white-space:nowrap;opacity:0;color:' + color + ';text-shadow:0 0 1.2vh ' + color + '66';
    const line = (dir) => { const d = document.createElement('div'); d.style.cssText = 'flex:1;height:.18vh;background:linear-gradient(to ' + dir + ',transparent,' + color + ')'; return d; };
    const t = document.createElement('div');
    t.textContent = text;
    h.append(line('right'), t, line('left'));
    return h;
  }
  // The review screen is the game's HTML (#reviews-root): 4 cards (.review-card, the best two on top) come in one by
  // one from a blur, then a blur overlay (z-index 50) shows the average rating, and the next model's cards replace
  // them. The headings and the strip live in that page under the overlay, so it blurs them like the cards; a heading
  // takes the opacity and blur of the first card of its row, the strip comes in once the last card is in and then
  // goes with it.
  let wrap = null, heads = [], stripEl = null, shownKey = '', raf = 0;
  const cardsOf = (root) => [...root.querySelectorAll('.review-card')];
  const settled = (c) => { const cs = getComputedStyle(c); return Number(cs.opacity) >= 0.99 && !/blur\((?!0px)/.test(cs.filter); };
  function follow(el, card) {
    const cs = getComputedStyle(card);
    el.style.opacity = cs.opacity;
    el.style.filter = cs.filter === 'none' ? '' : cs.filter;
  }
  // the game's average badges (the big one and the one in the corner) show the mean of the 4 cards, but the stored
  // rating is the final one, so they show that; they come in long after the cards, so this is done before they show
  function badges(root) {
    const f = Math.round(last.final);
    for (const b of root.querySelectorAll('#reviews-summary, #reviews-summary-corner')) {
      const n = b.querySelector('.summary-num');
      if (n && n.textContent !== String(f)) n.textContent = String(f);
      b.querySelectorAll('.summary-star').forEach((s, i) => { s.classList.toggle('full', i < f); s.classList.toggle('empty', i >= f); });
    }
  }
  function sync() {
    const root = wrap.parentElement, cards = cardsOf(root);
    badges(root);
    if (cards.length < 4) { heads.forEach(h => { h.style.opacity = 0; }); return; }
    const rr = root.getBoundingClientRect(), c = cards.map(x => x.getBoundingClientRect());
    const title = document.getElementById('reviews-title'), tb = title ? title.getBoundingClientRect().bottom : c[0].top - rr.height * 0.12;
    heads.forEach((h, i) => {
      h.style.left = c[0].left - rr.left + 'px';
      h.style.width = c[1].right - c[0].left + 'px';
      h.style.fontSize = rr.height * 0.024 + 'px';
      h.style.top = (i ? (c[0].bottom + c[2].top) / 2 : (tb + c[0].top) / 2) - rr.top + 'px';
      follow(h, cards[i ? 2 : 0]);
    });
    if (!stripEl && settled(cards[3]) && !root.classList.contains('soft-exit')) {
      stripEl = strip(last);
      wrap.append(stripEl);
    }
    if (stripEl) {
      stripEl.style.bottom = rr.height * 0.012 + 'px';
      // the entrance animation is on the strip itself, so the exit with the cards goes on the wrap's copy of it
      if (root.classList.contains('soft-exit')) follow(stripEl, cards[3]);
    }
  }
  function frame() {
    raf = 0;
    if (!wrap || !wrap.isConnected) return;
    sync();
    raf = requestAnimationFrame(guardedFrame);
  }
  const guardedFrame = kit.guard(frame);
  function removeStrip() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (wrap) wrap.remove();
    wrap = null; heads = []; stripEl = null; shownKey = '';
  }
  const timer = setInterval(kit.guard(() => {
    const cls = String(gv.class), root = document.getElementById('reviews-root');
    const on = root && last && (cls === 'REVIEWS' || cls === 'REVIEWS FINISH') && byCreating.get(String(gv.DeviceTypeCreatingNow)) === last.fn;
    if (!on) return removeStrip();
    const key = lang() + ':' + last.final + ':' + JSON.stringify(last.scores);
    if (key !== shownKey || !wrap || wrap.parentElement !== root) {
      removeStrip();
      css();
      shownKey = key;
      wrap = document.createElement('div');
      wrap.id = 'bdt-review-extra';
      wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1';
      heads = [heading(T.t(T.bestRatings, lang()), BEST), heading(T.t(T.worstRatings, lang()), WORST)];
      wrap.append(...heads);
      root.append(wrap);
    }
    if (!raf) frame();
  }), 250);
  const removeCss = () => document.getElementById('bdt-review-css')?.remove();
  kit.onStop(() => { clearInterval(timer); removeStrip(); removeCss(); });

  const api = { get last() { return last; }, review, compute, partsOf, dispose() { clearInterval(timer); removeStrip(); removeCss(); delete globalThis.__bdtFairReviews; } };
  globalThis.__bdtFairReviews = api;
  return () => api.dispose();
});
