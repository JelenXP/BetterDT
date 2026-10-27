// Bigger lab investments – RESEARCH LAB, "Investing in research" (class RESEARCH INVEST).
//
// The game lets a lab project take $1M to $25M: ResearchMenu_ButtonsOpacity sets a higher amount back to $25M and
// greys out the + button there. The points a day grow with the amount (1.25 + research level / 1000 × (1 + millions)
// for every research employee, ResearchInvestEngine). With this mod the amount goes up to $1B: the action that sets
// it back keeps any amount up to $1B, and the + button stays white below $1B. Over $25M the points do not keep
// growing with the money: every doubling adds 25 % of the points at $25M (lib-lab-invest-core.js). The game computes
// the points as at $25M (the amount it reads is $25M while its action runs) and the mod multiplies what the action
// added; this is done for the average income on the screen and for the points the lab makes every day, so the game's
// own capacity limit and rounding stay. The game still checks the money and takes it when you invest.
// Under the $1M / $5M / $10M steps there are two more buttons in the same look: $100M (a step for + and −) and MAX
// (the most the money pays for, up to $1B). When the points of a project would fill the lab before it ends, a line
// under the average income says in how many days (points over the capacity are lost unless you collect them).
// A running project over $25M keeps its amount in the game's table as $25M + the millions as dollars (900M is
// 25 000 900): the game alone, without the mod, gives it the points of $25M instead of points that keep growing with
// all the money. The game's next change of the amount brings back the $25M limit.
//
// the game's actions (SIDs): the $25M limit, the + button grey / white, the average income, the daily points and
// the amount a new project keeps
const LIV_SID = { limit: 341028357801183, plusGrey: 921516140505747, plusWhite: 104524210380589, income: 772998058448607,
  daily: 152386639095470, invest: 710187950782270 };
