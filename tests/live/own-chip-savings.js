// Own chip savings on the loaded save (test copy, writes in memory): the saving and the sales factor of every
// released model with an own chip, the cost breakdown source of the chip with and without the recorded cost, and one
// sales day without and with the mod (same random numbers; the sales arrays and the budget are restored afterwards,
// as tests/live/living-market.js does).
const S = globalThis.__bdtOwnChipSavings, K = BetterDTKit, M = BDTPartsCore, gv = rt.globalVars;
if (!S) return 'mod not running';
const R = BDTReviewData, out = { share: S.share(), models: [] };
for (const [fn, e] of Object.entries(R.engines)) {
  const a = rt.objects[e.device] && rt.objects[e.device].getFirstInstance();
  if (!a || !BDTPartsData.engines[fn] || !BDTPartsData.engines[fn].chip) continue;
  for (let x = 0; x < a.width; x++) for (let y = 0; y < Math.min(3, a.height); y++) {
    if (!(Number(a.getAt(x, y, R.releaseCol)) >= 0) || !(a.getAt(x, y, e.costCol) > 0)) continue;
    const s = S.savingOf(fn, x, y);
    if (!s) continue;
    out.models.push({ fn, name: e.device, x, y, cost: a.getAt(x, y, e.costCol), price: a.getAt(x, y, e.priceCol), rating: a.getAt(x, y, R.ratingCol),
      own: Math.round(s.own), market: Math.round(s.market), saving: Math.round(s.saving), chipOwn: Math.round(s.chipOwn),
      factor: +S.factor(e.device, x, y).toFixed(3) });
  }
}
// the chip source the game's cost breakdown reports for the newest model: recorded, and with the recorded cost left out
const first = out.models[0];
if (first) out.source = M.withModel(rt, first.fn, first.x, first.y, () => {
  const type = R.engines[first.fn].costType;
  computeDeviceCost(rt, type);
  const a = getDeviceCostBreakdown().chip;
  const own = [a.cpuSource, a.gpuSource, a.cpuMult];
  S.marketCost(type);
  const b = getDeviceCostBreakdown().chip;
  return { own, market: [b.cpuSource, b.gpuSource, b.cpuMult] };
});
// one sales day: the mod's factor off and on
const names = [...new Set(out.models.map(m => m.name))];
const snap = names.map(n => { const a = rt.objects[n].getFirstInstance(), d = []; for (let x = 0; x < a.width; x++) for (let y = 0; y < a.height; y++) for (let z = 0; z < a.depth; z++) d.push(a.getAt(x, y, z)); return { a, d }; });
const restore = () => { for (const { a, d } of snap) { let i = 0; for (let x = 0; x < a.width; x++) for (let y = 0; y < a.height; y++) for (let z = 0; z < a.depth; z++) a.setAt(d[i++], x, y, z); } markDeviceSalesDirty(); };
const inst = (n) => rt.objects[n].getFirstInstance();
const sold = () => out.models.map(m => Number(inst(m.name).getAt(m.x, m.y, 1)));
const budget = gv.Budget, rnd = Math.random;
const day = (on) => {
  restore();
  for (const m of out.models) { const a = inst(m.name); a.setAt(Number(a.getAt(m.x, m.y, 1)) + 1e6, m.x, m.y, 0); a.setAt(50, m.x, m.y, 2); }
  markDeviceSalesDirty();
  const before = sold();
  K._sales.on();
  try { S.off = !on; tickDeviceSales(gv.DayTotal, rt); } finally { K._sales.off(); S.off = false; }
  return sold().map((v, i) => v - before[i]);
};
try {
  Math.random = () => 0.5;
  const off = day(false), on = day(true);
  out.models.forEach((m, i) => { m.soldOff = off[i]; m.soldOn = on[i]; });
} finally { Math.random = rnd; restore(); gv.Budget = budget; }
return out;
