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
- **Adjustable autosave:** choose how often the game saves by itself (5 to 180 game days, default 90), so a
  crash costs you less progress.
- **MY OS UPGRADE** no longer stutters.
- **Laptops with two graphics cards:** the game runs on the faster one.
- A **BetterDT** section in the game settings, where you can turn each of these on or off.
  All texts are in the game's 15 languages.

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

- **General:** version, automatic updates (on by default), "Check now" / "Install" for updates,
  high-performance GPU switch, buttons that open the mods folder, the log and the GitHub releases.
- **Mods:** an on/off switch for every mod and the mod options:
  - hire-tools: hire everyone found automatically,
  - train-all: mute the click sounds while training,
  - vacation-tools: the mood threshold for sending people on vacation (default 30),
  - autosave: save every N game days (default 90, 5 to 180).

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
  button (which the game shows only in sandbox mode, where research is free). In sandbox mode the mod stays off.
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

### Writing your own mod

Put a `.js` file into `mods` and add it to `mods\mods.json`:

```js
BetterDT.register('my-mod', runtime => {
  runtime.globalVars.SomeVariable;                 // global variables from the event sheets
  runtime.objects.ArrayOffices.getFirstInstance(); // arrays, dictionaries, sprites…
  runtime.addEventListener('tick', () => {});      // every frame
  BetterDT.settings.bool('my-mod.option', true);   // settings from betterdt.ini
});
```

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
  version 0.2.1
  note <release notes line, shown in the settings>
  mods betterdt-settings.js os-perf.js hire-tools.js train-all.js vacation-tools.js
  ```
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
then `loader\package.ps1 -Notes "…"` creates `loader\dist\BetterDT.zip`.
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
- Tested on game version 1.3 (build 26033576).
- Changing logic in `data.json` is possible but hard (a compiled, positional structure without names).
  JS mods and the data JSON files are the practical way.

## License

[MIT](LICENSE). BetterDT is a fan project and is not affiliated with the developers of Devices Tycoon.
