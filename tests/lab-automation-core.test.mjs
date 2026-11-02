import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const C = load('mod/mods/lib-lab-automation-core.js', 'BDTLabAutomationCore');
const D = load('mod/mods/lib-review-data.js', 'BDTReviewData');

test('functions: nothing bought at first, a bought one is on and can be turned off and on', () => {
  let f = 0;
  for (const k of C.FUNCS) { assert.equal(C.bought(f, k), false); assert.equal(C.isOn(f, k), false); }
  f = C.buy(f, 'renew');
  assert.equal(C.bought(f, 'renew'), true); assert.equal(C.isOn(f, 'renew'), true);
  assert.equal(C.bought(f, 'collect'), false);
  f = C.turn(f, 'renew', false);
  assert.equal(C.bought(f, 'renew'), true); assert.equal(C.isOn(f, 'renew'), false);
  assert.equal(C.isOn(C.turn(0, 'focus', true), 'focus'), false, 'turning on does not buy');
  assert.equal(C.isOn(C.turn(f, 'renew', true), 'renew'), true);
});

test('the lab table rows after the game\'s three', () => {
  assert.ok(Object.values(C.ROW).every(r => r >= 3 && r < C.ROWS));
});

test('focus: one number back and forth, none', () => {
  for (const [d, a] of [[0, -1], [12, 9], [-1, -1], [3, 0]]) assert.deepEqual(C.decodeFocus(C.encodeFocus(d, a)), { device: d, area: a });
  assert.deepEqual(C.decodeFocus(undefined), { device: -1, area: -1 });
});

test('every device has areas from the review engines', () => {
  for (const d of C.DEVICES) assert.ok(C.areasOf(d, D.engines).length >= 4, d.id);
  assert.deepEqual(C.areasOf(C.DEVICES[0], D.engines).slice(0, 2), ['display', 'camera']);
  assert.deepEqual(C.areasOf(C.DEVICES.find(d => d.id === 'CPU'), D.engines), ['perf', 'cache', 'heat', 'graphics', 'chipfeat']);
});

test('focus weight: the device ×3, its area ×2 more, other devices unchanged', () => {
  const map = C.areaMap(D.engines), phone = C.DEVICES.findIndex(d => d.id === 'SMARTPHONES');
  const display = C.areasOf(C.DEVICES[phone], D.engines).indexOf('display'), camera = C.areasOf(C.DEVICES[phone], D.engines).indexOf('camera');
  const screen = D.research[18];   // ArrayScreenResolution_Smartphone: smartphones and tablets, display
  assert.equal(C.focusWeight(screen, { device: phone, area: -1 }, D.engines, map), 3);
  assert.equal(C.focusWeight(screen, { device: phone, area: display }, D.engines, map), 6);
  assert.equal(C.focusWeight(screen, { device: phone, area: camera }, D.engines, map), 3);
  assert.equal(C.focusWeight(screen, { device: C.DEVICES.findIndex(d => d.id === 'TV'), area: -1 }, D.engines, map), 1);
  assert.equal(C.focusWeight(screen, { device: -1, area: -1 }, D.engines, map), 1);
  const cpu = Object.values(D.research).find(r => r.creating.includes('CPU LAPTOPS'));
  assert.equal(C.focusWeight(cpu, { device: C.DEVICES.findIndex(d => d.id === 'CPU'), area: -1 }, D.engines, map), 3);
});

test('renewal: the amount of the last project and a 10 % fee, only when it has ended and the money is enough', () => {
  assert.deepEqual(C.renewal({ days: 0, amount: 200e6, money: 1e9 }), { amount: 200e6, fee: 20e6, cost: 220e6, ok: true });
  assert.equal(C.renewal({ days: 3, amount: 200e6, money: 1e9 }), null);
  assert.equal(C.renewal({ days: 0, amount: 0, money: 1e9 }), null);
  assert.equal(C.renewal({ days: 0, amount: 200e6, money: 210e6 }).ok, false);
  assert.equal(C.renewal({ days: 0, amount: 1e6, money: 5e6, reserve: 4e6 }).ok, false);
  assert.equal(C.renewal({ days: 0, amount: 1e6, money: 5.2e6, reserve: 4e6 }).ok, true);
});
