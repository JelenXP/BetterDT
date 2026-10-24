import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

// a runtime with what BetterDTKit reads: the language table, global variables, the screen and the tick event
const ticks = new Set();
const cells = { ArrayLanguage: [[['Hello'], ['World']]], ArrayCountries: [[['Czechia'], [53], [0.15]], [['Spain'], [40], [0.25]]] };
const array = (name) => {
  const data = cells[name];
  return {
    get width() { return data.length; }, get height() { return data[0].length; },
    getAt: (x, y) => data[x]?.[y]?.[0], setAt: (v, x, y) => { data[x][y] = [v]; },
  };
};
const rt = {
  layout: { name: 'MENU' },
  globalVars: { LanguageChoose: 2, DayTotal: 0, Day: 1, Month: 1, Year: 2008, Budget: 1000, ResearchCoins: 5, CompanyName: 'Co', CompanyCountryID: 0 },
  objects: Object.fromEntries(Object.keys(cells).map(n => [n, { getFirstInstance: () => array(n) }])),
  addEventListener: (t, f) => { if (t === 'tick') ticks.add(f); },
  removeEventListener: (t, f) => { if (t === 'tick') ticks.delete(f); },
  dt: 1 / 60,
  projectVersion: '1.6.0',
};
const tick = () => { for (const f of [...ticks]) f(); };
globalThis.runtime = rt;

const store = {}, listeners = new Set(), starts = [];
globalThis.BetterDT = {
  version: '0.4.0',
  log: () => {},
  register: (name, init) => starts.push(init),
  mods: [{ file: 'folder-mod', folder: true, enabled: true, manifest: {
    title: { en: 'Folder mod', de: 'Ordner-Mod' }, version: '2.0', requires: { betterdt: '0.4.0', game: '1.5' },
    options: [{ key: 'on', default: true }, { key: 'n', type: 'range', default: 5, min: 1, max: 9 },
      { key: 'mode', type: 'choice', default: 'a', choices: ['a', { value: 'b', label: { en: 'Bee' } }] }],
  } }],
  settings: {
    get: (k, d) => (k in store ? store[k] : d),
    bool: (k, d) => (k in store ? !/^(0|false|off|no)$/i.test(store[k]) : !!d),
    num: (k, d) => (k in store && Number.isFinite(Number(store[k])) ? Number(store[k]) : d),
    set: (k, v) => { store[k] = typeof v === 'boolean' ? (v ? '1' : '0') : String(v); for (const f of listeners) f(k, store[k]); return Promise.resolve(); },
    onChange: (f) => { listeners.add(f); return () => listeners.delete(f); },
  },
};
const KIT = load('mod/mods/betterdt-settings.js', 'BetterDTKit');

// registers a mod, starts it like the loader does and returns its kit
function start(name, spec) {
  let kit = null;
  KIT.mod(name, spec, (r, k) => { kit = k; });
  starts.pop()(rt);
  return kit;
}

test('metadata of a folder mod: localized texts and normalized options', () => {
  assert.equal(KIT.localize(KIT.info('folder-mod').title), 'Ordner-Mod');   // LanguageChoose 2 = German
  assert.equal(KIT.localize('plain'), 'plain');
  assert.equal(KIT.localize({ ko: 'x' }), 'x');
  const o = KIT.options('folder-mod');
  assert.deepEqual(o.map(x => x.key + ':' + x.type), ['folder-mod.on:bool', 'folder-mod.n:range', 'folder-mod.mode:choice']);
  assert.deepEqual(o[2].choices, [{ value: 'a', label: 'a' }, { value: 'b', label: { en: 'Bee' } }]);
});

test('requires: an older BetterDT makes the mod incompatible, a fitting one starts', () => {
  start('folder-mod', {});
  assert.equal(KIT.status().find(m => m.name === 'folder-mod').state, 'running');
  start('needs-new', { info: { requires: { betterdt: '0.10.0' } } });
  const st = KIT.status().find(m => m.name === 'needs-new');
  assert.equal(st.state, 'incompatible');
  assert.deepEqual(st.problems, ['BetterDT 0.10.0 or newer']);
});

test('options: defaults, stored values, clamping, choices and change events', async () => {
  const kit = start('opts', { info: { options: [{ key: 'n', type: 'range', default: 5, min: 1, max: 9 },
    { key: 'mode', type: 'choice', default: 'a', choices: ['a', 'b'] }, { key: 'on', default: false }] } });
  assert.equal(kit.option('n'), 5);
  assert.equal(kit.option('opts.mode'), 'a');
  assert.equal(kit.option('on'), false);
  const seen = [];
  kit.on('option', 'n', (v) => seen.push(v));
  await BetterDT.settings.set('opts.n', 40);
  await BetterDT.settings.set('opts.mode', 'zzz');
  await BetterDT.settings.set('opts.on', true);
  assert.equal(kit.option('n'), 9);
  assert.equal(kit.option('mode'), 'a');   // not one of the choices: default
  assert.equal(kit.option('on'), true);
  assert.deepEqual(seen, [9]);
});

