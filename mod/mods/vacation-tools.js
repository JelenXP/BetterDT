// Vacation for the tired – MY EMPLOYEES screen.
//
// A third button of the same kind, "VACATION FOR THE TIRED – N NEED A REST", appears under the game's
// SEND ON VACATION and PAY THE BONUS buttons. One click sends every employee (of all professions) with mood
// below 30 on vacation, i.e. those the game marks "Vacation needed" or "Risk of dismissal".
// The most tired go first.
//
// The rules are the same as for the game's button (event sheet "MY EMPLOYEES [Engine]"):
//   mood + 30 to 40 (max 100), 30 days − 7 per perk, status "Vacation", and at least one person of each
//   profession must keep working. Whoever did not fit because of that stays, and the mod says so.
DTMods.register('vacation-tools', (rt) => {
  if (globalThis.__dtVacationTools) globalThis.__dtVacationTools.dispose();

  const LAYOUT = 'EMPLOYEES';
  // below 30 the game shows "Vacation needed"; the threshold can be changed in the BetterDT settings
  const S = globalThis.BetterDT && globalThis.BetterDT.settings;
  const low = () => Math.min(100, Math.max(1, S ? S.num('vacation-tools.threshold', 30) : 30));
  const gv = rt.globalVars;

  // ── texts (language order as in the game: ArrayLanguage row = LanguageChoose) ──────────────────
  const TXT = {
    btn: ['VACATION FOR THE TIRED', 'ОТПУСК УСТАВШИМ', 'URLAUB FÜR MÜDE', 'VACANCES POUR LES FATIGUÉS',
      'FERIE AI STANCHI', 'VACACIONES A LOS CANSADOS', 'थके हुओं को छुट्टी', 'YORGUNLARA İZİN',
      'FÉRIAS PARA OS CANSADOS', 'ВІДПУСТКА ВТОМЛЕНИМ', 'CUTI UNTUK YANG LELAH', 'URLOP DLA ZMĘCZONYCH',
      '让疲惫员工休假', '지친 직원 휴가', '疲れた社員を休暇へ'],
    need: ['{n} NEED A REST', 'НУЖЕН ОТДЫХ: {n}', '{n} BRAUCHEN ERHOLUNG', '{n} ONT BESOIN DE REPOS',
      '{n} HANNO BISOGNO DI RIPOSO', '{n} NECESITAN DESCANSO', '{n} को आराम चाहिए', 'DİNLENMESİ GEREKEN: {n}',
      '{n} PRECISAM DESCANSAR', 'ПОТРЕБУЮТЬ ВІДПОЧИНКУ: {n}', '{n} PERLU ISTIRAHAT', 'ODPOCZYNKU POTRZEBUJE: {n}',
      '{n} 人需要休息', '휴식 필요: {n}명', '休息が必要：{n}人'],
    sent: ['Sent on vacation: {n}', 'Отправлено в отпуск: {n}', 'In den Urlaub geschickt: {n}', 'Envoyés en vacances : {n}',
      'Mandati in ferie: {n}', 'Enviados de vacaciones: {n}', 'छुट्टी पर भेजे गए: {n}', 'İzne gönderilen: {n}',
      'Enviados de férias: {n}', 'Відправлено у відпустку: {n}', 'Dikirim cuti: {n}', 'Wysłano na urlop: {n}',
      '已安排休假：{n}', '휴가 보냄: {n}명', '休暇に送った人数：{n}'],
    kept: ['{n} stayed at work: at least one employee of each profession has to keep working',
      'Остались на работе: {n} – в каждой профессии хотя бы один сотрудник должен работать',
      '{n} bleiben bei der Arbeit: In jedem Beruf muss mindestens ein Mitarbeiter weiterarbeiten',
      '{n} restent au travail : au moins un employé de chaque métier doit continuer à travailler',
      '{n} restano al lavoro: almeno un dipendente per professione deve continuare a lavorare',
      '{n} siguen trabajando: al menos un empleado de cada profesión debe seguir trabajando',
      '{n} काम पर रहे: हर पेशे का कम से कम एक कर्मचारी काम करता रहना चाहिए',
      '{n} kişi işte kaldı: her meslekten en az bir çalışan çalışmaya devam etmeli',
      '{n} ficaram trabalhando: pelo menos um funcionário de cada profissão precisa continuar',
      'Залишилися на роботі: {n} – у кожній професії хоча б один працівник має працювати',
      '{n} tetap bekerja: minimal satu karyawan dari tiap profesi harus tetap bekerja',
      'W pracy zostaje: {n} – w każdym zawodzie przynajmniej jeden pracownik musi pracować',
      '{n} 人留岗：每个职业至少要有一名员工继续工作',
      '{n}명은 근무 유지: 직업마다 최소 한 명은 계속 일해야 합니다',
      '{n}人は勤務継続：各職種で少なくとも1人は働き続ける必要があります'],
    none: ['Nobody needs a rest right now', 'Сейчас никому не нужен отдых', 'Gerade braucht niemand Erholung',
      "Personne n'a besoin de repos pour l'instant", 'Al momento nessuno ha bisogno di riposo',
      'Ahora nadie necesita descanso', 'अभी किसी को आराम की ज़रूरत नहीं है', 'Şu an kimsenin dinlenmesi gerekmiyor',
      'Ninguém precisa descansar agora', 'Зараз нікому не потрібен відпочинок', 'Saat ini tidak ada yang perlu istirahat',
      'Teraz nikt nie potrzebuje odpoczynku', '目前没有人需要休息', '지금은 휴식이 필요한 직원이 없습니다',
      '今は休息が必要な社員はいません'],
  };
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const tr = (key, n) => String(TXT[key][lang()] || TXT[key][0]).replace('{n}', n);

  // ── game data ──────────────────────────────────────────────────────────────────────────────────
  // ArrayMyEmployees: x = employee, y0 = id, y1 = mood, y2 = status days, y3 = status ("Vacation"/"Bonus"/…)
  // ArrayEmployees (id, 4) = profession, ArrayMyPerks (2, 1) = shorter vacation perk
  const arr = (name) => rt.objects[name].getFirstInstance();
  function plan() {
    const my = arr('ArrayMyEmployees'), info = arr('ArrayEmployees');
    const byProf = new Map();
    for (let x = 0; x < (my.width | 0); x++) {
      const id = Number(my.getAt(x, 0));
      if (!Number.isFinite(id) || id < 0) continue;
      const p = String(info.getAt(id, 4));
      if (!byProf.has(p)) byProf.set(p, { total: 0, onVac: 0, tired: [] });
      const g = byProf.get(p);
      g.total++;
      const status = String(my.getAt(x, 3));
      const mood = Number(my.getAt(x, 1));
      if (status === 'Vacation') g.onVac++;
      else if (Number.isFinite(mood) && mood < low()) g.tired.push({ x, mood });
    }
    const send = [];
    let kept = 0;
    for (const g of byProf.values()) {
      g.tired.sort((a, b) => a.mood - b.mood);
      let onVac = g.onVac;
      for (const t of g.tired) {
        if (onVac < g.total - 1) { send.push(t); onVac++; } else kept++;
      }
    }
    return { send, kept };
  }

  function sendTired() {
    const { send, kept } = plan();
    call('Tap_Main');
    if (!send.length) { notify(kept ? tr('kept', kept) : tr('none'), false); return; }
    const my = arr('ArrayMyEmployees');
    let perk = 0;
    try { perk = Number(arr('ArrayMyPerks').getAt(2, 1)) || 0; } catch { }
    const days = 30 - perk * 7;
    for (const t of send) {
      const mood = Math.min(100, t.mood + Math.round(30 + Math.random() * 10));
      my.setAt(mood, t.x, 1);
      my.setAt(days, t.x, 2);
      my.setAt('Vacation', t.x, 3);
    }
    call('EmployeesPageUI');
    let text = tr('sent', '[color=#FFD800]' + send.length + '[/color]');
    if (kept) text += '\n\n' + tr('kept', kept);
    notify(text, false);
    cache = { n: -1, at: 0 };
  }

  // ── game UI helpers ────────────────────────────────────────────────────────────────────────────
  const call = (fn) => { try { rt.callFunction(fn); } catch (e) { console.warn('[vacation-tools]', fn, e); } };
  function notify(text, error) {
    gv.EditorNotification = 'ON';
    gv.EditorNotificationText = text;
    call('EditorNotification_ON');
    if (error) call('ErrorSound');
  }
  const byUid = (u) => rt.getInstanceByUid(u);
  const layoutName = () => { try { return rt.layout.name; } catch { return ''; } };
  function stopTweens(inst) {
    try { for (const t of inst.behaviors.Tween.allTweens()) t.stop(); } catch { }
  }

  // ── stav obrazovky ─────────────────────────────────────────────────────────────────────────────
  // game button "SEND ON VACATION": 9patch3 19811 (UI Back) + 20018 (UI Blur) + text 19813,
  // "PAY THE BONUS" 130 lower; the (i) icon 19831 below them
  const REF = { back: 19812, blur: 20019, text: 19814, info: 19831, title: 1459 };
  const STEP = 130;
  let ui = null;
  let cache = { n: -1, at: 0 };

  function teardown() {
    if (!ui) return;
    for (const i of [ui.back, ui.blur, ui.text]) try { i.destroy(); } catch { }
    try { const info = byUid(REF.info); if (info) info.y = ui.infoY; } catch { }
    ui = null;
  }

  function setup() {
    teardown();
    const rb = byUid(REF.back), rl = byUid(REF.blur), rt0 = byUid(REF.text), info = byUid(REF.info);
    if (!rb || !rl || !rt0) return;
    const blur = rt.objects['9patch3'].createInstance(rl.layer.name, rl.x, rl.y + STEP);
    blur.width = rl.width; blur.height = rl.height; blur.opacity = 0;
    const back = rt.objects['9patch3'].createInstance(rb.layer.name, rb.x, rb.y + STEP);
    back.width = rb.width; back.height = rb.height; back.opacity = 0;
    const text = rt.objects.Text.createInstance(rt0.layer.name, rt0.x, rt0.y + STEP);
    text.fontFace = rt0.fontFace; text.sizePt = rt0.sizePt; text.fontColor = rt0.fontColor;
    text.horizontalAlign = 'center'; text.verticalAlign = 'top';
    text.width = rt0.width; text.height = rt0.height; text.opacity = 0;
    text.changeIconSet(rt.objects.Sprite443);
    // same layer order as the game buttons (the blur effect sits above them on the UI (Blur) layer)
    blur.moveAdjacentToInstance(rl, true);
    back.moveAdjacentToInstance(rb, true);
    text.moveAdjacentToInstance(rt0, true);
    ui = { back, blur, text, W: rb.width, H: rb.height, infoY: info ? info.y : 0, label: '', pressAt: 0, hover: false };
    if (info) info.y = ui.infoY + STEP;
    cache = { n: -1, at: 0 };
  }

  function tick() {
    if (!ui) return;
    const now = performance.now();
    if (cache.n < 0 || now - cache.at > 500) { try { cache = { n: plan().send.length, at: now }; } catch { cache = { n: 0, at: now }; } }
    const n = cache.n;
    const label = '[iconoffsety=5][icon=Vacantion] ' + tr('btn') +
      '\n[font=SofiaSansExtraCondensed-Light][szie=22][opacity=85]' + tr('need', n);
    if (label !== ui.label) { ui.label = label; ui.text.text = label; }
    // only in MY EMPLOYEES when the company has employees; opacity follows the screen title
    // (the game buttons hide when the shown person is on vacation – ours stays)
    const title = byUid(REF.title);
    let any = false;
    try { any = (arr('ArrayMyEmployees').width | 0) > 0; } catch { }
    const vis = String(gv.EmployeesType) === 'MY EMPLOYEES' && any && !!title && title.isVisible;
    const a = vis ? title.opacity : 0;
    stopTweens(ui.back); stopTweens(ui.blur); stopTweens(ui.text);
    const pt = ui.pressAt ? (now - ui.pressAt) / 1000 : 1;
    const k = pt < 0.075 ? 1 - 0.05 * (pt / 0.075) : pt < 0.25 ? 0.95 + 0.05 * ((pt - 0.075) / 0.175) : 1;
    ui.back.width = ui.W * k; ui.back.height = ui.H * k;
    ui.blur.width = ui.W * k; ui.blur.height = ui.H * k;
    ui.blur.isVisible = vis; ui.back.isVisible = vis; ui.text.isVisible = vis;
    ui.blur.opacity = a;
    ui.back.opacity = a * (0.3 + (ui.hover && n > 0 ? 0.12 : 0));
    ui.text.opacity = a * (n > 0 ? 1 : 0.55);
  }

  // ── input: our button; the click does not reach the game (it would also start the game's vacation) ─
  function hitBox(inst, x, y) {
    const b = inst.getBoundingBox();
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  }
  function hit(e) {
    if (!ui || layoutName() !== LAYOUT || !ui.text.isVisible || ui.text.opacity < 0.05) return false;
    const [x, y] = ui.back.layer.cssPxToLayer(e.clientX, e.clientY);
    return hitBox(ui.back, x, y);
  }
  let swallow = false;
  function onDown(e) {
    try {
      if (!hit(e)) return;
      if (String(gv.EditorNotification) !== 'OFF') return;       // the click closes the game notification
      e.stopImmediatePropagation(); e.preventDefault();
      swallow = true;
      ui.pressAt = performance.now();
      sendTired();
    } catch (err) { console.warn('[vacation-tools] onDown', err); }
  }
  function onOther(e) {
    if (!swallow) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.type === 'click' || e.type === 'pointercancel') swallow = false;
  }
  function onMove(e) { if (ui) { try { ui.hover = hit(e); } catch { } } }
  const OTHER = ['pointerup', 'mousedown', 'mouseup', 'click', 'pointercancel'];
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, true);
  for (const t of OTHER) window.addEventListener(t, onOther, true);

  function onLayoutStart() { ui = null; if (layoutName() === LAYOUT) setup(); }
  const onLayoutEnd = () => { ui = null; };
  rt.addEventListener('afteranylayoutstart', onLayoutStart);
  rt.addEventListener('beforeanylayoutend', onLayoutEnd);
  rt.addEventListener('tick', tick);
  if (layoutName() === LAYOUT) setup();

  globalThis.__dtVacationTools = {
    dispose() {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      for (const t of OTHER) window.removeEventListener(t, onOther, true);
      rt.removeEventListener('afteranylayoutstart', onLayoutStart);
      rt.removeEventListener('beforeanylayoutend', onLayoutEnd);
      rt.removeEventListener('tick', tick);
      if (layoutName() === LAYOUT) teardown();
      ui = null;
    },
    get state() { return { ui: !!ui, plan: plan() }; },
    debug: { plan, sendTired },
  };
});
