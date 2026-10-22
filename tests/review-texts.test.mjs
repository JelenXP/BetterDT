import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const T = load('mod/mods/lib-review-texts.js', 'BDTReviewTexts');
const D = load('mod/mods/lib-review-data.js', 'BDTReviewData');
const full = (a) => Array.isArray(a) && a.length === 15 && a.every(s => typeof s === 'string' && s.trim());
test('every category of every type has 15 names', () => {
  for (const e of Object.values(D.engines)) for (const c of [...e.categories, 'price', 'value', 'innovation']) assert.ok(full(T.cat[c]), c);
});
test('value and innovation texts', () => {
  for (const band of T.value) { assert.equal(band.length, 3); for (const [r, s] of band) { assert.ok(full(r)); assert.ok(full(s)); } }
  assert.equal(T.innovation.length, 3);
  for (const [r, s] of T.innovation) { assert.ok(full(r)); assert.ok(full(s)); }
});
test('placeholders kept in all languages', () => {
  assert.ok(T.innovativeParts.every(s => s.includes('{n}')));
  assert.ok(T.breakthroughLine.every(s => s.includes('{part}') && s.includes('{date}')));
  assert.ok(full(T.breakthroughTitle));
});
test('summaries are short', () => {
  for (const [, s] of [...T.value.flat(), ...T.innovation]) for (const x of s) assert.ok([...x].length <= 24, x);
});
