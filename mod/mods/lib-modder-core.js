// Modder tools – the rules, without the game: where an error in a mod is (a syntax error, an exception with its stack,
// a broken mod.json), the lines of code around it, and the files a modder can change. Used by the BetterDT loader
// script, betterdt-settings.js, modder-tools.js and the node tests.
(() => {
  // the loader runs every file of a mod as '(function () {' + code + '\n})();' with this name for the stack
  const WRAP = '(function () {';
  const sourceName = (file) => 'mods/' + file;

  // compiles without running; returns the SyntaxError or null
  function compileError(code, Fn) {
    try { new Fn(code); return null; } catch (e) { return e instanceof SyntaxError || (e && e.name === 'SyntaxError') ? e : null; }
  }
  const atEnd = (e) => /end of input|unterminated|missing \S+ (?:after|in)|expected expression, got end/i.test(e.message);

  // V8 says where a syntax error is in neither its message nor its stack. The place is found by compiling the start of
  // the code: the first lines that fail other than by ending too early hold it, then the same within that line.
  // Returns { line, column, message } (1-based) or null when the code compiles.
  function syntaxLocation(code, Fn = Function) {
    const full = compileError(code, Fn);
    if (!full) return null;
    const lines = String(code).split('\n');
    // the same message: an earlier, different one ("const a" without its value yet, or the '}' that closes the code)
    // is where the start was cut, not the error
    const fails = (text) => { const e = compileError(text, Fn); return !!e && e.message === full.message; };
    if (atEnd(full)) return { line: lines.length, column: lines[lines.length - 1].length + 1, message: full.message };
    let lo = 1, hi = lines.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (fails(lines.slice(0, mid).join('\n'))) hi = mid; else lo = mid + 1;
    }
    const before = lines.slice(0, lo - 1).join('\n') + (lo > 1 ? '\n' : ''), line = lines[lo - 1];
    let a = 1, b = line.length;
    while (a < b) {
      const mid = (a + b) >> 1;
      if (fails(before + line.slice(0, mid))) b = mid; else a = mid + 1;
    }
    // the character that makes it fail; the token it belongs to starts at the last word boundary before it
    let col = a;
    while (col > 1 && /[\w$]/.test(line[col - 2]) && /[\w$]/.test(line[col - 1])) col--;
    return { line: lo, column: col, message: full.message };
  }

  // the place of an error in one of the mod files, from its stack: { file, line, column, fn } or null
  // (a stack frame looks like "at onDay (mods/hello/mod.js:12:5)" or "at mods/hello/mod.js:12:5");
  // only: a file name or a test of it, for the first frame in the mod's own files
  function stackLocation(stack, only) {
    const want = typeof only === 'function' ? only : only ? (f) => f === only : () => true;
    const re = /(?:at\s+(?:([^\s(]+)\s+\()?)?mods\/([^\s():]+):(\d+):(\d+)/g;
    for (let m; (m = re.exec(String(stack || '')));) {
      const file = m[2];
      if (!want(file)) continue;
      let line = Number(m[3]), column = Number(m[4]);
      if (line === 1) column = Math.max(1, column - WRAP.length);
      const fn = m[1] && m[1] !== 'eval' && m[1] !== 'Object.<anonymous>' ? m[1] : '';
      return { file, line, column, fn };
    }
    return null;
  }

  // a few numbered lines around a line of the code, the line itself marked: [{ n, text, here }]
  function excerpt(code, line, around = 2) {
    const lines = String(code || '').split('\n'), out = [];
    for (let n = Math.max(1, line - around); n <= Math.min(lines.length, line + around); n++) {
      out.push({ n, text: lines[n - 1].replace(/\t/g, '  ').slice(0, 160), here: n === line });
    }
    return out;
  }

  // what is wrong with a mod.json: { line, column, message } or null when it is valid
  function jsonProblem(text) {
    try { JSON.parse(text); return null; } catch (e) {
      const s = String(text), msg = String(e.message);
      let pos = -1;
      const p = /position (\d+)/.exec(msg);
      if (p) pos = Number(p[1]);
      else if (/end of JSON input/i.test(msg)) pos = s.length;
      if (pos < 0) return { line: 1, column: 1, message: msg };
      const head = s.slice(0, pos).split('\n');
      return { line: head.length, column: head[head.length - 1].length + 1, message: hintJson(msg, s, pos) };
    }
  }
  // the usual reasons, said plainly
  function hintJson(msg, s, pos) {
    if (/end of JSON input/i.test(msg) || (pos !== null && pos >= s.replace(/\s+$/, '').length)) return 'the file ends too early: a closing } or ] is missing';
    const prev = pos === null ? '' : s.slice(0, pos).replace(/\s+$/, '').slice(-1);
    const ch = pos === null ? '' : s[pos];
    if ((ch === '}' || ch === ']') && prev === ',') return 'a comma before ' + ch + ' is not allowed in JSON';
    if (ch === '"' && /["\d\]}el]$/.test(prev)) return 'a comma is missing before this value';
    if (ch === "'") return "JSON needs double quotes (\"), not '";
    if (/^\/[/*]/.test(pos === null ? '' : s.slice(pos))) return 'JSON has no comments';
    return msg.replace(/^JSON\.parse: /, '').replace(/ in JSON at position \d+.*$/, '');
  }

  // the files of a mod: 'hello' is mods/hello/… (a folder mod) or mods/hello.js
  const ofMod = (name) => (file) => file === name + '.js' || file.startsWith(name + '/');

  // an error of a mod as the settings show it: { message, file?, line?, column?, fn? }; a syntax error is looked up
  // in the code the loader ran (sources: file -> code)
  function describe(e, name, file, sources) {
    const out = { message: String((e && e.message) || e) };
    let loc = stackLocation(e && e.stack, name ? ofMod(name) : null);
    if (!loc && e && e.name === 'SyntaxError' && file && sources && sources.has(file)) {
      const s = syntaxLocation(sources.get(file));
      if (s) loc = { file, line: s.line, column: s.column, fn: '' };
    }
    return loc ? Object.assign(out, loc) : out;
  }

  // ── the modder panel ─────────────────────────────────────────────────────────────────────────────
  // what changed between two snapshots { vars: { name: value }, tables: { name: [[column 0 cells], [column 1], …] } }:
  // [{ kind: 'var', name, from, to }, { kind: 'cell', table, x, y, from, to }, { kind: 'size', table, from, to }],
  // at most max of them (more: the last entry is { kind: 'more', count })
  function diff(a, b, max = 500) {
    const out = [];
    let more = 0;
    const push = (c) => { if (out.length < max) out.push(c); else more++; };
    const same = (p, q) => p === q || (Number.isNaN(p) && Number.isNaN(q));
    for (const name of Object.keys(b.vars || {})) {
      const from = (a.vars || {})[name], to = b.vars[name];
      if (!same(from, to)) push({ kind: 'var', name, from, to });
    }
    for (const table of Object.keys(b.tables || {})) {
      const p = (a.tables || {})[table], q = b.tables[table];
      if (!p) continue;
      const pw = p.length, qw = q.length, ph = pw ? p[0].length : 0, qh = qw ? q[0].length : 0;
      if (pw !== qw || ph !== qh) push({ kind: 'size', table, from: pw + '×' + ph, to: qw + '×' + qh });
      for (let x = 0; x < Math.min(pw, qw); x++) for (let y = 0; y < Math.min(ph, qh); y++) {
        if (!same(p[x][y], q[x][y])) push({ kind: 'cell', table, x, y, from: p[x][y], to: q[x][y] });
      }
    }
    if (more) out.push({ kind: 'more', count: more });
    return out;
  }

  // a value in one line, as the console shows it: strings quoted, objects and arrays shortened
  function preview(v, depth = 1, seen = new Set()) {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    const t = typeof v;
    if (t === 'string') return JSON.stringify(v.length > 200 ? v.slice(0, 200) + '…' : v);
    if (t === 'number' || t === 'boolean') return String(v);
    if (t === 'bigint') return String(v) + 'n';
    if (t === 'symbol') return v.toString();
    if (t === 'function') return 'ƒ ' + (v.name || 'anonymous') + '(' + params(v).join(', ') + ')';
    if (seen.has(v)) return '[circular]';
    if (v instanceof Error) return v.name + ': ' + v.message;
    if (typeof Element !== 'undefined' && v instanceof Element) return '<' + v.tagName.toLowerCase() + (v.id ? '#' + v.id : '') + '>';
    if (depth < 0) return Array.isArray(v) ? '[…' + v.length + ']' : '{…}';
    seen.add(v);
    let s;
    if (Array.isArray(v)) {
      const items = v.slice(0, 20).map(x => preview(x, depth - 1, seen));
      s = '[' + items.join(', ') + (v.length > 20 ? ', … ' + (v.length - 20) + ' more' : '') + ']';
    } else {
      let keys = [];
      try { keys = Object.keys(v); } catch { }
      const name = v.constructor && v.constructor.name && v.constructor.name !== 'Object' ? v.constructor.name + ' ' : '';
      const items = keys.slice(0, 12).map(k => {
        let x;
        try { x = v[k]; } catch (e) { x = e; }
        return (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ': ' + preview(x, depth - 1, seen);
      });
      s = name + '{' + items.join(', ') + (keys.length > 12 ? ', … ' + (keys.length - 12) + ' more' : '') + '}';
    }
    seen.delete(v);
    return s;
  }

  // the parameter names of a function, from its code ("function f(a, b = 1)", "(a, { b }) =>", "x =>")
  function params(fn) {
    let src = '';
    try { src = Function.prototype.toString.call(fn); } catch { return []; }
    if (/\[native code\]/.test(src)) return ['…'];
    const m = /^[^(=]*?\(([^)]*)\)/.exec(src.replace(/\/\*[\s\S]*?\*\//g, ''));
    if (!m) { const a = /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/.exec(src); return a ? [a[1]] : []; }
    const out = [];
    let depth = 0, cur = '';
    for (const ch of m[1]) {
      if ('([{'.includes(ch)) depth++;
      if (')]}'.includes(ch)) depth--;
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out.map(p => p.trim().replace(/\s*=[\s\S]*$/, '').replace(/\s+/g, ' ')).filter(Boolean);
  }

  // code for a mod: a table with named rows, a game text, a call of an event function wrapped, a function replaced
  const ident = (s) => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : JSON.stringify(s));
  function tableCode(table, fields) {
    const f = Object.entries(fields).filter(([k]) => k).map(([k, y]) => ident(k) + ': ' + y).join(', ');
    return `const t = kit.table(${JSON.stringify(table)}, { ${f} });`;
  }
  const textCode = (index, english) => `// in the mod's spec: texts: { ${index}: ${JSON.stringify(english)} }\nkit.text(${index})`;
  const wrapCallsCode = (name) => `kit.wrapCalls(${JSON.stringify(name)}, {\n  before: () => { },\n  after: () => { },\n});`;
  function replaceCode(name, args) {
    const a = args.filter(x => x !== '…').join(', ');
    return `const orig = globalThis.${name};\nglobalThis.${name} = function (${a}) {\n  const result = orig.apply(this, arguments);\n  return result;\n};\nkit.onStop(() => { globalThis.${name} = orig; });`;
  }

  // the calls recorded by the panel, a run of the same call shown once with its count:
  // [{ name, args, result, n }] from [{ name, args, result }]
  function collapse(calls) {
    const out = [];
    for (const c of calls) {
      const last = out[out.length - 1];
      if (last && last.name === c.name && last.args === c.args) { last.n++; last.result = c.result; } else out.push({ ...c, n: 1 });
    }
    return out;
  }

  globalThis.BDTModderCore = Object.freeze({
    WRAP, sourceName, syntaxLocation, stackLocation, excerpt, jsonProblem, ofMod, describe,
    diff, preview, params, tableCode, textCode, wrapCallsCode, replaceCode, collapse,
  });
})();
