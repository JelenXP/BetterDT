# BetterDT – mods for Devices Tycoon

Handy extra buttons for **Devices Tycoon** that save you a lot of clicking. BetterDT does not change any
game file and does not touch your saves.

## What you get

- **Hiring (FIND EMPLOYEES):** a second button next to every agency keeps searching until your office is
  full. With **AUTO-HIRE** (checkbox in the top right) everyone found is hired right away.
- **Training (UPGRADE EMPLOYEES):** **TRAIN ALL** trains the whole profession to the maximum level, as long
  as you have money and research points.
- **Vacations (MY EMPLOYEES):** **VACATION FOR THE TIRED** sends everyone with low mood on vacation.
  One person of each profession always keeps working.
- **Research (RESEARCH LAB):** **Research tab** researches everything left on the tab you have open (e.g. all
  of GPU), **Research all** everything on all tabs, for research points and money. A button is greyed out
  when you cannot afford all of it; hovering it shows the price, and a click first asks with the price.
  Since game 1.4 they replace the game's own "Research all" (which spends at most half of your money and often
  researches only a part); a switch in the settings brings the game's button back.
- **Game speed ×2 and ×3:** the speed button in the corner goes ×1 → ×1.25 → ×1.5 → ×2 → ×3.
- **Adjustable autosave:** choose how often the game saves by itself (5 to 180 game days, default 90), so a
  crash costs you less progress.
- **Low-end mode** for older computers: limit the game to 30 FPS and turn off the blur behind panels (both off
  by default).
- **Endless game:** keep playing after the end of the game in 2101. The final screen gets a **Continue game**
  button, and the calendar goes on right away, no reload needed. Based on a mod by **M1lan.**
- **Real company names:** the other companies are called Sony, Intel, Samsung, … instead of Somy, Infel,
  Samsong, … (game 1.4+), without downloading and loading the names file in the game's editor.
- **Updating software (UPDATE SOFTWARE):** **Select all** picks every released app for the update with its next
  version and the same settings, instead of opening and saving each app one by one.
- **OS upgrade (MY OS UPGRADE):** **Select all** picks all of the about 35 technologies at once (**Clear all**
  takes them out again).
- **MY OS UPGRADE** no longer stutters.
- **Laptops with two graphics cards:** the game runs on the faster one.
- A **BetterDT** section in the game settings, where you can turn each of these on or off.
  All texts are in the game's 15 languages.
