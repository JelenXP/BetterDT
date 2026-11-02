// Chip compare – the rules, without the game: the rows of the comparison of a pinned CPU or GPU with the one chosen
// now in the device designer (parameters, the designer's bars and the production cost), their values as the game
// shows them and the difference. Used by chip-compare.js and the node tests.
(() => {
  const num = (v) => (typeof v === 'number' ? v : Number(v));
  const ok = (v) => Number.isFinite(num(v)) && num(v) > 0;
  const fixed = (v, d) => { const s = num(v).toFixed(d); return d > 0 ? s.replace(/\.?0+$/, '') : s; };
  // the values of the game's chip readers (get…ChipSpecBars().values) and how the designer writes them:
  // cache and VRAM in kB, TFLOPS in GFLOPS, the fill rate in MTexel/s
  const FMT = {
    mhz: (v) => Math.round(v) + ' MHz',
    int: (v) => String(Math.round(v)),
    kb: (v) => (v >= 1e6 ? fixed(v / 1e6, 1) + ' GB' : v >= 1000 ? fixed(v / 1000, 1) + ' MB' : Math.round(v) + ' KB'),
    nm: (v) => fixed(v, 1) + ' nm',
    flops: (v) => (v >= 1000 ? fixed(v / 1000, 2) + ' TFLOPS' : fixed(v, 2) + ' GFLOPS'),
    fill: (v) => (v >= 1e6 ? fixed(v / 1e6, 2) + ' TTexel/s' : fixed(v / 1000, 1) + ' GTexel/s'),
  };
  // the parameters, with the English text of the game's own label (looked up in its language table)
  const PARAMS = [
    { key: 'clock', label: 'CPU FREQUENCY', fmt: 'mhz', part: 'cpu' },
    { key: 'cores', label: 'CPU CORES', fmt: 'int', part: 'cpu' },
    { key: 'cache', label: 'CACHE MEMORY (L2)', fmt: 'kb', part: 'cpu' },
    { key: 'node', label: 'TECHPROCESS', fmt: 'nm', part: 'cpu', low: true },
    { key: 'gClock', label: 'GPU BASE CLOCK', fmt: 'mhz', part: 'gpu' },
    { key: 'gFlops', label: 'PROCESSING POWER', fmt: 'flops', part: 'gpu' },
    { key: 'gTex', label: 'TEXTURE UNITS', fmt: 'int', part: 'gpu' },
    { key: 'gFill', label: 'TEXTURE FILLRATE', fmt: 'fill', part: 'gpu' },
    { key: 'gVram', label: 'VRAM', fmt: 'kb', part: 'gpu' },
  ];
  const show = (fmt, v) => (ok(v) ? FMT[fmt](num(v)) : '—');

  // a row: the shown values, the change in % (NaN without both) and whether B is better (1), worse (-1) or the same
  function row(a, b, low) {
    const pct = ok(a) && ok(b) ? Math.round((num(b) - num(a)) / num(a) * 100) : NaN;
    const d = ok(a) && ok(b) ? num(b) - num(a) : 0;
    return { pct, better: d === 0 ? 0 : (d > 0) !== !!low ? 1 : -1 };
  }

  // the parameter rows of a CPU (its iGPU too: the chip brings it) or a GPU section; a parameter neither chip has is left out
  function params(a, b, kind) {
    const out = [];
    for (const p of PARAMS) {
      if (kind === 'gpu' && p.part !== 'gpu') continue;
      if (!ok(a && a[p.key]) && !ok(b && b[p.key])) continue;
      out.push({ key: p.key, label: p.label, a: show(p.fmt, a && a[p.key]), b: show(p.fmt, b && b[p.key]), ...row(a && a[p.key], b && b[p.key], p.low) });
    }
    return out;
  }
  // the designer's bars (0…100, more is better): the difference in points
  function bars(a, b) {
    return a.map((v, i) => {
      const x = Math.round(num(v)), y = Math.round(num(b[i]));
      const fine = Number.isFinite(x) && Number.isFinite(y);
      return { a: Number.isFinite(x) ? String(x) : '—', b: Number.isFinite(y) ? String(y) : '—', delta: fine ? y - x : NaN, better: !fine || y === x ? 0 : y > x ? 1 : -1 };
    });
  }
  // the production cost of the device (less is better)
  function cost(a, b) {
    const money = (v) => (ok(v) ? '$' + Math.round(num(v)).toLocaleString('en-US') : '—');
    return { a: money(a), b: money(b), ...row(a, b, true), delta: ok(a) && ok(b) ? Math.round(num(b)) - Math.round(num(a)) : NaN };
  }
  const signed = (v, unit = '') => (Number.isFinite(v) ? (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v) + unit : '');

  globalThis.BDTChipCompareCore = Object.freeze({ PARAMS, FMT, show, row, params, bars, cost, signed });
})();
