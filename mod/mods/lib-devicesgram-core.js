// Devicesgram auto posting – the rules, without the game: which topics can be posted, the post the game's
// Publish button would make with the default design, the followers it brings (with the auto posting cut) and the
// share of the daily growth that comes from automatic posts. They follow the game's own Devicesgram code
// (SocialMediaV2: _isThemeAvailable, _newDesignForTheme, _publishPost, _growFollowersOneDay). Used by
// devicesgram-auto.js and the node tests.
(() => {
  const PRICE = { rp: 500, usd: 5e6 };
  const CUT = 0.15;              // automatic posts bring 15 % fewer likes and followers
  const THEME_TTL_DAYS = 45;     // an unlocked topic can be posted for 45 days
  const BG_COUNT = 40;
  const GROW = { GAIN: 0.9, BIG_HALF: 15e6, POST_STACK: 0.5, SMALL_HALF: 1e5, BASE: 0.004, BASE_EARLY: 0.008,
    POST: 0.012, POST_EARLY: 0.02, INSTANT_EARLY: 3, IDLE_FLOOR: 0.25 };

  const dayNum = (d) => (d ? 360 * (+d.y || 0) + 30 * ((+d.m || 1) - 1) + (+d.d || 1) : 0);
  const smallAcc = (f) => 1 / (1 + Math.max(0, Number(f) || 0) / GROW.SMALL_HALF);
  const bigAcc = (f) => 1 / (1 + Math.max(0, Number(f) || 0) / GROW.BIG_HALF);
  // the announcement topics belong to the device being designed (the game's devCycle)
  const announceType = (t) => (t >= 0 && t <= 15 ? t : t >= 97 && t <= 100 ? t - 97 + 16 : -1);

  // the topics the game offers in "Create new post", in the order of its topic list; announcements only while the
  // device is being designed (the game offers them only when Devicesgram is opened in the designer office)
  function available(state, today, count, announce = true) {
    const out = [];
    if (!state || !state.registered) return out;
    const themes = Array.isArray(state.unlockedThemes) ? state.unlockedThemes : [];
    for (let t = 0; t < count; t++) {
      const type = announceType(t);
      if (type >= 0) {
        const c = state.devCycle;
        if (announce && c && c.type === type && !c.posted) out.push(t);
        continue;
      }
      const e = themes.find((x) => x && x.t === t);
      if (e && !e.posted && (!e.date || today - dayNum(e.date) <= THEME_TTL_DAYS)) out.push(t);
    }
    return out;
  }

  // the device or company names in a text, as the game puts them in (_applyDeviceName)
  function applyNames(text, t, device, company) {
    let s = String(text);
    if (t === 51) { if (device) s = s.replace(/Razer/g, () => device); }
    else if (t === 76) { if (company) s = s.replace(/RoasteryRTX/g, () => company); }
    else if (device) s = s.replace(/RoasteryRTX/g, () => device);
    const n = t === 51 ? company : device || company;
    if (n) s = s.replace(/RoasteryRTX/g, () => n);
    if (company) s = s.replace(/Roastery/g, () => company);
    return s;
  }
  function deviceName(state, t) {
    if (announceType(t) >= 0) return (state.devCycle && state.devCycle.name) || '';
    const e = (state.unlockedThemes || []).find((x) => x && x.t === t);
    return (e && e.name) || '';
  }
  // the first caption of a topic: its language texts, else built from the post text database
  function caption(t, { row, ptd, lang, state, company }) {
    for (let o = 1; o <= 5; o++) {
      const s = lang(+row[0] + o);
      if (s) return applyNames(s, t, deviceName(state, t), company);
    }
    const p = ptd || [];
    for (let o = 1; o <= 5; o++) if (p[o]) return p[0] + ' — ' + p[o] + '!';
    return '';
  }
  const tops = (row) => { const out = []; for (let i = 2; i <= 10; i++) if (+row[i] >= 1) out.push(+row[i]); return out; };

  // the game's default design of a topic (_newDesignForTheme)
  function design(t, row, ptd) {
    const v = tops(row), img = v.length > 0, p = ptd || [];
    return {
      themeId: t, bg: { type: 'image', n: 1 + (t % BG_COUNT), data: null, c1: '#7c3aed', c2: '#e1306c', angle: 135 },
      blur: 0, dim: 0, vignette: 0, top: img ? v[0] : 0, topX: 50, topY: 32, topAngle: 0, topScale: 100, topOpacity: 100,
      topShadow: { on: true, color: '#000000', blur: 26, alpha: 50 }, headline: p[0] || '', sub: p[1] || '', stickers: [],
      txt: { type: 'solid', c1: '#ffffff', c2: '#ffd166', angle: 90, p1: 0, p2: 100, bold: true, italic: false, underline: false,
        font: 0, x: 50, y: img ? 74 : 50, gap: 0, size: 100, rotate: 0, align: 'center',
        shadow: { on: true, color: '#000000', dx: 0, dy: 2, blur: 12, alpha: 35 },
        plate: { on: false, color: '#000000', alpha: 35, radius: 14 } },
    };
  }

  const rnd = (rand, a, b) => a + rand() * (b - a);
  const rndInt = (rand, a, b) => Math.round(rnd(rand, a, b));
  // what a post is expected to reach (_computeTargets), the likes cut for automatic posts
  function targets(followers, rand) {
    const t = Math.max(30, followers), n = Math.round(t * rnd(rand, 0.08, 0.22));
    return { likes: Math.max(3, Math.round(n * (1 - CUT))), reposts: Math.max(0, Math.round(n * rnd(rand, 0.08, 0.2))),
      views: Math.max(20, Math.round(t * rnd(rand, 0.9, 1.6))) };
  }
  const commentTarget = (followers, rand) => Math.min(60, Math.max(2, Math.round(Math.pow(Math.max(30, followers), 0.42) * rnd(rand, 0.6, 1.1))));
  // the followers a post brings at once (_publishPost), cut for automatic posts
  const instantGain = (f, rand) => Math.max(1, Math.round(f * rnd(rand, 0.01, 0.04) * (1 + GROW.INSTANT_EARLY * smallAcc(f)) * bigAcc(f) * GROW.GAIN * (1 - CUT)));

  // posts every available topic into the state the way the game's Publish button does; returns what was done
  // ctx: { date: {d, m, y}, rows (news database by topic), ptd (post texts by topic), lang(i), company, announce, rand }
  function publishAll(state, ctx) {
    const rand = ctx.rand || Math.random, today = dayNum(ctx.date);
    const done = { posted: [], followers: 0 };
    for (const t of available(state, today, ctx.rows.length, ctx.announce !== false)) {
      const row = ctx.rows[t], ptd = ctx.ptd[t];
      if (!row) continue;
      const f = state.account.followers;
      state.posts.unshift({
        id: state.nextId++, text: caption(t, { row, ptd, lang: ctx.lang, state, company: ctx.company }).trim(), img: null,
        design: design(t, row, ptd), date: { d: ctx.date.d, m: ctx.date.m, y: ctx.date.y }, likes: 0, reposts: 0,
        views: rndInt(rand, 3, 12), targets: targets(f, rand), commentTarget: commentTarget(f, rand), comments: [], bdtAuto: 1,
      });
      const g = instantGain(f, rand);
      state.account.followers = f + g;
      done.followers += g;
      if (announceType(t) >= 0) { if (state.devCycle) state.devCycle.posted = true; }
      else { const e = state.unlockedThemes.find((x) => x && x.t === t); if (e) e.posted = true; }
      done.posted.push(t);
    }
    return done;
  }

  // what the cut takes back from a day's follower growth (_growFollowersOneDay): the bonus of the posts of the last
  // 3 days stacks (each next one counts half), and the cut is 15 % of the part the automatic posts make of it
  function dailyCut(posts, followers, today, perk = 1) {
    const n = smallAcc(followers);
    let auto = 0, a = 1;
    for (const p of posts || []) {
      if (today - dayNum(p.date) > 3) continue;
      if (p.bdtAuto) auto += (GROW.POST + GROW.POST_EARLY * n) * a;
      a *= GROW.POST_STACK;
    }
    return Math.round(followers * auto * bigAcc(followers) * GROW.GAIN * perk * CUT);
  }

  // the unlock queue the game keeps in ArraySocialMedia (0, 1) until Devicesgram opens (initSocialMediaV2)
  function parseQueue(s) {
    const out = [];
    for (const part of String(s || '').split(/[,;]+/)) {
      const m = part.trim().match(/^([AaRrUuWw])?(\d+)(?::(.*))?$/);
      if (m) out.push({ kind: (m[1] || '').toLowerCase(), n: +m[2], name: (m[3] || '').trim() });
    }
    return out;
  }

  globalThis.BDTDevicesgramCore = Object.freeze({
    PRICE, CUT, THEME_TTL_DAYS, GROW, dayNum, announceType, available, applyNames, caption, design, targets,
    instantGain, publishAll, dailyCut, parseQueue,
  });
})();
