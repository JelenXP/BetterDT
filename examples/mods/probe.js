// Test mod: after loading, sends a runtime overview to a local server (node probe-server.mjs).
// Only for checking that mods run. Remove it from mods.json for normal play.
DTMods.register('probe', runtime => {
  const report = () => {
    const info = {
      layout: runtime.layout.name,
      objectTypes: Object.keys(runtime.objects).length,
      globalVars: Object.fromEntries(Object.entries(runtime.globalVars).slice(0, 40)),
    };
    fetch('http://127.0.0.1:9334/probe', { method: 'POST', mode: 'no-cors', body: JSON.stringify(info) }).catch(() => {});
  };
  report();
  setInterval(report, 5000);
});
