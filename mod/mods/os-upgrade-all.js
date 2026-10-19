// Select all – OS upgrade screen (MY OS UPGRADE).
//
// An OS upgrade lists about 35 technologies, and each one has to be clicked to go into the update. A "Select all"
// button above the list clicks every technology that is not selected yet, through the game's own click handler, so
// the game adds up the price and the rating itself, exactly as if each card had been clicked. When everything is
// selected, the same button ("Clear all") takes them all out again. Single cards can still be clicked as before.
BetterDTKit.mod('os-upgrade-all', {
  needs: {
    functions: ['initMyOSTechnologies', 'refreshMyOSTechnologies'],
    objects: ['ArrayMyOsChoose'],
    vars: ['Sounds', 'LanguageChoose'],
  },
}, (rt, kit) => {
  if (globalThis.__dtOsUpgradeAll) globalThis.__dtOsUpgradeAll.dispose();

  const LAYOUT = 'MY OS UPGRADE';
  const gv = rt.globalVars;
  const TXT = {
    all: ['Select all', 'Выбрать все', 'Alle auswählen', 'Tout sélectionner', 'Seleziona tutto', 'Seleccionar todo',
      'सभी चुनें', 'Tümünü seç', 'Selecionar tudo', 'Обрати всі', 'Pilih semua', 'Zaznacz wszystko', '全选', '모두 선택', 'すべて選択'],
    none: ['Clear all', 'Снять все', 'Alle abwählen', 'Tout désélectionner', 'Deseleziona tutto', 'Quitar todo',
      'सभी हटाएँ', 'Tümünü kaldır', 'Desmarcar tudo', 'Зняти всі', 'Hapus semua', 'Odznacz wszystko', '全部取消', '모두 해제', 'すべて解除'],
  };
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const tr = (k) => TXT[k][lang()] || TXT[k][0];
  const layoutName = () => { try { return rt.layout.name; } catch { return ''; } };

  const css = document.createElement('style');
  css.id = 'bdt-os-upgrade-all-css';
  // a bar above the first category, the button in the colours of the game's selected cards
  css.textContent = `
#bdt-mostech-bar { display: flex; justify-content: flex-end; margin: 0 0 6px; }
#bdt-mostech-all { display: flex; align-items: center; justify-content: center;
  height: 46px; padding: 0 24px;
  border-radius: 12px; border: 2px solid rgba(140,194,96,0.85);
  background: rgba(49,149,82,0.25); color: #fff; cursor: pointer;
  font-family: 'SofiaSansExtraCondensed-Bold','Oswald',sans-serif; font-size: 26px;
  letter-spacing: 0.8px; transition: filter 0.15s ease, transform 0.12s ease; }
#bdt-mostech-all.is-clear { border-color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.08); }
#bdt-mostech-all:hover { filter: brightness(1.2); }
#bdt-mostech-all:active { transform: scale(0.98); }`;
  document.head.appendChild(css);

  const root = () => document.querySelector('#mostech-root');
  const cards = () => [...(root()?.querySelectorAll('.mostech-card') || [])];
  const unselected = () => cards().filter(c => !c.classList.contains('is-selected'));

  function toggleAll() {
    const all = cards();
    if (!all.length) return;
    const free = unselected();
    // everything selected → take everything out again
    const todo = free.length ? free : all;
    const sounds = gv.Sounds;
    gv.Sounds = 'OFF';
    try {
      for (const c of todo) c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } finally {
      gv.Sounds = sounds;
    }
    const left = unselected().length;
    if (free.length ? left : left !== all.length) kit.fail('the cards did not react to clicks');
    BetterDT.log('[os-upgrade-all]', free.length ? 'selected' : 'cleared', todo.length, 'technologies');
    globalThis.tapMain?.();
    paint();
  }

  let bar = null, btn = null;
  function paint() {
    if (!btn) return;
    const clear = cards().length > 0 && unselected().length === 0;
    btn.textContent = tr(clear ? 'none' : 'all');
    btn.classList.toggle('is-clear', clear);
  }
  const tick = kit.guard(() => {
    const r = layoutName() === LAYOUT && root();
    // only on the technologies view (the game renders the other views into the same root)
    if (!r || !r.querySelector('.mostech-section')) { bar?.remove(); bar = btn = null; return; }
    if (!bar || bar.parentNode !== r) {
      bar = document.createElement('div');
      bar.id = 'bdt-mostech-bar';
      btn = document.createElement('button');
      btn.id = 'bdt-mostech-all';
      btn.type = 'button';
      // the game's click handler on the root must not see this click
      btn.addEventListener('click', kit.guard((e) => { e.stopPropagation(); toggleAll(); }));
      bar.appendChild(btn);
      r.insertBefore(bar, r.firstChild);
    }
    paint();
  });
  const timer = setInterval(tick, 300);
  tick();

  const dispose = () => { clearInterval(timer); bar?.remove(); css.remove(); };
  globalThis.__dtOsUpgradeAll = { dispose };
  return dispose;
});
