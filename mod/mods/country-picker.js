// Country picker – the country cards show what each country gives, and the list can be sorted by it.
//
// The game's picker (initCountryPicker, COMPANY COUNTRY) shows 135 cards: flag, name, start money and four bars
// without labels (tax, cost of production, international trade, research level). Here every card gets the numbers
// with labels instead of the bars: tax (paid on the profit every month), research (start research points), and
// with country-effects.js running the salaries (cost of production) and the sales (trade) compared with the
// game's own; without it cost of production and trade are shown as having no effect (in the game they have none).
// Chips above the list sort the cards (CSS order, the game's cards and search stay as they are); the first three
// of the sort get a star. "Best overall" weighs the tax most (it is paid the whole game), then start money,
// research and the two country effects, each scaled between the lowest and the highest country.
BetterDTKit.mod('country-picker', {
  needs: { functions: ['initCountryPicker'], vars: ['CompanyCountryID', 'LanguageChoose'] },
}, (rt, kit) => {
  if (globalThis.__dtCountryPicker) globalThis.__dtCountryPicker.dispose();

  const S = BetterDT.settings, gv = rt.globalVars;
  const T = {
    tax: ['Tax', 'Налог', 'Steuer', 'Impôt', 'Tasse', 'Impuesto', 'कर', 'Vergi', 'Imposto', 'Податок', 'Pajak', 'Podatek', '税率', '세금', '税率'],
    research: ['Research', 'Исследования', 'Forschung', 'Recherche', 'Ricerca', 'Investigación', 'रिसर्च', 'Araştırma', 'Pesquisa',
      'Дослідження', 'Riset', 'Badania', '研究', '연구', '研究'],
    salaries: ['Salaries', 'Зарплаты', 'Gehälter', 'Salaires', 'Stipendi', 'Salarios', 'वेतन', 'Maaşlar', 'Salários', 'Зарплати',
      'Gaji', 'Pensje', '工资', '급여', '給与'],
    sales: ['Sales', 'Продажи', 'Verkäufe', 'Ventes', 'Vendite', 'Ventas', 'बिक्री', 'Satışlar', 'Vendas', 'Продажі', 'Penjualan',
      'Sprzedaż', '销量', '판매', '販売'],
    cost: ['Production cost', 'Стоимость производства', 'Herstellungskosten', 'Coût de production', 'Costo di produzione',
      'Costo de producción', 'उत्पादन लागत', 'Üretim maliyeti', 'Custo de produção', 'Вартість виробництва', 'Biaya produksi',
      'Koszt produkcji', '生产成本', '생산 비용', '生産コスト'],
    trade: ['Trade', 'Торговля', 'Handel', 'Commerce', 'Commercio', 'Comercio', 'व्यापार', 'Ticaret', 'Comércio', 'Торгівля',
      'Perdagangan', 'Handel', '贸易', '무역', '貿易'],
    none: ['no effect', 'без эффекта', 'ohne Wirkung', 'sans effet', 'nessun effetto', 'sin efecto', 'कोई असर नहीं', 'etkisiz',
      'sem efeito', 'без ефекту', 'tanpa efek', 'bez wpływu', '无效果', '효과 없음', '効果なし'],
    overall: ['Best overall', 'Лучшие в целом', 'Insgesamt am besten', 'Meilleurs au global', 'Migliori in assoluto',
      'Mejores en general', 'कुल मिलाकर बेहतर', 'Genel olarak en iyi', 'Melhores no geral', 'Найкращі загалом',
      'Terbaik secara umum', 'Najlepsze ogólnie', '综合最佳', '종합 최고', '総合ベスト'],
    lowTax: ['Lowest tax', 'Ниже налог', 'Niedrigste Steuer', 'Impôt le plus bas', 'Tasse più basse', 'Menor impuesto',
      'सबसे कम कर', 'En düşük vergi', 'Menor imposto', 'Найнижчий податок', 'Pajak terendah', 'Najniższy podatek', '税率最低',
      '세금 최저', '税率が低い'],
    money: ['Most money', 'Больше денег', 'Meistes Geld', 'Plus d\'argent', 'Più soldi', 'Más dinero', 'सबसे ज़्यादा पैसा',
      'En çok para', 'Mais dinheiro', 'Найбільше грошей', 'Uang terbanyak', 'Najwięcej pieniędzy', '资金最多', '자금 최다', '資金が多い'],
    mostResearch: ['Most research', 'Больше исследований', 'Meiste Forschung', 'Plus de recherche', 'Più ricerca',
      'Más investigación', 'सबसे ज़्यादा रिसर्च', 'En çok araştırma', 'Mais pesquisa', 'Найбільше досліджень', 'Riset terbanyak',
      'Najwięcej badań', '研究最多', '연구 최다', '研究が多い'],
    lowSalaries: ['Lowest salaries', 'Ниже зарплаты', 'Niedrigste Gehälter', 'Salaires les plus bas', 'Stipendi più bassi',
      'Salarios más bajos', 'सबसे कम वेतन', 'En düşük maaşlar', 'Menores salários', 'Найнижчі зарплати', 'Gaji terendah',
      'Najniższe pensje', '工资最低', '급여 최저', '給与が安い'],
    mostSales: ['Most sales', 'Больше продаж', 'Meiste Verkäufe', 'Plus de ventes', 'Più vendite', 'Más ventas',
      'सबसे ज़्यादा बिक्री', 'En çok satış', 'Mais vendas', 'Найбільше продажів', 'Penjualan terbanyak', 'Najwięcej sprzedaży',
      '销量最高', '판매 최다', '販売が多い'],
  };
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const t = (k) => T[k][lang()] || T[k][0];
  const effects = () => globalThis.__dtCountryEffects || null;

  // ── the countries and their scores ────────────────────────────────────────────────────────────
  let rows = null;
  function readRows() {
    const a = rt.objects.ArrayCountries.getFirstInstance();
    const out = [];
    for (let i = 0; i < a.width; i++) {
      const n = (y) => Number(a.getAt(i, y)) || 0;
      out.push({ id: i, name: String(a.getAt(i, 0) || ''), money: n(1), tax: n(2), cost: n(3), trade: n(4), tech: n(5) });
    }
    return out;
  }
  // each value scaled 0…1 between the lowest and the highest country (1 = best)
  function scale(list, get, low) {
    const v = list.map(get), lo = Math.min(...v), hi = Math.max(...v);
    return (r) => hi > lo ? (low ? hi - get(r) : get(r) - lo) / (hi - lo) : 0;
  }
  function sorts() {
    const e = effects();
    const salary = (r) => e ? e.salaryOf(r.cost) : 0, sales = (r) => e ? e.salesOf(r.trade) : 0;
    const sTax = scale(rows, r => r.tax, true), sMoney = scale(rows, r => r.money), sTech = scale(rows, r => r.tech);
    const sSalary = scale(rows, salary, true), sSales = scale(rows, sales);
    const overall = e
      ? (r) => 0.35 * sTax(r) + 0.2 * sMoney(r) + 0.15 * sTech(r) + 0.15 * sSalary(r) + 0.15 * sSales(r)
      : (r) => 0.5 * sTax(r) + 0.3 * sMoney(r) + 0.2 * sTech(r);
    const list = [
      { k: 'overall', score: overall },
      { k: 'lowTax', score: r => -r.tax },
      { k: 'money', score: r => r.money },
      { k: 'mostResearch', score: r => r.tech },
    ];
    if (e) list.push({ k: 'lowSalaries', score: r => -salary(r) }, { k: 'mostSales', score: sales });
    list.push({ k: 'az', score: null });
    return list;
  }

  // ── look ──────────────────────────────────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.id = 'bdt-country-picker-css';
  css.textContent = `
#cp-root.bdt-cp .cp-bars { display: none; }
#bdt-cp-sort { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 10px; }
.bdt-cp-chip { padding: 5px 10px 4px; border-radius: 999px; cursor: pointer; font-size: 17px; line-height: 1;
  letter-spacing: .03em; color: rgba(255,255,255,0.7); background: rgba(16,19,28,0.6);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); transition: background .15s, color .15s; }
.bdt-cp-chip:hover { background: rgba(255,255,255,0.12); color: #fff; }
.bdt-cp-chip.bdt-cp-on { color: #1b1b1b; background: var(--cp-sel, #ffd600); box-shadow: none; }
.bdt-cp-stats { flex: 0 0 auto; display: grid; grid-template-columns: repeat(2, auto); gap: 4px 14px;
  padding-left: 13px; border-left: 1px solid rgba(255,255,255,0.09); }
.bdt-cp-stat { display: flex; flex-direction: column; min-width: 0; }
.bdt-cp-stat span { font-size: 13px; line-height: 1.1; letter-spacing: .04em; color: rgba(255,255,255,0.45); white-space: nowrap; }
.bdt-cp-stat b { font-weight: normal; font-size: 19px; line-height: 1.05; color: rgba(255,255,255,0.92); white-space: nowrap; }
.bdt-cp-stat.bdt-cp-up b { color: #8bf0b4; }
.bdt-cp-stat.bdt-cp-down b { color: #ff9a8a; }
.bdt-cp-stat.bdt-cp-none b { color: rgba(255,255,255,0.35); font-size: 15px; }
.bdt-cp-stat.bdt-cp-key span { color: var(--cp-sel, #ffd600); }
.bdt-cp-rank { flex: 0 0 auto; padding: 3px 7px 2px; border-radius: 999px; font-size: 15px;
  line-height: 1; color: #1b1b1b; background: linear-gradient(150deg, #fff, var(--cp-sel, #ffd600) 60%);
  box-shadow: 0 3px 10px rgba(0,0,0,0.35); pointer-events: none; }
`;
  document.head.appendChild(css);

  const pct = (f) => { const v = Math.round((f - 1) * 100); return (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v) + ' %'; };
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function stat(label, value, cls, key) {
    return `<div class="bdt-cp-stat ${cls}${key ? ' bdt-cp-key' : ''}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  }
  // what the sort is about is marked on the card (its label in yellow)
  const KEY = { lowTax: 'tax', mostResearch: 'research', lowSalaries: 'salaries', mostSales: 'sales' };
  // green is good: lower salaries, higher sales
  const tone = (f, good) => f > 1.0005 ? (good > 0 ? 'bdt-cp-up' : 'bdt-cp-down') : f < 0.9995 ? (good > 0 ? 'bdt-cp-down' : 'bdt-cp-up') : '';
  function statsHtml(r, sortKey) {
    const e = effects(), k = KEY[sortKey];
    let h = stat(t('tax'), Math.round(r.tax * 100) + ' %', '', k === 'tax') + stat(t('research'), String(Math.round(r.tech)), '', k === 'research');
    if (e) {
      const w = e.salaryOf(r.cost), s = e.salesOf(r.trade);
      h += stat(t('salaries'), pct(w), tone(w, -1), k === 'salaries');
      h += stat(t('sales'), pct(s), tone(s, 1), k === 'sales');
    } else {
      h += stat(t('cost'), t('none'), 'bdt-cp-none') + stat(t('trade'), t('none'), 'bdt-cp-none');
    }
    return h;
  }

  // ── on the picker ─────────────────────────────────────────────────────────────────────────────
  let sortIdx = Math.round(S.num('country-picker.sort', 0));
  let painted = '';   // what the cards show now: language, effects on/off, sort
  function paint(root, force) {
    const list = sorts();
    if (!(sortIdx >= 0 && sortIdx < list.length)) sortIdx = 0;
    const cur = list[sortIdx];
    const state = lang() + '|' + !!effects() + '|' + cur.k;
    if (!force && state === painted && !root.querySelector('#cp-list .cp-card:not([data-bdt])')) return;
    const fresh = state !== painted;
    painted = state;
    root.classList.add('bdt-cp');
    // the chips under the search box
    const search = root.querySelector('#cp-search');
    let bar = root.querySelector('#bdt-cp-sort');
    if (search && !bar) {
      bar = document.createElement('div');
      bar.id = 'bdt-cp-sort';
      bar.addEventListener('click', kit.guard((ev) => {
        const c = ev.target.closest('.bdt-cp-chip');
        if (!c) return;
        sortIdx = Number(c.dataset.i);
        Promise.resolve(S.set('country-picker.sort', sortIdx)).catch(e => console.error('[country-picker] save', e));
        globalThis.tapMain?.();
        paint(root, true);
        const l = root.querySelector('#cp-list');
        if (l) l.scrollTop = 0;
      }));
      search.appendChild(bar);
    }
    if (bar) bar.innerHTML = list.map((s, i) => `<div class="bdt-cp-chip${i === sortIdx ? ' bdt-cp-on' : ''}" data-i="${i}">${s.k === 'az' ? 'A–Z' : esc(t(s.k))}</div>`).join('');
    // the order and the first three
    const byId = new Map(rows.map(r => [r.id, r]));
    const order = new Map();
    if (cur.score) rows.slice().sort((a, b) => cur.score(b) - cur.score(a) || a.name.localeCompare(b.name)).forEach((r, i) => order.set(r.id, i));
    for (const card of root.querySelectorAll('#cp-list .cp-card')) {
      const r = byId.get(Number(card.dataset.id));
      if (!r) continue;
      if (fresh || !card.dataset.bdt) {
        card.querySelector('.bdt-cp-stats')?.remove();
        card.querySelector('.bdt-cp-rank')?.remove();
        const box = document.createElement('div');
        box.className = 'bdt-cp-stats';
        box.innerHTML = statsHtml(r, cur.k);
        card.appendChild(box);
        const i = order.has(r.id) ? order.get(r.id) : -1;
        if (i >= 0 && i < 3) (card.querySelector('.cp-head') || card).insertAdjacentHTML('beforeend', `<div class="bdt-cp-rank">★ ${i + 1}</div>`);
        card.dataset.bdt = '1';
      }
      card.style.order = order.has(r.id) ? String(order.get(r.id)) : '';
    }
    const empty = root.querySelector('#cp-empty');
    if (empty) empty.style.order = '9999';
  }

  function tick() {
    const root = document.getElementById('cp-root');
    if (!root) return;
    if (!rows) rows = readRows();
    paint(root, false);
  }
  const timer = setInterval(kit.guard(tick), 200);
  tick();

  const dispose = () => {
    clearInterval(timer);
    const root = document.getElementById('cp-root');
    if (root) {
      root.classList.remove('bdt-cp');
      root.querySelector('#bdt-cp-sort')?.remove();
      for (const c of root.querySelectorAll('#cp-list .cp-card')) {
        c.querySelector('.bdt-cp-stats')?.remove();
        c.querySelector('.bdt-cp-rank')?.remove();
        delete c.dataset.bdt;
        c.style.order = '';
      }
      const empty = root.querySelector('#cp-empty');
      if (empty) empty.style.order = '';
    }
    css.remove();
  };
  globalThis.__dtCountryPicker = { dispose, get state() { return { sort: sortIdx, painted }; } };
  return dispose;
});
