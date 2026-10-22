import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const B = load('mod/mods/lib-breakthrough-core.js', 'BDTBreakthroughCore');
const near = (a, b) => assert.ok(Math.abs(a - b) < 5e-4, `${a} vs ${b}`);
test('chance', () => {
  near(B.chance(700, 900), 0.4624); near(B.chance(700, 3600), 0.2724); near(B.chance(24000, 12000), 0.6025);
  assert.equal(B.chance(0, 900), 0);
});
test('cumulative at 5000 RP', () => {
  const p = B.K.map(k => B.chance(5000, k));
  near(p[0], 0.7367); near(p[0] * p[1], 0.4045); near(p[0] * p[1] * p[2], 0.1503);
});
test('attempts are sequential', () => {
  assert.equal(B.attempts(5000, () => 0), 3);
  assert.equal(B.attempts(5000, () => 0.99), 0);
  let i = 0; const seq = [0, 0.99, 0];
  assert.equal(B.attempts(5000, () => seq[i++]), 1);
});
test('dated count', () => assert.equal(B.datedCount([0, 10, 20, 400, 900], 20), 3));
const borns = [0, 100, 200, 300, 400, 500, 600, 700];
test('target at the newest level', () => {
  assert.deepEqual(B.target(4, borns, 350, 50), { row: 4, level: 5 });   // A = 4, row 4 born 400 ≤ 810
  assert.equal(B.target(5, borns, 30, 50), null);                       // A = 1 ≤ L: row 5, born 500 > 30 + 460 → null
  assert.equal(B.target(8, borns, 750, 50), null);                      // no row 8
});
test('target with missing levels', () => {
  // today 350 → A = 4; L = 3 → missing 1, always allowed even when expensive
  assert.deepEqual(B.target(3, borns, 350, 500), { row: 4, level: 5 });
  // L = 1 → missing 3 × 40 = 120 ≤ 120 allowed; × 41 not
  assert.deepEqual(B.target(1, borns, 350, 40), { row: 4, level: 5 });
  assert.equal(B.target(1, borns, 350, 41), null);
  // missing 5 → never
  assert.equal(B.target(0, [0, 1, 2, 3, 4, 5, 600], 10, 1), null);
});
test('target must come 10 to 460 days later', () => {
  assert.equal(B.target(4, [0, 100, 200, 300, 900], 350, 50), null);   // 900 > 810
  assert.deepEqual(B.target(4, [0, 100, 200, 300, 810], 350, 50), { row: 4, level: 5 });
  assert.equal(B.target(4, [0, 100, 200, 300, 359], 350, 50), null);   // 9 days ahead
  assert.deepEqual(B.target(4, [0, 100, 200, 300, 360], 350, 50), { row: 4, level: 5 });
});
test('weighted pick without replacement', () => {
  const c = [{ id: 'a', w: 3 }, { id: 'b', w: 1 }, { id: 'c', w: 1 }];
  assert.deepEqual(B.pick(c, 2, () => 0), ['a', 'b']);
  assert.deepEqual(B.pick(c, 5, () => 0.999), ['c', 'b', 'a']);
  assert.deepEqual(B.pick([], 2, () => 0), []);
});
test('lead weight grows up to 190 days', () => {
  near(B.leadWeight(10), 10 / 190); near(B.leadWeight(95), 0.5);
  assert.equal(B.leadWeight(190), 1); assert.equal(B.leadWeight(400), 1);
});
test('relevance', () => {
  assert.equal(B.relevance(new Set(), ['SMARTPHONES']), 1);
  assert.equal(B.relevance(new Set(['TABLETS']), ['SMARTPHONES', 'TABLETS']), 3);
  assert.equal(B.relevance(new Set(['TV']), ['SMARTPHONES']), 1);
});
