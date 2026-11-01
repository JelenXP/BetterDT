// Stores sell your devices – the math, without the game: the stores' profit from the game's revenue and costs, the
// boost from the player's devices on sale, the experience bonus and the price a sold store brings. Used by
// store-sales.js and the node tests.
(() => {
  const BASE_SHARE = 0.2, DEVICE_SHARE = 0.2, REV_FLOOR = 0.15, EXP_MAX = 0.2, EXP_FULL = 50, SELL_SHARE = 0.35;
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  // what one device on sale adds: by its rating (nothing up to 5, 1.06 at 7, 3 at 9, 3.7 at 10) and how fresh it is
  // (its popularity, 100 % on release day)
  function deviceBoost(rating, pop) {
    const q = Math.min(1.15, Math.max(0, (num(rating) - 5) / 4));
    return 3 * Math.pow(q, 1.5) * Math.min(1, Math.max(0, num(pop) / 100));
  }
  // all devices: the best one counts fully, the second half, the third a quarter…
  function boost(devices) {
    const list = devices.map(d => deviceBoost(d.rating, d.pop)).filter(b => b > 0).sort((a, b) => b - a);
    let s = 0;
    for (let i = 0; i < list.length; i++) s += list[i] / Math.pow(2, i);
    return s;
  }
  // more devices released in the whole game: +0 % for one, +12 % for 10, +20 % from 50
  const experience = (released) => released <= 1 ? 0 : EXP_MAX * Math.min(1, Math.log(released) / Math.log(EXP_FULL));

  // the stores' daily profit from the game's revenue and costs of a country: on their own they keep 20 % of the game's
  // profit (and 20 % of a loss); every unit of boost adds 20 % more (boost 3, a new 9/10 device, = 4× as much),
  // of at least 15 % of the revenue, so a store without profit gains too; the experience adds to a profit
  function profit(rev, exp, b = 0, e = 0) {
    const p = num(rev) - num(exp);
    const v = BASE_SHARE * p + DEVICE_SHARE * num(b) * Math.max(p, REV_FLOOR * num(rev));
    return v > 0 ? v * (1 + num(e)) : v;
  }

  // the game's price of one upgrade round (PAY ALL) per store at a level, without the perk
  const roundPrice = (basePrice, level) => 6 * Math.ceil(basePrice * (5 + Math.sqrt(Math.max(0, level))) / 100);
  // a sold store brings 35 % of its price and of what its upgrades cost, however many stores the country has
  function sellValue(basePrice, level) {
    let up = 0;
    for (let l = 1; l < Math.round(num(level)); l++) up += roundPrice(basePrice, l);
    return Math.ceil(SELL_SHARE * (num(basePrice) + up));
  }

  globalThis.BDTStoreSalesCore = { deviceBoost, boost, experience, profit, roundPrice, sellValue };
})();
