// Monthly report – the folder mod example of MODDING.md.
//
// mod.json gives the title, description and options shown in Settings → BetterDT → Mods. The mod uses the newer
// parts of BetterDTKit: events (kit.on), game data (kit.game), its options (kit.option), the UI helpers (kit.ui)
// and a file of its folder (icon.svg). Everything it adds is removed by BetterDTKit when the mod stops, so it
// needs no dispose function.
BetterDTKit.mod('monthly-report', {
  needs: { vars: ['Budget', 'DayTotal', 'Month', 'Year'] },
}, (rt, kit) => {
  const ICON = 'https://betterdt.localhost/mod/monthly-report/icon.svg';
  const history = [];   // { month, year, change } of the loaded game, newest last
  let start = null;     // money at the start of the current month

  const money = (v) => {
    const sign = v < 0 ? '−' : '+', a = Math.abs(v);
    if (kit.option('format') === 'full') return sign + '$' + Math.round(a).toLocaleString('fr-FR');
    return sign + '$' + (a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : Math.round(a / 1e3) + 'K');
  };

  // a new game or another save: start counting again
  kit.on('gameLoaded', () => { history.length = 0; start = kit.game.money; });
  kit.on('gameClosed', () => { history.length = 0; start = null; });

  kit.on('month', (date) => {
    const now = kit.game.money;
    if (start !== null) {
      const prev = date.month === 1 ? { month: 12, year: date.year - 1 } : { month: date.month - 1, year: date.year };
      const change = now - start;
      history.push({ ...prev, change });
      if (history.length > 12) history.shift();
      if (kit.option('toast') && Math.abs(change) >= kit.option('min') * 1e6) {
        kit.ui.toast(`${prev.month}/${prev.year}: ${money(change)}`, { type: change >= 0 ? 'good' : 'bad' });
      }
    }
    start = now;
  });

  // a round button with the icon in the office, under the company name in the top right corner
  const btn = kit.ui.button('', () => {
    const lines = history.length ? history.map(h => `${h.month}/${h.year}   ${money(h.change)}`).join('\n') : '—';
    kit.ui.dialog({ title: kit.game.company.name, text: lines, buttons: [{ label: 'OK', go: true }] });
  }, { parent: document.body });
  btn.style.cssText = 'min-width:0;width:64px;height:64px;padding:0;border-radius:50%;z-index:40';
  kit.ui.el('img', { src: ICON, style: { width: '30px', height: '30px', pointerEvents: 'none' } }, btn);
  kit.ui.anchor(btn, 'GAMEPLAY GLOBAL UI (Back)', 1830, 175, { screen: 'BOSS OFFICE', scale: true });

  // the dialog keeps its line breaks
  kit.ui.css('#bdt-dlg .bdt-text { white-space: pre-line; }');
});
