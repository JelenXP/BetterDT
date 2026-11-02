// Fair specs – the rules, without the game: the values of the player's spec tables (what research unlocks for an own
// chip: clocks, cores, cache, TFLOPS, …) raised to the best part of the competition on the market while each value is
// the newest one. Some of the game's tables stay far below the parts the player's chip is compared with (laptop clocks
// at about 60 %); a value never goes down. Used by fair-specs.js and the node tests.
(() => {
  const DAYS_PER_YEAR = 365, FIRST_YEAR = 2008;
  // the first game day of a year (1 January 2030 is day 8031)
  const yearDay = (y) => (y - FIRST_YEAR) * DAYS_PER_YEAR + 1;

  // what each table is compared with: arrays of the competition (by name), the row of the value and of the year
  const PROC = (dev) => new RegExp('^ArrayProcessors_.*_' + dev + '$');
  const TABLES = [
    { table: 'ArrayCPURefreshRate_Smartphone', from: [[PROC('Smartphones'), 2, 11]] },
    { table: 'ArrayGPURefreshRate_Smartphone', from: [[PROC('Smartphones'), 9, 11], [/^ArrayGPU_.*_Smartphones$/, 1, 2]] },
    { table: 'ArrayCPURefreshRate_Laptop', from: [[PROC('Laptops'), 2, 11]] },
    { table: 'ArrayCPUCores_Laptop', from: [[PROC('Laptops'), 3, 11]] },
    { table: 'ArrayCPUCasheMemory_Laptop', from: [[PROC('Laptops'), 5, 11]] },
    { table: 'ArrayGPURefreshRate_Laptop', from: [[/^ArrayiGPU_.*_Laptop$/, 3, 7], [/^ArraydGPU_.*_Laptop$/, 3, 8]] },
    { table: 'ArrayGPUTFLOPS_Laptop', from: [[/^ArrayiGPU_.*_Laptop$/, 4, 7], [/^ArraydGPU_.*_Laptop$/, 5, 8]] },
    { table: 'ArrayGPUTextureUnits_Laptop', from: [[/^ArrayiGPU_.*_Laptop$/, 5, 7], [/^ArraydGPU_.*_Laptop$/, 6, 8]] },
    { table: 'ArrayGPUTextureFillRate_Laptop', from: [[/^ArrayiGPU_.*_Laptop$/, 6, 7], [/^ArraydGPU_.*_Laptop$/, 7, 8]] },
    { table: 'ArrayGPUMemory_Laptop', from: [[/^ArraydGPU_.*_Laptop$/, 4, 8]] },
    { table: 'ArrayCPURefreshRate_Watches', from: [[PROC('Watches'), 2, 11]] },
    { table: 'ArrayGPURefreshRate_Watches', from: [[PROC('Watches'), 9, 11]] },
    { table: 'ArrayCPURefreshRate_Console', from: [[PROC('Consoles'), 2, 11]] },
    { table: 'ArrayGPURefreshRate_Console', from: [[/^ArrayiGPU_.*_Consoles$/, 3, 7]] },
    { table: 'ArrayCPURefreshRate_VR', from: [[PROC('VR'), 2, 11]] },
    { table: 'ArrayGPURefreshRate_VR', from: [[PROC('VR'), 9, 11], [/^ArrayGPU_.*_VR$/, 1, 2]] },
  ];

  // the best value on the market by day: the competition's [value, year] pairs as steps [[day, best so far], …]
  function bestSteps(parts) {
    const byYear = new Map();
    for (const [v, y] of parts) if (v > 0 && y > 1990 && y < 2200) byYear.set(y, Math.max(byYear.get(y) || 0, v));
    const steps = [];
    let best = 0;
    for (const y of [...byYear.keys()].sort((a, b) => a - b)) {
      if (byYear.get(y) > best) { best = byYear.get(y); steps.push([yearDay(y), best]); }
    }
    return steps;
  }
  function bestOn(steps, day) {
    let v = 0;
    for (const [d, b] of steps) { if (d > day) break; v = b; }
    return v;
  }

  // the new values of a table: entries [value, born day] in table order (rising values); each value at least the best
  // part on the market until the next value comes (at most a year ahead: the levels are 0.5…4 years apart, and the
  // market moves on in between), never lower than before, and never below the one before it
  const AHEAD_DAYS = DAYS_PER_YEAR;
  function raise(entries, steps) {
    const out = [];
    let prev = -Infinity;
    for (let i = 0; i < entries.length; i++) {
      const [v, born] = entries[i], next = i + 1 < entries.length ? entries[i + 1][1] - 1 : Infinity;
      let n = Math.max(v, bestOn(steps, Math.max(born, Math.min(next, born + AHEAD_DAYS))));
      if (n < prev) n = prev;
      out.push(n);
      prev = n;
    }
    return out;
  }

  // a table's text row ("118.67 GFLOPS", "8.64 TTexel/s") for a new value: the unit and the decimals of the entry with
  // the nearest value at or below it, scaled the same way
  function label(value, entries) {
    let ref = null;
    for (const e of entries) {
      const m = /^\s*([\d.]+)\s*(.*)$/.exec(String(e.text || ''));
      if (!m || !(+m[1] > 0) || !(e.value > 0)) continue;
      if (e.value <= value || !ref) ref = { factor: e.value / +m[1], decimals: (m[1].split('.')[1] || '').length, unit: m[2] };
      if (e.value > value) break;
    }
    if (!ref) return '';
    return (value / ref.factor).toFixed(ref.decimals) + (ref.unit ? ' ' + ref.unit : '');
  }

  globalThis.BDTFairSpecsCore = Object.freeze({ TABLES, yearDay, bestSteps, bestOn, raise, label });
})();
