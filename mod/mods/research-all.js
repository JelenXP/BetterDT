// Research all – RESEARCH screen (research lab).
//
// Two buttons in the top bar of the research page, in the look of the game's own "Research all" button
// (which the game shows only in sandbox mode, where research is free):
//   RESEARCH TAB  – researches everything still open on the tab shown on the left (e.g. all of GPU),
//   RESEARCH ALL  – researches everything still open on all tabs.
// A button is greyed out and cannot be clicked when nothing is left or when the research points or the
// money are not enough for all of it. Hovering shows the price, and a click first asks with the price.
//
// The game does the research itself: every level is a click on the research card (the same as with the
// mouse), so the price check, the tax deduction, paying, the new level and refreshing the page are all the
// game's code. The list of what "everything" means is the game's own (debugResearchAllTargets, the list of the
// sandbox button), and other tabs are opened the way the game opens them. The mod only clicks, a few hundred
// levels per frame, with the sounds muted, and plays one sound at the end. If the game rejects a click, it stops.
// If a game update shows the game's own "Research all" outside sandbox mode too, the mod's buttons step aside.
BetterDTKit.mod('research-all', {
  needs: {
    functions: ['debugResearchAllTargets'],
    objects: ['ArrayResearchPage_Temp', 'ArrayMyResearch', 'ArrayResearch', 'ArrayLanguage', '9patch3'],
    vars: ['MiniPage', 'ResearchCoins', 'Budget', 'Sounds', 'SandboxMode', 'WheelScrollRate'],
    arrays: { ArrayResearch: [100, 3] },
  },
  texts: { 14008: 'Research all', 10974: "You don't have enough funds" },
}, (rt, kit) => {
  if (globalThis.__dtResearchAll) globalThis.__dtResearchAll.dispose();

  const LAYOUT = 'RESEARCH';
  const gv = rt.globalVars;

  // ── texts (language order as in the game: ArrayLanguage row = LanguageChoose) ──────────────────
  const TXT = {
    tab: ['Research tab', 'Исследовать вкладку', 'Tab erforschen', "Rechercher l'onglet", 'Ricerca scheda',
      'Investigar pestaña', 'टैब पर शोध करें', 'Sekmeyi araştır', 'Pesquisar aba', 'Дослідити вкладку',
      'Riset tab', 'Zbadaj kartę', '研究此页', '탭 연구', 'タブを研究'],
    cost: ['Price: {rp} research points and {usd}', 'Цена: {rp} очков исследований и {usd}',
      'Preis: {rp} Forschungspunkte und {usd}', 'Prix : {rp} points de recherche et {usd}',
      'Prezzo: {rp} punti ricerca e {usd}', 'Precio: {rp} puntos de investigación y {usd}',
      'कीमत: {rp} रिसर्च पॉइंट्स और {usd}', 'Fiyat: {rp} araştırma puanı ve {usd}',
      'Preço: {rp} pontos de pesquisa e {usd}', 'Ціна: {rp} очок досліджень і {usd}',
      'Harga: {rp} poin riset dan {usd}', 'Cena: {rp} punktów badań i {usd}',
      '价格：{rp} 研究点数和 {usd}', '가격: 연구 포인트 {rp}와 {usd}', '価格：研究ポイント {rp} と {usd}'],
    askTab: ['Research everything on this tab?', 'Исследовать всё на этой вкладке?', 'Alles auf diesem Tab erforschen?',
      'Rechercher tout cet onglet ?', 'Ricercare tutto in questa scheda?', '¿Investigar todo en esta pestaña?',
      'इस टैब पर सब कुछ शोध करें?', 'Bu sekmedeki her şey araştırılsın mı?', 'Pesquisar tudo nesta aba?',
      'Дослідити все на цій вкладці?', 'Riset semua di tab ini?', 'Zbadać wszystko na tej karcie?',
      '研究此页的全部内容？', '이 탭의 모든 항목을 연구할까요?', 'このタブをすべて研究しますか？'],
    askAll: ['Research everything?', 'Исследовать всё?', 'Alles erforschen?', 'Tout rechercher ?', 'Ricercare tutto?',
      '¿Investigar todo?', 'सब कुछ शोध करें?', 'Her şey araştırılsın mı?', 'Pesquisar tudo?', 'Дослідити все?',
      'Riset semuanya?', 'Zbadać wszystko?', '研究全部内容？', '모두 연구할까요?', 'すべて研究しますか？'],
    levels: ['{n} research levels', 'Уровней исследований: {n}', '{n} Forschungsstufen', '{n} niveaux de recherche',
      '{n} livelli di ricerca', '{n} niveles de investigación', '{n} शोध स्तर', '{n} araştırma seviyesi',
      '{n} níveis de pesquisa', 'Рівнів досліджень: {n}', '{n} level riset', 'Poziomów badań: {n}',
      '{n} 个研究等级', '연구 레벨 {n}개', '研究レベル {n}'],
    cancel: ['Cancel', 'Отмена', 'Abbrechen', 'Annuler', 'Annulla', 'Cancelar', 'रद्द करें', 'İptal', 'Cancelar',
      'Скасувати', 'Batal', 'Anuluj', '取消', '취소', 'キャンセル'],
  };
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const tr = (key, v = {}) => String(TXT[key][lang()] || TXT[key][0]).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  const arr = (name) => rt.objects[name].getFirstInstance();
  const gameText = (idx) => kit.text(idx);
  const LANG_RESEARCH_ALL = 14008, LANG_NO_FUNDS = 10974;   // the game's own texts
  const num = (v) => Math.round(v).toLocaleString('en-US').replace(/,/g, ' ');
  const layoutName = () => { try { return rt.layout.name; } catch { return ''; } };
  const log = (...a) => (globalThis.BetterDT ? BetterDT.log : console.log)('[research-all]', ...a);

  // ── what is left and what it costs ─────────────────────────────────────────────────────────────
  // ArrayResearch (id, 1) = research points per level, (id, 2) = money per level (the card shows the same).
  // ArrayMyResearch (id, 0) = current level.
  function price(targets) {
    const my = arr('ArrayMyResearch'), ar = arr('ArrayResearch');
    let levels = 0, rp = 0, usd = 0;
    for (const [id, to] of targets) {
      const n = to - (Number(my.getAt(id, 0)) || 0);
      if (n <= 0) continue;
      levels += n;
      rp += n * (Number(ar.getAt(id, 1)) || 0);
      usd += n * (Number(ar.getAt(id, 2)) || 0);
    }
    return { levels, rp, usd };
  }
  // the tab shown: ArrayResearchPage_Temp (x = card: 0 id, 1 title, 3 max level, 4 status, 0 = can be researched)
  const empty = (v) => v == null || v === 0 || v === '0' || v === '';
  function tabTargets() {
    const t = arr('ArrayResearchPage_Temp'), m = new Map();
    for (let x = 0; x < (t.width | 0); x++) {
      if (!empty(t.getAt(x, 4)) || empty(t.getAt(x, 1))) continue;
      m.set(Number(t.getAt(x, 0)), Number(t.getAt(x, 3)) || 0);
    }
    return m;
  }
  // all tabs: the game's own list for its sandbox button (it logs, so its console line is left out)
  function allTargets() {
    const orig = console.log;
    console.log = () => { };
    try { return globalThis.debugResearchAllTargets(); } finally { console.log = orig; }
  }
  // the tabs on the left: 9patch3 on "RESEARCH UI (Back)", instance variable CountryID = page (MiniPage)
  function pages() {
    return rt.objects['9patch3'].getAllInstances()
      .filter(i => i.layer && i.layer.name === 'RESEARCH UI (Back)' && i.isVisible)
      .map(i => Number(i.instVars.CountryID)).filter(p => p > 0).sort((a, b) => a - b);
  }

  // ── game UI helpers ────────────────────────────────────────────────────────────────────────────
  const call = (fn) => { try { rt.callFunction(fn); } catch (e) { log(fn, e); } };
  const nextTick = () => new Promise(res => {
    const h = () => { rt.removeEventListener('tick', h); res(); };
    rt.addEventListener('tick', h);
  });
  const root = () => document.querySelector('#research-root');
  // open a tab like a click on it does (event sheet "RESEARCH UI [Engine]")
  function showPage(p) {
    gv.WheelScrollRate = 0;
    gv.MiniPage = p;
    call('Research_ButtonsOpacity');
    call('ResearchPage');
  }
  // a category filter (icons in the top bar) hides cards; turn it off like a click on the active icon does
  function clearFilter() {
    const c = document.querySelector('#research-cats .rc-cat.rc-cat-active');
    if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
  const card = (id) => document.querySelector(`#research-grid .rc-card.rc-active[data-rid="${id}"]`);

  // ── buttons ────────────────────────────────────────────────────────────────────────────────────
  // Their CSS is copied from the game's #research-all rules, so they look the same even if the game changes them.
  const FALLBACK_CSS = `
.bdt-ra { margin-left: auto; flex: 0 0 auto; height: calc(var(--rs, 1) * 40px); padding: 0 calc(var(--rs, 1) * 18px);
  border-radius: calc(var(--rs, 1) * 11px); align-items: center; justify-content: center;
  background: linear-gradient(0deg, #319552 0%, #5cad53 55%, #8cc260 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.40), inset 0 calc(var(--rs, 1) * -2px) 0 rgba(0,0,0,0.14);
  font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; font-size: calc(var(--rs, 1) * 20px);
  letter-spacing: calc(var(--rs, 1) * 0.6px); line-height: 1; white-space: nowrap; cursor: pointer;
  transition: transform 0.14s ease, filter 0.14s ease, opacity 0.14s ease; }
.bdt-ra-label { transform: translateY(1px); }
.bdt-ra:hover { filter: brightness(1.08); transform: translateY(calc(var(--rs, 1) * -1px)); }
.bdt-ra.rc-all-empty { background: rgba(0,0,0,0.26); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14);
  color: rgba(255,255,255,0.55); filter: none; transform: none; }`;
  function css() {
    if (document.getElementById('bdt-research-all-css')) return;
    const game = document.getElementById('research-system-css');
    let rules = '';
    if (game) {
      const m = game.textContent.match(/#research-all(?:-label)?(?::hover|\.rc-all-empty)?\s*\{[^}]*\}/g) || [];
      rules = m.map(r => r.replace(/#research-all-label/g, '.bdt-ra-label').replace(/#research-all/g, '.bdt-ra')).join('\n');
    }
    if (!/\.bdt-ra\s*\{/.test(rules)) rules = FALLBACK_CSS;
    const s = document.createElement('style');
    s.id = 'bdt-research-all-css';
    s.textContent = rules + `
.bdt-ra { display: flex; }
.bdt-ra + .bdt-ra { margin-left: 0; }
.bdt-ra.rc-all-empty { cursor: default; }
.bdt-ra.bdt-busy { pointer-events: none; }
#research-root.bdt-ra-on #research-hide-wrap { margin-left: 0; }`;
    document.head.appendChild(s);
  }

  let ui = null, running = false, timer = 0;
  function button(kind) {
    const b = document.createElement('div');
    b.className = 'bdt-ra';
    b.innerHTML = '<span class="bdt-ra-label"></span>';
    b.addEventListener('click', kit.guard(() => {
      if (running || b.classList.contains('rc-all-empty')) return;
      globalThis.tapMain?.();
      confirm(kind, b.querySelector('.bdt-ra-label').textContent);
    }));
    return b;
  }
  // ask first, with the price (BetterDT dialog in the look of the game's news window)
  function confirm(kind, label) {
    const p = price(kind === 'tab' ? tabTargets() : allTargets());
    if (!p.levels) return refresh();
    const title = tr(kind === 'tab' ? 'askTab' : 'askAll');
    const text = tr('cost', { rp: num(p.rp), usd: '$' + num(p.usd) });
    const go = () => { setTimeout(() => start(kind)); };
    const api = globalThis.BetterDTUI;   // from betterdt-settings.js
    if (!api || typeof api.dialog !== 'function') {
      if (window.confirm(title + '\n' + text)) go();
      return;
    }
    api.dialog(title, text, [
      { label: tr('cancel'), cb: () => { } },
      { label, go: true, cb: go },
    ], (c) => {
      const h = document.createElement('div');
      h.className = 'bdt-hint';
      h.textContent = tr('levels', { n: num(p.levels) });
      c.appendChild(h);
    });
  }
  function setup() {
    const r = root(), bar = r && r.querySelector('#research-topbar');
    if (!bar) return false;
    if (ui && ui.bar === bar && ui.tab.isConnected) return true;
    css();
    ui = { bar, tab: button('tab'), all: button('all') };
    bar.insertBefore(ui.all, bar.querySelector('#research-hide-wrap'));
    bar.insertBefore(ui.tab, ui.all);
    r.classList.add('bdt-ra-on');
    return true;
  }
  function teardown() {
    if (!ui) return;
    ui.tab.remove();
    ui.all.remove();
    root()?.classList.remove('bdt-ra-on');
    ui = null;
  }
  function paint(b, label, p) {
    b.querySelector('.bdt-ra-label').textContent = label;
    const ok = p.levels > 0 && (Number(gv.ResearchCoins) || 0) >= p.rp && (Number(gv.Budget) || 0) >= p.usd;
    b.classList.toggle('rc-all-empty', !ok);
    b.title = p.levels > 0
      ? tr('cost', { rp: num(p.rp), usd: '$' + num(p.usd) }) + (ok ? '' : '\n' + gameText(LANG_NO_FUNDS))
      : '';
  }
  function refresh() {
    if (running) return;
    // the game has its own (free) button in sandbox mode
    if (layoutName() !== LAYOUT || Number(gv.SandboxMode) === 1) return teardown();
    // the game's tables are not loaded (yet): no prices, no texts
    if ((arr('ArrayResearch').width | 0) < 100 || (arr('ArrayLanguage').height | 0) <= 1) return teardown();
    // a game update shows its own button outside sandbox mode too
    const own = document.getElementById('research-all');
    if (own && own.offsetParent !== null) return teardown();
    if (!setup()) return;
    try {
      paint(ui.tab, tr('tab'), price(tabTargets()));
      paint(ui.all, gameText(LANG_RESEARCH_ALL) || 'Research all', price(allTargets()));
    } catch (e) { log('refresh failed', e); teardown(); }
  }

  // ── research ───────────────────────────────────────────────────────────────────────────────────
  async function start(kind) {
    const targets = kind === 'tab' ? tabTargets() : allTargets();
    const p = price(targets);
    if (!p.levels || gv.ResearchCoins < p.rp || gv.Budget < p.usd) return refresh();
    running = true;
    const btn = ui[kind], label = btn.querySelector('.bdt-ra-label'), text = label.textContent;
    btn.classList.add('bdt-busy');
    const my = arr('ArrayMyResearch');
    const before = { rp: Number(gv.ResearchCoins), usd: Number(gv.Budget) };
    const startPage = Number(gv.MiniPage);
    const sounds = gv.Sounds;
    let done = 0, stop = '';
    await nextTick();                       // let the tap sound play
    gv.Sounds = 'OFF';
    try {
      clearFilter();
      const list = kind === 'tab' ? [startPage] : [startPage, ...pages().filter(x => x !== startPage)];
      let frame = performance.now();
      pageLoop:
      for (const page of list) {
        if (Number(gv.MiniPage) !== page) { showPage(page); clearFilter(); }
        const ids = [...document.querySelectorAll('#research-grid .rc-card.rc-active')]
          .map(e => Number(e.dataset.rid)).filter(i => targets.has(i));
        for (const id of ids) {
          for (;;) {
            if (layoutName() !== LAYOUT) { stop = 'left the research screen'; break pageLoop; }
            const lvl = Number(my.getAt(id, 0)) || 0;
            const c = lvl < targets.get(id) && card(id);
            if (!c) break;
            c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            if (Number(my.getAt(id, 0)) !== lvl + 1) { stop = 'the game did not research id ' + id; break pageLoop; }
            done++;
            if (performance.now() - frame > 30) {
              label.textContent = Math.floor(100 * done / p.levels) + ' %';
              await nextTick();
              frame = performance.now();
            }
          }
          targets.delete(id);
        }
        if (!targets.size) break;
      }
      if (Number(gv.MiniPage) !== startPage && layoutName() === LAYOUT) showPage(startPage);
    } catch (e) {
      stop = String(e);
    } finally {
      gv.Sounds = sounds;
      label.textContent = text;
      btn.classList.remove('bdt-busy');
      running = false;
    }
    const paid = { rp: before.rp - Number(gv.ResearchCoins), usd: before.usd - Number(gv.Budget) };
    log(kind, 'researched', done, 'of', p.levels, 'levels, paid', paid.rp, 'RP and $' + paid.usd,
      '(expected', p.rp, 'RP and $' + p.usd + ')', stop ? '– stopped: ' + stop : '');
    // everything researched but a different price: the game's price columns have changed, stop offering it
    if (done === p.levels && (Math.abs(paid.rp - p.rp) > 1 + p.rp * 0.01 || Math.abs(paid.usd - p.usd) > 1 + p.usd * 0.01)) {
      return kit.fail(`price mismatch: paid ${paid.rp} RP / $${paid.usd}, expected ${p.rp} RP / $${p.usd}`);
    }
    if (stop && stop.startsWith('the game did not research')) kit.warn(stop);
    if (done) globalThis.researchSound?.();
    refresh();
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────────────────────────
  const refreshSafe = kit.guard(refresh);
  timer = setInterval(refreshSafe, 400);
  refreshSafe();

  const dispose = () => { clearInterval(timer); teardown(); document.getElementById('bdt-research-all-css')?.remove(); };
  globalThis.__dtResearchAll = { dispose };
  return dispose;
});