- **Safe with game updates:** every mod checks at start that the game still has what it needs. A mod that does
  not fit a new game version turns itself off instead of misbehaving, and the settings say why (see
  [Game updates](#game-updates)).

## How to install

1. Download **BetterDT.zip** from the [latest release](https://github.com/JelenXP/BetterDT/releases/latest)
   (under "Assets").
2. Open the game folder: Steam → Library → right-click **Devices Tycoon** → Manage → **Browse local files**.
   A folder with `Devices Tycoon.exe` opens.
3. Open the zip and copy everything in it into that folder: `BetterDT_x64.ext.dll` and the `mods` folder
   must end up right next to `Devices Tycoon.exe`, not in a new subfolder.
4. Start the game. In Settings there is now a **BetterDT** section on the left – that means it works.

**Updates** are automatic: when a new version is out, BetterDT downloads it when the game starts and tells you
in the main menu. Click **Restart now** to use it right away, or **Keep playing** and it starts the next time
you launch the game. You can turn automatic updates off in Settings → BetterDT.

**White screen?** If the game screen ever turns white with a small sad face, BetterDT reloads the game by itself
(you are back in the main menu; load your last save). The main menu then offers **Report problem**, which opens
a prefilled bug report and copies it, so you can also paste it into the Steam discussion.

**Uninstall:** delete `BetterDT_x64.ext.dll` and the `mods` folder from the game folder.

**Problems?** If there is no BetterDT section in the settings, the DLL is not next to `Devices Tycoon.exe`.
Game updates and "Verify integrity of game files" do not remove BetterDT. The file `mods\betterdt.log`
says what happened; please attach it when you [report a problem](https://github.com/JelenXP/BetterDT/issues).

## Settings (Settings → BetterDT)

- **General:** BetterDT and game version, automatic updates (on by default), "Check now" / "Install" for updates,
  high-performance GPU switch, buttons that open the mods folder, the log and the GitHub releases.
- **Mods:** an on/off switch for every mod (with a note when it does not fit the game version) and the mod options:
  - hire-tools: hire everyone found automatically,
  - train-all: mute the click sounds while training,
  - vacation-tools: the mood threshold for sending people on vacation (default 30),
  - autosave: save every N game days (default 90, 5 to 180),
  - low-end: limit to 30 FPS, turn off blur (both off by default; take effect right away),
  - no-ending: skip the final screen and continue right away (off by default),
  - research-all: use the game's own Research all button instead (game 1.4+, off by default; takes effect right away).

Settings are saved right away into `mods\betterdt.ini`. Turning a mod or the GPU switch on or off takes
effect after restarting the game; the page says so.

## The mods in detail (`mod/mods`)

### `os-perf.js`: smooth OS upgrade cards
The MY OS UPGRADE screen stuttered when clicking quickly. Each of the 35 cards had a `backdrop-filter: blur()`
that does almost nothing visually there, and a double `filter: drop-shadow()` over the whole card. Both were
recomputed on every animation. The mod replaces them with the same shadows drawn once and gives every card
its own layer.
- Look: screenshots differ from the original by 1.4 of 255 levels on average, only on font edges
  (subpixel antialiasing).
- Performance: without the mod the card animations dropped frames. With it the screen holds 105 FPS idle
  and 85 FPS while clicking twice per second, without a single long frame.

### `hire-tools.js`: faster hiring (FIND EMPLOYEES)
- **A second button on every agency** (people icon + number) repeats the search until exactly as many people
  are found as are missing to fill the office for the selected profession.
  - Number = free seats − candidates of this profession already waiting to be hired.
  - The last search is limited so it never finds more people than there are free seats. Example: 6 seats left
    and the searches find 3 + 2, so the third search finds only 1.
  - Every search costs the agency's full price. When the money or the candidates run out, the search stops
    and the game shows its message.
  - At 0 the button is dimmed and a click explains why (office full / enough candidates).
- **AUTO-HIRE checkbox in the top right** (remembered; also in Settings → BetterDT → Mods). When it is checked,
  everyone found is hired right away, after a regular search as well as after the batch search. Candidates of
  the same profession found earlier are hired too while there is room. The result is shown next to the number
  found ("Hired: 2"). Whoever does not fit stays in HIRE EMPLOYEES and the game shows "no free space".

### `train-all.js`: train everyone (UPGRADE EMPLOYEES)
- A green **TRAIN ALL (N)** button in the left panel under the legend, where N is the number of people of the
  selected profession who are not at MAX LEVEL yet. A click goes through all pages of the profession and trains
  until everyone is at the maximum or the money or research points run out.
- Training clicks the game's own buttons, so the price (sum of the three levels × $1,500 and ⌈sum × 0.015⌉
  points), gains, salary and perks are computed by the game. The mod only switches pages (`SubPage`) and clicks.
- Sounds are muted during the batch (optional), one chime plays at the end. A summary ("Training finished: 29
  upgrades", money and points spent) appears in the game notification. When the money runs out it is appended
  under the game's message.
- Tested: 14 designers (29 upgrades) in under a second. With $1M the batch stopped at the game's
  "You don't have enough funds" message.

### `vacation-tools.js`: vacation for the tired (MY EMPLOYEES)
- A third button under the game's SEND ON VACATION and PAY THE BONUS: **VACATION FOR THE TIRED – N NEED A REST**.
  It sends every employee of every profession with mood below 30 (the game marks them "Vacation needed" or
  "Risk of dismissal") on vacation, the most tired first. The threshold can be changed in the settings.
- The rules are taken from the game button's event: mood +30 to 40 (max 100), 30 days − 7 per perk,
  status `Vacation`. At least one person of each profession must keep working. Whoever did not fit because
  of that keeps working and the notification says so.
- Tested: 67 of 70 tired employees left, 3 stayed (professions where everyone was tired).

### `game-speed.js`: game speed ×2 and ×3
- The game's speed button (`#sbx-speed`) cycles through a fixed list `[1, 1.25, 1.5]`. The mod catches its click
  first (capture listener on the button) and goes to the next of `[1, 1.25, 1.5, 2, 3]` with the game's own
  `setGameSpeed()`, which accepts any speed. So the time scale, the "×2" label and the game's rules (normal speed
  outside gameplay) stay the game's; the mod only adds colours for ×2 and ×3.

### `low-end.js`: low-end mode
- **Limit to 30 FPS:** the game draws at the monitor's refresh rate (vsync) by default, also on static menus where
  nothing moves. The mod sets `runtime.framerateMode = 'fixed'` and `fixedFramerate = 30` at runtime only; the
  game's own FPS setting is not changed. When the game applies its settings again, the mod sets the limit back
  within a second; turning the option off brings the game's setting back. A game setting of a fixed 30 FPS or less
  is kept. Game time does not depend on the frame rate. Measured on the main menu (1440p, vsync 165 Hz):
  CPU 10 % → 2 %, GPU 13 % → 2 %. Office screens already redraw only about 15 times a second, so there it changes little.
- **Turn off blur:** a style rule sets `backdrop-filter: none` on every element. The game's panels stay
  semi-transparent, only without the blur behind them, which weak integrated graphics redo on every frame.
- The game's own **Quality: Low** setting helps only on displays larger than 1920×1080: it then draws
  at 1920×1080 and stretches the picture (about 30 % less GPU work on the main menu at 1440p). On a 1080p or smaller
  display it changes nothing.

### `real-names.js`: real company names
- Game 1.4 can rename companies: **Main menu → Editor → Load file** reads a text file with one name per line
  (line = company id) into `ArrayCompanyNames` (column 0 = the game's name, column 1 = the name shown everywhere).
  The developer publishes such a file with the real names; the mod has the same 469 renames built in.
- The pairs are matched by the game's name (`Somy` → `Sony`), not by the line, so a game update that adds or
  reorders companies does not mix them up. Only cells that still hold the game's name are changed, so a company
  you renamed yourself in the editor keeps your name.
- Only in memory, nothing is written to the game's files. The game loads `Settings.dt` (where the editor keeps the
  names) on the start page, so the mod checks the table every 2 seconds. If fewer than half of the game's names
  are found, the mod turns itself off. Turning it off brings the game's names back after a restart, unless the
  editor saved them in the meantime (its reset buttons undo that).

### `update-all.js`: update all apps (UPDATE SOFTWARE)
- On the update screen every released app has to be clicked, its editor confirmed with **Save** (it already has
  the next version, e.g. 1.0.3 → 1.0.4, and the app's name, platforms, monetization and icon), and then the next
  app. **Select all** next to the game's **Update** button does that for every app that is not selected yet: it
  clicks the card and the editor's **Save** itself, so the version, the price and the level are the game's own.
- The game's **Update** button then updates them all at once (and checks the money); **×** on a card still takes
  one app out again. If the editor does not open or save as expected, the mod stops and turns itself off.

### `os-upgrade-all.js`: select all OS upgrades (MY OS UPGRADE)
- An OS upgrade lists about 35 technologies, each of which has to be clicked. **Select all** above the list
  clicks every technology that is not selected yet through the game's own click handler, so the game adds up the
  price and the rating itself, exactly as with single clicks. When everything is selected the button turns into
  **Clear all**. Single cards can still be clicked as before.

### `no-ending.js`: endless game
Based on the "prevent retirement" mod by **M1lan.** – thank you!
- **How the game ends:** on game day 34000 (early 2101) the event sheet calls `triggerEndGame()`. It sets the
  global `class` to `"END GAME"` and shows the final summary, whose only button goes to the main menu. The date
  engine only runs while `class` is `"GAMEPLAY"`, so a game kept open behind the screen has a frozen calendar.
- **Continue game** (the game's own text, so in every language) is added under the game's button. It calls the
  game's `resetEndGame()` and sets `class` back to `"GAMEPLAY"`: the calendar runs on in the same session.
  The game only ends on that one day, so the screen does not come back. The "game finished" achievement still
  counts, as the game checks it before the screen is shown.
- **Skip the final screen** (option, off by default) continues right away without the summary.
- A game stuck in `"END GAME"` without the screen (e.g. after a mod that only removed the screen) is put back to
  `"GAMEPLAY"` after 3 seconds.

### `autosave.js`: adjustable autosave
- The game autosaves on its own at a fixed interval of game days. It calls `globalThis.tickAutoSave()` once per game day; the mod
  replaces it with the same logic and the interval from the settings (default 90, 5 to 180 days).
- The save itself is the game's own: `debugAutoSave()` runs the game's autosave (SaveGame with its backup and
  read-back check), which skips saving outside gameplay, while paused, while a save is in progress, and on the
  bankruptcy and end-game screens. The mod then tries again the next day.
- Like the game, it counts from the day a game is started or loaded. With the mod off the game keeps its own interval.
- Tested on a copy with file writes blocked: with the interval set to 30, it saved every 30 days over 700 game days.

### `research-all.js`: Research tab / Research all
- Two buttons in the top bar of the research page, styled with a copy of the CSS of the game's own **Research all**
  button. In sandbox mode, where the game's button is free, the mod stays off.
- **Game 1.4+:** the game shows its own button outside sandbox mode too. It researches only the open category,
  recommended functions first, with all research points but at most half of the money (`debugResearchAllPlan()`),
  so often only a part. The mod hides it (`#research-root.bdt-ra-on #research-all { display: none }`) and shows its
  two buttons in its place. With the option "Use the game's own Research all button" the mod steps aside instead.
- **Research tab** = every card on the open tab that can be researched (`ArrayResearchPage_Temp`), up to its max level.
  **Research all** = the game's own list for its sandbox button (`debugResearchAllTargets()`).
- Price = remaining levels × price per level (`ArrayResearch` columns 1 and 2, the same the cards show). The button
  gets the game's grey `rc-all-empty` look and ignores clicks when nothing is left or the points or money are not
  enough for all of it. A click first opens a confirmation with the price and the number of levels
  (`BetterDTUI.dialog`, the BetterDT dialog that other mods can use too).
- Every level is a click on the research card, so the game checks the price, deducts the tax, pays and raises
  the level itself (the card click reaches the game's `research-buy-signal` event synchronously). Other tabs are
  opened like a click on them does (`MiniPage`, `Research_ButtonsOpacity`, `ResearchPage`), and the tab you had open
  comes back at the end. Sounds are muted during the batch (one plays at the end); if the game rejects a click,
  the mod stops.
- Tested: a whole tab cost exactly the shown price, the tax base dropped by the same money, and "all" (about
  4000 levels) took about 10 s with the game still drawing (a progress percentage shows on the button).

All buttons are built from the game's own objects (same buttons, gradients, icons and font).

### Game updates
Mods use the game's own functions, objects and tables, which a game update can rename or change. So every mod
is registered through `BetterDTKit` (in `betterdt-settings.js`) with a list of what it needs:

- **Before start** (when the game reaches the main menu): global functions, object types, global variables and
  game texts. Texts are listed with their English wording; if an update moves a text to another index, it is
  found again by that wording. A mod with something missing is not started.
- **After a saved game is loaded** (the company tables are empty in the menu): table sizes and checks of what the
  columns hold (e.g. the profession in `ArrayEmployees`). A mod that fails them is stopped.
- **Objects on a screen** are listed by their uid in game 1.3.0 with type, layer, size and position. If the uid
  no longer fits (wrong type, layer or size), the object of that type and layer with that size nearest to the old
  position is used instead, and the settings note it.
- **While running:** errors in a mod's timers and listeners are counted; after 20 the mod is stopped and cleaned
  up (`dispose`). Mods also check their own results: `research-all` stops when the price paid differs from the
  computed one, `vacation-tools` checks the employee table columns before every write, `autosave` gives the game
  its own autosave back when the game stops calling `tickAutoSave()`, `hire-tools` charges the price shown on the
  agency card, and `game-speed` steps aside when the game itself styles ×2 / ×3.

What it shows the player:
- **Settings → BetterDT → Mods:** under a mod that does not fit, "Does not fit this game version, turned off" or
  "Stopped after repeated errors", with the details; "Works, but something in the game has changed" when an object
  or text had to be found again.
- **Settings → BetterDT → General:** the game version.
- After the game itself was updated, a dialog in the main menu: "Devices Tycoon 1.3.0 → 1.3.1. BetterDT has checked
  its mods", with the mods that were turned off.
- If an update changes the game's settings page so that the BetterDT section cannot be added, a **BetterDT** button
  in the corner of the settings screen opens the mods as a plain on/off list.
- Crash reports include the game version and the mods that are not running.

### Writing your own mod

Put a `.js` file into `mods` and add it to `mods\mods.json`:

```js
BetterDTKit.mod('my-mod', {
  needs: { functions: ['setGameSpeed'], objects: ['ArrayOffices'], vars: ['Budget'], arrays: { ArrayOffices: [5, 1] } },
  texts: { 10974: "You don't have enough funds" },
}, (runtime, kit) => {
  runtime.globalVars.Budget;                       // global variables from the event sheets
  runtime.objects.ArrayOffices.getFirstInstance(); // arrays, dictionaries, sprites…
  const tick = kit.guard(() => {});                // errors are counted, 20 stop the mod
  runtime.addEventListener('tick', tick);          // every frame
  kit.text(10974);                                 // a game text in the player's language
  BetterDT.settings.bool('my-mod.option', true);   // settings from betterdt.ini
  return () => runtime.removeEventListener('tick', tick);   // dispose
});
```

`BetterDT.register('my-mod', runtime => { … })` still works for a mod without checks.

`DTMods` is an alias of `BetterDT` for older mods. `examples/mods` has two development helpers:
`example.js` and `probe.js` (with `probe-server.mjs` it sends the runtime state to `http://127.0.0.1:9334`).

## How the loader works (`loader/`)

- `WV2ExtManager.dll` from the Construct wrapper loads every `*.ext.dll` in the game folder and calls its
  `WrapperExtInit` (that is how `Steam_x64.ext.dll` is loaded). BetterDT returns an object with empty methods
  and registers no component.
- On load it redirects `GetProcAddress` in the exe's import table. The exe gets
  `CreateWebViewEnvironmentWithOptionsInternal` through it, so the loader sees the environment options and adds
  `--force_high_performance_gpu`. The switch does not pick a vendor: Chromium asks Windows (DXGI) for the
  "high performance" adapter, the same order the Windows graphics settings use:
  - integrated graphics only: stays on it,
  - integrated + dedicated (NVIDIA, AMD, Intel Arc): moves to the dedicated one,
  - desktop with a dedicated GPU only: no change.

  On a laptop with Intel UHD and RTX 5070 the menu went from 84–88 % GPU load and 70–80 FPS (Intel)
  to 8 % and ~130 FPS (RTX).
- After the controller is created (all four creation methods are hooked) the loader registers
  `AddScriptToExecuteOnDocumentCreated` with a script built from `mods\mods.json` and the files in `mods\`.
  The script runs only in the main page on `app.localhost`.
- `https://betterdt.localhost/…` is served through `WebResourceRequested` (registered after the game's own
  handler, which would otherwise overwrite the response). The settings page uses it for `state`, `set`,
  `check`, `install` and `open`. Only requests from the game page are accepted.
- **Updates:** `github.com/JelenXP/BetterDT/releases/latest` redirects to `…/tag/v<version>`, which tells the
  loader the latest version without downloading anything. When it is newer, the loader downloads the release's
  only asset, `BetterDT.zip` (the same zip players install by hand), checks the CRC-32 of every file and the
  version in `mods/betterdt-version.txt`, and only then replaces the files. The loaded DLL is renamed to
  `BetterDT_x64.old` and deleted on the next start; the new version is used after a restart.
  `mods\mods.json` keeps any mods you added yourself. The zip is uncompressed so the loader can read it
  without an inflate library. `mods/betterdt-version.txt`:

  ```
  betterdt-manifest 2
  version 0.3.2
  change 0.3.2 <release notes line>     (the whole history from loader/CHANGES.txt, newest first)
  note <release notes line>             (for BetterDT up to 0.3.1, which only reads these)
  mods betterdt-settings.js os-perf.js hire-tools.js train-all.js vacation-tools.js
  ```
  The new-version dialog lists the notes of every version newer than the installed one (at most 12 lines).
- **Restart:** "Restart now" starts the exe again with `BETTERDT_WAIT_PID` set (the environment Steam gave the
  game is inherited) and closes the game window. The new instance waits in the hooked environment creation until
  the old process and its WebView2 browser process have exited, because it needs their browser profile.
  Downloaded files are replaced only after the running game has read its mods, so a session never mixes versions.
- **Crashes:** the loader handles WebView2's `ProcessFailed`. When the page process dies (Chromium's white page
  with a sad face), it logs the kind, reason, exit code and free memory, reloads the page (at most 3 times in
  10 minutes) and keeps the details in `mods\betterdt-crash.txt`. When the browser process itself dies, it
  restarts the game. The settings mod reports what the game is doing every 15 s (screen, game day, JS heap), so
  the crash dialog's "Report problem" can open a prefilled GitHub issue with that and the system (Windows, CPU,
  RAM, GPUs with driver versions, WebView2 version) and copy it to the clipboard. Nothing is sent automatically.
- Everything it does is written to `mods\betterdt.log`.

**Build:** `loader\build.bat` (Visual Studio 2022 with C++; the WebView2 header is downloaded from NuGet),
then add the release notes to `loader\CHANGES.txt` and run `loader\package.ps1`, which creates
`loader\dist\BetterDT.zip`.
Publish: `gh release create v<version> loader/dist/BetterDT.zip`.

## How the game is built

- **Engine:** Construct 3 (Scirra), an HTML5/JavaScript export in a **WebView2** wrapper
  (`Devices Tycoon.exe` + `*.ext.dll`). It is not Unity.
- **Everything is in `www/assets.dat`** (1.4 GB, 9,362 files): a simple uncompressed Construct bundle
  (`c3ab` / `fdir` / `blob`).
- **Game logic** = Construct event sheets in `data.json` (50 MB, 299 layouts, 287 event sheets,
  10,519 object types) plus the author's own JS (saving, perks, achievements…) in `scripts/c3main.js`.
- **Game data** = about 600 JSON files in the Construct Array format: processors, GPUs, OSes, offices,
  marketing, awards, translations…

The author built an **[Integrity] check** into the game: it reads `package.json` and quits the game
("Game files have been modified") when `enable-devtools` is on or `chromium-args` contains
`--remote-debugging-*`. The author does not want DevTools in the game and BetterDT leaves that alone:
it never enables DevTools or remote debugging.

## `dtmod.mjs` (Node 18+, no dependencies)

The older approach: repack `assets.dat` with the mods inside. BetterDT does not need it.

```bash
node dtmod.mjs list "D:\SteamLibrary\steamapps\common\Devices Tycoon\www\assets.dat" ArrayProcessors
```

```bash
node dtmod.mjs unpack "D:\SteamLibrary\steamapps\common\Devices Tycoon\www\assets.dat" extracted "\.json$"
```

A mod is a folder whose files have the same paths as in the bundle. A file with the same name replaces the
original, a new one is added. `install` creates the backup `assets.dat.orig` the first time and always packs
from it, so mods never stack. A small `dtmod.json` marker in the repacked bundle lets `install` notice that
Steam installed a new game version (it becomes the new backup). `restore` puts the original back.

```bash
node dtmod.mjs install "D:\SteamLibrary\steamapps\common\Devices Tycoon" mod
```

```bash
node dtmod.mjs restore "D:\SteamLibrary\steamapps\common\Devices Tycoon"
```

`node dtmod.mjs gpu <game folder> [on|off]` adds the high-performance GPU switch to `package.json` instead.

## Notes

- A Steam update or "Verify integrity of game files" does not touch BetterDT (it only adds files).
- Tested on game versions 1.3 (build 26033576) and 1.4.
- Changing logic in `data.json` is possible but hard (a compiled, positional structure without names).
  JS mods and the data JSON files are the practical way.

## Thanks

- **M1lan.** for the original endless game mod, which `no-ending.js` is based on.

## License

[MIT](LICENSE). BetterDT is a fan project and is not affiliated with the developers of Devices Tycoon.
