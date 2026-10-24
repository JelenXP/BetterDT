// Living market – old and much-sold devices sell less, so a company has to bring out successors.
//
// While the game computes the daily sales, the popularity of each of the player's devices is multiplied by
// F = max(0.2, 1 − strength × (1 − T × S)) (kit.salesMultiplier):
// T – technology: how far the market moved on since the device came out: for every kind of part, the newest part on
//     the market now against the newest one on its release day, in years (half the most moved part, half the
//     average; a cheap model and the flagship of the same release age alike); no loss up to a year, −20 % at
//     2 years, −45 % at 4, −80 % at 8 and more.
// S – saturation: the player's customers who own a model of the category that this one does not beat (a year newer
//     technology or a rating 2 points higher) do not buy it; S = max(0.3, 1 / (1 + blocked / market size)).
// strength – grows with the player's share of the category (0.25 below 20 %, full above 60 %; the share is the
//     player's revenue split by category against the rivals' revenue split over their categories), at most 0.25
//     in the first two years, × the level in the settings (mild 0.5, normal 1, hard 1.5).
// Everything is computed from the save once a game day; nothing is saved, so switching it off restores the sales.
const LM_L = (en, ru, de, fr, it, es, hi, tr, pt, uk, id, pl, zh, ko, ja) => ({ en, ru, de, fr, it, es, hi, tr, pt, uk, id, pl, zh, ko, ja });
BetterDTKit.mod('living-market', {
  info: {
    options: [{
      key: 'level', type: 'choice', default: 'normal',
      label: LM_L('Strength', 'Сила', 'Stärke', 'Intensité', 'Intensità', 'Intensidad', 'तीव्रता', 'Güç', 'Intensidade',
        'Сила', 'Kekuatan', 'Siła', '强度', '강도', '強さ'),
      choices: [
        { value: 'mild', label: LM_L('Mild', 'Мягкая', 'Mild', 'Douce', 'Lieve', 'Suave', 'हल्की', 'Hafif', 'Suave', 'М’яка', 'Ringan', 'Łagodna', '温和', '약함', '弱') },
        { value: 'normal', label: LM_L('Normal', 'Обычная', 'Normal', 'Normale', 'Normale', 'Normal', 'सामान्य', 'Normal', 'Normal', 'Звичайна', 'Normal', 'Normalna', '普通', '보통', '普通') },
        { value: 'hard', label: LM_L('Hard', 'Жёсткая', 'Hart', 'Forte', 'Dura', 'Dura', 'कठिन', 'Zor', 'Difícil', 'Жорстка', 'Berat', 'Twarda', '困难', '강함', '強') },
      ],
    }],
  },
  needs: {
    objects: ['ArrayRatingsCompanies'],
    vars: ['DayTotal', 'Year'],
    functions: ['getDeviceSalesConfig'],
    check: () => !globalThis.BDTReviewData ? 'lib-review-data.js' : !globalThis.BDTReviewCore ? 'lib-review-core.js'
      : !globalThis.BDTMarketCore ? 'lib-market-core.js' : '',
  },
}, (rt, kit) => {
  if (globalThis.__bdtLivingMarket) globalThis.__bdtLivingMarket.dispose();
  const D = BDTReviewData, C = BDTReviewCore, M = BDTMarketCore, gv = rt.globalVars;
  const SOLD = 1, SELL = 4, RATING = D.ratingCol, REL = D.releaseCol, PLAYER = -1;
  const CO = { ID: 0, START: 1, FINISH: 2, EARN: 4, TYPES: 10 }, OPEN_FINISH = 2026;
  const ARRAYS = Object.keys(M.TYPES);
  const arr = (name) => rt.objects[name] && rt.objects[name].getFirstInstance();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const today = () => Math.round(num(gv.DayTotal));
  function daysLived() {
    if (api.testLived !== null) return api.testLived;
    try { const d = Number(globalThis.getCampaignDaysLived()); if (Number.isFinite(d)) return d; } catch { }
    return today();
  }
  // the generational parts of each device type (one per design array column), as the reviews read them
  const parts = new Map();
  for (const e of Object.values(D.engines)) {
    if (!M.TYPES[e.device]) continue;
    const list = parts.get(e.device) || [], seen = new Set(list.map(g => g.src + ':' + g.col));
    for (const s of e.aspects) {
      if (!s.gen || seen.has(s.gen.src + ':' + s.gen.col)) continue;
      seen.add(s.gen.src + ':' + s.gen.col);
      list.push(s.gen);
    }
    parts.set(e.device, list);
  }

  // the player's released models of a sales array (the same test as the game's ratings: id ≠ −1, release ≥ 0)
  function models(name, day) {
    const a = arr(name), out = [];
    if (!a) return out;
    for (let x = 0; x < a.width; x++) for (let y = 0; y < Math.min(3, a.height); y++) {
      const id = Number(a.getAt(x, y, 0)), rel = num(a.getAt(x, y, REL));
      if (id === -1 || !Number.isFinite(id) || !(rel >= 0)) continue;
      const lags = [];
      for (const g of parts.get(name) || []) {
        const now = C.generation(rt, g, x, y, day), then = now && C.generation(rt, g, x, y, rel);
        if (then) lags.push(M.partLag(then.newest, now.newest));
      }
      const sold = num(a.getAt(x, y, SOLD));
      out.push({ x, y, lag: M.deviceLag(lags), rating: num(a.getAt(x, y, RATING)), sold, revenue: sold * num(a.getAt(x, y, SELL)) });
    }
    return out;
  }
  // the player's share of each category (see the comment at the top)
  function shares(snap) {
    const comp = arr('ArrayRatingsCompanies'), year = num(gv.Year), rivals = [];
    let player = 0;
    if (comp) for (let i = 0; i < comp.width; i++) {
      const raw = comp.getAt(i, CO.ID), id = Number(raw);
      if (raw === '' || raw == null || !Number.isFinite(id)) continue;
      const earn = num(comp.getAt(i, CO.EARN));
      if (id === PLAYER) { player = earn; continue; }
      const start = num(comp.getAt(i, CO.START)), f = num(comp.getAt(i, CO.FINISH)), finish = f >= OPEN_FINISH ? 9999 : f;
      if (year < start || year > finish) continue;
      const types = String(comp.getAt(i, CO.TYPES) || '').split(',').map(t => t.trim()).filter(t => t && t.indexOf('OS_') !== 0);
      if (types.length) rivals.push({ earn, types });
    }
    let total = 0;
    for (const n of ARRAYS) total += snap[n].revenue;
    const out = {};
    for (const n of ARRAYS) {
      const type = M.TYPES[n], cat = rivals.filter(r => r.types.includes(type)).map(r => ({ earn: r.earn, types: r.types.length }));
      out[n] = api.testShare !== null ? api.testShare : M.share(player, total > 0 ? snap[n].revenue / total : 0, cat);
    }
    return out;
  }

  let day = -1, factors = new Map();
  function rebuild() {
    day = today();
    const level = String(kit.option('level') || 'normal'), lived = daysLived(), year = num(gv.Year);
    const cfg = globalThis.getDeviceSalesConfig();
    const snap = {};
    for (const n of ARRAYS) { const list = models(n, day); snap[n] = { list, revenue: list.reduce((s, m) => s + m.revenue, 0) }; }
    const sh = shares(snap), strengths = {}, out = {};
    factors = new Map();
    for (const n of ARRAYS) {
      const s = strengths[n] = M.strength(level, sh[n], lived), P = M.marketSize(n, year, cfg);
      out[n] = snap[n].list.map(m => {
        const T = M.tech(m.lag), S = M.saturation(M.blocked(m, snap[n].list), P), F = M.factor(s, T, S);
        factors.set(n + ':' + m.x + ':' + m.y, F);
        return { x: m.x, y: m.y, lag: m.lag, rating: m.rating, sold: m.sold, T, S, F };
      });
    }
    api.last = { day, level, lived, shares: sh, strengths, models: out };
  }

  const api = {
    last: null, off: false, testLived: null, testShare: null, M, rebuild,
    stop() { kit.fail('stopped by a test'); },
    dispose() { delete globalThis.__bdtLivingMarket; },
  };
  globalThis.__bdtLivingMarket = api;
  kit.salesMultiplier((name, x, y) => {
    if (api.off) return 1;
    if (today() !== day) rebuild();
    return factors.get(name + ':' + x + ':' + y) ?? 1;
  });
  kit.on('option', 'level', () => { day = -1; });
  if (!BetterDTKit.salesReady()) kit.fail('daily sales script not found');
  return api;
});
