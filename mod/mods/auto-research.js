// Auto research – RESEARCH screen (research lab) and every game day.
//
// Every research card (a researched one too: the game may offer more levels later) gets an "Auto" box in its top
// right corner, and the top bar an "Auto: whole tab" box that ticks
// or unticks all the cards of the tab shown (only the cards of the category picked in the top bar, if one is). A
// ticked card is researched by itself: once a game day (and right when it is ticked) every level the game offers now
// is bought, when the research points and the money are enough. The game offers a new level of a part when the part
// comes to the market (the same levels as the game's own buttons research), never one researched ahead by a lab
// breakthrough. Recommended cards are bought first, then the cheaper ones, one level of each card per round.
// When the points or the money are not enough, the level is tried again 5 game days later; when it is still not
// enough, the mod gives it up with a message saying what was missing. The card stays ticked, and when the game
// offers a new level of it, everything missing is tried again the same way.
// BetterDT settings: a money reserve (the mod buys nothing that would leave less money; default $0) and the messages
// (one for each day with automatic research, one for each level given up).
// In sandbox mode (research is free) the ticked cards get every level at once, at no cost, like the game's own button.
//
// The research itself is the game's: the game's function ResearchEngine researches the card in ResearchEngineID
// (the level, the price, everything that comes with the new level), the same as after a click on the card; it works
// on every screen. Like the click, the price is deducted from the month's taxable profit: written to the tax table
// and read back by the game's reloadTaxesFromArray (the tax table holds the month's revenue and profit; the
// breakdown it does not hold only feeds the game's debug output, and a loaded save starts without it too).
// The levels offered are the game's own list (debugResearchAllTargets), and so are the recommended cards
// (debugResearchCategoryFlags). If the game takes a different price than its research table says, the mod stops.
//
// The ticked cards are kept in BetterDT settings for each company (a hash of its name: two saves of one company
// share them); the card names for the messages are remembered from the research screen (browser storage).
BetterDTKit.mod('auto-research', {
  needs: {
    functions: ['debugResearchAllTargets', 'debugResearchCategoryFlags', 'reloadTaxesFromArray'],
    calls: ['ResearchEngine'],
    objects: ['ArrayMyResearch', 'ArrayResearch', 'ArrayTaxes', 'ArrayLanguage'],
    vars: ['ResearchCoins', 'Budget', 'ResearchEngineID', 'SandboxMode', 'DayTotal', 'LanguageChoose', 'CompanyName', 'MiniPage'],
    arrays: { ArrayResearch: [100, 3] },
    check: () => !globalThis.BDTAutoResearchCore ? 'lib-auto-research-core.js' : '',
  },
}, (rt, kit) => {
  if (globalThis.__dtAutoResearch) globalThis.__dtAutoResearch.dispose();
  const C = BDTAutoResearchCore, S = BetterDT.settings, gv = rt.globalVars;
  const TAX_BASE = 1;   // ArrayTaxes (0, 1): the month's taxable profit (the game's T2.BASE)

  // ── texts (language order as in the game: ArrayLanguage row = LanguageChoose) ──────────────────
  const TXT = {
    auto: ['Auto', 'Авто', 'Auto', 'Auto', 'Auto', 'Auto', 'ऑटो', 'Oto', 'Auto', 'Авто', 'Oto', 'Auto', '自动', '자동', '自動'],
    tab: ['Auto: whole tab', 'Авто: вся вкладка', 'Auto: ganzer Tab', 'Auto : tout l’onglet', 'Auto: tutta la scheda',
      'Auto: toda la pestaña', 'ऑटो: पूरा टैब', 'Oto: tüm sekme', 'Auto: aba inteira', 'Авто: уся вкладка', 'Oto: seluruh tab',
      'Auto: cała karta', '自动：整页', '자동: 탭 전체', '自動：タブ全体'],
    cardTip: ['Research new levels automatically, as soon as the game offers them',
      'Исследовать новые уровни автоматически, как только игра их предложит',
      'Neue Stufen automatisch erforschen, sobald das Spiel sie anbietet',
      'Rechercher automatiquement les nouveaux niveaux dès que le jeu les propose',
      'Ricerca automaticamente i nuovi livelli appena il gioco li offre',
      'Investigar automáticamente los niveles nuevos en cuanto el juego los ofrezca',
      'गेम के उपलब्ध कराते ही नए स्तरों पर अपने-आप शोध करें',
      'Yeni seviyeleri oyun sunar sunmaz otomatik araştır',
      'Pesquisar novos níveis automaticamente assim que o jogo os oferecer',
      'Досліджувати нові рівні автоматично, щойно гра їх запропонує',
      'Riset level baru secara otomatis begitu game menawarkannya',
      'Badaj nowe poziomy automatycznie, gdy tylko gra je zaoferuje',
      '游戏一提供新等级就自动研究',
      '게임이 새 레벨을 제공하면 바로 자동으로 연구',
      'ゲームが新しいレベルを出したらすぐ自動で研究'],
    tabTip: ['Tick or untick automatic research for all cards on this tab',
      'Включить или выключить автоисследование для всех карточек этой вкладки',
      'Automatische Forschung für alle Karten dieses Tabs ein- oder ausschalten',
      'Activer ou désactiver la recherche automatique pour toutes les cartes de cet onglet',
      'Attiva o disattiva la ricerca automatica per tutte le schede di questa pagina',
      'Activar o desactivar la investigación automática de todas las tarjetas de esta pestaña',
      'इस टैब के सभी कार्ड के लिए ऑटो शोध चालू या बंद करें',
      'Bu sekmedeki tüm kartlar için otomatik araştırmayı aç veya kapat',
      'Ativar ou desativar a pesquisa automática de todos os cartões desta aba',
      'Увімкнути або вимкнути автодослідження для всіх карток цієї вкладки',
      'Nyalakan atau matikan riset otomatis untuk semua kartu di tab ini',
      'Włącz lub wyłącz automatyczne badania dla wszystkich kart tej karty',
      '为本页所有卡片开启或关闭自动研究',
      '이 탭의 모든 카드에 대해 자동 연구를 켜거나 끕니다',
      'このタブのすべてのカードの自動研究をオン／オフ'],
    gaveTip: ['Given up for now: not enough research points or money. Tried again when the game offers a new level.',
      'Пока отложено: не хватило очков исследований или денег. Новая попытка, когда игра предложит новый уровень.',
      'Vorerst aufgegeben: zu wenig Forschungspunkte oder Geld. Neuer Versuch, wenn das Spiel eine neue Stufe anbietet.',
      'Abandonné pour l’instant : pas assez de points de recherche ou d’argent. Nouvel essai quand le jeu propose un nouveau niveau.',
      'Rinunciato per ora: punti ricerca o denaro insufficienti. Nuovo tentativo quando il gioco offre un nuovo livello.',
      'Abandonado por ahora: no hay suficientes puntos de investigación o dinero. Se reintenta cuando el juego ofrezca un nivel nuevo.',
      'अभी के लिए छोड़ा: रिसर्च पॉइंट्स या पैसे कम थे। गेम के नया स्तर देने पर फिर कोशिश होगी।',
      'Şimdilik bırakıldı: araştırma puanı veya para yetmedi. Oyun yeni seviye sunduğunda tekrar denenir.',
      'Desistido por enquanto: pontos de pesquisa ou dinheiro insuficientes. Nova tentativa quando o jogo oferecer um novo nível.',
      'Поки відкладено: не вистачило очок досліджень або грошей. Нова спроба, коли гра запропонує новий рівень.',
      'Ditunda dulu: poin riset atau uang tidak cukup. Dicoba lagi saat game menawarkan level baru.',
      'Na razie odpuszczone: za mało punktów badań lub pieniędzy. Ponowna próba, gdy gra zaoferuje nowy poziom.',
      '暂时放弃：研究点数或资金不足。游戏提供新等级时再试。',
      '일단 포기: 연구 포인트나 돈이 부족했습니다. 게임이 새 레벨을 제공하면 다시 시도합니다.',
      'いったん見送り：研究ポイントかお金が足りませんでした。新しいレベルが出たら再挑戦します。'],
    bought: ['Auto research, levels bought: {n} ({rp} research points, {usd})', 'Автоисследование: уровней {n} ({rp} очков исследований, {usd})',
      'Auto-Forschung, gekaufte Stufen: {n} ({rp} Forschungspunkte, {usd})', 'Recherche auto, niveaux achetés : {n} ({rp} points de recherche, {usd})',
      'Ricerca automatica, livelli acquistati: {n} ({rp} punti ricerca, {usd})', 'Investigación automática, niveles comprados: {n} ({rp} puntos de investigación, {usd})',
      'ऑटो शोध: {n} स्तर ({rp} रिसर्च पॉइंट्स, {usd})', 'Otomatik araştırma: {n} seviye ({rp} araştırma puanı, {usd})',
      'Pesquisa automática, níveis comprados: {n} ({rp} pontos de pesquisa, {usd})', 'Автодослідження: рівнів {n} ({rp} очок досліджень, {usd})',
      'Riset otomatis: {n} level ({rp} poin riset, {usd})', 'Automatyczne badania: poziomów {n} ({rp} punktów badań, {usd})',
      '自动研究：{n} 个等级（{rp} 研究点数，{usd}）', '자동 연구: {n}개 레벨 (연구 포인트 {rp}, {usd})', '自動研究：{n} レベル（研究ポイント {rp}、{usd}）'],
    gave: ['Auto research gave up {name} level {lvl}: missing {what}', 'Автоисследование отложило {name}, уровень {lvl}: не хватает {what}',
      'Auto-Forschung gibt {name} Stufe {lvl} auf: es fehlen {what}', 'La recherche auto abandonne {name} niveau {lvl} : il manque {what}',
      'La ricerca automatica rinuncia a {name} livello {lvl}: mancano {what}', 'La investigación automática abandona {name} nivel {lvl}: faltan {what}',
      'ऑटो शोध ने {name} स्तर {lvl} छोड़ा: कमी {what}', 'Otomatik araştırma {name} seviye {lvl} bıraktı: eksik {what}',
      'A pesquisa automática desistiu de {name} nível {lvl}: faltam {what}', 'Автодослідження відклало {name}, рівень {lvl}: бракує {what}',
      'Riset otomatis menunda {name} level {lvl}: kurang {what}', 'Automatyczne badania odpuściły {name} poziom {lvl}: brakuje {what}',
      '自动研究放弃了 {name} 第 {lvl} 级：缺少 {what}', '자동 연구가 {name} 레벨 {lvl}을(를) 포기: 부족 {what}', '自動研究が {name} レベル {lvl} を見送り：不足 {what}'],
    rp: ['{n} research points', '{n} очков исследований', '{n} Forschungspunkte', '{n} points de recherche', '{n} punti ricerca',
      '{n} puntos de investigación', '{n} रिसर्च पॉइंट्स', '{n} araştırma puanı', '{n} pontos de pesquisa', '{n} очок досліджень',
      '{n} poin riset', '{n} punktów badań', '{n} 研究点数', '연구 포인트 {n}', '研究ポイント {n}'],
    reserve: ['money above the reserve', 'денег сверх резерва', 'Geld über der Reserve', 'de l’argent au-delà de la réserve',
      'denaro oltre la riserva', 'dinero por encima de la reserva', 'रिज़र्व से ऊपर पैसा', 'rezerv üstünde para', 'dinheiro acima da reserva',
      'грошей понад резерв', 'uang di atas cadangan', 'pieniędzy ponad rezerwę', '储备之外的资金', '예비금 이상의 돈', '予備資金を超えるお金'],
    card: ['research {id}', 'исследование {id}', 'Forschung {id}', 'recherche {id}', 'ricerca {id}', 'investigación {id}', 'शोध {id}',
      'araştırma {id}', 'pesquisa {id}', 'дослідження {id}', 'riset {id}', 'badanie {id}', '研究 {id}', '연구 {id}', '研究 {id}'],
  };
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const tr = (key, v = {}) => String(TXT[key][lang()] || TXT[key][0]).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  const num = (v) => Math.round(v).toLocaleString('en-US').replace(/,/g, ' ');
  const usd = (v) => {
    const a = Math.abs(v);
    for (const [d, s] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) if (a >= d) return '$' + +(v / d).toFixed(a >= 100 * d ? 0 : 1) + s;
    return '$' + Math.round(v);
  };
  const arr = (name) => rt.objects[name].getFirstInstance();
  const layoutName = () => { try { return rt.layout.name; } catch { return ''; } };
  const log = (...a) => (globalThis.BetterDT ? BetterDT.log : console.log)('[auto-research]', ...a);
  const today = () => Number(gv.DayTotal) || 0;
  const level = (id) => Number(arr('ArrayMyResearch').getAt(id, 0)) || 0;
  const cost = (id) => { const a = arr('ArrayResearch'); return { rp: Number(a.getAt(id, 1)) || 0, usd: Number(a.getAt(id, 2)) || 0 }; };
  const free = () => Number(gv.SandboxMode) === 1;
  // the game's debug functions log what they return: their console line is left out
  function quiet(fn) {
    const orig = console.log;
    console.log = () => { };
    try { return fn(); } finally { console.log = orig; }
  }
  const targets = () => quiet(() => globalThis.debugResearchAllTargets());
  function recommended() {
    const out = new Set();
    for (const ids of Object.values(quiet(() => globalThis.debugResearchCategoryFlags()) || {})) for (const id of ids) out.add(Number(id));
    return out;
  }

  // ── card names for the messages (remembered from the research screen, per language) ─────────────
  const NAMES_KEY = 'bdt-auto-research-names';
  let names = {};
  try { names = JSON.parse(localStorage.getItem(NAMES_KEY) || '{}') || {}; } catch { names = {}; }
  let namesDirty = false;
  function rememberName(id, name) {
    const k = lang() + ':' + id;
    if (name && names[k] !== name) { names[k] = name; namesDirty = true; }
  }
  const nameOf = (id) => names[lang() + ':' + id] || tr('card', { id });
  function saveNames() {
    if (!namesDirty) return;
    namesDirty = false;
    try { localStorage.setItem(NAMES_KEY, JSON.stringify(names)); } catch { }
  }

  // ── the ticked cards of the company ────────────────────────────────────────────────────────────
  let cards = new Map(), key = '', saveTimer = 0;
  function load() {
    key = C.companyKey(kit.game.company.name);
    const n = S.num(key + '.n', 0), chunks = [];
    for (let i = 0; i < n; i++) chunks.push(String(S.get(key + '.' + i, '')));
    cards = C.decode(chunks);
    log('company', key, cards.size, 'ticked cards');
  }
  function save() {
    clearTimeout(saveTimer);
    if (!key) return;
    const k = key;
    saveTimer = setTimeout(kit.guard(() => {
      const chunks = C.encode(cards), old = S.num(k + '.n', 0);
      const set = (kk, v) => Promise.resolve(S.set(kk, v)).catch(e => console.error('[auto-research] save', kk, e));
      chunks.forEach((c, i) => { if (String(S.get(k + '.' + i, '')) !== c) set(k + '.' + i, c); });
      for (let i = chunks.length; i < old; i++) set(k + '.' + i, '');
      if (old !== chunks.length) set(k + '.n', chunks.length);
    }), 300);
  }

  // ── research ───────────────────────────────────────────────────────────────────────────────────
  // what would get in the way: no game, our Research all clicking, a click of the player the game still handles
  function blocked() {
    if (!(today() > 0) || !key) return 'no game';
    if (globalThis.__dtResearchAll && globalThis.__dtResearchAll.running) return 'research all';
    if (document.querySelector('#research-grid .rc-card.rc-busy')) return 'a click';
    return '';
  }
  function run(only) {
    const why = blocked();
    if (why) return why;
    const isFree = free();
    const r = C.plan(cards, {
      today: today(), targets: targets(), level, cost, rp: Number(gv.ResearchCoins) || 0, money: Number(gv.Budget) || 0,
      reserve: Math.max(0, S.num('auto-research.reserve', 0)), free: isFree, recommended: recommended(), only,
    });
    // Several levels of one card the way the game's own Research tab buys them: all but the last one set and paid
    // here, the last one researched by the game (one ResearchEngine run per card keeps a whole tab quick).
    const count = new Map();
    for (const id of r.buys) count.set(id, (count.get(id) || 0) + 1);
    let done = 0, paidRp = 0, paidUsd = 0, stop = '', mismatch = '';
    for (const [id, n] of count) {
      const lvl = level(id), rp = Number(gv.ResearchCoins), money = Number(gv.Budget), c = cost(id);
      if (n > 1) {
        arr('ArrayMyResearch').setAt(lvl + n - 1, id, 0, 0);
        gv.ResearchCoins = rp - (n - 1) * c.rp;
        gv.Budget = money - (n - 1) * c.usd;
      }
      const lastRp = Number(gv.ResearchCoins), lastMoney = Number(gv.Budget);
      gv.ResearchEngineID = id;
      rt.callFunction('ResearchEngine');
      if (level(id) !== lvl + n) {
        // the game did not take it: the levels set here go back too
        arr('ArrayMyResearch').setAt(lvl, id, 0, 0);
        gv.ResearchCoins = rp; gv.Budget = money;
        stop = 'the game did not research id ' + id;
        break;
      }
      done += n;
      if (isFree) { gv.ResearchCoins = rp; gv.Budget = money; continue; }   // free, like the game's sandbox button
      paidRp += rp - Number(gv.ResearchCoins); paidUsd += money - Number(gv.Budget);
      const pr = lastRp - Number(gv.ResearchCoins), pu = lastMoney - Number(gv.Budget);
      if (!mismatch && (Math.abs(pr - c.rp) > 1 + c.rp * 0.01 || Math.abs(pu - c.usd) > 1 + c.usd * 0.01)) {
        mismatch = `price mismatch for id ${id}: paid ${pr} RP / $${pu}, expected ${c.rp} RP / $${c.usd}`;
      }
    }
    if (paidUsd > 0) deductTax(paidUsd);
    if (done && layoutName() === 'RESEARCH') refreshPage();
    if (r.buys.length || r.gaveUp.length) {
      log('researched', done, 'of', r.buys.length, 'levels, paid', paidRp, 'RP and $' + paidUsd,
        r.gaveUp.length ? '– gave up ' + r.gaveUp.map(g => g.id + '@' + g.level).join(' ') : '', stop ? '– stopped: ' + stop : '');
    }
    save();
    if (mismatch) return kit.fail(mismatch);
    if (stop) kit.warn(stop);
    if (S.bool('auto-research.notify', true)) {
      if (done) kit.ui.toast(tr('bought', { n: done, rp: num(paidRp), usd: usd(paidUsd) }), { type: 'good' });
      for (const g of r.gaveUp) {
        const what = [g.rp > 0 && tr('rp', { n: num(g.rp) }), g.usd > 0 && usd(g.usd), g.reserve && tr('reserve')].filter(Boolean).join(' + ');
        kit.ui.toast(tr('gave', { name: nameOf(g.id), lvl: g.level, what }), { type: 'bad', ms: 7000 });
      }
    }
    return '';
  }
  // the price is taxable profit no more, the same as the game's taxAccrueOther(0, price) after a click
  function deductTax(paid) {
    const t = arr('ArrayTaxes');
    globalThis.getTaxSnapshot?.();   // the game's ledger is read and written to the table first
    t.setAt(Math.round((Number(t.getAt(0, TAX_BASE)) || 0) - paid), 0, TAX_BASE);
    globalThis.reloadTaxesFromArray();
  }
  // the research screen shows the new levels: the tab drawn again the way a click on it draws it
  function refreshPage() {
    try { rt.callFunction('ResearchPage'); } catch (e) { log('ResearchPage', e); }
    try { globalThis.updateResearchCategoryFlags?.(); } catch { }
    try { globalThis.updateResearchPage?.(); } catch { }
  }

  // ── the boxes on the research screen ───────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.id = 'bdt-auto-research-css';
  css.textContent = `
.bdt-ar { position: absolute; top: calc(var(--rs, 1) * 9px); right: calc(var(--rs, 1) * 10px); z-index: 3;
  display: flex; align-items: center; gap: calc(var(--rs, 1) * 6px); height: calc(var(--rs, 1) * 23px);
  padding: 0 calc(var(--rs, 1) * 8px) 0 calc(var(--rs, 1) * 6px); border-radius: calc(var(--rs, 1) * 8px);
  background: rgba(0,0,0,0.26); color: rgba(255,255,255,0.78); cursor: pointer;
  font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; font-size: calc(var(--rs, 1) * 16px);
  letter-spacing: calc(var(--rs, 1) * 0.6px); line-height: 1; white-space: nowrap; transition: background 0.15s ease, color 0.15s ease; }
.bdt-ar:hover { background: rgba(0,0,0,0.40); color: #fff; }
.bdt-ar > span { transform: translateY(1px); }
.bdt-ar-box { position: relative; flex: 0 0 auto; width: calc(var(--rs, 1) * 16px); height: calc(var(--rs, 1) * 16px);
  border-radius: calc(var(--rs, 1) * 5px); background: rgba(255,255,255,0.12); box-shadow: inset 0 0 0 2px rgba(255,255,255,0.55);
  transition: background 0.15s ease, box-shadow 0.15s ease; }
.bdt-ar-on .bdt-ar-box { background: linear-gradient(135deg, #2fae4d, #a8d43c); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.45); }
.bdt-ar-on.bdt-ar-gave .bdt-ar-box { background: linear-gradient(135deg, #c98a1c, #e8b23a); }
.bdt-ar-on .bdt-ar-box::after { content: ""; position: absolute; left: 32%; top: 10%; width: 26%; height: 52%;
  border: solid #fff; border-width: 0 calc(var(--rs, 1) * 2.5px) calc(var(--rs, 1) * 2.5px) 0; transform: rotate(45deg); }
#research-grid .rc-card.bdt-ar-card { box-shadow: inset 0 0 0 2px rgba(168,212,60,0.70), inset 0 1px 0 rgba(255,255,255,0.30); }
.bdt-ar-tab { display: flex; flex: 0 0 auto; align-items: center; gap: calc(var(--rs, 1) * 10px); cursor: pointer;
  margin-left: calc(var(--rs, 1) * 14px); padding: calc(var(--rs, 1) * 6px) calc(var(--rs, 1) * 2px); }
.bdt-ar-tab .bdt-ar-box { width: calc(var(--rs, 1) * 24px); height: calc(var(--rs, 1) * 24px); border-radius: calc(var(--rs, 1) * 7px); }
.bdt-ar-tab:hover .bdt-ar-box { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.9); }
.bdt-ar-tab.bdt-ar-on .bdt-ar-box::after { border-width: 0 calc(var(--rs, 1) * 3px) calc(var(--rs, 1) * 3px) 0; }
.bdt-ar-tab > span { font-size: calc(var(--rs, 1) * 19px); color: rgba(255,255,255,0.92); letter-spacing: calc(var(--rs, 1) * 0.6px);
  line-height: 1; white-space: nowrap; transform: translateY(1px); }
#research-root.bdt-ar-tab-on #research-hide-wrap { margin-left: calc(var(--rs, 1) * 14px); }`;
  document.head.appendChild(css);

  const gridCards = () => [...document.querySelectorAll('#research-grid .rc-card[data-rid]')];
  function box(cls) {
    const b = document.createElement('div');
    b.className = cls;
    b.innerHTML = '<div class="bdt-ar-box"></div><span></span>';
    return b;
  }
  function tick(ids, on) {
    const added = new Set();
    for (const id of ids) {
      if (on && !cards.has(id)) { cards.set(id, {}); added.add(id); }
      if (!on) cards.delete(id);
    }
    save();
    decorate();
    if (added.size) {
      const why = run(added);
      if (why) log('research later:', why);
      decorate();
    }
  }
  function decorate() {
    if (!document.querySelector('#research-grid')) return;
    for (const c of gridCards()) {
      const id = Number(c.dataset.rid);
      rememberName(id, (c.querySelector('.rc-title-inner') || {}).textContent?.trim());
      let b = c.querySelector(':scope > .bdt-ar');
      if (!b) {
        b = box('bdt-ar');
        // a click on the box ticks it and does not research the card
        b.addEventListener('click', kit.guard((e) => {
          e.stopPropagation();
          globalThis.tapMain?.();
          tick([id], !cards.has(id));
        }));
        c.appendChild(b);
      }
      const s = cards.get(id), gave = !!(s && s.gave !== undefined);
      const label = tr('auto'), title = tr('cardTip') + (gave ? '\n' + tr('gaveTip') : '');
      if (b.lastChild.textContent !== label) b.lastChild.textContent = label;
      if (b.title !== title) b.title = title;
      b.classList.toggle('bdt-ar-on', !!s);
      b.classList.toggle('bdt-ar-gave', gave);
      c.classList.toggle('bdt-ar-card', !!s);
    }
    saveNames();
    topBox();
  }
  let tab = null;
  function topBox() {
    const bar = document.getElementById('research-topbar'), root = document.getElementById('research-root');
    if (!bar || !root) return;
    if (!tab || !tab.isConnected || tab.parentNode !== bar) {
      tab?.remove();
      tab = box('bdt-ar-tab');
      tab.addEventListener('click', kit.guard(() => {
        const ids = gridCards().map(c => Number(c.dataset.rid));
        if (!ids.length) return;
        globalThis.tapMain?.();
        tick(ids, !ids.every(id => cards.has(id)));
      }));
      bar.insertBefore(tab, bar.querySelector('#research-hide-wrap'));
      root.classList.add('bdt-ar-tab-on');
    }
    const ids = gridCards().map(c => Number(c.dataset.rid));
    const label = tr('tab'), title = tr('tabTip');
    if (tab.lastChild.textContent !== label) tab.lastChild.textContent = label;
    if (tab.title !== title) tab.title = title;
    tab.classList.toggle('bdt-ar-on', ids.length > 0 && ids.every(id => cards.has(id)));
    tab.style.display = ids.length ? '' : 'none';
  }
  function undecorate() {
    for (const b of document.querySelectorAll('.bdt-ar, .bdt-ar-tab')) b.remove();
    for (const c of document.querySelectorAll('.bdt-ar-card')) c.classList.remove('bdt-ar-card');
    document.getElementById('research-root')?.classList.remove('bdt-ar-tab-on');
    tab = null;
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────────────────────────
  let due = false;
  kit.on('gameLoaded', () => { load(); due = true; });
  kit.on('gameClosed', () => { clearTimeout(saveTimer); cards = new Map(); key = ''; });
  kit.on('day', () => { due = true; });
  // once a game day, and the next frame again while something is in the way
  kit.on('tick', () => { if (due && !blocked()) { due = false; run(); } });
  // at once when the game draws the cards (before the frame is painted), and now and then for a new level
  const obs = new MutationObserver(kit.guard(() => { if (document.querySelector('#research-grid')) decorate(); }));
  obs.observe(document.body, { childList: true, subtree: true });
  const timer = setInterval(kit.guard(decorate), 500);

  const dispose = () => { obs.disconnect(); clearInterval(timer); clearTimeout(saveTimer); undecorate(); css.remove(); delete globalThis.__dtAutoResearch; };
  globalThis.__dtAutoResearch = { dispose, run, get cards() { return cards; }, get key() { return key; } };
  kit.onStop(dispose);
  return dispose;
});
