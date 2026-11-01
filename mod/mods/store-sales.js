// Stores sell your devices – MY STORES (ArrayMyShops) earn a little on their own and a lot while you have new, good
// devices on sale.
//
// The game computes the stores of every country once a day (MyShopsEngine): customers, revenue (column 3), costs (4),
// the profit added to the month (31) and the price of a sold store (5). Right after it this mod sets the revenue so
// that the profit is (lib-store-sales-core.js): 20 % of the game's profit (or loss) when nothing new is on sale – the
// game's revenue grows almost with the square of the level, so upgraded stores were the best investment of the late
// game – plus 20 % for every unit of boost from the player's devices on sale: each one by its rating (nothing up to
// 5, boost 3 = 4× the profit at 9) and its popularity (full on release day, a tenth at 10 %); the best device counts
// fully, the second half, the third a quarter… More devices released in the whole game add up to 20 % to a profit
// (+12 % at 10).
// Fixes of the game: a sold store brings 35 % of its price and of its upgrades (the game paid 35 % of the price ×
// the number of stores in the country for each store, so 100 stores sold for 35× what they cost), and opening the
// stores menu no longer adds one more day of profit (the menu runs MyShopsEngine too; the mod adds the profit only
// in the daily run, before MyShopsEngine_AddDemand).
// Nothing is saved: without the mod the game computes the next day its own way.
const SS_L = (en, ru, de, fr, it, es, hi, tr, pt, uk, id, pl, zh, ko, ja) => [en, ru, de, fr, it, es, hi, tr, pt, uk, id, pl, zh, ko, ja];
BetterDTKit.mod('store-sales', {
  needs: {
    calls: ['MyShopsEngine', 'MyShopsEngine_AddDemand'],
    objects: ['ArrayMyShops', 'ArrayShops'],
    vars: ['DayTotal', 'LanguageChoose', 'class'],
    arrays: { ArrayMyShops: [1, 32], ArrayShops: [1, 1] },
    check: () => !globalThis.BDTStoreSalesCore ? 'lib-store-sales-core.js' : '',
  },
  uids: {
    10771: { layout: 'SHOPS MENU', t: 'Text', l: 'UI (Top)', w: 427, h: 92, x: 280, y: 503 },   // UPGRADE SHOPS
  },
}, (rt, kit) => {
  const TXT = {
    title: SS_L('YOUR DEVICES IN STORES', 'ВАШИ УСТРОЙСТВА В МАГАЗИНАХ', 'DEINE GERÄTE IN DEN LÄDEN', 'VOS APPAREILS EN MAGASIN',
      'I TUOI DISPOSITIVI NEI NEGOZI', 'TUS DISPOSITIVOS EN TIENDAS', 'स्टोर में आपके डिवाइस', 'MAĞAZALARDAKİ CİHAZLARINIZ',
      'SEUS APARELHOS NAS LOJAS', 'ВАШІ ПРИСТРОЇ В МАГАЗИНАХ', 'PERANGKATMU DI TOKO', 'TWOJE URZĄDZENIA W SKLEPACH',
      '门店中的你的设备', '매장의 내 기기', '店舗のあなたのデバイス'),
    mult: SS_L('Store profit ×{x}', 'Прибыль магазинов ×{x}', 'Ladengewinn ×{x}', 'Bénéfice des magasins ×{x}',
      'Profitto dei negozi ×{x}', 'Beneficio de las tiendas ×{x}', 'स्टोर मुनाफ़ा ×{x}', 'Mağaza kârı ×{x}', 'Lucro das lojas ×{x}',
      'Прибуток магазинів ×{x}', 'Laba toko ×{x}', 'Zysk sklepów ×{x}', '门店利润 ×{x}', '매장 수익 ×{x}', '店舗の利益 ×{x}'),
    best: SS_L('{name} · {rating}/10 · popularity {pop} %', '{name} · {rating}/10 · популярность {pop} %',
      '{name} · {rating}/10 · Beliebtheit {pop} %', '{name} · {rating}/10 · popularité {pop} %',
      '{name} · {rating}/10 · popolarità {pop} %', '{name} · {rating}/10 · popularidad {pop} %',
      '{name} · {rating}/10 · लोकप्रियता {pop} %', '{name} · {rating}/10 · popülerlik %{pop}',
      '{name} · {rating}/10 · popularidade {pop} %', '{name} · {rating}/10 · популярність {pop} %',
      '{name} · {rating}/10 · popularitas {pop} %', '{name} · {rating}/10 · popularność {pop} %',
      '{name} · {rating}/10 · 人气 {pop} %', '{name} · {rating}/10 · 인기 {pop} %', '{name} · {rating}/10 · 人気 {pop} %'),
    none: SS_L('No new good device on sale – the stores earn only a basic profit',
      'Нет новых хороших устройств в продаже – магазины приносят лишь базовую прибыль',
      'Kein neues gutes Gerät im Verkauf – die Läden bringen nur einen Grundgewinn',
      'Aucun bon appareil récent en vente – les magasins ne font qu’un bénéfice de base',
      'Nessun dispositivo nuovo e buono in vendita – i negozi danno solo un profitto di base',
      'Ningún dispositivo nuevo y bueno a la venta: las tiendas solo dan un beneficio básico',
      'बिक्री पर कोई नया अच्छा डिवाइस नहीं – स्टोर सिर्फ़ बुनियादी मुनाफ़ा कमाते हैं',
      'Satışta yeni ve iyi cihaz yok – mağazalar yalnızca temel kâr getirir',
      'Nenhum aparelho novo e bom à venda – as lojas dão só um lucro básico',
      'Немає нових хороших пристроїв у продажу – магазини дають лише базовий прибуток',
      'Tidak ada perangkat baru yang bagus dijual – toko hanya memberi laba dasar',
      'Brak nowego dobrego urządzenia w sprzedaży – sklepy dają tylko podstawowy zysk',
      '没有在售的优秀新设备 – 门店只有基础利润', '판매 중인 좋은 신제품이 없습니다 – 매장은 기본 수익만 냅니다',
      '販売中の良い新製品がありません – 店舗は基本の利益だけです'),
    exp: SS_L('Experience: {n} devices released, +{p} % profit', 'Опыт: выпущено устройств {n}, прибыль +{p} %',
      'Erfahrung: {n} Geräte veröffentlicht, +{p} % Gewinn', 'Expérience : {n} appareils sortis, +{p} % de bénéfice',
      'Esperienza: {n} dispositivi usciti, +{p} % di profitto', 'Experiencia: {n} dispositivos lanzados, +{p} % de beneficio',
      'अनुभव: {n} डिवाइस जारी, +{p} % मुनाफ़ा', 'Deneyim: {n} cihaz çıkarıldı, kâr +%{p}',
      'Experiência: {n} aparelhos lançados, +{p} % de lucro', 'Досвід: випущено пристроїв {n}, прибуток +{p} %',
      'Pengalaman: {n} perangkat dirilis, laba +{p} %', 'Doświadczenie: {n} wydanych urządzeń, +{p} % zysku',
      '经验：已发布 {n} 款设备，利润 +{p} %', '경험: 기기 {n}개 출시, 수익 +{p} %', '経験：{n} 台のデバイスを発売、利益 +{p} %'),
  };
  if (globalThis.__bdtStoreSales) globalThis.__bdtStoreSales.dispose();
  const C = BDTStoreSalesCore, gv = rt.globalVars;
  const COL = { LEVEL: 0, STORES: 1, REV: 3, EXP: 4, SELL: 5, MONTH: 31 };
  const DEV = { ID: 0, POP: 2, RATING: 5, RELEASE: 7, NAME: 8 };
  // the device types sold in stores (not the CPUs and GPUs sold to other companies)
  const DEVICES = ['ArraySmartphones', 'ArrayTablets', 'ArrayLaptops', 'ArrayWatches', 'ArrayHeadphones', 'ArrayTV',
    'ArrayScooters', 'ArrayKeyboards', 'ArrayConsoles', 'ArrayVRConsoles'];
  const arr = (name) => rt.objects[name] && rt.objects[name].getFirstInstance();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const today = () => Math.round(num(gv.DayTotal));

  // the player's released devices: { name, rating, pop, release }
  function devices() {
    const out = [], day = today();
    for (const n of DEVICES) {
      const a = arr(n);
      if (!a) continue;
      for (let x = 0; x < a.width; x++) for (let y = 0; y < Math.min(3, a.height); y++) {
        const id = Number(a.getAt(x, y, DEV.ID)), rel = Number(a.getAt(x, y, DEV.RELEASE));
        if (id === -1 || !Number.isFinite(id) || !(rel >= 0) || rel > day) continue;
        out.push({ key: n + ':' + x + ':' + y, name: String(a.getAt(x, y, DEV.NAME) || ''), rating: num(a.getAt(x, y, DEV.RATING)),
          pop: num(a.getAt(x, y, DEV.POP)), release: rel });
      }
    }
    return out;
  }
  let state = { day: -1, boost: 0, exp: 0, top: null, released: 0 };
  function refresh() {
    if (state.day === today()) return state;
    const list = devices(), selling = list.filter(d => d.pop > 0);
    const top = selling.slice().sort((a, b) => C.deviceBoost(b.rating, b.pop) - C.deviceBoost(a.rating, a.pop))[0] || null;
    state = { day: today(), boost: C.boost(selling), exp: C.experience(list.length), top: top && C.deviceBoost(top.rating, top.pop) >= 0.01 ? top : null,
      released: list.length, list };
    return state;
  }

  // ── the daily numbers of the stores ─────────────────────────────────────────────────────────────────────
  let month = null;
  function recompute() {
    const my = arr('ArrayMyShops'), shops = arr('ArrayShops');
    const s = refresh();
    for (let i = 0; i < my.width; i++) {
      if (!(num(my.getAt(i, COL.STORES)) > 0)) continue;
      const exp = num(my.getAt(i, COL.EXP));
      my.setAt(Math.max(0, Math.round(exp + C.profit(num(my.getAt(i, COL.REV)), exp, s.boost, s.exp))), i, COL.REV);
      my.setAt(C.sellValue(num(shops.getAt(i, 0)), num(my.getAt(i, COL.LEVEL))), i, COL.SELL);
      // the profit of the month stays as before the game's run; the daily run adds it (below)
      if (month && month.has(i)) my.setAt(month.get(i), i, COL.MONTH);
    }
  }
  const engineOk = kit.wrapCalls('MyShopsEngine', {
    before() {
      const my = arr('ArrayMyShops');
      month = new Map();
      for (let i = 0; i < my.width; i++) month.set(i, num(my.getAt(i, COL.MONTH)));
    },
    after() { try { recompute(); } finally { month = null; } },
  });
  // the daily run: MyShopsEngine, then MyShopsEngine_AddDemand (nothing else calls it) – the day's profit is added
  const demandOk = kit.wrapCalls('MyShopsEngine_AddDemand', {
    before() {
      const my = arr('ArrayMyShops');
      for (let i = 0; i < my.width; i++) {
        if (!(num(my.getAt(i, COL.STORES)) > 0)) continue;
        my.setAt(num(my.getAt(i, COL.MONTH)) + num(my.getAt(i, COL.REV)) - num(my.getAt(i, COL.EXP)), i, COL.MONTH);
      }
    },
  });
  if (!engineOk || !demandOk) return kit.fail('the store events have changed');
  kit.on('gameLoaded', () => { state.day = -1; });

  // ── MY STORES: a card under the four buttons with what the devices give ─────────────────────────────────
  const ui = kit.ui, SCREEN = 'SHOPS MENU', LAYER = 'UI (Top)', CARD = { x: 47, y: 596, w: 446 };
  const t = (key, v = {}) => {
    const l = Math.round(num(gv.LanguageChoose));
    return String(TXT[key][l >= 0 && l < 15 ? l : 0] || TXT[key][0]).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  };
  ui.css(`
.bdt-ss { position: fixed; z-index: 5; transform-origin: 0 0; display: none; box-sizing: border-box; width: ${CARD.w}px;
  padding: 16px 22px 18px; border-radius: 10px; background: rgba(28,36,58,.78); color: #fff; font: 24px/1.3 ${ui.font};
  pointer-events: none; }
.bdt-ss-title { font-size: 22px; letter-spacing: .04em; opacity: .7; margin-bottom: 6px; }
.bdt-ss-mult { font-size: 40px; line-height: 1.1; color: #AEF021; }
.bdt-ss-mult.base { color: #fff; font-size: 26px; line-height: 1.25; }
.bdt-ss-line { margin-top: 6px; opacity: .9; }
.bdt-ss-exp { margin-top: 6px; font-size: 21px; opacity: .65; }`);
  const card = ui.el('div', { className: 'bdt-ss' });
  const title = ui.el('div', { className: 'bdt-ss-title' }, card), mult = ui.el('div', { className: 'bdt-ss-mult' }, card);
  const best = ui.el('div', { className: 'bdt-ss-line' }, card), expLine = ui.el('div', { className: 'bdt-ss-exp' }, card);
  const set = (el, txt) => { if (el.textContent !== txt) el.textContent = txt; el.style.display = txt ? '' : 'none'; };
  const fmt = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
  kit.on('tick', () => {
    let l = null;
    try { l = String(gv.class) === SCREEN && rt.layout.getLayer(LAYER); } catch { }
    const anchor = kit.inst(10771);
    if (!l || !anchor || !anchor.isVisible) { card.style.display = 'none'; return; }
    const s = refresh();
    const [x0, y0] = l.layerToCssPx(CARD.x, CARD.y), k = (l.layerToCssPx(CARD.x + 1000, CARD.y)[0] - x0) / 1000;
    Object.assign(card.style, { display: 'block', left: x0 + 'px', top: y0 + 'px', transform: `scale(${k.toFixed(4)})`,
      opacity: String(Math.max(0, Math.min(1, num(anchor.opacity)))) });
    set(title, t('title'));
    mult.classList.toggle('base', !s.top);
    set(mult, s.top ? t('mult', { x: fmt(1 + s.boost) }) : t('none'));
    set(best, s.top ? t('best', { name: s.top.name, rating: fmt(s.top.rating), pop: Math.round(s.top.pop) }) : '');
    set(expLine, s.exp > 0 ? t('exp', { n: s.released, p: Math.round(s.exp * 100) }) : '');
  });

  const dispose = () => { if (globalThis.__bdtStoreSales === api) delete globalThis.__bdtStoreSales; };
  const api = { dispose, refresh, recompute, get state() { return state; } };
  globalThis.__bdtStoreSales = api;
  return dispose;
});
