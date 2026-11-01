import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const C = load('mod/mods/lib-store-sales-core.js', 'BDTStoreSalesCore');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('a device adds by its rating and popularity', () => {
  near(C.deviceBoost(5, 100), 0); near(C.deviceBoost(4, 100), 0);
  near(C.deviceBoost(9, 100), 3); near(C.deviceBoost(9, 50), 1.5); near(C.deviceBoost(9, 10), 0.3);
  near(C.deviceBoost(7, 100), 3 * Math.pow(0.5, 1.5));
  near(C.deviceBoost(10, 100), 3 * Math.pow(1.15, 1.5)); near(C.deviceBoost(9, 0), 0); near(C.deviceBoost(9, 150), 3);
});
test('the best device counts fully, the next ones half as much each', () => {
  near(C.boost([]), 0);
  near(C.boost([{ rating: 9, pop: 100 }]), 3);
  near(C.boost([{ rating: 9, pop: 50 }, { rating: 9, pop: 100 }]), 3 + 0.75);
  near(C.boost([{ rating: 5, pop: 100 }, { rating: 9, pop: 100 }]), 3);
  assert.ok(C.boost(Array(30).fill({ rating: 9, pop: 100 })) < 6);
});
test('experience: a small bonus for more released devices', () => {
  near(C.experience(0), 0); near(C.experience(1), 0);
  near(C.experience(10), 0.2 * Math.log(10) / Math.log(50)); near(C.experience(50), 0.2); near(C.experience(500), 0.2);
});
test('on their own the stores keep a fifth of the game profit, a new 9/10 device makes it 4×', () => {
  near(C.profit(1000, 600), 80);
  near(C.profit(1000, 600, 3), 320);
  near(C.profit(1000, 600, 1.5), 200);
  near(C.profit(1000, 600, 0, 0.2), 96);
});
test('a loss shrinks to a fifth, and a good device still brings money', () => {
  near(C.profit(1000, 1500), -100);
  near(C.profit(1000, 1500, 3), -100 + 0.2 * 3 * 150);
  near(C.profit(1000, 1500, 0, 0.2), -100);
});
test('a sold store brings 35 % of its price and upgrades, not more for more stores', () => {
  assert.equal(C.sellValue(600000, 1), Math.ceil(0.35 * 600000));
  const up = C.roundPrice(600000, 1) + C.roundPrice(600000, 2);
  assert.equal(C.sellValue(600000, 3), Math.ceil(0.35 * (600000 + up)));
  assert.equal(C.roundPrice(600000, 1), 6 * Math.ceil(600000 * 6 / 100));
});
