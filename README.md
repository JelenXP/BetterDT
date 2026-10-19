# Modding Devices Tycoon

## Jak je hra udělaná

- **Engine:** Construct 3 (Scirra), export HTML5/JavaScript v obalu **WebView2**
  (`Devices Tycoon.exe` + `*.ext.dll`). Není to Unity.
- **Všechno je ve `www/assets.dat`** (1,4 GB, 9 362 souborů): jednoduchý nekomprimovaný balík
  Constructu (`c3ab` / `fdir` / `blob`). Uvnitř není žádné šifrování ani podpis.
- **Herní logika** = event sheety Constructu v `data.json` (50 MB, 299 layoutů, 287 event sheetů,
  10 519 typů objektů) a k tomu autorův vlastní JS (ukládání, perky, achievementy…) uvnitř
  `scripts/c3main.js` (minifikovaný).
- **Herní data** = asi 600 JSON souborů ve formátu Construct Array (`{"c2array":true,"size":[x,y,z],"data":…}`):
  procesory, GPU, OS, kanceláře, marketing, ocenění, překlady… Ty se modují nejsnáz.

## Co hra hlídá

Autor do kódu zabudoval **kontrolu [Integrity]**. Ta přečte `package.json` a hru ukončí
(„Game files have been modified“), když je zapnuté `enable-devtools` nebo když `chromium-args` obsahuje
`--remote-debugging-*`. Autor tedy nechce, aby ve hře šly DevTools, a tahle sada nástrojů
je nechává být. **Obsah `assets.dat` nekontroluje**: upravený balík se spustí normálně (ověřeno,
hra se dostala do menu a mod měl přístup k runtime).

## Zavaděč `DTModLoader_x64.ext.dll` (doporučená cesta, `loader/`)

Mody bez úpravy souborů hry. Instalace pro hráče: rozbalit `loader/dist/DTModLoader.zip` do složky
hry (Steam → Spravovat → Procházet místní soubory). Odinstalace: smazat DLL a složku `mods`.

**Jak funguje:**
- `WV2ExtManager.dll` z obalu Constructu načte každý `*.ext.dll` ve složce hry a zavolá jeho
  `WrapperExtInit`. Takhle se načítá i `Steam_x64.ext.dll`. Zavaděč vrátí objekt s prázdnými metodami
  a žádnou komponentu nezaregistruje.
- Při načtení přesměruje v importní tabulce exe `GetProcAddress`. Exe si přes něj bere
  `CreateWebViewEnvironmentWithOptionsInternal`, takže zavaděč dostane volby prostředí a přidá do nich
  `--force_high_performance_gpu` (vypnutí: `gpu=0` v `mods\dtmodloader.ini`). Přepínač nevybírá
  výrobce. Chromium s ním požádá Windows (DXGI) o adaptér s preferencí „vysoký výkon“, tedy o stejné
  pořadí, jaké používá nastavení grafiky ve Windows:
  - jen integrovaná grafika: zůstane na ní,
  - integrovaná + dedikovaná (NVIDIA, AMD, Intel Arc): přejde na dedikovanou,
  - stolní PC jen s dedikovanou: beze změny.

  Seznam grafik a výkonnou volbu zapíše zavaděč do logu. Ověřeno na Intel UHD + RTX 5070:
  s `gpu=1` kreslí RTX, s `gpu=0` Intel.
