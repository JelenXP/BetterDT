// Lab automation – the rules, without the game: the prices of the three lab functions, how they are kept in the
// lab's table of the save, when a project is renewed and what the breakthrough focus weighs. Used by
// lab-automation.js, research-breakthroughs.js and the node tests.
(() => {
  const FUNCS = ['collect', 'renew', 'focus'];
  const PRICES = { collect: { rp: 300, usd: 2e6 }, renew: { rp: 600, usd: 10e6 }, focus: { rp: 1000, usd: 25e6 } };
  const FEE = 0.1;            // automation fee on a renewed project, like the game's automatic marketing (+10 %)
  const PROJECT_DAYS = 30;
  const DEVICE_WEIGHT = 3, AREA_WEIGHT = 2;

  // ArrayMyResearch_Invest (0, y): the game reads rows 0–2 (pool, days left, amount); the rest is ours and is saved
  // with the game: flags, the focus, points collected, fees paid, projects renewed
  const ROW = { flags: 3, focus: 4, collected: 5, fees: 6, renewed: 7 };
  const ROWS = 8;
  // flags: bit i = function i bought, bit i + 3 = function i on
  const bought = (flags, f) => !!(flags & (1 << FUNCS.indexOf(f)));
  const isOn = (flags, f) => bought(flags, f) && !!(flags & (8 << FUNCS.indexOf(f)));
  const buy = (flags, f) => flags | (1 << FUNCS.indexOf(f)) | (8 << FUNCS.indexOf(f));   // bought and on
  const turn = (flags, f, on) => on ? flags | (8 << FUNCS.indexOf(f)) : flags & ~(8 << FUNCS.indexOf(f));

  // the devices the focus can pick (the game's own texts for their names); the four CPU kinds count as one
  const DEVICES = [
    { id: 'SMARTPHONES', text: 10164 }, { id: 'TABLETS', text: 10165 }, { id: 'LAPTOPS', text: 10166 },
    { id: 'WATCHES', text: 10168 }, { id: 'HEADPHONES', text: 10169 }, { id: 'TV', text: 10170 },
    { id: 'SCOOTER', text: 10171 }, { id: 'KEYBOARD', text: 10172 }, { id: 'CONSOLE', text: 10173 },
    { id: 'GAMEPAD', text: 10174 }, { id: 'VR CONSOLE', text: 10175 },
    { id: 'CPU', text: 10018, creating: ['CPU SMARTPHONES', 'CPU LAPTOPS', 'CPU CONSOLES', 'CPU VR'] },
    { id: 'GPU', text: 10167 },
  ].map(d => ({ ...d, creating: d.creating || [d.id] }));

  // the review categories of a device (its areas), in the order of its review engine(s)
  function areasOf(device, engines) {
    const out = [];
    for (const e of Object.values(engines)) if (device.creating.includes(e.creating)) for (const c of e.categories) if (!out.includes(c)) out.push(c);
    return out;
  }
  // which device area a part array belongs to: array -> Set of "CREATING:category" (from the review engines)
  function areaMap(engines) {
    const map = {};
    for (const e of Object.values(engines)) for (const a of e.aspects) for (const g of (a.gen && a.gen.arrays) || []) {
      (map[g.array] ||= new Set()).add(e.creating + ':' + a.cat);
    }
    return map;
  }
  // the focus as one number: device index + 1, and the area index + 1 in the hundreds (0 = none)
  const encodeFocus = (device, area) => (device >= 0 ? device + 1 : 0) + (area >= 0 ? (area + 1) * 100 : 0);
  const decodeFocus = (v) => { v = Math.max(0, Math.round(Number(v) || 0)); return { device: (v % 100) - 1, area: Math.floor(v / 100) - 1 }; };

  // how much more often a research (its array and the devices it is built into) is drawn for a breakthrough
  function focusWeight(research, focus, engines, map) {
    const d = DEVICES[focus.device];
    if (!d || !research.creating.some(c => d.creating.includes(c))) return 1;
    const area = focus.area >= 0 ? areasOf(d, engines)[focus.area] : null;
    const inArea = area && d.creating.some(c => map[research.array] && map[research.array].has(c + ':' + area));
    return DEVICE_WEIGHT * (inArea ? AREA_WEIGHT : 1);
  }

  // a project that has ended starts again with the amount of the last one, when the money pays for it and the fee
  function renewal({ days, amount, money, reserve = 0 }) {
    if (days > 0 || !(amount > 0)) return null;
    const fee = Math.round(amount * FEE), cost = amount + fee;
    return { amount, fee, cost, ok: money - cost >= reserve };
  }

  globalThis.BDTLabAutomationCore = Object.freeze({
    FUNCS, PRICES, FEE, PROJECT_DAYS, DEVICE_WEIGHT, AREA_WEIGHT, ROW, ROWS, DEVICES,
    bought, isOn, buy, turn, areasOf, areaMap, encodeFocus, decodeFocus, focusWeight, renewal,
  });
})();
