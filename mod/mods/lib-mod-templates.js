// Mod templates – the files of a new folder mod (Settings → BetterDT → Mods → Create a mod): mod.json and a mod.js
// that works as it is, with comments on what to change. Used by betterdt-settings.js and the node tests.
(() => {
  const IDS = ['empty', 'daily', 'button', 'sales', 'window'];

  // why a folder name cannot be a mod's name: '' when it can ('chars': only letters, digits, . _ -, not first .)
  function nameProblem(name, taken = []) {
    const n = String(name || '');
    if (!n) return 'empty';
    if (n.length > 60 || n[0] === '.' || !/^[A-Za-z0-9._-]+$/.test(n)) return 'chars';
    if (taken.some(t => String(t).toLowerCase() === n.toLowerCase() || String(t).toLowerCase() === n.toLowerCase() + '.js')) return 'taken';
    return '';
  }

  const json = (o) => JSON.stringify(o, null, 2) + '\n';
  const q = (s) => JSON.stringify(String(s));

  const HEAD = (name) => `// ${name} – a BetterDT mod. Save this file and, with Modder tools on (Settings > BetterDT > Mods), the mod
// is loaded again at once; otherwise restart the game. Errors show on the mod's card in Settings > BetterDT > Mods.
// The guide: MODDING.md on https://github.com/JelenXP/BetterDT
`;
  const BODY = {
    empty: (name) => `${HEAD(name)}
BetterDTKit.mod(${q(name)}, {
  // what the mod uses from the game: it turns itself off when a game update removes one of them
  needs: { vars: ['Budget'] },
}, (rt, kit) => {
  // runs once the game data is loaded (main menu); kit.on('gameLoaded', …) runs when a save is loaded
  kit.ui.toast('Hello from ${name}!');
});
`,
    daily: (name) => `${HEAD(name)}
BetterDTKit.mod(${q(name)}, {
  needs: { vars: ['Budget', 'ResearchCoins'] },
}, (rt, kit) => {
  // every game day: here 100 research points for every $1M of money, as an example
  kit.on('day', () => {
    kit.game.researchPoints += Math.floor(kit.game.money / 1e6) * 100;
  });
  // at the start of every month: a message with the money (the option "show" is in mod.json)
  kit.on('month', (date) => {
    if (kit.option('show')) kit.ui.toast(\`\${date.month}/\${date.year}: $\${Math.round(kit.game.money).toLocaleString()}\`);
  });
});
`,
    button: (name) => `${HEAD(name)}
BetterDTKit.mod(${q(name)}, {
  needs: { vars: ['Budget'] },
}, (rt, kit) => {
  // a button in the game's look, shown on one screen only (the screen names: Modder tools, F10 > Variables, or
  // the Inspector, F9); kit removes it when the mod stops
  const SCREEN = 'BOSS OFFICE';
  const b = kit.ui.button('My button', () => {
    kit.ui.toast('Money: $' + Math.round(kit.game.money).toLocaleString());
  }, { parent: document.body });
  Object.assign(b.style, { position: 'fixed', right: '2%', bottom: '12%', zIndex: 1000 });
  kit.on('screen', (screen) => { b.style.display = screen === SCREEN ? '' : 'none'; });
});
`,
    sales: (name) => `${HEAD(name)}
BetterDTKit.mod(${q(name)}, {}, (rt, kit) => {
  // the popularity of your devices while the game counts the daily sales, times the option "percent" (mod.json):
  // 150 = half as much again. Return 1 to leave a device as it is.
  kit.salesMultiplier(() => kit.option('percent') / 100);
});
`,
    window: (name) => `${HEAD(name)}
BetterDTKit.mod(${q(name)}, {
  needs: { vars: ['Budget', 'ResearchCoins'] },
}, (rt, kit) => {
  // a window in the game's look once a save is loaded, with your own content and buttons
  kit.on('gameLoaded', async () => {
    const pick = await kit.ui.dialog({
      title: 'My window',
      text: 'Money: $' + Math.round(kit.game.money).toLocaleString() + ', research points: ' + kit.game.researchPoints,
      content: (box) => { kit.ui.el('div', { textContent: 'Any HTML can go here.' }, box); },
      buttons: [{ label: '+1000 research points', go: true }, { label: 'Close' }],
    });
    if (pick === 0) kit.game.researchPoints += 1000;
  });
});
`,
  };
  const OPTIONS = {
    daily: [{ key: 'show', type: 'bool', default: true, label: 'Show the money every month' }],
    sales: [{ key: 'percent', type: 'range', default: 150, min: 50, max: 300, step: 10, label: 'Sales (%)' }],
  };
  const DESC = {
    empty: 'Says hello when the game starts.',
    daily: 'Research points every day, the money every month.',
    button: 'A button in the office that shows the money.',
    sales: 'More (or fewer) sales of your devices.',
    window: 'A window with a button when a save is loaded.',
  };

  // { 'mod.json': text, 'mod.js': text } of a new mod from a template
  function make(id, name, { title, author } = {}) {
    if (!IDS.includes(id)) id = 'empty';
    const manifest = {
      title: title || name,
      description: DESC[id],
      version: '1.0.0',
      author: author || '',
      requires: { betterdt: '0.4.0' },
    };
    if (OPTIONS[id]) manifest.options = OPTIONS[id];
    return { 'mod.json': json(manifest), 'mod.js': BODY[id](name) };
  }

  globalThis.BDTModTemplates = Object.freeze({ IDS, nameProblem, make });
})();
