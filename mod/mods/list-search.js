// Search and scroll bars – RESEARCH and INVESTING (company shares).
//
// RESEARCH: a search field at the start of the top bar finds research on all tabs, not only the open one. Results
// show the research and its tab; picking one opens the tab, scrolls the card into view and lights it up. The list of
// tabs on the left (31 of them, drawn by the game, wheel only) gets a scroll bar, and it no longer scrolls past its
// end (the game let it scroll up to 2960 px, so the list could disappear: "Research Menu Bug" on the forum).
// INVESTING STOCK: a search field in the header finds a company and opens it like a click on its card, and the list of
// 107 companies gets a scroll bar and stops at both ends (the game did not stop it at all).
// The scroll bars move the same layers the mouse wheel does; the research titles are read from the game's own cards,
// tab by tab, the first time the field is used on a visit (the game builds a tab's cards in one go).
BetterDTKit.mod('list-search', {
  needs: { objects: ['9patch3', 'Text'], vars: ['MiniPage', 'WheelScrollRate', 'EditorNotification', 'LanguageChoose'] },
}, (rt, kit) => {
  const gv = rt.globalVars;
  const TXT = {
    search: ['Search…', 'Поиск…', 'Suchen…', 'Rechercher…', 'Cerca…', 'Buscar…', 'खोजें…', 'Ara…', 'Pesquisar…', 'Пошук…',
      'Cari…', 'Szukaj…', '搜索…', '검색…', '検索…'],
    none: ['Nothing found', 'Ничего не найдено', 'Nichts gefunden', 'Aucun résultat', 'Nessun risultato', 'Sin resultados',
      'कुछ नहीं मिला', 'Sonuç yok', 'Nada encontrado', 'Нічого не знайдено', 'Tidak ditemukan', 'Nic nie znaleziono',
      '未找到', '결과 없음', '見つかりません'],
  };
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const tr = (k) => TXT[k][lang()] || TXT[k][0];
  const layoutName = () => { try { return rt.layout.name; } catch { return ''; } };
  const plain = (s) => String(s || '').split('\n')[0].replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').replace(/[\s•·]+$/, '').trim();
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const call = (fn) => { try { rt.callFunction(fn); } catch (e) { BetterDT.log('[list-search]', fn, e); } };
  const bbox = (i) => i.getBoundingBox();

  // ── the lists the game draws on the canvas: layers that scroll together, the items, the scroll range ────────────
  const LISTS = {
    RESEARCH: {
      layers: ['RESEARCH UI (Top)', 'RESEARCH UI (Back)'],
      items: () => rt.objects['9patch3'].getAllInstances().filter(i => i.layer && i.layer.name === 'RESEARCH UI (Back)' && i.isVisible),
    },
    'INVESTING STOCK': {
      layers: ['UI (Animations)', 'COMPANY UI (Top)', 'COMPANY UI (Back)'],
      items: () => rt.objects['9patch3'].getAllInstances().filter(i => i.layer && i.layer.name === 'COMPANY UI (Back)' && i.isVisible),
    },
  };
  const BASE = 540, VIEW_H = 1080, PAD = 24;   // scrollY of a layer that is not scrolled; layout height
  function geom(list) {
    const items = list.items();
    if (!items.length) return null;
    let top = Infinity, bottom = -Infinity, right = -Infinity;
    for (const i of items) { const b = bbox(i); top = Math.min(top, b.top); bottom = Math.max(bottom, b.bottom); right = Math.max(right, b.right); }
    const layers = list.layers.map(n => rt.layout.getLayer(n)).filter(Boolean);
    if (!layers.length) return null;
    const max = Math.max(0, bottom + PAD - VIEW_H);
    return { items, top, bottom, right, layers, max, view: VIEW_H - top, content: bottom + PAD - top };
  }
  const offset = (g) => g.layers[0].scrollY - BASE;
  function scrollTo(g, off) {
    const y = BASE + Math.max(0, Math.min(g.max, off));
    for (const l of g.layers) l.scrollY = y;
  }
  // layout point of the unscrolled screen → CSS px
  function css(g, x, y) { return g.layers[0].layerToCssPx(x, y + offset(g)); }

  // ── scroll bar ─────────────────────────────────────────────────────────────────────────────────
  const CSS = `
.bdt-sb { position: fixed; z-index: 30; width: 10px; border-radius: 5px; background: rgba(255,255,255,0.10); touch-action: none; }
.bdt-sb-thumb { position: absolute; left: 0; right: 0; border-radius: 5px; background: rgba(255,255,255,0.42); cursor: grab;
  transition: background .15s ease; }
.bdt-sb-thumb:hover, .bdt-sb.bdt-drag .bdt-sb-thumb { background: rgba(255,255,255,0.70); }
.bdt-sb.bdt-drag .bdt-sb-thumb { cursor: grabbing; }
.bdt-ls { position: relative; flex: 0 0 auto; margin-right: calc(var(--rs, 1) * 14px); }
.bdt-ls-in { box-sizing: border-box; width: calc(var(--rs, 1) * 260px); height: calc(var(--rs, 1) * 38px);
  padding: 0 calc(var(--rs, 1) * 14px); border-radius: calc(var(--rs, 1) * 11px); border: 1px solid rgba(255,255,255,0.22);
  background: rgba(10,12,40,0.45); color: #fff; outline: none; font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif;
  font-size: calc(var(--rs, 1) * 20px); letter-spacing: calc(var(--rs, 1) * 0.4px); }
/* the research top bar with the search field: always one row, the same on every tab; with many device tabs the search
   field gets narrower, and in a very narrow window the checkbox label too */
#research-topbar.bdt-ls-bar { flex-wrap: nowrap; }
/* the bar always holds the search field: on tabs without device tabs the game's smaller bar (rc-no-cats) is kept at
   the usual size, so the cards do not jump between tabs */
#research-root.rc-no-cats #research-topbar.bdt-ls-bar { min-height: calc(var(--rs, 1) * 58px);
  padding-bottom: calc(var(--rs, 1) * 12px); margin-bottom: calc(var(--rs, 1) * 12px); }
#research-root.rc-no-cats #research-topbar.bdt-ls-bar::after { display: block; }
#research-topbar.bdt-ls-bar > * { flex-shrink: 0; }
#research-topbar.bdt-ls-bar > .bdt-ls { flex: 0 1 calc(var(--rs, 1) * 260px); min-width: calc(var(--rs, 1) * 110px); }
#research-topbar.bdt-ls-bar .bdt-ls-in { width: 100%; }
#research-topbar.bdt-ls-bar #research-cats { flex-wrap: nowrap; }
#research-topbar.bdt-ls-bar #research-hide-label { white-space: nowrap; flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.bdt-ls-in::placeholder { color: rgba(255,255,255,0.55); }
.bdt-ls-in:focus { border-color: rgba(255,255,255,0.55); background: rgba(10,12,40,0.65); }
.bdt-ls-res { position: absolute; left: 0; top: calc(100% + calc(var(--rs, 1) * 6px)); z-index: 40; min-width: 100%;
  max-width: calc(var(--rs, 1) * 520px); max-height: calc(var(--rs, 1) * 430px); overflow-y: auto; padding: calc(var(--rs, 1) * 6px);
  border-radius: calc(var(--rs, 1) * 12px); background: rgba(16,18,52,0.97); border: 1px solid rgba(255,255,255,0.16);
  box-shadow: 0 10px 30px rgba(0,0,0,0.45); display: none; }
.bdt-ls-res.bdt-open { display: block; }
.bdt-ls-item { display: flex; align-items: baseline; gap: calc(var(--rs, 1) * 10px); padding: calc(var(--rs, 1) * 7px) calc(var(--rs, 1) * 10px);
  border-radius: calc(var(--rs, 1) * 8px); color: #fff; cursor: pointer; white-space: nowrap;
  font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; font-size: calc(var(--rs, 1) * 19px); }
.bdt-ls-item small { color: rgba(255,255,255,0.55); font-size: calc(var(--rs, 1) * 15px); letter-spacing: calc(var(--rs, 1) * 0.5px); }
.bdt-ls-item.bdt-sel, .bdt-ls-item:hover { background: rgba(255,255,255,0.14); }
.bdt-ls-none { padding: calc(var(--rs, 1) * 7px) calc(var(--rs, 1) * 10px); color: rgba(255,255,255,0.6);
  font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; font-size: calc(var(--rs, 1) * 18px); }
.bdt-ls-fixed { position: fixed; z-index: 30; margin: 0; }
@keyframes bdt-ls-flash { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,214,90,0); } 30% { box-shadow: 0 0 0 4px rgba(255,214,90,0.95); } }
.rc-card.bdt-ls-hit { animation: bdt-ls-flash 0.8s ease 2; }
`;
  const style = document.createElement('style');
  style.id = 'dtmod-list-search';
  style.textContent = CSS;
  document.getElementById(style.id)?.remove();
  document.head.appendChild(style);

  // pointer and key events of our elements are not passed to the game (it would click the card under them or
  // react to the keys typed into the search field)
  const quiet = (el, types) => { for (const t of types) el.addEventListener(t, (e) => e.stopPropagation()); };

  const bar = document.createElement('div');
  bar.className = 'bdt-sb';
  bar.innerHTML = '<div class="bdt-sb-thumb"></div>';
  const thumb = bar.firstChild;
  quiet(bar, ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'click']);
  let drag = null;
  bar.addEventListener('pointerdown', kit.guard((e) => {
    const g = current();
    if (!g || e.button !== 0) return;
    const tb = thumb.getBoundingClientRect(), br = bar.getBoundingClientRect();
    gv.WheelScrollRate = 0;
    if (e.target !== thumb) {   // a click on the track jumps there
      const f = (e.clientY - br.top - tb.height / 2) / Math.max(1, br.height - tb.height);
      scrollTo(g, f * g.max);
    }
    drag = { y: e.clientY, off: offset(g), k: g.max / Math.max(1, br.height - thumb.getBoundingClientRect().height) };
    bar.classList.add('bdt-drag');
    bar.setPointerCapture(e.pointerId);
    e.preventDefault();
  }));
  bar.addEventListener('pointermove', kit.guard((e) => {
    const g = drag && current();
    if (!g) return;
    gv.WheelScrollRate = 0;
    scrollTo(g, drag.off + (e.clientY - drag.y) * drag.k);
  }));
  const endDrag = () => { drag = null; bar.classList.remove('bdt-drag'); };
  bar.addEventListener('pointerup', endDrag);
  bar.addEventListener('pointercancel', endDrag);

  let cur = null;   // geometry of the list on this layout, refreshed every frame
  const current = () => cur;
  function placeBar(g) {
    if (!g || g.max <= 0 || String(gv.EditorNotification) === 'ON') { bar.remove(); return; }
    if (!bar.isConnected) document.body.appendChild(bar);
    const [x0, y0] = css(g, g.right + 14, g.top);
    const [, y1] = css(g, g.right + 14, VIEW_H - PAD);
    const h = Math.max(20, y1 - y0);
    bar.style.left = x0 + 'px';
    bar.style.top = y0 + 'px';
    bar.style.height = h + 'px';
    const th = Math.max(28, h * Math.min(1, g.view / g.content));
    thumb.style.height = th + 'px';
    thumb.style.top = ((h - th) * (g.max ? offset(g) / g.max : 0)) + 'px';
  }

  // ── search field and results ───────────────────────────────────────────────────────────────────
  // make(onPick, index): onPick(entry), index() → [{ name, sub, key, ... }]
  function makeSearch(index, onPick) {
    const wrap = document.createElement('div');
    wrap.className = 'bdt-ls';
    wrap.innerHTML = '<input class="bdt-ls-in" type="text" spellcheck="false" autocomplete="off"><div class="bdt-ls-res"></div>';
    const input = wrap.firstChild, res = wrap.lastChild;
    quiet(wrap, ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'keydown', 'keyup', 'keypress']);
    let list = null, found = [], sel = 0;
    function show() {
      const q = fold(input.value.trim());
      if (!q) { res.classList.remove('bdt-open'); return; }
      list = list || index();
      const starts = [], has = [];
      for (const e of list) {
        const n = fold(e.name);
        if (n.startsWith(q)) starts.push(e);
        else if (n.includes(q) || fold(e.sub).includes(q)) has.push(e);
      }
      found = starts.concat(has).slice(0, 40);
      sel = 0;
      res.innerHTML = found.length
        ? found.map((e, i) => `<div class="bdt-ls-item${i ? '' : ' bdt-sel'}" data-i="${i}">${esc(e.name)}${e.sub ? `<small>${esc(e.sub)}</small>` : ''}</div>`).join('')
        : `<div class="bdt-ls-none">${esc(tr('none'))}</div>`;
      res.classList.add('bdt-open');
    }
    function mark(i) {
      const items = res.querySelectorAll('.bdt-ls-item');
      if (!items.length) return;
      sel = (i + items.length) % items.length;
      items.forEach((el, k) => el.classList.toggle('bdt-sel', k === sel));
      items[sel].scrollIntoView({ block: 'nearest' });
    }
    function pick(i) {
      const e = found[i];
      if (!e) return;
      res.classList.remove('bdt-open');
      input.blur();
      onPick(e);
    }
    input.addEventListener('focus', kit.guard(() => { list = null; input.placeholder = tr('search'); show(); }));
    input.addEventListener('input', kit.guard(show));
    input.addEventListener('blur', () => setTimeout(() => res.classList.remove('bdt-open'), 150));
    input.addEventListener('keydown', kit.guard((e) => {
      if (e.key === 'ArrowDown') { mark(sel + 1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { mark(sel - 1); e.preventDefault(); }
      else if (e.key === 'Enter') { pick(sel); e.preventDefault(); }
      else if (e.key === 'Escape') { input.value = ''; res.classList.remove('bdt-open'); input.blur(); e.preventDefault(); }
    }));
    res.addEventListener('pointerdown', kit.guard((e) => {
      const it = e.target.closest('.bdt-ls-item');
      if (it) { e.preventDefault(); pick(Number(it.dataset.i)); }
    }));
    input.placeholder = tr('search');
    return { wrap, input, reset() { list = null; } };
  }

  // ── RESEARCH ───────────────────────────────────────────────────────────────────────────────────
  const researchTabs = () => LISTS.RESEARCH.items().map(i => Number(i.instVars.CountryID)).filter(p => p > 0).sort((a, b) => a - b);
  function tabName(p) {
    const t = rt.objects.Text.getAllInstances().find(i => i.layer && i.layer.name === 'RESEARCH UI (Top)' && Number(i.instVars.CountryID) === p);
    return t ? plain(t.text) : '';
  }
  // the tab like a click on it opens it (event sheet "RESEARCH UI [Engine]")
  function showPage(p) {
    gv.WheelScrollRate = 0;
    gv.MiniPage = p;
    call('Research_ButtonsOpacity');
    call('ResearchPage');
  }
  function researchIndex() {
    const start = Number(gv.MiniPage), scroller = document.querySelector('#research-scroll'), top = scroller ? scroller.scrollTop : 0;
    const out = [], seen = new Set();
    try {
      for (const p of researchTabs()) {
        if (Number(gv.MiniPage) !== p) showPage(p);
        const sub = tabName(p);
        for (const c of document.querySelectorAll('#research-grid .rc-card[data-rid]')) {
          const id = c.dataset.rid, name = plain(c.querySelector('.rc-title-inner, .rc-title')?.textContent);
          if (!name || seen.has(id)) continue;
          seen.add(id);
          out.push({ name, sub, page: p, id });
        }
      }
    } finally {
      if (Number(gv.MiniPage) !== start) showPage(start);
      const s = document.querySelector('#research-scroll');
      if (s) s.scrollTop = top;
    }
    return out;
  }
  function pickResearch(e) {
    if (layoutName() !== 'RESEARCH') return;
    if (Number(gv.MiniPage) !== e.page) showPage(e.page);
    // the tab into view on the left
    const g = geom(LISTS.RESEARCH);
    const tab = g && g.items.find(i => Number(i.instVars.CountryID) === e.page);
    if (tab) {
      const b = bbox(tab), off = offset(g);
      if (b.top - off < g.top || b.bottom - off > VIEW_H - PAD) scrollTo(g, b.top - g.top - 2 * (b.bottom - b.top));
    }
    requestAnimationFrame(() => {
      const c = document.querySelector(`#research-grid .rc-card[data-rid="${e.id}"]`);
      if (!c) return;
      c.scrollIntoView({ block: 'center', behavior: 'smooth' });
      c.classList.remove('bdt-ls-hit');
      void c.offsetWidth;
      c.classList.add('bdt-ls-hit');
    });
  }
  const rs = makeSearch(researchIndex, pickResearch);
  function ensureResearch() {
    const topbar = document.querySelector('#research-root #research-topbar');
    if (!topbar) return;
    if (rs.wrap.parentNode !== topbar) { topbar.insertBefore(rs.wrap, topbar.firstChild); rs.reset(); }
    topbar.classList.add('bdt-ls-bar');
  }

  // ── INVESTING STOCK ────────────────────────────────────────────────────────────────────────────
  function companyIndex() {
    const names = new Map();
    for (const t of rt.objects.Text.getAllInstances()) {
      if (t.layer && t.layer.name === 'COMPANY UI (Top)' && t.instVars && 'CountryID' in t.instVars) names.set(Number(t.instVars.CountryID), plain(t.text));
    }
    return LISTS['INVESTING STOCK'].items().map(i => ({ name: names.get(Number(i.instVars.CountryID)) || '', sub: '', key: Number(i.instVars.CountryID) }))
      .filter(e => e.name);
  }
  function clickAt(x, y) {
    const target = document.elementFromPoint(x, y) || document.body;
    const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 };
    target.dispatchEvent(new PointerEvent('pointermove', { ...o, buttons: 0 }));
    target.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1 }));
    setTimeout(() => target.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 })), 60);
  }
  function pickCompany(e) {
    const g = geom(LISTS['INVESTING STOCK']);
    const card = g && g.items.find(i => Number(i.instVars.CountryID) === e.key);
    if (!card) return;
    const b = bbox(card);
    gv.WheelScrollRate = 0;
    scrollTo(g, b.top - g.top);
    // a click on the card once the layers have moved: the game selects it as if the player clicked
    const h = kit.guard(() => {
      rt.removeEventListener('tick', h);
      if (layoutName() !== 'INVESTING STOCK' || String(gv.EditorNotification) === 'ON') return;
      const bb = bbox(card), [x, y] = card.layer.layerToCssPx((bb.left + bb.right) / 2, (bb.top + bb.bottom) / 2);
      clickAt(x, y);
    });
    rt.addEventListener('tick', h);
  }
  const is = makeSearch(companyIndex, pickCompany);
  is.wrap.classList.add('bdt-ls-fixed');
  function placeInvestSearch(g) {
    if (!g || String(gv.EditorNotification) === 'ON') { is.wrap.remove(); return; }
    if (!is.wrap.isConnected) { document.body.appendChild(is.wrap); is.reset(); }
    // in the header, right of the screen title; the size follows the window like the game's own HTML (--rs)
    const [x, y] = css(g, 720, 57), [x2] = css(g, 1720, 57);
    const rsc = Math.max(0.4, 1.15 * (x2 - x) / 1000);
    is.wrap.style.setProperty('--rs', String(rsc));
    is.wrap.style.left = x + 'px';
    is.wrap.style.top = (y - 19 * rsc) + 'px';
  }

  // ── every frame: keep the lists in range, place the bar and the fields ────────────────────────────
  let lastLayout = '';
  const onTick = kit.guard(() => {
    const name = layoutName(), list = LISTS[name];
    if (name !== lastLayout) { lastLayout = name; rs.reset(); is.reset(); is.input.value = ''; rs.input.value = ''; }
    const g = list ? geom(list) : null;
    cur = g;
    if (g) {
      const off = offset(g);
      if (off > g.max || off < 0) { gv.WheelScrollRate = 0; scrollTo(g, off); }
    }
    placeBar(g);
    if (name === 'RESEARCH') ensureResearch();
    if (name === 'INVESTING STOCK') placeInvestSearch(g); else is.wrap.remove();
  });
  rt.addEventListener('tick', onTick);

  return () => {
    rt.removeEventListener('tick', onTick);
    bar.remove(); rs.wrap.remove(); is.wrap.remove(); style.remove();
    const tb = document.querySelector('#research-topbar');
    if (tb) tb.classList.remove('bdt-ls-bar');
  };
});
