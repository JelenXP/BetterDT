// Custom start – start a new company in any month and year, not only in the game's five start years.
//
// The game's start years (2008, 2010, 2014, 2020, 2026) are presets: Loading_NewGame_2 (event sheet LOADING GAME)
// compares Year with each of them exactly and then sets the date and copies one column of
// ArrayMyResearch_NewGame (the start level of each of the 800 research items) into ArrayMyResearch. The rival
// companies (ArrayRatingsCompanies) have one layer per start year (earnings, price, fans…); at the first game day
// the game keeps the layer of the start year (_applyEraOnce). New product lines and parts come by game day
// (DictionaryTimeline), so they work for any date by themselves.
//
// Under the game's "Start year" cards we add a "Custom start" row with a month and a year. With it selected, the
// game gets the nearest start year at or before that date (the game's own card is selected), and while the new
// game loads (XHR of the project files) we hand the game changed copies of two files: in ArrayMyResearch_NewGame
// that start year's column and in ArrayRatingsCompanies that start year's layer are moved between that start
// year and the next one, as far as the chosen date is between them (May 2017 is 56 % of the way from 2014 to
// 2020). When the game asks for DictionaryTimeline.json (right after it set its start date), we set the chosen
// date, so the game's timeline check that follows already counts from it.
//
// The latest date is December of the latest year reached in any game (the game unlocks its start years the same
// way), at most December 2026. getCampaignStart() counts from the first month of the game, not from January.
// The stats page counts "days" with the game's own copy of that function, so for a start in, say, December it
// shows up to 11 months more.
BetterDTKit.mod('custom-start', {
  needs: {
    functions: ['applyCompanySettings', 'getCompanyUnlocks', 'getCampaignStart', 'getCompanyStatsJourney'],
    vars: ['Year', 'Month', 'Day', 'DayTotal', 'DayInMonth', 'LoadingType'],
  },
}, (rt, kit) => {
  if (globalThis.__dtCustomStart) globalThis.__dtCustomStart.dispose();

  const S = BetterDT.settings, gv = rt.globalVars;
  const ERAS = [2008, 2010, 2014, 2020, 2026];
  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];   // the game's year: 365 days, no leap years
  const FILE_RESEARCH = 'ArrayMyResearch_NewGame.json', FILE_RIVALS = 'ArrayRatings/ArrayRatingsCompanies.json';
  const FILE_TIMELINE = 'DictionaryTimeline.json';

  const LOCALES = ['en', 'ru', 'de', 'fr', 'it', 'es', 'hi', 'tr', 'pt', 'uk', 'id', 'pl', 'zh', 'ko', 'ja'];
  const T = {
    title: ['Custom start', 'Свой старт', 'Eigener Start', 'Départ libre', 'Inizio libero', 'Inicio libre', 'अपनी शुरुआत',
      'Özel başlangıç', 'Início livre', 'Свій старт', 'Mulai bebas', 'Własny start', '自定义开局', '사용자 시작', 'カスタム開始'],
    sub: ['Any month: research and rivals match the date', 'Любой месяц: исследования и конкуренты под дату',
      'Jeder Monat: Forschung und Konkurrenz passen zum Datum', 'N\'importe quel mois : recherche et rivaux selon la date',
      'Qualsiasi mese: ricerca e rivali in base alla data', 'Cualquier mes: investigación y rivales según la fecha',
      'कोई भी महीना: रिसर्च और प्रतिद्वंद्वी तारीख के अनुसार', 'Her ay: araştırma ve rakipler tarihe göre',
      'Qualquer mês: pesquisa e rivais de acordo com a data', 'Будь-який місяць: дослідження й конкуренти за датою',
      'Bulan apa saja: riset dan pesaing sesuai tanggal', 'Dowolny miesiąc: badania i rywale według daty',
      '任意月份：研究和对手与日期相符', '아무 달이나: 연구와 경쟁사가 날짜에 맞춰집니다', '好きな月から：研究とライバルが日付に合わせて調整'],
    next: ['Next', 'Далее', 'Als Nächstes', 'Ensuite', 'Poi', 'Después', 'आगे', 'Sonra', 'Depois', 'Далі', 'Berikutnya',
      'Dalej', '之后', '다음', '次'],
  };
  // product lines that come later (DictionaryTimeline "Creating …")
  const LINES = {
    'Creating Tablets': ['Tablets', 'Планшеты', 'Tablets', 'Tablettes', 'Tablet', 'Tabletas', 'टैबलेट', 'Tabletler', 'Tablets',
      'Планшети', 'Tablet', 'Tablety', '平板电脑', '태블릿', 'タブレット'],
    'Creating Keyboards': ['Keyboards', 'Клавиатуры', 'Tastaturen', 'Claviers', 'Tastiere', 'Teclados', 'कीबोर्ड', 'Klavyeler',
      'Teclados', 'Клавіатури', 'Keyboard', 'Klawiatury', '键盘', '키보드', 'キーボード'],
    'Creating Watches': ['Smartwatches', 'Умные часы', 'Smartwatches', 'Montres connectées', 'Smartwatch', 'Relojes inteligentes',
      'स्मार्टवॉच', 'Akıllı saatler', 'Smartwatches', 'Розумні годинники', 'Jam tangan pintar', 'Smartwatche', '智能手表', '스마트워치', 'スマートウォッチ'],
    'Creating Headphones': ['Headphones', 'Наушники', 'Kopfhörer', 'Écouteurs', 'Cuffie', 'Auriculares', 'हेडफ़ोन', 'Kulaklıklar',
      'Fones de ouvido', 'Навушники', 'Headphone', 'Słuchawki', '耳机', '헤드폰', 'ヘッドホン'],
    'Creating Scooters': ['Scooters', 'Самокаты', 'Scooter', 'Trottinettes', 'Monopattini', 'Patinetes', 'स्कूटर', 'Scooterlar',
      'Patinetes', 'Самокати', 'Skuter', 'Hulajnogi', '滑板车', '킥보드', 'キックボード'],
    'Creating VR': ['VR headsets', 'VR-шлемы', 'VR-Brillen', 'Casques VR', 'Visori VR', 'Visores VR', 'VR हेडसेट', 'VR gözlükleri',
      'Óculos VR', 'VR-шоломи', 'Headset VR', 'Gogle VR', 'VR 头显', 'VR 헤드셋', 'VR ヘッドセット'],
  };
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const t = (k) => T[k][lang()] || T[k][0];

  const dayOf = (y, m) => { let d = 365 * (y - 2008) + 1; for (let i = 0; i < m - 1; i++) d += DAYS[i]; return d; };
  const baseEra = (y) => ERAS.filter(e => e <= y).pop() || ERAS[0];
  // how far the date is from its start year to the next one (0…1); none after 2026
  function share(y, m) {
    const b = baseEra(y), n = ERAS[ERAS.indexOf(b) + 1];
    if (!n) return { base: b, next: 0, f: 0 };
    return { base: b, next: n, f: (dayOf(y, m) - dayOf(b, 1)) / (dayOf(n, 1) - dayOf(b, 1)) };
  }
  function maxYear() {
    let y = 2008;
    try { y = Math.round(Number(globalThis.getCompanyUnlocks().maxYear)) || 2008; } catch { }
    return Math.min(2026, Math.max(2008, y));
  }

  // the chosen date (remembered) and whether "Custom start" is selected (only until the game starts or the menu)
  let pick = (() => { const v = Math.round(S.num('custom-start.ym', 201412)); return { y: Math.floor(v / 100), m: v % 100 || 1 }; })();
  let on = false;
  function clampPick() {
    const top = maxYear();
    pick.y = Math.min(top, Math.max(2008, pick.y));
    pick.m = Math.min(12, Math.max(1, pick.m));
  }

  // ── the project files the game loads, kept so a changed copy can be made right away ──────────
  const original = {};
  function load(file) {
    if (original[file]) return original[file];
    return original[file] = new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.onload = () => { try { res(JSON.parse(x.responseText)); } catch (e) { rej(e); } };
      x.onerror = () => rej(new Error('load ' + file));
      origOpen.call(x, 'GET', file);
      x.send();
    }).catch(e => { delete original[file]; throw e; });
  }
  let timeline = null;
  const ready = {};   // file → changed JSON text for the current pick
  async function prepare() {
    const want = pick.y * 100 + pick.m, s = share(pick.y, pick.m), z = ERAS.indexOf(s.base);
    const lerp = (a, b) => (typeof a === 'number' && typeof b === 'number') ? a + (b - a) * s.f : a;
    const [res, riv] = await Promise.all([load(FILE_RESEARCH), load(FILE_RIVALS)]);
    if (pick.y * 100 + pick.m !== want) return;
    // research: start level of every item, rounded to whole levels, never below the start year's own
    const r = JSON.parse(JSON.stringify(res));
    if (s.next) for (const row of r.data) {
      const a = row[z] && row[z][0], b = row[z + 1] && row[z + 1][0];
      if (typeof a === 'number' && typeof b === 'number') row[z][0] = Math.max(a, Math.round(lerp(a, b)));
    }
    // rivals: every numeric column of the start year's layer (earnings, price, fans, rating…)
    const c = JSON.parse(JSON.stringify(riv));
    if (s.next) for (const row of c.data) for (const cell of row) {
      if (Array.isArray(cell) && cell.length > z + 1) {
        const v = lerp(cell[z], cell[z + 1]);
        if (typeof v === 'number' && v !== cell[z]) cell[z] = Math.round(v * 1e4) / 1e4;
      }
    }
    ready.ym = want;
    ready[FILE_RESEARCH] = JSON.stringify(r);
    ready[FILE_RIVALS] = JSON.stringify(c);
  }

  // ── during the new game's loading ─────────────────────────────────────────────────────────────
  let loading = null;   // the pick being started, while the LOADING GAME layout runs a new game
  const blobs = [];
  const origOpen = XMLHttpRequest.prototype.open;
  const open = function (method, url, ...rest) {
    try {
      const u = String(url).replace(/^.*\/\/[^/]+\//, '').replace(/^\.?\//, '').split('?')[0];
      if (loading && (u === FILE_RESEARCH || u === FILE_RIVALS)) {
        if (ready.ym === loading.y * 100 + loading.m && ready[u]) {
          const b = URL.createObjectURL(new Blob([ready[u]], { type: 'application/json' }));
          blobs.push(b);
          return origOpen.call(this, method, b, ...rest);
        }
        kit.warn('data for ' + u + ' was not ready');
      } else if (loading && u === FILE_TIMELINE) {
        // the game has just set its start year's date (end of Loading_NewGame_2): ours instead
        gv.Year = loading.y; gv.Month = loading.m; gv.Day = 1;
        gv.DayInMonth = DAYS[loading.m - 1];
        gv.DayTotal = dayOf(loading.y, loading.m);
        BetterDT.log('custom start', loading.m + '/' + loading.y, 'day', gv.DayTotal);
      }
    } catch (e) { console.error('[custom-start]', e); }
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.open = open;

  // the first month of the game, not January of its year
  const origStart = globalThis.getCampaignStart;
  const start = function () {
    const r = origStart.apply(this, arguments);
    try {
      if (!r || !r.known) return r;
      const j = globalThis.getCompanyStatsJourney();
      const ym = j && Array.isArray(j.ym) ? Number(j.ym[0]) : NaN;
      if (!Number.isFinite(ym) || Math.floor(ym / 12) !== r.year) return r;
      const day = dayOf(r.year, ym % 12 + 1);
      return Object.assign({}, r, { day, elapsed: Math.max(1, (Number(gv.DayTotal) || day) - day + 1) });
    } catch { return r; }
  };
  globalThis.getCampaignStart = start;

  // ── the row under the start years ─────────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.id = 'bdt-custom-start-css';
  css.textContent = `
#bdt-cs { flex: 0 0 auto; flex-direction: row; align-items: center; gap: 18px; padding: 12px 26px; cursor: pointer;
  animation-delay: 200ms; --a: #f7c948; --ar: 247,201,72; transition: box-shadow .18s; }
#bdt-cs:hover { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18), 0 16px 40px rgba(0,0,0,0.34); }
#bdt-cs.bdt-cs-sel { box-shadow: inset 0 0 0 2px var(--a), 0 12px 30px rgba(0,0,0,0.45), 0 0 28px rgba(var(--ar), 0.26); }
#bdt-cs .cs-head { flex: 1 1 auto; min-width: 0; }
.bdt-cs-step { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.bdt-cs-arrow { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; cursor: pointer;
  background: rgba(255,255,255,0.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); color: rgba(255,255,255,0.8);
  font-size: 18px; line-height: 1; transition: background .15s; }
.bdt-cs-arrow:hover { background: rgba(255,255,255,0.16); }
.bdt-cs-arrow.bdt-cs-off { opacity: .25; pointer-events: none; }
.bdt-cs-val { min-width: 84px; text-align: center; font-family: 'SofiaSansExtraCondensed-Bold','Oswald',sans-serif;
  font-size: 30px; line-height: 1; color: rgba(255,255,255,0.92); }
#bdt-cs.bdt-cs-sel .bdt-cs-val { color: var(--a); }
.bdt-cs-info { flex: 0 0 auto; min-width: 250px; display: flex; flex-direction: column; gap: 4px; font-size: 17px;
  line-height: 1.1; color: rgba(255,255,255,0.55); white-space: nowrap; }
.bdt-cs-info b { color: rgba(255,255,255,0.85); font-weight: normal; }
.bdt-cs-tick { position: relative; flex: 0 0 auto; width: 26px; height: 26px; border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.25); transition: background .2s, box-shadow .2s; }
#bdt-cs.bdt-cs-sel .bdt-cs-tick { background: linear-gradient(150deg, #fff, var(--a) 65%); box-shadow: 0 4px 14px rgba(var(--ar), 0.5); }
#bdt-cs.bdt-cs-sel .bdt-cs-tick::after { content: ''; position: absolute; left: 9px; top: 5px; width: 6px; height: 11px;
  border: solid #1b1b1b; border-width: 0 3px 3px 0; transform: rotate(45deg); }
/* with the custom start selected the game's card only shows the start year the company is built on */
#cs-root.bdt-cs-on .cs-year.cs-sel { box-shadow: inset 0 0 0 1px rgba(var(--ar), 0.6), 0 10px 26px rgba(0,0,0,0.36); }
#cs-root.bdt-cs-on .cs-year.cs-sel .cs-year-tick { opacity: 0; }
`;
  document.head.appendChild(css);

  let row = null, ignoreCard = false;
  const months = () => { try { return new Intl.DateTimeFormat(LOCALES[lang()], { month: 'short' }); } catch { return new Intl.DateTimeFormat('en', { month: 'short' }); } };

  function build(stage) {
    const r = document.createElement('section');
    r.className = 'cs-block';
    r.id = 'bdt-cs';
    r.innerHTML = `<div class="cs-head" style="--h1:#f7c948;--h2:#ff9e14;--hr:247,201,72"><div class="cs-head-bar"></div>
<div class="cs-head-title"></div><div class="cs-head-sub"></div><div class="cs-head-line"></div></div>
<div class="bdt-cs-step" data-k="m"><div class="bdt-cs-arrow" data-d="-1">‹</div><div class="bdt-cs-val"></div><div class="bdt-cs-arrow" data-d="1">›</div></div>
<div class="bdt-cs-step" data-k="y"><div class="bdt-cs-arrow" data-d="-1">‹</div><div class="bdt-cs-val"></div><div class="bdt-cs-arrow" data-d="1">›</div></div>
<div class="bdt-cs-info"><div class="bdt-cs-mix"></div><div class="bdt-cs-next"></div></div><div class="bdt-cs-tick"></div>`;
    r.addEventListener('click', kit.guard((ev) => {
      const a = ev.target.closest('.bdt-cs-arrow');
      if (a) {
        const k = a.parentNode.dataset.k, d = Number(a.dataset.d);
        if (k === 'y') pick.y += d;
        else { pick.m += d; if (pick.m < 1) { pick.m = 12; pick.y--; } else if (pick.m > 12) { pick.m = 1; pick.y++; } }
        if (pick.y < 2008) { pick.y = 2008; pick.m = 1; }
        clampPick();
        Promise.resolve(S.set('custom-start.ym', pick.y * 100 + pick.m)).catch(e => console.error('[custom-start] save', e));
      }
      globalThis.tapMain?.();
      select(true);
    }));
    stage.appendChild(r);
    return r;
  }

  // the game's card of the start year the custom start is built on (Year, the game's own selection)
  function select(v) {
    on = v;
    const root = document.getElementById('cs-root');
    if (on) {
      const card = root && root.querySelector(`.cs-year[data-year="${share(pick.y, pick.m).base}"]`);
      if (card && !card.classList.contains('cs-sel')) { ignoreCard = true; try { card.click(); } finally { ignoreCard = false; } }
      prepare().catch(e => console.error('[custom-start] prepare', e));
    }
    paint();
  }

  function paint() {
    const root = document.getElementById('cs-root');
    if (!row || !root) return;
    clampPick();
    root.classList.toggle('bdt-cs-on', on);
    row.classList.toggle('bdt-cs-sel', on);
    const l = lang();
    if (row.dataset.lang !== String(l)) {
      row.dataset.lang = String(l);
      row.querySelector('.cs-head-title').textContent = t('title');
      row.querySelector('.cs-head-sub').textContent = t('sub');
    }
    const [mStep, yStep] = row.querySelectorAll('.bdt-cs-step');
    mStep.querySelector('.bdt-cs-val').textContent = months().format(new Date(2001, pick.m - 1, 15));
    yStep.querySelector('.bdt-cs-val').textContent = String(pick.y);
    const top = maxYear();
    const atStart = pick.y === 2008 && pick.m === 1, atEnd = pick.y === top && pick.m === 12;
    mStep.children[0].classList.toggle('bdt-cs-off', atStart);
    mStep.children[2].classList.toggle('bdt-cs-off', atEnd);
    yStep.children[0].classList.toggle('bdt-cs-off', pick.y <= 2008);
    yStep.children[2].classList.toggle('bdt-cs-off', pick.y >= top);
    // what the company starts with: between which start years, and the next product line
    const s = share(pick.y, pick.m);
    row.querySelector('.bdt-cs-mix').innerHTML = s.next && s.f > 0
      ? `<b>${s.base}</b> → <b>${s.next}</b>: ${Math.round(s.f * 100)} %` : `<b>${s.base}</b>`;
    let nx = '';
    if (timeline) {
      const d = dayOf(pick.y, pick.m);
      const later = Object.keys(LINES).map(k => [k, Number(timeline[k])]).filter(([, v]) => v > d).sort((a, b) => a[1] - b[1])[0];
      if (later) {
        const dd = later[1] - 1, y = 2008 + Math.floor(dd / 365);
        let rest = dd % 365, m = 0;
        while (rest >= DAYS[m]) rest -= DAYS[m++];
        nx = `${t('next')}: <b>${LINES[later[0]][l] || LINES[later[0]][0]}</b> ${String(m + 1).padStart(2, '0')}/${y}`;
      }
    }
    row.querySelector('.bdt-cs-next').innerHTML = nx;
  }

  function onCardClick(ev) {
    if (!ignoreCard && ev.target.closest && ev.target.closest('.cs-year') && on) select(false);
  }

  let years = null;
  function tick() {
    let name = '';
    try { name = rt.layout.name; } catch { return; }
    if (name === 'MENU' || name === 'START PAGE') { on = false; loading = null; }
    // the new game: from the moment the loading starts until it ends
    if (name === 'LOADING GAME') {
      if (!loading && on && gv.LoadingType === 'NEW GAME' && Number(gv.Year) === share(pick.y, pick.m).base) {
        loading = { y: pick.y, m: pick.m };
        if (ready.ym !== pick.y * 100 + pick.m) prepare().catch(e => console.error('[custom-start] prepare', e));
      }
    } else if (loading) {
      loading = null; on = false;
      while (blobs.length) URL.revokeObjectURL(blobs.pop());
    }
    const stage = document.querySelector('#cs-root #cs-stage');
    const block = stage && stage.querySelector('#cs-block-years');
    if (!block) { row = null; return; }
    if (!row || !row.isConnected) {
      row = build(stage);
      if (!timeline) load(FILE_TIMELINE).then(d => { timeline = d && d.data; paint(); }, () => {});
    }
    const ys = stage.querySelector('#cs-years');
    if (ys !== years) { years = ys; if (ys) ys.addEventListener('click', kit.guard(onCardClick), true); }
    // back from the next screen: the game read its Year again; keep the custom start if it still fits
    if (on && Number(gv.Year) !== share(pick.y, pick.m).base) on = false;
    paint();
  }
  const timer = setInterval(kit.guard(tick), 200);
  tick();

  const dispose = () => {
    clearInterval(timer);
    if (XMLHttpRequest.prototype.open === open) XMLHttpRequest.prototype.open = origOpen;
    if (globalThis.getCampaignStart === start) globalThis.getCampaignStart = origStart;
    while (blobs.length) URL.revokeObjectURL(blobs.pop());
    document.getElementById('bdt-cs')?.remove();
    document.getElementById('cs-root')?.classList.remove('bdt-cs-on');
    css.remove();
  };
  globalThis.__dtCustomStart = { dispose, get state() { return { on, pick: { ...pick }, loading, ready: ready.ym || 0 }; } };
  return dispose;
});
