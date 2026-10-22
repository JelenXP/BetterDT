// Train all – UPGRADE EMPLOYEES screen (TRAIN YOUR EMPLOYEES).
//
// Under the game's "UPGRADE ALL" button (renamed to "UPGRADE DESIGNERS" etc.: one step for every employee of the
// profession) a second one in the same look, "DESIGNERS TO MAX (N)". N = how many employees of the selected
// profession are not at the maximum level yet. A click trains every employee of the profession on all pages until
// they reach MAX LEVEL or the money or research points run out.
//
// Training goes through the game's own buttons (the same click as with the mouse), so the price, gains, salary,
// perks and the "not enough money" message are all computed by the game. The mod only switches pages and clicks.
// Sounds are muted during the batch (otherwise a hundred chimes would play) and one plays at the end.
// If a click does not train anyone three times in a row, the batch stops (the game changed its buttons).
BetterDTKit.mod('train-all', {
  needs: {
    objects: ['Text', '9patch3', 'MyHTML_UpgradeEmployees', 'ArrayEmployees_Temp', 'ArrayEmployees_Characters', 'ArrayLanguage'],
    vars: ['Budget', 'ResearchCoins', 'Sounds', 'SubPage', 'SubPageMax', 'EditorNotification', 'EditorNotificationText'],
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
    max: ['{p} TO MAX', '{p}: ДО МАКСИМУМА', '{p} AUFS MAXIMUM', '{p} AU MAXIMUM', '{p} AL MASSIMO', '{p} AL MÁXIMO',
      '{p} अधिकतम तक', '{p} MAKSİMUMA', '{p} AO MÁXIMO', '{p}: ДО МАКСИМУМУ', '{p} KE MAKSIMAL', '{p} NA MAKSA',
      '{p}升到最高', '{p} 최대로', '{p}を最大まで'],
    until: ['until they run out', 'пока не закончатся', 'bis sie ausgehen', "jusqu'à épuisement", 'fino a esaurimento',
      'hasta agotarlos', 'खत्म होने तक', 'bitene kadar', 'até acabarem', 'поки не скінчаться', 'sampai habis',
      'do wyczerpania', '直到用完', '소진될 때까지', '尽きるまで'],
    hint: ['Trains everyone in this profession up to the max level, as long as money and research points last',
      'Обучает всех сотрудников этой профессии до максимального уровня, пока хватает денег и очков исследований',
      'Schult alle Mitarbeiter dieses Berufs bis zur Höchststufe, solange Geld und Forschungspunkte reichen',
      "Forme tous les employés de ce métier jusqu'au niveau max, tant que l'argent et les points de recherche suffisent",
      'Forma tutti i dipendenti di questa professione fino al livello massimo, finché bastano soldi e punti ricerca',
      'Entrena a todos los empleados de esta profesión hasta el nivel máximo mientras alcancen el dinero y los puntos de investigación',
      'जब तक पैसे और रिसर्च पॉइंट्स हैं, इस पेशे के सभी कर्मचारियों को अधिकतम स्तर तक प्रशिक्षित करता है',
      'Para ve araştırma puanı yettiği sürece bu meslekteki herkesi maksimum seviyeye kadar eğitir',
      'Treina todos desta profissão até o nível máximo, enquanto houver dinheiro e pontos de pesquisa',
      'Навчає всіх працівників цієї професії до максимального рівня, поки вистачає грошей і очок досліджень',
      'Melatih semua karyawan profesi ini hingga level maksimal selama uang dan poin riset masih cukup',
      'Szkoli wszystkich pracowników tego zawodu do maksymalnego poziomu, dopóki starcza pieniędzy i punktów badań',
      '在资金和研究点数足够时，将该职业的所有员工培训到最高等级',
      '돈과 연구 포인트가 허락하는 한 이 직업의 모든 직원을 최대 레벨까지 교육합니다',
      '資金と研究ポイントが続く限り、この職種の全員を最大レベルまで育成します'],
    done: ['Training finished: {n} upgrades', 'Обучение завершено: улучшений {n}', 'Schulung abgeschlossen: {n} Verbesserungen',
      'Formation terminée : {n} améliorations', 'Formazione completata: {n} miglioramenti', 'Entrenamiento terminado: {n} mejoras',
      'प्रशिक्षण पूरा: {n} सुधार', 'Eğitim tamamlandı: {n} geliştirme', 'Treinamento concluído: {n} melhorias',
      'Навчання завершено: покращень {n}', 'Pelatihan selesai: {n} peningkatan', 'Szkolenie zakończone: ulepszeń {n}',
      '培训完成：{n} 次提升', '교육 완료: {n}회 향상', '育成完了：{n}回アップ'],
    allMax: ['Everyone in this profession is already at the max level',
      'Все сотрудники этой профессии уже на максимальном уровне',
      'Alle Mitarbeiter dieses Berufs haben bereits die Höchststufe',
      'Tous les employés de ce métier sont déjà au niveau max',
      'Tutti i dipendenti di questa professione sono già al livello massimo',
      'Todos los empleados de esta profesión ya tienen el nivel máximo',
      'इस पेशे के सभी कर्मचारी पहले से अधिकतम स्तर पर हैं',
      'Bu meslekteki herkes zaten maksimum seviyede',
      'Todos desta profissão já estão no nível máximo',
      'Усі працівники цієї професії вже на максимальному рівні',
      'Semua karyawan profesi ini sudah di level maksimal',
      'Wszyscy pracownicy tego zawodu mają już maksymalny poziom',
      '该职业的所有员工都已达到最高等级',
      '이 직업의 모든 직원이 이미 최대 레벨입니다',
      'この職種の全員がすでに最大レベルです'],
  };
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const tr = (key, n) => String(TXT[key][lang()] || TXT[key][0]).replace(/\{[np]\}/, n);
  const arr = (name) => rt.objects[name].getFirstInstance();
  const gameText = (idx) => kit.text(idx);
  const money = (v) => '$' + Math.round(v).toLocaleString('en-US').replace(/,/g, ' ');

  // ── game data ──────────────────────────────────────────────────────────────────────────────────
  // ArrayEmployees_Temp = employees of the shown profession (x → id), ArrayEmployees_Characters (id, 0..2) =
  // design / speed / research; the game trains while the sum is < 300.
  function pending() {
    try {
      const temp = arr('ArrayEmployees_Temp'), ch = arr('ArrayEmployees_Characters');
      let n = 0;
      for (let x = 0; x < (temp.width | 0); x++) {
        const id = Number(temp.getAt(x, 0));
        if (!Number.isFinite(id) || id < 0) continue;
        const sum = Number(ch.getAt(id, 0)) + Number(ch.getAt(id, 1)) + Number(ch.getAt(id, 2));
        if (sum < 300) n++;
      }
      return n;
    } catch { return 0; }
  }

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
  display: flex; align-items: center; justify-content: center; pointer-events: none;
  transition: opacity 0.3s ease, transform 0.3s ease; }
#bdt-tam-root.bdt-off { opacity: 0; transform: translateY(10%) scale(0.9); }
#bdt-tam-root.bdt-off #bdt-tam-btn { pointer-events: none; }
#bdt-tam-btn { pointer-events: auto; box-sizing: border-box; width: 96%; height: 88%;
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
#bdt-tam-sub { display: flex; align-items: center; justify-content: center; gap: 2.4cqw; align-self: center;
  max-width: 100%; box-sizing: border-box; font-size: 17cqh; line-height: 1; padding: 5cqh 4.5cqw; border-radius: 99px;
  background: rgba(6,42,20,0.86); color: #9effb5; white-space: nowrap; overflow: hidden; }
#bdt-tam-sub img { width: 17cqh; height: 17cqh; object-fit: contain; }
#bdt-tam-sub .bdt-dot { opacity: 0.55; }
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
    root.className = 'bdt-off';
    root.innerHTML = '<button id="bdt-tam-btn" type="button"><div id="bdt-tam-head"><span id="bdt-tam-label"></span>' +
      '<span id="bdt-tam-count"></span></div><div id="bdt-tam-sub"><img src="UpgradeOffices/ResearchIcon.png" draggable="false" alt="">' +
      '<span class="bdt-dot">•</span><img src="UpgradeOffices/BudgetIcon.png" draggable="false" alt=""><span id="bdt-tam-until"></span></div></button>';
    el.appendChild(root);
    const btn = root.querySelector('#bdt-tam-btn');
    btn.addEventListener('click', kit.guard((e) => {
      e.stopPropagation();
      if (running) return;
      run().catch(err => { console.warn('[train-all]', err); running = false; });
    }));
    // the game rewrites its label whenever its numbers change: put the profession back before it is painted
    const obs = new MutationObserver(() => relabel());
    ui = { root, btn, obs, label: root.querySelector('#bdt-tam-label'), count: root.querySelector('#bdt-tam-count'),
      until: root.querySelector('#bdt-tam-until'), lang: -1, prof: '', watched: null };
    cache = { n: -1, at: 0 };
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
    const p = profession();
    if (ui.lang !== lang() || ui.prof !== p) {
      ui.lang = lang(); ui.prof = p;
      ui.label.textContent = tr('max', p);
      ui.until.textContent = tr('until');
      ui.btn.title = tr('hint');
    }
    relabel();
    const now = performance.now();
    if (cache.n < 0 || now - cache.at > 250) cache = { n: pending(), at: now };
    const count = running ? '…' : String(cache.n);
    if (ui.count.textContent !== count) ui.count.textContent = count;
    ui.btn.classList.toggle('bdt-empty', !running && cache.n <= 0);
    ui.btn.classList.toggle('bdt-run', running);
    // shown and hidden together with the game's button
    const g = document.getElementById('uea-root');
    const on = !!g && g.classList.contains('uea-shown') && !g.classList.contains('uea-hiding');
    ui.root.classList.toggle('bdt-off', !on);
  }

  // ── batch ──────────────────────────────────────────────────────────────────────────────────────
  const S = globalThis.BetterDT && globalThis.BetterDT.settings;
  async function run() {
    if (running) return;
    if (pending() <= 0) { call('Tap_Main'); notify(tr('allMax'), false); return; }
    running = true;
    call('Tap_Main');
    const sounds = gv.Sounds;
    const startBudget = +gv.Budget, startRP = +gv.ResearchCoins;
    const page0 = Math.max(1, +gv.SubPage | 0);
    let steps = 0, stoppedByGame = false;
    try {
      await ticks(2);                              // let the button press and tap sound finish
      if (!S || S.bool('train-all.mute', true)) gv.Sounds = 'OFF';   // option in the BetterDT settings
      const pages = Math.max(1, +gv.SubPageMax | 0);
      outer:
      for (let pg = 1; pg <= pages; pg++) {
        if ((+gv.SubPage | 0) !== pg) { gv.SubPage = pg; call('UpgradeEmployeesPageUI'); await ticks(2); }
        let idle = 0;
        for (let guard = 0; guard < 600; guard++) {
          if (layoutName() !== LAYOUT) break outer;
          const b = upgradeButtons()[0];
          if (!b) break;
          const before = +gv.Budget;
          clickInst(b);
          await ticks(2);
          if (+gv.Budget !== before) { steps++; idle = 0; continue; }
          // nothing was bought: the game shows "not enough money / points" only after 0.1 s (Wait 0.1 in the event)
          for (let w = 0; w < 30 && String(gv.EditorNotification) === 'OFF'; w++) await nextTick();
          if (String(gv.EditorNotification) !== 'OFF') { stoppedByGame = true; break outer; }
          if (++idle >= 3) { kit.warn('a click on a training button did nothing'); break outer; }   // did not register
        }
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
    ui.root.classList.add('bdt-off');
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
