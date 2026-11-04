import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const M = load('mod/mods/lib-modder-core.js', 'BDTModderCore');

test('a syntax error is found by line and column', () => {
  const code = [
    "BetterDTKit.mod('hello', {}, (rt, kit) => {",
    "  kit.on('day', () => {",
    "    const a = ;",
    "  });",
    "});",
  ].join('\n');
  assert.deepEqual(M.syntaxLocation(code), { line: 3, column: 15, message: "Unexpected token ';'" });
  assert.equal(M.syntaxLocation("const a = 1;\nconst b = 2;"), null);
});

test('a missing closing bracket points at the end, a word at its start', () => {
  const open = "kit.on('day', () => {\n  x();\n";
  const r = M.syntaxLocation(open);
  assert.equal(r.line, 3);
  assert.match(r.message, /end of input/);
  const word = M.syntaxLocation("let x = 1;\nlet y = 2 foo;\n");
  assert.deepEqual([word.line, word.column], [2, 11]);
});

test('the place of a runtime error comes from the stack, the wrapper on line 1 left out', () => {
  const stack = "TypeError: Cannot read properties of null (reading 'x')\n    at onDay (mods/hello/mod.js:12:5)\n    at mods/betterdt-settings.js:600:20";
  assert.deepEqual(M.stackLocation(stack), { file: 'hello/mod.js', line: 12, column: 5, fn: 'onDay' });
  assert.deepEqual(M.stackLocation('Error: x\n    at eval (mods/a.js:1:20)'), { file: 'a.js', line: 1, column: 6, fn: '' });
  assert.equal(M.stackLocation('Error: x\n    at foo (app.js:1:2)'), null);
  assert.equal(M.stackLocation(stack, 'other.js'), null);
});

test('the lines around an error, the line itself marked', () => {
  assert.deepEqual(M.excerpt('a\nb\nc\nd', 2, 1), [{ n: 1, text: 'a', here: false }, { n: 2, text: 'b', here: true }, { n: 3, text: 'c', here: false }]);
  assert.equal(M.excerpt('a', 1).length, 1);
});

test('mod.json problems said plainly, with their place', () => {
  assert.equal(M.jsonProblem('{ "a": 1 }'), null);
  const comma = M.jsonProblem('{\n  "title": "Hi"\n  "version": "1.0"\n}');
  assert.equal(comma.line, 3);
  assert.equal(comma.message, 'a comma is missing before this value');
  const trailing = M.jsonProblem('{\n  "title": "Hi",\n}');
  assert.equal(trailing.line, 3);
  assert.equal(trailing.message, 'a comma before } is not allowed in JSON');
  assert.match(M.jsonProblem('{ "a": 1').message, /ends too early/);
  assert.match(M.jsonProblem("{ 'a': 1 }").message, /double quotes/);
});

test('an error of a mod: the first frame in its own files, a syntax error looked up in its code', () => {
  const e = new TypeError('x is not a function');
  e.stack = 'TypeError: x is not a function\n    at guard (mods/betterdt-settings.js:560:20)\n    at tick (mods/hello/mod.js:7:3)';
  assert.deepEqual(M.describe(e, 'hello'), { message: 'x is not a function', file: 'hello/mod.js', line: 7, column: 3, fn: 'tick' });
  const s = new SyntaxError("Unexpected token ';'");
  s.stack = "SyntaxError: Unexpected token ';'\n    at eval (<anonymous>)";
  const sources = new Map([['hello.js', 'let a = 1;\nlet b = ;']]);
  assert.deepEqual(M.describe(s, 'hello', 'hello.js', sources), { message: "Unexpected token ';'", file: 'hello.js', line: 2, column: 9, fn: '' });
  assert.deepEqual(M.describe('plain', 'hello'), { message: 'plain' });
});

test('the panel: what changed between two snapshots', () => {
  const a = { vars: { Budget: 100, Name: 'A', N: NaN }, tables: { ArrayX: [[1, 2], [3, 4]], ArrayY: [[0]] } };
  const b = { vars: { Budget: 90, Name: 'A', N: NaN, New: 1 }, tables: { ArrayX: [[1, 5], [3, 4]], ArrayY: [[0], [1]], ArrayZ: [[1]] } };
  assert.deepEqual(M.diff(a, b), [
    { kind: 'var', name: 'Budget', from: 100, to: 90 },
    { kind: 'var', name: 'New', from: undefined, to: 1 },
    { kind: 'cell', table: 'ArrayX', x: 0, y: 1, from: 2, to: 5 },
    { kind: 'size', table: 'ArrayY', from: '1×1', to: '2×1' },
  ]);
  const many = M.diff({ vars: { a: 1, b: 1, c: 1 } }, { vars: { a: 2, b: 2, c: 2 } }, 2);
  assert.deepEqual(many.at(-1), { kind: 'more', count: 1 });
});

test('the panel: values in one line, parameter names, code for a mod', () => {
  assert.equal(M.preview({ a: 1, b: 'x', c: [1, 2], d: { e: { f: 1 } } }), '{a: 1, b: "x", c: [1, 2], d: {e: {…}}}');
  const o = { n: 1 }; o.self = o;
  assert.equal(M.preview(o, 3), '{n: 1, self: [circular]}');
  assert.equal(M.preview(function hire(id, cost = 5) { }), 'ƒ hire(id, cost)');
  assert.deepEqual(M.params((a, { b, c }, ...d) => 0), ['a', '{ b, c }', '...d']);
  assert.deepEqual(M.params(x => x), ['x']);
  assert.deepEqual(M.params(Math.max), ['…']);
  assert.equal(M.tableCode('ArrayOffices', { level: 0, 'seat count': 2, '': 3 }), 'const t = kit.table("ArrayOffices", { level: 0, "seat count": 2 });');
  assert.match(M.textCode(10974, "You don't"), /texts: \{ 10974: "You don't" \}\nkit\.text\(10974\)/);
  assert.match(M.wrapCallsCode('reviewsengine'), /^kit\.wrapCalls\("reviewsengine", \{/);
  assert.match(M.replaceCode('hireEmployee', ['id']), /globalThis\.hireEmployee = function \(id\)/);
  assert.deepEqual(M.collapse([{ name: 'a', args: '1' }, { name: 'a', args: '1' }, { name: 'b', args: '' }]).map(c => c.name + c.n), ['a2', 'b1']);
});