const LIV_L = (en, ru, de, fr, it, es, hi, tr, pt, uk, id, pl, zh, ko, ja) => [en, ru, de, fr, it, es, hi, tr, pt, uk, id, pl, zh, ko, ja];
BetterDTKit.mod('lab-invest', {
  needs: {
    calls: ['ResearchInvestEngine', 'ResearchMenu_ButtonsOpacity', 'ResearchMenu_Text'],
    actions: Object.values(LIV_SID),
    objects: ['ArrayMyResearch', 'ArrayMyResearch_Invest', 'ArrayMyPerks', 'Sprite424'],
    vars: ['Budget', 'LanguageChoose', 'class', 'ResearchInvest_TotalPrice', 'ResearchInvest_PriceCount', 'ResearchInvest_AvarageEarnings'],
    arrays: { ArrayMyResearch_Invest: [1, 3], ArrayMyPerks: [7, 2] },
    check: () => !globalThis.BDTLabInvestCore ? 'lib-lab-invest-core.js' : '',
  },
  uids: {
    19735: { layout: 'RESEARCH MENU', t: '9patch3', l: 'RESEARCH INVEST (Touched)', w: 120, h: 66, x: 1060, y: 580 },   // $1M
    19739: { layout: 'RESEARCH MENU', t: 'Sprite424', l: 'RESEARCH INVEST (Top)', w: 40, h: 40, x: 1360, y: 477 },     // +
    19734: { layout: 'RESEARCH MENU', t: 'Text', l: 'RESEARCH INVEST (Top)', w: 794, h: 155, x: 960, y: 280 },        // title
  },
}, (rt, kit) => {
  if (globalThis.__bdtLabInvest) globalThis.__bdtLabInvest.dispose();
  const C = BDTLabInvestCore, gv = rt.globalVars, SID = LIV_SID;
  const SCREEN = 'RESEARCH INVEST', LAYER = 'RESEARCH INVEST (Touched)', STEP_BIG = 100e6;
  const GREY = [173 / 255, 173 / 255, 173 / 255], WHITE = [1, 1, 1];
  const TXT = {
    max: LIV_L('MAX', 'МАКС', 'MAX', 'MAX', 'MAX', 'MÁX', 'अधिकतम', 'MAKS', 'MÁX', 'МАКС', 'MAKS', 'MAKS', '最大', '최대', '最大'),
    full: LIV_L('The lab is full in {n} days – collect the points, the rest is lost',
      'Лаборатория заполнится за {n} дн. – собирайте очки, остальное пропадёт',
      'Das Labor ist in {n} Tagen voll – Punkte einsammeln, der Rest verfällt',
      'Le labo sera plein dans {n} jours – récupérez les points, le reste est perdu',
      'Il laboratorio è pieno tra {n} giorni – raccogli i punti, il resto va perso',
      'El laboratorio se llena en {n} días: recoge los puntos, el resto se pierde',
      'लैब {n} दिनों में भर जाएगी – अंक इकट्ठा करें, बाकी खो जाएंगे',
      'Laboratuvar {n} günde dolar – puanları topla, gerisi kaybolur',
      'O laboratório enche em {n} dias – colete os pontos, o resto se perde',
      'Лабораторія заповниться за {n} дн. – збирайте очки, решта пропаде',
      'Lab penuh dalam {n} hari – kumpulkan poin, sisanya hilang',
      'Laboratorium zapełni się za {n} dni – zbieraj punkty, reszta przepada',
      '实验室将在 {n} 天后满 – 请收取点数，否则多余的会丢失',
      '연구소가 {n}일 후 가득 찹니다 – 포인트를 모으세요, 나머지는 사라집니다',
      '研究所は {n} 日で満杯 – ポイントを回収しないと残りは失われます'),
  };
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const lang = () => { const l = Math.round(num(gv.LanguageChoose)); return l >= 0 && l < 15 ? l : 0; };
  const t = (k, vars = {}) => TXT[k][lang()].replace(/\{(\w+)\}/g, (_, v) => vars[v]);
  const arr = (name) => rt.objects[name] && rt.objects[name].getFirstInstance();

  // ── the amount: up to $1B instead of $25M ─────────────────────────────────────────────────────────────────────
  let kept = 0;
  const limitOk = kit.wrapAction(SID.limit, {
    before() { kept = num(gv.ResearchInvest_TotalPrice); },
    after() { gv.ResearchInvest_TotalPrice = C.clamp(kept); },
  });
  const plus = () => kit.inst(19739);
  const paintPlus = () => { const p = plus(); if (p) p.colorRgb = num(gv.ResearchInvest_TotalPrice) >= C.MAX ? GREY : WHITE; };
  const plusOk = kit.wrapAction(SID.plusGrey, { after: paintPlus }) && kit.wrapAction(SID.plusWhite, { after: paintPlus });

  // ── the points over $25M: the game computes them as at $25M, the mod multiplies what its action added ──────────
  let saved = null;
  const incomeOk = kit.wrapAction(SID.income, {
    before() {
      const amount = num(gv.ResearchInvest_TotalPrice);
      saved = amount > C.GAME_MAX ? { amount, v: num(gv.ResearchInvest_AvarageEarnings) } : null;
      if (saved) gv.ResearchInvest_TotalPrice = C.GAME_MAX;
    },
    after() {
      if (!saved) return;
      const s = saved; saved = null;
      gv.ResearchInvest_TotalPrice = s.amount;
      gv.ResearchInvest_AvarageEarnings = s.v + (num(gv.ResearchInvest_AvarageEarnings) - s.v) * C.factor(s.amount);
    },
  });
  let day = null;
  const dailyOk = kit.wrapAction(SID.daily, {
    before() {
      const a = arr('ArrayMyResearch_Invest'), kept = a ? num(a.getAt(0, 2)) : 0, amount = C.decode(kept);
      day = amount > C.GAME_MAX ? { a, kept, amount, pool: num(a.getAt(0, 0)) } : null;
      if (day) day.a.setAt(C.GAME_MAX, 0, 2);
    },
    after() {
      if (!day) return;
      const d = day; day = null;
      d.a.setAt(d.kept, 0, 2);
      d.a.setAt(d.pool + (num(d.a.getAt(0, 0)) - d.pool) * C.factor(d.amount), 0, 0);
    },
  });
  // a new project: the game wrote the amount, the mod keeps it encoded (also an older plain one, from a test build)
  const investOk = kit.wrapAction(SID.invest, {
    after() {
      const a = arr('ArrayMyResearch_Invest'), v = a ? num(a.getAt(0, 2)) : 0;
      if (v > C.GAME_MAX) a.setAt(C.encode(C.decode(v)), 0, 2);
    },
  });
  if (!limitOk || !plusOk || !incomeOk || !dailyOk || !investOk) return kit.fail('the research investing events have changed');

  // ── the screen: $100M and MAX under the steps, the capacity line under the average income ───────────────────
  const ui = kit.ui;
  ui.css(`
.bdt-liv { position: fixed; z-index: 5; transform-origin: 0 0; display: none; }
.bdt-liv-btn { position: absolute; top: 0; height: 66px; border-radius: 8px; display: flex; align-items: center;
  justify-content: center; box-sizing: border-box; cursor: pointer; font: 30px/1 ${ui.font}; letter-spacing: .02em;
  background: rgba(255,255,255,.25); color: #fff; transition: background .12s, color .12s; }
.bdt-liv-btn.on { background: #fff; color: #5b6463; }
.bdt-liv-full { position: absolute; left: 0; top: 0; width: 520px; text-align: center; font: 22px/1.25 ${ui.font};
  color: #FFD800; }`);
  const box = ui.el('div', { className: 'bdt-liv' });
  const btn = (label, x, w, onClick) => {
    const b = ui.el('div', { className: 'bdt-liv-btn', textContent: label, style: { left: x + 'px', width: w + 'px' } }, box);
    ui.shield(b, false);
    b.addEventListener('click', kit.guard(() => { globalThis.tapMain?.(); onClick(); }));
    return b;
  };
  const refresh = () => { rt.callFunction('ResearchMenu_ButtonsOpacity'); rt.callFunction('ResearchMenu_Text'); };
  // design pixels of the row: the game's steps are 120 × 66 at x 1000–1380, y 580; this row is at y 660
  const ROW = { x: 1000, y: 627 };
  const big = btn('$100M', 0, 120, () => { gv.ResearchInvest_PriceCount = STEP_BIG; refresh(); });
  const max = btn('', 130, 250, () => { gv.ResearchInvest_TotalPrice = C.maxAmount(gv.Budget); refresh(); });
  const full = ui.el('div', { className: 'bdt-liv-full' });
  full.style.display = 'none';
  // the capacity of the lab (the game's formula in ResearchInvestEngine) and the line when a project fills it
  function capacity() {
    const r = arr('ArrayMyResearch'), p = arr('ArrayMyPerks');
    return 250 * num(r && r.getAt(524)) + 300 * num(p && p.getAt(6, 1));
  }
  function fullText() {
    const a = arr('ArrayMyResearch_Invest'), running = a && num(a.getAt(0, 1)) > 0;
    const days = C.fillDays(capacity(), running ? num(a.getAt(0, 0)) : 0, num(gv.ResearchInvest_AvarageEarnings));
    return days < (running ? num(a.getAt(0, 1)) : 30) ? t('full', { n: Math.max(1, days) }) : '';
  }
  kit.on('tick', () => {
    let l = null;
    try { l = String(gv.class) === SCREEN && rt.layout.getLayer(LAYER); } catch { }
    // the window fades in and out with its title
    const step = kit.inst(19735), title = kit.inst(19734);
    if (!l || !step || !step.isVisible || !title) { box.style.display = 'none'; full.style.display = 'none'; return; }
    const [x0, y0] = l.layerToCssPx(ROW.x, ROW.y), k = (l.layerToCssPx(ROW.x + 1000, ROW.y)[0] - x0) / 1000;
    const op = String(Math.max(0, Math.min(1, num(title.opacity))));
    Object.assign(box.style, { display: 'block', left: x0 + 'px', top: y0 + 'px', transform: `scale(${k.toFixed(4)})`, opacity: op });
    big.classList.toggle('on', num(gv.ResearchInvest_PriceCount) === STEP_BIG);
    if (max.textContent !== t('max')) max.textContent = t('max');
    const txt = fullText();
    if (full.textContent !== txt) full.textContent = txt;
    const [fx, fy] = l.layerToCssPx(450, 660);
    Object.assign(full.style, { display: txt ? 'block' : 'none', left: fx + 'px', top: fy + 'px', transform: `scale(${k.toFixed(4)})`, transformOrigin: '0 0', opacity: op });
  });

  const dispose = () => { if (globalThis.__bdtLabInvest === api) delete globalThis.__bdtLabInvest; };
  const api = { dispose };
  globalThis.__bdtLabInvest = api;
  return dispose;
});
