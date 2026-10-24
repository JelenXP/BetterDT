// Living market – the math, without the game: how far behind the market a device's parts are, how many of the
// player's customers a model can still sell to and how strong the effect is for the player's share of a category.
// Used by living-market.js and the node tests.
(() => {
  const YEAR = 365;
  // sales lost to old technology by the device's lag in years (linear between the points)
  const LAG_LOSS = [[1, 0], [2, 0.20], [4, 0.45], [8, 0.80]];
  const SAT_MIN = 0.3, F_MIN = 0.2, BEAT_LAG = 1, BEAT_RATING = 2;
  const RAMP_LOW = 0.20, RAMP_HIGH = 0.60, RAMP_MIN = 0.25, GRACE_DAYS = 730;
  const LEVELS = { mild: 0.5, normal: 1, hard: 1.5 };
  // K: customers per unit of the game's market base × era (tuned on a late-game save)
  const CFG = { K: 1000 };
  // sales arrays → category codes of the game's ratings (_PLAYER_ARRAYS) and market bases (DEVICE_ARRAYS, game 1.6)
  const TYPES = {
    ArraySmartphones: 'SMARTPHONES', ArrayTablets: 'TABLETS', ArrayLaptops: 'LAPTOPS', ArrayWatches: 'SMARTWATCHES',
    ArrayHeadphones: 'HEADPHONES', ArrayTV: 'TV', ArrayScooters: 'SCOOTERS', ArrayKeyboards: 'KEYBOARDS',
    ArrayConsoles: 'CONSOLES', ArrayVRConsoles: 'VR', ArrayMyCPU_SmartphonesEarnings: 'CPU_SMARTPHONE',
    ArrayMyCPU_LaptopsEarnings: 'CPU_LAPTOP', ArrayMyCPU_ConsolesEarnings: 'CPU_CONSOLE', ArrayMyCPU_VREarnings: 'CPU_VR',
    ArrayMyGPU_LaptopsEarnings: 'GPU',
  };
  const BASE = {
    ArraySmartphones: 1800, ArrayTablets: 750, ArrayLaptops: 600, ArrayWatches: 900, ArrayHeadphones: 1350, ArrayTV: 450,
    ArrayScooters: 375, ArrayKeyboards: 525, ArrayConsoles: 675, ArrayVRConsoles: 780,
    ArrayMyCPU_SmartphonesEarnings: 3300, ArrayMyCPU_LaptopsEarnings: 1650, ArrayMyCPU_ConsolesEarnings: 2300,
    ArrayMyCPU_VREarnings: 3250, ArrayMyGPU_LaptopsEarnings: 840,
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const partLag = (born, newest) => Math.max(0, newest - born) / YEAR;
  function deviceLag(lags) {
    if (!lags.length) return 0;
    let max = 0, sum = 0;
    for (const l of lags) { max = Math.max(max, l); sum += l; }
    return 0.5 * max + 0.5 * sum / lags.length;
  }
  function lagLoss(L) {
    if (L <= LAG_LOSS[0][0]) return 0;
    for (let i = 1; i < LAG_LOSS.length; i++) {
      const [x0, y0] = LAG_LOSS[i - 1], [x1, y1] = LAG_LOSS[i];
      if (L <= x1) return y0 + (y1 - y0) * (L - x0) / (x1 - x0);
    }
    return LAG_LOSS[LAG_LOSS.length - 1][1];
  }
  const tech = (L) => 1 - lagLoss(L);
  // m beats k: a year newer technology or a rating 2 points higher
  const beats = (m, k) => k.lag - m.lag >= BEAT_LAG || m.rating - k.rating >= BEAT_RATING;
  // customers m cannot sell to: the owners of every model of the category it does not beat (itself included)
  function blocked(m, models) {
    let s = 0;
    for (const k of models) if (k === m || !beats(m, k)) s += Math.max(0, k.sold);
    return s;
  }
  const era = (year, cfg) => clamp(1 + (year - cfg.ERA_REF_YEAR) * cfg.ERA_PER_YEAR, cfg.ERA_MIN, cfg.ERA_MAX);
  const marketSize = (array, year, cfg) => CFG.K * (BASE[array] || 600) * era(year, cfg);
  const saturation = (O, P) => (P > 0 ? Math.max(SAT_MIN, 1 / (1 + O / P)) : 1);
  function ramp(share, daysLived) {
    let r = share <= RAMP_LOW ? RAMP_MIN : share >= RAMP_HIGH ? 1 : RAMP_MIN + (1 - RAMP_MIN) * (share - RAMP_LOW) / (RAMP_HIGH - RAMP_LOW);
    if (daysLived < GRACE_DAYS) r = Math.min(r, RAMP_MIN);
    return r;
  }
  const strength = (level, share, daysLived) => (LEVELS[level] ?? 1) * ramp(share, daysLived);
  const factor = (s, T, S) => Math.max(F_MIN, 1 - s * (1 - T * S));
  // the player's share of a category: their revenue × the category's part of their sales, against the rivals of the
  // category, whose revenue is split evenly over their categories
  function share(playerEarn, catPart, rivals) {
    const p = Math.max(0, playerEarn) * catPart;
    let r = 0;
    for (const c of rivals) r += Math.max(0, c.earn) / Math.max(1, c.types);
    return p + r > 0 ? p / (p + r) : 0;
  }

  globalThis.BDTMarketCore = Object.freeze({ CFG, TYPES, BASE, LEVELS, partLag, deviceLag, lagLoss, tech, beats, blocked,
    era, marketSize, saturation, ramp, strength, factor, share });
})();
