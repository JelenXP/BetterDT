// Bigger lab investments – the math, without the game: the points an investment over the game's $25M gives, the
// "Max" amount and how soon the lab's capacity is full. Used by lab-invest.js and the node tests.
(() => {
  const GAME_MAX = 25e6, MAX = 1e9, STEP = 1e6, PER_DOUBLING = 0.25;
  // the game's points grow with the amount up to $25M; over it every doubling adds 25 % of the points at $25M
  const factor = (amount) => amount > GAME_MAX ? 1 + PER_DOUBLING * Math.log2(Math.min(amount, MAX) / GAME_MAX) : 1;
  // the amount the investing screen may hold
  const clamp = (amount) => Math.min(MAX, Math.max(STEP, Math.round(Number(amount) / STEP) * STEP || STEP));
  // "Max": the most the budget pays for, in whole millions (at least the game's $1M)
  const maxAmount = (budget) => clamp(Math.floor(Math.max(0, Number(budget) || 0) / STEP) * STEP);
  // days until the lab's pool is full at perDay points a day (Infinity when it never fills)
  function fillDays(capacity, pool, perDay) {
    const room = Math.max(0, capacity - pool);
    return perDay > 0 ? Math.ceil(room / perDay) : Infinity;
  }
  // the amount a running project keeps in the game's table: over $25M it is $25M + the millions as dollars
  // (900M → 25 000 900), so the game alone (the mod off) gives the points of $25M; amounts are whole millions
  const encode = (amount) => amount > GAME_MAX ? GAME_MAX + Math.round(amount / STEP) : amount;
  const decode = (v) => v > GAME_MAX && v <= GAME_MAX + MAX / STEP ? (v - GAME_MAX) * STEP : v;
  globalThis.BDTLabInvestCore = { GAME_MAX, MAX, STEP, factor, clamp, maxAmount, fillDays, encode, decode };
})();
