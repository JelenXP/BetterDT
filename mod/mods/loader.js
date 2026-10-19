// Simple JS mod loader for Devices Tycoon (used by dtmod install inside assets.dat).
// Loads mods/mods.json (list of files) and starts every mod as soon as the Construct runtime exists.
// A mod is a plain script that calls DTMods.register("name", runtime => { ... }).
(() => {
  const mods = [];
  const log = (...a) => console.log('[DTMods]', ...a);

  globalThis.DTMods = {
    register(name, init) { mods.push({ name, init }); },
    log,
  };

  function startAll(runtime) {
    for (const m of mods) {
      try { m.init(runtime); log('started mod', m.name); }
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
      s.onerror = () => { console.error('[DTMods] cannot load', src); res(); };
      document.head.appendChild(s);
    }))))
    .then(waitForRuntime)
    .catch(e => console.error('[DTMods] mods.json:', e));
})();
