// Real company names – the other companies in the game get their real names (Somy → Sony, Infel → Intel, …).
//
// Game 1.4 can rename companies: Main menu → Editor → Load file reads a text file with one name per line (line =
// company id) into ArrayCompanyNames (column 0 = the game's name, column 1 = the name shown). The developer
// publishes such a file with the real names. This mod does the same without the file: it sets column 1 for every
// company that still has the game's name. The pairs are matched by the game's name, not by the line, so a game
// update that adds or reorders companies does not mix them up.
//
// Only in memory: nothing is written to the game's files. The game loads Settings.dt (with the names) on the start
// page, so the names are set again every 2 seconds where needed (only cells that still hold the game's name).
// A company you renamed yourself in the editor keeps your name. Turning the mod off brings the game's names back
// after a restart, unless the editor saved the names in the meantime (the editor's reset buttons undo that).
BetterDTKit.mod('real-names', {
  needs: { objects: ['ArrayCompanyNames'] },
}, (rt, kit) => {
  if (globalThis.__dtRealNames) globalThis.__dtRealNames.dispose();

  // the game's name|real name (from the developer's names file for game 1.4)
  const PAIRS = (
    'Somy|Sony\nTMR|TMS\nYamana|Yamaha\nNamko|Namco\n' +
    'Xenoz|Xenos\nInfel|Intel\nAMG|AMD\nARN|ARM\n' +
    'Micronoft|Microsoft\nSamsong|Samsung\nMediaRek|MediaTek\nQualconn|Qualcomm\n' +
    'Huavei|Huawei\nAppel|Apple\nGooqle|Google\nPomerVR|PowerVR\n' +
    'Adremo|Adreno\nMalie|Mali\nVivande|Vivante\nXclipce|Xclipse\n' +
    'nVideo|NVIDIA\nExymos|Exynos\nUMISOC|UNISOC\nHiCilicon|HiSilicon\n' +
    'Xoring|XRING\nXiaome|Xiaomi\nGeForse|GeForce\nMaleoom|Maleoon\n' +
    'Androyd|Android\nSumbian|Symbian\nWindovs|Windows\nBlackBerie|BlackBerry\n' +
    'LeMo|LiMo\nMaeno|Maemo\nwebOZ|webOS\nBadda|Bada\n' +
    'WeeGo|MeeGo\nMIIU|MIUI\nEMIU|EMUI\nTisen|Tizen\n' +
    'Fliyme OS|Flyme OS\nSalifish OS|Sailfish OS\nFyre OS|Fire OS\nAshia Platform|Asha Platform\n' +
    'Fantouch OS|Funtouch OS\nColourOS|ColorOS\nFirefax OS|Firefox OS\nUbumtu Touch|Ubuntu Touch\n' +
    'Smartizan OS|Smartisan OS\nOxygemOS|OxygenOS\nHIdrogenOS|HydrogenOS\nHieOS|HiOS\n' +
    'myOS|MyOS\nJoyIU|JoyUI\nMegic UI|Magic UI\nOne IU|One UI\n' +
    'realnee UI|realme UI\nGyperOS|HyperOS\nMegicOS|MagicOS\nNokya|Nokia\n' +
    'Panasoomic|Panasonic\nSennhaiser|Sennheiser\nPhillups|Philips\nELG|LG\n' +
    'Beetz|Beats\nOnePluss|OnePlus\nJambra|Jabra\nLinuks|Linux\n' +
    'Debion|Debian\nFedura|Fedora\nopenZUSE|openSUSE\nUbumtu|Ubuntu\n' +
    'Arck Linuks|Arch Linux\nLinuks Mynt|Linux Mint\nZorrin OS|Zorin OS\nChromoOS|ChromeOS\n' +
    'Elemantary OS|elementary OS\nManjora|Manjaro\nKaly Linuks|Kali Linux\nSteemOS|SteamOS\n' +
    'KalyOS|KaiOS\nKirim|Kirin\nJDL|JBL\nMasharll|Marshall\n' +
    'Raser|Razer\nHyberX|HyperX\nAsuz|ASUS\nEVGE|EVGA\n' +
    'Gigabite|Gigabyte\nINMO3D|INNO3D\nNSI|MSI\nPalite|Palit\n' +
    'PoverColor|PowerColor\nSapfire|Sapphire\nZotak|ZOTAC\nBosse|Bose\n' +
    'AudioTehnica|Audio-Technica\nScollcandy|Skullcandy\nBayerdynamic|Beyerdynamic\nBang & Olyfsem|Bang & Olufsen\n' +
    'AKJ Acoustics|AKG Acoustics\nEbifier|Edifier\nBovers & Vilkins|Bowers & Wilkins\nShurre|Shure\n' +
    'HiFiMen Electronics|HiFiMAN Electronics\nHarnam Karbon|Harman Kardon\nStellSeries|SteelSeries\nPiomeer|Pioneer\n' +
    'OPPRO|OPPO\nViwo|vivo\nRealmee|realme\nMotolora|Motorola\n' +
    'Meisu|Meizu\nHomor|Honor\nLemovo|Lenovo\nZTF|ZTE\n' +
    'Dooqee|Doogee\nNubiu|Nubia\nInfiniex|Infinix\nHTS|HTC\n' +
    'Blakcview|Blackview\nAlcotel|Alcatel\nUlepfone|Ulefone\nOukidel|Oukitel\n' +
    'Viko|Wiko\nCubod|Cubot\nElepfone|Elephone\nUNiDIGI|UMIDIGI\n' +
    'Coolpud|Coolpad\nTSL|TCL\nRoco|POCO\nBlakcShark|Black Shark\n' +
    'Chuvi|Chuwi\nTeclost|Teclast\nHPP|HP\nRell|Dell\n' +
    'Aser|Acer\nAliemware|Alienware\nSiagate|Seagate\nEVVO|EVOO\n' +
    'ColourWay|ColorWay\nYEPPOO|YEPO\nApaser|Apacer\nMediom|Medion\n' +
    'Winga|Vinga\nFuijtsu|Fujitsu\nDream Mahcines|Dream Machines\nAmozfit|Amazfit\n' +
    'Mobwoi|Mobvoi\nFozzil|Fossil\nGermin|Garmin\nFitbyte|Fitbit\n' +
    'GerminOS|Garmin OS\nPebbelOS|Pebble OS\nAsteroydOS|AsteroidOS\nAndroyd Wear|Android Wear\n' +
    'Amozfit OS|Amazfit OS\nFitbyte OS|Fitbit OS\nLyteOS|LiteOS\nWeer OS|Wear OS\n' +
    'RebbelOS|RebbleOS\nMIIU Watch|MIUI Watch\nColourOS Watch|ColorOS Watch\nZeppo OS|Zepp OS\n' +
    'HarmonieOS Watch|HarmonyOS Watch\nTisenOS Watch|Tizen OS Watch\nGyperOS Watch|HyperOS Watch\nBEZ|BES\n' +
    'JLL|JL\nBluetrom|Bluetrum\nRialtek|Realtek\nIBN|IBM\n' +
    'Amlogyc|Amlogic\nNeo Quantom|Neo Quantum\nSamsong Smart TV OS|Samsung Smart TV OS\nRokku OS|Roku OS\n' +
    'tivOS|tvOS\nHisence Smart TV OS|Hisense Smart TV OS\nTiVa OS|TiVo OS\nNetKast|NetCast\n' +
    'Nett TV|Net TV\nSamsong Smart Hub|Samsung Smart Hub\nVYERA Connect|VIERA Connect\nGooqle TV|Google TV\n' +
    'Foxxam OS|Foxxum OS\nAQUOZ Net+|AQUOS Net+\nTisen TV|Tizen TV\nVIDAO|VIDAA\n' +
    'Firefax OS TV|Firefox OS TV\nAndroyd TV|Android TV\nFyre TV OS|Fire TV OS\nwebOZ TV|webOS TV\n' +
    'My Home Skreen|My Home Screen\nAtmell|Atmel\nGygaDevice|GigaDevice\nNXR|NXP\n' +
    'Nordik|Nordic\nEspresif|Espressif\nHoltak|Holtek\nSoniks|Sonix\n' +
    'Texus|Texas Instruments\nInfinion|Infineon\nSirrus Logic|Cirrus Logic\nAKN|AKM\n' +
    'ESZ Technology|ESS Technology\nSomy Ericson|Sony Ericsson\nPaml|Palm\nSharpe|Sharp\n' +
    'NEK|NEC\nKyotera|Kyocera\nPantek|Pantech\nLeEko|LeEco\n' +
    'Gionne|Gionee\nMikromax|Micromax\nLavva|Lava\nKarbon|Karbonn\n' +
    'Spyce|Spice\nYUU|YU\nTEKNO|TECNO\nittel|itel\n' +
    'BLUU|BLU\nBiQ|BQ\nFarephone|Fairphone\nEssentiel|Essential\n' +
    'Nothin|Nothing\nHDM|HMD\nRedMagik|RedMagic\neQOO|iQOO\n' +
    'Redme|Redmi\nSmartisun|Smartisan\nHisence|Hisense\ni-matte|i-mate\n' +
    'Qtec|Qtek\nDopot|Dopod\nE-TENN|E-TEN\nToshima|Toshiba\n' +
    'Garmen-Azus|Garmin-Asus\nSagam|Sagem\nBenQu|BenQ\nBenQu-Simens|BenQ-Siemens\n' +
    'Arkhos|Archos\nYotta Devices|Yota Devices\nWileyfax|Wileyfox\nNextbyt|Nextbit\n' +
    'Virtu|Vertu\nGatewey|Gateway\nPakkard Bell|Packard Bell\nMSY|MSI\n' +
    'VAYO|VAIO\nKlevo|Clevo\nSaiger|Sager\nEurokom|Eurocom\n' +
    'Fujitsu Simens|Fujitsu Siemens\nCompak|Compaq\neMashines|eMachines\nAdvant|Advent\n' +
    'Framewerk|Framework\nSystem77|System76\nTUKSEDO|TUXEDO\nShenker|Schenker\n' +
    'Origen PC|Origin PC\nMaingeer|Maingear\nEluctronics|Eluktronics\nJamper|Jumper\n' +
    'Dynabuk|Dynabook\nGDP|GPD\nOne-Netbuk|One-Netbook\nXGM|XMG\n' +
    'Thunderbot|Thunderobot\nMachenika|Machenike\nColorfull|Colorful\nAmazone|Amazon\n' +
    'Barnes & Nobel|Barnes & Noble\nViewSonik|ViewSonic\nJola|Jolla\nKube|Cube\n' +
    'Onta|Onda\nPrestigo|Prestigio\nPebbel|Pebble\nWithinks|Withings\n' +
    'Polarr|Polar\nSuunta|Suunto\nTAG Hauer|TAG Heuer\nKasio|Casio\n' +
    'Michael Korrs|Michael Kors\nMontblank|Montblanc\nLui Vitton|Louis Vuitton\nCFM|CMF\n' +
    'Plantroniks|Plantronics\nJaybard|Jaybird\nAnkar|Anker\nBragy|Bragi\n' +
    'Master & Dynamik|Master & Dynamic\nLibratune|Libratone\nB&O Pley|B&O Play\nLogitek|Logitech\n' +
    'Korsair|Corsair\nCreativ|Creative\nTehnics|Technics\nKlipch|Klipsch\n' +
    'Denom|Denon\nSoundPETS|SoundPEATS\n1MOAR|1MORE\nQSY|QCY\n' +
    'EarFan|EarFun\nTOZZO|TOZO\nBasseus|Baseus\nSoundkore|Soundcore\n' +
    'JVS|JVC\nHitachy|Hitachi\nMitsubischi Electric|Mitsubishi Electric\nSanio|Sanyo\n' +
    'Grundich|Grundig\nLowe|Loewe\nMets|Metz\nTomson|Thomson\n' +
    'RKA|RCA\nWestinghaus|Westinghouse\nVizzio|Vizio\nInsygnia|Insignia\n' +
    'Magnavoks|Magnavox\nPolaroyd|Polaroid\nElemint|Element\nHayer|Haier\n' +
    'Skywort|Skyworth\nChanghung|Changhong\nKonca|Konka\nVuu|Vu\n' +
    'Onyda|Onida\nVideokon|Videocon\nSansuy|Sansui\nFunay|Funai\n' +
    'Vestal|Vestel\nTelefunkin|Telefunken\nBlaupunct|Blaupunkt\nBushe|Bush\n' +
    'Finluks|Finlux\nSeyki|Seiki\nRokku|Roku\nRaizor|Razor\n' +
    'Segwey|Segway\nNynebot|Ninebot\nInokym|Inokim\nE-TWOO|E-TWOW\n' +
    'Mikro Mobility|Micro Mobility\nUnagy|Unagi\nApolo|Apollo\nNIUU|NIU\n' +
    'Okkai|Okai\nNavvee|Navee\nPura Electric|Pure Electric\nDualtrone|Dualtron\n' +
    'Minimotorz|Minimotors\nKabbo|Kaabo\nVSSET|VSETT\nKugu|Kugoo\n' +
    'Kugu Kirin|Kugoo Kirin\nHiboi|Hiboy\nGotraks|Gotrax\nTurbaAnt|TurboAnt\n' +
    'AnyHil|AnyHill\nVarlla|Varla\nYadia|Yadea\nInMocion|InMotion\n' +
    'Levvy|Levy\nFluyd|Fluid\nSwagtrone|Swagtron\nGlyon|Glion\n' +
    'Merkane|Mercane\nNanrobo|Nanrobot\nJoyer|Joyor\nAOVVO|AOVO\n' +
    'iSkooter|iScooter\niSinweel|iSinwheel\nEngwee|Engwe\nDukati|Ducati\n' +
    'Aprillia|Aprilia\nJeap|Jeep\nBugatty|Bugatti\nMacLaren|McLaren\n' +
    'Cherri|Cherry\nKooler Master|Cooler Master\nTermaltake|Thermaltake\nMad Cats|Mad Catz\n' +
    'Rokkat|Roccat\nSaytek|Saitek\nTrast|Trust\nGenios|Genius\n' +
    'A4Tek|A4Tech\nRapuu|Rapoo\nDukky|Ducky\nLeopald|Leopold\n' +
    'Filko|Filco\nTopra|Topre\nHKKB|HHKB\nDas Keybord|Das Keyboard\n' +
    'Mattias|Matias\nZowy|Zowie\nRedragun|Redragon\nBluddy|Bloody\n' +
    'Ajaz|Ajazz\nMotospid|Motospeed\nVarmillo|Varmilo\nTesorro|Tesoro\n' +
    'Gamdius|Gamdias\nKougar|Cougar\nFnatik Gear|Fnatic Gear\nRoyal Kluge|Royal Kludge\n' +
    'Wuting|Wooting\nAcco|Akko\nKeychrone|Keychron\nDropp|Drop\n' +
    'Glorios|Glorious\nEpomakr|Epomaker\nNuFy|NuPhy\nEndgame Geer|Endgame Gear\n' +
    'Mauntain|Mountain\nNZTX|NZXT\nMonsGik|MonsGeek\nDrunkDear|DrunkDeer\n' +
    'Nintendu|Nintendo\nOuja|Ouya\nValv|Valve\nAtary|Atari\n' +
    'Intellivison|Intellivision\nSNC|SNK\nEverkade|Evercade\nAnaloge|Analogue\n' +
    'Okulus|Oculus\nMetta|Meta\nPIKO|PICO\nDPWR|DPVR\n' +
    'Pimaks|Pimax\nVaryo|Varjo\nBigskreen|Bigscreen\nLynks|Lynx\n' +
    'StarWR|StarVR\nMarwell|Marvell\nBroadkom|Broadcom\nFreescail|Freescale\n' +
    'ST-Ericson|ST-Ericsson\nRenessas|Renesas\nLeadkore|Leadcore\nRokchip|Rockchip\n' +
    'Allwiner|Allwinner\nVYA|VIA\nGainwart|Gainward\nPNW|PNY\n' +
    'Leadtec|Leadtek\nGALLAX|GALAX\nSparkel|Sparkle\nBFG Tek|BFG Tech\n' +
    'XVX|XFX\nHISS|HIS\nKlub 3D|Club 3D\nDyamond Multimedia|Diamond Multimedia\n' +
    'VisionTec|VisionTek\nByostar|Biostar\nManlly|Manli\nPoint of Vue|Point of View\n' +
    'Chaintek|Chaintech\nAlbatrone|Albatron\nEKS|ECS\nMatroks|Matrox\n' +
    'ASRok|ASRock\nYestone|Yeston\nMaxsan|Maxsun\nZefir|Zephyr\n' +
    'Gunir|Gunnir'
  ).split('\n').map(p => p.split('|'));
  const REAL = new Map(PAIRS);

  const table = () => rt.objects.ArrayCompanyNames.getFirstInstance();
  function apply() {
    const a = table();
    if (!a) return;
    const w = a.width | 0;
    let known = 0, set = 0;
    for (let id = 0; id < w; id++) {
      const def = String(a.getAt(id, 0) ?? '');
      const real = REAL.get(def);
      if (real === undefined) continue;
      known++;
      if (String(a.getAt(id, 1) ?? '') === def) { a.setAt(real, id, 1); set++; }
    }
    // the table is not loaded yet (the game fills it at start)
    if (!known) return;
    if (known < REAL.size / 2) return kit.fail(`the game's company names have changed (${known} of ${REAL.size} found)`);
    if (set) BetterDT.log('[real-names] real names set for', set, 'companies (' + known + ' known)');
  }
  const tick = kit.guard(apply);
  tick();
  const timer = setInterval(tick, 2000);

  const dispose = () => clearInterval(timer);
  globalThis.__dtRealNames = { dispose };
  return dispose;
});
