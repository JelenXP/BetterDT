// Game speed – the speed button in the corner (×1 → ×1.25 → ×1.5) gets more steps: the speeds turned on in
// Settings > BetterDT (×2 and ×3 by default; ×4, ×5, ×6, ×8 and ×10 can be added).
//
// The game's button cycles through a fixed list [1, 1.25, 1.5]. The mod catches the click on the button
// before the game does and goes to the next speed of [1, 1.25, 1.5, …the speeds turned on] with the game's own
// setGameSpeed(), which accepts any speed: the game sets the time scale, writes "×4" on the button and keeps
// its rules (normal speed outside gameplay, speed again after returning). Every speed of the mod gets its own colour
// (the game has them for ×1.25 and ×1.5). If a game update already offers ×2 or ×3 itself, the mod steps aside.
BetterDTKit.mod('game-speed', {
  needs: { functions: ['setGameSpeed', 'getGameSpeed'] },
}, (rt, kit) => {
  if (globalThis.__dtGameSpeed) globalThis.__dtGameSpeed.dispose();

  // the extra speeds and their colours (the game: ×1.25 light blue, ×1.5 orange)
  const EXTRA = { 2: '255, 92, 72', 3: '236, 84, 255', 4: '255, 214, 64', 5: '110, 230, 110', 6: '64, 224, 208', 8: '120, 130, 255', 10: '255, 110, 190' };
  const speeds = () => [1, 1.25, 1.5, ...Object.keys(EXTRA).map(Number).filter(v => BetterDT.settings.bool('game-speed.x' + v, v <= 3))];
  const log = (...a) => (globalThis.BetterDT ? BetterDT.log : console.log)('[game-speed]', ...a);

  // the game keeps its .sbx-spd-150 class above ×1.5, so the rules are more specific than its own
  const css = document.createElement('style');
  css.id = 'bdt-game-speed-css';
  css.textContent = `
${Object.entries(EXTRA).map(([v, rgb]) => `#sbx-speed.sbx-fast.bdt-spd-${v} { --spd-rgb: ${rgb}; }`).join(' ')}`;
  document.head.appendChild(css);

  const current = () => { try { return Number(globalThis.getGameSpeed()) || 1; } catch { return 1; } };
  function next() {
    const s = current();
    const list = speeds(), i = list.findIndex(v => Math.abs(v - s) < 0.01);
    return list[(i + 1) % list.length];   // an unknown speed (-1, or one turned off) goes to ×1
  }
  function paint(el) {
    const s = current();
    for (const v of Object.keys(EXTRA)) el.classList.toggle('bdt-spd-' + v, Math.abs(s - v) < 0.01);
  }

  // capture listener on the button itself: at the target it runs before the game's click listener
  const onClick = kit.guard(function (e) {
    if (typeof globalThis.setGameSpeed !== 'function') return;   // leave it to the game
    e.stopImmediatePropagation();
    globalThis.tapMain?.();
    const el = e.currentTarget, s = next();
    Promise.resolve(globalThis.setGameSpeed(s)).then(() => paint(el)).catch(err => log(err));
  });
  const btn = () => document.getElementById('sbx-speed');
  let bound = null;
  // the game colours its speeds with .sbx-spd-125 / .sbx-spd-150; a rule for 200 or 300 in its styles means a
  // game update added these speeds itself, so the mod steps aside
  function gameHasFast() {
    for (const sh of document.styleSheets) {
      if (sh.ownerNode === css) continue;
      let rules = null;
      try { rules = sh.cssRules; } catch { continue; }
      for (const r of rules) if (/sbx-spd-(200|300)/.test(r.selectorText || '')) return true;
    }
    return false;
  }
  const timer = setInterval(kit.guard(() => {
    const el = btn();
    if (el && el !== bound) {
      if (gameHasFast()) return kit.fail('the game itself offers ×2 / ×3 now');
      bound?.removeEventListener('click', onClick, true);
      el.addEventListener('click', onClick, true);
      bound = el;
    }
    if (el) paint(el);   // also after the game resets the speed
  }), 500);

  const dispose = () => {
    clearInterval(timer);
    bound?.removeEventListener('click', onClick, true);
    for (const v of Object.keys(EXTRA)) bound?.classList.remove('bdt-spd-' + v);
    css.remove();
  };
  globalThis.__dtGameSpeed = { dispose };
  return dispose;
});
