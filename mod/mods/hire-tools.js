// B1 + B3 – faster hiring on the FIND EMPLOYEES screen.
//
// B1: every agency card gets a second button "[icon] N" next to the green price. N = how many people are
//     missing to fill the office for the current profession (free seats − candidates already found but not hired).
//     One click repeats the search at that agency (each search costs the normal price and has the agency's
//     normal odds) until there are N. The last search is trimmed, so it never finds more than there is room for.
//     One regular search animation plays and the game shows the total.
// B3: an "AUTO-HIRE" checkbox in the top bar on the right (remembered). When it is on, after every search
//     (regular or B1) the people found for this profession are hired automatically, up to the office capacity.
//
// Everything is built from game objects (same buttons, gradients, font, icons, sounds, notifications).
DTMods.register('hire-tools', (rt) => {
  if (globalThis.__dtHireTools) globalThis.__dtHireTools.dispose();

  const LS_KEY = 'dtmod.autoHire';
  const LAYOUT = 'FIND EMPLOYEES';
  const gv = rt.globalVars;

  // ── texts (language order as in the game: ArrayLanguage row = LanguageChoose) ──────────────────
  const TXT = {
    auto: ['AUTO-HIRE', 'АВТОНАЙМ', 'AUTO-EINSTELLEN', 'EMBAUCHE AUTO', 'ASSUNZIONE AUTO', 'CONTRATACIÓN AUTO',
      'स्वतः नियुक्ति', 'OTOMATİK İŞE AL', 'CONTRATAÇÃO AUTO', 'АВТОНАЙМ', 'REKRUT OTOMATIS', 'AUTOZATRUDNIANIE',
      '自动招聘', '자동 고용', '自動採用'],
    hired: ['Hired: {n}', 'Нанято: {n}', 'Eingestellt: {n}', 'Embauchés : {n}', 'Assunti: {n}', 'Contratados: {n}',
      'नियुक्त: {n}', 'İşe alınan: {n}', 'Contratados: {n}', 'Найнято: {n}', 'Direkrut: {n}', 'Zatrudniono: {n}',
      '已招聘：{n}', '고용됨: {n}', '採用：{n}'],
    noCandidates: ['There are no more candidates for this profession', 'Больше нет кандидатов этой профессии',
      'Für diesen Beruf gibt es keine weiteren Kandidaten', "Il n'y a plus de candidats pour ce métier",
      'Non ci sono altri candidati per questa professione', 'No quedan más candidatos para esta profesión',
      'इस पेशे के लिए और उम्मीदवार नहीं हैं', 'Bu meslek için başka aday kalmadı',
      'Não há mais candidatos para esta profissão', 'Більше немає кандидатів цієї професії',
      'Tidak ada kandidat lagi untuk profesi ini', 'Nie ma już kandydatów w tym zawodzie',
      '该职业已没有更多候选人', '이 직업의 후보자가 더 이상 없습니다', 'この職種の候補者はもういません'],
    enough: ['You have already found enough candidates to fill the office – hire them',
      'Вы уже нашли достаточно кандидатов, чтобы заполнить офис, – наймите их',
      'Du hast schon genug Kandidaten gefunden, um das Büro zu füllen – stell sie ein',
      'Tu as déjà trouvé assez de candidats pour remplir le bureau – embauche-les',
      "Hai già trovato abbastanza candidati per riempire l'ufficio: assumili",
      'Ya encontraste suficientes candidatos para llenar la oficina: contrátalos',
      'ऑफिस भरने के लिए आपको पहले ही पर्याप्त उम्मीदवार मिल चुके हैं – उन्हें नियुक्त करें',
      'Ofisi doldurmaya yetecek kadar aday zaten buldun – onları işe al',
      'Você já encontrou candidatos suficientes para lotar o escritório – contrate-os',
      'Ви вже знайшли достатньо кандидатів, щоб заповнити офіс, – найміть їх',
      'Anda sudah menemukan cukup kandidat untuk mengisi kantor – rekrut mereka',
      'Masz już wystarczająco kandydatów, by zapełnić biuro – zatrudnij ich',
      '你已经找到足够的候选人来填满办公室，去招聘他们吧',
      '사무실을 채울 만큼 후보자를 이미 찾았습니다. 고용하세요',
      'オフィスを埋めるのに十分な候補者がすでに見つかっています。採用しましょう'],
  };
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const tr = (key, n) => String(TXT[key][lang()] || TXT[key][0]).replace('{n}', n);
  const gameText = (idx) => { try { return String(arr('ArrayLanguage').getAt(lang(), idx)); } catch { return ''; } };

  // ── game data ──────────────────────────────────────────────────────────────────────────────────
  const arr = (name) => rt.objects[name].getFirstInstance();
  const ids = (a) => { const out = []; for (let x = 0; x < (a.width | 0); x++) { const v = Number(a.getAt(x, 0, 0)); if (Number.isFinite(v)) out.push(v | 0); } return out; };
  const profOf = (id) => String(arr('ArrayEmployees').getAt(id, 4, 0));
  const PRICE = [2e5, 45e4, 65e4];
  const ROLL = [[1, 1, 1, 2, 2, 2, 3], [1, 1, 1, 1, 2, 2], [1]];
  const SKILL = [[10, 35], [40, 60], [70, 85]];
  const choose = (a) => a[Math.floor(Math.random() * a.length)];

  function capacity(p) {
    const off = arr('ArrayOffices'), res = arr('ArrayMyResearch');
    const row = { DESIGNERS: 0, PROGRAMMERS: 1, ENGINEERS: 2, RESEARCH: 3, MARKETING: 4 }[p];
    if (row == null) return 0;
    const lvl = [gv.DesignersOfficeLevel, gv.ProgrammersOfficeLevel, gv.EngineersOfficeLevel,
      res.getAt(524), res.getAt(523)][row];
    const v = Number(off.getAt(row, Math.round(+lvl) - 1));
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  function stats(p) {
    const staff = new Set(ids(arr('ArrayMyEmployees')));
    const found = ids(arr('ArrayNewEmployees'));
    const foundSet = new Set(found);
    let hired = 0; for (const id of staff) if (profOf(id) === p) hired++;
    const backlog = found.filter(id => !staff.has(id) && profOf(id) === p);
    let pool = 0; const info = arr('ArrayEmployees');
    for (let id = 0; id < (info.width | 0); id++) if (!staff.has(id) && !foundSet.has(id) && profOf(id) === p) pool++;
    const cap = capacity(p);
    const free = Math.max(0, cap - hired);
    return { cap, hired, free, backlog, pool, need: Math.max(0, free - backlog.length) };
  }

  // ── game UI helpers ────────────────────────────────────────────────────────────────────────────
  const call = (fn) => { try { rt.callFunction(fn); } catch (e) { console.warn('[hire-tools]', fn, e); } };
  function notify(text, error) {
    gv.EditorNotification = 'ON';
    gv.EditorNotificationText = text;
    call('EditorNotification_ON');
    if (error) call('ErrorSound');
  }
  const byUid = (u) => rt.getInstanceByUid(u);
  function stopTweens(inst) {
    try { for (const t of inst.behaviors.Tween.allTweens()) t.stop(); } catch { }
  }

  // ── stav obrazovky ─────────────────────────────────────────────────────────────────────────────
  let ui = null;            // objects created on the current screen
  let busy = false;         // our batch is running
  let phase = 'idle';       // 'idle' | 'searching' – follows the game's search animation
  let batch = null;         // result of the last B1 batch (finished after the animation)
  // the state lives in the BetterDT settings (hire-tools.autoHire); it used to be in localStorage
  const S = globalThis.BetterDT && globalThis.BetterDT.settings;
  let autoHire = false;
  try { autoHire = localStorage.getItem(LS_KEY) === '1'; } catch { }
  if (S) {
    if (S.get('hire-tools.autoHire') === undefined) { if (autoHire) S.set('hire-tools.autoHire', true); }
    else autoHire = S.bool('hire-tools.autoHire', false);
    S.onChange((k, v) => { if (k === 'hire-tools.autoHire') autoHire = S.bool(k, false); });
  }
  let statsCache = null, statsTick = 0;

  // cards: [green button, its gradient, price text]
  const CARDS = [[19896, 19897, 19902], [19898, 19899, 19903], [19900, 19901, 19904]];
  const CARD_X = [790, 1230, 1670];    // card centres in the layout (original position of the green buttons)

  function teardown() {
    if (!ui) return;
    const old = ui; ui = null;
    try {
      for (const b of old.b1) {
        for (const i of [b.btn, b.glow, b.text]) try { i.destroy(); } catch { }
        b.refB.x = CARD_X[b.tier]; b.refB.width = 352;
        b.refG.x = CARD_X[b.tier]; b.refG.width = 360;
        b.refT.x = CARD_X[b.tier]; b.refT.width = 320;
      }
      for (const i of [old.box, old.check, old.label]) try { i && i.destroy(); } catch { }
    } catch { }
  }

  function setup() {
    teardown();
    ui = { b1: [], box: null, check: null, label: null };
    for (let k = 0; k < 3; k++) {
      const [bu, gu, tu] = CARDS[k];
      const B = byUid(bu), G = byUid(gu), T = byUid(tu);
      if (!B || !G || !T) { ui = null; return; }
      const cx = CARD_X[k];
      // narrower green button, the new one to its right (same right edge as before)
      B.x = cx - 63; B.width = 226;
      G.x = cx - 63; G.width = 234;
      T.x = cx - 63; T.width = 210;
      const nb = rt.objects['9patch3'].createInstance(B.layer.name, cx + 118, B.y);
      nb.width = 116; nb.height = 64; nb.opacity = 0;
      const ng = rt.objects.Gradient_24.createInstance(G.layer.name, cx + 118, G.y);
      ng.width = 124; ng.height = 70; ng.opacity = 0; ng.moveAdjacentToInstance(nb, true);
      const nt = rt.objects.Text.createInstance(T.layer.name, cx + 118, T.y);
      nt.fontFace = T.fontFace; nt.sizePt = T.sizePt; nt.fontColor = T.fontColor;
      nt.horizontalAlign = 'center'; nt.verticalAlign = 'top'; nt.width = 110; nt.height = 60; nt.opacity = 0;
      nt.changeIconSet(rt.objects.Sprite389);
      ui.b1.push({ tier: k, btn: nb, glow: ng, text: nt, refB: B, refG: G, refT: T, n: -1, w: 116, h: 64 });
    }
    // checkbox in the top bar: off = semi-transparent square (like the inactive button on the left),
    // on = the game's checked-box icon
    const box = rt.objects['9patch3'].createInstance('GLOBAL UI (Touched)', 1300, 50);
    box.width = 36; box.height = 36; box.opacity = 0;
    const check = rt.objects.Text.createInstance('GLOBAL UI (Top)', 1300, 22);
    check.fontFace = 'SofiaSansExtraCondensed-Bold'; check.sizePt = 34; check.horizontalAlign = 'center';
    check.width = 60; check.height = 60; check.opacity = 0;
    check.changeIconSet(rt.objects.Sprite290); check.text = '[icon=Check]';
    const label = rt.objects.Text.createInstance('GLOBAL UI (Top)', 1400, 26);
    label.fontFace = 'SofiaSansExtraCondensed-Bold'; label.sizePt = 30; label.horizontalAlign = 'left';
    label.width = 400; label.height = 60; label.opacity = 0; label.text = tr('auto');
    ui.box = box; ui.check = check; ui.label = label; ui.lang = lang();
    statsCache = null;
  }

  function layoutCheckbox() {
    const money = byUid(19835), title = byUid(19834);
    const { box, check, label } = ui;
    if (ui.lang !== lang()) { label.text = tr('auto'); ui.lang = lang(); }
    const lw = label.textWidth || 0;
    let right = money ? money.x - (money.textWidth || 0) - 48 : 1560;
    let left = right - lw - 12 - 36;
    const minLeft = title ? title.x + (title.textWidth || 0) + 40 : 0;
    if (left < minLeft) left = minLeft;
    box.x = left + 18; check.x = left + 18;
    label.x = left + 36 + 12 + label.width / 2;
  }

  function hitBox(inst, x, y, pad = 0) {
    const b = inst.getBoundingBox();
    return x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad;
  }

  // ── B1: search batch ───────────────────────────────────────────────────────────────────────────
  function engineBusy() {
    const bar = byUid(19905);
    return busy || phase === 'searching' || (bar && bar.opacity > 0.02);
  }

  function runBatch(tier) {
    const p = String(gv.EmployeesProfession);
    const price = PRICE[tier];
    const s = stats(p);
    call('Tap_Main');
    if (s.free <= 0) return notify(gameText(11706), false);
    if (s.need <= 0) {
      if (autoHire) { const r = hireFound(p, []); flashStatus(r.ok); afterHire(r); return; }
      return notify(tr('enough'), false);
    }
    if (s.pool <= 0) return notify(tr('noCandidates'), false);
    if (+gv.Budget < price) return notify(gameText(10974), true);

    busy = true;
    const got = [];
    let reason = 'done';
    for (let guard = 0; got.length < s.need && guard < 500; guard++) {
      if (+gv.Budget < price) { reason = 'money'; break; }
      if (stats(p).pool <= 0) { reason = 'pool'; break; }
      gv.FindEmployeesCountRandom = Math.min(choose(ROLL[tier]), s.need - got.length);
      gv.FindEmployeesCharacters = Math.round(SKILL[tier][0] + Math.random() * (SKILL[tier][1] - SKILL[tier][0]));
      gv.Budget = +gv.Budget - price;
      const rep = globalThis.findEmployees(rt);
      const f = rep && rep.found ? rep.found.map(e => e.id) : [];
      if (!f.length) { reason = 'pool'; break; }
      got.push(...f);
    }
    // one normal search animation; the search inside it adds nothing (count 0)
    gv.FindEmployeesCountRandom = 0;
    call('FindEmployeesEngine_ON');
    call('CashSound');
    // result for the game text "N employees found!"
    const temp = arr('ArrayEmployees_Temp');
    temp.setSize(got.length, Math.max(1, temp.height | 0), Math.max(1, temp.depth | 0));
    got.forEach((id, i) => temp.setAt(id, i, 0, 0));
    gv.FindEmployeesCountRandom = got.length;
    batch = { reason, wanted: s.need, got: got.length };
    phase = 'searching';
    busy = false;
    statsCache = null;
  }

  // ── B3: automatic hiring ──────────────────────────────────────────────────────────────────────
  function hireFound(p, newIds) {
    const s = stats(p);
    const order = [...newIds.filter(id => profOf(id) === p), ...s.backlog.filter(id => !newIds.includes(id))];
    let hired = s.hired, ok = 0, left = 0;
    gv.OfficeEmployeesMax = s.cap;          // the game checks capacity through this variable
    for (const id of order) {
      if (hired >= s.cap) { left++; continue; }
      const r = globalThis.hireEmployee(rt, id);
      if (r && r.ok) { ok++; hired++; }
    }
    if (ok > 0) { try { globalThis.socialQueueThemeEvent(rt, 77); } catch { } }
    return { ok, left };
  }
  // short "Hired: N" in the status line when hiring without a search (same animation as the game's result)
  function flashStatus(n) {
    const st = byUid(19908);
    if (!st || n <= 0) return;
    st.text = tr('hired', '[color=#FFD800]' + n + '[/color]');
    try {
      const tw = st.behaviors.Tween;
      st.y = 920; st.opacity = 0;
      tw.startTween('opacity', 1, 0.15, 'linear');
      tw.startTween('y', 900, 0.25, 'out-back');
      setTimeout(() => { try { tw.startTween('opacity', 0, 0.15, 'linear'); tw.startTween('y', 880, 0.25, 'in-back'); } catch { } }, 1500);
    } catch { st.opacity = 1; }
  }
  function afterHire(r) {
    if (r.ok > 0) {
      const st = byUid(19908);
      if (st && st.text && !st.text.includes(tr('hired', '').trim())) {
        st.text = st.text + '   [opacity=60]|[/opacity]   ' + tr('hired', '[color=#FFD800]' + r.ok + '[/color]');
      }
      call('FindEmployees_ButtonsOpacity');
    }
    if (r.left > 0) notify(gameText(11706), false);
    statsCache = null;
  }

  // end of the game's search animation (regular or ours): the status text changes from "SEARCHING…" to the result
  function onSearchFinished() {
    const b = batch; batch = null;
    let hireRes = { ok: 0, left: 0 };
    if (autoHire) {
      const temp = arr('ArrayEmployees_Temp');
      hireRes = hireFound(String(gv.EmployeesProfession), ids(temp));
    }
    afterHire(hireRes);
    if (b && b.reason === 'money' && b.got < b.wanted && hireRes.left === 0) notify(gameText(10974), false);
    if (b && b.reason === 'pool' && b.got < b.wanted && hireRes.left === 0) notify(tr('noCandidates'), false);
  }

  // ── every frame ────────────────────────────────────────────────────────────────────────────────
  function tick() {
    if (!ui) return;
    // follow the game's search
    const st = byUid(19908);
    // (the default layout text is also "SEARCHING…", just invisible → the text or the bar must be visible too)
    const bar = byUid(19905);
    const searching = !!(st && gameText(11747) && st.text.includes(gameText(11747)) &&
      (st.opacity > 0.02 || (bar && bar.opacity > 0.02)));
    if (phase === 'idle' && searching) phase = 'searching';
    else if (phase === 'searching' && st && !searching) { phase = 'idle'; onSearchFinished(); }

    // numbers on the buttons (a few times per second is enough)
    if (!statsCache || ++statsTick >= 15) { statsTick = 0; statsCache = stats(String(gv.EmployeesProfession)); }
    const n = Math.min(statsCache.need, statsCache.pool);
    for (const b of ui.b1) {
      if (b.n !== n) { b.n = n; b.text.text = '[iconoffsety=5][icon=People] ' + n; }
      const dim = n > 0 ? 1 : 0.4;
      stopTweens(b.btn); stopTweens(b.glow); stopTweens(b.text);
      const pt = b.pressAt ? (performance.now() - b.pressAt) / 1000 : 1;
      const k = pt < 0.075 ? 1 - 0.05 * (pt / 0.075) : pt < 0.25 ? 0.95 + 0.05 * ((pt - 0.075) / 0.175) : 1;
      b.btn.width = b.w * k; b.btn.height = b.h * k; b.glow.width = (b.w + 8) * k; b.glow.height = (b.h + 6) * k;
      b.btn.opacity = b.refB.opacity * dim;
      b.glow.opacity = b.refG.opacity;
      b.text.opacity = b.refT.opacity * (n > 0 ? 1 : 0.6);
    }
    // checkbox: opacity follows the left menu (screen fade in/out)
    const ref = byUid(19841);
    const a = ref ? ref.opacity : 1;
    layoutCheckbox();
    stopTweens(ui.box); stopTweens(ui.check); stopTweens(ui.label);
    ui.box.opacity = autoHire ? 0 : a * 0.25;
    ui.check.opacity = autoHire ? a : 0;
    ui.label.opacity = a;
  }

  // ── input: our buttons; the click does not reach the game (it would also start the card's search) ─
  let swallow = false;
  function onDown(e) {
    try { onDownInner(e); } catch (err) { console.warn('[hire-tools] onDown', err); }
  }
  function onDownInner(e) {
    if (!ui || rt.layout.name !== LAYOUT) return;
    if (String(gv.EditorNotification) !== 'OFF') return;          // the click closes the game notification
    const layer = ui.b1[0].btn.layer;
    const [x, y] = layer.cssPxToLayer(e.clientX, e.clientY);
    const [gx, gy] = ui.box.layer.cssPxToLayer(e.clientX, e.clientY);
    let act = null;
    for (const b of ui.b1) if (b.btn.opacity > 0.05 && hitBox(b.btn, x, y)) act = () => {
      if (engineBusy()) return;
      b.pressAt = performance.now();     // press like the game buttons (finished by tick)
      runBatch(b.tier);
    };
    if (!act && ui.label.opacity > 0.05 && (hitBox(ui.box, gx, gy, 6) || hitBox(ui.label, gx, gy) && gx <= ui.label.getBoundingBox().left + ui.label.textWidth + 6)) act = () => {
      autoHire = !autoHire;
      try { localStorage.setItem(LS_KEY, autoHire ? '1' : '0'); } catch { }
      if (S) S.set('hire-tools.autoHire', autoHire);
      call('Tap_Main');
    };
    if (!act) return;
    e.stopImmediatePropagation(); e.preventDefault();
    swallow = true;
    act();
  }
  function onOther(e) {
    if (!swallow) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.type === 'click' || e.type === 'pointercancel') swallow = false;
  }
  const OTHER = ['pointerup', 'mousedown', 'mouseup', 'click', 'pointercancel'];
  window.addEventListener('pointerdown', onDown, true);
  for (const t of OTHER) window.addEventListener(t, onOther, true);

  function onLayoutStart() {
    ui = null; phase = 'idle'; batch = null; busy = false;
    if (rt.layout.name === LAYOUT) setup();
  }
  const onLayoutEnd = () => { ui = null; };
  rt.addEventListener('afteranylayoutstart', onLayoutStart);
  rt.addEventListener('beforeanylayoutend', onLayoutEnd);
  rt.addEventListener('tick', tick);
  if (rt.layout && rt.layout.name === LAYOUT) setup();

  globalThis.__dtHireTools = {
    dispose() {
      window.removeEventListener('pointerdown', onDown, true);
      for (const t of OTHER) window.removeEventListener(t, onOther, true);
      rt.removeEventListener('afteranylayoutstart', onLayoutStart);
      rt.removeEventListener('beforeanylayoutend', onLayoutEnd);
      rt.removeEventListener('tick', tick);
      if (rt.layout && rt.layout.name === LAYOUT) teardown();
      ui = null;
    },
    get state() { return { autoHire, phase, busy, batch, ui: !!ui, stats: statsCache }; },
    debug: { runBatch, stats, hireFound, onDown: (e) => onDownInner(e) },
  };
});
