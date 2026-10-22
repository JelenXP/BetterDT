// Auto continue – the game's NEWS dialog when it has a single OK button.
//
// To the right of OK (which stays exactly where the game puts it) a checkbox "Auto continue". When it is on, the
// dialog closes by itself a few seconds (3 by default, Settings → BetterDT → Mods) after the game has finished
// typing its text, the same as a click on OK; a small ring next to the checkbox fills up meanwhile. OK can still be
// clicked any time.
// Dialogs with two buttons (a choice) or without buttons are never closed. Unchecking the box stops the countdown
// of the open dialog, and so does a click anywhere else in the dialog: then it waits for OK as usual.
BetterDTKit.mod('auto-continue', {
  needs: { functions: ['showOfficeNews', 'hideOfficeNews'] },
}, (rt, kit) => {
  if (globalThis.__dtAutoContinue) globalThis.__dtAutoContinue.dispose();

  const S = BetterDT.settings;
  const gv = rt.globalVars;
  const LABEL = ['Auto continue', 'Автопродолжение', 'Automatisch weiter', 'Continuer auto', 'Continua auto', 'Continuar auto',
    'स्वतः जारी', 'Otomatik devam', 'Continuar auto', 'Автопродовження', 'Lanjut otomatis', 'Auto dalej', '自动继续', '자동 계속', '自動で続行'];
  const lang = () => { const l = Math.round(+gv.LanguageChoose); return l >= 0 && l < 15 ? l : 0; };
  const enabled = () => S.bool('auto-continue.on', false);
  const delay = () => Math.min(10, Math.max(1, S.num('auto-continue.secs') || 3)) * 1000;

  const css = document.createElement('style');
  css.id = 'bdt-auto-continue-css';
  // the dialog lives in design pixels (the game scales the whole panel), like the game's own rules
  css.textContent = `
#office-news-buttons { position: relative; }
.bdt-ac { position: absolute; top: 50%; transform: translateY(-50%); display: none; align-items: center; gap: 9px;
  font-family: inherit; font-size: 19px; line-height: 1; color: rgba(255,255,255,0.85); white-space: nowrap;
  cursor: pointer; user-select: none; }
#office-news-overlay.on-single .bdt-ac { display: flex; }
.bdt-ac input { appearance: none; -webkit-appearance: none; margin: 0; flex: none; width: 22px; height: 22px;
  border-radius: 6px; border: 2px solid rgba(255,255,255,0.65); background: rgba(255,255,255,0.06); cursor: pointer;
  display: grid; place-items: center; transition: background 0.15s ease, border-color 0.15s ease; }
.bdt-ac input:checked { background: linear-gradient(180deg, #a8d418 0%, #63b303 100%); border-color: transparent; }
.bdt-ac input:checked::after { content: ''; width: 6px; height: 11px; margin-top: -3px; border: solid #fff;
  border-width: 0 3px 3px 0; transform: rotate(45deg); }
.bdt-ac:hover input { border-color: #fff; }
.bdt-ac-ring { flex: none; width: 18px; height: 18px; border-radius: 50%; visibility: hidden;
  background: conic-gradient(#a8d418 calc(var(--p, 0) * 1turn), rgba(255,255,255,0.18) 0);
  -webkit-mask: radial-gradient(circle, transparent 5px, #000 5.5px); mask: radial-gradient(circle, transparent 5px, #000 5.5px); }
.bdt-ac.bdt-ac-run .bdt-ac-ring { visibility: visible; }
`;
  document.head.appendChild(css);

  let ov = null, ui = null;
  // the dialog that is open: its text (a new one replaces the spans), whether its countdown was stopped
  let cur = null, stopped = false, elapsed = 0, last = 0, done = false;

  function onPointer(e) {
    if (!ui || ui.label.contains(e.target) || e.target.closest('#office-news-btn-1')) return;
    // a click anywhere else in the dialog: read it in peace, OK is up to you
    stopped = true;
    paint();
  }
  function attach(o) {
    if (ov) ov.removeEventListener('pointerdown', onPointer, true);
    ov = o; ui = null; cur = null;
    const bar = o && o.querySelector('#office-news-buttons');
    if (!bar) return;
    o.querySelector('.bdt-ac')?.remove();
    const label = document.createElement('label');
    label.className = 'bdt-ac';
    label.innerHTML = '<input type="checkbox"><span class="bdt-ac-text"></span><span class="bdt-ac-ring"></span>';
    bar.appendChild(label);
    const box = label.querySelector('input');
    box.checked = enabled();
    box.addEventListener('change', kit.guard(() => {
      Promise.resolve(S.set('auto-continue.on', box.checked)).catch(e => console.error('[auto-continue] save', e));
      // checked: this dialog counts down from the start; unchecked: it stays open
      stopped = !box.checked; elapsed = 0;
      paint();
    }));
    o.addEventListener('pointerdown', onPointer, true);
    ui = { label, box, text: label.querySelector('.bdt-ac-text'), ring: label.querySelector('.bdt-ac-ring'), lang: -1 };
  }
  function paint() {
    if (!ui) return;
    const run = enabled() && !stopped && !done;
    ui.label.classList.toggle('bdt-ac-run', run);
    ui.ring.style.setProperty('--p', run ? Math.min(1, elapsed / delay()).toFixed(3) : '0');
  }

  function tick() {
    const o = document.getElementById('office-news-overlay');
    if (o !== ov) attach(o);
    if (!ui) return;
    if (ui.lang !== lang()) { ui.lang = lang(); ui.text.textContent = LABEL[ui.lang]; }
    if (ui.box.checked !== enabled()) ui.box.checked = enabled();
    const now = performance.now(), dt = now - last;
    last = now;
    const shown = ov.classList.contains('on-shown') && !ov.classList.contains('on-closing');
    if (!shown || !ov.classList.contains('on-single')) { cur = null; return; }
    const ok = ov.querySelector('#office-news-btn-1');
    ui.label.style.left = (ok.offsetLeft + ok.offsetWidth + 28) + 'px';
    // a new dialog (also one that replaced the open one): the game builds its text again
    const text = ov.querySelector('#office-news-text');
    const first = text && text.firstChild;
    if (cur !== first) { cur = first; stopped = false; elapsed = 0; done = false; }
    // counted once the game has typed the whole text
    const typing = !!(text && text.querySelector('.onw-ch:not(.on)'));
    if (enabled() && !stopped && !done && !typing) elapsed += Math.min(dt, 250);
    if (!done && enabled() && !stopped && elapsed >= delay()) {
      done = true;
      ok.click();
    }
    paint();
  }
  last = performance.now();
  const timer = setInterval(kit.guard(tick), 50);
  tick();

  const dispose = () => {
    clearInterval(timer);
    if (ov) ov.removeEventListener('pointerdown', onPointer, true);
    document.querySelectorAll('.bdt-ac').forEach(e => e.remove());
    css.remove();
  };
  globalThis.__dtAutoContinue = { dispose };
  return dispose;
});
