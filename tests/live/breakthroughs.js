// 200 finished projects on a copy of the levels: frequencies, gap rules and weights.
const B = globalThis.__bdtBreakthroughs, R = rt.objects.ArrayMyResearch.getFirstInstance();
if (!B) return 'mod not running';
const keep = []; for (let i = 0; i < R.width; i++) keep.push(R.getAt(i));
const restore = () => keep.forEach((v, i) => R.setAt(v, i));
const cands = B.candidates();
const count = [0, 0, 0, 0], hits = {};
for (let i = 0; i < 200; i++) {
  restore();
  const got = B.finish(5000, Math.random, { quiet: true });
  count[got.length]++;
  for (const g of got) {
    hits[g.id] = (hits[g.id] || 0) + 1;
    if (!(g.born > rt.globalVars.DayTotal && g.born <= rt.globalVars.DayTotal + 365)) return 'bad born ' + JSON.stringify(g);
    if (R.getAt(+g.id) !== g.level) return 'level not set';
  }
}
restore();
const w = {}; for (const c of cands) w[c.id] = c.w;
const by = (k) => { const h = cands.filter(c => c.w === k).map(c => hits[c.id] || 0); return h.length ? h.reduce((s, v) => s + v, 0) / h.length : null; };
return { cands: cands.length, w3: cands.filter(c => c.w === 3).length, atLeast1: (200 - count[0]) / 200, atLeast2: (count[2] + count[3]) / 200,
  three: count[3] / 200, meanHitsW1: by(1), meanHitsW3: by(3) };
