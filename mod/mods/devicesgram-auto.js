// Devicesgram auto posting – the game's social network (Devicesgram), page "Create new post", and every game day.
//
// A panel above the categories of "Create new post" sells Auto posting once (500 RP + $5M) and then has an on/off
// switch. While it is on, everything the game offers to post (announcement, release, achievement, news) goes out
// every day with the game's default design of the topic: its first caption, its first image, its headline. That is
// the post the game's Publish button makes when nothing is changed. Automatic posts bring 15 % fewer likes and
// followers: at once when posted, and every day from the activity bonus of the last 3 days.
// The game's Publish is inside its Devicesgram module, so the post is added to the Devicesgram state the way that
// code does it (lib-devicesgram-core.js) and the state is given back to the game (loadSocialMediaV2SaveData and
// ArraySocialMedia (0, 0), which the game saves). While Devicesgram is open nothing is posted: giving the state back
// sends the window to its log in page, so the posts go out when it is closed.
// What was bought, the switch and the totals are kept in ArraySocialMedia (0, 7), saved with the game.
// The message goes to the game's message stack in the bottom right corner.
const DG_L = (s) => s.split(' | ');
const DG_TXT = {
  title: DG_L('Auto posting | Автопостинг | Automatisches Posten | Publication automatique | Pubblicazione automatica | Publicación automática | ऑटो पोस्टिंग | Otomatik paylaşım | Postagem automática | Автопостинг | Posting otomatis | Automatyczne publikowanie | 自动发帖 | 자동 게시 | 自動投稿'),
  hint: DG_L('Every day everything you can post goes out with the default design · −15 % likes and followers | Каждый день всё, что можно опубликовать, выходит с дизайном по умолчанию · −15 % лайков и подписчиков | Jeden Tag geht alles, was du posten kannst, mit dem Standarddesign raus · −15 % Likes und Follower | Chaque jour, tout ce que vous pouvez publier part avec le design par défaut · −15 % de j’aime et d’abonnés | Ogni giorno tutto ciò che puoi pubblicare esce con il design predefinito · −15 % di like e follower | Cada día todo lo que puedes publicar sale con el diseño predeterminado · −15 % de me gusta y seguidores | हर दिन जो भी पोस्ट हो सकता है, डिफ़ॉल्ट डिज़ाइन से जाता है · −15 % लाइक्स और फ़ॉलोअर्स | Her gün paylaşılabilecek her şey varsayılan tasarımla çıkar · −%15 beğeni ve takipçi | Todo dia tudo o que você pode postar sai com o design padrão · −15 % de curtidas e seguidores | Щодня все, що можна опублікувати, виходить зі стандартним дизайном · −15 % лайків і підписників | Setiap hari semua yang bisa diposting keluar dengan desain bawaan · −15 % suka dan pengikut | Codziennie wszystko, co można opublikować, wychodzi z domyślnym projektem · −15 % polubień i obserwujących | 每天把所有可发布的内容以默认设计发出 · 点赞和粉丝 −15 % | 매일 게시할 수 있는 모든 것을 기본 디자인으로 올립니다 · 좋아요와 팔로워 −15 % | 投稿できるものを毎日デフォルトのデザインで投稿 · いいねとフォロワー −15 %'),
  noFunds: DG_L("You don't have enough research points or money | Не хватает очков исследований или денег | Zu wenig Forschungspunkte oder Geld | Pas assez de points de recherche ou d’argent | Punti ricerca o denaro insufficienti | No tienes suficientes puntos de investigación o dinero | रिसर्च पॉइंट्स या पैसे कम हैं | Yeterli araştırma puanı veya para yok | Pontos de pesquisa ou dinheiro insuficientes | Не вистачає очок досліджень або грошей | Poin riset atau uang tidak cukup | Za mało punktów badań lub pieniędzy | 研究点数或资金不足 | 연구 포인트나 돈이 부족합니다 | 研究ポイントかお金が足りません"),
  buy: DG_L('Buy | Купить | Kaufen | Acheter | Acquista | Comprar | खरीदें | Satın al | Comprar | Купити | Beli | Kup | 购买 | 구매 | 購入'),
  stats: DG_L('Posted automatically: {n} · +{f} followers | Опубликовано автоматически: {n} · +{f} подписчиков | Automatisch gepostet: {n} · +{f} Follower | Publiés automatiquement : {n} · +{f} abonnés | Pubblicati automaticamente: {n} · +{f} follower | Publicados automáticamente: {n} · +{f} seguidores | अपने-आप पोस्ट: {n} · +{f} फ़ॉलोअर्स | Otomatik paylaşılan: {n} · +{f} takipçi | Postados automaticamente: {n} · +{f} seguidores | Опубліковано автоматично: {n} · +{f} підписників | Diposting otomatis: {n} · +{f} pengikut | Opublikowano automatycznie: {n} · +{f} obserwujących | 自动发布：{n} · +{f} 粉丝 | 자동 게시: {n} · +{f} 팔로워 | 自動投稿：{n} · +{f} フォロワー'),
  later: DG_L('New posts go out when Devicesgram is closed | Новые посты выйдут, когда Devicesgram будет закрыт | Neue Posts gehen raus, wenn Devicesgram geschlossen ist | Les nouveaux posts partent quand Devicesgram est fermé | I nuovi post escono quando Devicesgram è chiuso | Las nuevas publicaciones salen cuando Devicesgram está cerrado | Devicesgram बंद होने पर नए पोस्ट जाते हैं | Yeni gönderiler Devicesgram kapanınca çıkar | Novos posts saem quando o Devicesgram é fechado | Нові дописи вийдуть, коли Devicesgram буде закрито | Postingan baru keluar saat Devicesgram ditutup | Nowe posty wyjdą po zamknięciu Devicesgramu | 关闭 Devicesgram 后发出新帖子 | Devicesgram을 닫으면 새 게시물이 올라갑니다 | Devicesgram を閉じると新しい投稿が出ます'),
  msg: DG_L('Devicesgram: {n} posts published automatically (+{f} followers) | Devicesgram: автоматически опубликовано постов: {n} (+{f} подписчиков) | Devicesgram: {n} Posts automatisch veröffentlicht (+{f} Follower) | Devicesgram : {n} posts publiés automatiquement (+{f} abonnés) | Devicesgram: {n} post pubblicati automaticamente (+{f} follower) | Devicesgram: {n} publicaciones automáticas (+{f} seguidores) | Devicesgram: {n} पोस्ट अपने-आप प्रकाशित (+{f} फ़ॉलोअर्स) | Devicesgram: {n} gönderi otomatik paylaşıldı (+{f} takipçi) | Devicesgram: {n} posts publicados automaticamente (+{f} seguidores) | Devicesgram: автоматично опубліковано дописів: {n} (+{f} підписників) | Devicesgram: {n} postingan otomatis diterbitkan (+{f} pengikut) | Devicesgram: automatycznie opublikowano postów: {n} (+{f} obserwujących) | Devicesgram：自动发布 {n} 条帖子（+{f} 粉丝） | Devicesgram: 게시물 {n}개 자동 게시 (+{f} 팔로워) | Devicesgram：{n} 件を自動投稿（+{f} フォロワー）'),
};
BetterDTKit.mod('devicesgram-auto', {
  needs: {
    functions: ['getSocialMediaV2SaveData', 'loadSocialMediaV2SaveData', 'setSocialMediaV2Date', 'getSocialFollowers',
      'addSocialFollowers', 'unlockSocialTheme', 'socialDeviceAnnounced'],
    vars: ['Day', 'Month', 'Year', 'DayTotal', 'ResearchCoins', 'Budget', 'LanguageChoose', 'OfficeType'],
    objects: ['ArraySocialMedia', 'ArraySocialMedia_NewsDatabase', 'ArraySocialMedia_PostTextDatabase', 'ArrayLanguage'],
    check: () => (!globalThis.BDTDevicesgramCore ? 'lib-devicesgram-core.js' : ''),
  },
}, (rt, kit) => {
  if (globalThis.__bdtDevicesgramAuto) globalThis.__bdtDevicesgramAuto.dispose();
  const C = BDTDevicesgramCore, gv = rt.globalVars, S = BetterDT.settings;
  const ROW = 7;
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const lang = () => { const l = Math.round(num(gv.LanguageChoose)); return l >= 0 && l < 15 ? l : 0; };
  const tr = (key, v = {}) => String(DG_TXT[key][lang()] || DG_TXT[key][0]).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const usd = (v) => { for (const [d, s] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) if (v >= d) return '$' + +(v / d).toFixed(2) + s; return '$' + v; };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const log = (...a) => (globalThis.BetterDT ? BetterDT.log : console.log)('[devicesgram-auto]', ...a);
  const date = () => ({ d: num(gv.Day) || 1, m: num(gv.Month) || 1, y: num(gv.Year) });
  const sameDay = (a, b) => !!a && +a.d === +b.d && +a.m === +b.m && +a.y === +b.y;
  const isOpen = () => !!document.getElementById('smv2-root');

  // ── ours: ArraySocialMedia (0, 7) ──────────────────────────────────────────────────────────────────────────────────
  const arr = () => rt.objects.ArraySocialMedia.getFirstInstance();
  function mine() {
    try { const v = String(arr().getAt(0, ROW) || ''); if (v[0] === '{') return { b: 0, on: 0, n: 0, f: 0, cut: -1, ...JSON.parse(v) }; } catch { }
    return { b: 0, on: 0, n: 0, f: 0, cut: -1 };
  }
  function keep(m) {
    const a = arr();
    if (!a) return;
    if (a.height <= ROW) a.setSize(Math.max(1, a.width), ROW + 1, Math.max(1, a.depth));
    a.setAt(JSON.stringify(m), 0, ROW);
  }

  // ── the game's databases of topics and post texts (by topic) ───────────────────────────────────────────────────────
  function columns(name) {
    const a = rt.objects[name].getFirstInstance(), out = [];
    if (!a) return out;
    for (let x = 0; x < a.width; x++) { const c = []; for (let y = 0; y < a.height; y++) c.push(a.getAt(x, y)); out.push(c); }
    return out;
  }
  let rows = null, ptd = null;
  const texts = () => { if (!rows) { rows = columns('ArraySocialMedia_NewsDatabase'); ptd = columns('ArraySocialMedia_PostTextDatabase').map(c => c.map(v => String(v ?? ''))); } };
  function langText(i) {
    const a = rt.objects.ArrayLanguage.getFirstInstance();
    const v = a ? a.getAt(lang(), i) : '';
    return v == null || v === 0 || v === '' || v === '0' ? '' : String(v);
  }

  // ── messages: the game's own message stack ─────────────────────────────────────────────────────────────────────────
  const hi = (v) => `[color=#FFD800]${esc(v)}[/color]`;
  function notify(text) {
    if (!S.bool('devicesgram-auto.notify', true)) return;
    if (typeof globalThis.showOfficeNotification === 'function') globalThis.showOfficeNotification(text);
    else kit.ui.toast(text.replace(/\[\/?color[^\]]*\]/g, ''));
  }

  // ── posting ────────────────────────────────────────────────────────────────────────────────────────────────────────
  // what Devicesgram does when it opens: the topics the game queued while it had no state, and the device in design
  function prepare() {
    const a = arr(), q = a ? String(a.getAt(0, 1) || '') : '';
    if (/\d/.test(q)) {
      for (const e of C.parseQueue(q)) {
        const f = { a: 'socialDeviceAnnounced', r: 'socialDeviceReleased', u: 'socialSoftwareUpdated', w: 'socialCompanyAwarded' }[e.kind] || 'unlockSocialTheme';
        try { e.kind === 'w' ? globalThis[f](e.n) : globalThis[f](e.n, e.name); } catch (err) { kit.warn('queue', e, err); }
      }
      a.setAt('', 0, 1);
    }
    const designing = String(gv.OfficeType ?? '').trim().toUpperCase() === 'DESIGNER' && String(gv.DeviceTypeCreatingNow ?? '') !== '';
    if (designing) {
      let name = '';
      try { name = globalThis.socialResolveDevelopingName?.(rt) || String(gv.DeviceName ?? ''); } catch { }
      globalThis.socialDeviceAnnounced(gv.DeviceTypeCreatingNow, name);
    }
    return designing;
  }
  let pending = false;
  function post() {
    const m = mine();
    if (!m.b || !m.on) return;
    if (isOpen()) { pending = true; return; }
    pending = false;
    if (!(globalThis.getSocialFollowers() > 0)) return;   // loads the state; no account → nothing to post
    const announce = prepare();
    const d = date();
    globalThis.setSocialMediaV2Date(d.d, d.m, d.y);
    const json = globalThis.getSocialMediaV2SaveData();
    if (!json) return;
    const st = JSON.parse(json);
    texts();
    const done = C.publishAll(st, { date: d, rows, ptd, lang: langText, company: String(gv.CompanyName ?? '').trim() || st.account.name, announce });
    if (!done.posted.length) return;
    const out = JSON.stringify(st);
    globalThis.loadSocialMediaV2SaveData(out);
    arr().setAt(out, 0, 0);
    m.n += done.posted.length;
    m.f += done.followers;
    keep(m);
    log('posted', done.posted.join(','), '+' + done.followers);
    notify(tr('msg', { n: hi(done.posted.length), f: hi(fmt(done.followers)) }));
    paint();
  }
  // once a day, after the game's day of Devicesgram: the cut of the activity bonus of automatic posts, then posting
  let lastDay = -1;
  function daily() {
    const day = num(gv.DayTotal);
    if (day === lastDay || !(day > 0)) return;
    if (!(globalThis.getSocialFollowers() > 0)) { lastDay = day; return; }
    const json = globalThis.getSocialMediaV2SaveData();
    if (!json) return;
    const st = JSON.parse(json), d = date();
    if (!sameDay(st.account && st.account.lastSim, d)) return;   // the game's day of Devicesgram has not run yet
    lastDay = day;
    const m = mine();
    if (m.b && m.cut !== day) {
      let perk = 1;
      try { perk = typeof globalThis.perkMul === 'function' ? num(globalThis.perkMul('social.growth')) || 1 : 1; } catch { }
      const cut = C.dailyCut(st.posts, st.account.followers, C.dayNum(d), perk);
      if (cut > 0) { globalThis.addSocialFollowers(-cut); m.f -= cut; }
      m.cut = day;
      keep(m);
    }
    post();
  }

  // ── the panel on "Create new post" ─────────────────────────────────────────────────────────────────────────────────
  const OWN_CSS = `
#bdt-dg { margin: 0 0 18px; text-align: left; }
#bdt-dg .smv2-theme-row { gap: 18px; }
#bdt-dg .bdt-dg-stats { margin-top: 10px; font-size: .92em; opacity: .75; }
#bdt-dg .smv2-btn { white-space: nowrap; }
#bdt-dg .smv2-btn.bdt-dg-no { filter: grayscale(1); opacity: .55; }
#bdt-dg .bdt-dg-warn { margin-top: 10px; font-size: .92em; color: #ff7768; }`;
  const css = document.createElement('style');
  css.id = 'bdt-dg-css';
  css.textContent = OWN_CSS;
  document.head.appendChild(css);
  const SHIELD = ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'wheel'];
  const affordable = () => num(gv.ResearchCoins) >= C.PRICE.rp && num(gv.Budget) >= C.PRICE.usd;
  let warnUntil = 0;   // the "not enough" line after a click on Buy without the points or the money
  function html() {
    const m = mine(), p = C.PRICE;
    const ctl = m.b
      ? `<button class="smv2-toggle${m.on ? ' on' : ''}" data-dg="tog"></button>`
      : `<button class="smv2-btn small${affordable() ? '' : ' bdt-dg-no'}" data-dg="buy">${esc(tr('buy'))} · ${fmt(p.rp)} RP · ${usd(p.usd)}</button>`;
    const stats = m.b ? `<div class="bdt-dg-stats">${esc(tr('stats', { n: fmt(m.n), f: fmt(Math.max(0, m.f)) }))}${m.on ? ' · ' + esc(tr('later')) : ''}</div>` : '';
    const warn = !m.b && Date.now() < warnUntil ? `<div class="bdt-dg-warn">${esc(tr('noFunds'))}</div>` : '';
    return `<h3>${esc(tr('title'))}</h3><div class="smv2-theme-row"><div class="lbl"><div class="s">${esc(tr('hint'))}</div></div>${ctl}</div>${stats}${warn}`;
  }
  let shown = '';
  function paint() {
    const el = document.getElementById('bdt-dg');
    if (!el) return;
    const h = html();
    if (h !== shown) { el.innerHTML = h; shown = h; }
  }
  // under the step dots of "Create new post" on its first step: the categories, or "Nothing to post about yet"
  function place() {
    const wrap = document.querySelector('#smv2-root .smv2-createwrap');
    const steps = wrap && wrap.querySelector(':scope > .smv2-steps');
    const first = wrap && wrap.querySelector(':scope > .smv2-cat-grid, :scope > .smv2-empty');
    if (!steps || !first || document.getElementById('bdt-dg')) return;
    const el = document.createElement('div');
    el.id = 'bdt-dg';
    el.className = 'smv2-panel';
    for (const ev of SHIELD) el.addEventListener(ev, (e) => e.stopPropagation());
    el.addEventListener('click', kit.guard(onClick));
    steps.after(el);
    shown = '';
    paint();
  }
  function onClick(ev) {
    const t = ev.target.closest('[data-dg]');
    if (!t) return;
    const m = mine();
    if (t.dataset.dg === 'buy') {
      if (m.b) return;
      if (!affordable()) { globalThis.errorSound?.(); warnUntil = Date.now() + 4000; paint(); return; }
      gv.ResearchCoins = num(gv.ResearchCoins) - C.PRICE.rp;
      gv.Budget = num(gv.Budget) - C.PRICE.usd;
      m.b = 1; m.on = 1;
      log('bought');
      globalThis.researchSound?.();
    } else {
      globalThis.tapMain?.();
      m.on = m.on ? 0 : 1;
    }
    keep(m);
    if (m.on) pending = true;
    paint();
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────────
  let watched = null, mo = null, wasOpen = false;
  const timer = setInterval(kit.guard(() => {
    const root = document.getElementById('smv2-root');
    if (root !== watched) {
      if (mo) mo.disconnect();
      watched = root;
      mo = root ? new MutationObserver(kit.guard(place)) : null;
      if (mo) mo.observe(root, { childList: true, subtree: true });
    }
    if (root) { place(); paint(); }
    const open = !!root;
    if (wasOpen && !open && pending) post();
    wasOpen = open;
    daily();
  }), 400);
  kit.on('gameLoaded', () => { lastDay = -1; rows = null; pending = false; });
  const dispose = () => {
    clearInterval(timer); if (mo) mo.disconnect(); document.getElementById('bdt-dg')?.remove(); css.remove();
    delete globalThis.__bdtDevicesgramAuto;
  };
  globalThis.__bdtDevicesgramAuto = { dispose, post, daily, get state() { return mine(); } };
  kit.onStop(dispose);
});