- Po vytvoření controlleru (hra volá `CreateCoreWebView2ControllerWithOptions`; zachycené jsou všechny
  čtyři varianty) zavaděč zaregistruje `AddScriptToExecuteOnDocumentCreated` se skriptem složeným
  z `mods\mods.json` a souborů v `mods\`. Skript běží jen na hlavní stránce `app.localhost`.
- Ověřeno v kopii hry 1.3 s originálním `assets.dat` i `package.json`:
  - DLL se načte 30–60 ms před vytvořením WebView2,
  - kreslí se na RTX 5070,
  - `os-perf` i `hire-tools` běží (hromadné hledání našlo a najalo přesně 5 lidí).
- Co se děje, je zapsané v `mods\dtmodloader.log`.

**Sestavení:** `loader\build.bat` (Visual Studio 2022 s C++; hlavička WebView2 se stáhne z NuGetu)
a pak `loader\package.ps1`, který vytvoří zip.

**Souběh s `dtmod install`:** když v `assets.dat` zůstal starý loader, nic se nezdvojí.
`DTMods` od zavaděče je jen pro čtení a mod se stejným jménem se podruhé nespustí. Čistší je ale
nejdřív spustit `dtmod restore`.

## Nástroj `dtmod.mjs` (Node 18+, bez závislostí)

```bash
node dtmod.mjs list "D:\SteamLibrary\steamapps\common\Devices Tycoon\www\assets.dat" ArrayProcessors
```

```bash
node dtmod.mjs unpack "D:\SteamLibrary\steamapps\common\Devices Tycoon\www\assets.dat" extracted "\.json$"
```

Mod = složka, ve které mají soubory stejné cesty jako v balíku. Soubor se stejným jménem
nahradí originál, nový se přidá. Instalace (poprvé vytvoří zálohu `assets.dat.orig`):

```bash
node dtmod.mjs install "D:\SteamLibrary\steamapps\common\Devices Tycoon" mod
```

```bash
node dtmod.mjs restore "D:\SteamLibrary\steamapps\common\Devices Tycoon"
```

Balí se vždy z `assets.dat.orig`, takže se mody nevrší přes sebe. Do přebaleného balíku přibude
malý soubor `dtmod.json` jako značka. Podle ní `install` pozná, že Steam mezitím nahrál novou verzi
hry: vezme ji jako novou zálohu a nevrátí hru na starší verzi. `restore` takový nový originál
nechá být.

### JS mody

Když složka s modem obsahuje `mods/loader.js`, `pack`/`install` sám přidá do `index.html` jeden
`<script>`. Loader přečte `mods/mods.json` a spustí každý uvedený skript, jakmile existuje
runtime Constructu:

```js
DTMods.register('muj-mod', runtime => {
  runtime.globalVars.NejakaPromenna;               // globální proměnné z eventů
  runtime.objects.ArrayOffices.getFirstInstance(); // pole, slovníky, sprity…
  runtime.addEventListener('tick', () => {});      // každý snímek
});
```

Ve složce `examples/mods` jsou pomocné mody pro vývoj, které se do hry neinstalují:
`example.js` a `probe.js`. `probe.js` spolu s `probe-server.mjs` posílá stav runtime na
`http://127.0.0.1:9334`, takže nahrazuje konzoli, která kvůli blokaci DevTools není k dispozici.
Když je chceš použít, zkopíruj je do `mod/mods` a připiš do `mods.json`.

## Hotové mody (`mod/mods`)

### `os-perf.js`: plynulé karty vylepšení OS
Obrazovka MY OS UPGRADE se sekala při rychlém klikání. Každá z 35 karet měla `backdrop-filter: blur()`,
který tam vizuálně skoro nic nedělá, a dvojitý `filter: drop-shadow()` přes celou kartu. Oba se počítaly
znovu při každé animaci. Mod je nahrazuje stejnými stíny, které se vykreslí jednou, a každé kartě dá
vlastní vrstvu.
- Vzhled: proti originálu se snímky liší průměrně o 1,4 z 255 úrovní, jen na hranách písma
  (subpixelové vyhlazování).
- Výkon: bez módu měly animace karet trhané snímky. S módem drží 105 FPS v klidu a 85 FPS při
  klikání 2× za sekundu, bez jediného dlouhého snímku.

### `hire-tools.js`: rychlejší nabírání zaměstnanců (FIND EMPLOYEES)
- **Druhé tlačítko na každé agentuře** (ikona osob + číslo) spustí opakované hledání, dokud se
  nenajde přesně tolik lidí, kolik chybí do zaplnění kanceláře zvolené profese.
  - Číslo = volná místa − kandidáti této profese, kteří už čekají na najmutí.
  - Poslední hledání se omezí, aby se nenašlo víc lidí, než je volných míst. Příklad: zbývá 6 míst a
    padne 3 + 2, takže třetí hledání najde jen 1.
  - Každé hledání stojí plnou cenu agentury. Když dojdou peníze nebo kandidáti, hledání skončí
    a hra ukáže své hlášení.
  - Při čísle 0 je tlačítko ztlumené a po kliknutí se ukáže proč (plná kancelář / dost kandidátů).
