import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const C = load('mod/mods/lib-fair-specs-core.js', 'BDTFairSpecsCore');

test('year days: 1 January 2030 is day 8031', () => {
  assert.equal(C.yearDay(2030), 8031);
  assert.equal(C.yearDay(2008), 1);
});

test('best on the market: the best part of each year, counted from 1 January, never going down', () => {
  const s = C.bestSteps([[1000, 2010], [1500, 2010], [1200, 2012], [2000, 2015], [0, 2016], [9999, 0]]);
  assert.deepEqual(s, [[C.yearDay(2010), 1500], [C.yearDay(2015), 2000]]);
  assert.equal(C.bestOn(s, C.yearDay(2009)), 0);
  assert.equal(C.bestOn(s, C.yearDay(2010)), 1500);
  assert.equal(C.bestOn(s, C.yearDay(2014) + 200), 1500);
  assert.equal(C.bestOn(s, C.yearDay(2015)), 2000);
});

test('raise: each value at least the best part on the market until the next one comes (a year ahead at most)', () => {
  const s = C.bestSteps([[1500, 2010], [3300, 2020]]);
  const entries = [[800, C.yearDay(2008)], [1000, C.yearDay(2010) + 30], [1968, C.yearDay(2020) + 1], [4000, C.yearDay(2025)]];
  assert.deepEqual(C.raise(entries, s), [800, 1500, 3300, 4000], 'next one in 2010: the 2008 value stays');
  // the next value comes years later: the market a year ahead counts, not further
  assert.deepEqual(C.raise([[800, C.yearDay(2009) + 10], [900, C.yearDay(2018)], [3500, C.yearDay(2030)]], s), [1500, 1500, 3500]);
  assert.deepEqual(C.raise([[800, C.yearDay(2008)], [900, C.yearDay(2018)], [3500, C.yearDay(2030)]], s), [800, 1500, 3500]);
  // the last value: a year ahead
  assert.deepEqual(C.raise([[800, C.yearDay(2019) + 5]], s), [3300]);
  // already ahead: nothing changes; a later value below an earlier raised one is lifted to it
  assert.deepEqual(C.raise([[2000, C.yearDay(2010)], [1600, C.yearDay(2011)]], s), [2000, 2000]);
  // twice gives the same (applying it again on every load is safe)
  const once = C.raise(entries, s);
  assert.deepEqual(C.raise(once.map((v, i) => [v, entries[i][1]]), s), once);
});

test('labels: the unit and decimals of the nearest entry below, scaled the same way', () => {
  const entries = [{ value: 118670, text: '118.67 GFLOPS' }, { value: 250000, text: '250.00 GFLOPS' }, { value: 1500000, text: '1.50 TFLOPS' }];
  assert.equal(C.label(300000, entries), '300.00 GFLOPS');
  assert.equal(C.label(2250000, entries), '2.25 TFLOPS');
  assert.equal(C.label(100000, entries), '100.00 GFLOPS', 'below all: the first entry');
  assert.equal(C.label(5, [{ value: 1, text: '' }]), '');
});

test('every table has competition sources', () => {
  for (const t of C.TABLES) {
    assert.ok(t.table.startsWith('Array'));
    assert.ok(t.from.length > 0);
    for (const [re, vr, yr] of t.from) { assert.ok(re instanceof RegExp); assert.ok(vr >= 0 && yr > vr - 10); }
  }
});
