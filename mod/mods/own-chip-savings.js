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

  // ── the designer: the saving on the chip page, how much of it the price can take on the price page ──
  const TXT = {
    chip: OCS_L('Own chip: production ${own}, market price ${market} → saving ${saving} per unit',
      'Собственный чип: производство ${own}, рыночная цена ${market} → экономия ${saving} за штуку',
      'Eigener Chip: Herstellung ${own}, Marktpreis ${market} → Ersparnis ${saving} pro Stück',
      'Puce maison : production ${own}, prix du marché ${market} → économie de ${saving} par unité',
      'Chip proprio: produzione ${own}, prezzo di mercato ${market} → risparmio di ${saving} per unità',
      'Chip propio: producción ${own}, precio de mercado ${market} → ahorro de ${saving} por unidad',
      'अपनी चिप: उत्पादन ${own}, बाज़ार मूल्य ${market} → प्रति यूनिट ${saving} की बचत',
      'Kendi çipin: üretim ${own}, piyasa fiyatı ${market} → birim başına ${saving} tasarruf',
      'Chip próprio: produção ${own}, preço de mercado ${market} → economia de ${saving} por unidade',
      'Власний чип: виробництво ${own}, ринкова ціна ${market} → економія ${saving} на штуці',
      'Chip sendiri: produksi ${own}, harga pasar ${market} → hemat ${saving} per unit',
      'Własny układ: produkcja ${own}, cena rynkowa ${market} → oszczędność ${saving} na sztuce',
      '自研芯片：生产成本 ${own}，市场价 ${market} → 每台节省 ${saving}',
      '자체 칩: 생산 ${own}, 시장가 ${market} → 대당 ${saving} 절감',
      '自社チップ：製造 ${own}、市場価格 ${market} → 1台あたり ${saving} の節約'),
    price: OCS_L('Your own chip saves ${saving} per unit. You can raise the price by up to ${raise} without buyers and reviewers taking it as overpriced.',
      'Собственный чип экономит ${saving} на штуке. Цену можно поднять до ${raise}, и покупатели с обозревателями не сочтут её завышенной.',
      'Dein eigener Chip spart ${saving} pro Stück. Du kannst den Preis um bis zu ${raise} anheben, ohne dass Käufer und Tester ihn als überteuert ansehen.',
      'Votre puce maison économise ${saving} par unité. Vous pouvez augmenter le prix jusqu’à ${raise} sans que les acheteurs et les testeurs le jugent trop cher.',
      'Il tuo chip fa risparmiare ${saving} per unità. Puoi alzare il prezzo fino a ${raise} senza che acquirenti e recensori lo considerino troppo caro.',
      'Tu chip propio ahorra ${saving} por unidad. Puedes subir el precio hasta ${raise} sin que compradores ni críticos lo consideren caro.',
      'आपकी अपनी चिप प्रति यूनिट ${saving} बचाती है। आप कीमत ${raise} तक बढ़ा सकते हैं, खरीदार और समीक्षक इसे महंगा नहीं मानेंगे।',
      'Kendi çipin birim başına ${saving} tasarruf sağlıyor. Fiyatı ${raise} kadar artırabilirsin; alıcılar ve eleştirmenler pahalı bulmaz.',
      'Seu chip próprio economiza ${saving} por unidade. Você pode aumentar o preço em até ${raise} sem que compradores e críticos o achem caro.',
      'Власний чип заощаджує ${saving} на штуці. Ціну можна підняти до ${raise}, і покупці з оглядачами не вважатимуть її завищеною.',
      'Chip buatanmu menghemat ${saving} per unit. Kamu bisa menaikkan harga hingga ${raise} tanpa pembeli dan pengulas menganggapnya kemahalan.',
      'Własny układ oszczędza ${saving} na sztuce. Możesz podnieść cenę o maksymalnie ${raise}, a kupujący i recenzenci nie uznają jej za zawyżoną.',
      '自研芯片每台节省 ${saving}。你可以把售价提高最多 ${raise}，买家和评测者不会觉得定价过高。',
      '자체 칩으로 대당 ${saving}를 절감합니다. 가격을 최대 ${raise}까지 올려도 구매자와 리뷰어가 비싸다고 여기지 않습니다.',
      '自社チップで1台あたり ${saving} 節約できます。価格を最大 ${raise} まで上げても、購入者やレビュアーに割高とは見なされません。'),
  };
  const money = (v) => Math.round(v).toLocaleString('en-US');
  const say = (t, vars) => { let s = t[Object.keys(t)[lang()]] || t.en; for (const k in vars) s = s.replace('{' + k + '}', vars[k]); return s; };
  const byType = new Map(Object.entries(R.engines).map(([fn, e]) => [e.costType, fn]));
  const byUid = (uid) => { try { return uid ? rt.getInstanceByUid(uid) : null; } catch { return null; } };
  const note = kit.ui.el('div', { className: 'bdt-chip-saving', style: { position: 'fixed', display: 'none', pointerEvents: 'none',
    color: '#3ddc84', fontFamily: kit.ui.font, lineHeight: '1.2', textShadow: '0 0 .6vh #000', zIndex: 1 } });
  // the designer computes the cost on every change; the saving only when the chip or the cost changed
  let nowKey = '', nowVal = null;
  function savingNowCached(fn) {
    const c = P.engines[fn] && P.engines[fn].chip;
    if (!c) return null;
    const k = fn + ':' + today() + ':' + Object.values(c.cols).map(v => gv[v]).join(',') + ':' + gv.DeviceCostPrice;
    if (k !== nowKey) { nowKey = k; nowVal = savingNow(fn); }
    return nowVal;
  }
  let shownKey = '';
  kit.on('tick', () => {
    const fn = byType.get(String(gv.DeviceType));
    let inst = null, kind = '';
    if (fn) for (const [k, uid] of [['chip', P.uids.chip[fn]], ['chip', P.uids.gpu[fn]], ['price', P.uids.price]]) {
      const i = byUid(uid);
      if (i && i.isVisible && i.layer && i.layer.isVisible) { inst = i; kind = k; break; }
    }
    const s = inst ? savingNowCached(fn) : null;
    if (!s || !(s.saving > 0)) { note.style.display = 'none'; return; }
    const key = kind + ':' + lang() + ':' + Math.round(s.saving) + ':' + Math.round(s.chipOwn) + ':' + share();
    if (key !== shownKey) {
      shownKey = key;
      note.textContent = kind === 'chip'
        ? say(TXT.chip, { own: money(s.chipOwn), market: money(s.chipOwn + s.saving), saving: money(s.saving) })
        : say(TXT.price, { saving: money(s.saving), raise: money(share() * s.saving) });
    }
    // the chip page: right of the selector box the series name is centred in (it reaches about 60 px past the text
    // box), in the free column before the device picture; the price page: centred in the panel between the device
    // name and the price slider (the production cost card is the first of three)
    const b = inst.getBoundingBox(), L = inst.layer, k = (L.layerToCssPx(1000, 0)[0] - L.layerToCssPx(0, 0)[0]) / 1000;
    const chip = kind === 'chip', [x, y] = chip ? L.layerToCssPx(b.right + 80, (b.top + b.bottom) / 2) : L.layerToCssPx(b.left + 536, b.bottom + 205);
    note.style.left = x + 'px';
    note.style.top = y + 'px';
    note.style.transform = chip ? 'translateY(-50%)' : 'translate(-50%, -50%)';
    note.style.textAlign = chip ? 'left' : 'center';
    note.style.maxWidth = (chip ? 260 : 900) * k + 'px';
    note.style.fontSize = 22 * k + 'px';
    note.style.display = '';
  });

  // off: the live test switches the sales factor off for a day
  const api = { off: false, savingNow, savingOf, factor, share, marketCost,
    dispose() { BDTReviewExt.cost.delete(costHook); cache.clear(); delete globalThis.__bdtOwnChipSavings; } };
  globalThis.__bdtOwnChipSavings = api;
  kit.onStop(() => api.dispose());
  return () => api.dispose();
});
