// BetterDT – the "BetterDT" section in the game settings (Settings).
//
// The game's settings page is HTML built by the game (#gs-root: #gs-nav on the left, #gs-main-head and
// #gs-main-body on the right, #gs-foot at the bottom). We add a "BetterDT" group with two items to the
// navigation and render their pages with the same classes (gs-card, gs-row, gs-sw, gs-slider…), so they look
// like the game's. The game rebuilds the navigation on every change (innerHTML = ''), so a MutationObserver
// watches it. Settings are saved immediately (through the loader into mods\betterdt.ini); the Apply button
// belongs to the game pages only.
BetterDT.register('betterdt-settings', (rt) => {
  const B = globalThis.BetterDT, S = B.settings;
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
    install: ['Install', 'Установить', 'Installieren', 'Installer', 'Installa', 'Instalar', 'इंस्टॉल', 'Kur', 'Instalar', 'Встановити', 'Pasang', 'Zainstaluj', '安装', '설치', 'インストール'],
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
    'train-all.d': ['UPGRADE EMPLOYEES: one button trains the whole profession to the max', 'УЛУЧШЕНИЕ: одна кнопка обучает всю профессию до максимума',
      'MITARBEITER VERBESSERN: ein Knopf schult den ganzen Beruf aufs Maximum', 'AMÉLIORER : un bouton forme tout le métier au maximum',
      'MIGLIORA: un pulsante forma tutta la professione al massimo', 'MEJORAR: un botón entrena toda la profesión al máximo',
      'अपग्रेड: एक बटन पूरे पेशे को अधिकतम तक प्रशिक्षित करता है', 'GELİŞTİR: tek tuşla tüm meslek maksimuma', 'MELHORAR: um botão treina a profissão toda ao máximo',
      'ПОКРАЩЕННЯ: одна кнопка навчає всю професію до максимуму', 'TINGKATKAN: satu tombol melatih seluruh profesi ke maksimum',
      'ULEPSZ: jeden przycisk szkoli cały zawód do maksimum', '升级员工：一键把整个职业培训到满级', '직원 강화: 버튼 하나로 직종 전체를 최대까지', '社員強化：ボタン1つで職種全体を最大まで'],
    'train-all.mute': ['Mute the click sounds while training', 'Без звуков кликов во время обучения', 'Klickgeräusche beim Schulen stummschalten',
      'Couper les sons de clic pendant la formation', 'Silenzia i clic durante la formazione', 'Silenciar los clics durante el entrenamiento',
      'प्रशिक्षण के दौरान क्लिक ध्वनियाँ बंद', 'Eğitim sırasında tık seslerini kapat', 'Silenciar os cliques durante o treino', 'Без звуків кліків під час навчання',
      'Matikan suara klik saat pelatihan', 'Wycisz kliknięcia podczas szkolenia', '培训时静音点击声', '교육 중 클릭 소리 끄기', '研修中のクリック音を消す'],
    'vacation-tools': ['Vacation for the tired', 'Отпуск уставшим', 'Urlaub für Müde', 'Vacances pour les fatigués', 'Ferie per gli stanchi', 'Vacaciones para los cansados',
      'थके हुए लोगों को छुट्टी', 'Yorgunlara tatil', 'Férias para os cansados', 'Відпустка втомленим', 'Cuti untuk yang lelah', 'Urlop dla zmęczonych', '让疲惫的人休假', '지친 직원 휴가', '疲れた人に休暇'],
    'vacation-tools.d': ['MY EMPLOYEES: sends everyone who needs a rest on vacation in one click', 'МОИ СОТРУДНИКИ: отправляет в отпуск всех уставших одним кликом',
      'MEINE MITARBEITER: schickt alle Erschöpften mit einem Klick in Urlaub', 'MES EMPLOYÉS : envoie en vacances tous ceux qui en ont besoin en un clic',
      'I MIEI DIPENDENTI: manda in ferie chi ne ha bisogno con un clic', 'MIS EMPLEADOS: envía de vacaciones a quien lo necesita con un clic',
      'मेरे कर्मचारी: एक क्लिक में थके लोगों को छुट्टी पर भेजें', 'ÇALIŞANLARIM: dinlenmesi gerekenleri tek tıkla tatile gönderir',
      'MEUS FUNCIONÁRIOS: manda de férias quem precisa com um clique', 'МОЇ ПРАЦІВНИКИ: відправляє у відпустку всіх втомлених одним кліком',
      'KARYAWANKU: kirim yang butuh istirahat cuti dalam satu klik', 'MOI PRACOWNICY: wysyła na urlop zmęczonych jednym kliknięciem',
      '我的员工：一键让需要休息的人去休假', '내 직원: 클릭 한 번으로 지친 직원 휴가 보내기', 'マイ社員：休みが必要な人をワンクリックで休暇へ'],
    'vacation-tools.threshold': ['Send on vacation below mood', 'Отправлять в отпуск при настроении ниже', 'In Urlaub schicken unter Stimmung',
      'Envoyer en vacances sous l’humeur', 'Manda in ferie sotto l’umore', 'Enviar de vacaciones con ánimo menor que', 'इस मूड से नीचे छुट्टी पर भेजें',
      'Bu ruh halinin altında tatile gönder', 'Mandar de férias com humor abaixo de', 'Відправляти у відпустку при настрої нижче', 'Kirim cuti jika mood di bawah',
      'Wysyłaj na urlop poniżej nastroju', '心情低于此值时休假', '이 기분 미만이면 휴가', 'この気分未満で休暇へ'],
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
    'vacation-tools.js': [{ key: 'vacation-tools.threshold', type: 'range', def: 30, min: 10, max: 90, step: 5 }],
  };
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
    if (u.state === 'available' && !u.busy) btn(ctl, t('install'), () => { B.api('install').then(startPoll); });
    const b = btn(ctl, t('check'), () => { B.api('check').then(startPoll); });
    b.classList.toggle('gs-btn-off', !!u.busy || u.state === 'installed');
  }
  function startPoll() {
    paintUpdate();
    if (poll) return;
    poll = setInterval(() => {
      B.api('state').then((s) => {
        paintUpdate();
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
      sw(row(card, modTitle(m.file), modDesc(m.file)), on, (v) => { save('mod.' + m.file, v); paintOpts(); });
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
  // the settings page is created when the SETTINGS layout starts; watching there is enough
  setInterval(() => {
    let name = '';
    try { name = rt.layout.name; } catch { return; }
    if (name === 'SETTINGS') attach();
    else if (nav) { if (navObs) navObs.disconnect(); navObs = null; nav = root = null; active = null; stopPoll(); }
  }, 200);

  globalThis.__betterdtSettings = { get active() { return active; }, open(p) { attach(); nav?.querySelector(`[data-page="${p}"]`)?.click(); } };
});
