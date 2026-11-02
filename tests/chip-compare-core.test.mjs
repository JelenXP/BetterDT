import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const C = load('mod/mods/lib-chip-compare-core.js', 'BDTChipCompareCore');

test('values as the designer shows them', () => {
  assert.equal(C.show('mhz', 4500), '4500 MHz');
  assert.equal(C.show('kb', 128000), '128 MB');
  assert.equal(C.show('kb', 40000000), '40 GB');
  assert.equal(C.show('kb', 512), '512 KB');
  assert.equal(C.show('nm', 3), '3 nm');
  assert.equal(C.show('nm', 1.8), '1.8 nm');
  assert.equal(C.show('flops', 38520), '38.52 TFLOPS');
  assert.equal(C.show('flops', 240), '240 GFLOPS');
  assert.equal(C.show('fill', 635700), '635.7 GTexel/s');
  assert.equal(C.show('fill', 1250000), '1.25 TTexel/s');
  assert.equal(C.show('int', 24), '24');
  assert.equal(C.show('mhz', NaN), '—');
  assert.equal(C.show('mhz', 0), '—');
});

test('the change: in %, and lower is better for the node', () => {
  assert.deepEqual(C.row(3000, 3300), { pct: 10, better: 1 });
  assert.deepEqual(C.row(3300, 3000), { pct: -9, better: -1 });
  assert.deepEqual(C.row(5, 3, true), { pct: -40, better: 1 });
  assert.deepEqual(C.row(3, 3), { pct: 0, better: 0 });
  const r = C.row(NaN, 3);
  assert.ok(Number.isNaN(r.pct)); assert.equal(r.better, 0);
});

test('a CPU section shows the CPU and its iGPU, a GPU section the GPU; missing parameters are left out', () => {
  const a = { clock: 4500, cores: 24, cache: 128000, node: 3, gClock: 3000, gFlops: 38520, gTex: 340, gFill: 635700 };
  const b = { clock: 4900, cores: 24, cache: 128000, node: 1.8, gClock: 3200, gFlops: 46344, gTex: 368, gFill: 673000 };
  const cpu = C.params(a, b, 'cpu');
  assert.deepEqual(cpu.map((r) => r.key), ['clock', 'cores', 'cache', 'node', 'gClock', 'gFlops', 'gTex', 'gFill']);
  assert.deepEqual(cpu[0], { key: 'clock', label: 'CPU FREQUENCY', a: '4500 MHz', b: '4900 MHz', pct: 9, better: 1 });
  assert.equal(cpu[3].better, 1, 'a smaller node is better');
  assert.equal(cpu[1].better, 0);
  const gpu = C.params(a, { ...b, gVram: 8000000 }, 'gpu');
  assert.deepEqual(gpu.map((r) => r.key), ['gClock', 'gFlops', 'gTex', 'gFill', 'gVram']);
  assert.equal(gpu[4].a, '—'); assert.equal(gpu[4].b, '8 GB');
});

test('bars in points and the production cost (less is better)', () => {
  assert.deepEqual(C.bars([62, 70, 50, 40], [71, 70, 45, NaN]).map((r) => [r.a, r.b, r.better]),
    [['62', '71', 1], ['70', '70', 0], ['50', '45', -1], ['40', '—', 0]]);
  assert.equal(C.bars([62], [71])[0].delta, 9);
  const c = C.cost(499, 531);
  assert.equal(c.a, '$499'); assert.equal(c.b, '$531'); assert.equal(c.delta, 32); assert.equal(c.better, -1);
  assert.equal(C.cost(1250, 1000).a, '$1,250');
  assert.equal(C.signed(9), '+9'); assert.equal(C.signed(-5, ' %'), '−5 %'); assert.equal(C.signed(0), '±0'); assert.equal(C.signed(NaN), '');
});
