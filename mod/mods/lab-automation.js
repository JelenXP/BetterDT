// Lab automation – RESEARCH LAB, "Investing in research" (class RESEARCH INVEST), and every game day.
//
// An AUTOMATION button in the top left corner of the investing window opens a panel in the look of the game's own
// "Automatic marketing" window (its CSS is copied, the classes renamed). Three lab functions are bought there once,
// for research points and money, and then have an on/off box:
// - Automatic collecting (300 RP + $2M): after every day of a project the points of the lab go to the research points,
//   so they never stop at the lab's capacity. A breakthrough still counts all of them (research-breakthroughs.js
//   sums what the lab made, collected or not).
// - Automatic renewal (600 RP + $10M): when a project ends, a new one starts with the amount of the last one, for an
//   automation fee of 10 % on top, like the game's automatic marketing. When the money (and the money reserve of
//   Auto research) is not enough, it is tried again every day, with one message.
// - Breakthrough focus (1 000 RP + $25M): a device and, if wanted, one of its review areas picked in the panel; parts
//   of the device are drawn 3× as often for a breakthrough, parts of its area 2× more on top. How many breakthroughs a
//   project gives does not change.
// A project starts the way the game's Invest button starts it (event sheet RESEARCH MENU): the money taken, 30 days
// and the amount in the lab's table (over $25M in the form lab-invest.js keeps it), and the game's social post.
// The functions, the focus and the totals are kept in rows 3–7 of the lab's table (ArrayMyResearch_Invest; the game
// reads rows 0–2), which the game saves and loads with the rest of the save; a new game starts without them.
// The messages go to the game's message stack in the bottom right corner.
const LAB_L = (s) => s.split(' | ');
const LAB_TXT = {
  button: LAB_L('Automation | Автоматизация | Automatisierung | Automatisation | Automazione | Automatización | ऑटोमेशन | Otomasyon | Automação | Автоматизація | Otomatisasi | Automatyzacja | 自动化 | 자동화 | 自動化'),
  title: LAB_L('Lab automation | Автоматизация лаборатории | Laborautomatisierung | Automatisation du labo | Automazione del laboratorio | Automatización del laboratorio | लैब ऑटोमेशन | Laboratuvar otomasyonu | Automação do laboratório | Автоматизація лабораторії | Otomatisasi lab | Automatyzacja laboratorium | 实验室自动化 | 연구소 자동화 | ラボの自動化'),
  running: LAB_L('Project: {d} days left · {usd} | Проект: осталось дней {d} · {usd} | Projekt: noch {d} Tage · {usd} | Projet : {d} jours restants · {usd} | Progetto: {d} giorni rimasti · {usd} | Proyecto: quedan {d} días · {usd} | प्रोजेक्ट: {d} दिन बाकी · {usd} | Proje: {d} gün kaldı · {usd} | Projeto: faltam {d} dias · {usd} | Проєкт: лишилося днів {d} · {usd} | Proyek: sisa {d} hari · {usd} | Projekt: zostało dni {d} · {usd} | 项目：剩余 {d} 天 · {usd} | 프로젝트: {d}일 남음 · {usd} | プロジェクト：残り {d} 日 · {usd}'),
  idle: LAB_L('No project running | Проект не запущен | Kein Projekt läuft | Aucun projet en cours | Nessun progetto in corso | Ningún proyecto en curso | कोई प्रोजेक्ट नहीं चल रहा | Çalışan proje yok | Nenhum projeto em andamento | Проєкт не запущено | Tidak ada proyek berjalan | Brak trwającego projektu | 没有进行中的项目 | 진행 중인 프로젝트 없음 | 進行中のプロジェクトなし'),
  functions: LAB_L('FUNCTIONS | ФУНКЦИИ | FUNKTIONEN | FONCTIONS | FUNZIONI | FUNCIONES | फ़ंक्शन | İŞLEVLER | FUNÇÕES | ФУНКЦІЇ | FUNGSI | FUNKCJE | 功能 | 기능 | 機能'),
  collect: LAB_L('Automatic collecting | Автоматический сбор очков | Automatisches Einsammeln | Collecte automatique | Raccolta automatica | Recogida automática | अपने-आप पॉइंट्स लेना | Otomatik toplama | Coleta automática | Автоматичний збір очок | Pengambilan otomatis | Automatyczne zbieranie | 自动收取 | 자동 수거 | 自動回収'),
  collectHint: LAB_L("The lab's points go to your research points every day, so none are lost at the capacity | Очки лаборатории каждый день переходят в очки исследований, ничего не теряется на пределе | Die Laborpunkte gehen täglich in deine Forschungspunkte, an der Kapazität geht nichts verloren | Les points du labo passent chaque jour dans vos points de recherche, rien n’est perdu à la capacité | I punti del laboratorio passano ogni giorno ai punti ricerca, nulla si perde al limite | Los puntos del laboratorio pasan cada día a tus puntos de investigación, nada se pierde en el límite | लैब के पॉइंट्स रोज़ आपके रिसर्च पॉइंट्स में जाते हैं, क्षमता पर कुछ नहीं खोता | Laboratuvar puanları her gün araştırma puanlarına geçer, kapasitede hiçbiri kaybolmaz | Os pontos do laboratório vão todo dia para seus pontos de pesquisa, nada se perde no limite | Очки лабораторії щодня переходять в очки досліджень, нічого не губиться на межі | Poin lab masuk ke poin riset setiap hari, tidak ada yang hilang di batas kapasitas | Punkty laboratorium codziennie trafiają do punktów badań, nic nie ginie na limicie | 实验室点数每天转入研究点数，不会因容量上限而损失 | 연구소 포인트가 매일 연구 포인트로 들어가 한도에서 사라지지 않습니다 | ラボのポイントが毎日研究ポイントに入り、上限で失われません"),
  renew: LAB_L('Automatic renewal | Автоматическое продление | Automatische Verlängerung | Renouvellement automatique | Rinnovo automatico | Renovación automática | अपने-आप नवीनीकरण | Otomatik yenileme | Renovação automática | Автоматичне продовження | Perpanjangan otomatis | Automatyczne odnawianie | 自动续期 | 자동 갱신 | 自動更新'),
  renewHint: LAB_L('A new project with the amount of the last one when a project ends · fee +10 % | Новый проект на ту же сумму, когда проект закончится · комиссия +10 % | Ein neues Projekt mit dem letzten Betrag, wenn ein Projekt endet · Gebühr +10 % | Un nouveau projet du même montant à la fin d’un projet · frais +10 % | Un nuovo progetto con l’importo dell’ultimo quando un progetto finisce · commissione +10 % | Un proyecto nuevo con el importe del anterior cuando termina uno · comisión +10 % | प्रोजेक्ट खत्म होने पर पिछली राशि से नया प्रोजेक्ट · शुल्क +10 % | Bir proje bitince son tutarla yeni proje · ücret +%10 | Um novo projeto com o valor do anterior quando um projeto termina · taxa +10 % | Новий проєкт на ту саму суму, коли проєкт закінчиться · комісія +10 % | Proyek baru dengan jumlah terakhir saat proyek selesai · biaya +10 % | Nowy projekt za tę samą kwotę po zakończeniu projektu · opłata +10 % | 项目结束时按上次金额开始新项目 · 手续费 +10 % | 프로젝트가 끝나면 지난 금액으로 새 프로젝트 · 수수료 +10 % | プロジェクト終了時に前回と同額で新しいプロジェクト · 手数料 +10 %'),
  focus: LAB_L('Breakthrough focus | Фокус прорывов | Durchbruch-Fokus | Focus des percées | Focus delle svolte | Enfoque de avances | ब्रेकथ्रू फ़ोकस | Atılım odağı | Foco de avanços | Фокус проривів | Fokus terobosan | Skupienie przełomów | 突破重点 | 돌파 집중 | ブレイクスルーの重点'),
  focusHint: LAB_L('Breakthroughs for the chosen device 3× as often, for its area 2× more | Прорывы для выбранного устройства в 3 раза чаще, для его области ещё в 2 раза | Durchbrüche für das gewählte Gerät 3× so oft, für seinen Bereich 2× mehr | Percées pour l’appareil choisi 3× plus souvent, pour son domaine 2× de plus | Svolte per il dispositivo scelto 3× più spesso, per la sua area 2× in più | Avances para el dispositivo elegido 3× más a menudo, para su área 2× más | चुने गए डिवाइस के लिए ब्रेकथ्रू 3× अधिक, उसके क्षेत्र के लिए 2× और | Seçilen cihaz için atılımlar 3 kat sık, alanı için 2 kat daha | Avanços para o dispositivo escolhido 3× mais vezes, para sua área 2× mais | Прориви для вибраного пристрою втричі частіше, для його області ще вдвічі | Terobosan untuk perangkat terpilih 3× lebih sering, untuk areanya 2× lagi | Przełomy dla wybranego urządzenia 3× częściej, dla jego obszaru 2× więcej | 所选设备的突破概率 3 倍，其领域再 2 倍 | 선택한 기기의 돌파 3배, 그 영역은 2배 더 | 選んだデバイスのブレイクスルーが3倍、その分野はさらに2倍'),
  buy: LAB_L('Buy | Купить | Kaufen | Acheter | Acquista | Comprar | खरीदें | Satın al | Comprar | Купити | Beli | Kup | 购买 | 구매 | 購入'),
  noFunds: LAB_L("You don't have enough research points or money | Не хватает очков исследований или денег | Zu wenig Forschungspunkte oder Geld | Pas assez de points de recherche ou d’argent | Punti ricerca o denaro insufficienti | No tienes suficientes puntos de investigación o dinero | रिसर्च पॉइंट्स या पैसे कम हैं | Yeterli araştırma puanı veya para yok | Pontos de pesquisa ou dinheiro insuficientes | Не вистачає очок досліджень або грошей | Poin riset atau uang tidak cukup | Za mało punktów badań lub pieniędzy | 研究点数或资金不足 | 연구 포인트나 돈이 부족합니다 | 研究ポイントかお金が足りません"),
  focusSec: LAB_L('FOCUS | ФОКУС | FOKUS | FOCUS | FOCUS | ENFOQUE | फ़ोकस | ODAK | FOCO | ФОКУС | FOKUS | SKUPIENIE | 重点 | 집중 | 重点'),
  device: LAB_L('DEVICE | УСТРОЙСТВО | GERÄT | APPAREIL | DISPOSITIVO | DISPOSITIVO | डिवाइस | CİHAZ | DISPOSITIVO | ПРИСТРІЙ | PERANGKAT | URZĄDZENIE | 设备 | 기기 | デバイス'),
  area: LAB_L('AREA | ОБЛАСТЬ | BEREICH | DOMAINE | AREA | ÁREA | क्षेत्र | ALAN | ÁREA | ОБЛАСТЬ | AREA | OBSZAR | 领域 | 영역 | 分野'),
  any: LAB_L('Any | Любая | Beliebig | Tous | Qualsiasi | Cualquiera | कोई भी | Hepsi | Qualquer | Будь-яка | Semua | Dowolny | 任意 | 전체 | すべて'),
  none: LAB_L('None | Нет | Keins | Aucun | Nessuno | Ninguno | कोई नहीं | Yok | Nenhum | Немає | Tidak ada | Brak | 无 | 없음 | なし'),
  focusLocked: LAB_L('Buy Breakthrough focus to choose a device | Купите «Фокус прорывов», чтобы выбрать устройство | Kaufe den Durchbruch-Fokus, um ein Gerät zu wählen | Achetez le Focus des percées pour choisir un appareil | Acquista il Focus delle svolte per scegliere un dispositivo | Compra el Enfoque de avances para elegir un dispositivo | डिवाइस चुनने के लिए ब्रेकथ्रू फ़ोकस खरीदें | Cihaz seçmek için Atılım odağını satın alın | Compre o Foco de avanços para escolher um dispositivo | Купіть «Фокус проривів», щоб вибрати пристрій | Beli Fokus terobosan untuk memilih perangkat | Kup Skupienie przełomów, aby wybrać urządzenie | 购买“突破重点”以选择设备 | 기기를 고르려면 돌파 집중을 구매하세요 | デバイスを選ぶにはブレイクスルーの重点を購入してください'),
  summary: LAB_L('SUMMARY | СВОДКА | ÜBERSICHT | RÉSUMÉ | RIEPILOGO | RESUMEN | सारांश | ÖZET | RESUMO | ЗВЕДЕННЯ | RINGKASAN | PODSUMOWANIE | 汇总 | 요약 | まとめ'),
  collected: LAB_L('Points collected | Собрано очков | Eingesammelte Punkte | Points collectés | Punti raccolti | Puntos recogidos | लिए गए पॉइंट्स | Toplanan puan | Pontos coletados | Зібрано очок | Poin diambil | Zebrane punkty | 已收取点数 | 수거한 포인트 | 回収したポイント'),
  renewed: LAB_L('Projects renewed | Продлено проектов | Verlängerte Projekte | Projets renouvelés | Progetti rinnovati | Proyectos renovados | नवीनीकृत प्रोजेक्ट | Yenilenen proje | Projetos renovados | Продовжено проєктів | Proyek diperpanjang | Odnowione projekty | 已续期项目 | 갱신한 프로젝트 | 更新したプロジェクト'),
  fees: LAB_L('Automation fees | Комиссии автоматизации | Automatisierungsgebühren | Frais d’automatisation | Commissioni di automazione | Comisiones de automatización | ऑटोमेशन शुल्क | Otomasyon ücretleri | Taxas de automação | Комісії автоматизації | Biaya otomatisasi | Opłaty za automatyzację | 自动化手续费 | 자동화 수수료 | 自動化手数料'),
  feeNote: LAB_L('Automation fee: +10 % to every automatically renewed project | Комиссия автоматизации: +10 % к каждому автоматически продлённому проекту | Automatisierungsgebühr: +10 % auf jedes automatisch verlängerte Projekt | Frais d’automatisation : +10 % sur chaque projet renouvelé automatiquement | Commissione di automazione: +10 % su ogni progetto rinnovato automaticamente | Comisión de automatización: +10 % en cada proyecto renovado automáticamente | ऑटोमेशन शुल्क: हर अपने-आप नवीनीकृत प्रोजेक्ट पर +10 % | Otomasyon ücreti: otomatik yenilenen her projeye +%10 | Taxa de automação: +10 % em cada projeto renovado automaticamente | Комісія автоматизації: +10 % до кожного автоматично продовженого проєкту | Biaya otomatisasi: +10 % untuk setiap proyek yang diperpanjang otomatis | Opłata za automatyzację: +10 % do każdego automatycznie odnowionego projektu | 自动化手续费：每个自动续期项目 +10 % | 자동화 수수료: 자동 갱신되는 프로젝트마다 +10 % | 自動化手数料：自動更新される各プロジェクトに +10 %'),
  done: LAB_L('DONE | ГОТОВО | FERTIG | TERMINÉ | FATTO | LISTO | हो गया | TAMAM | CONCLUIR | ГОТОВО | SELESAI | GOTOWE | 完成 | 완료 | 完了'),
  msgRenewed: LAB_L('Lab project renewed: {usd} (+{fee} automation fee) | Проект лаборатории продлён: {usd} (+{fee} комиссия) | Laborprojekt verlängert: {usd} (+{fee} Gebühr) | Projet du labo renouvelé : {usd} (+{fee} de frais) | Progetto del laboratorio rinnovato: {usd} (+{fee} di commissione) | Proyecto del laboratorio renovado: {usd} (+{fee} de comisión) | लैब प्रोजेक्ट नवीनीकृत: {usd} (+{fee} शुल्क) | Laboratuvar projesi yenilendi: {usd} (+{fee} ücret) | Projeto do laboratório renovado: {usd} (+{fee} de taxa) | Проєкт лабораторії продовжено: {usd} (+{fee} комісія) | Proyek lab diperpanjang: {usd} (+{fee} biaya) | Projekt laboratorium odnowiony: {usd} (+{fee} opłaty) | 实验室项目已续期：{usd}（+{fee} 手续费） | 연구소 프로젝트 갱신: {usd} (+{fee} 수수료) | ラボのプロジェクトを更新：{usd}（+{fee} 手数料）'),
  msgNoMoney: LAB_L('Lab project not renewed: it needs {usd} | Проект лаборатории не продлён: нужно {usd} | Laborprojekt nicht verlängert: es braucht {usd} | Projet du labo non renouvelé : il faut {usd} | Progetto del laboratorio non rinnovato: servono {usd} | Proyecto del laboratorio no renovado: necesita {usd} | लैब प्रोजेक्ट नवीनीकृत नहीं: {usd} चाहिए | Laboratuvar projesi yenilenmedi: {usd} gerekiyor | Projeto do laboratório não renovado: precisa de {usd} | Проєкт лабораторії не продовжено: потрібно {usd} | Proyek lab tidak diperpanjang: butuh {usd} | Projekt laboratorium nieodnowiony: potrzeba {usd} | 实验室项目未续期：需要 {usd} | 연구소 프로젝트 갱신 안 됨: {usd} 필요 | ラボのプロジェクトは更新されませんでした：{usd} 必要です'),
};
BetterDTKit.mod('lab-automation', {
  needs: {
    calls: ['ResearchInvestEngine'],
    functions: ['openAutoMarketingDialog', 'closeAutoMarketingDialog'],
    objects: ['ArrayMyResearch_Invest', 'ArrayLanguage'],
    vars: ['Budget', 'ResearchCoins', 'LanguageChoose', 'class', 'DayTotal'],
    arrays: { ArrayMyResearch_Invest: [1, 3] },
    check: () => !globalThis.BDTLabAutomationCore ? 'lib-lab-automation-core.js'
      : !globalThis.BDTReviewData ? 'lib-review-data.js' : !globalThis.BDTReviewTexts ? 'lib-review-texts.js' : '',
  },
}, (rt, kit) => {
  if (globalThis.__bdtLabAutomation) globalThis.__bdtLabAutomation.dispose();
  const C = BDTLabAutomationCore, D = BDTReviewData, T = BDTReviewTexts, gv = rt.globalVars, S = BetterDT.settings;
  const LIC = globalThis.BDTLabInvestCore;   // lab-invest.js: amounts over $25M are kept in its form
  const SCREEN = 'RESEARCH INVEST', BACK = 'RESEARCH INVEST (Back)';
  // the lab itself: while a project runs the game does not open the investing window, so the button is there too
  const LAB = 'RESEARCH MENU', LAB_UI = 'UI (Top)';
  const here = () => { const c = String(gv.class); return c === SCREEN || c === LAB; };
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const lang = () => { const l = Math.round(num(gv.LanguageChoose)); return l >= 0 && l < 15 ? l : 0; };
  const tr = (key, v = {}) => String(LAB_TXT[key][lang()] || LAB_TXT[key][0]).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const usd = (v) => {
    const a = Math.abs(v);
    for (const [d, s] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) if (a >= d) return '$' + +(v / d).toFixed(a >= 100 * d ? 0 : 2) + s;
    return '$' + Math.round(v);
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const log = (...a) => (globalThis.BetterDT ? BetterDT.log : console.log)('[lab-automation]', ...a);
  const today = () => num(gv.DayTotal);
  const areas = C.areaMap(D.engines);
  const deviceName = (d) => String(kit.text(d.text) || d.id).replace(/\[[^\]]*\]/g, '').trim();
  const areaName = (cat) => T.cat[cat] ? T.t(T.cat[cat], lang()) : cat;

  // ── the lab's table: the game's rows 0–2 and ours ──────────────────────────────────────────────────────────────────
  const tab = () => rt.objects.ArrayMyResearch_Invest.getFirstInstance();
  const get = (row) => { const a = tab(); return a && a.height > row ? num(a.getAt(0, row)) : 0; };
  function set(row, v) {
    const a = tab();
    if (!a) return;
    if (a.height < C.ROWS) a.setSize(Math.max(1, a.width), C.ROWS, Math.max(1, a.depth));
    a.setAt(v, 0, row);
  }
  const flags = () => get(C.ROW.flags);
  const on = (f) => C.isOn(flags(), f);
  const amountOf = (v) => (LIC ? LIC.decode(v) : v);
  const kept = (amount) => (LIC ? LIC.encode(amount) : amount);

  // ── the focus for research-breakthroughs.js ────────────────────────────────────────────────────────────────────────
  const focus = () => C.decodeFocus(get(C.ROW.focus));
  globalThis.BDTLabFocus = { weight: (research) => (on('focus') ? C.focusWeight(research, focus(), D.engines, areas) : 1) };

  // ── messages: the game's own message stack ─────────────────────────────────────────────────────────────────────────
  const hi = (v) => `[color=#FFD800]${esc(v)}[/color]`;
  function notify(text) {
    if (typeof globalThis.showOfficeNotification === 'function') globalThis.showOfficeNotification(text);
    else kit.ui.toast(text.replace(/\[\/?color[^\]]*\]/g, ''));
  }

  // ── every day: collecting and renewal ──────────────────────────────────────────────────────────────────────────────
  let warned = false;   // the message about the money, once for each project that could not be renewed
  function collect() {
    const pool = get(0), n = Math.floor(pool);
    if (n < 1) return;
    gv.ResearchCoins = num(gv.ResearchCoins) + n;
    set(0, pool - n);
    set(C.ROW.collected, get(C.ROW.collected) + n);
  }
  function renew() {
    const r = C.renewal({ days: get(1), amount: amountOf(get(2)), money: num(gv.Budget), reserve: Math.max(0, S.num('auto-research.reserve', 0)) });
    if (!r) return;
    if (!r.ok) {
      if (!warned) notify(tr('msgNoMoney', { usd: hi(usd(r.cost)) }));
      warned = true;
      return;
    }
    // the game's Invest button: the money, 30 days, the amount, the social post
    gv.Budget = num(gv.Budget) - r.cost;
    set(1, C.PROJECT_DAYS);
    set(2, kept(r.amount));
    try { globalThis.socialQueueThemeEvent?.(rt, 34); } catch { }
    set(C.ROW.fees, get(C.ROW.fees) + r.fee);
    set(C.ROW.renewed, get(C.ROW.renewed) + 1);
    warned = false;
    log('project renewed', r.amount, 'fee', r.fee);
    notify(tr('msgRenewed', { usd: hi(usd(r.amount)), fee: hi(usd(r.fee)) }));
    paint();
  }
  // after the game's day of the lab, once the other mods' hooks of it are done (research-breakthroughs counts the
  // points the lab made from the pool, and ends the project's breakthroughs)
  kit.wrapCalls('ResearchInvestEngine', {
    after() {
      setTimeout(kit.guard(() => {
        if (!(today() > 0)) return;
        if (on('collect')) collect();
        if (on('renew')) renew();
        paint();
      }), 0);
    },
  });
  kit.on('gameLoaded', () => { warned = false; });

  // ── the AUTOMATION button on the investing window ──────────────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.id = 'bdt-lab-auto-css';
  document.head.appendChild(css);
  // the game's automatic marketing styles (injected when its window first opens), with our class names
  function gameCss() {
    if (!document.getElementById('amk-css')) { try { globalThis.openAutoMarketingDialog(); globalThis.closeAutoMarketingDialog(); } catch { } }
    const g = document.getElementById('amk-css');
    return g ? g.textContent.replace(/amk-/g, 'bdt-lab-') : '';
  }
  const OWN_CSS = `
#bdt-lab-btn { position: fixed; z-index: 6; display: flex; align-items: center; gap: .55em; transform-origin: 0 0;
  padding: 0 1em; height: 2.3em; border-radius: .7em; cursor: pointer; color: #fff; white-space: nowrap;
  font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; letter-spacing: .05em; text-transform: uppercase;
  background: linear-gradient(165deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.14) 55%, rgba(255,255,255,0.10) 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.26), inset 0 1px 0 rgba(255,255,255,0.30);
  transition: filter .15s ease, box-shadow .15s ease; user-select: none; }
#bdt-lab-btn.bdt-lab-at-lab { transform: translate(-100%, -50%); }
#bdt-lab-btn:hover { filter: brightness(1.12); box-shadow: inset 0 0 0 2px rgba(255,255,255,0.65), inset 0 1px 0 rgba(255,255,255,0.35); }
#bdt-lab-btn .bdt-lab-bdot { width: .55em; height: .55em; border-radius: 50%; background: rgba(255,255,255,.35); }
#bdt-lab-btn.bdt-lab-is-on .bdt-lab-bdot { background: linear-gradient(135deg, #2fae4d, #a8d43c); box-shadow: 0 0 0 2px rgba(255,255,255,.85); }
#bdt-lab-root #bdt-lab-box { width: 1240px; }
#bdt-lab-root #bdt-lab-cards { grid-template-columns: 1fr 1fr; }
#bdt-lab-root #bdt-lab-sum { grid-template-columns: 1fr; }
#bdt-lab-root .bdt-lab-tiles { grid-template-columns: repeat(3, 1fr); }
.bdt-lab-buy { flex: none; display: flex; align-items: center; gap: 8px; height: 38px; padding: 1px 16px 0; border-radius: 11px;
  cursor: pointer; white-space: nowrap; font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; font-size: 19px;
  letter-spacing: .5px; color: #fff; background: linear-gradient(0deg, #319552 0%, #5cad53 55%, #8cc260 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.40), inset 0 -2px 0 rgba(0,0,0,0.14); transition: filter .14s ease, transform .14s ease; }
.bdt-lab-buy:hover { filter: brightness(1.08); transform: translateY(-1px); }
.bdt-lab-buy.bdt-lab-no { background: rgba(0,0,0,0.26); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14); color: rgba(255,255,255,.55);
  cursor: default; filter: none; transform: none; }
.bdt-lab-buy small { font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; font-size: 17px; opacity: .9; }
#bdt-lab-root .bdt-lab-step span { width: 210px; }
.bdt-lab-lock { padding: 10px 0 14px; border-top: 1px solid rgba(255,255,255,0.16); font-size: 18px; color: rgba(255,255,255,0.62); }
.bdt-lab-ico { width: 30px; height: 30px; }`;
  const ICON = '<svg class="bdt-lab-ico" viewBox="0 0 24 24" fill="#fff"><path d="M9 2h6v2h-1v5.2l5.6 9.3A2 2 0 0 1 17.9 21H6.1a2 2 0 0 1-1.7-2.5L10 9.2V4H9V2zm3 9.1L8.3 17h7.4L12 11.1z"/></svg>';
  let btn = null, screen = null, shade = null;
  // the game's message over the screen ("You have already invested…") darkens it with a black tile; the button
  // darkens with it and cannot be clicked under it
  function shadeOpacity() {
    if (!shade || !alive(shade)) {
      shade = null;
      try { shade = rt.objects.TiledBackground3.getAllInstances().find(i => i.layer && i.layer.name === 'EDITOR NOTIFICATION') || null; } catch { }
    }
    return shade && shade.layer.isVisible && shade.isVisible ? Math.max(0, Math.min(1, num(shade.opacity))) : 0;
  }
  const alive = (i) => { try { return rt.getInstanceByUid(i.uid) === i; } catch { return false; } };
  // the investing window: the biggest frame on its back layer (as research-breakthroughs.js finds it)
  function findWindow() {
    let win = null;
    for (const name of Object.keys(rt.objects)) {
      let all;
      try { all = rt.objects[name].getAllInstances(); } catch { continue; }
      for (const i of all) {
        if (i.layer && i.layer.name === BACK && i.width < 1500 && i.height > 300 && (!win || i.width * i.height > win.width * win.height)) win = i;
      }
    }
    return win;
  }
  function placeButton() {
    const cls = String(gv.class);
    if (cls !== SCREEN) screen = null;
    if (!here() || dlg) { if (btn) btn.style.display = 'none'; return; }
    if (cls === SCREEN && (!screen || !alive(screen))) screen = findWindow();
    if (cls === SCREEN && !screen) return;
    let L = null;
    if (cls === LAB) { try { L = rt.layout.getLayer(LAB_UI); } catch { L = null; } if (!L) return; }
    if (!btn) {
      css.textContent = OWN_CSS;
      btn = document.createElement('div');
      btn.id = 'bdt-lab-btn';
      btn.innerHTML = '<span class="bdt-lab-bdot"></span><span class="bdt-lab-btxt"></span>';
      for (const ev of SHIELD) btn.addEventListener(ev, (e) => e.stopPropagation());
      btn.addEventListener('click', kit.guard(() => { globalThis.tapMain?.(); openPanel(); }));
      document.body.appendChild(btn);
    }
    // the investing window: its top left corner; the lab: left of the game's COLLECT button (960, 1000, 400 wide)
    if (screen) L = screen.layer;
    const k = (L.layerToCssPx(1920, 0)[0] - L.layerToCssPx(0, 0)[0]) / 1920;
    const [x, y] = screen ? L.layerToCssPx(screen.x - screen.width / 2 + 28, screen.y - screen.height / 2 + 26) : L.layerToCssPx(740, 1000);
    btn.classList.toggle('bdt-lab-at-lab', !screen);
    const label = tr('button');
    if (btn.lastChild.textContent !== label) btn.lastChild.textContent = label;
    btn.classList.toggle('bdt-lab-is-on', C.FUNCS.some(on));
    const dark = shadeOpacity();
    Object.assign(btn.style, { display: 'flex', left: x + 'px', top: y + 'px', fontSize: 22 * k + 'px', opacity: String(screen ? screen.opacity : 1),
      filter: dark > 0.01 ? `brightness(${1 - dark})` : '', pointerEvents: dark > 0.01 ? 'none' : '' });
  }
  const SHIELD = ['mousedown', 'mouseup', 'click', 'dblclick', 'pointerdown', 'pointerup', 'pointermove', 'mousemove',
    'touchstart', 'touchmove', 'touchend', 'wheel', 'contextmenu'];

  // ── the panel ──────────────────────────────────────────────────────────────────────────────────────────────────────
  let dlg = null;
  function openPanel() {
    closePanel();
    css.textContent = gameCss() + OWN_CSS;
    const root = document.createElement('div');
    root.id = 'bdt-lab-root';
    root.innerHTML = '<div id="bdt-lab-back"></div><div id="bdt-lab-stage"></div>';
    for (const ev of SHIELD) root.addEventListener(ev, (e) => e.stopPropagation());
    root.querySelector('#bdt-lab-back').addEventListener('click', () => { globalThis.tapBack?.(); closePanel(); });
    root.addEventListener('click', kit.guard(onClick));
    document.body.appendChild(root);
    dlg = { root, stage: root.querySelector('#bdt-lab-stage') };
    window.addEventListener('resize', layout);
    window.addEventListener('keydown', onKey, true);
    paint();
    layout();
    if (btn) btn.style.display = 'none';
  }
  function closePanel() {
    if (!dlg) return;
    window.removeEventListener('resize', layout);
    window.removeEventListener('keydown', onKey, true);
    dlg.root.remove();
    dlg = null;
  }
  function onKey(e) {
    if (e.key !== 'Escape') return;
    e.stopPropagation(); e.preventDefault();
    globalThis.tapBack?.();
    closePanel();
  }
  // like the game's window: the canvas area, a 1920 × 1080 stage scaled into it
  function layout() {
    if (!dlg) return;
    let r = null;
    try { const c = rt.canvas || document.querySelector('canvas'); const b = c && c.getBoundingClientRect(); if (b && b.width > 2) r = b; } catch { }
    r = r || { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const k = Math.min(r.width / 1920, r.height / 1080) || 1;
    Object.assign(dlg.root.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    dlg.stage.style.transform = `translate(${(r.width - 1920 * k) / 2}px, ${(r.height - 1080 * k) / 2}px) scale(${k})`;
  }
  const affordable = (f) => num(gv.ResearchCoins) >= C.PRICES[f].rp && num(gv.Budget) >= C.PRICES[f].usd;
  function funcRow(f) {
    const p = C.PRICES[f], fl = flags();
    const right = C.bought(fl, f)
      ? `<div class="bdt-lab-sw ${C.isOn(fl, f) ? 'bdt-lab-on' : ''}" data-tog="${f}"></div>`
      : `<div class="bdt-lab-buy ${affordable(f) ? '' : 'bdt-lab-no'}" data-buy="${f}" title="${affordable(f) ? '' : esc(tr('noFunds'))}">${esc(tr('buy'))}`
        + ` <small>${fmt(p.rp)} RP · ${usd(p.usd)}</small></div>`;
    return `<div class="bdt-lab-row"><div class="bdt-lab-lbl"><b>${esc(tr(f))}</b><i>${esc(tr(f + 'Hint'))}</i></div>${right}</div>`;
  }
  function stepRow(label, kind, text, canPrev, canNext, dis) {
    return `<div class="bdt-lab-row ${dis ? 'bdt-lab-dis' : ''}"><div class="bdt-lab-lbl"><b>${esc(label)}</b></div>`
      + `<div class="bdt-lab-step"><button data-step="${kind}" data-dir="-1" ${canPrev ? '' : 'disabled'}>‹</button>`
      + `<span>${esc(text)}</span><button data-step="${kind}" data-dir="1" ${canNext ? '' : 'disabled'}>›</button></div></div>`;
  }
  function paint() {
    if (!dlg) return;
    const fl = flags(), days = get(1), fc = focus(), d = C.DEVICES[fc.device], list = d ? C.areasOf(d, D.engines) : [];
    const focusOk = C.bought(fl, 'focus'), focusDis = !C.isOn(fl, 'focus');
    const status = days > 0
      ? `<div class="bdt-lab-status bdt-lab-st-ok">${esc(tr('running', { d: days, usd: usd(amountOf(get(2))) }))}</div>`
      : `<div class="bdt-lab-status">${esc(tr('idle'))}</div>`;
    const tile = (label, value) => `<div class="bdt-lab-tile"><i>${esc(label)}</i><b>${esc(value)}</b></div>`;
    const html = `
  <div id="bdt-lab-head"><div class="bdt-lab-hico">${ICON}</div>
    <div class="bdt-lab-htxt"><div id="bdt-lab-title">${esc(tr('title'))}</div>${status}</div><div id="bdt-lab-x">×</div></div>
  <div id="bdt-lab-cards">
    <div class="bdt-lab-card bdt-lab-glass"><div class="bdt-lab-sec">${esc(tr('functions'))}</div>${C.FUNCS.map(funcRow).join('')}</div>
    <div class="bdt-lab-card bdt-lab-glass"><div class="bdt-lab-sec">${esc(tr('focusSec'))}</div>
      ${focusOk ? '' : `<div class="bdt-lab-lock">${esc(tr('focusLocked'))}</div>`}
      ${stepRow(tr('device'), 'device', d ? deviceName(d) : tr('none'), fc.device >= 0, fc.device < C.DEVICES.length - 1, !focusOk || focusDis)}
      ${stepRow(tr('area'), 'area', list[fc.area] ? areaName(list[fc.area]) : tr('any'), fc.area >= 0, d && fc.area < list.length - 1, !focusOk || focusDis || !d)}
    </div>
  </div>
  <div id="bdt-lab-sum"><div class="bdt-lab-sum-main"><div class="bdt-lab-sec">${esc(tr('summary'))}</div>
    <div class="bdt-lab-tiles">${tile(tr('collected'), fmt(get(C.ROW.collected)))}${tile(tr('renewed'), fmt(get(C.ROW.renewed)))}${tile(tr('fees'), usd(get(C.ROW.fees)))}</div>
    <div class="bdt-lab-fee">${esc(tr('feeNote'))}</div></div></div>
  <div id="bdt-lab-foot"><div id="bdt-lab-done">${esc(tr('done'))}</div></div>
`;
    // the window stays, only what is in it is drawn again (a new window would play its opening animation)
    let box = dlg.stage.querySelector('#bdt-lab-box');
    if (!box) { box = document.createElement('div'); box.id = 'bdt-lab-box'; dlg.stage.appendChild(box); }
    box.innerHTML = html;
  }
  function onClick(e) {
    const t = e.target.closest('[data-buy],[data-tog],[data-step],#bdt-lab-x,#bdt-lab-done');
    if (!t) return;
    if (t.id === 'bdt-lab-x' || t.id === 'bdt-lab-done') { globalThis.tapBack?.(); closePanel(); return; }
    if (t.dataset.buy) {
      const f = t.dataset.buy, p = C.PRICES[f];
      if (C.bought(flags(), f)) return;
      if (!affordable(f)) { globalThis.errorSound?.(); return; }
      gv.ResearchCoins = num(gv.ResearchCoins) - p.rp;
      gv.Budget = num(gv.Budget) - p.usd;
      set(C.ROW.flags, C.buy(flags(), f));
      log('bought', f);
      globalThis.researchSound?.();
    } else if (t.dataset.tog) {
      globalThis.tapMain?.();
      set(C.ROW.flags, C.turn(flags(), t.dataset.tog, !on(t.dataset.tog)));
    } else if (t.dataset.step) {
      globalThis.tapMain?.();
      const fc = focus(), dir = Number(t.dataset.dir);
      if (t.dataset.step === 'device') { fc.device = Math.max(-1, Math.min(C.DEVICES.length - 1, fc.device + dir)); fc.area = -1; }
      else { const n = C.areasOf(C.DEVICES[fc.device], D.engines).length; fc.area = Math.max(-1, Math.min(n - 1, fc.area + dir)); }
      set(C.ROW.focus, C.encodeFocus(fc.device, fc.area));
    }
    paint();
    // a collect or a renewal right away when it is turned on
    if (t.dataset.buy || t.dataset.tog) setTimeout(kit.guard(() => { if (on('collect')) collect(); if (on('renew')) renew(); paint(); }), 0);
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // the button follows the window every frame while the investing screen or the lab is open (it fades and moves in)
  let raf = 0;
  const frame = kit.guard(() => {
    raf = 0;
    placeButton();
    if (here()) raf = requestAnimationFrame(frame);
  });
  const timer = setInterval(kit.guard(() => {
    if (here()) { if (!raf) frame(); }
    else { placeButton(); if (dlg) closePanel(); }
  }), 150);
  const dispose = () => {
    clearInterval(timer); if (raf) cancelAnimationFrame(raf); closePanel(); btn?.remove(); css.remove();
    if (globalThis.BDTLabFocus) delete globalThis.BDTLabFocus;
    delete globalThis.__bdtLabAutomation;
  };
  globalThis.__bdtLabAutomation = { dispose, collect, renew, get flags() { return flags(); }, get focus() { return focus(); }, open: openPanel };
  kit.onStop(dispose);
  return dispose;
});
