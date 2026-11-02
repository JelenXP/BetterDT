// Auto research – the rules, without the game: which levels of the ticked research cards are bought now, which wait
// for a second try, which are short (bought quietly as soon as the points and the money are there) and which are given
// up, and how the ticked cards are kept in BetterDT settings. Used by auto-research.js and the node tests.
(() => {
  const RETRY_DAYS = 5;

  // One pass of the rules for one game day (or right after a card is ticked).
  // cards: Map id -> state { wait?: { day, max }, short?: max, gave?: max } (changed in place: the states of the ticked
  // cards). short: still not enough after the second try, so it is tried every day without a message; gave: the game
  // did not research it (auto-research.js sets it), so it waits for a new level of the game.
  // ctx: { today, targets: Map id -> level the game offers now, level(id), cost(id) -> { rp, usd },
  //        rp, money, reserve, free (sandbox: research costs nothing), recommended: Set of ids, only?: Set of ids }
  // Returns { buys: [id, …] (one entry per level, in buying order), rp, usd (the price of all of them),
  //           gaveUp: [{ id, level, rp, usd, reserve }] (what was missing for the next level) }
  function plan(cards, ctx) {
    const want = [];
    for (const [id, s] of cards) {
      if (ctx.only && !ctx.only.has(id)) continue;
      const to = ctx.targets.get(id) || 0, lvl = ctx.level(id);
      // a new level of the game: everything starts again (a given up level is tried once more)
      if (s.gave !== undefined && to > s.gave) delete s.gave;
      if (s.short !== undefined && to > s.short) delete s.short;
      if (s.wait && to > s.wait.max) delete s.wait;
      if (lvl >= to) { delete s.wait; delete s.short; continue; }
      if (s.gave !== undefined) continue;
      if (s.wait && ctx.today < s.wait.day) continue;
      want.push(id);
    }
    const c = (id) => ctx.cost(id);
    const rec = ctx.recommended || new Set();
    want.sort((a, b) => (rec.has(b) - rec.has(a)) || (c(a).usd - c(b).usd) || (c(a).rp - c(b).rp) || (a - b));

    let rp = ctx.rp, money = ctx.money;
    const lvl = new Map(want.map(id => [id, ctx.level(id)]));
    const fits = (id) => ctx.free || (c(id).rp <= rp && money - c(id).usd >= ctx.reserve);
    const out = { buys: [], rp: 0, usd: 0, gaveUp: [] };
    // one level of each card per round, so one expensive card does not take all the money of the others
    for (let bought = true; bought;) {
      bought = false;
      for (const id of want) {
        if (lvl.get(id) >= ctx.targets.get(id) || !fits(id)) continue;
        lvl.set(id, lvl.get(id) + 1);
        out.buys.push(id);
        if (!ctx.free) { rp -= c(id).rp; money -= c(id).usd; out.rp += c(id).rp; out.usd += c(id).usd; }
        bought = true;
      }
    }
    for (const id of want) {
      const s = cards.get(id), to = ctx.targets.get(id);
      if (lvl.get(id) >= to) { delete s.wait; delete s.short; continue; }
      if (s.short !== undefined) continue;   // told once already
      if (!s.wait) { s.wait = { day: ctx.today + RETRY_DAYS, max: to }; continue; }
      delete s.wait;
      s.short = to;
      out.gaveUp.push({
        id, level: lvl.get(id) + 1,
        rp: Math.max(0, c(id).rp - rp),
        usd: Math.max(0, c(id).usd - money),
        reserve: money >= c(id).usd && money - c(id).usd < ctx.reserve,
      });
    }
    return out;
  }

  // ── keeping the ticked cards ─────────────────────────────────────────────────────────────────────
  // BetterDT settings hold short values (200 characters, no line breaks): the cards are written as a list in base 36,
  // "id", "id-day.max" (waits), "id_max" (short; the given up state of older versions, which was the same) or
  // "id~max" (given up), split over the keys <prefix>.0, <prefix>.1, …
  const CHUNK = 190;
  function encode(cards) {
    const parts = [];
    for (const id of [...cards.keys()].sort((a, b) => a - b)) {
      const s = cards.get(id), b = (n) => Math.max(0, Math.round(n)).toString(36);
      parts.push(b(id) + (s.gave !== undefined ? '~' + b(s.gave) : s.short !== undefined ? '_' + b(s.short)
        : s.wait ? '-' + b(s.wait.day) + '.' + b(s.wait.max) : ''));
    }
    const text = parts.join(','), chunks = [];
    for (let i = 0; i < text.length; i += CHUNK) chunks.push(text.slice(i, i + CHUNK));
    return chunks;
  }
  function decode(chunks) {
    const cards = new Map();
    for (const p of chunks.join('').split(',')) {
      const m = /^([0-9a-z]+)(?:_([0-9a-z]+)|-([0-9a-z]+)\.([0-9a-z]+)|~([0-9a-z]+))?$/.exec(p);
      if (!m) continue;
      const n = (v) => parseInt(v, 36), s = {};
      if (m[2]) s.short = n(m[2]);
      if (m[3]) s.wait = { day: n(m[3]), max: n(m[4]) };
      if (m[5]) s.gave = n(m[5]);
      cards.set(n(m[1]), s);
    }
    return cards;
  }
  // a settings key for a company: its name hashed (FNV-1a), since keys only take letters, digits, '.', '_' and '-'
  function companyKey(name) {
    let h = 0x811c9dc5;
    for (const ch of String(name)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'auto-research.c' + h.toString(36);
  }

  globalThis.BDTAutoResearchCore = { RETRY_DAYS, plan, encode, decode, companyKey };
})();
