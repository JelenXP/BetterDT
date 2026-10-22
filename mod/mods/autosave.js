// Adjustable autosave – the game saves by itself every 30, 60, 90, 180 or 365 game days (or never); with this mod
// the player chooses any interval from 5 to 360 days, in steps of 5 (default 90). The game's own "Autosave" row in
// its settings (Gameplay) becomes a slider for this interval, saved right away; the same slider is in
// Settings → BetterDT → Mods.
//
// The game calls globalThis.tickAutoSave() once per game day (c3main.js). We replace it with the same logic
// and our interval. The save itself stays the game's: debugAutoSave() runs the game's own autosave
// (SaveGame with its backup and read-back check), which skips saving outside gameplay, while paused,
// while a save is in progress, on the bankruptcy and end-game screens. Then we try again the next day.
// With the mod turned off the game keeps its own interval and its own row in the settings.
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
  const MIN = 5, MAX = 360, STEP = 5;
  const every = () => Math.min(MAX, Math.max(MIN, S.num('autosave.days', 90)));
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

  // the game's settings row: its buttons (Off, 30 … 365) become a slider in the game's own look
  function settingsRow() {
    for (const seg of document.querySelectorAll('.gs-seg:not(.bdt-autosave-off)')) {
      const labels = [...seg.querySelectorAll('.gs-seg-btn')].map(b => b.textContent.trim());
      if (labels.slice(1).join(',') !== '30,60,90,180,365') continue;
      seg.classList.add('bdt-autosave-off');
      seg.style.display = 'none';
      const box = document.createElement('div');
      box.className = 'gs-slider bdt-autosave';
      const input = document.createElement('input');
      input.type = 'range'; input.className = 'gs-range';
      input.min = String(MIN); input.max = String(MAX); input.step = String(STEP); input.value = String(every());
      const val = document.createElement('div');
      val.className = 'gs-slider-val';
      const show = () => {
        val.textContent = input.value;
        input.style.setProperty('--fill', ((input.value - MIN) / (MAX - MIN) * 100).toFixed(2) + '%');
      };
      input.addEventListener('input', kit.guard(() => {
        show();
        Promise.resolve(S.set('autosave.days', Number(input.value))).catch(e => console.error('[autosave] save', e));
      }));
      box.append(input, val);
      seg.after(box);
      show();
    }
  }

  const timer = setInterval(kit.guard(() => {
    install();
    settingsRow();
    const day = today();
    // a started or loaded game moves the day without a call: count from there
    if (tickDay < 0 || day < tickDay || day - tickDay > 30) tickDay = day;
    else if (day - tickDay >= 3) kit.fail('the game no longer calls tickAutoSave()');
  }), 1000);

  return () => {
    clearInterval(timer);
    for (const b of document.querySelectorAll('.bdt-autosave')) b.remove();
    for (const seg of document.querySelectorAll('.bdt-autosave-off')) { seg.style.display = ''; seg.classList.remove('bdt-autosave-off'); }
    if (globalThis.tickAutoSave === tick) globalThis.tickAutoSave = origTick;
    if (globalThis.resetAutoSave === resetWrap) globalThis.resetAutoSave = origReset;
  };
});
