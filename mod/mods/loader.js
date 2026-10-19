// Jednoduchý loader JS modů pro Devices Tycoon.
// Načte mods/mods.json (seznam souborů) a každý mod spustí, jakmile existuje runtime Constructu.
// Mod je obyčejný skript, který zavolá DTMods.register("jméno", runtime => { ... }).
(() => {
  const mods = [];
  const log = (...a) => console.log('[DTMods]', ...a);

  globalThis.DTMods = {
    register(name, init) { mods.push({ name, init }); },
    log,
  };

  function startAll(runtime) {
    for (const m of mods) {
      try { m.init(runtime); log('spuštěn mod', m.name); }
      catch (e) { console.error('[DTMods] mod', m.name, 'spadl:', e); }
    }
  }

  function waitForRuntime() {
    const rt = globalThis.runtime;
    if (rt && rt.objects && rt.layout) startAll(rt);
    else setTimeout(waitForRuntime, 250);
  }

  fetch('mods/mods.json')
    .then(r => r.json())
    .then(list => Promise.all(list.map(src => new Promise(res => {
      const s = document.createElement('script');
      s.src = 'mods/' + src;
      s.onload = res;
      s.onerror = () => { console.error('[DTMods] nejde načíst', src); res(); };
      document.head.appendChild(s);
    }))))
    .then(waitForRuntime)
    .catch(e => console.error('[DTMods] mods.json:', e));
})();
