// Train all – UPGRADE EMPLOYEES screen (TRAIN YOUR EMPLOYEES).
//
// A green "TRAIN ALL (N)" button appears in the left panel under the legend. N = how many employees of the
// selected profession are not at the maximum level yet. A click trains every employee of the profession on all
// pages until they reach MAX LEVEL or the money or research points run out.
//
// Training goes through the game's own buttons (the same click as with the mouse), so the price, gains, salary,
// perks and the "not enough money" message are all computed by the game. The mod only switches pages and clicks.
// Sounds are muted during the batch (otherwise a hundred chimes would play) and one plays at the end.
// If a click does not train anyone three times in a row, the batch stops (the game changed its buttons).
BetterDTKit.mod('train-all', {
  needs: {
    objects: ['Text', '9patch3', 'Gradient_24', 'Sprite396', 'ArrayEmployees_Temp', 'ArrayEmployees_Characters', 'ArrayLanguage'],
    vars: ['Budget', 'ResearchCoins', 'Sounds', 'SubPage', 'SubPageMax', 'EditorNotification', 'EditorNotificationText'],
    arrays: { ArrayEmployees_Characters: [1, 3] },
  },
  texts: { 13956: 'Research points' },
  uids: { 20073: { layout: 'UPGRADE EMPLOYEES', t: 'Text', l: 'GLOBAL UI (Top)', w: 497, h: 268, x: 270, y: 350 } },   // legend
}, (rt, kit) => {
  if (globalThis.__dtTrainAll) globalThis.__dtTrainAll.dispose();

  const LAYOUT = 'UPGRADE EMPLOYEES';
  const gv = rt.globalVars;

  // ── texts (language order as in the game: ArrayLanguage row = LanguageChoose) ──────────────────
  const TXT = {
    btn: ['TRAIN ALL', 'ОБУЧИТЬ ВСЕХ', 'ALLE SCHULEN', 'FORMER TOUT LE MONDE', 'FORMA TUTTI', 'ENTRENAR A TODOS',
      'सभी को प्रशिक्षित करें', 'HEPSİNİ EĞİT', 'TREINAR TODOS', 'НАВЧИТИ ВСІХ', 'LATIH SEMUA', 'SZKOL WSZYSTKICH',
      '全部培训', '모두 교육', '全員を育成'],
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
  const tr = (key, n) => String(TXT[key][lang()] || TXT[key][0]).replace('{n}', n);
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

  // ── stav obrazovky ─────────────────────────────────────────────────────────────────────────────
  let ui = null;
  let running = false;
  let cache = { n: -1, at: 0 };

  function teardown() {
    if (!ui) return;
    for (const i of [ui.btn, ui.glow, ui.text, ui.hint]) try { i.destroy(); } catch { }
    ui = null;
  }

  function setup() {
    teardown();
    const legend = byUid(20073);
    if (!legend) return;
    const X = 270, Y = 650, W = 400, H = 64;
    const btn = rt.objects['9patch3'].createInstance('GLOBAL UI (Touched)', X, Y);
    btn.width = W; btn.height = H; btn.opacity = 0;
    const glow = rt.objects.Gradient_24.createInstance('GLOBAL UI (Touched)', X, Y);
    glow.width = W + 14; glow.height = H + 10; glow.opacity = 0; glow.moveAdjacentToInstance(btn, true);
    const text = rt.objects.Text.createInstance('GLOBAL UI (Top)', X, Y - 22);
    text.fontFace = 'SofiaSansExtraCondensed-Bold'; text.sizePt = 24; text.fontColor = [1, 1, 1];
    text.horizontalAlign = 'center'; text.verticalAlign = 'top'; text.width = W; text.height = 60; text.opacity = 0;
    text.changeIconSet(rt.objects.Sprite396);
    const hint = rt.objects.Text.createInstance('GLOBAL UI (Top)', X, Y + 50);
    hint.fontFace = 'SofiaSansExtraCondensed-Light'; hint.sizePt = 22; hint.fontColor = [1, 1, 1];
    hint.horizontalAlign = 'center'; hint.verticalAlign = 'top'; hint.width = 440; hint.height = 120; hint.opacity = 0;
    ui = { btn, glow, text, hint, W, H, lang: -1, label: '', pressAt: 0 };
    cache = { n: -1, at: 0 };
  }

  function tick() {
    if (!ui) return;
    if (ui.lang !== lang()) { ui.lang = lang(); ui.hint.text = tr('hint'); ui.label = ''; }
    const now = performance.now();
    if (!running && (cache.n < 0 || now - cache.at > 250)) cache = { n: pending(), at: now };
    const n = cache.n;
    const label = '[iconoffsety=5][icon=Research] ' + tr('btn') + (running ? '  …' : n > 0 ? '  (' + n + ')' : '');
    if (label !== ui.label) { ui.label = label; ui.text.text = label; }
    // opacity follows the legend (screen fade in/out)
    const legend = byUid(20073);
    const a = legend && legend.isVisible ? legend.opacity : 0;
    const on = n > 0 && !running;
    stopTweens(ui.btn); stopTweens(ui.glow); stopTweens(ui.text); stopTweens(ui.hint);
    const pt = ui.pressAt ? (now - ui.pressAt) / 1000 : 1;
    const k = pt < 0.075 ? 1 - 0.05 * (pt / 0.075) : pt < 0.25 ? 0.95 + 0.05 * ((pt - 0.075) / 0.175) : 1;
    ui.btn.width = ui.W * k; ui.btn.height = ui.H * k;
    ui.glow.width = (ui.W + 14) * k; ui.glow.height = (ui.H + 10) * k;
    ui.btn.opacity = a;                          // shape base: the gradient (source-atop) is drawn only over it
    ui.glow.opacity = a * (on ? 1 : 0.4);
    ui.text.opacity = a * (on ? 1 : 0.6);
    ui.hint.opacity = a * 0.7;
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

  // ── input: our button; the click does not reach the game ─────────────────────────────────────────
  function hitBox(inst, x, y, pad = 0) {
    const b = inst.getBoundingBox();
    return x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad;
  }
  let swallow = false;
  const onDown = kit.guard((e) => {
    if (synthetic || !ui || layoutName() !== LAYOUT) return;
    {
      if (String(gv.EditorNotification) !== 'OFF') return;      // the click closes the game notification
      if (ui.text.opacity < 0.05) return;
      const [x, y] = ui.btn.layer.cssPxToLayer(e.clientX, e.clientY);
      if (!hitBox(ui.btn, x, y)) return;
      e.stopImmediatePropagation(); e.preventDefault();
      swallow = true;
      if (running) return;
      ui.pressAt = performance.now();
      run().catch(err => { console.warn('[train-all]', err); running = false; });
    }
  });
  const onOther = kit.guard((e) => {
    if (synthetic || !swallow) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.type === 'click' || e.type === 'pointercancel') swallow = false;
  });
  const OTHER = ['pointerup', 'mousedown', 'mouseup', 'click', 'pointercancel'];
  window.addEventListener('pointerdown', onDown, true);
  for (const t of OTHER) window.addEventListener(t, onOther, true);

  const onLayoutStart = kit.guard(() => { ui = null; if (layoutName() === LAYOUT) setup(); });
  const onLayoutEnd = () => { ui = null; };
  const onTick = kit.guard(tick);
  rt.addEventListener('afteranylayoutstart', onLayoutStart);
  rt.addEventListener('beforeanylayoutend', onLayoutEnd);
  rt.addEventListener('tick', onTick);
  if (layoutName() === LAYOUT) setup();

  const dispose = () => {
    window.removeEventListener('pointerdown', onDown, true);
    for (const t of OTHER) window.removeEventListener(t, onOther, true);
    rt.removeEventListener('afteranylayoutstart', onLayoutStart);
    rt.removeEventListener('beforeanylayoutend', onLayoutEnd);
    rt.removeEventListener('tick', onTick);
    if (layoutName() === LAYOUT) teardown();
    ui = null;
  };
  globalThis.__dtTrainAll = {
    dispose,
    get state() { return { running, ui: !!ui, pending: pending() }; },
    debug: { run, pending, upgradeButtons },
  };
  return dispose;
});
