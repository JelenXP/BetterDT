// Game speed – the speed button in the corner (×1 → ×1.25 → ×1.5) gets two more steps: ×2 and ×3.
//
// The game's button cycles through a fixed list [1, 1.25, 1.5]. The mod catches the click on the button
// before the game does and goes to the next speed of [1, 1.25, 1.5, 2, 3] with the game's own
// setGameSpeed(), which accepts any speed: the game sets the time scale, writes "×2" on the button and keeps
// its rules (normal speed outside gameplay, speed again after returning). The mod only adds colours for ×2 and ×3
// (the game has them for ×1.25 and ×1.5).
DTMods.register('game-speed', (rt) => {
  if (globalThis.__dtGameSpeed) globalThis.__dtGameSpeed.dispose();

  const SPEEDS = [1, 1.25, 1.5, 2, 3];
  const log = (...a) => (globalThis.BetterDT ? BetterDT.log : console.log)('[game-speed]', ...a);

  const css = document.createElement('style');
  css.id = 'bdt-game-speed-css';
  css.textContent = `
#sbx-speed.bdt-spd-200 { --spd-rgb: 255, 92, 72; }
#sbx-speed.bdt-spd-300 { --spd-rgb: 236, 84, 255; }`;
  document.head.appendChild(css);

  const current = () => { try { return Number(globalThis.getGameSpeed()) || 1; } catch { return 1; } };
  function next() {
    const s = current();
    const i = SPEEDS.findIndex(v => Math.abs(v - s) < 0.01);
    return SPEEDS[(i + 1) % SPEEDS.length];   // an unknown speed (-1) goes to ×1
  }
  function paint(el) {
    const s = current();
    el.classList.toggle('bdt-spd-200', s >= 1.75 && s < 2.5);
    el.classList.toggle('bdt-spd-300', s >= 2.5);
  }

  // capture listener on the button itself: at the target it runs before the game's click listener
  function onClick(e) {
    if (typeof globalThis.setGameSpeed !== 'function') return;   // leave it to the game
    e.stopImmediatePropagation();
    globalThis.tapMain?.();
    const el = e.currentTarget, s = next();
    Promise.resolve(globalThis.setGameSpeed(s)).then(() => paint(el)).catch(err => log(err));
  }
  const btn = () => document.getElementById('sbx-speed');
  let bound = null;
  const timer = setInterval(() => {
    const el = btn();
    if (el && el !== bound) {
      bound?.removeEventListener('click', onClick, true);
      el.addEventListener('click', onClick, true);
      bound = el;
    }
    if (el) paint(el);   // also after the game resets the speed
  }, 500);

  globalThis.__dtGameSpeed = {
    dispose() {
      clearInterval(timer);
      bound?.removeEventListener('click', onClick, true);
      bound?.classList.remove('bdt-spd-200', 'bdt-spd-300');
      css.remove();
    },
  };
});
