// BetterDT – the "BetterDT" section in the game settings (Settings).
//
// The game's settings page is HTML built by the game (#gs-root: #gs-nav on the left, #gs-main-head and
// #gs-main-body on the right, #gs-foot at the bottom). We add a "BetterDT" group with two items to the
// navigation and render their pages with the same classes (gs-card, gs-row, gs-sw, gs-slider…), so they look
// like the game's. The game rebuilds the navigation on every change (innerHTML = ''), so a MutationObserver
// watches it. Settings are saved immediately (through the loader into mods\betterdt.ini); the Apply button
// belongs to the game pages only.
//
// It also shows two dialogs in the style of the game's news window: "BetterDT x.y.z is ready" (keep playing or
// restart the game now) and, after the loader reloaded a crashed game page, "The game crashed" with a bug report.
// After the game itself was updated, a third one says which mods still fit the new version. If a game update
// changes the settings page so that the section cannot be added, a "BetterDT" button opens the mods as a plain list.
//
// ── BetterDTKit: compatibility checks for mods (runs before the other mod files) ─────────────────────
// A mod registered with BetterDTKit.mod(name, spec, init) starts only once the game data is loaded (main menu)
// and only when everything it needs from the game is there:
//   spec.needs = { functions: [global functions], objects: [object types], vars: [global variables],
//                  check: (rt) => problem text or '',
//                  arrays: { ArrayName: [min width, min height] }, dataCheck: (rt) => problem text or '' }
//                arrays and dataCheck are checked once a saved game is loaded (the company tables are empty in
//                the menu); a mod that fails them then is stopped
//   spec.texts = { index: 'English text' }   game texts; a moved text is found again by its English wording
//   spec.uids  = { uid: { layout, t: type, l: layer, w, h, x, y } }   instances on a layout; when the uid no
//                longer fits (type, layer, size), the instance of that type and layer with that size nearest to
//                x, y is used
// init(rt, kit) returns a dispose function. kit.guard(fn) wraps timers and listeners: errors are counted and after
// 20 of them the mod is stopped. kit.inst(uid), kit.text(index), kit.fail(problem), kit.warn(problem).
// A mod that does not fit this game version is not started; the BetterDT settings say why.
(() => {
  const B = globalThis.BetterDT;
  if (!B || globalThis.BetterDTKit) return;
  const MAX_ERRORS = 20;
  const mods = new Map();   // name -> { state: 'waiting'|'running'|'incompatible'|'failed', problems: [], … }
  const log = (...a) => B.log(...a);
  let rt = null, readyAt = 0;
  const readyWaiters = [];
  const layoutName = () => { try { return rt.layout.name; } catch { return ''; } };

  function dataReady() {
    try {
      const a = rt.objects.ArrayLanguage && rt.objects.ArrayLanguage.getFirstInstance();
      if (!a || a.height <= 1) return false;
      return layoutName() === 'MENU' || Number(rt.globalVars.DayTotal) > 0;
    } catch { return false; }
  }
  // time that passes while the game runs: a minimized window does not tick, so the game loads nothing meanwhile
  function runningClock() {
    let ms = 0, last = Date.now();
    return () => {
      const now = Date.now();
      if (document.visibilityState !== 'hidden') ms += now - last;
      last = now;
      return ms;
    };
  }
  function waitReady(cb) {
    if (readyAt) return cb();
    readyWaiters.push(cb);
    if (readyWaiters.length > 1) return;
    const waited = runningClock();
    (function poll() {
      // a renamed menu or table must not block the mods forever: after 60 s of play the checks run anyway
      if (dataReady() || waited() > 60000) {
        readyAt = Date.now();
        for (const f of readyWaiters.splice(0)) { try { f(); } catch (e) { console.error('[BetterDTKit]', e); } }
      } else setTimeout(poll, 300);
    })();
  }

  // game texts: index in game 1.3.0 -> index in this game version (-1 = not found)
  const textMap = new Map();
  function healText(idx, en) {
    if (textMap.has(idx)) return textMap.get(idx);
    let found = -1;
    try {
      const a = rt.objects.ArrayLanguage.getFirstInstance();
      if (String(a.getAt(0, idx)) === en) found = idx;
      else for (let y = 0; y < a.height; y++) if (String(a.getAt(0, y)) === en) { found = y; break; }
    } catch { }
    if (found >= 0 && found !== idx) log('[BetterDTKit] text', idx, 'moved to', found, JSON.stringify(en));
    textMap.set(idx, found);
    return found;
  }

  // A saved game is loaded after its required tables have been filled.  Since game 1.5, DayTotal becomes
  // positive before several of those tables are populated, so time alone is not a reliable signal.
  const gameWaiters = [];
  let gameSince = null, gameTimer = 0;
  function tablesReady(spec) {
    for (const [name, [w, h]] of Object.entries((spec.needs || {}).arrays || {})) {
      let a = null;
      try { a = rt.objects[name] && rt.objects[name].getFirstInstance(); } catch { }
      if (!a || a.width < (w || 0) || a.height < (h || 0)) return false;
    }
    return true;
  }
  function tablesEmpty(spec) {
    for (const name of Object.keys((spec.needs || {}).arrays || {})) {
      let a = null;
      try { a = rt.objects[name] && rt.objects[name].getFirstInstance(); } catch { }
      if (a && (a.width === 0 || a.height === 0)) return true;
    }
    return false;
  }
  function whenGameLoaded(spec, cb) {
    gameWaiters.push({ spec, cb });
    if (gameTimer) return;
    gameTimer = setInterval(() => {
      if (!(Number(rt.globalVars.DayTotal) > 0)) { gameSince = null; return; }
      if (!gameSince) { gameSince = runningClock(); return; }
      const since = gameSince();
      if (since < 2000) return;
      // Keep waiting only for tables that have not arrived yet.  The timeout lets checkData still report a
      // genuinely incompatible game instead of leaving a mod in the waiting state forever.
      const force = since >= 60000;
      for (let i = gameWaiters.length - 1; i >= 0; i--) {
        const w = gameWaiters[i];
        // an empty table (0 rows or columns) is not loaded yet (a new game being set up, a save still loading):
        // keep waiting for it even after the timeout, only a filled table of the wrong size is incompatible
        if ((!force && !tablesReady(w.spec)) || tablesEmpty(w.spec)) continue;
        gameWaiters.splice(i, 1);
        try { w.cb(); } catch (e) { console.error('[BetterDTKit]', e); }
      }
      if (!gameWaiters.length) { clearInterval(gameTimer); gameTimer = 0; }
    }, 500);
  }

  function check(spec) {
    const p = [], n = spec.needs || {};
    for (const f of n.functions || []) if (typeof globalThis[f] !== 'function') p.push('function ' + f);
    for (const o of n.objects || []) if (!rt.objects[o]) p.push('object ' + o);
    for (const v of n.vars || []) if (!(v in rt.globalVars)) p.push('variable ' + v);
    for (const name of Object.keys(n.arrays || {})) if (!rt.objects[name]) p.push('table ' + name);
    for (const [idx, en] of Object.entries(spec.texts || {})) if (healText(Number(idx), en) < 0) p.push(`text ${idx} "${en}"`);
    if (n.check) { try { const r = n.check(rt); if (r) p.push(String(r)); } catch (e) { p.push('check: ' + e); } }
    return p;
  }
  function checkData(spec) {
    const p = [], n = spec.needs || {};
    for (const [name, [w, h]] of Object.entries(n.arrays || {})) {
      let a = null;
      try { a = rt.objects[name] && rt.objects[name].getFirstInstance(); } catch { }
      if (!a) p.push('table ' + name);
      else if (a.width < (w || 0) || a.height < (h || 0)) p.push(`table ${name} ${a.width}×${a.height} (expected ${w || 0}×${h || 0})`);
    }
    if (n.dataCheck) { try { const r = n.dataCheck(rt); if (r) p.push(String(r)); } catch (e) { p.push('check: ' + e); } }
    return p;
  }

  const near = (a, b, tol) => b === undefined || Math.abs(a - b) <= tol;
  const fits = (i, s) => !!i && i.objectType.name === s.t && i.layer.name === s.l && near(i.width, s.w, 2) && near(i.height, s.h, 2);
  const alive = (i) => { try { return rt.getInstanceByUid(i.uid) === i; } catch { return false; } };

  function mod(name, spec, init) {
    const m = { name, state: 'waiting', problems: [], errors: 0, dispose: null, warned: new Set(), cache: new Map() };
    mods.set(name, m);
    function stop(state, problem) {
      if (m.state !== 'running' && m.state !== 'waiting') return;
      m.state = state;
      if (problem) m.problems.push(problem);
      log('[BetterDTKit] mod', name, state + ':', problem);
      if (m.dispose) { try { m.dispose(); } catch (e) { console.error('[BetterDT] mod', name, 'dispose:', e); } }
    }
    const kit = {
      guard(fn) {
        return function () {
          if (m.state !== 'running') return undefined;
          try { return fn.apply(this, arguments); } catch (e) {
            m.errors++;
            console.error('[BetterDT] mod', name, 'error', m.errors + '/' + MAX_ERRORS + ':', e);
            if (m.errors >= MAX_ERRORS) stop('failed', String((e && e.message) || e));
            return undefined;
          }
        };
      },
      // instances are looked up once per layout visit (before the mod moves or resizes them) and then cached
      inst(uid) {
        const s = spec.uids && spec.uids[uid];
        let i = m.cache.get(uid);
        if (i && alive(i)) return i;
        i = null;
        try { i = rt.getInstanceByUid(uid); } catch { }
        if (s && !fits(i, s)) {
          let best = null, bd = Infinity;
          try {
            for (const c of rt.objects[s.t].getAllInstances()) {
              if (!fits(c, s)) continue;
              const d = Math.hypot(c.x - (s.x ?? c.x), c.y - (s.y ?? c.y));
              if (d < bd) { bd = d; best = c; }
            }
          } catch { }
          if (best) kit.warn(`instance ${uid} found as ${best.uid}`);
          else if (s.layout && layoutName() === s.layout) kit.warn(`instance ${uid} (${s.t}) not found on ${s.layout}`);
          i = best;
        }
        if (i) m.cache.set(uid, i);
        return i;
      },
      text(idx) {
        const en = spec.texts && spec.texts[idx];
        const y = en === undefined ? idx : healText(idx, en);
        if (y < 0) return '';
        try {
          const n = Number(rt.globalVars.LanguageChoose);
          return String(rt.objects.ArrayLanguage.getFirstInstance().getAt(n >= 0 && n < 15 ? n : 0, y));
        } catch { return ''; }
      },
      warn(problem) {
        if (m.warned.has(problem)) return;
        m.warned.add(problem);
        m.problems.push(problem);
        log('[BetterDTKit]', name + ':', problem);
      },
      fail(problem) { stop('incompatible', problem); },
    };
    B.register(name, (runtime) => {
      rt = runtime;
      waitReady(() => {
        const p = check(spec);
        if (p.length) {
          m.problems.push(...p); m.state = 'incompatible';
          log('[BetterDTKit] mod', name, 'not started, missing:', p.join(', '));
          return;
        }
        m.state = 'running';
        try {
          const d = init(rt, kit);
          m.dispose = typeof d === 'function' ? d : d && typeof d.dispose === 'function' ? () => d.dispose() : null;
          log('[BetterDTKit] started', name);
        } catch (e) { console.error('[BetterDT] mod', name, 'failed:', e); stop('failed', 'start: ' + ((e && e.message) || e)); }
        const n = spec.needs || {};
        if (Object.keys(n.arrays || {}).length || n.dataCheck) whenGameLoaded(spec, () => {
          const q = checkData(spec);
          if (q.length) stop('incompatible', q.join(', '));
        });
      });
    });
  }

  const api = {
    mod,
    status: () => [...mods.values()].map(m => ({ name: m.name, state: m.state, problems: m.problems.slice() })),
    // cb runs once the game data is loaded and the mods have been checked
    whenReady(runtime, cb) { rt = rt || runtime; waitReady(() => setTimeout(cb, 0)); },
    get gameVersion() { try { return String(rt.projectVersion || ''); } catch { return ''; } },
  };
  Object.defineProperty(globalThis, 'BetterDTKit', { value: Object.freeze(api), writable: false, configurable: false });
})();

