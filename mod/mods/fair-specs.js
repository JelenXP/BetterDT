// Fair specs – what research unlocks for an own CPU or GPU keeps up with the best part on the market.
//
// The editor of an own chip offers the values of the research tables (ArrayCPURefreshRate_Laptop, …: row 0 the
// value, row 1 the day it comes). Some of them stay far below the competition the chip is compared with: with all
// research done, a laptop CPU or GPU clock reaches about 60 % of the best laptop part of the same year, cores,
// cache, TFLOPS and fill rate are behind too, and watch clocks lag until 2030. Here every value of those tables is
// raised to the best competing part (the processors, iGPU and dGPU arrays of the game, by year) on the market until the
// next value comes, a year ahead at most. A value never goes down; tables already level with the market stay as they
// are. Own chips keep their level, so they get the new value too; the cost counts the share of the best value, so a
// top chip costs what it did. Loading a save gives the tables back from it, so this runs after every load (and every
// month, it costs nothing when nothing changes).
BetterDTKit.mod('fair-specs', {
  needs: {
    objects: ['ArrayCPURefreshRate_Laptop', 'ArrayGPURefreshRate_Laptop', 'ArrayGPUTFLOPS_Laptop'],
    check: () => !globalThis.BDTFairSpecsCore ? 'lib-fair-specs-core.js' : '',
  },
}, (rt, kit) => {
  const C = globalThis.BDTFairSpecsCore;
  const inst = (n) => { try { return rt.objects[n]?.getFirstInstance() || null; } catch { return null; } };
  // series lists (start and end year: 999999), databases and work copies are not parts; AMD_ASeries is
  const names = Object.keys(rt.objects).filter((n) => !/_Series_|_Database_|_Temp/.test(n));
  const changed = new Map();   // table → [[x, game's value, game's text, our value]]

  // the competition's [value, year] pairs of a table
  function parts(from) {
    const out = [];
    for (const [re, vr, yr] of from) for (const n of names) {
      if (!re.test(n)) continue;
      const a = inst(n);
      if (!a || a.height <= Math.max(vr, yr)) continue;
      for (let x = 0; x < a.width; x++) out.push([Number(a.getAt(x, vr)), Number(a.getAt(x, yr))]);
    }
    return out;
  }

  function apply() {
    let n = 0;
    for (const { table, from } of C.TABLES) {
      const a = inst(table);
      if (!a || a.height < 2) continue;
      const steps = C.bestSteps(parts(from));
      if (!steps.length) { kit.warn('no competition found for ' + table); continue; }
      const entries = [], texts = [];
      for (let x = 0; x < a.width; x++) {
        entries.push([Number(a.getAt(x, 0)) || 0, Number(a.getAt(x, 1))]);
        texts.push(a.height > 2 ? { value: Number(a.getAt(x, 0)) || 0, text: a.getAt(x, 2) } : null);
      }
      const raised = C.raise(entries, steps), log = changed.get(table) || [];
      raised.forEach((v, x) => {
        if (v === entries[x][0]) return;
        log.push([x, entries[x][0], texts[x] ? texts[x].text : null, v]);
        a.setAt(v, x, 0);
        if (texts[x]) a.setAt(C.label(v, texts), x, 2);
        n++;
      });
      changed.set(table, log);
    }
    if (n) { BetterDT.log('fair specs', n, 'values raised'); resetCaches(); }
  }
  // the game keeps the best values of the tables and the chip scores for a month: counted again with the new ones
  function resetCaches() {
    for (const k of Object.keys(globalThis)) {
      if (!/^reset\w*(ChipMax|SpecScores|MyCpuSpecs|Hardware)Cache$/.test(k) || typeof globalThis[k] !== 'function') continue;
      try { globalThis[k](); } catch { }
    }
  }

  // a load gives the game's values back: what was raised before is gone
  kit.on('gameLoaded', () => { changed.clear(); apply(); });
  kit.on('month', apply);
  apply();

  // The bars of the own CPU editor (getMyCpuSpecScores) leave out the integrated GPU's core clock and texture units
  // (weight 0: changing them moves nothing), and the device's latencies (touch, app launch, shader compilation, …)
  // share 7 % of PERFORMANCE, about 1 point each. Here the clock counts as in the own GPU editor (power and
  // performance, and the heat and consumption of a higher clock), the texture units as the fill rate, and the
  // latencies get 16 %. The security engine stays out: it is no performance.
  const WEIGHTS = { power: { gClock: 0.08, gTmu: 0.04 }, perf: { gClock: 0.04, lat: 0.16 }, energyLoad: { gClock: 0.06 }, coolHeat: { gClock: 0.06 } };
  let gameWeights = null;
  if (typeof globalThis.setMyCpuSpecScoresConfig === 'function' && typeof globalThis.getMyCpuSpecScoresConfig === 'function') {
    const w = globalThis.getMyCpuSpecScoresConfig().WEIGHTS || {};
    gameWeights = {};
    for (const [bar, keys] of Object.entries(WEIGHTS)) {
      gameWeights[bar] = {};
      for (const k of Object.keys(keys)) gameWeights[bar][k] = (w[bar] && w[bar][k]) || 0;
    }
    globalThis.setMyCpuSpecScoresConfig({ WEIGHTS });
    resetCaches();
  } else kit.warn('own CPU scores have no config: the GPU clock still adds nothing to the bars');

  // off: the game's values back where ours are still in place
  return () => {
    for (const [table, log] of changed) {
      const a = inst(table);
      if (!a) continue;
      for (const [x, v, text, ours] of log.reverse()) {
        if (x >= a.width || Number(a.getAt(x, 0)) !== ours) continue;
        a.setAt(v, x, 0);
        if (text !== null) a.setAt(text, x, 2);
      }
    }
    changed.clear();
    if (gameWeights) globalThis.setMyCpuSpecScoresConfig({ WEIGHTS: gameWeights });
    resetCaches();
  };
});
