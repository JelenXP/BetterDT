import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const P = load('mod/mods/lib-parts-data.js', 'BDTPartsData');
const D = load('mod/mods/lib-review-data.js', 'BDTReviewData');

test('every engine with a chip or an OS is a review engine of a device', () => {
  for (const [fn, e] of Object.entries(P.engines)) {
    assert.ok(D.engines[fn], fn);
    if (e.chip) {
      assert.equal(e.chip.cols[e.chip.cpu.typeCol], 'ProcessorType', fn);
      if (e.chip.gpu) assert.equal(e.chip.cols[e.chip.gpu.typeCol], 'GraphicProcessorType', fn);
      assert.match(e.chip.scoreFn, /^compute[A-Za-z]*SpecScores$/);
      assert.ok(['mobile', 'laptop', 'console', 'other'].includes(e.chip.group), fn);
      assert.equal(e.chip.type, D.engines[fn].costType, fn);
    }
    if (e.os) {
      assert.ok(P.osArrays[e.os.family], fn);
      assert.deepEqual(Object.values(e.os.cols).sort(), ['OperationSystemID', 'OperationSystemVersion_Text', 'OperationSystem_Text']);
    }
  }
});
test('the devices of the spec', () => {
  for (const fn of ['ReviewsEngine_Smartphones', 'ReviewsEngine_Tablets', 'ReviewsEngine_Laptops', 'ReviewsEngine_Watches', 'ReviewsEngine_TV']) assert.ok(P.engines[fn].os, fn);
  for (const fn of ['ReviewsEngine_Smartphones', 'ReviewsEngine_Tablets', 'ReviewsEngine_Laptops', 'ReviewsEngine_Watches',
    'ReviewsEngine_Headphones', 'ReviewsEngine_TV', 'ReviewsEngine_Scooter', 'ReviewsEngine_Keyboards', 'ReviewsEngine_Consoles', 'ReviewsEngine_VR']) assert.ok(P.engines[fn].chip, fn);
  assert.equal(P.engines.ReviewsEngine_Laptops.chip.gpu.ownValue, 4);
  assert.equal(P.engines.ReviewsEngine_Laptops.chip.gpuBars, 'getLaptopChipSpecBars');
  assert.equal(P.engines.ReviewsEngine_Tablets.os.family, P.engines.ReviewsEngine_Smartphones.os.family);
});
test('own chips: cost arrays and how the designer finds them', () => {
  assert.deepEqual(Object.keys(P.ownChipEarnings).sort(), ['CONSOLE', 'LAPTOP', 'SMARTPHONE', 'TABLET', 'VR']);
  assert.ok(P.ownChipEarnings.LAPTOP.gpu);
  for (const [fn, e] of Object.entries(P.engines)) {
    if (!e.chip || e.chip.cpu.ownValue === null) continue;
    assert.ok(P.ownChipEarnings[e.chip.type], fn);
    assert.equal(typeof P.chipConfig[e.chip.type], 'string', fn);
  }
  const l = P.engines.ReviewsEngine_Laptops.chip;
  assert.deepEqual(l.cpu.find, { chips: 'ArrayMyCPU_Laptops', series: 'ArrayMyCPU_LaptopsSeries', cursors: ['ProcessorSeries', 'ProcessorModel'], idVar: 'ProcessorSeriesID' });
});
test('OS lists: the fields of each family', () => {
  for (const o of Object.values(P.osArrays)) for (const k of ['id', 'version', 'start', 'end', 'name']) assert.equal(typeof o.fields[k], 'number');
  assert.equal(P.osArrays.laptop.fields.name, 7);
  assert.equal(P.ownOs.privateValue, 'PRIVATE');
});