test('events: screen, leave, gameLoaded, day, month, gameClosed', () => {
  const kit = start('events', {});
  const log = [];
  kit.on('screen', (s, prev) => log.push('screen ' + s + ' ' + prev));
  kit.on('screen', 'BOSS OFFICE', () => log.push('office'));
  kit.on('leave', 'MENU', (s, next) => log.push('leave ' + s + ' ' + next));
  kit.on('gameLoaded', (d) => log.push('loaded ' + d.total));
  kit.on('day', (d) => log.push('day ' + d.total));
  kit.on('month', (d) => log.push('month ' + d.month));
  kit.on('gameClosed', () => log.push('closed'));
  const g = rt.globalVars;
  tick();                                                          // the current screen counts as entered
  rt.layout.name = 'LOADING GAME'; g.DayTotal = 100; g.Day = 30; g.Month = 4; tick();   // not loaded yet
  rt.layout.name = 'BOSS OFFICE'; tick();
  g.DayTotal = 101; g.Day = 1; g.Month = 5; tick();
  g.DayTotal = 102; g.Day = 2; tick();
  g.DayTotal = 900; tick();                                        // another save: no day event
  g.DayTotal = 0; rt.layout.name = 'MENU'; tick();
  assert.deepEqual(log, [
    'screen MENU undefined',
    'screen LOADING GAME MENU', 'leave MENU LOADING GAME',
    'screen BOSS OFFICE LOADING GAME', 'office', 'loaded 100',
    'day 101', 'month 5',
    'day 102',
    'loaded 900',
    'screen MENU BOSS OFFICE', 'closed',
  ]);
});

test('events stop with the mod, errors are counted', () => {
  const kit = start('stops', {});
  let n = 0;
  kit.on('tick', () => { n++; });
  tick();
  kit.fail('stop');
  tick();
  assert.equal(n, 1);
  assert.throws(() => kit.on('nonsense', () => {}), /unknown event/);
});

test('kit.table and kit.game', () => {
  const kit = start('tables', {});
  const t = kit.table('ArrayCountries', { name: 0, money: 1, tax: 2 });
  assert.equal(t.width, 2);
  assert.equal(t.height, 3);
  assert.deepEqual({ ...t.record(1) }, { id: 1, name: 'Spain', money: 40, tax: 0.25 });
  t.record(0).money = 60;
  assert.equal(t.get(0, 'money'), 60);
  assert.equal(t.find(r => r.tax > 0.2).name, 'Spain');
  assert.deepEqual(t.column(0), ['Czechia', 60, 0.15]);
  assert.equal(kit.table('Missing').exists, false);
  assert.equal(kit.game.tables.countries.record(1).name, 'Spain');
  kit.game.money = 2500;
  assert.equal(rt.globalVars.Budget, 2500);
  assert.equal(kit.game.lang, 'de');
  assert.equal(kit.game.version, '1.6.0');
});

test('sales multipliers: their product while the sales run, the decay kept, gone when the mod stops', () => {
  const pop = new Map([['0:0', 50], ['1:0', 40]]);
  // Construct arrays have getAt/setAt on the prototype
  const tv = Object.create({
    getAt(x, y, z) { return z === 2 ? pop.get(x + ':' + y) : 7; },
    setAt(v, x, y, z) { if (z === 2) pop.set(x + ':' + y, v); },
  });
  rt.objects.ArrayTV = { getFirstInstance: () => tv };
  const a = start('mul-a', {}), b = start('mul-b', {});
  a.salesMultiplier((n, x) => (n === 'ArrayTV' && x === 0 ? 0.5 : 1));
  b.salesMultiplier((n, x) => (x === 0 ? 1.2 : 'x'));
  KIT._sales.on(['ArrayTV']);
  assert.ok(Math.abs(tv.getAt(0, 0, 2) - 30) < 1e-9);   // 50 × 0.5 × 1.2
  assert.equal(tv.getAt(1, 0, 2), 40);
  assert.equal(tv.getAt(0, 0, 5), 7);
  tv.setAt(30 - 3, 0, 0, 2);                            // the game writes back what it read minus its decay of 3
  KIT._sales.off();
  assert.ok(Math.abs(pop.get('0:0') - 47) < 1e-9);
  assert.equal(Object.prototype.hasOwnProperty.call(tv, 'getAt'), false);
  a.fail('stop');
  KIT._sales.on(['ArrayTV']);
  assert.ok(Math.abs(tv.getAt(0, 0, 2) - 47 * 1.2) < 1e-9);
  KIT._sales.off();
  delete rt.objects.ArrayTV;
});

test('an old mod without the new fields works as before', () => {
  let got = null;
  KIT.mod('old', { needs: { vars: ['Budget'] } }, (r, k) => { got = [typeof k.guard, typeof k.text, typeof k.wrapCalls]; });
  starts.pop()(rt);
  assert.deepEqual(got, ['function', 'function', 'function']);
  assert.equal(KIT.status().find(m => m.name === 'old').state, 'running');
  assert.equal(KIT.info('old'), null);
  assert.deepEqual(KIT.options('old'), []);
});