- **Zaškrtávátko AUTO-HIRE vpravo nahoře** (pamatuje si stav). Když je zaškrtnuté, všichni nalezení
  se rovnou najmou, a to po běžném hledání i po hromadném. Najmou se také dřív nalezení kandidáti
  stejné profese, dokud je místo. Výsledek se ukáže vedle počtu nalezených („Hired: 2“).
  Kdo se nevejde, zůstane v seznamu HIRE EMPLOYEES a hra ukáže „no free space“.
- Všechny texty jsou v 15 jazycích hry. Grafika je složená z herních prvků (stejná tlačítka,
  přechody, ikony a písmo).

### `train-all.js`: školení všech (UPGRADE EMPLOYEES)
- V levém panelu pod legendou je zelené tlačítko **TRAIN ALL (N)**, kde N je počet lidí zvolené profese,
  kteří ještě nemají MAX LEVEL. Kliknutí projde všechny stránky profese a školí, dokud nemají všichni
  maximum nebo dokud nedojdou peníze či body výzkumu.
- Školí se klikáním na herní tlačítka, takže cenu (součet tří úrovní × 1 500 $ a ⌈součet × 0,015⌉ bodů),
  přírůstky, plat i perky počítá hra. Mod jen přepíná stránky (`SubPage`) a kliká.
- Během dávky jsou vypnuté zvuky (`Sounds`), na konci zazní jedno cinknutí. Souhrn („Training finished: 29
  upgrades“, utracené peníze a body) se ukáže v herním oznámení. Když dojdou peníze, připíše se pod
  herní hlášku.
- Ověřeno: 14 návrhářů (29 vylepšení) za necelou sekundu. Při 1 mil. $ se dávka zastavila na herní
  hlášce „You don't have enough funds“.

### `vacation-tools.js`: dovolená pro unavené (MY EMPLOYEES)
- Pod herními tlačítky SEND ON VACATION a PAY THE BONUS je třetí stejné tlačítko
  **VACATION FOR THE TIRED – N NEED A REST**. Pošle na dovolenou všechny zaměstnance všech profesí
  s náladou pod 30 (hra u nich ukazuje „Vacation needed“ nebo „Risk of dismissal“), nejdřív ty
  nejunavenější.
- Pravidla jsou převzatá z eventu herního tlačítka: nálada +30 až 40 (max 100), 30 dní − 7 za perk,
  stav `Vacation`. Z každé profese musí aspoň jeden člověk zůstat v práci. Kdo se proto nevešel,
  zůstane v práci a oznámení to napíše.
- Ověřeno: 67 ze 70 unavených odešlo, 3 zůstali (profese, kde byli unavení všichni). Karta zobrazeného
  zaměstnance se hned přepnula na „ON VACATION – 30 DAYS LEFT“.

Texty obou modů jsou v 15 jazycích hry a tlačítka jsou složená z herních objektů.

## Výkonná grafika (notebooky se dvěma GPU)

WebView2 jinak kreslí hru na úsporné integrované grafice. Na notebooku s Intel UHD a RTX 5070 to
v menu znamenalo GPU vytížené na 84–88 % a jen 70–80 FPS na 165Hz displeji. Na RTX je ta samá
obrazovka na 8 % GPU a ~130 FPS.

```bash
node dtmod.mjs gpu "D:\SteamLibrary\steamapps\common\Devices Tycoon"
```

Příkaz přidá do `chromium-args` v `package.json` přepínač `--force_high_performance_gpu`
(poprvé uloží zálohu `package.json.orig`). Kontrola [Integrity] ve hře vadí jen přepínače pro
DevTools a vzdálené ladění, tenhle pouští dál (ověřeno spuštěním). Vypnutí: `gpu … off`.
`restore` přepínač odebere taky. Mění se jen tenhle jeden přepínač, takže vypnutí funguje
správně i po aktualizaci hry.

## Na co si dát pozor

- Aktualizace ze Steamu nebo „Ověřit integritu herních souborů“ vrátí původní `assets.dat` (a `package.json`).
  Pak stačí znovu spustit `install` a `gpu`. Zálohu si nástroj obnoví sám.
- Ověřeno na verzi 1.3 (build 26033576): kód náboru, obrazovky FIND EMPLOYEES a MY OS UPGRADE
  i použité texty jsou proti 1.2 beze změny a oba mody v ní fungují.
- Hra je jeden velký projekt v Constructu: měnit logiku v `data.json` jde, ale je to zkompilovaná,
  poziční struktura bez jmen, takže se upravuje těžko. Praktická cesta jsou JS mody a datové
  JSON soubory.
