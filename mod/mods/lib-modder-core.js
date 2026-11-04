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

  globalThis.BDTModderCore = Object.freeze({ WRAP, sourceName, syntaxLocation, stackLocation, excerpt, jsonProblem, ofMod, describe });
})();
