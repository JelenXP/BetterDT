import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

const D = load('mod/mods/lib-review-data.js', 'BDTReviewData');
const ENGINES = ['ConsoleCPU', 'Consoles', 'GPU', 'Gamepad', 'Headphones', 'Keyboards', 'LaptopCPU', 'Laptops', 'Scooter',
  'SmartphoneCPU', 'Smartphones', 'TV', 'Tablets', 'VR', 'VRCPU', 'Watches'];

test('all 16 engines', () => {
  assert.deepEqual(Object.keys(D.engines).sort(), ENGINES.map(e => 'ReviewsEngine_' + e).sort());
  assert.match(D.gameVersion, /^1\.6/);
});

test('every aspect has a category of its type and a known kind', () => {
  for (const [fn, e] of Object.entries(D.engines)) for (const x of e.aspects) {
    assert.ok(x.cat === 'price' || e.categories.includes(x.cat), `${fn} ${x.a} ${x.cat}`);
    assert.ok(['gen', 'yesno', 'other', 'price'].includes(x.kind), `${fn} ${x.a}`);
    assert.ok(x.a <= x.b && x.group <= x.a, `${fn} ${x.a}`);
    if (x.kind === 'gen') {
      assert.ok(x.gen.arrays.length && x.gen.arrays.every(y => y.array && y.bornCol >= 0), `${fn} ${x.a}`);
      assert.ok(x.gen.src && x.gen.col >= 0, `${fn} ${x.a}`);
    }
  }
});

test('every engine has generational aspects; all but the gamepad a price aspect', () => {
  for (const [fn, e] of Object.entries(D.engines)) {
    assert.ok(e.aspects.some(x => x.kind === 'gen'), fn);
    assert.equal(e.aspects.some(x => x.kind === 'price'), fn !== 'ReviewsEngine_Gamepad', fn);
  }
});

test('fixes: feature load range and missing bands', () => {
  const s = D.engines.ReviewsEngine_Smartphones.aspects;
  assert.ok(!s.some(x => x.a === 234));
  assert.ok(s.some(x => x.a === 243 && x.b === 245));
  assert.ok(s.some(x => x.a === 66 && x.b === 68 && x.kind === 'gen' && x.group === 60));
  const tv = D.engines.ReviewsEngine_TV.aspects;
  assert.deepEqual(tv.filter(x => x.group === 997).map(x => x.a), [997, 1000, 1003]);
});

test('32 rating writes and the sales script', () => {
  assert.equal(D.ratingSids.length, 32);
  assert.equal(new Set(D.ratingSids).size, 32);
  assert.match(D.salesScript, /^EventGameplay_Event\d+_Act\d+$/);
});

test('research rows point to dated arrays', () => {
  assert.ok(Object.keys(D.research).length > 300);
  for (const [id, r] of Object.entries(D.research)) assert.ok(r.array && r.bornCol >= 0 && r.cost > 0 && r.nameText > 0, id);
  assert.deepEqual(D.research[18].creating, ['SMARTPHONES', 'TABLETS']);
});

test('editor list counts of the dated arrays', () => {
  const dated = new Set(Object.values(D.research).map(r => r.array));
  assert.ok(Object.keys(D.counters).length > 250);
  assert.equal(D.counters.ArrayScreenResolution_Smartphone.length, 1);
  assert.ok(D.counters.ArrayBluetooth.length >= 10);
  for (const [a, sids] of Object.entries(D.counters)) assert.ok(dated.has(a) && sids.length && sids.every(Number.isFinite), a);
});
