// Testovací mod: po načtení pošle přehled runtime na lokální server (node probe-server.mjs).
// Slouží jen k ověření, že mody běží. Pro normální hraní ho z mods.json vyřaď.
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
