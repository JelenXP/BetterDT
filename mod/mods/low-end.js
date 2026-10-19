// Low-end mode – lighter rendering for older computers (Settings → BetterDT → Mods, both options off by default).
//
// "Limit to 30 FPS": the game draws at the monitor's refresh rate by default (vsync), also on static menus, where
// nothing moves. A fixed 30 FPS cuts the CPU and GPU work there several times (measured on the main menu:
// CPU 10 % → 2 %, GPU 13 % → 2 %). Game time does not depend on the frame rate. The limit is set only at runtime
// (runtime.framerateMode / fixedFramerate) and the game's own FPS setting is left alone: when the game applies
// its settings again, the mod sets the limit back within a second; when the option is turned off, the game's
// setting comes back. A game setting of a fixed 30 FPS or less is kept.
//
// "Turn off blur": the game's HTML panels blur what is behind them (backdrop-filter). The panels stay
// semi-transparent, only without the blur, which weak integrated graphics have to redo on every frame.
BetterDTKit.mod('low-end', {
  needs: { objects: ['ArraySettings'], check: (rt) => ('framerateMode' in rt && 'fixedFramerate' in rt ? '' : 'runtime.framerateMode') },
}, (rt, kit) => {
  if (globalThis.__dtLowEnd) globalThis.__dtLowEnd.dispose();
  const S = BetterDT.settings;
  const LIMIT = 30;

  const css = document.createElement('style');
  css.id = 'bdt-low-end-css';
  css.textContent = '*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';

  // the game's own FPS setting: ArraySettings (0,6) mode 0 = vsync / 1 = fixed, (0,7) frame rate
  function gameFps() {
    try {
      const a = rt.objects.ArraySettings.getFirstInstance();
      return { fixed: Number(a.getAt(0, 6)) === 1, fps: Number(a.getAt(0, 7)) || 60 };
    } catch { return null; }
  }
  let limited = false;
  function restore() {
    limited = false;
    const g = gameFps();
    if (g && g.fixed) { rt.framerateMode = 'fixed'; rt.fixedFramerate = g.fps; } else rt.framerateMode = 'vsync';
  }
  function apply() {
    if (S.bool('low-end.fps', false)) {
      const g = gameFps();
      if (g && g.fixed && g.fps <= LIMIT) {   // the game itself is set to 30 or less: keep it
        limited = false;
      } else if (rt.framerateMode !== 'fixed' || rt.fixedFramerate !== LIMIT) {
        rt.framerateMode = 'fixed';
        rt.fixedFramerate = LIMIT;
        if (!limited) BetterDT.log('[low-end] frame rate limited to', LIMIT);
        limited = true;
      }
    } else if (limited) {
      restore();
      BetterDT.log('[low-end] frame rate back to the game setting');
    }
    const blur = S.bool('low-end.blur', false);
    if (blur && !css.isConnected) document.head.appendChild(css);
    else if (!blur && css.isConnected) css.remove();
  }
  apply();
  const timer = setInterval(kit.guard(apply), 1000);

  const dispose = () => {
    clearInterval(timer);
    css.remove();
    if (limited) restore();
  };
  globalThis.__dtLowEnd = { dispose };
  return dispose;
});
