// Adjustable autosave – the game saves by itself at a fixed interval of game days; with this mod the player
// chooses how often (Settings → BetterDT → Mods, default 30 days, 5 to 180).
//
// The game calls globalThis.tickAutoSave() once per game day (c3main.js). We replace it with the same logic
// and our interval. The save itself stays the game's: debugAutoSave() runs the game's own autosave
// (SaveGame with its backup and read-back check), which skips saving outside gameplay, while paused,
// while a save is in progress, on the bankruptcy and end-game screens. Then we try again the next day.
// With the mod turned off the game keeps its own interval.
BetterDT.register('autosave', (rt) => {
  const S = BetterDT.settings, gv = rt.globalVars;
  const every = () => Math.min(180, Math.max(5, S.num('autosave.days', 30)));
  let last = -1;   // game day of the last autosave, or of the start / loading of the game

  function tick() {
    const day = Number(gv.DayTotal) || 0;
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
  }

  // the game resets its counter when a game is started or loaded; ours follows
  let resetWrap = null;
  function install() {
    if (typeof globalThis.debugAutoSave !== 'function') return;
    if (globalThis.tickAutoSave !== tick) globalThis.tickAutoSave = tick;
    if (globalThis.resetAutoSave !== resetWrap) {
      const orig = globalThis.resetAutoSave;
      resetWrap = function () { last = -1; return typeof orig === 'function' ? orig.apply(this, arguments) : undefined; };
      globalThis.resetAutoSave = resetWrap;
    }
  }
  install();
  setInterval(install, 1000);
});
