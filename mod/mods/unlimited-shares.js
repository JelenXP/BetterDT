// Unlimited shares – STOCK screen of a company (INVESTING STOCK), the "Buy" tab.
// Based on the "unlimited shares" mod by M1lan.
//
// The exchange offers only a few shares of a company at a time: ArrayInvesting row 8 is the offer, which the game
// refills by 2.5–3.5 % of all shares when it drops below 2.5 % (investingUpdate). So reaching the game's own limit
// of 49 % (above it a company can only be bought in talks) takes many purchases and many days. With this mod the
// offer of the company you open is as large as your money allows, so one purchase can go up to the limit.
//
// The game still does the purchase: its slider, its price (shares × price + 2.5 % commission), the 49 % limit
// (_tradeRoom) and the "not enough funds" check are unchanged. When you open a company or the Buy tab, or after a
// purchase, the mod raises row 8 and sets the slider up again with the game's own investingSyncSlider and
// InvestingStock_Text (what the game itself runs then; it calls them inside its code, so they cannot be wrapped).
// When you leave the company, its offer goes back to what the game offered, minus the shares you have bought.
BetterDTKit.mod('unlimited-shares', {
  needs: {
    functions: ['investingSyncSlider', 'investingQuote', 'investingBuy'],
    objects: ['ArrayInvesting', 'ArrayInvestingMyStocks', 'ArrayInvestingStocks'],
    vars: ['Budget', 'MiniPage', 'SubPage', 'InvestingStock_Count', 'InvestingStock_TotalPrice'],
    arrays: { ArrayInvesting: [1, 10], ArrayInvestingMyStocks: [1, 1], ArrayInvestingStocks: [1, 2] },
    // the game's own slider sync must read the offer from row 8 (investingSyncSlider → _tradeRoom)
    check: () => /_tradeRoom\(/.test(String(globalThis.investingSyncSlider)) ? '' : 'investingSyncSlider has changed',
  },
}, (rt, kit) => {
  if (globalThis.__dtUnlimitedShares) globalThis.__dtUnlimitedShares.dispose();

  const LAYOUT = 'INVESTING STOCK';
  const TOTAL = 4, OWNED_COMPANY = 7, OFFER = 8;   // rows in ArrayInvesting (x = company)
  const gv = rt.globalVars;
  const arr = (name) => rt.objects[name].getFirstInstance();
  const layoutName = () => { try { return rt.layout.name; } catch { return ''; } };
  const log = (...a) => (globalThis.BetterDT ? BetterDT.log : console.log)('[unlimited-shares]', ...a);

  // companies whose offer the mod has raised: id → { offer: the game's offer, owned: shares owned then }
  const raised = new Map();

  // price of one share with the commission, from the game's own quote (Buy tab); the quote also sets the count
  // the Buy button takes (InvestingStock_Count), so that is put back
  function unitCost() {
    const count = gv.InvestingStock_Count, total = gv.InvestingStock_TotalPrice;
    try {
      const q = globalThis.investingQuote(rt, 1e6);
      return q && q.count > 0 && q.price > 0 ? q.total / q.count : NaN;
    } finally { gv.InvestingStock_Count = count; gv.InvestingStock_TotalPrice = total; }
  }

  function raise(id) {
    const inv = arr('ArrayInvesting'), mine = arr('ArrayInvestingMyStocks');
    if (!(id >= 0 && id < inv.width)) return;
    if (Number(inv.getAt(id, OWNED_COMPANY)) === 1) return;   // bought in talks: no exchange any more
    const total = Number(inv.getAt(id, TOTAL)) || 0, offer = Number(inv.getAt(id, OFFER)) || 0;
    const owned = Number(mine.getAt(id, 0)) || 0;
    const unit = unitCost();
    if (!(total > 0) || !(unit > 0)) return;
    // as many as the money buys (the game takes Math.round(count × price × 1.025), so keep 1 $ aside)
    const afford = Math.max(0, Math.floor((Number(gv.Budget) - 1) / unit));
    const r = raised.get(id);
    const base = r ? Math.max(0, r.offer - Math.max(0, owned - r.owned)) : offer;   // what the game would offer now
    const want = Math.min(total, Math.max(base, afford));
    if (want === offer) return;
    if (!r) raised.set(id, { offer, owned });
    inv.setAt(want, id, OFFER);
  }

  // back to the game's offer, less what was bought meanwhile
  function restore(id) {
    const r = raised.get(id);
    if (!r) return;
    raised.delete(id);
    try {
      const inv = arr('ArrayInvesting'), mine = arr('ArrayInvestingMyStocks');
      const bought = Math.max(0, (Number(mine.getAt(id, 0)) || 0) - r.owned);
      const back = Math.max(0, r.offer - bought);
      inv.setAt(Math.min(Number(inv.getAt(id, OFFER)) || 0, back), id, OFFER);
    } catch (e) { log('restore', id, e); }
  }
  const restoreAll = () => { for (const id of [...raised.keys()]) restore(id); };

  // company, tab or holding changed (the game has just set its slider up): raise the offer, set it up again
  let last = '';
  const onTick = kit.guard(() => {
    if (layoutName() !== LAYOUT) { last = ''; return; }
    const id = Number(gv.MiniPage), sub = Number(gv.SubPage);
    const key = id + '|' + sub + '|' + arr('ArrayInvestingMyStocks').getAt(id, 0);
    if (key === last) return;
    last = key;
    for (const other of [...raised.keys()]) if (other !== id) restore(other);
    if (sub !== 0) return;
    const inv = arr('ArrayInvesting'), before = inv.getAt(id, OFFER);
    raise(id);
    if (inv.getAt(id, OFFER) === before) return;
    globalThis.investingSyncSlider(rt);
    try { rt.callFunction('InvestingStock_Text'); } catch (e) { log('InvestingStock_Text', e); }
  });
  const onLayoutEnd = kit.guard(() => { restoreAll(); last = ''; });
  rt.addEventListener('tick', onTick);
  rt.addEventListener('beforeanylayoutend', onLayoutEnd);

  const dispose = () => {
    rt.removeEventListener('tick', onTick);
    rt.removeEventListener('beforeanylayoutend', onLayoutEnd);
    restoreAll();
  };
  globalThis.__dtUnlimitedShares = { dispose, get raised() { return [...raised.entries()]; } };
  return dispose;
});