BetterDT.register('betterdt-settings', (rt) => {
  const B = globalThis.BetterDT, S = B.settings, KIT = globalThis.BetterDTKit;
  const kitStatus = (file) => (KIT ? KIT.status().find(m => m.name + '.js' === file) : null);
  const PAGES = ['bdt-general', 'bdt-mods'];

  // language order as in the game (LanguageChoose): en ru de fr it es hi tr pt-BR uk id pl zh ko ja
  const TXT = {
    general: ['General', 'Общие', 'Allgemein', 'Général', 'Generale', 'General', 'सामान्य', 'Genel', 'Geral', 'Загальні', 'Umum', 'Ogólne', '常规', '일반', '一般'],
    mods: ['Mods', 'Моды', 'Mods', 'Mods', 'Mod', 'Mods', 'मॉड', 'Modlar', 'Mods', 'Моди', 'Mod', 'Mody', '模组', '모드', 'MOD'],
    hint: ['Changes are saved immediately', 'Изменения сохраняются сразу', 'Änderungen werden sofort gespeichert', 'Les modifications sont enregistrées immédiatement',
      'Le modifiche vengono salvate subito', 'Los cambios se guardan al instante', 'बदलाव तुरंत सहेजे जाते हैं', 'Değişiklikler hemen kaydedilir', 'As alterações são salvas na hora',
      'Зміни зберігаються одразу', 'Perubahan langsung disimpan', 'Zmiany zapisują się od razu', '更改会立即保存', '변경 사항은 즉시 저장됩니다', '変更はすぐに保存されます'],
    version: ['Version', 'Версия', 'Version', 'Version', 'Versione', 'Versión', 'संस्करण', 'Sürüm', 'Versão', 'Версія', 'Versi', 'Wersja', '版本', '버전', 'バージョン'],
    autoUpdate: ['Automatic updates', 'Автообновление', 'Automatische Updates', 'Mises à jour automatiques', 'Aggiornamenti automatici', 'Actualizaciones automáticas',
      'स्वचालित अपडेट', 'Otomatik güncellemeler', 'Atualizações automáticas', 'Автооновлення', 'Pembaruan otomatis', 'Automatyczne aktualizacje', '自动更新', '자동 업데이트', '自動アップデート'],
    autoUpdateHint: ['Checks GitHub when the game starts and installs new versions', 'При запуске игры проверяет GitHub и ставит новые версии',
      'Prüft beim Spielstart GitHub und installiert neue Versionen', 'Vérifie GitHub au lancement et installe les nouvelles versions',
      'All’avvio controlla GitHub e installa le nuove versioni', 'Al iniciar el juego revisa GitHub e instala versiones nuevas',
      'गेम शुरू होने पर GitHub जाँचता है और नए संस्करण इंस्टॉल करता है', 'Oyun açılırken GitHub’ı kontrol eder ve yeni sürümleri kurar',
      'Ao iniciar o jogo verifica o GitHub e instala novas versões', 'Під час запуску гри перевіряє GitHub і ставить нові версії',
      'Memeriksa GitHub saat game dimulai dan memasang versi baru', 'Przy starcie gry sprawdza GitHub i instaluje nowe wersje',
      '游戏启动时检查 GitHub 并安装新版本', '게임 시작 시 GitHub를 확인하고 새 버전을 설치합니다', '起動時に GitHub を確認し、新しいバージョンを入れます'],
    check: ['Check now', 'Проверить', 'Jetzt prüfen', 'Vérifier', 'Controlla ora', 'Comprobar', 'अभी जाँचें', 'Şimdi kontrol et', 'Verificar', 'Перевірити', 'Periksa', 'Sprawdź', '立即检查', '지금 확인', '今すぐ確認'],
    updates: ['Updates', 'Обновления', 'Updates', 'Mises à jour', 'Aggiornamenti', 'Actualizaciones', 'अपडेट', 'Güncellemeler', 'Atualizações', 'Оновлення',
      'Pembaruan', 'Aktualizacje', '更新', '업데이트', 'アップデート'],
    checking: ['Checking…', 'Проверка…', 'Wird geprüft…', 'Vérification…', 'Controllo…', 'Comprobando…', 'जाँच हो रही है…', 'Kontrol ediliyor…', 'Verificando…', 'Перевірка…', 'Memeriksa…', 'Sprawdzanie…', '正在检查…', '확인 중…', '確認中…'],
    uptodate: ['You have the latest version', 'Установлена последняя версия', 'Neueste Version installiert', 'Vous avez la dernière version', 'Hai l’ultima versione',
      'Tienes la última versión', 'नवीनतम संस्करण है', 'En son sürüm kurulu', 'Você tem a versão mais recente', 'Встановлено останню версію', 'Versi terbaru sudah terpasang',
      'Masz najnowszą wersję', '已是最新版本', '최신 버전입니다', '最新バージョンです'],
    available: ['Version {v} is available', 'Доступна версия {v}', 'Version {v} ist verfügbar', 'La version {v} est disponible', 'È disponibile la versione {v}',
      'La versión {v} está disponible', 'संस्करण {v} उपलब्ध है', '{v} sürümü mevcut', 'A versão {v} está disponível', 'Доступна версія {v}', 'Versi {v} tersedia',
      'Dostępna jest wersja {v}', '有新版本 {v}', '{v} 버전을 사용할 수 있습니다', 'バージョン {v} があります'],
    downloading: ['Downloading {v}…', 'Загрузка {v}…', '{v} wird geladen…', 'Téléchargement de {v}…', 'Download di {v}…', 'Descargando {v}…', '{v} डाउनलोड हो रहा है…',
      '{v} indiriliyor…', 'Baixando {v}…', 'Завантаження {v}…', 'Mengunduh {v}…', 'Pobieranie {v}…', '正在下载 {v}…', '{v} 다운로드 중…', '{v} をダウンロード中…'],
    installed: ['Version {v} installed – restart the game', 'Версия {v} установлена – перезапустите игру', 'Version {v} installiert – Spiel neu starten',
      'Version {v} installée – relancez le jeu', 'Versione {v} installata – riavvia il gioco', 'Versión {v} instalada: reinicia el juego',
      'संस्करण {v} इंस्टॉल हुआ – गेम फिर से शुरू करें', '{v} sürümü kuruldu – oyunu yeniden başlatın', 'Versão {v} instalada – reinicie o jogo',
      'Версію {v} встановлено – перезапустіть гру', 'Versi {v} terpasang – mulai ulang game', 'Zainstalowano wersję {v} – uruchom grę ponownie',
      '已安装 {v} – 请重启游戏', '{v} 버전 설치됨 – 게임을 다시 시작하세요', '{v} をインストールしました – ゲームを再起動してください'],
    failed: ['Update failed: {e}', 'Ошибка обновления: {e}', 'Update fehlgeschlagen: {e}', 'Échec de la mise à jour : {e}', 'Aggiornamento non riuscito: {e}',
      'Error al actualizar: {e}', 'अपडेट विफल: {e}', 'Güncelleme başarısız: {e}', 'Falha na atualização: {e}', 'Помилка оновлення: {e}', 'Pembaruan gagal: {e}',
      'Aktualizacja nieudana: {e}', '更新失败：{e}', '업데이트 실패: {e}', 'アップデート失敗: {e}'],
    noRelease: ['No published release on GitHub yet', 'На GitHub пока нет опубликованной версии', 'Noch keine veröffentlichte Version auf GitHub',
      'Aucune version publiée sur GitHub', 'Nessuna versione pubblicata su GitHub', 'Aún no hay versión publicada en GitHub', 'GitHub पर अभी कोई प्रकाशित संस्करण नहीं',
      'GitHub’da yayımlanmış sürüm yok', 'Ainda não há versão publicada no GitHub', 'На GitHub ще немає опублікованої версії', 'Belum ada rilis di GitHub',
      'Brak opublikowanej wersji na GitHubie', 'GitHub 上还没有发布版本', 'GitHub에 게시된 버전이 아직 없습니다', 'GitHub に公開版はまだありません'],
    gpu: ['High-performance GPU', 'Мощная видеокарта', 'Leistungsstarke GPU', 'GPU haute performance', 'GPU ad alte prestazioni', 'GPU de alto rendimiento',
      'हाई-परफ़ॉर्मेंस GPU', 'Yüksek performanslı GPU', 'GPU de alto desempenho', 'Потужна відеокарта', 'GPU performa tinggi', 'Wydajna karta graficzna', '高性能显卡', '고성능 GPU', '高性能 GPU'],
    gpuHint: ['Render on the dedicated graphics card (laptops with two GPUs)', 'Рисовать на дискретной видеокарте (ноутбуки с двумя GPU)',
      'Auf der dedizierten Grafikkarte rendern (Laptops mit zwei GPUs)', 'Rendu sur la carte graphique dédiée (portables à deux GPU)',
      'Rendering sulla scheda video dedicata (portatili con due GPU)', 'Renderizar en la gráfica dedicada (portátiles con dos GPU)',
      'डेडिकेटेड ग्राफ़िक्स कार्ड पर रेंडर करें (दो GPU वाले लैपटॉप)', 'Harici ekran kartında çiz (iki GPU’lu dizüstüler)',
      'Renderizar na placa de vídeo dedicada (notebooks com duas GPUs)', 'Малювати на дискретній відеокарті (ноутбуки з двома GPU)',
      'Render di kartu grafis khusus (laptop dengan dua GPU)', 'Renderuj na dedykowanej karcie (laptopy z dwiema kartami)',
      '使用独立显卡渲染（双显卡笔记本）', '외장 그래픽카드로 렌더링 (GPU가 둘인 노트북)', '専用 GPU で描画（GPU が2つあるノートPC）'],
    folder: ['Mods folder', 'Папка модов', 'Mod-Ordner', 'Dossier des mods', 'Cartella mod', 'Carpeta de mods', 'मॉड फ़ोल्डर', 'Mod klasörü', 'Pasta de mods', 'Тека модів',
      'Folder mod', 'Folder modów', '模组文件夹', '모드 폴더', 'MOD フォルダー'],
    open: ['Open', 'Открыть', 'Öffnen', 'Ouvrir', 'Apri', 'Abrir', 'खोलें', 'Aç', 'Abrir', 'Відкрити', 'Buka', 'Otwórz', '打开', '열기', '開く'],
    log: ['Log', 'Журнал', 'Protokoll', 'Journal', 'Registro', 'Registro', 'लॉग', 'Günlük', 'Registro', 'Журнал', 'Log', 'Dziennik', '日志', '로그', 'ログ'],
    community: ['Community', 'Сообщество', 'Community', 'Communauté', 'Community', 'Comunidad', 'समुदाय', 'Topluluk', 'Comunidade',
      'Спільнота', 'Komunitas', 'Społeczność', '社区', '커뮤니티', 'コミュニティ'],
    communityHint: ['Questions, ideas and bug reports', 'Вопросы, идеи и сообщения об ошибках', 'Fragen, Ideen und Fehlerberichte',
      'Questions, idées et signalements de bugs', 'Domande, idee e segnalazioni di bug', 'Preguntas, ideas y reportes de errores',
      'सवाल, सुझाव और बग रिपोर्ट', 'Sorular, fikirler ve hata bildirimleri', 'Perguntas, ideias e relatos de bugs',
      'Питання, ідеї та повідомлення про помилки', 'Pertanyaan, ide, dan laporan bug', 'Pytania, pomysły i zgłoszenia błędów',
      '问题、想法和错误报告', '질문, 아이디어, 버그 신고', '質問、アイデア、不具合の報告'],
    updDiscord: ['Ideas, questions or a bug? Join us on', 'Идеи, вопросы или ошибка? Присоединяйтесь к нам в',
      'Ideen, Fragen oder ein Fehler? Komm zu uns auf', 'Des idées, des questions ou un bug ? Rejoignez-nous sur',
      'Idee, domande o un bug? Unisciti a noi su', '¿Ideas, preguntas o un error? Únete a nosotros en',
      'सुझाव, सवाल या कोई बग? हमसे जुड़ें', 'Fikir, soru ya da hata mı var? Bize katılın:',
      'Ideias, dúvidas ou um bug? Junte-se a nós no', 'Ідеї, питання чи помилка? Приєднуйтесь до нас у',
      'Ada ide, pertanyaan, atau bug? Gabung dengan kami di', 'Pomysły, pytania albo błąd? Dołącz do nas na',
      '有想法、问题或发现错误？欢迎加入我们的', '아이디어, 질문, 버그가 있나요? 함께해요:', 'アイデア・質問・不具合は'],
    releases: ['Releases', 'Версии', 'Versionen', 'Versions', 'Versioni', 'Versiones', 'संस्करण', 'Sürümler', 'Versões', 'Версії', 'Rilis', 'Wydania', '版本发布', '릴리스', 'リリース'],
    modsHint: ['Turning a mod on or off takes effect after a restart', 'Включение и выключение модов сработает после перезапуска',
      'Ein- und Ausschalten wirkt nach einem Neustart', 'Activer ou désactiver un mod prend effet après un redémarrage',
      'Attivare o disattivare una mod ha effetto dopo il riavvio', 'Activar o desactivar un mod surte efecto tras reiniciar',
      'मॉड चालू या बंद करना रीस्टार्ट के बाद लागू होगा', 'Mod açma/kapama yeniden başlatınca geçerli olur',
      'Ligar ou desligar um mod vale após reiniciar', 'Увімкнення і вимкнення модів спрацює після перезапуску',
      'Menyalakan atau mematikan mod berlaku setelah mulai ulang', 'Włączenie lub wyłączenie moda zadziała po restarcie',
      '启用或禁用模组需重启后生效', '모드 켜기/끄기는 다시 시작한 후 적용됩니다', 'MOD のオン/オフは再起動後に反映されます'],
    options: ['Options', 'Параметры', 'Optionen', 'Options', 'Opzioni', 'Opciones', 'विकल्प', 'Seçenekler', 'Opções', 'Параметри', 'Opsi', 'Opcje', '选项', '옵션', 'オプション'],
    custom: ['Custom mod', 'Свой мод', 'Eigener Mod', 'Mod personnel', 'Mod personale', 'Mod propio', 'कस्टम मॉड', 'Özel mod', 'Mod próprio', 'Власний мод',
      'Mod kustom', 'Własny mod', '自定义模组', '사용자 모드', 'カスタム MOD'],
    restart: ['Restart the game to apply the change', 'Перезапустите игру, чтобы применить', 'Starte das Spiel neu, um es zu übernehmen',
      'Relancez le jeu pour appliquer', 'Riavvia il gioco per applicare', 'Reinicia el juego para aplicar', 'लागू करने के लिए गेम फिर से शुरू करें',
      'Uygulamak için oyunu yeniden başlatın', 'Reinicie o jogo para aplicar', 'Перезапустіть гру, щоб застосувати', 'Mulai ulang game untuk menerapkan',
      'Uruchom grę ponownie, aby zastosować', '重启游戏后生效', '적용하려면 게임을 다시 시작하세요', '反映するにはゲームを再起動してください'],
    saved: ['Saved', 'Сохранено', 'Gespeichert', 'Enregistré', 'Salvato', 'Guardado', 'सहेजा गया', 'Kaydedildi', 'Salvo', 'Збережено', 'Tersimpan', 'Zapisano', '已保存', '저장됨', '保存しました'],
    'os-perf': ['Smoother OS upgrades', 'Плавные улучшения ОС', 'Flüssigere OS-Upgrades', 'Améliorations d’OS plus fluides', 'Aggiornamenti OS più fluidi',
      'Mejoras de SO más fluidas', 'स्मूद OS अपग्रेड', 'Daha akıcı OS geliştirmeleri', 'Melhorias de SO mais fluidas', 'Плавні покращення ОС', 'Upgrade OS lebih mulus',
      'Płynniejsze ulepszenia OS', '更流畅的系统升级', '더 부드러운 OS 업그레이드', 'OS アップグレードを軽く'],
    'os-perf.d': ['Same OS upgrade cards without the heavy blur filters', 'Те же карточки улучшений ОС без тяжёлого размытия',
      'Gleiche OS-Karten ohne schwere Weichzeichner', 'Mêmes cartes d’OS sans les flous coûteux', 'Stesse schede OS senza i filtri di sfocatura pesanti',
      'Las mismas tarjetas de SO sin desenfoques pesados', 'वही OS कार्ड, भारी ब्लर के बिना', 'Aynı OS kartları, ağır bulanıklık olmadan',
      'Os mesmos cartões de SO sem desfoques pesados', 'Ті самі картки ОС без важкого розмиття', 'Kartu OS yang sama tanpa blur berat',
      'Te same karty OS bez ciężkiego rozmycia', '相同的系统升级卡片，去掉了沉重的模糊', '같은 OS 카드, 무거운 블러 없이', '同じ OS カードを重いぼかしなしで'],
    'hire-tools': ['Hiring tools', 'Найм сотрудников', 'Einstellungs-Werkzeuge', 'Outils d’embauche', 'Strumenti di assunzione', 'Herramientas de contratación',
      'भर्ती टूल', 'İşe alım araçları', 'Ferramentas de contratação', 'Найм працівників', 'Alat rekrutmen', 'Narzędzia rekrutacji', '招聘工具', '채용 도구', '採用ツール'],
    'hire-tools.d': ['FIND EMPLOYEES: search until the office is full, auto-hire', 'ПОИСК: искать до заполнения офиса, автонайм',
      'MITARBEITER SUCHEN: suchen bis das Büro voll ist, Auto-Einstellen', 'RECHERCHE : chercher jusqu’à remplir le bureau, embauche auto',
      'CERCA: cerca finché l’ufficio è pieno, assunzione auto', 'BUSCAR: buscar hasta llenar la oficina, contratación auto',
      'खोज: ऑफ़िस भरने तक खोजें, स्वतः नियुक्ति', 'ARA: ofis dolana kadar ara, otomatik işe al', 'BUSCAR: procurar até lotar o escritório, contratação auto',
      'ПОШУК: шукати до заповнення офісу, автонайм', 'CARI: cari sampai kantor penuh, rekrut otomatis', 'SZUKAJ: szukaj do zapełnienia biura, autozatrudnianie',
      '寻找员工：搜到办公室满员，自动雇佣', '직원 찾기: 사무실이 찰 때까지 검색, 자동 채용', '社員探し：オフィスが埋まるまで検索、自動採用'],
    'hire-tools.autoHire': ['Hire everyone found automatically', 'Сразу нанимать всех найденных', 'Alle Gefundenen automatisch einstellen',
      'Embaucher automatiquement les candidats trouvés', 'Assumi automaticamente chi viene trovato', 'Contratar automáticamente a los encontrados',
      'मिले सभी को स्वतः नियुक्त करें', 'Bulunanları otomatik işe al', 'Contratar automaticamente os encontrados', 'Одразу наймати всіх знайдених',
      'Rekrut otomatis semua yang ditemukan', 'Automatycznie zatrudniaj znalezionych', '自动雇佣找到的所有人', '찾은 사람 자동 채용', '見つけた人を自動で採用'],
    'train-all': ['Train all', 'Обучить всех', 'Alle schulen', 'Tout former', 'Forma tutti', 'Entrenar a todos', 'सभी को प्रशिक्षित करें', 'Hepsini eğit', 'Treinar todos',
      'Навчити всіх', 'Latih semua', 'Szkol wszystkich', '全部培训', '모두 교육', '全員を研修'],
    'train-all.d': ['UPGRADE EMPLOYEES: one button trains everyone of all professions to the max', 'УЛУЧШЕНИЕ: одна кнопка обучает всех сотрудников всех профессий до максимума',
      'MITARBEITER VERBESSERN: ein Knopf schult alle Mitarbeiter aller Berufe aufs Maximum', 'AMÉLIORER : un bouton forme tous les employés de tous les métiers au maximum',
      'MIGLIORA: un pulsante forma tutti i dipendenti di tutte le professioni al massimo', 'MEJORAR: un botón entrena a todos los empleados de todas las profesiones al máximo',
      'अपग्रेड: एक बटन सभी पेशों के सभी कर्मचारियों को अधिकतम तक प्रशिक्षित करता है', 'GELİŞTİR: tek tuşla tüm mesleklerdeki herkes maksimuma', 'MELHORAR: um botão treina todos de todas as profissões ao máximo',
      'ПОКРАЩЕННЯ: одна кнопка навчає всіх працівників усіх професій до максимуму', 'TINGKATKAN: satu tombol melatih semua karyawan semua profesi ke maksimum',
      'ULEPSZ: jeden przycisk szkoli wszystkich pracowników wszystkich zawodów do maksimum', '升级员工：一键把所有职业的员工培训到满级', '직원 강화: 버튼 하나로 모든 직종의 직원을 최대까지', '社員強化：ボタン1つで全職種の全員を最大まで'],
    'train-all.mute': ['Mute the click sounds while training', 'Без звуков кликов во время обучения', 'Klickgeräusche beim Schulen stummschalten',
      'Couper les sons de clic pendant la formation', 'Silenzia i clic durante la formazione', 'Silenciar los clics durante el entrenamiento',
      'प्रशिक्षण के दौरान क्लिक ध्वनियाँ बंद', 'Eğitim sırasında tık seslerini kapat', 'Silenciar os cliques durante o treino', 'Без звуків кліків під час навчання',
      'Matikan suara klik saat pelatihan', 'Wycisz kliknięcia podczas szkolenia', '培训时静音点击声', '교육 중 클릭 소리 끄기', '研修中のクリック音を消す'],
    updTitle: ['BetterDT {v} is ready', 'BetterDT {v} готов', 'BetterDT {v} ist bereit', 'BetterDT {v} est prêt', 'BetterDT {v} è pronto', 'BetterDT {v} está listo',
      'BetterDT {v} तैयार है', 'BetterDT {v} hazır', 'BetterDT {v} está pronto', 'BetterDT {v} готовий', 'BetterDT {v} siap', 'BetterDT {v} jest gotowy',
      'BetterDT {v} 已就绪', 'BetterDT {v} 준비 완료', 'BetterDT {v} の準備ができました'],
    updText: ['The new version starts the next time you launch the game. Restart now to use it right away – if you are playing, save first.',
      'Новая версия запустится при следующем запуске игры. Перезапустите сейчас, чтобы использовать её сразу – если вы играете, сначала сохранитесь.',
      'Die neue Version startet beim nächsten Spielstart. Starte jetzt neu, um sie sofort zu nutzen – wenn du gerade spielst, speichere vorher.',
      'La nouvelle version démarrera au prochain lancement du jeu. Redémarrez maintenant pour l’utiliser tout de suite – si vous jouez, sauvegardez d’abord.',
      'La nuova versione partirà al prossimo avvio del gioco. Riavvia ora per usarla subito – se stai giocando, salva prima.',
      'La nueva versión se iniciará la próxima vez que abras el juego. Reinicia ahora para usarla ya; si estás jugando, guarda antes.',
      'नया संस्करण अगली बार गेम शुरू करने पर चलेगा। इसे अभी इस्तेमाल करने के लिए फिर से शुरू करें – अगर आप खेल रहे हैं, तो पहले सेव करें।',
      'Yeni sürüm oyunu bir sonraki açışınızda başlar. Hemen kullanmak için şimdi yeniden başlatın – oynuyorsanız önce kaydedin.',
      'A nova versão será usada na próxima vez que você abrir o jogo. Reinicie agora para usá-la já – se estiver jogando, salve antes.',
      'Нова версія запуститься під час наступного запуску гри. Перезапустіть зараз, щоб скористатися нею одразу – якщо ви граєте, спершу збережіться.',
      'Versi baru akan dipakai saat game dibuka lagi. Mulai ulang sekarang untuk langsung memakainya – jika sedang bermain, simpan dulu.',
      'Nowa wersja uruchomi się przy następnym starcie gry. Uruchom ponownie teraz, aby używać jej od razu – jeśli grasz, najpierw zapisz grę.',
      '新版本将在下次启动游戏时生效。立即重启即可马上使用——如果正在游戏中，请先存档。',
      '새 버전은 다음에 게임을 시작할 때 적용됩니다. 바로 사용하려면 지금 다시 시작하세요. 플레이 중이라면 먼저 저장하세요.',
      '新しいバージョンは次回ゲームを起動したときに使われます。すぐ使うには今すぐ再起動してください。プレイ中なら先にセーブしてください。'],
    later: ['Keep playing', 'Продолжить игру', 'Weiterspielen', 'Continuer à jouer', 'Continua a giocare', 'Seguir jugando', 'खेलना जारी रखें', 'Oynamaya devam et',
      'Continuar jogando', 'Продовжити гру', 'Lanjut bermain', 'Graj dalej', '继续游戏', '계속 플레이', 'このまま遊ぶ'],
    restart: ['Restart now', 'Перезапустить', 'Jetzt neu starten', 'Redémarrer', 'Riavvia ora', 'Reiniciar ahora', 'अभी फिर से शुरू करें', 'Şimdi yeniden başlat',
      'Reiniciar agora', 'Перезапустити', 'Mulai ulang', 'Uruchom ponownie', '立即重启', '지금 다시 시작', '今すぐ再起動'],
    crashTitle: ['The game crashed', 'Сбой игры', 'Das Spiel ist abgestürzt', 'Le jeu a planté', 'Il gioco si è bloccato', 'El juego se ha bloqueado', 'गेम क्रैश हो गया',
      'Oyun çöktü', 'O jogo travou', 'Збій гри', 'Game mengalami crash', 'Gra uległa awarii', '游戏崩溃了', '게임이 충돌했습니다', 'ゲームがクラッシュしました'],
    crashText: ['The game screen stopped working (white screen), so BetterDT reloaded the game. Load your last save to continue.',
      'Экран игры перестал работать (белый экран), поэтому BetterDT перезагрузил игру. Загрузите последнее сохранение, чтобы продолжить.',
      'Der Spielbildschirm funktionierte nicht mehr (weißer Bildschirm), deshalb hat BetterDT das Spiel neu geladen. Lade deinen letzten Spielstand, um weiterzuspielen.',
      'L’écran du jeu a cessé de fonctionner (écran blanc), BetterDT a donc rechargé le jeu. Chargez votre dernière sauvegarde pour continuer.',
      'La schermata del gioco ha smesso di funzionare (schermo bianco), quindi BetterDT ha ricaricato il gioco. Carica l’ultimo salvataggio per continuare.',
      'La pantalla del juego dejó de funcionar (pantalla blanca), así que BetterDT recargó el juego. Carga tu última partida guardada para continuar.',
      'गेम की स्क्रीन ने काम करना बंद कर दिया (सफ़ेद स्क्रीन), इसलिए BetterDT ने गेम फिर से लोड किया। जारी रखने के लिए अपना आख़िरी सेव लोड करें।',
      'Oyun ekranı çalışmayı durdurdu (beyaz ekran), bu yüzden BetterDT oyunu yeniden yükledi. Devam etmek için son kaydınızı yükleyin.',
      'A tela do jogo parou de funcionar (tela branca), então o BetterDT recarregou o jogo. Carregue seu último save para continuar.',
      'Екран гри перестав працювати (білий екран), тому BetterDT перезавантажив гру. Завантажте останнє збереження, щоб продовжити.',
      'Layar game berhenti bekerja (layar putih), jadi BetterDT memuat ulang game. Muat simpanan terakhir untuk melanjutkan.',
      'Ekran gry przestał działać (biały ekran), więc BetterDT wczytał grę ponownie. Wczytaj ostatni zapis, aby kontynuować.',
      '游戏画面停止工作（白屏），BetterDT 已重新加载游戏。请读取最近的存档继续。',
      '게임 화면이 멈춰서(흰 화면) BetterDT가 게임을 다시 불러왔습니다. 마지막 저장을 불러와 계속하세요.',
      'ゲーム画面が動かなくなった（白い画面）ため、BetterDT がゲームを再読み込みしました。最後のセーブをロードして続けてください。'],
    crashHint: ['“Report problem” opens a prefilled report on GitHub and copies it, so you can also paste it into the Steam discussion.',
      '«Сообщить о проблеме» откроет готовый отчёт на GitHub и скопирует его – его можно вставить и в обсуждение в Steam.',
      '„Problem melden“ öffnet einen vorausgefüllten Bericht auf GitHub und kopiert ihn, damit du ihn auch in die Steam-Diskussion einfügen kannst.',
      '« Signaler le problème » ouvre un rapport prérempli sur GitHub et le copie, pour le coller aussi dans la discussion Steam.',
      '“Segnala il problema” apre una segnalazione precompilata su GitHub e la copia, così puoi incollarla anche nella discussione di Steam.',
      '«Informar del problema» abre un informe ya rellenado en GitHub y lo copia, para que también puedas pegarlo en la discusión de Steam.',
      '“समस्या की रिपोर्ट करें” GitHub पर भरी हुई रिपोर्ट खोलता है और उसे कॉपी करता है, ताकि आप उसे Steam चर्चा में भी चिपका सकें।',
      '“Sorunu bildir” GitHub’da hazır bir rapor açar ve kopyalar; Steam tartışmasına da yapıştırabilirsiniz.',
      '“Relatar problema” abre um relatório preenchido no GitHub e o copia, para você também colar na discussão da Steam.',
      '«Повідомити про проблему» відкриє готовий звіт на GitHub і скопіює його – його можна вставити й в обговорення в Steam.',
      '“Laporkan masalah” membuka laporan yang sudah terisi di GitHub dan menyalinnya, jadi bisa juga ditempel di diskusi Steam.',
      '„Zgłoś problem” otwiera wypełniony raport na GitHubie i kopiuje go, więc możesz go też wkleić do dyskusji na Steamie.',
      '“报告问题”会在 GitHub 上打开已填好的报告并复制它，你也可以把它粘贴到 Steam 讨论区。',
      '“문제 신고”는 GitHub에 미리 채워진 보고서를 열고 복사해 두므로 Steam 토론에도 붙여 넣을 수 있습니다.',
      '「問題を報告」は記入済みのレポートを GitHub で開いてコピーします。Steam のディスカッションにも貼り付けられます。'],
    ok: ['OK', 'ОК', 'OK', 'OK', 'OK', 'Aceptar', 'ठीक है', 'Tamam', 'OK', 'Гаразд', 'OK', 'OK', '确定', '확인', 'OK'],
    report: ['Report problem', 'Сообщить о проблеме', 'Problem melden', 'Signaler le problème', 'Segnala il problema', 'Informar del problema',
      'समस्या की रिपोर्ट करें', 'Sorunu bildir', 'Relatar problema', 'Повідомити про проблему', 'Laporkan masalah', 'Zgłoś problem', '报告问题', '문제 신고', '問題を報告'],
    autosave: ['Autosave', 'Автосохранение', 'Automatisches Speichern', 'Sauvegarde auto', 'Salvataggio automatico', 'Autoguardado', 'ऑटो-सेव',
      'Otomatik kayıt', 'Salvamento automático', 'Автозбереження', 'Simpan otomatis', 'Autozapis', '自动存档', '자동 저장', 'オートセーブ'],
    'autosave.d': ['Replaces the game\'s autosave choice (30 to 365 days) with any interval from 5 to 360 game days',
      'Заменяет выбор автосохранения игры (30–365 дней) любым интервалом от 5 до 360 игровых дней',
      'Ersetzt die Autospeicher-Auswahl des Spiels (30–365 Tage) durch jeden Abstand von 5 bis 360 Spieltagen',
      'Remplace le choix de sauvegarde auto du jeu (30 à 365 jours) par n\'importe quel intervalle de 5 à 360 jours de jeu',
      'Sostituisce la scelta di salvataggio automatico del gioco (30–365 giorni) con qualsiasi intervallo da 5 a 360 giorni di gioco',
      'Sustituye la opción de autoguardado del juego (30 a 365 días) por cualquier intervalo de 5 a 360 días de juego',
      'गेम के ऑटो-सेव विकल्प (30–365 दिन) की जगह 5 से 360 गेम दिनों का कोई भी अंतराल',
      'Oyunun otomatik kayıt seçimini (30–365 gün) 5 ile 360 oyun günü arasındaki herhangi bir aralıkla değiştirir',
      'Substitui a escolha de salvamento automático do jogo (30 a 365 dias) por qualquer intervalo de 5 a 360 dias de jogo',
      'Замінює вибір автозбереження гри (30–365 днів) будь-яким інтервалом від 5 до 360 ігрових днів',
      'Mengganti pilihan simpan otomatis game (30–365 hari) dengan interval apa pun dari 5 sampai 360 hari game',
      'Zastępuje wybór autozapisu gry (30–365 dni) dowolnym odstępem od 5 do 360 dni gry',
      '用 5 到 360 个游戏日之间的任意间隔取代游戏的自动存档选项（30–365 天）',
      '게임의 자동 저장 선택(30–365일)을 5~360 게임 일 사이의 원하는 주기로 바꿉니다',
      'ゲームのオートセーブ間隔（30〜365日）を、5〜360ゲーム日の好きな間隔に置き換えます'],
    'research-all': ['Research all', 'Исследовать все', 'Alles erforschen', 'Tout rechercher', 'Ricerca tutto', 'Investigar todo',
      'सब पर शोध करें', 'Tümünü araştır', 'Pesquisar tudo', 'Дослідити все', 'Riset semua', 'Zbadaj wszystko', '全部研究', '모두 연구', 'すべて研究'],
    'research-all.d': ['RESEARCH LAB: next to the game\'s button (now "Research tab"), "Research all" researches everything on all tabs',
      'ЛАБОРАТОРИЯ: рядом с кнопкой игры (теперь «Исследовать вкладку») «Исследовать все» исследует всё на всех вкладках',
      'FORSCHUNGSLABOR: neben der Spiel-Schaltfläche (jetzt „Tab erforschen“) erforscht „Alles erforschen“ alles auf allen Tabs',
      'LABORATOIRE : à côté du bouton du jeu (désormais « Rechercher l\'onglet »), « Tout rechercher » recherche tout dans tous les onglets',
      'LABORATORIO: accanto al pulsante del gioco (ora «Ricerca scheda»), «Ricerca tutto» ricerca tutto in tutte le schede',
      'LABORATORIO: junto al botón del juego (ahora «Investigar pestaña»), «Investigar todo» investiga todo en todas las pestañas',
      'प्रयोगशाला: गेम के बटन (अब "टैब पर शोध करें") के बगल में "सब पर शोध करें" सभी टैब पर सब कुछ शोध करता है',
      'LABORATUVAR: oyunun düğmesinin (artık "Sekmeyi araştır") yanında "Tümünü araştır" tüm sekmelerdeki her şeyi araştırır',
      'LABORATÓRIO: ao lado do botão do jogo (agora "Pesquisar aba"), "Pesquisar tudo" pesquisa tudo em todas as abas',
      'ЛАБОРАТОРІЯ: поруч із кнопкою гри (тепер «Дослідити вкладку») «Дослідити все» досліджує все на всіх вкладках',
      'LAB RISET: di samping tombol game (sekarang "Riset tab"), "Riset semua" meriset semuanya di semua tab',
      'LABORATORIUM: obok przycisku gry (teraz „Zbadaj kartę”) „Zbadaj wszystko” bada wszystko na wszystkich kartach',
      '研究实验室：在游戏按钮（现为“研究此页”）旁，“全部研究”会研究所有分页的全部内容',
      '연구실: 게임 버튼(이제 "탭 연구") 옆의 "모두 연구"가 모든 탭의 모든 항목을 연구합니다',
      '研究室：ゲームのボタン（「タブを研究」に変更）の隣の「すべて研究」が、全タブのすべてを研究します'],
    'game-speed': ['Game speed ×2 and ×3', 'Скорость игры ×2 и ×3', 'Spieltempo ×2 und ×3', 'Vitesse du jeu ×2 et ×3', 'Velocità di gioco ×2 e ×3',
      'Velocidad del juego ×2 y ×3', 'गेम स्पीड ×2 और ×3', 'Oyun hızı ×2 ve ×3', 'Velocidade do jogo ×2 e ×3', 'Швидкість гри ×2 і ×3',
      'Kecepatan game ×2 dan ×3', 'Prędkość gry ×2 i ×3', '游戏速度 ×2 和 ×3', '게임 속도 ×2 및 ×3', 'ゲーム速度 ×2 と ×3'],
    'game-speed.d': ['The speed button in the corner also offers ×2 and ×3', 'Кнопка скорости в углу предлагает также ×2 и ×3',
      'Der Tempo-Knopf in der Ecke bietet auch ×2 und ×3', 'Le bouton de vitesse dans le coin propose aussi ×2 et ×3',
      'Il pulsante della velocità nell’angolo offre anche ×2 e ×3', 'El botón de velocidad de la esquina ofrece también ×2 y ×3',
      'कोने का स्पीड बटन ×2 और ×3 भी देता है', 'Köşedeki hız düğmesi ×2 ve ×3 de sunar', 'O botão de velocidade no canto também oferece ×2 e ×3',
      'Кнопка швидкості в куті пропонує також ×2 і ×3', 'Tombol kecepatan di pojok juga menawarkan ×2 dan ×3',
      'Przycisk prędkości w rogu oferuje też ×2 i ×3', '角落的速度按钮也提供 ×2 和 ×3', '모서리의 속도 버튼에서 ×2와 ×3도 선택할 수 있습니다',
      '隅の速度ボタンで ×2 と ×3 も選べます'],
    gameVer: ['Game version', 'Версия игры', 'Spielversion', 'Version du jeu', 'Versione del gioco', 'Versión del juego', 'गेम संस्करण', 'Oyun sürümü',
      'Versão do jogo', 'Версія гри', 'Versi game', 'Wersja gry', '游戏版本', '게임 버전', 'ゲームのバージョン'],
    stIncompat: ['Does not fit this game version, turned off', 'Не подходит к этой версии игры, отключён', 'Passt nicht zu dieser Spielversion, ausgeschaltet',
      'Incompatible avec cette version du jeu, désactivé', 'Non compatibile con questa versione del gioco, disattivato', 'No es compatible con esta versión del juego, desactivado',
      'इस गेम संस्करण से मेल नहीं खाता, बंद किया गया', 'Bu oyun sürümüne uymuyor, kapatıldı', 'Não é compatível com esta versão do jogo, desativado',
      'Не підходить до цієї версії гри, вимкнено', 'Tidak cocok dengan versi game ini, dimatikan', 'Nie pasuje do tej wersji gry, wyłączony',
      '与此游戏版本不兼容，已关闭', '이 게임 버전과 맞지 않아 꺼졌습니다', 'このゲームバージョンに対応していないためオフにしました'],
    stFailed: ['Stopped after repeated errors', 'Остановлен после повторных ошибок', 'Nach wiederholten Fehlern angehalten', 'Arrêté après des erreurs répétées',
      'Fermato dopo errori ripetuti', 'Detenido tras errores repetidos', 'बार-बार त्रुटियों के बाद रोका गया', 'Tekrarlanan hatalardan sonra durduruldu',
      'Parado após erros repetidos', 'Зупинено після повторних помилок', 'Dihentikan setelah kesalahan berulang', 'Zatrzymany po powtarzających się błędach',
      '多次出错后已停止', '반복된 오류로 중지되었습니다', 'エラーが続いたため停止しました'],
    stWarn: ['Works, but something in the game has changed', 'Работает, но в игре что-то изменилось', 'Läuft, aber im Spiel hat sich etwas geändert',
      'Fonctionne, mais quelque chose a changé dans le jeu', 'Funziona, ma qualcosa nel gioco è cambiato', 'Funciona, pero algo ha cambiado en el juego',
      'चल रहा है, पर गेम में कुछ बदल गया है', 'Çalışıyor ama oyunda bir şey değişmiş', 'Funciona, mas algo mudou no jogo',
      'Працює, але в грі щось змінилося', 'Berjalan, tetapi ada yang berubah di game', 'Działa, ale coś w grze się zmieniło',
      '可以运行，但游戏有所变化', '작동하지만 게임에서 무언가 바뀌었습니다', '動作していますが、ゲーム側で何かが変わっています'],
    verTitle: ['The game has been updated', 'Игра обновилась', 'Das Spiel wurde aktualisiert', 'Le jeu a été mis à jour', 'Il gioco è stato aggiornato',
      'El juego se ha actualizado', 'गेम अपडेट हो गया है', 'Oyun güncellendi', 'O jogo foi atualizado', 'Гру оновлено', 'Game telah diperbarui',
      'Gra została zaktualizowana', '游戏已更新', '게임이 업데이트되었습니다', 'ゲームがアップデートされました'],
    verText: ['Devices Tycoon {a} → {b}. BetterDT has checked its mods.', 'Devices Tycoon {a} → {b}. BetterDT проверил свои моды.',
      'Devices Tycoon {a} → {b}. BetterDT hat seine Mods geprüft.', 'Devices Tycoon {a} → {b}. BetterDT a vérifié ses mods.',
      'Devices Tycoon {a} → {b}. BetterDT ha controllato le sue mod.', 'Devices Tycoon {a} → {b}. BetterDT ha revisado sus mods.',
      'Devices Tycoon {a} → {b}. BetterDT ने अपने मॉड जाँचे।', 'Devices Tycoon {a} → {b}. BetterDT modlarını kontrol etti.',
      'Devices Tycoon {a} → {b}. O BetterDT verificou seus mods.', 'Devices Tycoon {a} → {b}. BetterDT перевірив свої моди.',
      'Devices Tycoon {a} → {b}. BetterDT telah memeriksa mod-nya.', 'Devices Tycoon {a} → {b}. BetterDT sprawdził swoje mody.',
      'Devices Tycoon {a} → {b}。BetterDT 已检查其模组。', 'Devices Tycoon {a} → {b}. BetterDT가 모드를 확인했습니다.', 'Devices Tycoon {a} → {b}。BetterDT が MOD を確認しました。'],
    verAllOk: ['All mods work.', 'Все моды работают.', 'Alle Mods funktionieren.', 'Tous les mods fonctionnent.', 'Tutte le mod funzionano.', 'Todos los mods funcionan.',
      'सभी मॉड काम कर रहे हैं।', 'Tüm modlar çalışıyor.', 'Todos os mods funcionam.', 'Усі моди працюють.', 'Semua mod berfungsi.', 'Wszystkie mody działają.',
      '所有模组均正常。', '모든 모드가 작동합니다.', 'すべての MOD が動作しています。'],
    verOff: ['Turned off until a BetterDT update fixes them: {list}', 'Отключены до обновления BetterDT: {list}', 'Bis zu einem BetterDT-Update ausgeschaltet: {list}',
      "Désactivés jusqu'à une mise à jour de BetterDT : {list}", 'Disattivate fino a un aggiornamento di BetterDT: {list}', 'Desactivados hasta una actualización de BetterDT: {list}',
      'BetterDT अपडेट तक बंद: {list}', 'BetterDT güncellemesine kadar kapalı: {list}', 'Desativados até uma atualização do BetterDT: {list}',
      'Вимкнено до оновлення BetterDT: {list}', 'Dimatikan sampai pembaruan BetterDT: {list}', 'Wyłączone do aktualizacji BetterDT: {list}',
      '在 BetterDT 更新前已关闭：{list}', 'BetterDT 업데이트 전까지 꺼짐: {list}', 'BetterDT のアップデートまでオフ：{list}'],
    fbTitle: ['BetterDT mods', 'Моды BetterDT', 'BetterDT-Mods', 'Mods BetterDT', 'Mod di BetterDT', 'Mods de BetterDT', 'BetterDT मॉड', 'BetterDT modları',
      'Mods do BetterDT', 'Моди BetterDT', 'Mod BetterDT', 'Mody BetterDT', 'BetterDT 模组', 'BetterDT 모드', 'BetterDT の MOD'],
    fbText: ["The game's settings page has changed, so here is a simple list. Changes take effect after a restart.",
      'Страница настроек игры изменилась, поэтому здесь простой список. Изменения сработают после перезапуска.',
      'Die Einstellungsseite des Spiels hat sich geändert, deshalb hier eine einfache Liste. Änderungen wirken nach einem Neustart.',
      'La page des paramètres du jeu a changé, voici donc une liste simple. Les changements prennent effet après un redémarrage.',
      'La pagina delle impostazioni del gioco è cambiata, quindi ecco un semplice elenco. Le modifiche valgono dopo il riavvio.',
      'La página de ajustes del juego ha cambiado, así que aquí hay una lista sencilla. Los cambios se aplican tras reiniciar.',
      'गेम का सेटिंग पेज बदल गया है, इसलिए यहाँ एक सरल सूची है। बदलाव रीस्टार्ट के बाद लागू होंगे।',
      'Oyunun ayarlar sayfası değişti, bu yüzden burada basit bir liste var. Değişiklikler yeniden başlatınca geçerli olur.',
      'A página de configurações do jogo mudou, então aqui está uma lista simples. As alterações valem após reiniciar.',
      'Сторінка налаштувань гри змінилася, тому тут простий список. Зміни запрацюють після перезапуску.',
      'Halaman pengaturan game berubah, jadi ini daftar sederhana. Perubahan berlaku setelah dimulai ulang.',
      'Strona ustawień gry się zmieniła, więc tu jest prosta lista. Zmiany zadziałają po ponownym uruchomieniu.',
      '游戏的设置页面已改变，因此这里提供一个简单列表。更改将在重启后生效。',
      '게임 설정 페이지가 바뀌어 간단한 목록을 표시합니다. 변경 사항은 재시작 후 적용됩니다.',
      'ゲームの設定画面が変わったため、簡易リストを表示しています。変更は再起動後に反映されます。'],
    'low-end': ['Low-end mode', 'Режим для слабых ПК', 'Modus für schwache PCs', 'Mode PC modeste', 'Modalità PC datati', 'Modo para PC modestos',
      'कमज़ोर पीसी मोड', 'Düşük donanım modu', 'Modo para PCs fracos', 'Режим для слабких ПК', 'Mode PC lawas', 'Tryb dla słabszych PC', '低配模式', '저사양 모드', '低スペックモード'],
    'low-end.d': ['Lighter rendering for older computers', 'Облегчённая отрисовка для старых компьютеров', 'Leichtere Darstellung für ältere Computer',
      'Rendu plus léger pour les ordinateurs anciens', 'Grafica più leggera per computer datati', 'Renderizado más ligero para ordenadores antiguos',
      'पुराने कंप्यूटरों के लिए हल्की रेंडरिंग', 'Eski bilgisayarlar için daha hafif çizim', 'Renderização mais leve para computadores antigos',
      'Легше відмальовування для старих комп’ютерів', 'Tampilan lebih ringan untuk komputer lama', 'Lżejsze renderowanie dla starszych komputerów',
      '为旧电脑减轻渲染负担', '오래된 컴퓨터를 위한 가벼운 렌더링', '古いパソコン向けに描画を軽くします'],
    'low-end.fps': ['Limit to 30 FPS', 'Ограничить до 30 FPS', 'Auf 30 FPS begrenzen', 'Limiter à 30 FPS', 'Limita a 30 FPS', 'Limitar a 30 FPS',
      '30 FPS तक सीमित करें', '30 FPS ile sınırla', 'Limitar a 30 FPS', 'Обмежити до 30 FPS', 'Batasi ke 30 FPS', 'Ogranicz do 30 FPS', '限制为 30 FPS', '30 FPS로 제한', '30 FPS に制限'],
    'low-end.blur': ['Turn off blur', 'Отключить размытие', 'Unschärfe ausschalten', 'Désactiver le flou', 'Disattiva la sfocatura', 'Desactivar el desenfoque',
      'ब्लर बंद करें', 'Bulanıklığı kapat', 'Desativar o desfoque', 'Вимкнути розмиття', 'Matikan efek blur', 'Wyłącz rozmycie', '关闭模糊效果', '흐림 효과 끄기', 'ぼかしをオフ'],
    'no-ending': ['Endless game', 'Бесконечная игра', 'Endloses Spiel', 'Partie sans fin', 'Partita infinita', 'Partida infinita',
      'अंतहीन खेल', 'Sonsuz oyun', 'Jogo infinito', 'Нескінченна гра', 'Permainan tanpa akhir', 'Gra bez końca', '无尽模式', '끝없는 게임', 'エンドレスゲーム'],
    'no-ending.d': ['Keep playing after the end of the game in 2101', 'Играть дальше после конца игры в 2101 году',
      'Nach dem Spielende 2101 weiterspielen', 'Continuer à jouer après la fin du jeu en 2101', 'Continua a giocare dopo la fine del gioco nel 2101',
      'Seguir jugando tras el final del juego en 2101', '2101 में खेल खत्म होने के बाद भी खेलते रहें', '2101’deki oyun sonundan sonra oynamaya devam et',
      'Continuar jogando depois do fim do jogo em 2101', 'Грати далі після кінця гри у 2101 році', 'Terus bermain setelah game berakhir di 2101',
      'Graj dalej po końcu gry w 2101 roku', '在 2101 年游戏结束后继续游玩', '2101년 게임 종료 후에도 계속 플레이', '2101年のゲーム終了後もプレイを続ける'],
    'no-ending.skip': ['Skip the final screen', 'Пропустить финальный экран', 'Abschlussbildschirm überspringen', "Passer l'écran final",
      'Salta la schermata finale', 'Omitir la pantalla final', 'अंतिम स्क्रीन छोड़ें', 'Son ekranı atla', 'Pular a tela final', 'Пропустити фінальний екран',
      'Lewati layar akhir', 'Pomiń ekran końcowy', '跳过结束画面', '마지막 화면 건너뛰기', '最終画面をスキップ'],
    'real-names': ['Real company names', 'Настоящие названия компаний', 'Echte Firmennamen', "Vrais noms d'entreprises",
      'Nomi reali delle aziende', 'Nombres reales de empresas', 'असली कंपनी नाम', 'Gerçek şirket adları', 'Nomes reais das empresas',
      'Справжні назви компаній', 'Nama perusahaan asli', 'Prawdziwe nazwy firm', '真实公司名称', '실제 회사 이름', '実在の会社名'],
    'real-names.d': ['Other companies get their real names (Sony, Intel, …)', 'Другие компании получают настоящие названия (Sony, Intel, …)',
      'Andere Firmen bekommen ihre echten Namen (Sony, Intel, …)', "Les autres entreprises prennent leur vrai nom (Sony, Intel, …)",
      'Le altre aziende hanno i loro nomi reali (Sony, Intel, …)', 'Las demás empresas reciben sus nombres reales (Sony, Intel, …)',
      'दूसरी कंपनियों को उनके असली नाम मिलते हैं (Sony, Intel, …)', 'Diğer şirketler gerçek adlarını alır (Sony, Intel, …)',
      'As outras empresas recebem seus nomes reais (Sony, Intel, …)', 'Інші компанії отримують справжні назви (Sony, Intel, …)',
      'Perusahaan lain memakai nama aslinya (Sony, Intel, …)', 'Inne firmy dostają prawdziwe nazwy (Sony, Intel, …)',
      '其他公司使用真实名称（Sony、Intel……）', '다른 회사들이 실제 이름을 사용합니다 (Sony, Intel, …)', '他の会社が実在の名前になります（Sony、Intel など）'],
    'store-upgrade-all': ['All stores to max',
      'Все магазины на максимум',
      'Alle Läden aufs Maximum',
      'Tous les magasins au maximum',
      'Tutti i negozi al massimo',
      'Todas las tiendas al máximo',
      'सभी स्टोर अधिकतम तक',
      'Tüm mağazalar maksimuma',
      'Todas as lojas ao máximo',
      'Усі магазини на максимум',
      'Semua toko ke maksimal',
      'Wszystkie sklepy na maksa',
      '所有门店升到最高',
      '모든 매장 최대로',
      '全店舗を最大まで'],
    'store-upgrade-all.d': ['MY STORES: next to the game\'s "Upgrade all", "All to max" upgrades every store again and again while the money lasts',
      'МОИ МАГАЗИНЫ: рядом с «Улучшить все» игры кнопка «Всё на максимум» улучшает все магазины снова и снова, пока хватает денег',
      'MEINE LÄDEN: neben „Alle verbessern“ des Spiels verbessert „Alles aufs Maximum“ alle Läden immer wieder, solange das Geld reicht',
      'MES MAGASINS : à côté de « Tout améliorer » du jeu, « Tout au maximum » améliore tous les magasins encore et encore tant que l’argent suffit',
      'I MIEI NEGOZI: accanto a «Migliora tutto» del gioco, «Tutto al massimo» migliora tutti i negozi più volte finché bastano i soldi',
      'MIS TIENDAS: junto a «Mejorar todo» del juego, «Todo al máximo» mejora todas las tiendas una y otra vez mientras alcance el dinero',
      'मेरे स्टोर: गेम के "सभी अपग्रेड करें" के बगल में "सब अधिकतम तक" पैसे रहने तक सभी स्टोर बार-बार अपग्रेड करता है',
      'MAĞAZALARIM: oyunun "Tümünü geliştir" düğmesinin yanında "Hepsi maksimuma" para yettikçe tüm mağazaları tekrar tekrar geliştirir',
      'MINHAS LOJAS: ao lado de "Melhorar tudo" do jogo, "Tudo no máximo" melhora todas as lojas várias vezes enquanto houver dinheiro',
      'МОЇ МАГАЗИНИ: поруч із «Покращити все» гри кнопка «Усе на максимум» покращує всі магазини знову і знову, поки вистачає грошей',
      'TOKO SAYA: di samping "Tingkatkan semua" dari game, "Semua ke maksimal" meningkatkan semua toko berulang kali selama uang cukup',
      'MOJE SKLEPY: obok „Ulepsz wszystko” z gry „Wszystko na maksa” ulepsza wszystkie sklepy raz za razem, dopóki starcza pieniędzy',
      '我的门店：在游戏的“全部升级”旁，“全部升到最高”会在资金足够时反复升级所有门店',
      '내 매장: 게임의 "모두 업그레이드" 옆의 "모두 최대로"가 돈이 허락하는 한 모든 매장을 계속 업그레이드합니다',
      'マイストア：ゲームの「すべてアップグレード」の隣の「すべて最大まで」が、資金が続く限り全店舗を繰り返しアップグレードします'],
    'unlimited-shares': ['Unlimited shares', 'Неограниченные акции', 'Unbegrenzte Aktien', 'Actions illimitées', 'Azioni illimitate',
      'Acciones ilimitadas', 'असीमित शेयर', 'Sınırsız hisse', 'Ações ilimitadas', 'Необмежені акції', 'Saham tanpa batas', 'Nielimitowane akcje',
      '无限股票', '무제한 주식', '株の購入上限なし'],
    'unlimited-shares.d': ['INVESTING: buy as many shares as your money allows, up to the game\'s 49 % limit, in one purchase',
      'ИНВЕСТИЦИИ: покупайте столько акций, сколько позволяют деньги, до лимита игры 49 % за одну покупку',
      'INVESTITIONEN: so viele Aktien kaufen, wie das Geld erlaubt, bis zur Spielgrenze von 49 % in einem Kauf',
      'INVESTISSEMENTS : achetez autant d’actions que votre argent le permet, jusqu’à la limite de 49 % du jeu, en un seul achat',
      'INVESTIMENTI: compra tutte le azioni che i soldi consentono, fino al limite del 49 % del gioco, in un solo acquisto',
      'INVERSIONES: compra tantas acciones como permita tu dinero, hasta el límite del 49 % del juego, en una sola compra',
      'निवेश: जितने पैसे हों उतने शेयर खरीदें, गेम की 49 % सीमा तक, एक ही खरीद में',
      'YATIRIM: paranın yettiği kadar hisseyi, oyunun %49 sınırına kadar tek seferde al',
      'INVESTIMENTOS: compre quantas ações o dinheiro permitir, até o limite de 49 % do jogo, numa só compra',
      'ІНВЕСТИЦІЇ: купуйте стільки акцій, скільки дозволяють гроші, до ліміту гри 49 % за одну покупку',
      'INVESTASI: beli saham sebanyak yang uangmu mampu, sampai batas 49 % dari game, dalam satu pembelian',
      'INWESTYCJE: kupuj tyle akcji, na ile starcza pieniędzy, do limitu gry 49 %, w jednym zakupie',
      '投资：在一次购买中买入资金允许的全部股票，直到游戏的 49% 上限',
      '투자: 돈이 허락하는 만큼 주식을 한 번에 구매 (게임의 49% 한도까지)',
      '投資：資金の許す限りの株を、ゲームの上限 49% まで一度に購入'],
    'fixed-fps': ['Fixed FPS without slowdown, above 165',
      'Фиксированный FPS без замедления, выше 165',
      'Fester FPS-Wert ohne Verlangsamung, über 165',
      'FPS fixe sans ralentissement, au-delà de 165',
      'FPS fisso senza rallentamenti, oltre 165',
      'FPS fijo sin ralentización, por encima de 165',
      'फिक्स्ड FPS बिना धीमेपन के, 165 से ऊपर',
      'Yavaşlamadan sabit FPS, 165 üstü',
      'FPS fixo sem lentidão, acima de 165',
      'Фіксований FPS без уповільнення, понад 165',
      'FPS tetap tanpa melambat, di atas 165',
      'Stały FPS bez spowolnienia, powyżej 165',
      '固定帧率不变慢，可超过 165',
      '느려지지 않는 고정 FPS, 165 이상',
      '固定FPSでも遅くならず、165超も可能'],
    'fixed-fps.d': ['A high fixed FPS no longer slows the game down, so the game\'s 165 FPS limit can go higher',
      'Высокий фиксированный FPS больше не замедляет игру, поэтому лимит игры 165 FPS можно поднять',
      'Ein hoher fester FPS-Wert verlangsamt das Spiel nicht mehr, daher kann die Spielgrenze von 165 FPS höher sein',
      'Un FPS fixe élevé ne ralentit plus la partie, la limite de 165 FPS du jeu peut donc être dépassée',
      'Un FPS fisso alto non rallenta più il gioco, quindi il limite di 165 FPS del gioco può salire',
      'Un FPS fijo alto ya no ralentiza la partida, así que el límite de 165 FPS del juego puede subir',
      'ऊँचा फिक्स्ड FPS अब गेम को धीमा नहीं करता, इसलिए गेम की 165 FPS सीमा बढ़ाई जा सकती है',
      'Yüksek sabit FPS artık oyunu yavaşlatmıyor, bu yüzden oyunun 165 FPS sınırı aşılabilir',
      'Um FPS fixo alto não deixa mais o jogo lento, então o limite de 165 FPS do jogo pode subir',
      'Високий фіксований FPS більше не уповільнює гру, тож ліміт гри 165 FPS можна підняти',
      'FPS tetap yang tinggi tidak lagi memperlambat game, jadi batas 165 FPS dari game bisa dinaikkan',
      'Wysoki stały FPS nie spowalnia już gry, więc limit gry 165 FPS można podnieść',
      '高固定帧率不再让游戏变慢，因此可以突破游戏 165 FPS 的上限',
      '높은 고정 FPS가 더 이상 게임을 느리게 하지 않아 게임의 165 FPS 한도를 높일 수 있습니다',
      '高い固定FPSでもゲームが遅くならないので、ゲームの上限165 FPSを超えられます'],
    credit: ['Original mod by {n}', 'Автор оригинального мода: {n}', 'Ursprünglicher Mod von {n}', 'Mod original de {n}', 'Mod originale di {n}',
      'Mod original de {n}', 'मूल मॉड: {n}', 'Orijinal mod: {n}', 'Mod original de {n}', 'Автор оригінального мода: {n}', 'Mod asli oleh {n}',
      'Oryginalny mod: {n}', '原始模组作者：{n}', '원본 모드 제작: {n}', '元のMOD作者：{n}'],
    'autosave.days': ['Save every (game days)', 'Сохранять каждые (игровых дней)', 'Speichern alle (Spieltage)', 'Sauvegarder tous les (jours de jeu)',
      'Salva ogni (giorni di gioco)', 'Guardar cada (días de juego)', 'हर (गेम दिन) में सेव करें', 'Kaydetme aralığı (oyun günü)', 'Salvar a cada (dias de jogo)',
      'Зберігати кожні (ігрових днів)', 'Simpan setiap (hari game)', 'Zapisuj co (dni gry)', '每隔（游戏日）存档', '저장 주기 (게임 일)', 'セーブ間隔（ゲーム日）'],
    'fixed-fps.max': ['FPS when the game\'s limit is 165',
      'FPS, когда лимит игры 165',
      'FPS, wenn die Spielgrenze 165 ist',
      'FPS quand la limite du jeu est 165',
      'FPS quando il limite del gioco è 165',
      'FPS cuando el límite del juego es 165',
      'गेम की सीमा 165 होने पर FPS',
      'Oyunun sınırı 165 iken FPS',
      'FPS quando o limite do jogo é 165',
      'FPS, коли ліміт гри 165',
      'FPS saat batas game 165',
      'FPS, gdy limit gry to 165',
      '游戏上限为 165 时的帧率',
      '게임 한도가 165일 때 FPS',
      'ゲームの上限が165のときのFPS'],
  };
  const lang = () => { const n = Number(rt.globalVars.LanguageChoose); return n >= 0 && n < 15 ? n : 0; };
  const t = (k, vars) => {
    let s = (TXT[k] || [k])[lang()] || TXT[k][0];
    if (vars) for (const v in vars) s = s.replace('{' + v + '}', vars[v]);
    return s;
  };

  // per-mod options (key in betterdt.ini, type, default)
  const OPTIONS = {
    'hire-tools.js': [{ key: 'hire-tools.autoHire', type: 'bool', def: false }],
    'train-all.js': [{ key: 'train-all.mute', type: 'bool', def: true }],
    'autosave.js': [{ key: 'autosave.days', type: 'range', def: 90, min: 5, max: 360, step: 5 }],
    'fixed-fps.js': [{ key: 'fixed-fps.max', type: 'range', def: 165, min: 165, max: 360, step: 5 }],
    'low-end.js': [{ key: 'low-end.fps', type: 'bool', def: false }, { key: 'low-end.blur', type: 'bool', def: false }],
    'no-ending.js': [{ key: 'no-ending.skip', type: 'bool', def: false }],
  };
  // mods based on someone else's work: shown under the mod in the settings
  const CREDITS = { 'no-ending.js': 'M1lan.', 'unlimited-shares.js': 'M1lan.' };
  // what only takes effect after a restart: state at game start
  const boot = { gpu: S.bool('gpu', true) };
  for (const m of B.mods) boot['mod.' + m.file] = m.enabled;
  const needsRestart = () => {
    if (S.bool('gpu', true) !== boot.gpu) return true;
    for (const m of B.mods) if (S.bool('mod.' + m.file, true) !== boot['mod.' + m.file]) return true;
    return false;
  };

  const ICONS = {
    'bdt-general': 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z',
    'bdt-mods': 'M10 2a2 2 0 012 2v1h4a1 1 0 011 1v4h1a2 2 0 110 4h-1v4a1 1 0 01-1 1h-4v-1a2 2 0 10-4 0v1H4a1 1 0 01-1-1v-4h1a2 2 0 100-4H3V6a1 1 0 011-1h4V4a2 2 0 012-2z',
  };

  let root = null, nav = null, active = null, prevPage = null, navObs = null, poll = 0, savedFoot = null;

  const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
  const mask = (e, path) => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='" + path + "'/></svg>";
    const url = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
    e.style.webkitMaskImage = url; e.style.maskImage = url;
  };

  // ── navigation ────────────────────────────────────────────────────────────────────────────────
  function addNav() {
    if (!nav || nav.querySelector('.bdt-nav')) return;
    const head = el('div', 'gs-nav-group bdt-nav', nav);
    head.textContent = 'BetterDT';
    for (const p of PAGES) {
      const it = el('div', 'gs-nav-item bdt-nav' + (active === p ? ' gs-nav-on' : ''), nav);
      it.dataset.page = p;
      mask(el('div', 'gs-nav-ic', it), ICONS[p]);
      el('div', 'gs-nav-text', it).textContent = t(p === 'bdt-general' ? 'general' : 'mods');
    }
    if (active) for (const e of nav.querySelectorAll('.gs-nav-item:not(.bdt-nav)')) e.classList.remove('gs-nav-on');
  }

  function onNavClick(ev) {
    const it = ev.target.closest && ev.target.closest('.gs-nav-item');
    if (!it || !nav.contains(it)) return;
    const page = it.dataset.page;
    if (PAGES.includes(page)) {
      ev.stopPropagation();
      if (active === page) return;
      globalThis.tapMain?.();
      if (!active) {
        const on = nav.querySelector('.gs-nav-item.gs-nav-on:not(.bdt-nav)');
        prevPage = on ? on.dataset.page : prevPage;
        saveFoot();
      }
      active = page;
      for (const e of nav.querySelectorAll('.gs-nav-item')) e.classList.toggle('gs-nav-on', e === it);
      render();
      return;
    }
    if (!active) return;
    // leaving to a game page: the game itself only switches to a page other than its last one
    active = null;
    stopPoll();
    restoreFoot();
    if (page === prevPage) {
      ev.stopPropagation();
      globalThis.tapMain?.();
      try { globalThis.setGameSettingsPage?.(page) || globalThis.refreshGameSettingsPage?.(); } catch (e) { console.error(e); }
    }
  }

  // the game rebuilt the navigation (language change, Apply…) → add our group back, re-render our page
  function onNavRebuilt() {
    if (!nav.querySelector('.bdt-nav')) {
      addNav();
      if (active) render(true);
    }
  }

  // ── footer (status) ──────────────────────────────────────────────────────────────────────────
  function saveFoot() {
    const st = root.querySelector('.gs-status'), tx = root.querySelector('.gs-status-text');
    savedFoot = st && tx ? { cls: st.className, text: tx.textContent } : null;
  }
  function restoreFoot() {
    const st = root && root.querySelector('.gs-status'), tx = root && root.querySelector('.gs-status-text');
    if (st && tx && savedFoot) { st.className = savedFoot.cls; tx.textContent = savedFoot.text; }
    savedFoot = null;
  }
  let toastTimer = 0;
  function status(flash) {
    const st = root.querySelector('.gs-status'), tx = root.querySelector('.gs-status-text');
    if (!st || !tx) return;
    clearTimeout(toastTimer);
    const warn = needsRestart();
    const msg = flash && !warn ? t('saved') : warn ? t('restart') : '';
    tx.textContent = msg;
    st.classList.toggle('gs-status-ok', !!msg && !warn);
    st.classList.toggle('gs-status-warn', warn);
    st.classList.toggle('gs-status-idle', !msg);
    if (flash && !warn) toastTimer = setTimeout(() => { if (active) status(false); }, 1800);
  }

  // ── controls in the game's style ─────────────────────────────────────────────────────────────
  function row(card, name, hint) {
    const r = el('div', 'gs-row', card), l = el('div', 'gs-row-label', r);
    el('div', 'gs-row-name', l).textContent = name;
    if (hint) el('div', 'gs-row-hint', l).textContent = hint;
    return el('div', 'gs-row-ctl', r);
  }
  function sw(ctl, on, cb) {
    const s = el('div', 'gs-sw', ctl);
    const paint = () => s.classList.toggle('gs-sw-on', on);
    paint();
    s.addEventListener('click', () => { globalThis.tapTurn?.(); on = !on; paint(); cb(on); });
    return s;
  }
  function slider(ctl, min, max, step, val, cb) {
    const w = el('div', 'gs-slider', ctl), i = document.createElement('input');
    i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = val; i.className = 'gs-range';
    w.appendChild(i);
    const v = el('div', 'gs-slider-val', w);
    const paint = () => { v.textContent = i.value; i.style.setProperty('--fill', ((i.value - min) / (max - min) * 100).toFixed(2) + '%'); };
    paint();
    i.addEventListener('input', paint);
    i.addEventListener('change', () => cb(Number(i.value)));
    return i;
  }
  function btn(ctl, label, cb) {
    const b = el('div', 'gs-btn gs-btn-ghost', ctl);
    b.textContent = label;
    b.addEventListener('click', () => { if (b.classList.contains('gs-btn-off')) return; globalThis.tapMain?.(); cb(b); });
    return b;
  }
  const save = (k, v) => S.set(k, v).then(() => { if (active) status(true); }, (e) => console.error('[BetterDT] save', k, e));

  // ── pages ───────────────────────────────────────────────────────────────────────────────────
  function render(noAnim) {
    const head = root.querySelector('#gs-main-head'), body = root.querySelector('#gs-main-body');
    if (!head || !body) return;
    head.innerHTML = ''; body.innerHTML = ''; body.scrollTop = 0;
    const h = el('div', 'gs-h-row', head), ti = el('div', 'gs-h-titles', h);
    el('div', 'gs-h1', ti).textContent = active === 'bdt-general' ? 'BetterDT' : t('mods');
    el('div', 'gs-h-sub', ti).textContent = active === 'bdt-general' ? t('hint') : t('modsHint');
    if (active === 'bdt-general') renderGeneral(body); else renderMods(body);
    body.classList.remove('gs-anim');
    if (!noAnim) { void body.offsetWidth; body.classList.add('gs-anim'); }
    status(false);
  }

  let updRow = null;
  function renderGeneral(body) {
    const c1 = el('div', 'gs-card', body);
    const vctl = row(c1, t('version'));
    el('div', 'gs-row-hint bdt-val', vctl).textContent = 'v' + B.version;
    btn(vctl, t('releases'), () => B.api('open', { what: 'github' }));
    el('div', 'gs-row-hint bdt-val', row(c1, t('gameVer'))).textContent = KIT ? KIT.gameVersion || '?' : '?';
    btn(row(c1, t('community'), t('communityHint')), 'Discord', () => B.api('open', { what: 'discord' }));

    sw(row(c1, t('autoUpdate'), t('autoUpdateHint')), S.bool('autoupdate', true), (on) => save('autoupdate', on));
    updRow = row(c1, t('updates')).parentNode;
    paintUpdate();

    const c2 = el('div', 'gs-card', body);
    sw(row(c2, t('gpu'), t('gpuHint')), S.bool('gpu', true), (on) => save('gpu', on));
    const fctl = row(c2, t('folder'));
    btn(fctl, t('log'), () => B.api('open', { what: 'log' }));
    btn(fctl, t('open'), () => B.api('open', { what: 'folder' }));
  }

  function updText(u) {
    const v = u.latest || '';
    switch (u.state) {
      case 'checking': return t('checking');
      case 'uptodate': return t('uptodate');
      case 'available': return t('available', { v });
      case 'downloading': return t('downloading', { v });
      case 'installed': return t('installed', { v });
      case 'error': return u.error === 'no public release' ? t('noRelease') : t('failed', { e: u.error });
      default: return '';
    }
  }
  function paintUpdate() {
    if (!updRow || !updRow.isConnected) return;
    const u = B.state.update || {};
    const name = updRow.querySelector('.gs-row-name');
    const label = updRow.querySelector('.gs-row-label');
    let hint = label.querySelector('.gs-row-hint');
    const txt = updText(u);
    if (txt && !hint) hint = el('div', 'gs-row-hint', label);
    if (hint) { hint.textContent = txt; hint.classList.toggle('bdt-warn', u.state === 'error'); hint.classList.toggle('bdt-good', u.state === 'installed' || u.state === 'uptodate'); }
    name.textContent = t('updates');
    const ctl = updRow.querySelector('.gs-row-ctl');
    ctl.innerHTML = '';
    // "Check now" downloads and installs a newer version right away (then the restart dialog shows)
    const b = btn(ctl, t('check'), () => { B.api('check').then(startPoll); });
    b.classList.toggle('gs-btn-off', !!u.busy || u.state === 'installed');
  }
  function startPoll() {
    paintUpdate();
    if (poll) return;
    poll = setInterval(() => {
      B.api('state').then((s) => {
        paintUpdate();
        checkDialogs(s);
        if (!s.update || !s.update.busy || !active) stopPoll();
      }, stopPoll);
    }, 600);
  }
  function stopPoll() { clearInterval(poll); poll = 0; }

  function modTitle(file) { const id = file.replace(/\.js$/, ''); return TXT[id] ? t(id) : file; }
  function modDesc(file) { const id = file.replace(/\.js$/, ''); return TXT[id + '.d'] ? t(id + '.d') : t('custom') + ' · ' + file; }

  function renderMods(body) {
    for (const m of B.mods) {
      if (m.file === 'betterdt-settings.js') continue;
      const card = el('div', 'gs-card', body);
      const on = S.bool('mod.' + m.file, true);
      const mctl = row(card, modTitle(m.file), modDesc(m.file));
      sw(mctl, on, (v) => { save('mod.' + m.file, v); paintOpts(); });
      if (CREDITS[m.file]) {
        el('div', 'gs-row-hint bdt-credit', mctl.parentNode.querySelector('.gs-row-label')).textContent = t('credit', { n: CREDITS[m.file] });
      }
      // what the compatibility check found (BetterDTKit)
      const st = m.enabled && kitStatus(m.file);
      if (st && (st.state !== 'running' || st.problems.length)) {
        const key = st.state === 'incompatible' ? 'stIncompat' : st.state === 'failed' ? 'stFailed' : st.state === 'running' ? 'stWarn' : '';
        if (key) {
          const h = el('div', 'gs-row-hint bdt-warn', mctl.parentNode.querySelector('.gs-row-label'));
          h.textContent = t(key) + (st.problems.length ? ': ' + st.problems.join('; ') : '');
        }
      }
      const opts = [];
      for (const o of OPTIONS[m.file] || []) {
        const ctl = row(card, t(o.key));
        const r = ctl.parentNode;
        r.classList.add('bdt-opt');
        opts.push(r);
        if (o.type === 'bool') sw(ctl, S.bool(o.key, o.def), (v) => save(o.key, v));
        else slider(ctl, o.min, o.max, o.step, S.num(o.key, o.def), (v) => save(o.key, v));
      }
      const paintOpts = () => { const off = !S.bool('mod.' + m.file, true); for (const r of opts) r.classList.toggle('gs-row-off', off); };
      paintOpts();
    }
  }

  // ── dialogs: new version ready, game page crashed ──────────────────────────────────────────────
  // Look of the game's own news window (#office-news-*): dark blurred panel, centered text, coloured buttons.
  // Built in 1920×1080 units and scaled with the window like the game's HTML overlays.
  function dialogCss() {
    if (document.getElementById('betterdt-dialog-css')) return;
    const s = el('style', '', document.head);
    s.id = 'betterdt-dialog-css';
    s.textContent = `
#bdt-dlg { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center;
  font-family: "SofiaSansExtraCondensed-Medium", "Oswald", "Segoe UI", sans-serif; }
#bdt-dlg .bdt-dim { position: absolute; inset: 0; background: rgba(4, 10, 20, .46); animation: bdt-fade .24s ease both; }
#bdt-dlg .bdt-panel { position: relative; width: 820px; transform: scale(var(--bdt-scale, 1)); }
#bdt-dlg .bdt-blur { position: absolute; inset: 0; border-radius: 16px; background: rgba(12, 15, 22, .72);
  backdrop-filter: blur(16px) saturate(1.25); border: 1px solid rgba(255, 255, 255, .10);
  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, .65), inset 0 0 24px -8px rgba(255, 255, 255, .18); animation: bdt-fade .22s ease both; }
#bdt-dlg .bdt-content { position: relative; box-sizing: border-box; padding: 28px 52px 32px; text-align: center; color: #fff;
  animation: bdt-open .34s cubic-bezier(.30, 1.35, .45, 1) both; }
#bdt-dlg .bdt-title { font-size: 36px; text-shadow: 0 2px 8px rgba(0, 0, 0, .5); }
#bdt-dlg .bdt-divider { height: 1px; margin: 16px 0 14px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, .28) 18%, rgba(255, 255, 255, .28) 82%, transparent 100%); }
#bdt-dlg .bdt-text { font-size: 26px; line-height: 1.45; text-shadow: 0 2px 6px rgba(0, 0, 0, .45); }
#bdt-dlg .bdt-notes { margin: 14px auto 0; display: inline-block; text-align: left; font-size: 22px; line-height: 1.4; opacity: .8; }
#bdt-dlg .bdt-hint { margin-top: 14px; font-size: 20px; line-height: 1.35; opacity: .65; }
#bdt-dlg .bdt-community { margin-top: 18px; font-size: 20px; line-height: 1.35; opacity: .75; }
#bdt-dlg .bdt-link { color: #8ea1ff; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
#bdt-dlg .bdt-link:hover { color: #b3c0ff; }
#bdt-dlg .bdt-buttons { display: flex; justify-content: center; gap: 40px; margin-top: 24px; }
#bdt-dlg .bdt-btn { box-sizing: border-box; min-width: 240px; padding: 0 28px; height: 50px; line-height: 50px; border-radius: 8px;
  font-size: 25px; color: #fff; text-shadow: 0 1px 3px rgba(0, 0, 0, .35); cursor: pointer; user-select: none;
  background: linear-gradient(180deg, #5d6878 0%, #434c5a 100%); box-shadow: 0 6px 18px -6px rgba(0, 0, 0, .55);
  transition: transform .16s ease, filter .16s ease, box-shadow .16s ease; }
#bdt-dlg .bdt-btn.bdt-go { background: linear-gradient(180deg, #a8d418 0%, #63b303 100%); box-shadow: 0 6px 18px -6px rgba(120, 190, 20, .55); }
#bdt-dlg .bdt-btn:hover { transform: translateY(-2px); filter: brightness(1.12); }
#bdt-dlg .bdt-btn:active { transform: translateY(0) scale(.96); filter: brightness(.95); }
#bdt-dlg .bdt-btn.bdt-off { pointer-events: none; opacity: .55; }
@keyframes bdt-fade { from { opacity: 0; } }
@keyframes bdt-open { from { opacity: 0; transform: translateY(26px) scale(.94); } }
`;
  }
  let dlg = null;
  function dialog(title, text, extra, buttons) {
    if (dlg) return null;
    dialogCss();
    dlg = el('div', '', document.body);
    dlg.id = 'bdt-dlg';
    el('div', 'bdt-dim', dlg);
    const panel = el('div', 'bdt-panel', dlg);
    el('div', 'bdt-blur', panel);
    const c = el('div', 'bdt-content', panel);
    el('div', 'bdt-title', c).textContent = title;
    el('div', 'bdt-divider', c);
    el('div', 'bdt-text', c).textContent = text;
    if (extra) extra(c);
    const row = el('div', 'bdt-buttons', c);
    const scale = () => { if (dlg) dlg.style.setProperty('--bdt-scale', Math.min(innerWidth / 1920, innerHeight / 1080).toFixed(4)); };
    scale();
    addEventListener('resize', scale);
    const close = () => { removeEventListener('resize', scale); dlg?.remove(); dlg = null; nextDialog(); };
    for (const b of buttons) {
      const e = el('div', 'bdt-btn' + (b.go ? ' bdt-go' : ''), row);
      e.textContent = b.label;
      e.addEventListener('click', () => {
        globalThis.tapMain?.();
        for (const x of row.children) x.classList.add('bdt-off');
        Promise.resolve(b.cb()).catch(() => {}).then(() => { if (!b.keep) close(); });
      });
    }
    return dlg;
  }
  // for other mods (BetterDT itself is frozen by the loader):
  // BetterDTUI.dialog(title, text, [{ label, go, cb }], extra(contentElement)); null while another one is open
  globalThis.BetterDTUI = Object.freeze({ dialog: (title, text, buttons, extra) => dialog(title, text, extra, buttons) });

  function showUpdate(u) {
    dialog(t('updTitle', { v: u.latest }), t('updText'), (c) => {
      const notes = String(u.notes || '').split('\n').filter(Boolean);
      if (notes.length) { const n = el('div', 'bdt-notes', c); for (const line of notes) el('div', '', n).textContent = '• ' + line; }
      // a quiet pointer to the Discord, only here (an update is read by everybody, once)
      const d = el('div', 'bdt-community', c);
      d.append(t('updDiscord') + ' ');
      const a = el('span', 'bdt-link', d);
      a.textContent = 'Discord';
      a.addEventListener('click', () => { globalThis.tapMain?.(); B.api('open', { what: 'discord' }); });
    }, [
      { label: t('later'), cb: () => B.api('update-ack') },
      { label: t('restart'), go: true, keep: true, cb: () => B.api('update-ack').then(() => B.api('restart')) },
    ]);
  }
  function showCrash() {
    dialog(t('crashTitle'), t('crashText'), (c) => { el('div', 'bdt-hint', c).textContent = t('crashHint'); }, [
      { label: t('report'), cb: () => B.api('report').then(() => B.api('crash-ack')) },
      { label: t('ok'), go: true, cb: () => B.api('crash-ack') },
    ]);
  }
  // Shown only in the main menu (never in the middle of a game, and only after the game's settings with the
  // language are loaded). A crash comes first; a ready update right after that dialog is closed.
  const inMenu = () => { try { return rt.layout.name === 'MENU'; } catch { return false; } };
  function checkDialogs(s) {
    if (!s || dlg || !inMenu()) return;
    if (s.crash) showCrash();
    else if (s.update && s.update.state === 'installed' && !s.update.acked) showUpdate(s.update);
    else if (gameUpdated) showGameUpdated();
  }

  // the game itself was updated since the last start: say which mods still run (once, after the checks)
  let gameUpdated = null;
  if (KIT) KIT.whenReady(rt, () => {
    const v = KIT.gameVersion, prev = String(S.get('game.version', ''));
    if (!v || v === prev) return;
    if (prev) gameUpdated = { a: prev, b: v };
    S.set('game.version', v);
    BetterDT.log('game version', prev || '(first start)', '->', v);
  });
  function showGameUpdated() {
    const { a, b } = gameUpdated;
    gameUpdated = null;
    const off = B.mods.filter(m => m.enabled).map(m => kitStatus(m.file))
      .filter(st => st && (st.state === 'incompatible' || st.state === 'failed')).map(st => modTitle(st.name + '.js'));
    dialog(t('verTitle'), t('verText', { a, b }), (c) => {
      el('div', 'bdt-hint', c).textContent = off.length ? t('verOff', { list: off.join(', ') }) : t('verAllOk');
    }, [{ label: t('ok'), go: true, cb: () => { } }]);
  }
  const nextDialog = () => B.api('state').then(checkDialogs, () => {});
  setInterval(() => { if (!dlg && inMenu()) nextDialog(); }, 2000);

  // what the game is doing, so that a crash report can say it (sent every 15 s, kept in memory by the loader)
  setInterval(() => {
    const gv = rt.globalVars;
    let layout = '';
    try { layout = rt.layout.name; } catch { }
    const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : '';
    const mods = KIT ? KIT.status().filter(m => m.state !== 'running' && m.state !== 'waiting').map(m => m.name + ' (' + m.state + ')').join(', ') : '';
    B.api('beat', { layout, day: gv.DayTotal ?? '', year: gv.Year ?? '', heap, dom: document.getElementsByTagName('*').length,
      game: KIT ? KIT.gameVersion : '', mods: mods.slice(0, 200) }).catch(() => {});
  }, 15000);

  // ── hooking into the settings page ───────────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('betterdt-settings-css')) return;
    const s = el('style', '', document.head);
    s.id = 'betterdt-settings-css';
    s.textContent = `
#gs-root .gs-nav-group.bdt-nav { color: rgb(var(--acc)); }
#gs-root .gs-row-ctl .gs-btn + .gs-btn { margin-left: calc(var(--gs, 1) * 10px); }
#gs-root .bdt-val { margin-right: calc(var(--gs, 1) * 14px); font-size: calc(var(--gs, 1) * 22px); opacity: .85; }
#gs-root .gs-row-hint.bdt-warn { color: rgb(var(--warn)); opacity: 1; }
#gs-root .gs-row-hint.bdt-good { color: rgb(var(--good)); opacity: 1; }
#gs-root .gs-row.bdt-opt .gs-row-name { padding-left: calc(var(--gs, 1) * 18px); opacity: .9; }
`;
  }

  function attach() {
    const r = document.getElementById('gs-root');
    const n = r && r.querySelector('#gs-nav');
    if (!n || n === nav) return;
    if (navObs) navObs.disconnect();
    root = r; nav = n; active = null; prevPage = null; savedFoot = null;
    css();
    nav.addEventListener('click', onNavClick, true);
    navObs = new MutationObserver(onNavRebuilt);
    navObs.observe(nav, { childList: true });
    addNav();
  }
  // the settings page: the SETTINGS layout (main menu) or, since game 1.6, a window over the game (pause menu)
  let settingsSince = 0;
  setInterval(() => {
    let name = '';
    try { name = rt.layout.name; } catch { return; }
    const page = document.getElementById('gs-root');
    if (name === 'SETTINGS' || (page && page.getClientRects().length)) {
      attach();
      // a game update changed the settings page so that the BetterDT section cannot be added: offer a plain list
      if (!settingsSince) settingsSince = Date.now();
      fallbackButton(name === 'SETTINGS' && !nav && Date.now() - settingsSince > 3000);
    } else {
      settingsSince = 0;
      fallbackButton(false);
      if (nav) { if (navObs) navObs.disconnect(); navObs = null; nav = root = null; active = null; stopPoll(); }
    }
  }, 200);

  // ── fallback: the mods as a simple list in a dialog ─────────────────────────────────────────────
  let fbBtn = null;
  function fallbackButton(show) {
    if (!show) { if (fbBtn) { fbBtn.remove(); fbBtn = null; } return; }
    if (fbBtn) return;
    fbBtn = el('div', '', document.body);
    fbBtn.id = 'bdt-fallback';
    fbBtn.textContent = 'BetterDT';
    fbBtn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147482000;padding:10px 20px;border-radius:8px;cursor:pointer;' +
      'font:20px "SofiaSansExtraCondensed-Bold","Segoe UI",sans-serif;color:#fff;background:linear-gradient(180deg,#a8d418 0%,#63b303 100%);' +
      'box-shadow:0 6px 18px -6px rgba(0,0,0,.55)';
    fbBtn.addEventListener('click', () => { globalThis.tapMain?.(); fallbackDialog(); });
  }
  function fallbackDialog() {
    dialog(t('fbTitle'), t('fbText'), (c) => {
      const list = el('div', 'bdt-notes', c);
      for (const m of B.mods) {
        if (m.file === 'betterdt-settings.js') continue;
        const line = el('label', '', list);
        line.style.cssText = 'display:block;cursor:pointer;margin:4px 0';
        const box = el('input', '', line);
        box.type = 'checkbox';
        box.checked = S.bool('mod.' + m.file, true);
        box.style.cssText = 'width:20px;height:20px;margin-right:10px;vertical-align:middle';
        box.addEventListener('change', () => S.set('mod.' + m.file, box.checked));
        const st = m.enabled && kitStatus(m.file);
        const bad = st && (st.state === 'incompatible' || st.state === 'failed');
        el('span', '', line).textContent = modTitle(m.file) + (bad ? ' – ' + t(st.state === 'failed' ? 'stFailed' : 'stIncompat') : '');
      }
    }, [{ label: t('ok'), go: true, cb: () => { } }]);
  }

  globalThis.__betterdtSettings = { get active() { return active; }, open(p) { attach(); nav?.querySelector(`[data-page="${p}"]`)?.click(); } };
});
