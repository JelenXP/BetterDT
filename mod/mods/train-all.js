// Train all – UPGRADE EMPLOYEES screen (TRAIN YOUR EMPLOYEES).
//
// Under the game's "UPGRADE ALL" button (renamed to "UPGRADE DESIGNERS" etc.: one step for every employee of the
// profession) a second one in the same look, "ALL TO MAX (N)": N = employees of all professions not at the max
// level yet, and under it about how many research points and how much money it takes to train them all to the
// maximum (the gains are random, so it is an estimate). A click goes through every profession (the tabs on the
// left) and trains every employee on all pages until they reach MAX LEVEL or the money or research points run out.
//
// Training goes through the game's own buttons (the same click as with the mouse), so the price, gains, salary,
// perks and the "not enough money" message are all computed by the game. The mod only switches professions and
// pages and clicks.
// Sounds are muted during the batch (otherwise a hundred chimes would play) and one plays at the end.
// If a click does not train anyone three times in a row, the batch stops (the game changed its buttons).
BetterDTKit.mod('train-all', {
  needs: {
    objects: ['Text', '9patch3', '9patch25', 'MyHTML_UpgradeEmployees', 'ArrayEmployees_Temp', 'ArrayMyEmployees', 'ArrayEmployees_Characters', 'ArrayLanguage'],
    vars: ['Budget', 'ResearchCoins', 'Sounds', 'SubPage', 'SubPageMax', 'EditorNotification', 'EditorNotificationText',
      'EmployeesProfession'],
    arrays: { ArrayEmployees_Characters: [1, 3] },
  },
  texts: { 13956: 'Research points' },
  uids: { 19938: { layout: 'UPGRADE EMPLOYEES', t: 'Text', l: 'GLOBAL UI (Top)', w: 517, h: 92, x: 270, y: 135 } },   // profession
}, (rt, kit) => {
  if (globalThis.__dtTrainAll) globalThis.__dtTrainAll.dispose();

  const LAYOUT = 'UPGRADE EMPLOYEES';
  const gv = rt.globalVars;

  // ── texts (language order as in the game: ArrayLanguage row = LanguageChoose) ──────────────────
  const TXT = {
    // the game's button, with the profession it upgrades ({p} = "DESIGNERS" as the game shows it)
    upgrade: ['UPGRADE {p}', 'УЛУЧШИТЬ: {p}', '{p} VERBESSERN', 'AMÉLIORER : {p}', 'MIGLIORA {p}', 'MEJORAR {p}',
      '{p} अपग्रेड करें', '{p} GELİŞTİR', 'MELHORAR {p}', 'ПОКРАЩИТИ: {p}', 'TINGKATKAN {p}', 'ULEPSZ: {p}',
      '升级{p}', '{p} 업그레이드', '{p}をアップグレード'],
    max: ['ALL TO MAX',
      'ВСЕХ НА МАКСИМУМ',
      'ALLE AUFS MAXIMUM',
      'TOUS AU MAXIMUM',
      'TUTTI AL MASSIMO',
      'TODOS AL MÁXIMO',
      'सभी अधिकतम तक',
      'HEPSİ MAKSİMUMA',
      'TODOS AO MÁXIMO',
      'УСІХ НА МАКСИМУМ',
      'SEMUA KE MAKSIMAL',
      'WSZYSCY NA MAKSA',
      '全部升到最高',
      '모두 최대로',
      '全員を最大まで'],
    none: ['everyone at max level', 'все на максимуме', 'alle auf Höchststufe', 'tous au niveau max',
      'tutti al livello massimo', 'todos al nivel máximo', 'सभी अधिकतम स्तर पर', 'herkes maksimumda', 'todos no nível máximo',
      'усі на максимумі', 'semua level maksimal', 'wszyscy na maksa', '全部已达最高等级', '모두 최대 레벨', '全員最大レベル'],
    hint: ['Trains every employee of every profession up to the max level, as long as money and research points last',
      'Обучает всех сотрудников всех профессий до максимального уровня, пока хватает денег и очков исследований',
      'Schult alle Mitarbeiter aller Berufe bis zur Höchststufe, solange Geld und Forschungspunkte reichen',
      'Forme tous les employés de tous les métiers jusqu\'au niveau max, tant que l\'argent et les points de recherche suffisent',
      'Forma tutti i dipendenti di tutte le professioni fino al livello massimo, finché bastano soldi e punti ricerca',
      'Entrena a todos los empleados de todas las profesiones hasta el nivel máximo mientras alcancen el dinero y los puntos de investigación',
      'जब तक पैसे और रिसर्च पॉइंट्स हैं, सभी पेशों के सभी कर्मचारियों को अधिकतम स्तर तक प्रशिक्षित करता है',
      'Para ve araştırma puanı yettiği sürece tüm mesleklerdeki herkesi maksimum seviyeye kadar eğitir',
      'Treina todos de todas as profissões até o nível máximo, enquanto houver dinheiro e pontos de pesquisa',
      'Навчає всіх працівників усіх професій до максимального рівня, поки вистачає грошей і очок досліджень',
      'Melatih semua karyawan dari semua profesi hingga level maksimal selama uang dan poin riset masih cukup',
      'Szkoli wszystkich pracowników wszystkich zawodów do maksymalnego poziomu, dopóki starcza pieniędzy i punktów badań',
      '在资金和研究点数足够时，将所有职业的所有员工培训到最高等级',
      '돈과 연구 포인트가 허락하는 한 모든 직업의 모든 직원을 최대 레벨까지 교육합니다',
      '資金と研究ポイントが続く限り、全職種の全員を最大レベルまで育成します'],
    done: ['Training finished: {n} upgrades', 'Обучение завершено: улучшений {n}', 'Schulung abgeschlossen: {n} Verbesserungen',
      'Formation terminée : {n} améliorations', 'Formazione completata: {n} miglioramenti', 'Entrenamiento terminado: {n} mejoras',
      'प्रशिक्षण पूरा: {n} सुधार', 'Eğitim tamamlandı: {n} geliştirme', 'Treinamento concluído: {n} melhorias',
      'Навчання завершено: покращень {n}', 'Pelatihan selesai: {n} peningkatan', 'Szkolenie zakończone: ulepszeń {n}',
      '培训完成：{n} 次提升', '교육 완료: {n}회 향상', '育成完了：{n}回アップ'],
    allMax: ['All employees are already at the max level',
      'Все сотрудники уже на максимальном уровне',
      'Alle Mitarbeiter haben bereits die Höchststufe',
      'Tous les employés sont déjà au niveau max',
      'Tutti i dipendenti sono già al livello massimo',
      'Todos los empleados ya tienen el nivel máximo',
      'सभी कर्मचारी पहले से अधिकतम स्तर पर हैं',
      'Tüm çalışanlar zaten maksimum seviyede',
      'Todos os funcionários já estão no nível máximo',
      'Усі працівники вже на максимальному рівні',
      'Semua karyawan sudah di level maksimal',
      'Wszyscy pracownicy mają już maksymalny poziom',
      '所有员工都已达到最高等级',
      '모든 직원이 이미 최대 레벨입니다',
      '全員がすでに最大レベルです'],
  };
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const tr = (key, n) => String(TXT[key][lang()] || TXT[key][0]).replace(/\{[np]\}/, n);
  const arr = (name) => rt.objects[name].getFirstInstance();
  const gameText = (idx) => kit.text(idx);
  const money = (v) => '$' + Math.round(v).toLocaleString('en-US').replace(/,/g, ' ');

  // ── game data ──────────────────────────────────────────────────────────────────────────────────
  // ArrayEmployees_Temp = employees of the shown profession (x → id), ArrayMyEmployees = all hired employees
  // (x → id in row 0), ArrayEmployees_Characters (id, 0..2) = design / speed / research; the game trains while the
  // sum is < 300.
  function pending(all) {
    try {
      const list = arr(all ? 'ArrayMyEmployees' : 'ArrayEmployees_Temp'), ch = arr('ArrayEmployees_Characters');
      let n = 0;
      for (let x = 0; x < (list.width | 0); x++) {
        const id = Number(list.getAt(x, 0));
        if (!Number.isFinite(id) || id < 0) continue;
        const sum = Number(ch.getAt(id, 0)) + Number(ch.getAt(id, 1)) + Number(ch.getAt(id, 2));
        if (sum < 300) n++;
      }
      return n;
    } catch { return 0; }
  }

  // about what training everyone to the max costs: the game's formulas (one step = sum of the three levels × $1,500
  // and ⌈sum × 0.015⌉ points; every level gains 3–12 plus the training perk × 3 % of it, up to 100), with the
  // average gain
  function estimate() {
    const my = arr('ArrayMyEmployees'), ch = arr('ArrayEmployees_Characters');
    let perk = 0;
    try { perk = Number(arr('ArrayMyPerks').getAt(1, 1)) || 0; } catch { }
    const r = { n: 0, usd: 0, rp: 0 };
    for (let x = 0; x < (my.width | 0); x++) {
      const id = Math.round(Number(my.getAt(x, 0)));
      if (!(id >= 0 && id < ch.width)) continue;
      let lv = [0, 1, 2].map(k => Number(ch.getAt(id, k)) || 0), sum = lv[0] + lv[1] + lv[2];
      if (sum >= 300) continue;
      r.n++;
      for (let g = 0; g < 100 && sum < 300; g++) {
        r.usd += sum * 1500;
        r.rp += Math.ceil(sum * 0.015);
        lv = lv.map(v => Math.min(100, v + 7.5 + Math.round(v * perk * 0.03)));
        sum = lv[0] + lv[1] + lv[2];
      }
    }
    return r;
  }
  const int = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // ── game UI helpers ────────────────────────────────────────────────────────────────────────────
  const call = (fn) => { try { rt.callFunction(fn); } catch (e) { console.warn('[train-all]', fn, e); } };
  function notify(text, error) {
    gv.EditorNotification = 'ON';
    gv.EditorNotificationText = text;
    call('EditorNotification_ON');
    if (error) call('ErrorSound');
  }
  const byUid = (u) => kit.inst(u);
  const layoutName = () => { try { return rt.layout.name; } catch { return ''; } };
  function stopTweens(inst) {
    try { for (const t of inst.behaviors.Tween.allTweens()) t.stop(); } catch { }
  }
  const nextTick = () => new Promise(res => {
    const h = () => { rt.removeEventListener('tick', h); res(); };
    rt.addEventListener('tick', h);
  });
  const ticks = async (n) => { for (let i = 0; i < n; i++) await nextTick(); };

  // training buttons on the cards: invisible 9patch3 area on the "UI (Touched)" layer
  // (the game hides it for MAX LEVEL and empty slots)
  function upgradeButtons() {
    return rt.objects['9patch3'].getAllInstances()
      .filter(i => i.layer && i.layer.name === 'UI (Touched)' && i.isVisible)
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }

  // the profession tabs on the left (designers, programmers, …), from left to right
  function professionTabs() {
    return rt.objects['9patch25'].getAllInstances()
      .filter(i => i.layer && i.layer.name === 'GLOBAL UI (Touched)' && i.isVisible && i.y < 400 && i.x < 600)
      .sort((a, b) => a.x - b.x);
  }

  // click like the mouse (the game reacts to Mouse "On object clicked")
  let synthetic = false;
  function clickInst(inst) {
    const canvas = document.querySelector('canvas');
    const [x, y] = inst.layer.layerToCssPx(inst.x, inst.y);
    const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse',
      isPrimary: true, button: 0, buttons: 1, view: window };
    synthetic = true;
    try {
      canvas.dispatchEvent(new PointerEvent('pointermove', { ...o, buttons: 0 }));
      canvas.dispatchEvent(new PointerEvent('pointerdown', o));
      canvas.dispatchEvent(new MouseEvent('mousedown', o));
      canvas.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
      canvas.dispatchEvent(new MouseEvent('mouseup', { ...o, buttons: 0 }));
      canvas.dispatchEvent(new MouseEvent('click', { ...o, buttons: 0 }));
    } finally { synthetic = false; }
  }

  // ── screen: the game's HTML button (one training step for everyone) and ours under it ───────────────
  const HTML_OBJ = 'MyHTML_UpgradeEmployees';
  const BOX = { y: 565, h: 160 };   // both buttons fit between the legend and Back (the game's alone: 600, 200)
  let ui = null;
  let running = false;
  let cache = { n: -1, at: 0 };

  function injectCss() {
    if (document.getElementById('bdt-tam-style')) return;
    const st = document.createElement('style');
    st.id = 'bdt-tam-style';
    // the game's #uea-* rules, for our own ids
    st.textContent = `
#bdt-tam-root { position: absolute; left: 0; top: 110%; width: 100%; height: 100%; container-type: size;
  display: flex; align-items: center; justify-content: center; pointer-events: none; }
/* shown and hidden together with the game's button: the same classes and keyframes, no frame later */
#bdt-tam-btn { opacity: 0; pointer-events: none; }
#uea-root.uea-shown ~ #bdt-tam-root #bdt-tam-btn { animation: uea-in 0.42s cubic-bezier(0.2, 1.35, 0.4, 1) forwards; pointer-events: auto; }
#uea-root.uea-ready ~ #bdt-tam-root #bdt-tam-btn { opacity: 1; transform: none; animation: none; }
#uea-root.uea-hiding ~ #bdt-tam-root #bdt-tam-btn { animation: uea-out 320ms cubic-bezier(0.5, 0, 0.75, 0) forwards; pointer-events: none; }
#uea-root.uea-shown:not(.uea-hiding) ~ #bdt-tam-root #bdt-tam-btn:active { transform: scale(0.96); }
#bdt-tam-btn { box-sizing: border-box; width: 96%; height: 88%;
  display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: 6cqh; padding: 0 5cqw;
  border: none; border-radius: 14cqh; background: linear-gradient(175deg, #9effb5, #2ec766);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 0 rgba(0,70,30,0.30), 0 4px 14px rgba(0,0,0,0.35);
  color: #062a14; font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; cursor: pointer; user-select: none;
  transition: transform 0.14s ease, filter 0.14s ease; }
#bdt-tam-btn:hover { filter: brightness(1.07); }
#bdt-tam-btn:active { transform: scale(0.96); }
#bdt-tam-btn.bdt-empty { filter: grayscale(0.85) brightness(0.8); cursor: default; }
#bdt-tam-btn.bdt-run { filter: brightness(0.92); cursor: progress; }
#bdt-tam-head { display: flex; align-items: center; justify-content: center; gap: 3cqw; min-width: 0; }
#bdt-tam-label { font-size: 24cqh; line-height: 1; letter-spacing: 0.04em; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; min-width: 0; }
#bdt-tam-count { flex: none; font-size: 14cqh; line-height: 1; padding: 3cqh 2.6cqw; border-radius: 99px;
  background: rgba(6,42,20,0.18); }
#bdt-tam-sub img { width: 17cqh; height: 17cqh; object-fit: contain; }
#bdt-tam-sub .bdt-dot { opacity: 0.55; }
#bdt-tam-btn.bdt-poor #bdt-tam-sub { color: #ff8a7a; }
#bdt-tam-sub.bdt-done > :not(#bdt-tam-none), #bdt-tam-sub:not(.bdt-done) #bdt-tam-none { display: none; }
#bdt-tam-sub { display: flex; align-items: center; justify-content: center; gap: 2.4cqw; align-self: center;
  max-width: 100%; box-sizing: border-box; font-size: 17cqh; line-height: 1; padding: 5cqh 4.5cqw; border-radius: 99px;
  background: rgba(6,42,20,0.86); color: #9effb5; white-space: nowrap; overflow: hidden; }
`;
    document.head.appendChild(st);
  }

  function gameBox() {
    try { return rt.objects[HTML_OBJ].getFirstInstance(); } catch { return null; }
  }
  // the profession as the game shows it on the left ("DESIGNERS"), without the icon tags
  function profession() {
    const t = byUid(19938);
    return t ? String(t.text).replace(/\[[^\]]*\]/g, '').trim() : '';
  }

  function teardown() {
    if (!ui) return;
    try { ui.obs.disconnect(); } catch { }
    try { ui.root.remove(); } catch { }
    ui = null;
  }

  function setup() {
    teardown();
    const box = gameBox(), el = box && box.getElement && box.getElement();
    if (!el) return;
    injectCss();
    box.y = BOX.y; box.height = BOX.h;
    const root = document.createElement('div');
    root.id = 'bdt-tam-root';
    root.innerHTML = '<button id="bdt-tam-btn" type="button"><div id="bdt-tam-head"><span id="bdt-tam-label"></span>' +
      '<span id="bdt-tam-count"></span></div><div id="bdt-tam-sub"><span>≈</span><img src="UpgradeOffices/ResearchIcon.png" draggable="false" alt="">' +
      '<span id="bdt-tam-rp"></span><span class="bdt-dot">•</span><img src="UpgradeOffices/BudgetIcon.png" draggable="false" alt="">' +
      '<span id="bdt-tam-usd"></span><span id="bdt-tam-none"></span></div></button>';
    el.appendChild(root);
    const btn = root.querySelector('#bdt-tam-btn');
    btn.addEventListener('click', kit.guard((e) => {
      e.stopPropagation();
      if (running) return;
      run().catch(err => { console.warn('[train-all]', err); running = false; });
    }));
    // the game rewrites its label whenever its numbers change: put the profession back before it is painted
    const obs = new MutationObserver(() => relabel());
    const q = (sel) => root.querySelector(sel);
    ui = { root, btn, obs, label: q('#bdt-tam-label'), count: q('#bdt-tam-count'), sub: q('#bdt-tam-sub'), rp: q('#bdt-tam-rp'), usd: q('#bdt-tam-usd'),
      none: q('#bdt-tam-none'), lang: -1, watched: null };
    cache = { n: -1, at: 0 };
    tick();                                        // the texts are there before the first frame
  }

  function relabel() {
    if (!ui) return;
    const l = document.getElementById('uea-label');
    if (!l) return;
    if (ui.watched !== l) {
      ui.obs.disconnect();
      ui.obs.observe(l, { childList: true, characterData: true, subtree: true });
      ui.watched = l;
    }
    const p = profession(), want = p ? tr('upgrade', p) : '';
    if (want && l.textContent !== want) l.textContent = want;
  }

  function tick() {
    if (!ui) return;
    if (ui.lang !== lang()) {
      ui.lang = lang();
      ui.label.textContent = tr('max');
      ui.none.textContent = tr('none');
      ui.btn.title = tr('hint');
      cache = { n: -1, at: 0 };
    }
    relabel();
    const now = performance.now();
    if (cache.n < 0 || now - cache.at > 250) cache = { ...estimate(), at: now };
    // like the game's count: the employees who are not at the max level yet (here of all professions)
    const n = String(Math.max(0, cache.n)), rp = int(cache.rp), usd = '$' + int(cache.usd);
    if (ui.count.textContent !== n) ui.count.textContent = n;
    if (ui.rp.textContent !== rp) ui.rp.textContent = rp;
    if (ui.usd.textContent !== usd) ui.usd.textContent = usd;
    ui.sub.classList.toggle('bdt-done', cache.n <= 0);
    // red like the game's price when the money or the points are not enough for all of it
    ui.btn.classList.toggle('bdt-poor', cache.n > 0 && (cache.usd > (+gv.Budget || 0) || cache.rp > (+gv.ResearchCoins || 0)));
    ui.btn.classList.toggle('bdt-empty', !running && cache.n <= 0);
    ui.btn.classList.toggle('bdt-run', running);
  }

  // ── batch ──────────────────────────────────────────────────────────────────────────────────────
  // trains the shown profession on all its pages; '' = done, 'game' = the game said no (money / points),
  // 'left' = the screen was left, 'stuck' = clicks did nothing
  async function trainShown(count) {
    const pages = Math.max(1, +gv.SubPageMax | 0);
    for (let pg = 1; pg <= pages; pg++) {
      if ((+gv.SubPage | 0) !== pg) { gv.SubPage = pg; call('UpgradeEmployeesPageUI'); await ticks(2); }
      let idle = 0;
      for (let guard = 0; guard < 600; guard++) {
        if (layoutName() !== LAYOUT) return 'left';
        const b = upgradeButtons()[0];
        if (!b) break;
        const before = +gv.Budget;
        clickInst(b);
        await ticks(2);
        if (+gv.Budget !== before) { count(); idle = 0; continue; }
        // nothing was bought: the game shows "not enough money / points" only after 0.1 s (Wait 0.1 in the event)
        for (let w = 0; w < 30 && String(gv.EditorNotification) === 'OFF'; w++) await nextTick();
        if (String(gv.EditorNotification) !== 'OFF') return 'game';
        if (++idle >= 3) return 'stuck';                   // did not register
      }
    }
    return '';
  }
  // a click on a profession tab, like the mouse; false when it was the shown one already
  async function showTab(tab) {
    const before = String(gv.EmployeesProfession);
    clickInst(tab);
    for (let w = 0; w < 30 && String(gv.EmployeesProfession) === before; w++) await nextTick();
    await ticks(2);
    return String(gv.EmployeesProfession) !== before;
  }

  const S = globalThis.BetterDT && globalThis.BetterDT.settings;
  async function run() {
    if (running) return;
    if (pending(true) <= 0) { call('Tap_Main'); notify(tr('allMax'), false); return; }
    running = true;
    call('Tap_Main');
    const sounds = gv.Sounds;
    const startBudget = +gv.Budget, startRP = +gv.ResearchCoins;
    const page0 = Math.max(1, +gv.SubPage | 0);
    const prof0 = String(gv.EmployeesProfession);
    let steps = 0, stop = '', home = null;
    try {
      await ticks(2);                              // let the button press and tap sound finish
      if (!S || S.bool('train-all.mute', true)) gv.Sounds = 'OFF';   // option in the BetterDT settings
      // the shown profession first, then the others from left to right
      if (pending() > 0) stop = await trainShown(() => steps++);
      for (const tab of professionTabs()) {
        if (stop) break;
        const was = String(gv.EmployeesProfession);
        if (!await showTab(tab)) { if (was === prof0) home = tab; continue; }
        if (String(gv.EmployeesProfession) === prof0) { home = tab; continue; }   // trained first
        if (pending() > 0) stop = await trainShown(() => steps++);
      }
      if (stop === 'stuck') kit.warn('a click on a training button did nothing');
      // back to the profession that was shown
      if (layoutName() === LAYOUT && String(gv.EmployeesProfession) !== prof0) {
        if (home) await showTab(home);
        else for (const tab of professionTabs()) { await showTab(tab); if (String(gv.EmployeesProfession) === prof0) break; }
      }
    } finally {
      gv.Sounds = sounds;
      running = false;
      cache = { n: -1, at: 0 };
    }
    if (layoutName() !== LAYOUT) return;
    gv.SubPage = Math.min(page0, Math.max(1, +gv.SubPageMax | 0));
    call('UpgradeEmployeesPageUI');
    call('UpgradeEmployees_ButtonsOpacity');
    const stoppedByGame = stop === 'game';
    const spent = startBudget - +gv.Budget, rp = startRP - +gv.ResearchCoins;
    const summary = tr('done', '[color=#FFD800]' + steps + '[/color]') +
      (steps > 0 ? '\n[color=#ff7a7a]−' + money(spent) + '\n−' + Math.round(rp) + ' ' + gameText(13956) + '[/color]' : '');
    if (steps > 0) call('CashSound');
    if (stoppedByGame) {
      // the game already showed its message (not enough money / points) – append the summary to it
      // (the text is already copied into the object on the EDITOR NOTIFICATION layer, so there too)
      const old = String(gv.EditorNotificationText);
      gv.EditorNotificationText = old + '\n\n' + summary;
      for (const t of rt.objects.Text.getAllInstances()) {
        if (t.layer && t.layer.name === 'EDITOR NOTIFICATION' && t.text === old) t.text = old + '\n\n' + summary;
      }
    } else notify(summary, false);
  }

  const onLayoutStart = kit.guard(() => { teardown(); if (layoutName() === LAYOUT) setup(); });
  // our button fades out with the game's one; the page removes both elements
  const onLayoutEnd = () => {
    if (!ui) return;
    try { ui.obs.disconnect(); } catch { }
    ui = null;
  };
  const onTick = kit.guard(tick);
  rt.addEventListener('afteranylayoutstart', onLayoutStart);
  rt.addEventListener('beforeanylayoutend', onLayoutEnd);
  rt.addEventListener('tick', onTick);
  if (layoutName() === LAYOUT) setup();

  const dispose = () => {
    rt.removeEventListener('afteranylayoutstart', onLayoutStart);
    rt.removeEventListener('beforeanylayoutend', onLayoutEnd);
    rt.removeEventListener('tick', onTick);
    if (layoutName() === LAYOUT) {
      teardown();
      const box = gameBox();
      if (box) { box.y = 600; box.height = 200; }
      try { if (typeof globalThis.refreshUpgradeEmployeesButton === 'function') globalThis.refreshUpgradeEmployeesButton(); } catch { }
    }
    ui = null;
  };
  globalThis.__dtTrainAll = {
    dispose,
    get state() { return { running, ui: !!ui, pending: pending() }; },
    debug: { run, pending, upgradeButtons },
  };
  return dispose;
});
