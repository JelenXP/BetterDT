// Money goal – the example mod of MODDING.md.
//
// Shows a small message in the corner of the screen once your money reaches a goal (1 billion by default,
// "money-goal.target" in mods\betterdt.ini). It shows the parts most mods need: the compatibility check, a game
// variable, a game text, a setting, a timer guarded by kit.guard, an HTML element over the game and the dispose
// function that removes everything again.
BetterDTKit.mod('money-goal', {
  needs: { vars: ['Budget', 'DayTotal', 'LanguageChoose'] },
  texts: { 10974: "You don't have enough funds" },
}, (rt, kit) => {
  const S = BetterDT.settings;
  const gv = rt.globalVars;
  const target = () => S.num('money-goal.target', 1e9);

  const css = document.createElement('style');
  css.textContent = `
.mg-toast { position: fixed; right: 24px; bottom: 24px; z-index: 50; padding: 14px 20px; border-radius: 12px;
  background: linear-gradient(180deg, #a8d418 0%, #63b303 100%); color: #fff;
  font: 24px/1.2 SofiaSansExtraCondensed-Medium, Oswald, "Segoe UI", sans-serif;   /* the font of the game's dialogs */
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4); pointer-events: none; }`;
  document.head.appendChild(css);
  let toast = null, hideTimer = 0;

  function show(text) {
    if (!toast) toast = Object.assign(document.createElement('div'), { className: 'mg-toast' });
    toast.textContent = text;
    document.body.appendChild(toast);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => toast && toast.remove(), 5000);
  }

  // reached = the goal was already reached in this game, so the message is not repeated every second
  let reached = null, lastDay = -1;
  const check = kit.guard(() => {
    const day = Number(gv.DayTotal);
    if (!(day > 0)) { reached = null; lastDay = -1; return; }   // in the menu: no game loaded
    if (day === lastDay) return;                                // once per game day is enough
    lastDay = day;
    const rich = Number(gv.Budget) >= target();
    if (reached === null) { reached = rich; return; }           // just loaded: remember, do not announce
    if (rich && !reached) show(`Goal reached: $${Math.round(Number(gv.Budget)).toLocaleString()}`);
    if (!rich && reached) show(kit.text(10974));                // the game's own "You don't have enough funds"
    reached = rich;
  });
  const timer = setInterval(check, 500);

  return () => {
    clearInterval(timer);
    clearTimeout(hideTimer);
    if (toast) toast.remove();
    css.remove();
  };
});
