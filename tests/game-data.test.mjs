import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

const G = load('mod/mods/lib-game-data.js', 'BDTGameData');

// a fake game array: cells[x][y][z]
function array(cells) {
  return {
    get width() { return cells.length; }, get height() { return cells[0] ? cells[0].length : 0; }, depth: 1,
    getAt: (x, y, z = 0) => cells[x]?.[y]?.[z], setAt: (v, x, y, z = 0) => { cells[x][y][z] = v; },
  };
}
// one edition of a model: id, sold, -, cost, price, rating, -, release day, name, date
const model = (id, name, rel, sold = 0) => [id, sold, 0, 100, 150, 7, 0, rel, name, '01.01.2010'];
const none = () => [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1];

function game() {
  const t = {
    ArrayLaptops: array([[model(11, 'DeerPC', 292, 1000), none(), none()], [model(12, 'DeerPC 2', -1), none(), none()]]),
    ArrayMyGPU_LaptopsEarnings: array([[model(20, 'DeerGPU', 400), none(), none()]]),
    ArrayRatingsCompanies: array([
      [[61], [2006], [2026], ['Finland'], [68.5], [0], [0], [0], [0], [0], ['SMARTPHONES,TABLETS']],
      [[-1], [2008], [2026], ['Czechia'], [12], [0], [0], [0], [0], [0], ['LAPTOPS']],
      [[''], [0], [0], [''], [0], [0], [0], [0], [0], [0], ['']],
    ]),
    ArrayCompanyNames: array(Array.from({ length: 62 }, (_, i) => (i === 61 ? [['Nokya'], ['Nokia']] : [['A' + i], ['']]))),
    ArrayMyEmployees: array([[[3]], [[5]]]),
    ArrayEmployees: array(Array.from({ length: 6 }, (_, i) => [['Emp ' + i], [i + 1], [50], [30], [i % 2 ? 'ENGINEERS' : 'DESIGNERS']])),
    ArrayEmployees_Characters: array(Array.from({ length: 6 }, (_, i) => [[i], [i * 2], [i * 3]])),
    ArrayInvesting: array([[[10], [0], [0], [0], [0], [0], [0], [0]], [[11], [0], [0], [0], [0], [0], [0], [0]]]),
    ArrayMyResearch: array([[[1]], [[0]], [[2]]]),
  };
  return { t, arr: (n) => t[n] || null };
}

test('devices: every model of the player with named fields, chips marked', () => {
  const { arr } = game();
  const d = G.devices(arr);
  assert.equal(d.length, 3);
  assert.deepEqual(d[0], { type: 'laptop', chip: false, array: 'ArrayLaptops', x: 0, y: 0, id: 11, name: 'DeerPC', sold: 1000,
    cost: 100, price: 150, rating: 7, releaseDay: 292, releaseDate: '01.01.2010', released: true });
  assert.equal(d[1].released, false);
  assert.equal(d[2].type, 'gpu');
  assert.equal(d[2].chip, true);
});

test('companies: real names from ArrayCompanyNames, the player named and marked', () => {
  const { arr } = game();
  const c = G.companies(arr, 'Deer');
  assert.equal(c.length, 2);
  assert.deepEqual(c[0], { id: 61, name: 'Nokia', player: false, country: 'Finland', earnings: 68.5, start: 2006, finish: 2026,
    types: ['SMARTPHONES', 'TABLETS'] });
  assert.equal(c[1].name, 'Deer');
  assert.equal(c[1].player, true);
});

test('employees: name, profession and skills', () => {
  const { arr } = game();
  assert.deepEqual(G.employees(arr), [
    { id: 3, name: 'Emp 3', profession: 'ENGINEERS', design: 3, speed: 6, research: 9 },
    { id: 5, name: 'Emp 5', profession: 'ENGINEERS', design: 5, speed: 10, research: 15 },
  ]);
});

test('diff: released devices, research levels, hired and gone employees, bought companies', () => {
  const { t, arr } = game();
  const a = G.snapshot(arr);
  assert.deepEqual(G.diff(a, G.snapshot(arr)), []);
  t.ArrayLaptops.setAt(300, 1, 0, 7);                 // DeerPC 2 released
  t.ArrayMyResearch.setAt(3, 2, 0);                  // research 2: level 2 → 3
  t.ArrayMyEmployees.setAt(4, 0, 0);                 // employee 3 left, 4 hired
  t.ArrayInvesting.setAt(1, 1, 7);                   // company 11 bought
  const ev = G.diff(a, G.snapshot(arr));
  assert.deepEqual(ev.map(e => e.type + ':' + e.key), ['deviceReleased:laptop', 'researchDone:2', 'employeeHired:DESIGNERS',
    'employeeLeft:ENGINEERS', 'companyBought:11']);
  assert.equal(ev[0].data.name, 'DeerPC 2');
  assert.deepEqual(ev[1].data, { id: 2, level: 3, from: 2 });
  assert.equal(ev[2].data.id, 4);
  assert.equal(ev[3].data.id, 3);
  assert.deepEqual(ev[4].data, { id: 11, name: '' });
});

test('missing tables give empty lists, not errors', () => {
  const arr = () => null;
  assert.deepEqual(G.devices(arr), []);
  assert.deepEqual(G.companies(arr), []);
  assert.deepEqual(G.employees(arr), []);
  assert.deepEqual(G.diff(G.snapshot(arr), G.snapshot(arr)), []);
  assert.deepEqual(G.diff(null, G.snapshot(arr)), []);
});
