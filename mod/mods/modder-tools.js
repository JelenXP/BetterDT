// Modder tools – for people who write mods (Settings → BetterDT → Mods, off by default).
//
// With the option on, a mod is loaded again as soon as one of its files is saved, without restarting the game: the
// mod stops (what it added through BetterDTKit is removed and its dispose runs), its files are read again and run, and
// it starts at once; with a game loaded it gets gameLoaded again, like after loading a save. A changed mod.json
// (title, description, options) is read again too, and a new folder mod (Settings → BetterDT → Mods → Create a mod)
// is loaded as soon as its files are there. A message in the corner says that the mod was loaded again, or where its
// error is. What a mod changed in the game without BetterDTKit and does not undo in its dispose stays, the same as
// when it is turned off. F10 opens the modder panel (modder-panel.js).
//
// The loader tells when the files changed (https://betterdt.localhost/modstat, checked every second while the option
// is on) and gives their text (modsrc); the mods run through the loader's own runMod, so errors show the same way.
BetterDTKit.mod('modder-tools', {}, (rt, kit) => {
  const B = BetterDT, S = B.settings, K = BetterDTKit;
  const on = () => S.bool('modder.on', false);
  // the settings and these tools are not loaded again: everything else is
  const SKIP = new Set(['betterdt-settings.js', 'modder-tools.js']);

  const TXT = {
    again: ['Mod {mod} loaded again', 'Мод {mod} загружен заново', 'Mod {mod} neu geladen', 'Mod {mod} rechargé', 'Mod {mod} ricaricato',
      'Mod {mod} recargado', 'मॉड {mod} फिर से लोड हुआ', '{mod} modu yeniden yüklendi', 'Mod {mod} recarregado', 'Мод {mod} завантажено знову',
      'Mod {mod} dimuat ulang', 'Mod {mod} wczytany ponownie', '模组 {mod} 已重新加载', '모드 {mod} 다시 불러옴', 'MOD {mod} を再読み込みしました'],
    error: ['Mod {mod}: error in {where}', 'Мод {mod}: ошибка в {where}', 'Mod {mod}: Fehler in {where}', 'Mod {mod} : erreur dans {where}',
      'Mod {mod}: errore in {where}', 'Mod {mod}: error en {where}', 'मॉड {mod}: {where} में त्रुटि', '{mod} modu: {where} içinde hata',
      'Mod {mod}: erro em {where}', 'Мод {mod}: помилка в {where}', 'Mod {mod}: galat di {where}', 'Mod {mod}: błąd w {where}',
      '模组 {mod}：{where} 出错', '모드 {mod}: {where}에서 오류', 'MOD {mod}：{where} でエラー'],
    line: ['{file}, line {line}', '{file}, строка {line}', '{file}, Zeile {line}', '{file}, ligne {line}', '{file}, riga {line}',
      '{file}, línea {line}', '{file}, पंक्ति {line}', '{file}, satır {line}', '{file}, linha {line}', '{file}, рядок {line}',
      '{file}, baris {line}', '{file}, wiersz {line}', '{file}，第 {line} 行', '{file}, {line}행', '{file}、{line} 行'],
    missing: ['Mod {mod}: {file} cannot be read', 'Мод {mod}: не удаётся прочитать {file}', 'Mod {mod}: {file} kann nicht gelesen werden',
      'Mod {mod} : impossible de lire {file}', 'Mod {mod}: impossibile leggere {file}', 'Mod {mod}: no se puede leer {file}',
      'मॉड {mod}: {file} पढ़ा नहीं जा सकता', '{mod} modu: {file} okunamıyor', 'Mod {mod}: não é possível ler {file}',
      'Мод {mod}: не вдається прочитати {file}', 'Mod {mod}: {file} tidak dapat dibaca', 'Mod {mod}: nie można odczytać {file}',
      '模组 {mod}：无法读取 {file}', '모드 {mod}: {file}을(를) 읽을 수 없음', 'MOD {mod}：{file} を読み込めません'],
  };
  const lang = () => { const l = Math.round(Number(rt.globalVars.LanguageChoose)); return l >= 0 && l < 15 ? l : 0; };
  const tr = (key, v = {}) => String(TXT[key][lang()] || TXT[key][0]).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);

  const modOf = (file) => (file.includes('/') ? file.split('/')[0] : file.replace(/\.js$/, ''));
  async function src(file) {
    const r = await B.api('modsrc', { file });
    return r && typeof r.text === 'string' ? r.text : null;
  }

  // a mod's files read again and run; true when it runs without an error
  async function reload(name, files) {
    const folder = Object.keys(files).some(f => f.startsWith(name + '/'));
    let list;
    if (folder) {
      const text = await src(name + '/mod.json');
      let manifest = null;
      try { manifest = JSON.parse(text); } catch { }
      const entry = K.mods().find(m => m.file === name);
      if (entry && !entry.enabled) return true;
      if (manifest) K.setManifest(name, manifest);
      if (!entry) K.addMod(Object.freeze({ file: name, folder: true, enabled: true, manifest, manifestText: text }));
      const own = manifest && Array.isArray(manifest.files) ? manifest.files.filter(f => typeof f === 'string' && /^[\w.-]+\.js$/.test(f)) : [];
      list = (own.length ? own : ['mod.js']).map(f => name + '/' + f);
    } else {
      const entry = K.mods().find(m => m.file === name + '.js');
      if (!entry || !entry.enabled) return true;
      list = [name + '.js'];
    }
    const codes = [];
    for (const f of list) {
      const code = await src(f);
      if (code === null) { kit.ui.toast(tr('missing', { mod: name, file: f }), { type: 'bad', ms: 6000 }); return false; }
      codes.push([f, code]);
    }
    for (let i = B.loadErrors.length - 1; i >= 0; i--) if (B.loadErrors[i].mod === name) B.loadErrors.splice(i, 1);
    K.unload(name);
    for (const [f, code] of codes) B.runMod(name, f, code);
    B.log('[modder-tools] loaded again:', name);
    // an error while loading or starting (starting is right away: the engine runs)
    setTimeout(kit.guard(() => {
      const st = K.status().find(s => s.name === name), e = st && st.error;
      if (e) K.toast(tr('error', { mod: name, where: e.file ? tr('line', { file: e.file, line: e.line }) : e.message }) + (e.file ? '\n' + e.message : ''), { type: 'bad', ms: 9000 });
      else kit.ui.toast(tr('again', { mod: name }), { type: 'good', ms: 2500 });
    }), 50);
    return true;
  }

  // the times of the mod files, every second while the option is on; the first look only remembers them
  let known = null, busy = false;
  async function poll() {
    if (!on()) { known = null; return; }
    if (busy) return;
    busy = true;
    try {
      const st = await B.api('modstat');
      const files = (st && st.files) || {};
      if (known) {
        const changed = new Set();
        for (const [f, t] of Object.entries(files)) if (known[f] !== t && !SKIP.has(f)) changed.add(modOf(f));
        known = files;
        for (const name of changed) await reload(name, files);
      } else known = files;
    } catch (e) {
      B.log('[modder-tools] watching the files:', e && e.message);
    } finally {
      busy = false;
    }
  }
  const timer = setInterval(poll, 1000);
  kit.onStop(() => clearInterval(timer));

  globalThis.__bdtModderTools = { reload: (name) => B.api('modstat').then(s => reload(name, (s && s.files) || {})) };
  kit.onStop(() => { delete globalThis.__bdtModderTools; });
});
