// Research breakthroughs – the math, without the game: how many breakthroughs a finished lab project gives, which
// research categories can get one and how they are drawn. Used by research-breakthroughs.js and the node tests.
(() => {
  const K = [900, 3600, 12000], EXP = 0.6, MAX_MISSING = 4, MAX_MISSING_RP = 120, AHEAD_DAYS = 460;
  // a part must come to the market MIN_AHEAD to AHEAD_DAYS days after the breakthrough; its weight grows with the
  // lead up to FULL_AHEAD days and stays the same after that
  const MIN_AHEAD = 10, FULL_AHEAD = 190;
  const chance = (Y, k) => Y > 0 ? Y ** EXP / (Y ** EXP + k ** EXP) : 0;
  function attempts(Y, rng) { let n = 0; for (const k of K) { if (rng() < chance(Y, k)) n++; else break; } return n; }
  // the parts on the market as the game counts them for the designer: every row born by today (also one out of order)
  const datedCount = (borns, today) => borns.filter(b => b <= today).length;
  // L = the player's level (unlocked rows); the new level unlocks one row ahead of what the game offers today
  function target(L, borns, today, cost) {
    const A = datedCount(borns, today);
    let row = L;
    if (L < A) {
      const missing = A - L;
      if (missing > MAX_MISSING || (missing > 1 && missing * cost > MAX_MISSING_RP)) return null;
      row = A;
    }
    if (row >= borns.length || !(borns[row] >= today + MIN_AHEAD) || borns[row] > today + AHEAD_DAYS) return null;
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
  // the game's typos in born days: a row whose born day is a copy of its own value (column 0) and earlier than the row
  // before it (the 6K UHD front camera: 3840) gets the day halfway between its neighbours
  function dateFixes(values, borns) {
    const out = [];
    for (let i = 1; i < borns.length - 1; i++) {
      const prev = borns[i - 1], next = borns[i + 1];
      if (borns[i] < prev && next > prev && String(values[i]) === String(borns[i])) out.push({ row: i, born: Math.round((prev + next) / 2) });
    }
    return out;
  }
  const leadWeight = (lead) => Math.min(Math.max(lead, 0), FULL_AHEAD) / FULL_AHEAD;
  const relevance = (released, creatingOf) => released.size && creatingOf.some(c => released.has(c)) ? 3 : 1;
  globalThis.BDTBreakthroughCore = Object.freeze({ K, chance, attempts, datedCount, dateFixes, target, pick, leadWeight, relevance,
    AHEAD_DAYS, MIN_AHEAD, FULL_AHEAD });
})();
