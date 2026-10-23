# Writing your own BetterDT mod

This guide explains how to write a mod for Devices Tycoon that runs with BetterDT: where its files go, how it is
loaded, the BetterDTKit API, the parts of the game a mod usually needs and how to find the rest without reading the
game's code. Two complete, working examples are in [`examples/mods`](examples/mods):

- [`monthly-report/`](examples/mods/monthly-report): a folder mod with `mod.json` (title, description, options in the
  BetterDT settings), events, game data, a button, a message, a dialog and an image file,
- [`money-goal.js`](examples/mods/money-goal.js): a single-file mod written without the newer helpers.

Contents:

1. [What a mod is](#1-what-a-mod-is)
2. [Your first mod in five minutes](#2-your-first-mod-in-five-minutes)
3. [How mods are loaded](#3-how-mods-are-loaded)
4. [mod.json](#4-modjson)
5. [BetterDTKit.mod reference](#5-betterdtkitmod-reference)
6. [The `kit` object](#6-the-kit-object)
7. [Events: `kit.on`](#7-events-kiton)
8. [Game data: `kit.game` and `kit.table`](#8-game-data-kitgame-and-kittable)
9. [UI: `kit.ui`](#9-ui-kitui)
10. [The `BetterDT` object: settings and log](#10-the-betterdt-object-settings-and-log)
11. [The game runtime (Construct 3)](#11-the-game-runtime-construct-3)
12. [Finding things in the game](#12-finding-things-in-the-game)
13. [Recipes](#13-recipes)
14. [Setting up for development](#14-setting-up-for-development)
15. [Rules for a good mod](#15-rules-for-a-good-mod)
16. [Sharing your mod](#16-sharing-your-mod)
17. [Troubleshooting](#17-troubleshooting)

> **Versions.** Folder mods, `mod.json`, `spec.info`, `kit.option`, `kit.on`, `kit.game`, `kit.table`, `kit.ui` and
> mod files served at `https://betterdt.localhost/mod/…` need **BetterDT 0.4.0** or newer. Everything else works
> with older versions too. Put `"requires": { "betterdt": "0.4.0" }` into `mod.json`, and an older BetterDT shows
> the player why your mod does not start.

## 1. What a mod is

Devices Tycoon is a [Construct 3](https://www.construct.net/) game that runs in a WebView2 window (Chromium). A
BetterDT mod is JavaScript that BetterDT injects into the game page while the game runs, so a mod can:

- read and change everything the game keeps in its variables and tables (money, research points, employees, devices,
  companies, …),
- call the game's own functions (the game has about 2,000 global JavaScript functions, `setGameSpeed`,
  `hireEmployee`, `investingQuote`, …),
- run code before or after actions of the game's event sheets,
- add HTML elements (buttons, panels, dialogs) over the game.

A mod never changes a game file. It exists only while the game runs, so removing its files removes the mod.

## 2. Your first mod in five minutes

1. Open the game folder (Steam → Library → right-click Devices Tycoon → Manage → Browse local files). BetterDT must be
   installed: there is a `mods` folder next to `Devices Tycoon.exe`.
2. Create the folder `mods\hello` with two files.

   `mods\hello\mod.json`:

   ```json
   {
     "title": "Hello",
     "description": "Says how much money you have, once a month.",
     "version": "1.0.0",
     "author": "Your name",
     "requires": { "betterdt": "0.4.0" },
     "options": [
       { "key": "loud", "type": "bool", "default": false, "label": "Also show a dialog" }
     ]
   }
   ```

   `mods\hello\mod.js`:

   ```js
   BetterDTKit.mod('hello', {
     needs: { vars: ['Budget'] },
   }, (rt, kit) => {
     kit.on('month', (date) => {
       const text = `${date.month}/${date.year}: $${Math.round(kit.game.money).toLocaleString()}`;
       kit.ui.toast(text);
       if (kit.option('loud')) kit.ui.dialog({ title: 'Hello', text });
     });
   });
   ```

3. Start the game. Settings → BetterDT → Mods now has a card **Hello** with your description, an on/off switch and
   the option "Also show a dialog". Load a game: at the start of every month a message appears in the corner.

After every change to your files, restart the game: mods are read once, when the game starts.

The name in `BetterDTKit.mod('hello', …)` must be the folder name. Everything the mod adds through `kit` (the event,
the message, the dialog) is removed by BetterDTKit when the mod stops, so this mod needs no clean-up code.

## 3. How mods are loaded

BetterDT knows two kinds of mods. Both keep working; folder mods are easier to install and can bring their own
settings.

| | Folder mod | Single-file mod |
| --- | --- | --- |
| Files | `mods\<name>\mod.json` + `mod.js` (and more files) | `mods\<name>.js` |
| Installed by | copying the folder | copying the file **and** adding it to `mods\mods.json` |
| Title, description, options in the settings | from `mod.json` | from `spec.info` (BetterDT 0.4.0+) |
| Loaded | after all mods of `mods.json`, folders in name order | in the order of `mods.json` |
| On/off switch in `betterdt.ini` | `mod.<name>=0` | `mod.<name>.js=0` |

- **Folder names** may contain letters, digits, `.`, `_` and `-`, and must not start with `.`. A folder without
  `mod.json` is ignored. A folder whose name is also listed as `<name>.js` in `mods.json` is skipped.
- **Single files** are listed in `mods\mods.json`, a JSON list of file names. `betterdt-settings.js` comes first; it
  creates `BetterDTKit`. The names must end with `.js` and must not contain spaces, slashes or `..`.
- **When the code runs:** right when the game page is created, before the game engine exists. Every file is wrapped
  in its own function, so `const`/`let`/`function` at the top level of your file are private to it. Do not touch the
  game at the top level; do it in the function you give to `BetterDTKit.mod`.
- **When your mod starts:** once the game data is loaded, normally when the main menu appears. At that moment no
  saved game is loaded yet (`DayTotal` is 0); the company tables are empty until the player loads or starts a game.
  Use the `gameLoaded` event ([section 7](#7-events-kiton)) for code that needs a loaded game.
- **One start per game run:** your mod is started once. Loading another save does not restart it; `gameLoaded`
  tells you about it.
- **On/off:** a mod that is turned off is not loaded at all; the switch takes effect after a restart.
- **Updates:** a BetterDT update never touches your folders and keeps your single files in `mods.json`. Do not name
  your mod like an official one.
- **Errors:** an exception while your file loads or while your mod starts is caught and logged; the other mods and
  the game keep running. Settings → BetterDT shows the state of your mod ([section 5](#5-betterdtkitmod-reference)).

There is also `BetterDT.register('name', rt => { … })`: it starts the function as soon as the engine exists, without
any checks, error counting or settings integration. Use `BetterDTKit.mod` unless you have a reason not to.

## 4. mod.json

```json
{
  "title": { "en": "Monthly report", "de": "Monatsbericht" },
  "description": "At the start of every month: how much money the company made in the last one.",
  "version": "1.0.0",
  "author": "Your name",
  "requires": { "betterdt": "0.4.0", "game": "1.6.0" },
  "files": ["mod.js"],
  "options": [
    { "key": "toast", "type": "bool", "default": true, "label": "Message at the start of a month" },
    { "key": "min", "type": "range", "default": 0, "min": 0, "max": 100, "step": 5,
      "label": "Only when the change is at least (millions)", "hint": "0 = always" },
    { "key": "format", "type": "choice", "default": "short", "label": "Numbers",
      "choices": [ { "value": "short", "label": "$1.2M" }, { "value": "full", "label": "$1 234 567" } ] }
  ]
}
```

All fields are optional; a `mod.json` with `{}` is enough to load `mod.js`.

| Field | Meaning |
| --- | --- |
| `title`, `description` | shown on the mod's card in Settings → BetterDT → Mods |
| `version`, `author` | shown under the description |
| `requires.betterdt`, `requires.game` | the oldest BetterDT / game version the mod works with; older ones mark it "does not fit" and do not start it |
| `files` | the JavaScript files to load, in this order, from the mod's folder (default `["mod.js"]`); file names only, no subfolders |
| `options` | settings shown under the mod's card, see below |

**Texts** (`title`, `description`, `author`, `label`, `hint`, the labels of choices) are either one string or an
object with a text per language: `{ "en": "…", "de": "…" }`. The player sees the game language, else English, else
the first one. Language codes: `en` `ru` `de` `fr` `it` `es` `hi` `tr` `pt` `uk` `id` `pl` `zh` `ko` `ja`.

**Options:**

| Field | Meaning |
| --- | --- |
| `key` | the name of the option; stored as `<mod>.<key>` in `mods\betterdt.ini` (a key with a `.` is used as it is) |
| `type` | `bool` (switch), `range` (slider with `min`, `max`, `step`) or `choice` (buttons, one per `choices` entry) |
| `default` | the value until the player changes it |
| `label`, `hint` | the text of the row and a smaller line under it |
| `choices` | for `choice`: values (`["a", "b"]`) or `{ "value", "label" }` objects |

Read an option with `kit.option('toast')` and react to changes with `kit.on('option', 'toast', fn)`. Changes are
saved right away and apply without a restart if your mod reads them when it needs them.

**Files of your mod:** every file in the mod's folder can be loaded by the game page at
`https://betterdt.localhost/mod/<folder>/<file>`, for example an image:

```js
kit.ui.el('img', { src: 'https://betterdt.localhost/mod/monthly-report/icon.svg' }, button);
const data = await fetch('https://betterdt.localhost/mod/my-mod/prices.json').then(r => r.json());
```

Images (png, jpg, webp, gif, svg), sounds (mp3, ogg, wav), json, css, txt and woff2 fonts get their proper type.

## 5. BetterDTKit.mod reference

```js
BetterDTKit.mod(name, spec, init)
```

- `name`: the folder name of a folder mod, or the file name without `.js`. Settings → BetterDT finds the state,
  title and options of your mod by this name.
- `spec`: what your mod needs from the game (below). BetterDT checks it before the mod starts. When something is
  missing, typically after a game update, the mod does not start and the settings show which part is missing,
  instead of the mod breaking the game.
- `init(rt, kit)`: starts your mod. `rt` is the game runtime ([section 11](#11-the-game-runtime-construct-3)), `kit`
  the helpers ([section 6](#6-the-kit-object)). It may return a function that removes what the mod added by other
  means than `kit` (your own timers, listeners, elements, replaced functions). It runs when the mod is stopped.

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
fails them is stopped at that moment.

### `spec.info` (single-file mods)

The fields of `mod.json` for a mod that is a single file (BetterDT 0.4.0+):

```js
BetterDTKit.mod('hello', {
  info: { title: 'Hello', description: 'Says hello.', version: '1.0.0', author: 'You',
          requires: { betterdt: '0.4.0' }, options: [{ key: 'loud', type: 'bool', default: false, label: 'Loud' }] },
  needs: { vars: ['Budget'] },
}, (rt, kit) => { /* … */ });
```

A folder mod uses its `mod.json`; `spec.info` is ignored then.

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
| `incompatible` | something in `spec` or `requires` is missing (the list is in `problems`); `init` did not run or the mod was stopped |
| `failed` | `init` threw, or a function wrapped by `kit.guard` threw 20 times |

Other members of `BetterDTKit`: `gameVersion` (for example `'1.6.0'`), `whenReady(rt, callback)` (runs once the game
data is loaded and the mods were checked), `info(name)` and `options(name)` (the metadata and options of a mod),
`localize(text)` (a manifest text in the player's language) and `eventSheets()` (the engine's internal event sheet
manager, for advanced use).

## 6. The `kit` object

| Member | Section |
| --- | --- |
| `guard`, `text`, `inst`, `option`, `wrapCalls`, `wrapAction`, `wrapScript`, `warn`, `fail`, `onStop` | this section |
| `on` | [Events](#7-events-kiton) |
| `game`, `table` | [Game data](#8-game-data-kitgame-and-kittable) |
| `ui` | [UI](#9-ui-kitui) |

### `kit.guard(fn)`

Returns a function that runs `fn` only while the mod is running and catches its errors. After 20 errors the mod is
stopped, so a broken mod cannot flood the game with exceptions. `kit.on` and `kit.ui` guard your functions already;
wrap every other timer, listener and callback you give to the game or the browser yourself:

```js
const timer = setInterval(kit.guard(() => { /* … */ }), 1000);
const onKey = kit.guard((e) => { /* … */ });
document.addEventListener('keydown', onKey, true);
return () => {
  clearInterval(timer);
  document.removeEventListener('keydown', onKey, true);
};
```

### `kit.option(key)`

The value of one of your mod's options: `true`/`false` for `bool`, a number within `min`…`max` for `range`, one of
the values of `choices` for `choice` (the default when the stored value is not one of them). `key` is the option's
`key` from `mod.json` (`'toast'`) or the full key (`'monthly-report.toast'`).

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

## 7. Events: `kit.on`

```js
const off = kit.on(event, [filter], fn);
```

One shared listener serves all mods, so your mod does not need its own `tick` handler to notice what happens.
`kit.on` returns a function that unsubscribes; all subscriptions end when the mod stops. Your function is guarded
like `kit.guard`.

| Event | Filter | `fn` gets | When |
| --- | --- | --- | --- |
| `tick` | – | `dt` (seconds) | every frame, about 60× a second |
| `screen` | a screen name (optional) | `name, previous` | a screen was opened; also once for the screen that is open when you subscribe |
| `leave` | a screen name (optional) | `name, next` | a screen was left |
| `gameLoaded` | – | `date` | a saved game was loaded or a new one started (also another save while one is loaded); also once when a game is loaded when you subscribe |
| `gameClosed` | – | – | back in the main menu without a game |
| `day`, `month`, `year` | – | `date` | a new game day / month / year began (not when a game is loaded) |
| `language` | – | `index, code` | the player switched the game language |
| `option` | the option's key | `value, fullKey` | one of your options changed |
| `setting` | a settings key (optional) | `key, value` | any setting changed (`value` is the stored string) |

`date` is `{ day, month, year, total }`; `total` is `DayTotal`, the number of days since the start of the game.

```js
kit.on('gameLoaded', () => { /* read the company's tables */ });
kit.on('screen', 'INVESTING STOCK', () => { /* the stock screen was opened */ });
kit.on('leave', 'INVESTING STOCK', () => { /* … and left */ });
kit.on('day', (d) => { if (d.day === 15) { /* the middle of every month */ } });
kit.on('option', 'loud', (on) => { /* the player flipped the switch */ });
```

`gameLoaded` waits until the loading screen is gone, so the save's tables are filled.

## 8. Game data: `kit.game` and `kit.table`

### `kit.game`

| Member | Meaning |
| --- | --- |
| `money` | the company's money (`Budget`); can be set |
| `researchPoints` | research points (`ResearchCoins`); can be set |
| `date` | `{ day, month, year, total }` |
| `inGame` | `true` while a game is loaded |
| `screen` | the name of the current screen |
| `language`, `lang` | the game language as an index (0–14) and a code (`'en'`, `'de'`, …) |
| `company` | `{ name, countryId }` |
| `speed` | the game speed (1, 1.25, 1.5, 2, 3); can be set |
| `version` | the game version, for example `'1.6.0'` |
| `employees()` | the hired employees: `[{ id, profession, design, speed, research }]` |
| `tables` | the tables below, with named fields |

### Named tables: `kit.game.tables`

Each table keeps one record per column (`x` = id) with named fields. These are the fields BetterDT's own mods use
and that were checked in game 1.6; a table holds more rows than are named here.

| Table | Game table | Record = | Fields |
| --- | --- | --- | --- |
| `countries` | `ArrayCountries` | country (`company.countryId`) | `name`, `money`, `tax`, `costOfProduction`, `trade`, `tech` |
| `companies` | `ArrayCompanyNames` | company | `defaultName`, `name` (the name shown) |
| `shares` | `ArrayInvesting` | company | `total`, `ownedCompany` (1 = bought out), `offer` (shares on offer) |
| `myShares` | `ArrayInvestingMyStocks` | company | `owned` |
| `research` | `ArrayResearch` | research project | `points`, `money` (price of one level) |
| `myResearch` | `ArrayMyResearch` | research project | `level` |
| `employees` | `ArrayEmployees` | employee | `profession` |
| `employeeSkills` | `ArrayEmployees_Characters` | employee | `design`, `speed`, `research` |
| `myEmployees` | `ArrayMyEmployees` | slot | `id` (the employee) |
| `stores` | `ArrayMyShops` | country | `level`, `count` |

```js
const T = kit.game.tables;
const home = T.countries.record(kit.game.company.countryId);
home.name;                 // 'Czech Republic'
home.tax = 0.1;            // fields can be set
T.companies.find(c => c.name === 'NVIDIA').id;
T.shares.filter(s => Number(s.offer) > 0).length;
```

Records read the table when you use a field, so they always show the current value; reading or writing the game's
data changes it exactly as the game would see it, with no checks.

### `kit.table(name, fields)`

The same for any table of the game, with your own field names (see [Tables](#tables) for finding them):

```js
const offices = kit.table('ArrayMyOffices', { level: 0, seats: 2 });
offices.exists;            // false when the game has no such table
offices.width; offices.height;
offices.get(3, 'seats');   // cell x = 3, y = 2; a number works for y too
offices.set(3, 'seats', 10);
offices.record(3);         // { id: 3, level, seats }
offices.records();         // all records
offices.find(r => r.level > 2); offices.filter(r => r.seats === 0);
offices.column(3); offices.row(0);   // raw cells
```

`ArrayMyOffices` and its fields above are an example name; look up the real tables first.

## 9. UI: `kit.ui`

Helpers for HTML over the game, in the game's look. Everything they create is removed when the mod stops.

| Member | What it does |
| --- | --- |
| `kit.ui.font` | the game's font stack (`SofiaSansExtraCondensed-Medium, Oswald, "Segoe UI", sans-serif`) |
| `kit.ui.css(text)` | adds a `<style>` element |
| `kit.ui.el(tag, props, parent)` | creates an element; `props` sets properties (`className`, `textContent`, `src`, …), `style` (an object) and listeners (`onclick: fn`, guarded); `parent` defaults to `document.body`, `null` = not attached |
| `kit.ui.shield(el, keys = true)` | clicks, wheel and (unless `keys` is false) keys on the element do not reach the game |
| `kit.ui.anchor(el, layer, x, y, opts)` | keeps a fixed element at `x, y` (design pixels) of a layer of the game; hidden on screens without that layer. `opts.screen`: only on that screen, `opts.scale: true`: scale with the game. Returns a function that stops it |
| `kit.ui.button(label, onClick, opts)` | a button like the game's dialog buttons; `opts.color` `'green'` (default), `'red'` or `'grey'`, `opts.parent` to attach it. Plays the game's click sound |
| `kit.ui.toast(text, opts)` | a short message in the bottom right corner; `opts.ms` (default 4000), `opts.type` `'good'` / `'bad'` |
| `kit.ui.dialog({ title, text, buttons, content })` | the BetterDT dialog; `buttons` `[{ label, go }]` (`go: true` = green); resolves with the index of the clicked button. Waits while another dialog is open. `content(element)` can add more |

Sizes in `kit.ui`'s own elements follow the game's scale (the CSS variable `--bdt-s` on `<html>`, 1 at 1920 × 1080).

```js
const btn = kit.ui.button('Report', async () => {
  const i = await kit.ui.dialog({ title: 'Report', text: 'Show it?', buttons: [{ label: 'No' }, { label: 'Yes', go: true }] });
  if (i === 1) kit.ui.toast('Shown', { type: 'good' });
}, { parent: document.body });
kit.ui.anchor(btn, 'GAMEPLAY GLOBAL UI (Back)', 1830, 175, { screen: 'BOSS OFFICE', scale: true });
```

## 10. The `BetterDT` object: settings and log

### Settings

Settings are stored in `mods\betterdt.ini` as `key=value` lines. Keys may contain letters, digits, `.`, `_` and `-`
(up to 80 characters); start them with your mod's name. Options declared in `mod.json` or `spec.info` are settings
too, and appear in the BetterDT settings; `kit.option` reads them with their type and default.

```js
const S = BetterDT.settings;
S.bool('hello.loud', false);        // true/false; '0', 'false', 'off', 'no' are false
S.num('hello.days', 30);            // a number, or the default when missing or not a number
S.get('hello.name', 'Bob');         // the stored string
S.set('hello.days', 45);            // saves right away (returns a promise)
const off = S.onChange((key, value) => { /* value is a string */ });   // returns a function that unsubscribes
```

### Other members

| Member | Meaning |
| --- | --- |
| `BetterDT.log(...)` | `console.log` with a `[BetterDT]` prefix |
| `BetterDT.version` | the version of BetterDT, for example `'0.4.0'` |
| `BetterDT.mods` | `[{ file, enabled }]` for the files in `mods.json`, `[{ file: '<folder>', folder: true, enabled, manifest }]` for folder mods |
| `BetterDT.register(name, init)` | the plain start without checks (see [section 3](#3-how-mods-are-loaded)) |

`DTMods` is the same object, for older mods.

## 11. The game runtime (Construct 3)

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
`scrollY`, so convert positions every frame, not once (`kit.ui.anchor` does that for you).

Since game 1.4 several screens are HTML (the settings page, the news dialog, the research cards, the device editors);
you can change those with ordinary DOM code.

## 12. Finding things in the game

You do not need the game's source code to find names. With the developer console
([section 14](#14-setting-up-for-development)) open, `runtime` is the game runtime. These snippets answer the usual
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
way round. Compare a record with what the game shows to learn what each row means, then name the rows with
`kit.table(name, fields)`.

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

## 13. Recipes

### Add something to one screen

```js
kit.on('screen', 'INVESTING STOCK', () => {
  const tip = kit.ui.el('div', { className: 'my-mod-tip', textContent: 'Tip: buy low' });
  const stop = kit.ui.anchor(tip, 'COMPANY UI (Top)', 880, 114, { scale: true });
  const off = kit.on('leave', 'INVESTING STOCK', () => { stop(); tip.remove(); off(); });
});
```

Or create the element once and let `anchor` with `opts.screen` hide it on the other screens, as
`monthly-report` does.

### Something every game day, and when another save is loaded

```js
kit.on('gameLoaded', () => { /* new game or another save: reset what you counted */ });
kit.on('day', (d) => { /* d.day, d.month, d.year, d.total */ });
```

### Call a game function

Many actions of the game are global functions. Read their code first (`String(globalThis.name)`) and declare them in
`spec.needs.functions`:

```js
BetterDTKit.mod('fast-start', { needs: { functions: ['setGameSpeed'] } }, (rt, kit) => {
  kit.on('gameLoaded', () => { kit.game.speed = 2; });
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
kit.onStop(() => { globalThis.investingQuote = orig; });
```

Keep the original's behaviour unless you mean to change it, and restore it when the mod stops. The game's own code
may hold a reference to the function from before your mod started; if your replacement does not take effect, look
for an event sheet call instead (`kit.wrapCalls`).

### Your own HTML

```js
kit.ui.css(`.my-mod-panel { position: fixed; z-index: 50; padding: 12px 16px; border-radius: 12px;
  background: rgba(10, 15, 40, 0.85); color: #fff; font: 22px/1.2 ${kit.ui.font}; }`);
const panel = kit.ui.shield(kit.ui.el('div', { className: 'my-mod-panel', textContent: 'Hello' }));
```

- Without a `font-family` the page uses Times New Roman; use `kit.ui.font`.
- Start your CSS classes and element ids with your mod's name, so they do not collide with the game or other mods.
- Clicks and keys on your elements also reach the game (it listens on the whole page). `kit.ui.shield` stops them;
  for a text field leave keys shielded, so typing does not trigger the game's shortcuts.

### Texts in all languages

In `mod.json`, give texts per language. In code, pick by `kit.game.lang`:

```js
const HELLO = { en: 'Hello', de: 'Hallo', ru: 'Привет' };
panel.textContent = HELLO[kit.game.lang] || HELLO.en;
kit.on('language', () => { panel.textContent = HELLO[kit.game.lang] || HELLO.en; });
```

Prefer the game's own texts (`kit.text`) where one fits; they are translated already.

### Keep data with a save

A mod cannot add data to the game's save files. Keep small things in settings (`BetterDT.settings.set`) with the
company name in the key if they belong to one company, or compute them from the game's own tables on `gameLoaded`.

## 14. Setting up for development

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
(127.0.0.1). The variable applies only to programs started from that PowerShell window. Close the window when you
are done; do not set it permanently in Windows.

### Run code from a terminal

`tools/cdp.mjs` in this repository runs JavaScript in the game page over the same port (Node.js 22+), which is handy
for scripted tests:

```bash
node tools/cdp.mjs "runtime.globalVars.Budget"
node tools/cdp.mjs --file my-test.js        # an async function body; `rt` is the runtime, `return` a value
node tools/cdp.mjs --shot screen.png
```

### The cycle

1. Explore in the console ([section 12](#12-finding-things-in-the-game)) and try your code there.
2. Put it into your mod's files.
3. Restart the game and check Settings → BetterDT → Mods for the state of your mod.

## 15. Rules for a good mod

- **Do not change game files** (`assets.dat`, `package.json`, …), and do not write to the saves yourself. Change the
  game only while it runs.
- **Clean up.** What you add through `kit` is removed for you. Everything else you add or replace (your own timers,
  listeners, elements, replaced functions) is removed in your dispose function or `kit.onStop`. Then turning the mod
  off or an incompatible game version leaves the game as it was.
- **Declare what you use** in `spec.needs`, `spec.texts` and `requires`, so your mod switches itself off after a game
  update instead of breaking the game.
- **Guard callbacks** that do not go through `kit.on` or `kit.ui` with `kit.guard`.
- **Keep the game's rules** unless changing them is the point of the mod, and say so in your description.
- **Prefix** your settings keys, CSS classes and global names with your mod's name. Avoid globals; your file's
  top-level names are private already.
- **Do not slow the game down.** A `tick` handler runs about 60 times a second: return early when there is nothing
  to do, and do heavy work on `screen`, `day` or `gameLoaded`, not every frame.

## 16. Sharing your mod

- Share your mod's folder as a zip, with a short readme: what it does, which game version you tested it with, and
  how to install it: unpack the folder into `mods` (so there is `mods\<name>\mod.json`) and restart the game.
- A single-file mod also needs its name added to the end of `mods\mods.json`; say so in the readme.
- Players turn it on and off and change its options in Settings → BetterDT → Mods like the official mods.
- You are welcome to show your mod on the BetterDT [Discord](https://discord.gg/JdQEMNNTrN). A mod that changes
  how the game plays should say so clearly.

## 17. Troubleshooting

| Problem | Cause |
| --- | --- |
| No card for my folder mod | the folder has no `mod.json`, its name has spaces or other characters, or it starts with `.` |
| No card for my single-file mod | the file is not in `mods.json`, or the name is not valid (spaces, no `.js`) |
| The card says "mod.json is not valid JSON" | a comma or quote is missing in `mod.json`; its files still load, without title and options |
| The card says "Does not fit this game version, turned off: …" | something in `spec.needs` or `requires` is missing in this version (or has a typo) |
| The card says "Stopped after repeated errors" | a guarded function threw 20 times; the last error is shown |
| The card has no state at all | the name given to `BetterDTKit.mod` is not the folder name / the file name without `.js` |
| My change has no effect | the game was not restarted, or the mod is turned off |
| Nothing happens and no state is shown | a file has a syntax error; `mods\betterdt.log` lists the files that were loaded and the developer console shows the error |

`mods\betterdt.log` is written by BetterDT's loader on every start: which mods were loaded (with their size) and
which were turned off.
