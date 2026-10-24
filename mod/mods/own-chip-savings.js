// Own chip savings – an own processor or graphics card makes a device cheaper to build; part of the saving can go
// into the price without buyers and reviewers taking the device as overpriced.
// The market price of the chip is what the game would charge for a custom chip with the same parameters: the
// device's production cost with the own chip's recorded cost left out and own chips priced like custom ones (the same
// day, research discount and perks). The saving is the difference of the two production costs. The sales and the
// price review of the fair reviews judge the price against the reference cost: the production cost + the share of
// the saving set in the settings (50, 70 or 85 %); the sales get factor F(reference) / F(cost) of the game's price
// factor. The real production cost and the profit stay as they are.
// The chip page of the designer shows the saving, the price page how much of it the price can take.
const OCS_L = (en, ru, de, fr, it, es, hi, tr, pt, uk, id, pl, zh, ko, ja) => ({ en, ru, de, fr, it, es, hi, tr, pt, uk, id, pl, zh, ko, ja });
BetterDTKit.mod('own-chip-savings', {
  info: {
    options: [{
      key: 'share', type: 'choice', default: '70',
      label: OCS_L('Saving the price can take', 'Доля экономии в цене', 'Ersparnis, die der Preis tragen darf', 'Part de l’économie dans le prix',
        'Quota del risparmio nel prezzo', 'Parte del ahorro en el precio', 'कीमत में बचत का हिस्सा', 'Fiyata yansıyabilecek tasarruf',
        'Parte da economia no preço', 'Частка економії в ціні', 'Porsi penghematan dalam harga', 'Część oszczędności w cenie',
        '价格可包含的节省比例', '가격에 반영할 절감액', '価格に含められる節約分'),
      choices: ['50', '70', '85'].map(v => ({ value: v, label: v + ' %' })),
    }],
  },
  needs: {
    functions: ['computeDeviceCost', 'getDeviceSalesConfig'],
    vars: ['DayTotal', 'LanguageChoose', 'DeviceCostPrice'],
    check: () => !globalThis.BDTPartsData ? 'lib-parts-data.js' : !globalThis.BDTPartsCore ? 'lib-parts-core.js'
      : !globalThis.BDTReviewExt ? 'lib-review-core.js' : !globalThis.BDTReviewData ? 'lib-review-data.js' : '',
  },
}, (rt, kit) => {
  if (globalThis.__bdtOwnChipSavings) globalThis.__bdtOwnChipSavings.dispose();
  const P = BDTPartsData, M = BDTPartsCore, R = BDTReviewData, gv = rt.globalVars;
  const arr = (name) => rt.objects[name] && rt.objects[name].getFirstInstance();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const lang = () => { const l = Math.round(num(gv.LanguageChoose)); return l >= 0 && l < 15 ? l : 0; };
  const today = () => num(gv.DayTotal);
  const share = () => M.shareOf(kit.option('share'));
  const byArray = new Map(Object.entries(R.engines).map(([fn, e]) => [e.device, fn]));

  const cost = (type) => M.withVars(rt, () => num(globalThis.computeDeviceCost(rt, type)));
  // the device's production cost with the own chips at their market price: the recorded own chip costs are 0 and own
  // chips cost like custom ones while it is computed (all restored right away)
  function marketCost(type) {
    const e = P.ownChipEarnings[type], undo = [];
    try {
      for (const name of [e.cpu, e.gpu].filter(Boolean)) {
        const a = arr(name);
        if (a) for (let x = 0; x < a.width; x++) {
          const v = a.getAt(x, 0, P.OWN_COST_Z);
          undo.push(() => a.setAt(v, x, 0, P.OWN_COST_Z));
          a.setAt(0, x, 0, P.OWN_COST_Z);
        }
      }
      const c = globalThis[P.chipConfig[type]] && globalThis[P.chipConfig[type]]();
      if (c && c.TYPE_MULT) { const own = c.TYPE_MULT.own; undo.push(() => { c.TYPE_MULT.own = own; }); c.TYPE_MULT.own = c.TYPE_MULT.custom; }
      return cost(type);
    } finally { for (let i = undo.length - 1; i >= 0; i--) undo[i](); }
  }
  // the production cost the game recorded for the own chips the designer variables hold (CPU + GPU); a chip's column
  // is the one with its id
  function recordedOwnCost(fn, own) {
    const c = P.engines[fn].chip, e = P.ownChipEarnings[R.engines[fn].costType];
    let t = 0;
    for (const k of ['cpu', 'gpu']) {
      const find = own[k] && c[k].find, a = find && arr(e[k]), chips = find && arr(find.chips);
      if (!a || !chips) continue;
      for (let x = 0; x < chips.width; x++) if (num(chips.getAt(x, 0)) === num(gv[find.idVar])) { t += num(a.getAt(x, 0, P.OWN_COST_Z)); break; }
    }
    return t;
  }
  // the saving of the chips the designer variables hold now (null without an own chip): the device's production cost
  // with the own chips (own) and with them at their market price (market), and the cost of the own chips (chipOwn)
  function savingNow(fn) {
    const type = R.engines[fn] && R.engines[fn].costType;
    if (!P.engines[fn] || !P.engines[fn].chip || !P.ownChipEarnings[type]) return null;
    const own = M.ownChips(rt, fn);
    if (!own.cpu && !own.gpu) return null;
    const o = cost(type), m = marketCost(type);
    return { own: o, market: m, saving: Math.max(0, m - o), chipOwn: recordedOwnCost(fn, own) };
  }
  const cache = new Map();   // fn:x:y:release:cost -> saving (a model's chips and release day do not change)
  function savingOf(fn, x, y) {
    const e = R.engines[fn], dev = e && arr(e.device);
    if (!dev || !P.engines[fn] || !P.engines[fn].chip || !P.ownChipEarnings[e.costType]) return null;
    const k = [fn, x, y, dev.getAt(x, y, R.releaseCol), dev.getAt(x, y, e.costCol)].join(':');
    if (!cache.has(k)) cache.set(k, M.withModel(rt, fn, x, y, () => savingNow(fn)));
    return cache.get(k);
  }

  // ── sales: F(reference cost) / F(cost) ──
  let cfg = null, cfgDay = -1;
  const F = (c, p, r) => M.priceFactor(c, p, r, cfg);
  function factor(name, x, y) {
    const fn = byArray.get(name);
    if (api.off || !fn) return 1;
    const s = savingOf(fn, x, y);
    if (!s || !(s.saving > 0)) return 1;
    if (cfgDay !== today() || !cfg) { cfg = globalThis.getDeviceSalesConfig(); cfgDay = today(); }
    const e = R.engines[fn], dev = arr(name), c = num(dev.getAt(x, y, e.costCol));
    return M.salesRatio(F, c, M.refCost(c, s.saving, share()), num(dev.getAt(x, y, e.priceCol)), num(dev.getAt(x, y, R.ratingCol)));
  }
  kit.salesMultiplier(factor);
  if (!BetterDTKit.salesReady()) kit.fail('daily sales script not found');

  // ── fair reviews: the price review judges the markup against the reference cost ──
  const costHook = (fn, y, c) => { const s = savingOf(fn, 0, y); return s && s.saving > 0 ? M.refCost(c, s.saving, share()) : undefined; };
  BDTReviewExt.cost.add(costHook);

  // Task 9 adds the designer texts here

  // off: the live test switches the sales factor off for a day
  const api = { off: false, savingNow, savingOf, factor, share, marketCost,
    dispose() { BDTReviewExt.cost.delete(costHook); cache.clear(); delete globalThis.__bdtOwnChipSavings; } };
  globalThis.__bdtOwnChipSavings = api;
  kit.onStop(() => api.dispose());
  return () => api.dispose();
});
