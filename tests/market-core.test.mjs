import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const M = load('mod/mods/lib-market-core.js', 'BDTMarketCore');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
const cfg = { ERA_REF_YEAR: 2008, ERA_PER_YEAR: 0.03, ERA_MIN: 0.6, ERA_MAX: 2.5 };

test('part lag in years, parts from the future count 0', () => {
  near(M.partLag(100, 100 + 730), 2);
  assert.equal(M.partLag(500, 100), 0);
});
test('device lag: half the worst part, half the average', () => {
  near(M.deviceLag([0, 0, 3]), 0.5 * 3 + 0.5 * 1);
  assert.equal(M.deviceLag([]), 0);
  assert.equal(M.deviceLag([0, 0]), 0);
});
test('technology loss by the table and between its points', () => {
  assert.equal(M.lagLoss(0.5), 0); assert.equal(M.lagLoss(1), 0);
  near(M.lagLoss(2), 0.20); near(M.lagLoss(3), 0.325); near(M.lagLoss(4), 0.45);
  near(M.lagLoss(8), 0.80); near(M.lagLoss(20), 0.80);
  near(M.tech(2), 0.80);
});
test('a model beats another by a year of technology or 2 rating points', () => {
  const old = { lag: 3, rating: 6, sold: 900 }, same = { lag: 2.5, rating: 7, sold: 100 }, newer = { lag: 1.9, rating: 6, sold: 50 }, better = { lag: 3, rating: 8, sold: 10 };
  assert.equal(M.beats(newer, old), true);
  assert.equal(M.beats(better, old), true);
  assert.equal(M.beats(same, old), false);
  assert.equal(M.beats(old, newer), false);
});
test('blocked customers: owners of every model it does not beat, itself too', () => {
  const a = { lag: 3, rating: 6, sold: 900 }, b = { lag: 2.5, rating: 6, sold: 100 }, c = { lag: 0, rating: 6, sold: 40 };
  const all = [a, b, c];
  assert.equal(M.blocked(a, all), 900 + 100 + 40);   // a beats nobody
  assert.equal(M.blocked(c, all), 40);               // c beats a and b
  assert.equal(M.blocked(b, all), 900 + 100 + 40);
});
test('market size and saturation', () => {
  near(M.era(2018, cfg), 1.3); near(M.era(1990, cfg), 0.6); near(M.era(2200, cfg), 2.5);
  near(M.marketSize('ArrayTV', 2018, cfg), M.CFG.K * 450 * 1.3);
  near(M.saturation(0, 100), 1); near(M.saturation(100, 100), 0.5); near(M.saturation(1e9, 100), 0.3);
  assert.equal(M.saturation(50, 0), 1);
});
test('strength grows with the share, capped in the first two years, times the level', () => {
  near(M.ramp(0.1, 2000), 0.25); near(M.ramp(0.2, 2000), 0.25); near(M.ramp(0.4, 2000), 0.625);
  near(M.ramp(0.6, 2000), 1); near(M.ramp(0.9, 2000), 1); near(M.ramp(0.9, 700), 0.25);
  near(M.strength('mild', 0.9, 2000), 0.5); near(M.strength('normal', 0.9, 2000), 1);
  near(M.strength('hard', 0.9, 2000), 1.5); near(M.strength('???', 0.9, 2000), 1);
});
test('factor: 1 − strength × (1 − T × S), never below 0.2', () => {
  near(M.factor(1, 1, 1), 1);
  near(M.factor(1, 0.8, 0.5), 0.4);
  near(M.factor(0.25, 0.8, 0.5), 0.85);
  near(M.factor(1.5, 0.2, 0.3), 0.2);
});
test('share of a category: player revenue split by category, rivals split over their categories', () => {
  near(M.share(100, 0.5, [{ earn: 300, types: 3 }, { earn: 50, types: 1 }]), 50 / (50 + 100 + 50));
  assert.equal(M.share(0, 0, []), 0);
});
