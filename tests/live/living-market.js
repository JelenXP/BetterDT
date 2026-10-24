// Living market on the loaded save (test copy, writes in memory): the factor of every released device and one sales
// day without and with the mod (same random numbers; the sales arrays and the budget are restored afterwards). Every
// released model is put on sale for the day (popularity 50, stock enough), its release day kept; the day runs once
// with the player's real shares and once with every share 0.8 (a dominated market).
// suggestK: the K that gives the most-sold old model (lag ≥ 2) of the category with the most models S = 0.5.
const L = globalThis.__bdtLivingMarket, K = BetterDTKit, gv = rt.globalVars;
if (!L) return 'mod not running';
let t = performance.now(); L.rebuild(); const rebuildMs = performance.now() - t;
const names = Object.keys(L.last.models).filter(n => rt.objects[n]);
const snap = names.map(n => {
  const a = rt.objects[n].getFirstInstance(), d = [];
  for (let x = 0; x < a.width; x++) for (let y = 0; y < a.height; y++) for (let z = 0; z < a.depth; z++) d.push(a.getAt(x, y, z));
  return { n, a, d };
});
const restore = () => {
  for (const { a, d } of snap) {
    let i = 0;
    for (let x = 0; x < a.width; x++) for (let y = 0; y < a.height; y++) for (let z = 0; z < a.depth; z++) a.setAt(d[i++], x, y, z);
  }
  markDeviceSalesDirty();
};
const onSale = () => {
  for (const { n, a } of snap) for (const m of L.last.models[n]) {
    a.setAt(Number(a.getAt(m.x, m.y, 1)) + 1e6, m.x, m.y, 0);
    a.setAt(50, m.x, m.y, 2);
  }
  markDeviceSalesDirty();
};
const soldNow = () => { const o = {}; for (const { n, a } of snap) for (const m of L.last.models[n]) o[n + ':' + m.x + ':' + m.y] = a.getAt(m.x, m.y, 1); return o; };
const budget = gv.Budget, rnd = Math.random;
const day = (on, share) => {
  restore(); onSale();
  L.off = !on; L.testShare = share; L.rebuild();
  const before = soldNow();
  K._sales.on();
  const t0 = performance.now();
  try { tickDeviceSales(gv.DayTotal, rt); } finally { K._sales.off(); }
  const ms = performance.now() - t0, after = soldNow(), d = {};
  for (const k in after) d[k] = after[k] - before[k];
  return { ms, d };
};
const run = (share) => {
  const off = day(false, share), on = day(true, share);
  const categories = {};
  let sumOff = 0, sumOn = 0, best = null;
  for (const n of names) {
    const ms = L.last.models[n].map(m => {
      const k = n + ':' + m.x + ':' + m.y, a = off.d[k] || 0, b = on.d[k] || 0;
      sumOff += a; sumOn += b;
      return { x: m.x, y: m.y, lag: +m.lag.toFixed(2), T: +m.T.toFixed(3), S: +m.S.toFixed(3), F: +m.F.toFixed(3), soldOff: a, soldOn: b, ratio: a > 0 ? +(b / a).toFixed(3) : null };
    }).filter(m => m.soldOff > 0);
    categories[n] = { share: +L.last.shares[n].toFixed(3), strength: +L.last.strengths[n].toFixed(3), models: ms };
    if (!best || L.last.models[n].length > L.last.models[best].length) best = n;
  }
  return { off, on, best, sumOff, sumOn, categories };
};
try {
  Math.random = () => 0.5;
  const real = run(null), dom = run(0.8), { best } = dom;
  // K for S = 0.5 at the most-sold old model of the category with the most models: blocked = market size
  let suggestK = null;
  const old = L.last.models[best].filter(m => m.lag >= 2).sort((a, b) => b.sold - a.sold)[0];
  if (old) {
    const cfg = getDeviceSalesConfig(), list = L.last.models[best];
    suggestK = Math.round(L.M.blocked(old, list) / ((L.M.BASE[best] || 600) * L.M.era(gv.Year, cfg)));
  }
  const ratio = (o) => o.sumOff > 0 ? +(o.sumOn / o.sumOff).toFixed(3) : null;
  return { rebuildMs: +rebuildMs.toFixed(1), tickMs: { off: +dom.off.ms.toFixed(1), on: +dom.on.ms.toFixed(1) }, dominant: best,
    suggestK, totalRatio: { real: ratio(real), dominated: ratio(dom) }, real: real.categories, dominated: dom.categories };
} finally {
  Math.random = rnd; L.off = false; L.testShare = null; restore(); gv.Budget = budget; L.rebuild();
}
