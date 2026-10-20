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

  const dispose = () => {
    on = false;
    // put the original back only if nobody patched it after us
    if (proto._MeasureDt === patched) proto._MeasureDt = orig;
  };
  globalThis.__dtFixedFps = { dispose };
  return dispose;
});
