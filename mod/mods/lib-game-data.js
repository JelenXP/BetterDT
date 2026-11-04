// Named game data for mods, without the game: the player's devices and chips, the rival companies, the hired
// employees, and the events found by comparing two daily snapshots of those tables (a device released, a research
// level done, an employee hired or gone, a company bought). Every function gets arr(name) → the game's array (an
// object with width, height, depth and getAt), so the node tests can pass plain fakes.
// Used by betterdt-settings.js (kit.game, kit.on) and the node tests. Checked in game 1.6.
(() => {
  // the player's sales arrays: x = model, y = edition 0..2, z = field
  const DEVICES = {
    ArraySmartphones: 'smartphone', ArrayTablets: 'tablet', ArrayLaptops: 'laptop', ArrayWatches: 'watch',
    ArrayHeadphones: 'headphones', ArrayTV: 'tv', ArrayScooters: 'scooter', ArrayKeyboards: 'keyboard',
    ArrayConsoles: 'console', ArrayGamepads: 'gamepad', ArrayVRConsoles: 'vr',
    ArrayMyCPU_SmartphonesEarnings: 'cpu-smartphone', ArrayMyCPU_LaptopsEarnings: 'cpu-laptop',
    ArrayMyCPU_ConsolesEarnings: 'cpu-console', ArrayMyCPU_VREarnings: 'cpu-vr', ArrayMyGPU_LaptopsEarnings: 'gpu',
  };
  const CHIPS = new Set(['cpu-smartphone', 'cpu-laptop', 'cpu-console', 'cpu-vr', 'gpu']);
  const DEV = { id: 0, sold: 1, cost: 3, price: 4, rating: 5, release: 7, name: 8, date: 9 };
  // ArrayRatingsCompanies: x = company, y = field; the player is id −1
  const CO = { id: 0, start: 1, finish: 2, country: 3, earnings: 4, types: 10 };
  const PLAYER = -1;

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const str = (v) => (v == null ? '' : String(v));
  const safe = (arr, name) => { try { return arr(name) || null; } catch { return null; } };

  // every model of the player (released or still in development: released is false while release < 0)
  function devices(arr) {
    const out = [];
    for (const [array, type] of Object.entries(DEVICES)) {
      const a = safe(arr, array);
      if (!a) continue;
      for (let x = 0; x < a.width; x++) for (let y = 0; y < Math.min(3, a.height); y++) {
        const id = Number(a.getAt(x, y, DEV.id));
        if (id === -1 || !Number.isFinite(id)) continue;
        const rel = Number(a.getAt(x, y, DEV.release));
        out.push({
          type, chip: CHIPS.has(type), array, x, y, id, name: str(a.getAt(x, y, DEV.name)),
          sold: num(a.getAt(x, y, DEV.sold)), cost: num(a.getAt(x, y, DEV.cost)), price: num(a.getAt(x, y, DEV.price)),
          rating: num(a.getAt(x, y, DEV.rating)), releaseDay: Number.isFinite(rel) ? rel : -1,
          releaseDate: str(a.getAt(x, y, DEV.date)), released: rel >= 0,
        });
      }
    }
    return out;
  }

  // every company of the ratings table (the player too, as player: true); names from ArrayCompanyNames
  function companies(arr, playerName = '') {
    const a = safe(arr, 'ArrayRatingsCompanies'), names = safe(arr, 'ArrayCompanyNames'), out = [];
    if (!a) return out;
    for (let x = 0; x < a.width; x++) {
      const raw = a.getAt(x, CO.id), id = Number(raw);
      if (raw === '' || raw == null || !Number.isFinite(id)) continue;
      const player = id === PLAYER;
      let name = player ? str(playerName) : '';
      if (!player && names && id >= 0 && id < names.width) name = str(names.getAt(id, 1)) || str(names.getAt(id, 0));
      out.push({
        id, name, player, country: player ? '' : str(a.getAt(x, CO.country)), earnings: num(a.getAt(x, CO.earnings)),
        start: num(a.getAt(x, CO.start)), finish: num(a.getAt(x, CO.finish)),
        types: str(a.getAt(x, CO.types)).split(',').map(t => t.trim()).filter(Boolean),
      });
    }
    return out;
  }

  // the hired employees: { id, name, profession, design, speed, research }
  function employees(arr) {
    const my = safe(arr, 'ArrayMyEmployees'), e = safe(arr, 'ArrayEmployees'), c = safe(arr, 'ArrayEmployees_Characters'), out = [];
    if (!my) return out;
    for (let x = 0; x < my.width; x++) {
      const id = Math.round(Number(my.getAt(x, 0)));
      if (!Number.isFinite(id) || id < 0) continue;
      const inE = e && id < e.width, inC = c && id < c.width;
      out.push({
        id, name: inE ? str(e.getAt(id, 0)) : '', profession: inE ? str(e.getAt(id, 4)) : '',
        design: inC ? num(c.getAt(id, 0)) : 0, speed: inC ? num(c.getAt(id, 1)) : 0, research: inC ? num(c.getAt(id, 2)) : 0,
      });
    }
    return out;
  }

  // the companies the player owns (ArrayInvesting: y 0 = company id, 7 = owned, 19 = name)
  function owned(arr) {
    const a = safe(arr, 'ArrayInvesting'), out = [];
    if (!a) return out;
    for (let x = 0; x < a.width; x++) {
      if (!num(a.getAt(x, 7))) continue;
      out.push({ id: num(a.getAt(x, 0)), name: str(a.getAt(x, 19)) });
    }
    return out;
  }

  function research(arr) {
    const a = safe(arr, 'ArrayMyResearch');
    return a ? Array.from({ length: a.width }, (_, x) => num(a.getAt(x, 0))) : [];
  }

  // what the events compare: taken once a day
  function snapshot(arr) {
    return {
      released: devices(arr).filter(d => d.released), research: research(arr), employees: employees(arr), owned: owned(arr),
    };
  }

  // the events between two snapshots: [{ type, key, data }] (key: what kit.on's filter matches)
  function diff(a, b) {
    const out = [];
    if (!a || !b) return out;
    const devKey = (d) => d.array + ':' + d.x + ':' + d.y + ':' + d.id;
    const before = new Set(a.released.map(devKey));
    for (const d of b.released) if (!before.has(devKey(d))) out.push({ type: 'deviceReleased', key: d.type, data: d });
    for (let id = 0; id < b.research.length; id++) {
      const was = a.research[id] || 0, now = b.research[id] || 0;
      if (now > was) out.push({ type: 'researchDone', key: id, data: { id, level: now, from: was } });
    }
    const hadE = new Set(a.employees.map(e => e.id)), hasE = new Set(b.employees.map(e => e.id));
    for (const e of b.employees) if (!hadE.has(e.id)) out.push({ type: 'employeeHired', key: e.profession, data: e });
    for (const e of a.employees) if (!hasE.has(e.id)) out.push({ type: 'employeeLeft', key: e.profession, data: e });
    const hadC = new Set(a.owned.map(c => c.id));
    for (const c of b.owned) if (!hadC.has(c.id)) out.push({ type: 'companyBought', key: c.id, data: c });
    return out;
  }

  const EVENTS = ['deviceReleased', 'researchDone', 'employeeHired', 'employeeLeft', 'companyBought'];
  globalThis.BDTGameData = Object.freeze({ DEVICES, DEV, CO, EVENTS, devices, companies, employees, owned, research, snapshot, diff });
})();
