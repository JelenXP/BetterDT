import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const C = load('mod/mods/lib-auto-research-core.js', 'BDTAutoResearchCore');

// a small game: levels, the levels it offers now and the price of one level
function game(cards, { targets, levels = {}, costs = {}, rp = 1000, money = 1e6, reserve = 0, today = 100, ...rest }) {
  const lv = { ...levels };
  const ctx = {
    today, targets: new Map(Object.entries(targets).map(([k, v]) => [+k, v])), level: (id) => lv[id] || 0,
    cost: (id) => costs[id] || { rp: 10, usd: 1000 }, rp, money, reserve, ...rest,
  };
  return { ctx, run: () => C.plan(cards, ctx), lv };
}
const ticked = (...ids) => new Map(ids.map(id => [id, {}]));

test('a ticked card gets every level the game offers, an unticked one nothing', () => {
  const cards = ticked(1);
  const r = game(cards, { targets: { 1: 3, 2: 2 }, levels: { 1: 1 } }).run();
  assert.deepEqual(r.buys, [1, 1]);
  assert.equal(r.rp, 20); assert.equal(r.usd, 2000);
  assert.deepEqual(cards.get(1), {});
});

test('one level of each card per round, recommended cards first, then the cheaper ones', () => {
  const cards = ticked(1, 2, 3);
  const costs = { 1: { rp: 10, usd: 5000 }, 2: { rp: 10, usd: 1000 }, 3: { rp: 10, usd: 9000 } };
  const r = game(cards, { targets: { 1: 2, 2: 2, 3: 1 }, costs, recommended: new Set([3]) }).run();
  assert.deepEqual(r.buys, [3, 2, 1, 2, 1]);
});

test('not enough: a second try after 5 days, then short with what was missing, bought as soon as it fits', () => {
  const cards = ticked(1);
  const g = game(cards, { targets: { 1: 2 }, levels: { 1: 1 }, rp: 5 });
  assert.deepEqual(g.run().buys, []);
  assert.deepEqual(cards.get(1), { wait: { day: 105, max: 2 } });
  g.ctx.today = 104;
  assert.deepEqual(g.run(), { buys: [], rp: 0, usd: 0, gaveUp: [] });
  g.ctx.today = 105;
  const r = g.run();
  assert.deepEqual(r.gaveUp, [{ id: 1, level: 2, rp: 5, usd: 0, reserve: false }]);
  assert.deepEqual(cards.get(1), { short: 2 });
  g.ctx.today = 106;
  assert.deepEqual(g.run(), { buys: [], rp: 0, usd: 0, gaveUp: [] }, 'no second message');
  assert.deepEqual(cards.get(1), { short: 2 });
  g.ctx.today = 107; g.ctx.rp = 1000;
  assert.deepEqual(g.run().buys, [1], 'bought the day there is enough');
  assert.deepEqual(cards.get(1), {});
});

test('given up by the game: it waits for a new level', () => {
  const cards = new Map([[1, { gave: 2 }]]);
  const g = game(cards, { targets: { 1: 2 }, levels: { 1: 1 }, rp: 1000 });
  assert.deepEqual(g.run().buys, []);
  assert.deepEqual(cards.get(1), { gave: 2 });
});

test('short and a new level of the game: everything starts again', () => {
  const cards = new Map([[1, { short: 2 }]]);
  const g = game(cards, { targets: { 1: 3 }, levels: { 1: 1 }, rp: 5 });
  g.run();
  assert.deepEqual(cards.get(1), { wait: { day: 105, max: 3 } });
});

test('a new level of the game: the given up level is tried again together with it', () => {
  const cards = new Map([[1, { gave: 2 }]]);
  const r = game(cards, { targets: { 1: 3 }, levels: { 1: 1 } }).run();
  assert.deepEqual(r.buys, [1, 1]);
  assert.deepEqual(cards.get(1), {});
});

test('the second try buys what it can now', () => {
  const cards = new Map([[1, { wait: { day: 100, max: 2 } }]]);
  assert.deepEqual(game(cards, { targets: { 1: 2 }, levels: { 1: 1 } }).run().buys, [1]);
  assert.deepEqual(cards.get(1), {});
});

test('the money reserve: nothing that would leave less, and it is named when giving up', () => {
  const cards = new Map([[1, { wait: { day: 100, max: 2 } }]]);
  const r = game(cards, { targets: { 1: 2 }, levels: { 1: 1 }, money: 5000, reserve: 4500 }).run();
  assert.deepEqual(r.buys, []);
  assert.deepEqual(r.gaveUp, [{ id: 1, level: 2, rp: 0, usd: 0, reserve: true }]);
  const ok = game(ticked(1), { targets: { 1: 2 }, levels: { 1: 1 }, money: 5000, reserve: 4000 }).run();
  assert.deepEqual(ok.buys, [1]);
});

test('money runs out midway: the rest waits', () => {
  const cards = ticked(1, 2);
  const r = game(cards, { targets: { 1: 1, 2: 1 }, money: 1500 }).run();
  assert.deepEqual(r.buys, [1]);
  assert.deepEqual(cards.get(1), {});
  assert.deepEqual(cards.get(2), { wait: { day: 105, max: 1 } });
});

test('sandbox: everything, whatever the price', () => {
  const r = game(ticked(1), { targets: { 1: 3 }, rp: 0, money: 0, free: true }).run();
  assert.deepEqual(r.buys, [1, 1, 1]);
  assert.equal(r.usd, 0);
});

test('only: a card just ticked is tried alone, waits of the others are left', () => {
  const cards = new Map([[1, {}], [2, { wait: { day: 100, max: 1 } }]]);
  const r = game(cards, { targets: { 1: 1, 2: 1 }, only: new Set([1]) }).run();
  assert.deepEqual(r.buys, [1]);
  assert.deepEqual(cards.get(2), { wait: { day: 100, max: 1 } });
});

test('a card at the top of what the game offers forgets its wait', () => {
  const cards = new Map([[1, { wait: { day: 300, max: 2 } }]]);
  game(cards, { targets: { 1: 2 }, levels: { 1: 2 } }).run();
  assert.deepEqual(cards.get(1), {});
});

test('kept in settings: short values, the same cards back', () => {
  const cards = new Map();
  for (let id = 0; id < 700; id += 3) cards.set(id, id % 2 ? { wait: { day: 7804 + id, max: 12 } } : id % 5 ? {} : id % 3 ? { gave: 38 } : { short: 40 });
  const chunks = C.encode(cards);
  assert.ok(chunks.length > 1 && chunks.every(c => c.length <= 190 && !/[\r\n]/.test(c)));
  assert.deepEqual(C.decode(chunks), cards);
  assert.deepEqual(C.encode(new Map()), []);
  assert.deepEqual(C.decode(['1a_h']), new Map([[46, { short: 17 }]]), 'the given up state of older versions is short');
  assert.deepEqual(C.decode([]), new Map());
});

test('a company key fits the settings keys', () => {
  const k = C.companyKey('Deersolutions ěšč = #');
  assert.match(k, /^auto-research\.c[0-9a-z]+$/);
  assert.equal(k, C.companyKey('Deersolutions ěšč = #'));
  assert.notEqual(k, C.companyKey('Other'));
});
