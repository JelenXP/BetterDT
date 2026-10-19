// Update all – UPDATE SOFTWARE screen (MY SOFT UPDATE).
//
// Updating apps means clicking every app, then "Save" in its editor (which already has the next version, e.g.
// 1.0.3 → 1.0.4, and the app's name, platform, monetization and icon), then the next app. A "Select all" button
// next to the game's "Update" does that for every released app that is not selected yet: it clicks the card and the
// editor's "Save" itself, so the version, the price and the level are the game's own. The game's "Update" button
// then updates them all at once (and checks the money), and "×" on a card still takes one out again.
BetterDTKit.mod('update-all', {
  needs: {
    functions: ['initSoftwareUpdatePage', 'updateSoftwareUpdatePage'],
    objects: ['ArrayMySoftware', 'ArrayMySoftware_Temp', 'ArrayMySoftwareChoose'],
    vars: ['Sounds', 'LanguageChoose'],
  },
}, (rt, kit) => {
  if (globalThis.__dtUpdateAll) globalThis.__dtUpdateAll.dispose();

  const LAYOUT = 'MY SOFT UPDATE';
  const gv = rt.globalVars;
  const TXT = {
    all: ['Select all', 'Выбрать все', 'Alle auswählen', 'Tout sélectionner', 'Seleziona tutto', 'Seleccionar todo',
      'सभी चुनें', 'Tümünü seç', 'Selecionar tudo', 'Обрати всі', 'Pilih semua', 'Zaznacz wszystko', '全选', '모두 선택', 'すべて選択'],
    hint: ['Select every app for the update (next version, same settings)',
      'Выбрать все приложения для обновления (следующая версия, те же настройки)',
      'Alle Apps für das Update auswählen (nächste Version, gleiche Einstellungen)',
      'Sélectionner toutes les applications pour la mise à jour (version suivante, mêmes réglages)',
      "Seleziona tutte le app per l'aggiornamento (versione successiva, stesse impostazioni)",
      'Seleccionar todas las aplicaciones para actualizar (siguiente versión, mismos ajustes)',
      'अपडेट के लिए सभी ऐप चुनें (अगला संस्करण, वही सेटिंग्स)',
      'Tüm uygulamaları güncelleme için seç (sonraki sürüm, aynı ayarlar)',
      'Selecionar todos os apps para a atualização (próxima versão, mesmas configurações)',
      'Обрати всі застосунки для оновлення (наступна версія, ті самі налаштування)',
      'Pilih semua aplikasi untuk diperbarui (versi berikutnya, pengaturan sama)',
      'Zaznacz wszystkie aplikacje do aktualizacji (następna wersja, te same ustawienia)',
      '选中所有应用进行更新（下一版本，设置不变）', '모든 앱을 업데이트 대상으로 선택 (다음 버전, 같은 설정)',
      'すべてのアプリを更新対象に選択（次のバージョン、同じ設定）'],
  };
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const tr = (k) => TXT[k][lang()] || TXT[k][0];
  const layoutName = () => { try { return rt.layout.name; } catch { return ''; } };

  const css = document.createElement('style');
  css.id = 'bdt-update-all-css';
  // the size of the game's "Update" button (#swc-create), as a quieter second button
  css.textContent = `
#bdt-swc-all { flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
  height: calc(var(--rs,1) * 62px); padding: 0 calc(var(--rs,1) * 26px); margin-right: calc(var(--rs,1) * 14px);
  border-radius: calc(var(--rs,1) * 14px); border: calc(var(--rs,1) * 2px) solid rgba(140,194,96,0.85);
  background: rgba(49,149,82,0.18); color: #fff; cursor: pointer;
  font-family: 'SofiaSansExtraCondensed-Bold','Oswald',sans-serif; font-size: calc(var(--rs,1) * 30px);
  letter-spacing: calc(var(--rs,1) * 0.8px); transition: filter 0.15s ease, transform 0.12s ease, opacity 0.15s ease; }
#bdt-swc-all:hover:not(:disabled) { filter: brightness(1.2); }
#bdt-swc-all:active:not(:disabled) { transform: scale(0.98); }
#bdt-swc-all:disabled { opacity: 0.4; cursor: default; }`;
  document.head.appendChild(css);

  const root = () => document.querySelector('#swc-root');
  // released apps that are not selected yet (the game's card classes on the update page)
  const open = () => [...document.querySelectorAll('#swc-grid .swc-card.is-open:not(.is-chosen)')];

  let busy = false;
  function selectAll() {
    if (busy) return;
    busy = true;
    const sounds = gv.Sounds;
    gv.Sounds = 'OFF';
    let n = 0, stop = '';
    try {
      for (let guard = 0; guard < 60; guard++) {
        const card = open()[0];
        if (!card) break;
        card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const save = document.querySelector('#swc-modal.is-open .swc-btn.is-primary');
        if (!save) { stop = 'the app editor did not open'; break; }
        save.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        // Save re-renders the grid; the same card must now be selected
        if (document.querySelector('#swc-modal.is-open')) { stop = 'the app editor did not save'; break; }
        n++;
      }
    } finally {
      gv.Sounds = sounds;
      busy = false;
    }
    BetterDT.log('[update-all] selected', n, 'apps', stop ? '– stopped: ' + stop : '');
    if (stop) {
      document.querySelector('#swc-modal.is-open .swc-btn:not(.is-primary)')?.click();
      kit.fail(stop);
    }
    if (n) globalThis.tapMain?.();
    paint();
  }

  let btn = null;
  function paint() {
    if (btn) btn.disabled = busy || open().length === 0;
  }
  const tick = kit.guard(() => {
    const top = layoutName() === LAYOUT && root() && root().querySelector('#swc-top');
    if (!top) { btn?.remove(); btn = null; return; }
    if (!btn || !btn.isConnected) {
      btn = document.createElement('button');
      btn.id = 'bdt-swc-all';
      btn.type = 'button';
      btn.addEventListener('click', kit.guard(selectAll));
      top.insertBefore(btn, top.querySelector('#swc-create'));
    }
    btn.textContent = tr('all');
    btn.title = tr('hint');
    paint();
  });
  const timer = setInterval(tick, 300);
  tick();

  const dispose = () => { clearInterval(timer); btn?.remove(); css.remove(); };
  globalThis.__dtUpdateAll = { dispose };
  return dispose;
});
