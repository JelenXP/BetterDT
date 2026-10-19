// Adjustable autosave – the game saves by itself at a fixed interval of game days; with this mod the player
// chooses how often (Settings → BetterDT → Mods, default 90 days, 5 to 180).
//
// The game calls globalThis.tickAutoSave() once per game day (c3main.js). We replace it with the same logic
// and our interval. The save itself stays the game's: debugAutoSave() runs the game's own autosave
// (SaveGame with its backup and read-back check), which skips saving outside gameplay, while paused,
// while a save is in progress, on the bankruptcy and end-game screens. Then we try again the next day.
// With the mod turned off the game keeps its own interval.
//
// Game updates: the mod starts only when the game's autosave functions are there and getAutoSaveState() still
// reports what the mod reads. If the game stops calling tickAutoSave() (three game days without a call), the mod
// gives the game its own functions back and stops, so the game keeps saving the way it does by itself.
BetterDTKit.mod('autosave', {
  needs: {
    functions: ['tickAutoSave', 'resetAutoSave', 'debugAutoSave', 'getAutoSaveState'],
    vars: ['DayTotal'],
    check: () => {
      const s = globalThis.getAutoSaveState();
      return s && typeof s.savedThisSession === 'number' && 'everyDays' in s ? '' : 'getAutoSaveState() changed';
    },
  },
}, (rt, kit) => {
  const S = BetterDT.settings, gv = rt.globalVars;
  const every = () => Math.min(180, Math.max(5, S.num('autosave.days', 90)));
  const today = () => Number(gv.DayTotal) || 0;
  let last = -1;          // game day of the last autosave, or of the start / loading of the game
  let tickDay = today();  // game day of the last call from the game

  const tick = kit.guard(function () {
    const day = tickDay = today();
    if (day <= 0) return;
    if (last < 0 || day < last) { last = day; return; }   // new or loaded game: count from here, like the game
    if (day - last < every()) return;
    const state = () => { try { return globalThis.getAutoSaveState(); } catch { return null; } };
    const before = state();
    globalThis.debugAutoSave();
    const after = state();
    if (!before || !after || after.savedThisSession > before.savedThisSession) {
      last = day;
      BetterDT.log('autosave on game day', day, '(every', every(), 'days)');
    }
  });

  // the game resets its counter when a game is started or loaded; ours follows
  const origTick = globalThis.tickAutoSave, origReset = globalThis.resetAutoSave;
  const resetWrap = function () { last = -1; tickDay = -1; return origReset.apply(this, arguments); };
  function install() {
    if (globalThis.tickAutoSave !== tick) globalThis.tickAutoSave = tick;
    if (globalThis.resetAutoSave !== resetWrap) globalThis.resetAutoSave = resetWrap;
  }
  install();

  const timer = setInterval(kit.guard(() => {
    install();
    const day = today();
    // a started or loaded game moves the day without a call: count from there
    if (tickDay < 0 || day < tickDay || day - tickDay > 30) tickDay = day;
    else if (day - tickDay >= 3) kit.fail('the game no longer calls tickAutoSave()');
  }), 1000);

  return () => {
    clearInterval(timer);
    if (globalThis.tickAutoSave === tick) globalThis.tickAutoSave = origTick;
    if (globalThis.resetAutoSave === resetWrap) globalThis.resetAutoSave = origReset;
  };
});
