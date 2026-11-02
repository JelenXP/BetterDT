// Chip compare – in the device designer, a CPU or GPU can be compared with another one side by side.
//
// "Compare" next to the CPU MODEL (or GPU MODEL) selector pins the chosen chip as A. Then the usual arrows choose
// another one (B, a model of a manufacturer, a custom one or an own one: "Use my CPU" too), and a panel over the
// device picture shows both like "Request a custom CPU" does: each parameter as "A >> B" with the change in %, the
// designer's bars (POWER, PERFORMANCE, …) and the production cost of the device. "Pin this" pins B instead, ✕ ends
// it. The comparison only reads: the device keeps what is chosen now.
//
// The parameters come from the game's own chip readers (getLaptopChipSpecBars, getChipSpecBars, …: the chosen chip,
// whatever its source), the bars from the variables the designer draws them from (Processor_Power, …), the cost from
// DeviceCostPrice; the labels are the game's texts. The open section is found by the model name the game shows in
// it (ProcessorModel_Text, GraphicProcessorModel_Text), so it works the same in every device and language.
BetterDTKit.mod('chip-compare', {
  needs: {
    vars: ['DeviceType', 'ProcessorModel_Text', 'GraphicProcessorModel_Text', 'DeviceCostPrice', 'Processor_Power'],
    objects: ['Text', 'ArrayLanguage'],
    check: () => !globalThis.BDTChipCompareCore ? 'lib-chip-compare-core.js' : '',
  },
}, (rt, kit) => {
  const C = globalThis.BDTChipCompareCore, gv = rt.globalVars;
  const num = (v) => (typeof v === 'number' ? v : Number(v));
  const lang = () => { const l = Math.round(num(gv.LanguageChoose)); return l >= 0 && l < 15 ? l : 0; };
  // en, ru, de, fr, it, es, hi, tr, pt, uk, id, pl, zh, ko, ja
  const TXT = {
    compare: ['Compare', 'Сравнить', 'Vergleichen', 'Comparer', 'Confronta', 'Comparar', 'तुलना', 'Karşılaştır', 'Comparar',
      'Порівняти', 'Bandingkan', 'Porównaj', '对比', '비교', '比較'],
    pin: ['Pin this', 'Закрепить этот', 'Diesen anheften', 'Épingler celui-ci', 'Fissa questo', 'Fijar este', 'इसे पिन करें',
      'Bunu sabitle', 'Fixar este', 'Закріпити цей', 'Sematkan ini', 'Przypnij ten', '固定这个', '이것 고정', 'これを固定'],
    title: ['Comparison', 'Сравнение', 'Vergleich', 'Comparaison', 'Confronto', 'Comparación', 'तुलना', 'Karşılaştırma', 'Comparação',
      'Порівняння', 'Perbandingan', 'Porównanie', '对比', '비교', '比較'],
    pinned: ['Pinned', 'Закреплён', 'Angeheftet', 'Épinglé', 'Fissato', 'Fijado', 'पिन किया', 'Sabitlenen', 'Fixado',
      'Закріплений', 'Disematkan', 'Przypięty', '已固定', '고정됨', '固定中'],
    now: ['Chosen now', 'Выбран сейчас', 'Jetzt gewählt', 'Choisi', 'Scelto ora', 'Elegido ahora', 'अभी चुना', 'Şu an seçili', 'Escolhido agora',
      'Обраний зараз', 'Dipilih sekarang', 'Wybrany teraz', '当前选择', '현재 선택', '現在の選択'],
    hint: ['Choose another model with the arrows to compare it with the pinned one',
      'Выберите стрелками другую модель, чтобы сравнить её с закреплённой',
      'Wähle mit den Pfeilen ein anderes Modell, um es mit dem angehefteten zu vergleichen',
      'Choisissez un autre modèle avec les flèches pour le comparer à celui épinglé',
      'Scegli un altro modello con le frecce per confrontarlo con quello fissato',
      'Elige otro modelo con las flechas para compararlo con el fijado',
      'पिन किए गए मॉडल से तुलना के लिए तीरों से दूसरा मॉडल चुनें',
      'Sabitlenenle karşılaştırmak için oklarla başka bir model seç',
      'Escolha outro modelo com as setas para compará-lo com o fixado',
      'Оберіть стрілками іншу модель, щоб порівняти її із закріпленою',
      'Pilih model lain dengan panah untuk membandingkannya dengan yang disematkan',
      'Wybierz strzałkami inny model, aby porównać go z przypiętym',
      '用箭头选择另一个型号，与已固定的进行对比',
      '화살표로 다른 모델을 골라 고정한 모델과 비교하세요',
      '矢印で別のモデルを選ぶと、固定したモデルと比較できます'],
    cost: ['Production cost', 'Себестоимость', 'Herstellungskosten', 'Coût de production', 'Costo di produzione', 'Costo de producción',
      'उत्पादन लागत', 'Üretim maliyeti', 'Custo de produção', 'Собівартість', 'Biaya produksi', 'Koszt produkcji', '生产成本', '생산 비용', '製造コスト'],
    close: ['End the comparison', 'Закончить сравнение', 'Vergleich beenden', 'Terminer la comparaison', 'Termina il confronto',
      'Terminar la comparación', 'तुलना समाप्त करें', 'Karşılaştırmayı bitir', 'Encerrar a comparação', 'Завершити порівняння',
      'Akhiri perbandingan', 'Zakończ porównanie', '结束对比', '비교 종료', '比較を終了'],
  };
  const tr = (k) => TXT[k][lang()] || TXT[k][0];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const plain = (s) => String(s || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();

  // the game's labels of the parameters, by their English text
  const labelRow = new Map();
  function gameLabel(en) {
    const L = rt.objects.ArrayLanguage.getFirstInstance();
    if (!L) return en;
    if (!labelRow.has(en)) {
      let row = -1;
      for (let y = 0; y < L.height; y++) if (String(L.getAt(0, y)).trim() === en) { row = y; break; }
      labelRow.set(en, row);
    }
    const row = labelRow.get(en);
    return row >= 0 ? plain(L.getAt(lang(), row)) || en : en;
  }

  // the chosen chip's parameters: the game's reader of the device
  const READER = { SMARTPHONE: 'getChipSpecBars', TABLET: 'getChipSpecBars', LAPTOP: 'getLaptopChipSpecBars', WATCHES: 'getWatchesChipSpecBars',
    TV: 'getTVChipSpecBars', CONSOLE: 'getConsoleChipSpecBars', VR: 'getVRChipSpecBars' };
  // the phone readers (phones, tablets, watches, VR) give the texture fill rate as gTex; laptops and consoles their TMUs
  const TEX_IS_FILL = new Set(['SMARTPHONE', 'TABLET', 'WATCHES', 'VR']);
  function values() {
    const dev = String(gv.DeviceType), fn = globalThis[READER[dev] || ''];
    if (typeof fn !== 'function') return null;
    let v = null;
    try { const r = fn(rt); v = r && r.values ? { ...r.values } : null; } catch { return null; }
    if (v && TEX_IS_FILL.has(dev) && 'gTex' in v) { if (!('gFill' in v)) v.gFill = v.gTex; delete v.gTex; }
    return v;
  }
  const BAR_VARS = ['Processor_Power', 'Processor_Perfomance', 'Processor_Gaming', 'Processor_Energy'];
  // the chip's name: manufacturer, series and the model where the section has one (a phone chooses its chip by series,
  // its model variable keeps an old value)
  const VARS = { cpu: ['Processor_Text', 'ProcessorSeries_Text', 'ProcessorModel_Text'],
    gpu: ['GraphicProcessor_Text', 'GraphicProcessorSeries_Text', 'GraphicProcessorModel_Text'] };
  const name = (s) => VARS[s.kind].slice(0, s.model ? 3 : 2).map((k) => plain(gv[k])).filter(Boolean).join(' ');
  const snapshot = (s) => ({ name: name(s), values: values(), bars: BAR_VARS.map((k) => num(gv[k])), cost: num(gv.DeviceCostPrice) });

  // the open CPU or GPU section: the model name the game shows in it, else the series name (the last selector)
  const visible = (i) => i && i.isVisible && i.layer && i.layer.isVisible;
  function section() {
    const want = { cpu: plain(gv[VARS.cpu[2]]), cpu2: plain(gv[VARS.cpu[1]]), gpu: plain(gv[VARS.gpu[2]]), gpu2: plain(gv[VARS.gpu[1]]) };
    const found = {};
    for (const i of rt.objects.Text.getAllInstances()) {
      if (!visible(i) || !/^UI \(Top\)/.test(i.layer.name)) continue;
      const t = plain(i.text);
      for (const k of ['cpu', 'gpu', 'cpu2', 'gpu2']) if (want[k] && t === want[k] && !found[k]) found[k] = i;
    }
    for (const kind of ['cpu', 'gpu']) {
      if (found[kind]) return { kind, inst: found[kind], model: true };
      if (found[kind + 2]) return { kind, inst: found[kind + 2], model: false };
    }
    return null;
  }
  // the designer's bar labels, top to bottom
  function barLabels() {
    const t = rt.objects.Text.getAllInstances().filter((i) => visible(i) && i.layer.name === 'UI ALL' && plain(i.text));
    return t.sort((a, b) => a.y - b.y).slice(0, 4).map((i) => plain(i.text));
  }
  // a message of the game over the screen darkens it: then nothing of ours is shown
  let shade = null;
  function shaded() {
    try {
      if (!shade || rt.getInstanceByUid(shade.uid) !== shade) shade = rt.objects.TiledBackground3.getAllInstances().find((i) => i.layer && i.layer.name === 'EDITOR NOTIFICATION') || null;
    } catch { shade = null; }
    return !!(shade && visible(shade) && shade.opacity > 0.01);
  }

  kit.ui.css(`
#bdt-cc-btn { position: fixed; z-index: 6; transform: translate(0, -50%); display: flex; align-items: center; gap: .4em; box-sizing: border-box;
  height: calc(var(--bdt-s, 1) * 46px); padding: 0 calc(var(--bdt-s, 1) * 16px); border-radius: calc(var(--bdt-s, 1) * 10px); cursor: pointer;
  color: #fff; white-space: nowrap; user-select: none; text-transform: uppercase; letter-spacing: .05em;
  font: calc(var(--bdt-s, 1) * 22px)/1 "SofiaSansExtraCondensed-Bold", Oswald, sans-serif;
  background: linear-gradient(165deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.14) 55%, rgba(255,255,255,0.10) 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.26), inset 0 1px 0 rgba(255,255,255,0.30); transition: filter .15s ease; }
#bdt-cc-btn:hover { filter: brightness(1.15); box-shadow: inset 0 0 0 2px rgba(255,255,255,0.65); }
#bdt-cc { position: fixed; z-index: 6; box-sizing: border-box; overflow: auto; color: #fff;
  padding: calc(var(--bdt-s, 1) * 16px) calc(var(--bdt-s, 1) * 20px); border-radius: calc(var(--bdt-s, 1) * 16px);
  font: calc(var(--bdt-s, 1) * 21px)/1.25 SofiaSansExtraCondensed-Medium, Oswald, "Segoe UI", sans-serif;
  background: rgba(12, 15, 22, .80); border: 1px solid rgba(255,255,255,.14); box-shadow: 0 14px 40px -12px rgba(0,0,0,.7); backdrop-filter: blur(6px); }
#bdt-cc .bdt-cc-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .45em;
  font: calc(var(--bdt-s, 1) * 28px)/1 "SofiaSansExtraCondensed-Bold", Oswald, sans-serif; letter-spacing: .05em; text-transform: uppercase; }
#bdt-cc .bdt-cc-x { cursor: pointer; opacity: .75; padding: 0 .2em; }
#bdt-cc .bdt-cc-x:hover { opacity: 1; }
#bdt-cc table { width: 100%; border-collapse: collapse; }
#bdt-cc td { padding: .22em .3em; border-top: 1px solid rgba(255,255,255,.08); white-space: nowrap; }
#bdt-cc td.bdt-cc-l { color: rgba(255,255,255,.7); white-space: normal; font-size: .9em; text-transform: uppercase; }
#bdt-cc td.bdt-cc-v { text-align: right; }
#bdt-cc td.bdt-cc-s { text-align: center; opacity: .55; }
#bdt-cc td.bdt-cc-d { text-align: right; font-family: "SofiaSansExtraCondensed-Bold", Oswald, sans-serif; }
#bdt-cc tr.bdt-cc-names td { border-top: 0; font-family: "SofiaSansExtraCondensed-Bold", Oswald, sans-serif; white-space: normal; vertical-align: bottom; }
#bdt-cc tr.bdt-cc-names small { display: block; font-family: SofiaSansExtraCondensed-Medium, Oswald, sans-serif; opacity: .6; text-transform: uppercase; font-size: .8em; }
#bdt-cc tr.bdt-cc-gap td { border-top: 1px solid rgba(255,255,255,.25); }
#bdt-cc .bdt-cc-good { color: #8ee04a; }
#bdt-cc .bdt-cc-bad { color: #ff7b8c; }
#bdt-cc .bdt-cc-hint { margin-top: .6em; opacity: .7; font-size: .9em; }
`);
  const btn = kit.ui.shield(kit.ui.el('div', { id: 'bdt-cc-btn', style: { display: 'none' } }));
  const panel = kit.ui.shield(kit.ui.el('div', { id: 'bdt-cc', style: { display: 'none' } }));

  const pins = { cpu: null, gpu: null };
  let kind = null, now = null, device = '', shown = '', btnText = '';
  btn.addEventListener('click', kit.guard(() => { if (now) { pins[now.kind] = snapshot(now); shown = ''; } }));
  panel.addEventListener('click', kit.guard((ev) => {
    if (ev.target.closest('.bdt-cc-x') && kind) { pins[kind] = null; shown = ''; }
  }));

  const cls = (b) => (b > 0 ? 'bdt-cc-good' : b < 0 ? 'bdt-cc-bad' : '');
  function html(k, a, b) {
    const rows = [`<tr class="bdt-cc-names"><td></td><td class="bdt-cc-v"><small>📌 ${esc(tr('pinned'))}</small>${esc(a.name)}</td><td></td>`
      + `<td class="bdt-cc-v"><small>${esc(tr('now'))}</small>${esc(b.name)}</td><td></td></tr>`];
    const line = (label, r, diff, gap) => rows.push(`<tr${gap ? ' class="bdt-cc-gap"' : ''}><td class="bdt-cc-l">${esc(label)}</td>`
      + `<td class="bdt-cc-v">${esc(r.a)}</td><td class="bdt-cc-s">»</td><td class="bdt-cc-v ${cls(r.better)}">${esc(r.b)}</td>`
      + `<td class="bdt-cc-d ${cls(r.better)}">${esc(diff)}</td></tr>`);
    for (const r of C.params(a.values, b.values, k)) line(gameLabel(r.label), r, r.better || r.pct ? C.signed(r.pct, ' %') : '');
    const labels = barLabels();
    C.bars(a.bars, b.bars).forEach((r, i) => { if (labels[i]) line(labels[i], r, r.better ? C.signed(r.delta) : '', i === 0); });
    const c = C.cost(a.cost, b.cost);
    line(tr('cost'), c, c.better ? C.signed(c.delta).replace(/^([+−])/, '$1$') : '', true);
    const same = a.name === b.name && JSON.stringify(a.values) === JSON.stringify(b.values);
    return `<div class="bdt-cc-head"><span>${esc(tr('title'))}</span><span class="bdt-cc-x" title="${esc(tr('close'))}">✕</span></div>`
      + `<table>${rows.join('')}</table>` + (same ? `<div class="bdt-cc-hint">${esc(tr('hint'))}</div>` : '');
  }

  function hide() { btn.style.display = 'none'; panel.style.display = 'none'; }
  function update() {
    const layout = rt.layout ? rt.layout.name : '';
    const dev = String(gv.DeviceType);
    // a new device or the designer left: the pins go
    if (!/ PAGE /.test(layout) || dev !== device) { pins.cpu = pins.gpu = null; device = dev; }
    const s = / PAGE /.test(layout) && !shaded() ? section() : null;
    kind = s ? s.kind : null;
    now = s;
    if (!s || !READER[dev]) { hide(); return; }
    const canvas = document.querySelector('canvas');
    if (!canvas) { hide(); return; }
    const r = canvas.getBoundingClientRect(), L = s.inst.layer, bb = s.inst.getBoundingBox();
    // right of the model selector (a box of about 470 px centred on the name), in the free column before the picture
    let [bx, by] = L.layerToCssPx((bb.left + bb.right) / 2 + 248, (bb.top + bb.bottom) / 2);
    // the own chip saving (own-chip-savings.js) stands right of the series selector: then the button goes under it
    const note = document.querySelector('.bdt-chip-saving');
    if (note && note.style.display !== 'none') {
      const nr = note.getBoundingClientRect(), h = btn.offsetHeight || r.height * 0.045;
      if (nr.height && by + h / 2 > nr.top && by - h / 2 < nr.bottom) by = nr.bottom + h / 2 + r.height * 0.008;
    }
    const onScreen = by > r.top + r.height * 0.12 && by < r.bottom - r.height * 0.04;
    const label = '📌 ' + tr(pins[kind] ? 'pin' : 'compare');
    if (label !== btnText) { btn.textContent = label; btnText = label; }
    btn.style.left = bx + 'px';
    btn.style.top = by + 'px';
    btn.style.display = onScreen ? '' : 'none';
    const a = pins[kind];
    if (!a) { panel.style.display = 'none'; return; }
    // over the device picture, between the selectors (and the own chip saving next to them) and the bars
    Object.assign(panel.style, { left: r.left + r.width * 0.465 + 'px', top: r.top + r.height * 0.155 + 'px', width: r.width * 0.31 + 'px',
      maxHeight: r.height * 0.78 + 'px', display: '' });
    const out = html(kind, a, snapshot(s));
    if (out !== shown) { panel.innerHTML = out; shown = out; }
  }
  const timer = setInterval(kit.guard(update), 250);
  return () => { clearInterval(timer); hide(); };
});
