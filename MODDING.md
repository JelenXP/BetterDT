# Writing your own BetterDT mod

This guide explains how to write a mod for Devices Tycoon that runs with BetterDT: where the file goes, how it is
loaded, the BetterDTKit API, the parts of the game a mod usually needs and how to find the rest without reading the
game's code. A complete, working example is [`examples/mods/money-goal.js`](examples/mods/money-goal.js).

Contents:

1. [What a mod is](#1-what-a-mod-is)
2. [Your first mod in five minutes](#2-your-first-mod-in-five-minutes)
3. [How mods are loaded](#3-how-mods-are-loaded)
4. [BetterDTKit.mod reference](#4-betterdtkitmod-reference)
5. [The `kit` object](#5-the-kit-object)
6. [The `BetterDT` object: settings and log](#6-the-betterdt-object-settings-and-log)
7. [The game runtime (Construct 3)](#7-the-game-runtime-construct-3)
8. [Finding things in the game](#8-finding-things-in-the-game)
9. [Recipes](#9-recipes)
10. [Setting up for development](#10-setting-up-for-development)
11. [Rules for a good mod](#11-rules-for-a-good-mod)
12. [Sharing your mod](#12-sharing-your-mod)
13. [Troubleshooting](#13-troubleshooting)

## 1. What a mod is

Devices Tycoon is a [Construct 3](https://www.construct.net/) game that runs in a WebView2 window (Chromium). A
BetterDT mod is a plain JavaScript file. BetterDT injects it into the game page at runtime, so a mod can:

- read and change everything the game keeps in its variables and tables (money, research points, employees, devices,
  companies, …),
- call the game's own functions (the game has about 2,000 global JavaScript functions, `setGameSpeed`,
  `hireEmployee`, `investingQuote`, …),
- run code before or after actions of the game's event sheets,
- add HTML elements (buttons, panels, dialogs) over the game.

A mod never changes a game file. It exists only while the game runs, so removing the file removes the mod.

## 2. Your first mod in five minutes

1. Open the game folder (Steam → Library → right-click Devices Tycoon → Manage → Browse local files). BetterDT must be
   installed: there is a `mods` folder next to `Devices Tycoon.exe`.
2. Create `mods\hello.js`:

   ```js
   BetterDTKit.mod('hello', {
     needs: { vars: ['Budget'] },
   }, (rt, kit) => {
     const timer = setInterval(kit.guard(() => {
       BetterDT.log('money:', rt.globalVars.Budget);
     }), 5000);
     return () => clearInterval(timer);
   });
   ```

3. Add the file name at the end of the list in `mods\mods.json`:

   ```json
   ["betterdt-settings.js", "os-perf.js", "…", "hello.js"]
   ```

4. Start the game. Settings → BetterDT → Mods now has a card **hello.js** ("Custom mod · hello.js") with an on/off switch.

After every change to the file, restart the game: mods are read once, when the game starts.

To see what `BetterDT.log` writes you need the developer console; see
[Setting up for development](#10-setting-up-for-development). Until then, the example in
[`examples/mods/money-goal.js`](examples/mods/money-goal.js) shows its output on screen.

## 3. How mods are loaded

- **Order:** the files listed in `mods\mods.json`, in that order. `betterdt-settings.js` comes first; it creates
  `BetterDTKit`. Put your mod at the end. A file that is not in the list is not loaded. The names must end with
  `.js` and must not contain spaces, slashes or `..`.
- **When the file runs:** right when the game page is created, before the game engine exists. Every file is wrapped in
  its own function, so `const`/`let`/`function` at the top level of your file are private to it. Do not touch the
  game at the top level; do it in the function you give to `BetterDTKit.mod`.
- **When your mod starts:** once the game data is loaded, normally when the main menu appears. At that moment no saved game is loaded yet (`DayTotal` is 0); the company tables
  are empty until the player loads or starts a game.
- **One start per game run:** your mod is started once. Loading another save does not restart it, so code that
  depends on the loaded game must notice the change itself (see [Recipes](#9-recipes)).
- **On/off:** the switch in Settings → BetterDT → Mods is stored as `mod.<file>=0` in `mods\betterdt.ini`. A mod
  that is turned off is not loaded at all; the switch takes effect after a restart.
- **Updates:** a BetterDT update keeps your files and keeps them in `mods.json`. Do not name your file like an
  official mod (see the list in `mods.json`).
- **Errors:** an exception while your file loads or while your mod starts is caught and logged; the other mods and
  the game keep running. Settings → BetterDT shows the state of your mod (see [section 4](#4-betterdtkitmod-reference)).

There is also `BetterDT.register('name', rt => { … })`: it starts the function as soon as the engine exists, without
any checks, error counting or settings integration. Use `BetterDTKit.mod` unless you have a reason not to.

## 4. BetterDTKit.mod reference

```js
BetterDTKit.mod(name, spec, init)
```

- `name`: the file name without `.js`. Settings → BetterDT finds the state of your mod by this name.
- `spec`: what your mod needs from the game (below). BetterDT checks it before the mod starts. When something is
  missing, typically after a game update, the mod does not start and the settings show which part is missing,
  instead of the mod breaking the game.
- `init(rt, kit)`: starts your mod. `rt` is the game runtime ([section 7](#7-the-game-runtime-construct-3)), `kit`
  the helpers ([section 5](#5-the-kit-object)). Return a function that removes everything the mod added (timers,
  listeners, elements, changed functions). It runs when the mod is stopped.

### `spec.needs`

All entries are optional. List what your mod uses, so it is switched off cleanly when the game changes.

| Entry | Example | Checks that … |
| --- | --- | --- |
| `functions` | `['setGameSpeed', 'getGameSpeed']` | a global JavaScript function of the game exists |
| `objects` | `['ArrayEmployees', 'Text']` | an object type exists (`rt.objects[name]`) |
| `vars` | `['Budget', 'DayTotal']` | a global variable exists (`rt.globalVars[name]`) |
| `calls` | `['ReviewsEngineResults']` | a function of the game's event sheets exists (for `kit.wrapCalls`) |
| `actions` | `[123456]` | an event sheet action with this SID exists (for `kit.wrapAction`) |
| `check` | `rt => rt.framerateMode ? '' : 'framerateMode'` | anything else: return `''` when fine, otherwise a short problem text |
| `arrays` | `{ ArrayOffices: [5, 1] }` | an array has at least this width and height **once a game is loaded** |
| `dataCheck` | `rt => …` | like `check`, but **once a game is loaded** |

`arrays` and `dataCheck` run after a save is loaded, because the company tables are empty in the menu. A mod that
fails them is stopped at that moment (its dispose function runs).

### `spec.texts`

```js
texts: { 10974: "You don't have enough funds" }
```

Game texts by index in `ArrayLanguage`, with their English wording. When a game update moves a text to another index,
BetterDT finds it again by the English wording. Read them with `kit.text(10974)`; you get the text in the player's
language. A text that is not found at all makes the mod incompatible.

### `spec.uids`

```js
uids: { 19896: { layout: 'FIND EMPLOYEES', t: '9patch3', l: 'UI (Touched)', h: 64, x: 790, y: 590 } }
```

Instances placed on a screen (layout) by the game, by their UID. A game update can change UIDs; with this description
(`layout`, object type `t`, layer `l`, optional `w`/`h`, position `x`/`y`) `kit.inst(uid)` finds the instance of that
type on that layer with that size nearest to the position, and logs a warning. Prefer finding instances by type,
layer and instance variables when you can; use UIDs for objects that have nothing else to tell them apart.

### States

`BetterDTKit.status()` returns `[{ name, state, problems }]` for all mods. The settings show the same.

| State | Meaning |
| --- | --- |
| `waiting` | the game data is not loaded yet |
| `running` | started; `problems` may contain warnings from `kit.warn` |
| `incompatible` | something in `spec` is missing (the list is in `problems`); `init` did not run or the mod was stopped |
| `failed` | `init` threw, or a function wrapped by `kit.guard` threw 20 times |

Other members of `BetterDTKit`: `BetterDTKit.gameVersion` (for example `'1.6.0'`),
`BetterDTKit.whenReady(rt, callback)` (runs once the game data is loaded and the mods were checked), and
`BetterDTKit.eventSheets()` (the engine's internal event sheet manager, for advanced use).

## 5. The `kit` object

### `kit.guard(fn)`

Returns a function that runs `fn` only while the mod is running and catches its errors. After 20 errors the mod is
stopped and its dispose function runs, so a broken mod cannot flood the game with exceptions. Wrap every timer,
event listener and callback you give to the game or the browser:

```js
const onTick = kit.guard(() => { /* every frame */ });
rt.addEventListener('tick', onTick);
const onKey = kit.guard((e) => { /* … */ });
document.addEventListener('keydown', onKey, true);
return () => {
  rt.removeEventListener('tick', onTick);
  document.removeEventListener('keydown', onKey, true);
};
```

### `kit.text(index)`

A game text in the player's language (`''` when not found). Declare the index in `spec.texts` so it survives game
updates. See [Finding a text](#finding-a-text) for how to find an index.

### `kit.inst(uid)`

The instance with this UID, or the best match of its description in `spec.uids`. The result is cached for the visit
of the screen. Returns `null` when not found.

### `kit.wrapCalls(eventFunction, { before, after })`

Runs your code before and/or after every place in the event sheets that calls the event function `eventFunction`.
Returns the number of call sites (0 = nothing wrapped). Example from `fair-reviews.js`: after the game computed a
review, replace its results:

```js
kit.wrapCalls('ReviewsEngineResults', {
  after: () => { /* read and overwrite the review variables */ },
});
```

Calling the function yourself with `rt.callFunction('ReviewsEngineResults')` does **not** run your wrappers; only the
game's own call sites are wrapped.

### `kit.wrapAction(sid, { before, after })` and `kit.wrapScript(name, { before, after })`

The same for one event sheet action by its SID, and for the script actions of the event sheets (the functions named
like `EventGameplay_Event449_Act1`). Both return what they wrapped (`true`/`false` or a count). When an action is
asynchronous, `after` runs once it settled.

All wrappers are removed automatically when the mod stops. `before` and `after` are guarded like `kit.guard`.

### `kit.warn(problem)`, `kit.fail(problem)`, `kit.onStop(fn)`

- `kit.warn('…')` records a warning (once per text). The mod keeps running; the settings show the warning.
- `kit.fail('…')` stops the mod as incompatible, for problems you only notice later.
- `kit.onStop(fn)` runs `fn` when the mod stops, before your dispose function.

## 6. The `BetterDT` object: settings and log

### Settings

Settings are stored in `mods\betterdt.ini` as `key=value` lines. Keys may contain letters, digits, `.`, `_` and `-`
(up to 80 characters); start them with your mod's name.

```js
const S = BetterDT.settings;
S.bool('hello.loud', false);        // true/false; '0', 'false', 'off', 'no' are false
S.num('hello.days', 30);            // a number, or the default when missing or not a number
S.get('hello.name', 'Bob');         // the stored string
S.set('hello.days', 45);            // saves right away (returns a promise)
const off = S.onChange((key, value) => { /* value is a string */ });   // returns a function that unsubscribes
```

The settings page of BetterDT shows options only for the official mods. Players can change your options by editing
`mods\betterdt.ini` while the game is closed (`hello.days=45`), or you can add your own UI (see
[Recipes](#9-recipes)).

### Other members

| Member | Meaning |
| --- | --- |
| `BetterDT.log(...)` | `console.log` with a `[BetterDT]` prefix |
| `BetterDT.version` | the version of BetterDT, for example `'0.3.8'` |
| `BetterDT.mods` | `[{ file, enabled }]` for the files in `mods.json` |
| `BetterDT.register(name, init)` | the plain start without checks (see [section 3](#3-how-mods-are-loaded)) |

`DTMods` is the same object, for older mods.

## 7. The game runtime (Construct 3)

`rt` is Construct 3's `IRuntime`. Its full reference is the
[Construct 3 scripting reference](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/iruntime).
What mods use most:

| Code | What it is |
| --- | --- |
| `rt.globalVars.Budget` | a global variable of the event sheets; read and write it like a property |
| `rt.objects.ArrayEmployees.getFirstInstance()` | the only instance of a table (Construct `Array`) |
| `a.width`, `a.height`, `a.getAt(x, y)`, `a.setAt(value, x, y)` | size and cells of a table |
| `rt.objects.Text.getAllInstances()` | all instances of an object type on the current screen |
| `inst.uid`, `inst.x`, `inst.y`, `inst.width`, `inst.height`, `inst.layer.name`, `inst.instVars` | an instance |
| `inst.text` | the text of a `Text` object |
| `rt.layout.name` | the current screen (`'MENU'`, `'BOSS OFFICE'`, `'INVESTING STOCK'`, …) |
| `rt.layout.getLayer('UI (Top)')` | a layer of the current screen |
| `layer.layerToCssPx(x, y)` / `layer.cssPxToLayer(x, y)` | convert between game coordinates and page (CSS) pixels |
| `rt.addEventListener('tick', fn)` | every frame (about 60× a second) |
| `rt.callFunction('Name', ...args)` | call a function of the event sheets |
| `rt.getInstanceByUid(uid)` | an instance by UID |
| `rt.goToLayout('NAME')` | switch to another screen |

### Variables you will need often

| Variable | Meaning |
| --- | --- |
| `Budget` | the company's money |
| `ResearchCoins` | research points |
| `Day`, `Month`, `Year` | the current date |
| `DayTotal` | days since the start of the game; `0` while no game is loaded (main menu) |
| `LanguageChoose` | the game language (0 to 14, see below) |
| `CompanyName`, `CompanyCountryID` | the player's company |

Languages, in the order of `LanguageChoose` and of the columns of `ArrayLanguage`: 0 English, 1 Russian, 2 German,
3 French, 4 Italian, 5 Spanish, 6 Hindi, 7 Turkish, 8 Portuguese, 9 Ukrainian, 10 Indonesian, 11 Polish, 12 Chinese,
13 Korean, 14 Japanese.

### Screens and layers

The game has about 300 screens (layouts). Each screen draws its parts on named layers such as `'UI (Back)'`,
`'UI (Top)'` and `'UI (Animations)'`. The game's design size is 1920 × 1080; `layerToCssPx` converts to the real
window, which may have black bars and a different scale. Screens that scroll do it by moving the layers'
`scrollY`, so convert positions every frame, not once.

Since game 1.4 several screens are HTML (the settings page, the news dialog, the research cards, the device editors);
you can change those with ordinary DOM code.

## 8. Finding things in the game

You do not need the game's source code to find names. With the developer console
([section 10](#10-setting-up-for-development)) open, `runtime` is the game runtime. These snippets answer the usual
questions.

### Where am I, and what is on this screen?

```js
runtime.layout.name
runtime.layout.getAllLayers().map(l => l.name)
// every object type with instances on this screen, and how many
Object.fromEntries(Object.keys(runtime.objects)
  .map(n => [n, runtime.objects[n].getAllInstances().length]).filter(([, c]) => c > 0))
```

### All screens

```js
runtime.getAllLayouts().map(l => l.name)   // about 300 names
```

(`runtime.getLayout(index)` returns the last screen for an index past the end, so do not loop over it.)

### What is under the cursor?

Run this, then move the mouse over the game: the console prints the objects under it.

```js
document.addEventListener('pointermove', (e) => {
  const L = runtime.layout, hits = [];
  for (const layer of L.getAllLayers()) {
    const [x, y] = layer.cssPxToLayer(e.clientX, e.clientY);
    for (const n of Object.keys(runtime.objects)) for (const i of runtime.objects[n].getAllInstances()) {
      if (i.layer === layer && i.isVisible !== false && i.containsPoint && i.containsPoint(x, y))
        hits.push(`${n} uid=${i.uid} layer="${layer.name}" ${Math.round(i.x)},${Math.round(i.y)} ${Math.round(i.width)}×${Math.round(i.height)}`
          + (i.text !== undefined ? ` "${String(i.text).slice(0, 30)}"` : ''));
    }
  }
  console.clear(); console.log(hits.join('\n'));
});
```

The same instance can appear twice: once under its own type and once under a family (a group of types, such as
`Gradients`). For HTML parts of the game, use the Elements panel of the developer tools instead.

### Global variables

```js
Object.keys(runtime.globalVars).filter(k => /budget|money/i.test(k))   // by name
Object.entries(runtime.globalVars).filter(([, v]) => v === 300000000)  // by value: what holds this number?
```

Searching by value is the fastest way to find a variable: look at a number on the screen, search for it, change it
in the game, search again.

### Game functions

```js
Object.keys(globalThis).filter(k => typeof globalThis[k] === 'function' && /invest/i.test(k))
String(globalThis.setGameSpeed)   // the function's code: its parameters and what it does
```

### Tables

```js
// every table with its size (in a loaded game)
Object.keys(runtime.objects).filter(n => n.startsWith('Array'))
  .map(n => { const a = runtime.objects[n].getFirstInstance(); return a ? `${n} ${a.width}×${a.height}` : n; })
// one table as rows of cells
const a = runtime.objects.ArrayEmployees.getFirstInstance();
Array.from({ length: Math.min(a.width, 5) }, (_, x) => Array.from({ length: a.height }, (_, y) => a.getAt(x, y)))
```

Most tables keep one record per column (`x`) and its fields in rows (`y`), but check every table: some are the other
way round. Compare a record with what the game shows to learn what each row means.

### Finding a text

```js
const L = runtime.objects.ArrayLanguage.getFirstInstance();
const find = (s) => { const r = []; for (let y = 0; y < L.height; y++) if (String(L.getAt(0, y)).includes(s)) r.push([y, L.getAt(0, y)]); return r; };
find('enough funds')   // [[10974, "You don't have enough funds"], …]
```

Use the index in `spec.texts` and `kit.text(index)`.

### Event sheet functions

The event sheet functions are not visible from JavaScript by name. Find candidates by name in the engine's function
table (about 1,000 functions, stored in lower case; `spec.needs.calls` and `kit.wrapCalls` accept any case):

```js
const esm = BetterDTKit.eventSheets();
[...(esm && esm._functionBlocksByName ? esm._functionBlocksByName.keys() : [])].filter(n => /review/i.test(n))
```

This uses an internal of the engine (`_functionBlocksByName`) that can differ between versions; it is only meant for
exploring, not for your mod's code.

## 9. Recipes

### Run code on one screen

```js
let last = '';
const onTick = kit.guard(() => {
  const name = rt.layout.name;
  if (name === last) return;
  last = name;
  if (name === 'INVESTING STOCK') { /* the screen was opened: add your elements */ }
  else { /* another screen: remove them */ }
});
rt.addEventListener('tick', onTick);
```

### Once per game day, and when another save is loaded

```js
let lastDay = -1;
const onTick = kit.guard(() => {
  const day = Number(rt.globalVars.DayTotal);
  if (!(day > 0)) { lastDay = -1; return; }       // main menu: no game loaded
  if (day === lastDay) return;
  if (lastDay < 0 || day < lastDay) { /* a game was loaded (or another save) */ }
  lastDay = day;
  /* a new day */
});
```

### Call a game function

Many actions of the game are global functions. Read their code first (`String(globalThis.name)`) and declare them in
`spec.needs.functions`:

```js
BetterDTKit.mod('fast-start', { needs: { functions: ['setGameSpeed'] } }, (rt, kit) => {
  /* … */ globalThis.setGameSpeed(2); /* … */
});
```

### Replace a game function and restore it

```js
const orig = globalThis.investingQuote;
globalThis.investingQuote = function (...args) {
  const r = orig.apply(this, args);
  /* change r */
  return r;
};
return () => { globalThis.investingQuote = orig; };
```

Keep the original's behaviour unless you mean to change it, and restore it in the dispose function. The game's own
code may hold a reference to the function from before your mod started; if your replacement does not take effect,
look for an event sheet call instead (`kit.wrapCalls`).

### HTML over the game

```js
const css = document.createElement('style');
css.textContent = `.hello-panel { position: fixed; z-index: 50; padding: 12px 16px; border-radius: 12px;
  background: rgba(10, 15, 40, 0.85); color: #fff;
  font: 22px/1.2 SofiaSansExtraCondensed-Medium, Oswald, "Segoe UI", sans-serif; }`;
document.head.appendChild(css);
const panel = Object.assign(document.createElement('div'), { className: 'hello-panel', textContent: 'Hello' });
document.body.appendChild(panel);

// keep it at a place of the game (design pixels 880, 114 on the layer 'UI (Top)')
const place = kit.guard(() => {
  const layer = rt.layout.getLayer('UI (Top)');
  if (!layer) { panel.style.display = 'none'; return; }
  const [x, y] = layer.layerToCssPx(880, 114);
  panel.style.display = '';
  panel.style.left = x + 'px';
  panel.style.top = y + 'px';
});
rt.addEventListener('tick', place);
return () => { rt.removeEventListener('tick', place); panel.remove(); css.remove(); };
```

- Without a `font-family` the page uses Times New Roman. The game's HTML uses
  `SofiaSansExtraCondensed-Medium, Oswald, "Segoe UI", sans-serif`.
- Start your CSS classes and element ids with your mod's name, so they do not collide with the game or other mods.
- Clicks and keys on your elements also reach the game (it listens on the whole page). Stop them where the game
  should not react:

  ```js
  for (const t of ['pointerdown', 'pointerup', 'click', 'wheel']) panel.addEventListener(t, (e) => e.stopPropagation());
  input.addEventListener('keydown', (e) => e.stopPropagation());   // typing into your field must not trigger shortcuts
  ```

### Texts in all languages

```js
const LABEL = ['Hello', 'Привет', 'Hallo', 'Bonjour', 'Ciao', 'Hola', 'नमस्ते', 'Merhaba', 'Olá', 'Привіт',
  'Halo', 'Cześć', '你好', '안녕하세요', 'こんにちは'];
const lang = () => { const l = Math.round(Number(rt.globalVars.LanguageChoose)); return l >= 0 && l < 15 ? l : 0; };
panel.textContent = LABEL[lang()];
```

Prefer the game's own texts (`kit.text`) where one fits; they are translated already.

### Keep data with a save

A mod cannot add data to the game's save files. Keep small things in settings (`BetterDT.settings.set`) with the
company name in the key if they belong to one company, or compute them from the game's own tables when the game is
loaded.

## 10. Setting up for development

### A copy of the game for testing

Your mod can damage a running game or its saves while you develop it. Before you start:

- back up your saves: `Documents\Devices Tycoon`,
- test with a separate save you do not mind losing.

### The developer console

BetterDT does not turn on the developer tools; release builds keep them off. WebView2 itself turns them on when the
game is started with this environment variable. Start the game from PowerShell (with Steam running):

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222 --remote-allow-origins=http://127.0.0.1"
& "C:\Program Files (x86)\Steam\steamapps\common\Devices Tycoon\Devices Tycoon.exe"
```

Then open `http://127.0.0.1:9222` in Chrome or Edge, or go to `edge://inspect` / `chrome://inspect` and open the
page `app.localhost`. You get the full developer tools: console (with `runtime` and your `BetterDT.log` output),
elements, breakpoints in your mod (the injected script is shown as a VM script).

`--remote-allow-origins` lets `tools/cdp.mjs` (below) connect. The port listens only on your own computer
(127.0.0.1). The variable applies only to programs started from that PowerShell window. Close the window when you are done; do
not set it permanently in Windows.

### Run code from a terminal

`tools/cdp.mjs` in this repository runs JavaScript in the game page over the same port (Node.js 22+), which is handy
for scripted tests:

```bash
node tools/cdp.mjs "runtime.globalVars.Budget"
node tools/cdp.mjs --file my-test.js        # an async function body; `rt` is the runtime, `return` a value
node tools/cdp.mjs --shot screen.png
```

### The cycle

1. Explore in the console ([section 8](#8-finding-things-in-the-game)) and try your code there.
2. Put it into your mod file.
3. Restart the game and check Settings → BetterDT → Mods for the state of your mod.

## 11. Rules for a good mod

- **Do not change game files** (`assets.dat`, `package.json`, …), and do not write to the saves yourself. Change the
  game only while it runs.
- **Clean up.** Everything you add or replace is removed in your dispose function: timers, listeners, elements,
  styles, replaced functions. Then turning the mod off or an incompatible game version leaves the game as it was.
- **Declare what you use** in `spec.needs` and `spec.texts`, so your mod switches itself off after a game update
  instead of breaking the game.
- **Guard callbacks** with `kit.guard`.
- **Keep the game's rules** unless changing them is the point of the mod, and say so in your description.
- **Prefix** your settings keys, CSS classes and global names with your mod's name. Avoid globals; your file's
  top-level names are private already.
- **Do not slow the game down.** A `tick` handler runs about 60 times a second: return early when there is nothing
  to do, and do heavy work once per screen visit or game day, not every frame.

## 12. Sharing your mod

- Share the `.js` file with a short readme: what it does, which game version you tested it with, and how to
  install it: copy the file into `mods` and add its name to the end of `mods\mods.json`.
- Players turn it on and off in Settings → BetterDT → Mods like the official mods. Options are set in
  `mods\betterdt.ini` (document the keys) or in your own UI.
- You are welcome to show your mod on the BetterDT [Discord](https://discord.gg/JdQEMNNTrN). A mod that changes
  how the game plays should say so clearly.

## 13. Troubleshooting

| Problem | Cause |
| --- | --- |
| No card for my mod in Settings → BetterDT | the file is not in `mods.json`, or the name is not valid (spaces, no `.js`) |
| The card says "Does not fit this game version, turned off: function …" | something in `spec.needs` does not exist in this game version (or has a typo) |
| The card says "Stopped after repeated errors" | a guarded function threw 20 times; the last error is shown |
| The card has no state at all | the name given to `BetterDTKit.mod` is not the file name without `.js` |
| My change has no effect | the game was not restarted, or the mod is turned off |
| Nothing happens and no state is shown | the file has a syntax error; `mods\betterdt.log` lists the files that were loaded and the developer console shows the error |

`mods\betterdt.log` is written by BetterDT's loader on every start: which mods were loaded (with their size) and
which were turned off.
