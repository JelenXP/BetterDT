import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const P = load('mod/mods/lib-parts-core.js', 'BDTPartsCore');
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const CFG = { PRICE_FAIR_BASE: 1.2, PRICE_FAIR_PER_RATING: 0.045, PRICE_EXP: 3, PRICE_MIN_MULT: 0.25, PRICE_MAX_MULT: 3 };

test('seeded: the same text gives the same number in [0, 1)', () => {
  const a = P.seeded('29:0:Acme'), b = P.seeded('29:0:Acme'), c = P.seeded('30:0:Acme');
  assert.equal(a, b);
  assert.ok(a >= 0 && a < 1 && c >= 0 && c < 1);
  assert.notEqual(a, c);
});
test('free OS: a fixed base between 2.5 and 4.5', () => {
  const v = [...Array(200).keys()].map(i => P.freeBase('os' + i));
  assert.ok(v.every(x => x >= 2.5 && x <= 4.5));
  assert.ok(Math.max(...v) - Math.min(...v) > 1.5);
  assert.equal(P.freeBase('x'), P.freeBase('x'));
});
test('paid OS: 5 for the cheapest licence, 9.5 for the dearest, logarithmic between', () => {
  const prices = [200000, 800000, 3200000];
  near(P.paidBase(200000, prices), 5);
  near(P.paidBase(3200000, prices), 9.5);
  near(P.paidBase(800000, prices), 7.25);
  near(P.paidBase(500000, [500000]), 7.25);
  assert.equal(P.paidBase(0, prices), null);
});
test('own OS: 2 + 1.5 × log10(★ + 1), at most 9', () => {
  near(P.ownBase(0), 2); near(P.ownBase(99), 5); near(P.ownBase(311), 5.74, 0.01); near(P.ownBase(35854), 8.83, 0.01); assert.equal(P.ownBase(1e9), 9);
});
test('own OS support ends 730 days after the last release', () => {
  assert.equal(P.ownSupported(100, 830), true); assert.equal(P.ownSupported(100, 831), false);
});
test('OS rating: age, support, own bonus, clamp, one decimal', () => {
  const o = { base: 8, versionDay: 1000, newestDay: 1000, supported: true, own: false, private: false };
  assert.equal(P.osRating(o), 8);
  assert.equal(P.osRating({ ...o, versionDay: 1000 - 365 * 2.5 }), 7);
  assert.equal(P.osRating({ ...o, versionDay: 1000 - 365 * 10 }), 5);
  assert.equal(P.osRating({ ...o, versionDay: 2000 }), 8);
  assert.equal(P.osRating({ ...o, supported: false }), 5);
  assert.equal(P.osRating({ ...o, own: true }), 8.5);
  assert.equal(P.osRating({ ...o, own: true, private: true }), 9);
  assert.equal(P.osRating({ ...o, base: 9.8, own: true, private: true }), 10);
  assert.equal(P.osRating({ ...o, base: 1, supported: false }), 0);
  assert.equal(P.osRating({ ...o, base: 7.26 }), 7.3);
});
test('chip rating: weighted indicators / 10, own +0.5, missing indicators left out', () => {
  assert.equal(P.chipRating({ perf: 80, energy: 60, power: 60, gaming: 40 }, 'mobile', false), 6.6);
  assert.equal(P.chipRating({ perf: 80, energy: 60, power: 60, gaming: 40 }, 'mobile', true), 7.1);
  assert.equal(P.chipRating({ gaming: 90, power: 70 }, 'console', false), 8.1);
  assert.equal(P.chipRating({ perf: 100, power: 100, energy: 100, gaming: 100 }, 'laptop', true), 10);
  assert.equal(P.chipRating({}, 'other', false), null);
});
test('graphics rating from the GPU bars (0–1 of the market best), own +0.5', () => {
  assert.equal(P.gpuRating({ gFlops: 0.5, gTex: 0.5, gFill: 0.5, gClock: 1, gVram: null }, false), 5.6);
  assert.equal(P.gpuRating({ gFlops: 0.5, gTex: 0.5, gFill: 0.5, gClock: 1, gVram: null }, true), 6.1);
  assert.equal(P.gpuRating({ gFlops: 1, gTex: 1, gFill: 1, gClock: 1, gVram: 1 }, true), 10);
  assert.equal(P.gpuRating(null, false), null);
});
test('the price factor of the game and the sales ratio of the reference cost', () => {
  near(P.priceFactor(100, 160, 7, CFG), Math.pow(1.515 / 1.6, 3));
  assert.equal(P.priceFactor(100, 1000, 1, CFG), 0.25);
  assert.equal(P.priceFactor(100, 50, 9, CFG), 3);
  assert.equal(P.priceFactor(0, 160, 7, CFG), 1);
  const F = (c, p, r) => P.priceFactor(c, p, r, CFG);
  assert.equal(P.refCost(100, 30, 0.7), 121);
  assert.equal(P.refCost(100, -5, 0.7), 100);
  near(P.salesRatio(F, 100, 121, 160, 7), F(121, 160, 7) / F(100, 160, 7));
  assert.ok(P.salesRatio(F, 100, 121, 160, 7) > 1);
  assert.equal(P.salesRatio(F, 100, 100, 160, 7), 1);
  assert.equal(P.salesRatio(() => 0, 100, 121, 160, 7), 1);
});
test('designer cursors of an own chip: series order and the chip in its series, 1-based', () => {
  const chips = [{ id: 4, series: 0 }, { id: 3, series: 1 }, { id: 2, series: 0 }, { id: 9, series: 7 }];
  assert.deepEqual(P.ownCursor(chips, [0, 1], 2), { series: 1, model: 2, col: 2 });
  assert.deepEqual(P.ownCursor(chips, [0, 1], 3), { series: 2, model: 1, col: 1 });
  assert.deepEqual(P.ownCursor(chips, [5, 1], 3), { series: 1, model: 1, col: 1 });
  assert.equal(P.ownCursor(chips, [0, 1], 9), null);
});
test('share option and number format', () => {
  assert.equal(P.shareOf('50'), 0.5); assert.equal(P.shareOf('85'), 0.85); assert.equal(P.shareOf('??'), 0.7);
  assert.equal(P.fmt1(7.4, 0), '7.4'); assert.equal(P.fmt1(7.4, 2), '7,4'); assert.equal(P.fmt1(7, 1), '7,0');
});
