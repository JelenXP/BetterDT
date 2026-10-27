import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const L = load('mod/mods/lib-lab-invest-core.js', 'BDTLabInvestCore');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
test('factor: the game up to $25M, +25 % per doubling over it', () => {
  near(L.factor(1e6), 1); near(L.factor(25e6), 1);
  near(L.factor(50e6), 1.25); near(L.factor(100e6), 1.5); near(L.factor(400e6), 2);
  near(L.factor(1e9), 1 + 0.25 * Math.log2(40));
  near(L.factor(5e9), L.factor(1e9));
});
test('clamp to whole millions within $1M and $1B', () => {
  assert.equal(L.clamp(0), 1e6); assert.equal(L.clamp(2.4e6), 2e6); assert.equal(L.clamp(3e9), 1e9);
  assert.equal(L.clamp('x'), 1e6);
});
test('max amount the budget pays for', () => {
  assert.equal(L.maxAmount(36_636_497_094), 1e9);
  assert.equal(L.maxAmount(123_456_789), 123e6);
  assert.equal(L.maxAmount(500_000), 1e6);
});
test('a running project over $25M is kept as $25M + millions', () => {
  assert.equal(L.encode(900e6), 25_000_900); assert.equal(L.decode(25_000_900), 900e6);
  assert.equal(L.encode(25e6), 25e6); assert.equal(L.decode(25e6), 25e6);
  assert.equal(L.encode(10e6), 10e6); assert.equal(L.decode(10e6), 10e6);
  assert.equal(L.decode(L.encode(1e9)), 1e9); assert.equal(L.decode(L.encode(26e6)), 26e6);
  assert.equal(L.decode(26e6), 26e6);
});
test('days until the lab is full', () => {
  assert.equal(L.fillDays(750, 0, 320), 3);
  assert.equal(L.fillDays(750, 700, 25.76), 2);
  assert.equal(L.fillDays(750, 750, 10), 0);
  assert.equal(L.fillDays(750, 0, 0), Infinity);
});
