import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const T = load('mod/mods/lib-mod-templates.js', 'BDTModTemplates');
const M = load('mod/mods/lib-modder-core.js', 'BDTModderCore');

test('a mod name: a valid folder name not used yet', () => {
  assert.equal(T.nameProblem('my-mod_2.0'), '');
  assert.equal(T.nameProblem(''), 'empty');
  assert.equal(T.nameProblem('my mod'), 'chars');
  assert.equal(T.nameProblem('.hidden'), 'chars');
  assert.equal(T.nameProblem('mojé'), 'chars');
  assert.equal(T.nameProblem('x'.repeat(61)), 'chars');
  assert.equal(T.nameProblem('Hello', ['hello']), 'taken');
  assert.equal(T.nameProblem('auto-research', ['auto-research.js']), 'taken');
});

test('every template: valid mod.json with the name, and code that compiles and registers the mod', () => {
  for (const id of T.IDS) {
    const f = T.make(id, 'my-mod', { author: 'Me' });
    const m = JSON.parse(f['mod.json']);
    assert.equal(m.title, 'my-mod');
    assert.equal(m.author, 'Me');
    assert.equal(m.requires.betterdt, '0.4.0');
    assert.equal(M.syntaxLocation(f['mod.js']), null, id);
    assert.match(f['mod.js'], /BetterDTKit\.mod\("my-mod"/);
  }
  assert.deepEqual(JSON.parse(T.make('sales', 'x')['mod.json']).options.map(o => o.key), ['percent']);
  assert.equal(T.make('nonsense', 'x')['mod.js'], T.make('empty', 'x')['mod.js']);
});

test('a template runs with a fake kit: what it registers', () => {
  const calls = [];
  const kit = new Proxy({}, { get: (_, k) => (k === 'ui' ? { toast: (t) => calls.push('toast ' + t) } : (...a) => calls.push(k)) });
  globalThis.BetterDTKit = { mod: (name, spec, init) => init({}, kit) };
  new Function(T.make('empty', 'demo')['mod.js'])();
  new Function(T.make('daily', 'demo')['mod.js'])();
  assert.deepEqual(calls, ['toast Hello from demo!', 'on', 'on']);
  delete globalThis.BetterDTKit;
});
