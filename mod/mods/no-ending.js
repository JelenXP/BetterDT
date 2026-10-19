// Endless game – keep playing after the end of the game in 2101.
//
// On game day 34000 (early 2101) the game calls triggerEndGame(): it sets the global "class" to "END GAME", which
// stops the calendar (the date engine only runs while class is "GAMEPLAY"), and shows the final summary screen
// whose only button goes back to the main menu. This mod adds a "Continue game" button under it (the game's own
// text, so it is in every language). It closes the screen with the game's resetEndGame() and sets class back to
// "GAMEPLAY", so the calendar runs on in the same session – no save, menu or reload needed. The game only ends on
// that one day, so it does not come back; the "game finished" achievement is still unlocked, as the game checks it
// before the screen is shown.
//
// Option "Skip the final screen" (off by default) continues right away without showing the summary.
//
// A game left stuck in "END GAME" with no screen (e.g. by an older mod that only removed the screen) is put back
// to "GAMEPLAY" as well.
BetterDTKit.mod('no-ending', {
  needs: {
    functions: ['isEndGameActive', 'isEndGameScreenOpen', 'resetEndGame'],
    vars: ['class', 'LastClass', 'DayTotal'],
  },
  texts: { 10785: 'Continue game' },
}, (rt, kit) => {
  if (globalThis.__dtNoEnding) globalThis.__dtNoEnding.dispose();
  const S = BetterDT.settings;
  const END = 'END GAME';

  const css = document.createElement('style');
  css.id = 'bdt-no-ending-css';
  // next to the game's own button (#eg-end), so the panel keeps its height; a quieter second button in the same
  // style, appearing together with it
  css.textContent = `
#bdt-eg-row { display: flex; align-items: flex-end; justify-content: center; gap: 22px; flex-wrap: wrap; }
#bdt-eg-continue {
  appearance: none; cursor: pointer; font: inherit; font-size: 29px; margin-top: 6px; padding: 14px 52px 12px;
  border-radius: 14px; color: rgb(255, 214, 160); background: rgba(255, 168, 74, 0.10);
  border: 1px solid rgba(255, 190, 120, 0.45); opacity: 0;
  transition: filter 0.18s ease, transform 0.14s ease, background-color 0.18s ease;
}
#endgame-overlay.eg-shown #bdt-eg-continue {
  animation: eg-btn-in 0.85s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--foot-at, 3.4s) + 0.95s) both;
}
#bdt-eg-continue:hover { background-color: rgba(255, 168, 74, 0.20); filter: brightness(1.1); }
#bdt-eg-continue:active { transform: translateY(1px) scale(0.988); }
#endgame-overlay.eg-closing #bdt-eg-continue { animation: none; opacity: 0; transition: opacity 0.2s ease; }`;
  document.head.appendChild(css);

  let leaving = false;   // the player pressed the game's own "End game": let it go to the menu
  let stuckSince = 0;

  function resume(why) {
    globalThis.resetEndGame();
    rt.globalVars.class = 'GAMEPLAY';
    rt.globalVars.LastClass = 'GAMEPLAY';
    BetterDT.log('[no-ending] game continues (' + why + '), day', rt.globalVars.DayTotal);
    setTimeout(kit.guard(() => {
      if (globalThis.isEndGameActive()) kit.fail('the end screen did not let the game continue');
    }), 1500);
  }

  function addButton() {
    const foot = document.querySelector('#endgame-overlay #eg-foot');
    if (!foot) return kit.warn('the end screen has no #eg-foot, continuing without it'), resume('no button place');
    if (foot.querySelector('#bdt-eg-continue')) return;
    const end = foot.querySelector('#eg-end');
    const row = document.createElement('div');
    row.id = 'bdt-eg-row';
    if (end) {
      end.addEventListener('click', () => { leaving = true; }, { capture: true, once: true });
      end.replaceWith(row);
      row.appendChild(end);
    } else foot.appendChild(row);
    const b = document.createElement('button');
    b.id = 'bdt-eg-continue';
    b.type = 'button';
    b.textContent = kit.text(10785) || 'Continue game';
    b.addEventListener('click', kit.guard(() => {
      if (leaving) return;
      globalThis.tapMain?.();
      b.disabled = true;
      resume('button');
    }));
    row.appendChild(b);
  }

  const tick = kit.guard(() => {
    if (globalThis.isEndGameScreenOpen()) {
      stuckSince = 0;
      if (leaving) return;
      if (S.bool('no-ending.skip', false)) resume('skip');
      else addButton();
      return;
    }
    // stuck: "END GAME" without the screen, for longer than the screen takes to close
    if (!leaving && rt.globalVars.class === END) {
      if (!stuckSince) stuckSince = Date.now();
      else if (Date.now() - stuckSince > 3000) { stuckSince = 0; resume('stuck without the end screen'); }
    } else stuckSince = 0;
  });
  const timer = setInterval(tick, 250);
  const onLayout = () => { leaving = false; stuckSince = 0; };
  rt.addEventListener('beforeanylayoutstart', onLayout);

  const dispose = () => {
    clearInterval(timer);
    rt.removeEventListener('beforeanylayoutstart', onLayout);
    document.getElementById('bdt-eg-continue')?.remove();
    const row = document.getElementById('bdt-eg-row');
    if (row) row.replaceWith(...row.childNodes);
    css.remove();
  };
  globalThis.__dtNoEnding = { dispose };
  return dispose;
});
