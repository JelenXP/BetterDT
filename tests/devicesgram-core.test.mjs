import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const C = load('mod/mods/lib-devicesgram-core.js', 'BDTDevicesgramCore');

const today = { d: 10, m: 5, y: 2030 };
const T = C.dayNum(today);
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
function state(extra = {}) {
  return {
    registered: true, account: { name: 'Deer', followers: 1e6 }, posts: [], nextId: 7, devCycle: null,
    unlockedThemes: [
      { t: 34, date: { d: 1, m: 5, y: 2030 } },              // fresh
      { t: 77, date: { d: 1, m: 1, y: 2030 } },              // older than 45 days
      { t: 118, date: { d: 9, m: 5, y: 2030 }, posted: true },
      { t: 51, date: null, name: 'Acme' },                   // no date: always on
    ],
    ...extra,
  };
}
const rows = []; for (let t = 0; t < 130; t++) rows.push([1000 + t * 10, 'NEWS', 60 + t, -1, -1, -1, -1, -1, -1, -1, -1]);
const ptd = rows.map((_, t) => ['HEAD ' + t, 'SUB ' + t]);
const ctx = (extra = {}) => ({ date: today, rows, ptd, lang: (i) => 'text ' + i + ' RoasteryRTX', company: 'Deersolutions', rand: seq(0.5), ...extra });

test('available: fresh unlocked topics not posted, announcements only for the device being designed', () => {
  assert.deepEqual(C.available(state(), T, 130), [34, 51]);
  assert.deepEqual(C.available(state({ devCycle: { type: 2, posted: false, name: 'X1' } }), T, 130), [2, 34, 51]);
  assert.deepEqual(C.available(state({ devCycle: { type: 2, posted: true } }), T, 130), [34, 51]);
  assert.deepEqual(C.available(state({ devCycle: { type: 17 } }), T, 130), [34, 51, 98]);
  assert.deepEqual(C.available({ ...state(), registered: false }, T, 130), []);
  assert.deepEqual(C.available(state({ devCycle: { type: 2, posted: false } }), T, 130, false), [34, 51], 'not designing now');
});

test('the default post: first caption with the names, the default design, marked as automatic', () => {
  const s = state();
  const done = C.publishAll(s, ctx());
  assert.deepEqual(done.posted, [34, 51]);
  assert.equal(s.posts.length, 2);
  const p = s.posts[1];   // newest first: 51 on top, then 34
  assert.equal(p.id, 7); assert.equal(s.posts[0].id, 8); assert.equal(s.nextId, 9);
  assert.equal(p.text, 'text 1341 Deersolutions');
  assert.equal(s.posts[0].text, 'text 1511 Deersolutions');     // 51: company name for RoasteryRTX
  assert.equal(p.design.themeId, 34); assert.equal(p.design.bg.n, 35); assert.equal(p.design.top, 94);
  assert.equal(p.design.headline, 'HEAD 34'); assert.equal(p.design.sub, 'SUB 34'); assert.equal(p.design.txt.y, 74);
  assert.equal(p.bdtAuto, 1); assert.deepEqual(p.date, today);
  assert.ok(s.unlockedThemes.find(e => e.t === 34).posted);
  assert.deepEqual(C.available(s, T, 130), []);
});

test('a caption without language texts is built from the post texts; the announcement marks the device cycle', () => {
  const s = state({ devCycle: { type: 0, posted: false, name: 'Phone 9' } });
  C.publishAll(s, ctx({ lang: () => '' }));
  assert.equal(s.posts.find(p => p.design.themeId === 0).text, 'HEAD 0 — SUB 0!');
  assert.equal(s.devCycle.posted, true);
  assert.equal(C.applyNames('RoasteryRTX by Roastery', 2, 'Phone 9', 'Deer'), 'Phone 9 by Deer');
  assert.equal(C.applyNames('Razer joins Roastery', 51, 'Acme', 'Deer'), 'Acme joins Deer');
});

test('followers and likes: 15 % less than the game gives', () => {
  const f = 1e6, r = () => 0.5;
  const game = Math.round(f * 0.025 * (1 + 3 / (1 + f / 1e5)) * (1 / (1 + f / 15e6)) * 0.9);
  assert.equal(C.instantGain(f, r), Math.round(game * 0.85));
  const n = Math.round(f * 0.15);
  assert.equal(C.targets(f, r).likes, Math.round(n * 0.85));
  const s = state();
  const done = C.publishAll(s, ctx());
  assert.equal(s.account.followers, 1e6 + done.followers);
  assert.ok(done.followers > 0);
});

test('daily cut: 15 % of the activity bonus of the automatic posts, nothing without them', () => {
  const f = 1e6, n = 1 / (1 + f / 1e5), big = 1 / (1 + f / 15e6), one = 0.012 + 0.02 * n;
  assert.equal(C.dailyCut([{ date: today, bdtAuto: 1 }], f, T), Math.round(f * one * big * 0.9 * 0.15));
  // a manual post first, the automatic one counts half
  assert.equal(C.dailyCut([{ date: today }, { date: today, bdtAuto: 1 }], f, T), Math.round(f * one * 0.5 * big * 0.9 * 0.15));
  assert.equal(C.dailyCut([{ date: today }], f, T), 0);
  assert.equal(C.dailyCut([{ date: { d: 1, m: 1, y: 2030 }, bdtAuto: 1 }], f, T), 0, 'posts older than 3 days give no bonus');
  assert.equal(C.dailyCut([{ date: today, bdtAuto: 1 }], f, T, 2), Math.round(f * one * big * 0.9 * 2 * 0.15));
});

test('the unlock queue of the game', () => {
  assert.deepEqual(C.parseQueue('34,r2:Phone 9,a0:X,u5,w3,,junk,'), [
    { kind: '', n: 34, name: '' }, { kind: 'r', n: 2, name: 'Phone 9' }, { kind: 'a', n: 0, name: 'X' },
    { kind: 'u', n: 5, name: '' }, { kind: 'w', n: 3, name: '' }]);
  assert.deepEqual(C.parseQueue(''), []);
});
