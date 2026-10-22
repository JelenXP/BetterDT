// Research breakthroughs – the math, without the game: how many breakthroughs a finished lab project gives, which
// research categories can get one and how they are drawn. Used by research-breakthroughs.js and the node tests.
(() => {
  const K = [900, 3600, 12000], EXP = 0.6, MAX_MISSING = 4, MAX_MISSING_RP = 120, AHEAD_DAYS = 365;
  const chance = (Y, k) => Y > 0 ? Y ** EXP / (Y ** EXP + k ** EXP) : 0;
  function attempts(Y, rng) { let n = 0; for (const k of K) { if (rng() < chance(Y, k)) n++; else break; } return n; }
  function datedCount(borns, today) { let n = 0; while (n < borns.length && borns[n] <= today) n++; return n; }
  // L = the player's level (unlocked rows); the new level unlocks one row ahead of what the game offers today
  function target(L, borns, today, cost) {
    const A = datedCount(borns, today);
    let row = L;
    if (L < A) {
      const missing = A - L;
      if (missing > MAX_MISSING || (missing > 1 && missing * cost > MAX_MISSING_RP)) return null;
      row = A;
    }
    if (row >= borns.length || !(borns[row] > today) || borns[row] > today + AHEAD_DAYS) return null;
    return { row, level: row + 1 };
  }
  function pick(cands, n, rng) {
    const left = cands.slice(), out = [];
    while (out.length < n && left.length) {
      const sum = left.reduce((s, c) => s + c.w, 0);
      let r = rng() * sum, i = 0;
      while (i < left.length - 1 && r >= left[i].w) { r -= left[i].w; i++; }
      out.push(left.splice(i, 1)[0].id);
    }
    return out;
  }
  const relevance = (released, creatingOf) => released.size && creatingOf.some(c => released.has(c)) ? 3 : 1;
  globalThis.BDTBreakthroughCore = Object.freeze({ K, chance, attempts, datedCount, target, pick, relevance, AHEAD_DAYS });
})();
