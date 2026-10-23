// Inspector – for people who write mods (Settings → BetterDT → Mods, off by default).
//
// With the option on, F9 shows a panel next to the cursor with what is under it: the screen, the game's objects
// (type, UID, layer, position, size, text; the instance variables of the selected one) from the topmost down, and
// the HTML element when the cursor is over the game's HTML; fully transparent objects (click areas, fade overlays)
// come last and are marked. The selected object gets a frame. Keys while the panel
// is shown: ↑ / ↓ select another object under the cursor, Ctrl+C copies the selected object as an entry for
// spec.uids of BetterDTKit (UID, screen, type, layer, size, position), Ctrl+Shift+C copies only its type name,
// F9 hides the panel. These keys do not reach the game; everything else does. No developer tools are involved.
BetterDTKit.mod('dev-inspector', {}, (rt, kit) => {
  const S = BetterDT.settings;
  const enabled = () => S.bool('dev-inspector.on', false);
  const MAX_HITS = 8, MAX_VARS = 12;

  const css = document.createElement('style');
  css.textContent = `
.bdt-insp { position: fixed; z-index: 2147483600; pointer-events: none; max-width: 560px; padding: 10px 12px;
  border-radius: 8px; background: rgba(8, 12, 20, .92); border: 1px solid rgba(255, 255, 255, .18); color: #e8ecf4;
  font: 13px/1.4 Consolas, "Cascadia Mono", monospace; white-space: pre; box-shadow: 0 8px 24px rgba(0, 0, 0, .5); }
.bdt-insp b { color: #ffd34d; font-weight: normal; }
.bdt-insp i { color: #8ea1ff; font-style: normal; }
.bdt-insp u { color: #a8d418; text-decoration: none; }
.bdt-insp s { color: #9aa3b5; text-decoration: none; }
.bdt-insp-box { position: fixed; z-index: 2147483599; pointer-events: none; border: 2px solid #ffd34d;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, .6), inset 0 0 0 1px rgba(0, 0, 0, .6); }`;
  document.head.appendChild(css);
  const panel = Object.assign(document.createElement('div'), { className: 'bdt-insp' });
  const box = Object.assign(document.createElement('div'), { className: 'bdt-insp-box' });

  let shown = false, px = -1, py = -1, frame = 0, hits = [], sel = 0, note = '', noteUntil = 0;
  let types = [], typesAt = 0, typesLayout = '';
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const short = (v, n) => { const t = String(v).replace(/\s+/g, ' '); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const r = (v) => Math.round(Number(v) * 10) / 10;

  // object types with instances on this screen (looked up again on a new screen and every 2 s)
  function liveTypes() {
    const name = rt.layout.name, now = Date.now();
    if (name !== typesLayout || now - typesAt > 2000) {
      types = [];
      for (const n of Object.keys(rt.objects)) {
        try { if (rt.objects[n].getAllInstances().length) types.push(n); } catch { }
      }
      typesLayout = name; typesAt = now;
    }
    return types;
  }
  // the game's objects under the page point x, y: topmost layer first, then by z order; families counted once
  function hitTest(x, y) {
    const layers = rt.layout.getAllLayers(), order = new Map(layers.map((l, i) => [l, i]));
    const seen = new Set(), out = [];
    for (const n of liveTypes()) {
      for (const i of rt.objects[n].getAllInstances()) {
        if (seen.has(i.uid) || typeof i.containsPoint !== 'function' || !i.layer || i.isVisible === false || i.layer.isVisible === false) continue;
        const [lx, ly] = i.layer.cssPxToLayer(x, y);
        if (!i.containsPoint(lx, ly)) continue;
        seen.add(i.uid);
        out.push(i);
      }
    }
    // fully transparent objects (often click areas or fade overlays) after the visible ones
    out.sort((a, b) => (clear(a) - clear(b)) || (order.get(b.layer) - order.get(a.layer)) || ((b.zIndex || 0) - (a.zIndex || 0)));
    return out;
  }
  function htmlPath(el) {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      let p = e.tagName.toLowerCase();
      if (e.id) p += '#' + e.id;
      else if (typeof e.className === 'string' && e.className.trim()) p += '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.');
      parts.unshift(p);
    }
    return parts.join(' > ');
  }
  const clear = (i) => (i.opacity === 0 || i.layer.opacity === 0 ? 1 : 0);
  const typeOf = (i) => (i.objectType && i.objectType.name) || '?';
  // an entry for spec.uids of BetterDTKit
  const uidEntry = (i) => `${i.uid}: { layout: '${rt.layout.name}', t: '${typeOf(i)}', l: '${i.layer.name}', `
    + `w: ${Math.round(i.width)}, h: ${Math.round(i.height)}, x: ${Math.round(i.x)}, y: ${Math.round(i.y)} },`;

  function render() {
    frame = 0;
    if (!shown || px < 0) return;
    let screen = '';
    try { screen = rt.layout.name; hits = hitTest(px, py); } catch (e) { hits = []; }
    if (sel >= hits.length) sel = Math.max(0, hits.length - 1);
    const lines = [`<b>${esc(screen)}</b>  <s>${hits.length} object${hits.length === 1 ? '' : 's'} under the cursor</s>`];
    hits.slice(0, MAX_HITS).forEach((i, k) => {
      const t = i.text !== undefined && i.text !== '' ? `  <u>"${esc(short(i.text, 36))}"</u>` : '';
      lines.push(`${k === sel ? '▶' : ' '} <i>${esc(typeOf(i))}</i> #${i.uid}  <s>${esc(i.layer.name)}</s>  `
        + `${r(i.x)},${r(i.y)} ${r(i.width)}×${r(i.height)}${clear(i) ? '  <s>(transparent)</s>' : ''}${t}`);
    });
    if (hits.length > MAX_HITS) lines.push(`  <s>… ${hits.length - MAX_HITS} more</s>`);
    const cur = hits[sel];
    if (cur) {
      const vars = cur.instVars ? Object.entries(cur.instVars) : [];
      if (vars.length) {
        lines.push('', ...vars.slice(0, MAX_VARS).map(([k, v]) => `  ${esc(k)} = <u>${esc(short(v, 40))}</u>`));
        if (vars.length > MAX_VARS) lines.push(`  <s>… ${vars.length - MAX_VARS} more variables</s>`);
      }
    }
    const el = document.elementFromPoint(px, py);
    if (el && el.tagName !== 'CANVAS' && !panel.contains(el)) lines.push('', `<s>HTML</s> ${esc(htmlPath(el))}`);
    lines.push('', Date.now() < noteUntil ? `<b>${esc(note)}</b>` : '<s>↑↓ select · Ctrl+C copy for spec.uids · Ctrl+Shift+C copy type · F9 hide</s>');
    panel.innerHTML = lines.join('\n');

    // next to the cursor, inside the window
    const w = panel.offsetWidth, h = panel.offsetHeight;
    panel.style.left = (px + 18 + w > innerWidth ? Math.max(4, px - 18 - w) : px + 18) + 'px';
    panel.style.top = (py + 18 + h > innerHeight ? Math.max(4, py - 18 - h) : py + 18) + 'px';
    // the frame around the selected object
    if (cur && typeof cur.getBoundingBox === 'function') {
      const b = cur.getBoundingBox();
      const [x1, y1] = cur.layer.layerToCssPx(b.left, b.top), [x2, y2] = cur.layer.layerToCssPx(b.right, b.bottom);
      Object.assign(box.style, { display: '', left: Math.min(x1, x2) + 'px', top: Math.min(y1, y2) + 'px',
        width: Math.abs(x2 - x1) + 'px', height: Math.abs(y2 - y1) + 'px' });
    } else box.style.display = 'none';
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(kit.guard(render)); };

  function copy(text, what) {
    const done = () => { note = 'Copied: ' + what; noteUntil = Date.now() + 1500; schedule(); };
    const fallback = () => {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { }
      ta.remove(); done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  function show(on) {
    shown = on;
    if (on) { document.body.append(box, panel); schedule(); }
    else { panel.remove(); box.remove(); }
  }

  const onMove = kit.guard((e) => { px = e.clientX; py = e.clientY; if (shown) schedule(); });
  const onKey = kit.guard((e) => {
    if (!enabled()) return;
    let used = true;
    if (e.key === 'F9') show(!shown);
    else if (!shown) used = false;
    else if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, Math.max(0, Math.min(hits.length, MAX_HITS) - 1)); schedule(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); schedule(); }
    else if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && hits[sel]) {
      if (e.shiftKey) copy(typeOf(hits[sel]), typeOf(hits[sel]));
      else copy(uidEntry(hits[sel]), 'uid ' + hits[sel].uid);
    } else used = false;
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
  });
  // the game moves objects under a still cursor too
  const timer = setInterval(() => { if (shown) schedule(); }, 250);
  const offSetting = S.onChange((k) => { if (k === 'dev-inspector.on' && !enabled()) show(false); });
  addEventListener('pointermove', onMove, true);
  addEventListener('keydown', onKey, true);

  return () => {
    removeEventListener('pointermove', onMove, true);
    removeEventListener('keydown', onKey, true);
    clearInterval(timer);
    offSetting();
    if (frame) cancelAnimationFrame(frame);
    show(false);
    css.remove();
  };
});
