import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const C = load('mod/mods/lib-review-core.js', 'BDTReviewCore');
const half = () => 0.5, lo = () => 0, hi = () => 0.999999;
test('price class', () => {
  assert.equal(C.priceClass(0.40), 'budget'); assert.equal(C.priceClass(0.41), 'mid');
  assert.equal(C.priceClass(0.75), 'mid'); assert.equal(C.priceClass(0.76), 'flagship');
});
test('generations table', () => {
  assert.deepEqual(C.genRange('flagship', 0), [8, 10]); assert.deepEqual(C.genRange('mid', -2), [8, 10]);
  assert.deepEqual(C.genRange('budget', 1), [6, 7]); assert.deepEqual(C.genRange('flagship', 2), [4, 5]);
  assert.deepEqual(C.genRange('budget', 3), [5, 6]); assert.deepEqual(C.genRange('mid', 3), [4, 5]);
  assert.deepEqual(C.genRange('flagship', 3), [1, 3]); assert.deepEqual(C.genRange('budget', 4), [4, 5]);
  assert.deepEqual(C.genRange('mid', 4), [1, 3]); assert.deepEqual(C.genRange('budget', 9), [1, 3]);
});
test('uniform has one decimal', () => { assert.equal(C.uniform(8, 10, half), 9); assert.equal(C.uniform(1, 3, () => 0.37), 1.7); });
test('price limits', () => {
  assert.equal(C.innovationShift(0), 0); assert.equal(C.innovationShift(3), 15);
  assert.equal(C.innovationShift(4), 16); assert.equal(C.innovationShift(10), 22); assert.equal(C.innovationShift(14), 22);
  assert.deepEqual(C.priceLimits('mid', 0), [20, 30, 35, 40]);
  assert.deepEqual(C.priceLimits('budget', 0), [15, 25, 30, 35]);
  assert.deepEqual(C.priceLimits('flagship', 2), [40, 50, 55, 60]);
});
test('price bands', () => {
  const L = [20, 30, 35, 40];
  assert.equal(C.priceBand(19.9, L), 0); assert.equal(C.priceBand(20, L), 1); assert.equal(C.priceBand(34, L), 2);
  assert.equal(C.priceBand(39, L), 3); assert.equal(C.priceBand(40, L), 4);
  assert.deepEqual(C.priceRange(0), [9, 10]); assert.deepEqual(C.priceRange(4), [1, 2]);
  assert.equal(C.overpriced(34.9, L), false); assert.equal(C.overpriced(35, L), true);
});
test('quality and value', () => {
  assert.equal(C.quality([]), 0.5); assert.equal(C.quality([0, 6]), 0.5); assert.equal(C.quality([-1, 9]), 0.5);
  assert.equal(C.valueScore(1, 0.4, half), 10);       // ratio 2.5
  assert.equal(C.valueScore(0.65, 0.5, half), 8);     // ratio 1.3
  assert.equal(C.valueScore(0.55, 0.5, half), 5.5);   // ratio 1.1
  assert.equal(C.valueScore(0.1, 0.5, half), 1);      // ratio 0.2
  assert.equal(C.valueScore(1, 0.4, hi), 10);         // kept in 1–10
  assert.equal(C.valueScore(0.1, 0.5, lo), 1);
});
test('innovation', () => {
  assert.equal(C.innovationBase(1), 8); assert.equal(C.innovationBase(2), 8.5); assert.equal(C.innovationBase(3), 9);
  assert.equal(C.innovationBase(4), 9.15); assert.equal(C.innovationBase(6), 9.45); assert.equal(C.innovationBase(12), 10);
  assert.equal(C.innovationScore(10, hi), 10); assert.equal(C.innovationScore(1, lo), 7.7);
});
test('shown categories', () => {
  const s = { display: 9, cpu: 8.5, memory: 7, battery: 3, price: 5, value: 6 };
  assert.deepEqual(C.pickShown(s, false), ['display', 'cpu', 'battery', 'price']);
  const t = { display: 9, cpu: 8.5, memory: 7, battery: 3, price: 6.5, value: 4 };
  assert.deepEqual(C.pickShown(t, false), ['display', 'cpu', 'battery', 'value']);
  assert.deepEqual(C.pickShown(t, true), ['display', 'cpu', 'battery', 'price']);
});
test('final rating', () => {
  const s = { display: 9, cpu: 9, battery: 3, price: 6, value: 6 };
  // weights at rng 0.5 (mean 6.6: display and cpu strong ×1.15, the rest ×0.95): display 1.4375, cpu 1.4375,
  // battery 1.1875, price 2.375, value 0.95 → 49.3875 / 7.3875 = 6.685
  assert.equal(C.finalRating(s, ['display', 'cpu', 'battery', 'price'], half), 7);
  // the strong categories weigh more: 9 and 3 at rng 0 → (9·1.0 + 3·0.8) / 1.8 = 6.33, minus the jitter 0.45 → 6
  assert.equal(C.finalRating({ a: 9, b: 3 }, [], lo), 6);
  assert.equal(C.finalRating({ a: 0.2, price: 1 }, [], lo), 1);
  assert.equal(C.finalRating({ a: 10, price: 10 }, [], hi), 10);
});
test('review band', () => { assert.equal(C.reviewBand(3.4), 0); assert.equal(C.reviewBand(3.5), 1); assert.equal(C.reviewBand(7.5), 2); });
test('sales bonus', () => {
  assert.equal(C.salesBonus(0), 0); assert.equal(C.salesBonus(1), 0.1); assert.equal(C.salesBonus(2), 0.2);
  assert.equal(C.salesBonus(3), 0.25); assert.equal(+C.salesBonus(4).toFixed(4), 0.27);
  assert.equal(+C.salesBonus(6).toFixed(4), 0.31); assert.equal(+C.salesBonus(15).toFixed(4), 0.39);
  assert.equal(C.effectiveParts([100, 100], 90), 2); assert.equal(C.effectiveParts([100], 130), 0.5);
  assert.equal(C.effectiveParts([100], 160), 0);
});
test('innovative parts: only from lists the designer limits by date', () => {
  const comp = (borns) => ({ width: borns.length, getAt: (i) => borns[i] });
  const objs = {
    Dev: { getAt: (x, y, col) => ({ 10: 2, 11: 2 })[col] },
    Dated: comp([100, 200, 900]), Free: comp([100, 200, 900]),
  };
  const rt = { objects: Object.fromEntries(Object.entries(objs).map(([k, v]) => [k, { getFirstInstance: () => v }])) };
  const gen = (array, col) => ({ arrays: [{ array, bornCol: 0 }], src: 'Dev', model: true, col });
  const D = { counters: { Dated: [1] }, engines: { E: { device: 'Dev', aspects: [{ gen: gen('Dated', 10) }, { gen: gen('Free', 11) }] } } };
  assert.deepEqual(C.partsOf(rt, D, 'Dev', 0, 0, 500), { count: 1, borns: [900] });
  assert.equal(C.generation(rt, gen('Free', 11), 0, 0, 500).gens, -1);
});
test('innovative parts: a future part the game itself lists (dates out of order) is not innovative', () => {
  // born days 100, 900, 300: at day 500 the game counts two parts and lists rows 0 and 1, so row 1 is no breakthrough
  const comp = { width: 3, getAt: (i) => [100, 900, 300][i] };
  const rt = { objects: { Dev: { getFirstInstance: () => ({ getAt: () => 1 }) }, Dated: { getFirstInstance: () => comp } } };
  const D = { counters: { Dated: [1] }, engines: { E: { device: 'Dev', aspects: [{ gen: { arrays: [{ array: 'Dated', bornCol: 0 }], src: 'Dev', model: true, col: 10 } }] } } };
  assert.deepEqual(C.partsOf(rt, D, 'Dev', 0, 0, 500), { count: 0, borns: [] });
});
test('generation: born day of the newest part on the market', () => {
  const comp = { width: 4, getAt: (x, y) => (y === 1 ? [100, 200, 300, 400][x] : 0) };
  const dev = { getAt: () => 1 };   // the device uses row 1 (born 200)
  const rt = { objects: { Comp: { getFirstInstance: () => comp }, Dev: { getFirstInstance: () => dev } } };
  const gen = { arrays: [{ array: 'Comp', bornCol: 1 }], src: 'Dev', model: true, col: 9 };
  const g = C.generation(rt, gen, 0, 0, 350);
  assert.deepEqual({ gens: g.gens, born: g.born, newest: g.newest }, { gens: 1, born: 200, newest: 300 });
});
test('extra rules: replaced categories go, moved ones change category', () => {
  const a = [{ a: 1, cat: 'cpu', score: 9 }, { a: 2, cat: 'display', score: 5 }, { a: 3, cat: 'cpu', score: 8 }];
  assert.deepEqual(C.extraRules(a, [{ replaces: ['cpu'] }]).map(x => x.a), [2]);
  const moved = C.extraRules(a, [{ moves: { cpu: 'memory' } }]);
  assert.deepEqual(moved.map(x => x.cat), ['memory', 'display', 'memory']);
  assert.equal(a[0].cat, 'cpu');
  assert.deepEqual(C.extraRules(a, [{}]), a);
});
test('the extension registry exists', () => {
  assert.ok(globalThis.BDTReviewExt.categories instanceof Map);
  assert.ok(globalThis.BDTReviewExt.cost instanceof Set);
});
