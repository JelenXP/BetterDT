// Test copy only: the game's file writes go to memory (reads of those files come from memory), so testing never
// touches the save files; then slot 0 is loaded, the news is closed and the mods' states are returned.
const sleep = ms => new Promise(r => setTimeout(r, ms)); const g = rt.globalVars;
for (let i = 0; i < 60 && rt.layout.name !== 'MENU'; i++) await sleep(500);
if (!globalThis.__vfs) {
  const files = new Map();
  const t = rt.objects.FileSystem, targets = [t];
  try { const i = t.getFirstInstance(); if (i) targets.push(i); } catch { }
  for (const o of targets) {
    if (typeof o.writeFile === 'function') o.writeFile = async (a) => { files.set(a.folderPath || a.path, a.data ?? a.text ?? a.contents); };
    if (typeof o.readFile === 'function') {
      const orig = o.readFile.bind(o);
      o.readFile = async (a) => { const p = a.folderPath || a.path; return files.has(p) ? files.get(p) : orig(a); };
    }
  }
  globalThis.__vfs = { files };
}
rt.goToLayout('COMPANY CONTINUE GAME'); await sleep(2500);
selectContinueGameSlot(0); await sleep(500); continueGameLoadSlot();
for (let i = 0; i < 60 && !(+g.DayTotal > 0); i++) await sleep(500);
await sleep(4000);
// news and choices ("Later" / "Pay bonuses…") pause the game: the first button closes them
for (let i = 0; i < 10; i++) {
  const b = document.getElementById('office-news-btn-1');
  if (b && b.offsetParent) b.click();
  await sleep(700);
}
return { day: g.DayTotal, layout: rt.layout.name, mods: BetterDTKit.status().map(m => m.name + ':' + m.state + (m.problems.length ? ' (' + m.problems.join('; ') + ')' : '')) };
