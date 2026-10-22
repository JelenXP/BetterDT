// One sales day of a laptop put on sale in memory, without and with a 30 % innovation bonus (same random numbers):
// the units sold grow by the bonus, the popularity left after the day is the game's own.
const B = globalThis.__bdtBreakthroughs, a = rt.objects.ArrayLaptops.getFirstInstance(), gv = rt.globalVars;
if (!B) return 'mod not running';
if (!a.width) return 'no laptop';
const keep = []; for (let z = 0; z < 9; z++) keep.push(a.getAt(0, 0, z));
const budget = gv.Budget, rnd = Math.random;
const reset = () => { keep.forEach((v, z) => a.setAt(v, 0, 0, z)); a.setAt(keep[1] + 1e6, 0, 0, 0); a.setAt(50, 0, 0, 2); a.setAt(gv.DayTotal - 30, 0, 0, 7); markDeviceSalesDirty(); };
const day = (bonus) => {
  reset();
  B.testBonus = bonus ? (n, x, y) => n === 'ArrayLaptops' && x === 0 && y === 0 ? bonus : 0 : null;
  if (bonus) B.salesOn();
  try { tickDeviceSales(gv.DayTotal, rt); } finally { B.salesOffNow(); B.testBonus = null; }
  return { sold: a.getAt(0, 0, 1) - keep[1], pop: a.getAt(0, 0, 2), own: Object.prototype.hasOwnProperty.call(a, 'getAt') };
};
try {
  Math.random = () => 0.5;
  const off = day(0), on = day(0.3);
  return { off, on, ratio: on.sold / off.sold };
} finally {
  Math.random = rnd; keep.forEach((v, z) => a.setAt(v, 0, 0, z)); gv.Budget = budget; markDeviceSalesDirty();
}
