// Store upgrades for all stores – MY STORES screen (SHOPS UPGRADE).
//
// The game upgrades the stores of one country at a time: pick the country on the left, then "PAY ALL" (all six
// areas) or the price button of one area. Since game 1.5 its "UPGRADE ALL" button in the top bar does one round
// ("PAY ALL" once in every country, only when all of it is affordable). Next to it, in the same look:
//   ALL TO MAX – "PAY ALL" in every country, round after round, while the money lasts; when no full round is
//                affordable any more, the cheapest single areas are bought with the rest.
//                A click first asks, with the money it will spend (a dry run of the same rounds).
//
// Every upgrade is a click on the game's own "PAY ALL" or area button (the same as with the mouse), so the price
// check, paying, the random gains, the store level and the demand are the game's code. The mod only picks the
// country (MiniPage, as a click on the country does) and clicks. The price is computed with the game's formula
// before every click; when the money taken differs, the mod stops (the game has changed its prices). Sounds are
// muted during the batch and one plays at the end. The game handles a click synchronously, so a frame takes many.
BetterDTKit.mod('store-upgrade-all', {
  needs: {
    objects: ['ArrayMyShops', 'ArrayShops', 'ArrayMyPerks', 'ArrayCountries', 'ArrayLanguage', 'Text', '9patch5', 'MyHTML_UpgradeShops'],
    vars: ['Budget', 'MiniPage', 'Sounds', 'EditorNotification', 'EditorNotificationText', 'LanguageChoose'],
    arrays: { ArrayMyShops: [1, 30], ArrayShops: [1, 1], ArrayMyPerks: [12, 1] },
  },
  texts: { 10974: "You don't have enough funds" },
  uids: {
    21430: { layout: 'SHOPS UPGRADE', t: 'Text', l: 'GLOBAL UI (Top)', w: 652, h: 98, x: 1830, y: 22 },      // money
    22270: { layout: 'SHOPS UPGRADE', t: '9patch5', l: 'GLOBAL UI (Touched)', w: 340, h: 64, x: 1670, y: 990 },   // PAY ALL
    22262: { layout: 'SHOPS UPGRADE', t: '9patch3', l: 'GLOBAL UI (Back)', w: 420, h: 248, x: 1240, y: 270 },  // staff
    22263: { layout: 'SHOPS UPGRADE', t: '9patch3', l: 'GLOBAL UI (Back)', w: 420, h: 248, x: 1670, y: 270 },  // logistics
    22264: { layout: 'SHOPS UPGRADE', t: '9patch3', l: 'GLOBAL UI (Back)', w: 420, h: 248, x: 1240, y: 530 },  // infrastructure
    22265: { layout: 'SHOPS UPGRADE', t: '9patch3', l: 'GLOBAL UI (Back)', w: 420, h: 248, x: 1670, y: 530 },  // technologies
    22266: { layout: 'SHOPS UPGRADE', t: '9patch3', l: 'GLOBAL UI (Back)', w: 420, h: 248, x: 1240, y: 790 },  // management
    22267: { layout: 'SHOPS UPGRADE', t: '9patch3', l: 'GLOBAL UI (Back)', w: 420, h: 248, x: 1670, y: 790 },  // safety
  },
}, (rt, kit) => {
  if (globalThis.__dtStoreUpgradeAll) globalThis.__dtStoreUpgradeAll.dispose();

  const LAYOUT = 'SHOPS UPGRADE';
  const gv = rt.globalVars;
  const UID = { money: 21430, payAll: 22270, areas: [22262, 22263, 22264, 22265, 22266, 22267] };
  const LANG_NO_FUNDS = 10974;
  const MAX_UPGRADES = 300000;   // a safety stop for huge (sandbox) budgets: about two minutes of clicking

  // ── texts (language order as in the game: ArrayLanguage row = LanguageChoose) ──────────────────
  const TXT = {
    max: ['ALL TO MAX', 'ВСЁ НА МАКСИМУМ', 'ALLES AUFS MAXIMUM', 'TOUT AU MAXIMUM', 'TUTTO AL MASSIMO', 'TODO AL MÁXIMO',
      'सब अधिकतम तक', 'HEPSİ MAKSİMUMA', 'TUDO NO MÁXIMO', 'УСЕ НА МАКСИМУМ', 'SEMUA KE MAKSIMAL', 'WSZYSTKO NA MAKSA',
      '全部升到最高', '모두 최대로', 'すべて最大まで'],
    ask: ['Upgrade all stores to the max?', 'Улучшить все магазины до максимума?', 'Alle Läden aufs Maximum verbessern?',
      'Améliorer tous les magasins au maximum ?', 'Migliorare tutti i negozi al massimo?', '¿Mejorar todas las tiendas al máximo?',
      'सभी स्टोर को अधिकतम तक अपग्रेड करें?', 'Tüm mağazalar maksimuma geliştirilsin mi?', 'Melhorar todas as lojas ao máximo?',
      'Покращити всі магазини до максимуму?', 'Tingkatkan semua toko sampai maksimal?', 'Ulepszyć wszystkie sklepy na maksa?',
      '将所有门店升到最高？', '모든 매장을 최대로 업그레이드할까요?', '全店舗を最大までアップグレードしますか？'],
    askText: ['Every store is upgraded again and again, as long as your money lasts.',
      'Все магазины улучшаются снова и снова, пока хватает денег.',
      'Alle Läden werden immer wieder verbessert, solange das Geld reicht.',
      'Tous les magasins sont améliorés encore et encore, tant que l’argent suffit.',
      'Tutti i negozi vengono migliorati più volte, finché bastano i soldi.',
      'Todas las tiendas se mejoran una y otra vez mientras alcance el dinero.',
      'जब तक पैसे हैं, सभी स्टोर बार-बार अपग्रेड होते रहेंगे।',
      'Para yettiği sürece tüm mağazalar tekrar tekrar geliştirilir.',
      'Todas as lojas são melhoradas várias vezes, enquanto houver dinheiro.',
      'Усі магазини покращуються знову і знову, поки вистачає грошей.',
      'Semua toko ditingkatkan berulang kali selama uang masih cukup.',
      'Wszystkie sklepy są ulepszane raz za razem, dopóki starcza pieniędzy.',
      '只要资金足够，所有门店会被反复升级。', '돈이 허락하는 한 모든 매장을 계속 업그레이드합니다.',
      '資金が続く限り、全店舗を繰り返しアップグレードします。'],
    spend: ['This spends about {usd} of your {have}.', 'Будет потрачено около {usd} из {have}.',
      'Das kostet etwa {usd} von deinen {have}.', 'Cela dépense environ {usd} sur vos {have}.',
      'Spende circa {usd} dei tuoi {have}.', 'Gasta unos {usd} de tus {have}.',
      'इसमें आपके {have} में से लगभग {usd} खर्च होंगे।', '{have} paranızın yaklaşık {usd} kadarı harcanır.',
      'Isso gasta cerca de {usd} dos seus {have}.', 'Буде витрачено близько {usd} із {have}.',
      'Ini menghabiskan sekitar {usd} dari {have} milikmu.', 'Wyda to około {usd} z twoich {have}.',
      '将花费约 {usd}（你有 {have}）。', '보유한 {have} 중 약 {usd}를 사용합니다.', '所持金 {have} のうち約 {usd} を使います。'],
    done: ['Upgrades bought: {n}', 'Куплено улучшений: {n}', 'Gekaufte Verbesserungen: {n}', 'Améliorations achetées : {n}',
      'Miglioramenti acquistati: {n}', 'Mejoras compradas: {n}', 'खरीदे गए अपग्रेड: {n}', 'Satın alınan geliştirmeler: {n}',
      'Melhorias compradas: {n}', 'Куплено покращень: {n}', 'Peningkatan dibeli: {n}', 'Kupione ulepszenia: {n}',
      '已购买升级：{n}', '구매한 업그레이드: {n}', '購入したアップグレード：{n}'],
    cancel: ['Cancel', 'Отмена', 'Abbrechen', 'Annuler', 'Annulla', 'Cancelar', 'रद्द करें', 'İptal', 'Cancelar',
      'Скасувати', 'Batal', 'Anuluj', '取消', '취소', 'キャンセル'],
  };
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const tr = (key, v = {}) => String(TXT[key][lang()] || TXT[key][0]).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  const arr = (name) => rt.objects[name].getFirstInstance();
  const layoutName = () => { try { return rt.layout.name; } catch { return ''; } };
  const log = (...a) => (globalThis.BetterDT ? BetterDT.log : console.log)('[store-upgrade-all]', ...a);
  const num = (v) => Math.round(v).toLocaleString('en-US').replace(/,/g, ' ');
  // the game's short money format: $964.2 K
  function short(v) {
    const a = Math.abs(v);
    const [d, s] = a >= 1e12 ? [1e12, ' T'] : a >= 1e9 ? [1e9, ' B'] : a >= 1e6 ? [1e6, ' M'] : a >= 1e3 ? [1e3, ' K'] : [1, ''];
    return '$' + +(v / d).toFixed(2) + s;
  }

  // ── prices (the game's formula, "SHOP UPGRADE [Engine]") ───────────────────────────────────────────
  // ArrayMyShops (country, 1) = stores, (country, 0) = level, (country, 6..29) = 6 areas × 4 qualities.
  // ArrayShops (country, 0) = base price, ArrayMyPerks (11, 0) = the perk that takes 10 % off.
  const AREA_COL = [6, 10, 14, 18, 22, 26];
  function data() {
    const my = arr('ArrayMyShops'), shops = arr('ArrayShops'), perk = Number(arr('ArrayMyPerks').getAt(11, 0)) || 0;
    const list = [];
    for (let i = 0; i < (my.width | 0); i++) if (Number(my.getAt(i, 1)) > 0) list.push(i);
    return { my, shops, perk, list };
  }
  const areaPrice = (base, stores, perk, q) =>
    Math.round(Math.ceil(base * (5 + Math.sqrt((q[0] + q[1] + q[2] + q[3]) / 4)) / 100) * stores * (1 - perk * 0.1));
  // live prices of one country
  function livePrices(d, i) {
    const base = Number(d.shops.getAt(i, 0)), stores = Number(d.my.getAt(i, 1));
    return AREA_COL.map(c => areaPrice(base, stores, d.perk, [0, 1, 2, 3].map(k => Number(d.my.getAt(i, c + k)) || 0)));
  }
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  // once: every country's PAY ALL; min: the cheapest single area (below it nothing can be bought)
  function oncePrice() {
    const d = data();
    let usd = 0, min = Infinity;
    for (const i of d.list) for (const p of livePrices(d, i)) { usd += p; min = Math.min(min, p); }
    return { n: d.list.length, usd, min };
  }

  // ── the "to the max" rounds, the same for the dry run and the real one ─────────────────────────
  // m = { budget(), prices(i), payAll(i, price), area(i, k, price) } – the last two return false to stop
  async function rounds(list, m, pause) {
    let n = 0;
    for (;;) {
      let any = false;
      for (const i of list) {
        const p = sum(m.prices(i));
        if (p > m.budget()) continue;
        if (!(await m.payAll(i, p))) return n;
        n += 6; any = true;
        if (pause) await pause(n);
        if (n >= MAX_UPGRADES) return n;
      }
      if (!any) break;
    }
    // no full round left: the cheapest single areas with the rest
    for (;;) {
      let best = null;
      for (const i of list) m.prices(i).forEach((p, k) => { if (!best || p < best.p) best = { i, k, p }; });
      if (!best || best.p > m.budget()) break;
      if (!(await m.area(best.i, best.k, best.p))) return n;
      n++;
      if (pause) await pause(n);
      if (n >= MAX_UPGRADES) return n;
    }
    return n;
  }
  // gains of one bought area, as the game rolls them (choose(0,1,2) or round(random(1,2)) after a zero)
  function roll() {
    const choose = () => Math.floor(Math.random() * 3), one = () => Math.round(1 + Math.random());
    const s1 = choose(), s2 = s1 <= 0 ? choose() : one(), s3 = s2 <= 0 ? one() : choose(), s4 = s3 <= 0 ? one() : choose();
    return [s1, s2, s3, s4];
  }
  // dry run on a copy of the tables: what "to the max" will about spend, and the store levels after it
  function dryRun() {
    const d = data(), q = new Map();
    for (const i of d.list) q.set(i, Array.from({ length: 24 }, (_, k) => Number(d.my.getAt(i, 6 + k)) || 0));
    let budget = Number(gv.Budget) || 0;
    const start = budget;
    const prices = (i) => {
      const base = Number(d.shops.getAt(i, 0)), stores = Number(d.my.getAt(i, 1)), v = q.get(i);
      return AREA_COL.map((c, k) => areaPrice(base, stores, d.perk, v.slice(4 * k, 4 * k + 4)));
    };
    const buy = (i, k) => { const v = q.get(i), g = roll(); for (let j = 0; j < 4; j++) v[4 * k + j] += g[j]; };
    let n = 0;
    // synchronous: rounds() awaits only plain values here
    const m = {
      budget: () => budget,
      prices,
      payAll: (i, p) => { for (let k = 0; k < 6; k++) buy(i, k); budget -= p; return true; },
      area: (i, k, p) => { buy(i, k); budget -= p; return true; },
    };
    return rounds(d.list, m, null).then((upgrades) => {
      n = upgrades;
      const levels = d.list.map(i => ({ name: String(arrCountry(i)), from: Number(d.my.getAt(i, 0)) || 0, to: Math.round(sum(q.get(i)) / 24) }));
      return { spent: start - budget, have: start, upgrades: n, levels };
    });
  }
  const arrCountry = (i) => { try { return arr('ArrayCountries').getAt(i, 0); } catch { return '#' + i; } };

  // ── game UI helpers ────────────────────────────────────────────────────────────────────────────
  const call = (fn) => { try { rt.callFunction(fn); } catch (e) { log(fn, e); } };
  function notify(text, error) {
    gv.EditorNotification = 'ON';
    gv.EditorNotificationText = text;
    call('EditorNotification_ON');
    if (error) call('ErrorSound');
  }
  const nextTick = () => new Promise(res => {
    const h = () => { rt.removeEventListener('tick', h); res(); };
    rt.addEventListener('tick', h);
  });

  // click like the mouse (the game reacts to Mouse "On object clicked"; it handles the click synchronously)
  let synthetic = false, pointer = null;   // pointer = the player's last mouse position (css px)
  function dispatchAt(x, y, down) {
    const canvas = document.querySelector('canvas');
    const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse',
      isPrimary: true, button: 0, buttons: 1, view: window };
    synthetic = true;
    try {
      canvas.dispatchEvent(new PointerEvent('pointermove', { ...o, buttons: 0 }));
      if (!down) return;
      canvas.dispatchEvent(new PointerEvent('pointerdown', o));
      canvas.dispatchEvent(new MouseEvent('mousedown', o));
      canvas.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
      canvas.dispatchEvent(new MouseEvent('mouseup', { ...o, buttons: 0 }));
      canvas.dispatchEvent(new MouseEvent('click', { ...o, buttons: 0 }));
    } finally { synthetic = false; }
  }
  function clickInst(inst) {
    const [x, y] = inst.layer.layerToCssPx(inst.x, inst.y);
    dispatchAt(x, y, true);
  }
  // the clicks moved the game's mouse: put it back where the player's is (hover looks)
  function restorePointer() { if (pointer) dispatchAt(pointer[0], pointer[1], false); }

  // one click on a game button for country i; true when the game took exactly the expected money
  let mismatch = '';
  function buy(inst, i, price, what) {
    gv.MiniPage = i;
    const before = Number(gv.Budget);
    clickInst(inst);
    const paid = before - Number(gv.Budget);
    if (Math.abs(paid - price) <= 0.5) return true;
    if (paid === 0) kit.warn(`a click on ${what} did nothing`);
    else mismatch = `${what} in country ${i}: paid ${paid}, expected ${price}`;
    return false;
  }

  // ── our button: the look of the game's "UPGRADE ALL" (MyHTML_UpgradeShops), right next to it ─────────
  const HTML_OBJ = 'MyHTML_UpgradeShops';
  const GAME_X = 960, BOX_X = 880;   // the game's button moves a little to the left, ours goes to its right
  let ui = null, running = false, stopReq = false, progress = 0;

  function injectCss() {
    if (document.getElementById('bdt-sam-style')) return;
    const st = document.createElement('style');
    st.id = 'bdt-sam-style';
    // the game's #usa-* rules, for our own ids
    st.textContent = `
#bdt-sam-root { position: absolute; left: calc(100% + 1.5vh); top: 0; height: 100%; width: 64%; container-type: size;
  display: flex; align-items: center; justify-content: center; pointer-events: none; }
/* shown and hidden together with the game's button: the same classes and keyframes, no frame later */
#bdt-sam-btn { opacity: 0; pointer-events: none; }
#usa-root.usa-shown ~ #bdt-sam-root #bdt-sam-btn { animation: usa-in 0.42s cubic-bezier(0.2, 1.35, 0.4, 1) forwards; pointer-events: auto; }
#usa-root.usa-ready ~ #bdt-sam-root #bdt-sam-btn { opacity: 1; transform: none; animation: none; }
#usa-root.usa-hiding ~ #bdt-sam-root #bdt-sam-btn { animation: usa-out 320ms cubic-bezier(0.5, 0, 0.75, 0) forwards; pointer-events: none; }
#usa-root.usa-shown:not(.usa-hiding) ~ #bdt-sam-root #bdt-sam-btn:active { transform: scale(0.96); }
/* it would cover the money in the top bar */
#bdt-sam-root.bdt-off { visibility: hidden; }
#bdt-sam-root.bdt-off #bdt-sam-btn { pointer-events: none; }
#bdt-sam-btn { box-sizing: border-box; width: 96%; height: 84%;
  display: flex; align-items: center; justify-content: center; gap: 4cqw; padding: 0 4cqw;
  border: none; border-radius: 99px; background: linear-gradient(175deg, #ffe27a, #f2b419);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 0 rgba(120,70,0,0.30), 0 4px 14px rgba(0,0,0,0.35);
  color: #241a04; font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; cursor: pointer; user-select: none;
  transition: transform 0.14s ease, filter 0.14s ease; }
#bdt-sam-btn:hover { filter: brightness(1.07); }
#bdt-sam-btn:active { transform: scale(0.96); }
#bdt-sam-btn.bdt-empty { filter: grayscale(0.85) brightness(0.8); cursor: default; }
#bdt-sam-label { font-size: 40cqh; line-height: 1; letter-spacing: 0.04em; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; min-width: 0; }
#bdt-sam-pct { flex: none; font-size: 36cqh; line-height: 1; padding: 12cqh 4.5cqw; border-radius: 99px;
  background: rgba(36,26,4,0.86); color: #ffe27a; white-space: nowrap; }
#bdt-sam-pct:empty { display: none; }
`;
    document.head.appendChild(st);
  }

  function teardown() {
    if (!ui) return;
    try { ui.root.remove(); } catch { }
    ui = null;
  }
  function setup() {
    teardown();
    if (!kit.inst(UID.payAll)) return;
    for (const u of UID.areas) kit.inst(u);   // look them up now, before the game's press animation resizes them
    let box = null, el = null;
    try { box = rt.objects[HTML_OBJ].getFirstInstance(); el = box.getElement(); } catch { }
    if (!el) return;
    box.x = BOX_X;
    injectCss();
    const root = document.createElement('div');
    root.id = 'bdt-sam-root';
    root.innerHTML = '<button id="bdt-sam-btn" type="button"><span id="bdt-sam-label"></span><span id="bdt-sam-pct"></span></button>';
    el.appendChild(root);
    const btn = root.querySelector('#bdt-sam-btn');
    btn.addEventListener('click', kit.guard((e) => {
      e.stopPropagation();
      if (String(gv.EditorNotification) !== 'OFF') return;
      if (running) { stopReq = true; return; }   // a click on the running batch stops it
      call('Tap_Main');
      if (btn.classList.contains('bdt-empty')) {
        // greyed out: say why, like the game does
        if (ui && ui.cache && ui.cache.n) notify(kit.text(LANG_NO_FUNDS), true);
        return;
      }
      askMax().catch(err => log(err));
    }));
    ui = { root, btn, label: root.querySelector('#bdt-sam-label'), pct: root.querySelector('#bdt-sam-pct'), cache: null, at: 0 };
    tick();                                        // the texts are there before the first frame
  }

  function tick() {
    if (!ui) return;
    const now = performance.now();
    if (!running && (!ui.cache || now - ui.at > 300)) { ui.cache = oncePrice(); ui.at = now; }
    const c = ui.cache, budget = Number(gv.Budget) || 0;
    const label = tr('max'), pct = running ? Math.min(99, Math.floor(100 * progress)) + ' %' : '';
    if (ui.label.textContent !== label) ui.label.textContent = label;
    if (ui.pct.textContent !== pct) ui.pct.textContent = pct;
    ui.btn.classList.toggle('bdt-empty', !running && !(c.n > 0 && c.min <= budget));
    // hidden when the money in the top bar would be covered (shown and hidden with the game's button by CSS)
    let on = true;
    const money = kit.inst(UID.money);
    if (money) {
      const left = money.layer.layerToCssPx(money.x - (money.textWidth || 300), money.y)[0];
      const r = ui.root.getBoundingClientRect(), canvas = document.querySelector('canvas').getBoundingClientRect();
      if (r.right - canvas.left > left - 8) on = false;
    }
    ui.root.classList.toggle('bdt-off', !on);
  }

  // ── batches ────────────────────────────────────────────────────────────────────────────────────
  async function batch(fn) {
    running = true; stopReq = false; mismatch = ''; progress = 0;
    const page0 = Number(gv.MiniPage), sounds = gv.Sounds, before = Number(gv.Budget);
    let n = 0;
    await nextTick();                       // let the tap sound play
    gv.Sounds = 'OFF';
    try { n = await fn(); } finally {
      gv.Sounds = sounds;
      running = false;
      if (layoutName() === LAYOUT) {
        gv.MiniPage = page0;
        call('ShopsUpgrade_ButtonsOpacity');   // the page of the country you had open, with the new numbers
        restorePointer();
      }
      if (ui) ui.cache = null;
    }
    const spent = before - Number(gv.Budget);
    log('bought', n, 'upgrades for $' + spent, mismatch ? '– stopped: ' + mismatch : '');
    if (mismatch) { kit.fail('price mismatch: ' + mismatch); return { n, spent }; }
    if (n) call('CashSound');
    return { n, spent };
  }

  async function askMax() {
    if (oncePrice().min > Number(gv.Budget)) return notify(kit.text(LANG_NO_FUNDS), true);
    const est = await dryRun();
    const go = () => setTimeout(() => upgradeMax(est.spent));
    const api = globalThis.BetterDTUI;   // from betterdt-settings.js
    const title = tr('ask'), spend = tr('spend', { usd: '$' + num(est.spent), have: '$' + num(est.have) });
    if (!api || typeof api.dialog !== 'function') { if (window.confirm(title + '\n' + spend)) go(); return; }
    const shown = api.dialog(title, tr('askText'), [
      { label: tr('cancel'), cb: () => { } },
      { label: tr('max'), go: true, cb: go },
    ], (box) => {
      const s = document.createElement('div');
      s.className = 'bdt-hint';
      s.style.opacity = '1';
      s.textContent = spend;
      box.appendChild(s);
      const l = document.createElement('div');
      l.className = 'bdt-hint';
      l.textContent = est.levels.slice(0, 8).map(r => `${r.name} ★${r.from} → ★${r.to}`).join('   ·   ') +
        (est.levels.length > 8 ? '   ·   …' : '');
      box.appendChild(l);
    });
    if (shown === null) log('another dialog is open');
  }

  function upgradeMax(expected) {
    if (running || layoutName() !== LAYOUT) return;
    batch(async () => {
      const d = data(), pay = kit.inst(UID.payAll), areas = UID.areas.map(u => kit.inst(u));
      const start = Number(gv.Budget);
      let frame = performance.now();
      const m = {
        budget: () => Number(gv.Budget),
        prices: (i) => livePrices(d, i),
        payAll: (i, p) => !stopReq && layoutName() === LAYOUT && buy(pay, i, p, 'PAY ALL'),
        area: (i, k, p) => !stopReq && layoutName() === LAYOUT && !!areas[k] && buy(areas[k], i, p, 'area ' + k),
      };
      // a frame takes clicks for about 25 ms; the button shows how far it is
      const pause = async () => {
        if (performance.now() - frame < 25) return;
        progress = expected > 0 ? (start - Number(gv.Budget)) / expected : 0;
        await nextTick();
        frame = performance.now();
      };
      return rounds(d.list, m, pause);
    }).then(async (r) => {
      if (!r || layoutName() !== LAYOUT || !r.n) return;
      await nextTick();   // the game updates its hover looks (put back by restorePointer) only without a message
      notify(tr('done', { n: '[color=#FFD800]' + num(r.n) + '[/color]' }) + '\n[color=#ff7a7a]−$' + num(r.spent) + '[/color]', false);
    }).catch(e => log(e));
  }

  // the player's mouse, to put the game's hover looks back after the clicks of a batch
  const onMove = (e) => { if (!synthetic) pointer = [e.clientX, e.clientY]; };
  window.addEventListener('pointermove', onMove, true);

  const onLayoutStart = kit.guard(() => { teardown(); if (layoutName() === LAYOUT) setup(); });
  // our button fades out with the game's one; the page removes both elements
  const onLayoutEnd = () => { ui = null; stopReq = true; };
  const onTick = kit.guard(tick);
  rt.addEventListener('afteranylayoutstart', onLayoutStart);
  rt.addEventListener('beforeanylayoutend', onLayoutEnd);
  rt.addEventListener('tick', onTick);
  if (layoutName() === LAYOUT) setup();

  const dispose = () => {
    window.removeEventListener('pointermove', onMove, true);
    rt.removeEventListener('afteranylayoutstart', onLayoutStart);
    rt.removeEventListener('beforeanylayoutend', onLayoutEnd);
    rt.removeEventListener('tick', onTick);
    stopReq = true;
    if (layoutName() === LAYOUT) {
      teardown();
      try { rt.objects[HTML_OBJ].getFirstInstance().x = GAME_X; } catch { }
    }
    ui = null;
  };
  globalThis.__dtStoreUpgradeAll = {
    dispose,
    get state() { return { running, ui: !!ui, prices: oncePrice() }; },
    debug: { dryRun, oncePrice, upgradeMax, askMax },
  };
  return dispose;
});
