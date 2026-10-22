// Fixed FPS fix – a high "fixed FPS" in the game settings no longer slows the game down.
//
// In Construct's "fixed" frame rate mode every tick moves the game time by exactly 1 / FPS, whatever time really
// passed. The ticks are timed with setTimeout, and the browser cannot run them much faster than about 190 per
// second (timer clamping plus the game's own work per tick). So with a fixed 240 FPS the game time ran at about
// 78 % of real time, with 500 FPS at about 37 %: the higher the setting, the slower the game (measured in game 1.4).
//
// The mod makes the runtime measure the real time between ticks in fixed mode too, exactly as it does in the default
// vsync mode (same limits: at most 0.1 s per tick, and a pause longer than 0.5 s counts as nothing). The ticks are
// still paced at the chosen FPS. When the computer keeps up, the real time between ticks is 1 / FPS anyway, so
// nothing changes. It patches Runtime._MeasureDt for the duration of the call only: the runtime asks
// GetFramerateMode() there, and the mod answers "vsync" to that one question.
//
// Game 1.6 works around the slowdown differently: it caps the fixed FPS at 165 (every second it sets anything higher
// back to 165, and its list of FPS limits ends there). With the slowdown fixed, the mod allows more: when the
// game's limit is set to 165, the runtime runs at the FPS chosen in Settings → BetterDT → Mods (165 to 360, default
// 165 = the game's own). The game keeps seeing 165 (the runtime's fixedFramerate reads at most 165 while the higher
// value is in use), so its cap leaves it alone and its settings page shows its own value.
BetterDTKit.mod('fixed-fps', {
  needs: {
    check: () => {
      const p = globalThis.C3 && C3.Runtime && C3.Runtime.prototype;
      if (!p || typeof p._MeasureDt !== 'function' || typeof p.GetFramerateMode !== 'function') return 'C3.Runtime._MeasureDt';
      // the trick only works while the measurement asks GetFramerateMode() for the "fixed" branch
      const src = String(p._MeasureDt);
      return /"fixed"\s*===\s*this\.GetFramerateMode\(\)/.test(src) && /_lastTickTime/.test(src) ? '' : 'Runtime._MeasureDt has changed';
    },
  },
}, (rt, kit) => {
  if (globalThis.__dtFixedFps) globalThis.__dtFixedFps.dispose();

  const proto = C3.Runtime.prototype;
  const orig = proto._MeasureDt;
  const vsync = () => 'vsync';
  let on = true;
  const patched = function (e) {
    if (!on || this.GetFramerateMode() !== 'fixed' || Object.prototype.hasOwnProperty.call(this, 'GetFramerateMode')) return orig.call(this, e);
    this.GetFramerateMode = vsync;
    try { return orig.call(this, e); } finally { delete this.GetFramerateMode; }
  };
  proto._MeasureDt = patched;
  BetterDT.log('[fixed-fps] real time between ticks in fixed FPS mode');

  // ── more than the game's 165 FPS ──────────────────────────────────────────────────────────────
  const GAME_MAX = 165;
  const S = BetterDT.settings;
  const wanted = () => Math.min(360, Math.max(GAME_MAX, S.num('fixed-fps.max', GAME_MAX)));
  let desc = null;
  for (let o = Object.getPrototypeOf(rt); o && !desc; o = Object.getPrototypeOf(o)) desc = Object.getOwnPropertyDescriptor(o, 'fixedFramerate');
  const real = { get: () => desc.get.call(rt), set: (v) => desc.set.call(rt, v) };
  if (desc && desc.get && desc.set) {
    Object.defineProperty(rt, 'fixedFramerate', {
      configurable: true,
      get() { const v = real.get(); return on && v > GAME_MAX ? GAME_MAX : v; },
      set(v) { real.set(on && Number(v) === GAME_MAX ? wanted() : v); },
    });
  } else kit.warn('runtime.fixedFramerate not found: the FPS stays at most 165');
  // a change of the option applies at once when the game's limit is 165
  const timer = setInterval(kit.guard(() => {
    if (!desc || rt.framerateMode !== 'fixed') return;
    const v = real.get();
    if (v >= GAME_MAX && v !== wanted()) real.set(wanted());
  }), 1000);

  const dispose = () => {
    on = false;
    clearInterval(timer);
    if (desc) {
      const v = real.get();
      delete rt.fixedFramerate;
      if (v > GAME_MAX) real.set(GAME_MAX);
    }
    // put the original back only if nobody patched it after us
    if (proto._MeasureDt === patched) proto._MeasureDt = orig;
  };
  globalThis.__dtFixedFps = { dispose };
  return dispose;
});
