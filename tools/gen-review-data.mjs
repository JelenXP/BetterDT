// usage: node tools/gen-review-data.mjs <unpacked game dir> [--list | --groups | --counters]
// Reads the game's event sheets (data.json) and expressions (scripts/c3main.js) and writes
// mod/mods/lib-review-data.js: every aspect of the 16 review functions (DB range, kind, category, the component the
// game compares for a generational aspect), the research categories with a dated component array, the editor list
// counts of those arrays, the 32 actions that store a review rating and the script action of the daily sales.
// The game data comes from `node dtmod.mjs unpack <assets.dat> <dir>`.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/gen-review-data.mjs <unpacked game dir> [--list | --groups | --counters]'); process.exit(2); }
const LIST = process.argv.includes('--list');
const json = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const project = json('data.json').project;
const OBJ = project[3].map(o => o[0]);
const objId = (name) => OBJ.indexOf(name);

// expression sources: C3_ExpressionFuncs in c3main.js
const EXPR = (() => {
  const src = readFileSync(join(dir, 'scripts/c3main.js'), 'utf8');
  const i = src.indexOf('C3_ExpressionFuncs=[') + 'C3_ExpressionFuncs='.length;
  let d = 0, j = i, str = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (str) { if (c === '\\') { j++; continue; } if (c === str) str = null; continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === '[' || c === '(' || c === '{') d++;
    else if (c === ']' || c === ')' || c === '}') { d--; if (d === 0) break; }
  }
  return new Function('return ' + src.slice(i, j + 1))().map(f => f.toString());
})();
const C3MAIN = readFileSync(join(dir, 'scripts/c3main.js'), 'utf8');

// global variables: sid -> name
const VAR = new Map();
(function scan(a) {
  if (!Array.isArray(a)) return;
  // [1, name, type, value, isStatic, isConstant, sid, …]
  if (a[0] === 1 && typeof a[1] === 'string' && typeof a[6] === 'number' && a.length >= 7 && a.length <= 9) VAR.set(a[6], a[1]);
  for (const c of a) if (Array.isArray(c)) scan(c);
})(project[6]);
const varSid = (name) => [...VAR].find(([, n]) => n === name)?.[0];

// events: [type, …, conditions 6, actions 7, sub events 8]; condition params at 9, action params at 6, action sid 3
const isEvent = (e) => Array.isArray(e) && (e[0] === 0 || e[0] === 1);
const arr = (x) => Array.isArray(x) ? x : [];
function findFunc(name, a = project[6]) {
  if (!Array.isArray(a)) return null;
  if (a[0] === 4 && Array.isArray(a[1]) && a[1][0] === name) return a;
  for (const c of a) { const r = findFunc(name, c); if (r) return r; }
  return null;
}
function findGroup(name, a = project[6]) {
  if (!Array.isArray(a)) return null;
  if (a[0] === 3 && Array.isArray(a[1]) && a[1][1] === name) return a;
  for (const c of a) { const r = findGroup(name, c); if (r) return r; }
  return null;
}
function allFuncs(a = project[6], out = []) {
  if (!Array.isArray(a)) return out;
  if (a[0] === 4 && Array.isArray(a[1]) && typeof a[1][0] === 'string') out.push(a);
  for (const c of a) allFuncs(c, out);
  return out;
}
// a number parameter: [0, [exprIndex]] with a constant expression "()=>N"
const constOf = (p) => { const m = Array.isArray(p) && p[0] === 0 && Array.isArray(p[1]) && /^\(\)=>(-?\d+)$/.exec(EXPR[p[1][0]] || ''); return m ? +m[1] : null; };
// an expression parameter: [7, [exprIndex, ...nodes]]
const exprOf = (p) => Array.isArray(p) && p[0] === 7 && Array.isArray(p[1]) ? { src: EXPR[p[1][0]] || '', nodes: p[1].slice(1) } : null;
const exprs = (params) => (params || []).map(exprOf).filter(Boolean);

// ── reviews ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const TYPE = { // review function suffix → [DeviceTypeCreatingNow, simulateDeviceCost type, design array]
  Smartphones: ['SMARTPHONES', 'SMARTPHONE', 'ArraySmartphones'], Tablets: ['TABLETS', 'TABLET', 'ArrayTablets'],
  Laptops: ['LAPTOPS', 'LAPTOP', 'ArrayLaptops'], Watches: ['WATCHES', 'WATCHES', 'ArrayWatches'],
  Headphones: ['HEADPHONES', 'HEADPHONES', 'ArrayHeadphones'], TV: ['TV', 'TV', 'ArrayTV'],
  Scooter: ['SCOOTER', 'SCOOTER', 'ArrayScooters'], Keyboards: ['KEYBOARD', 'KEYBOARD', 'ArrayKeyboards'],
  Consoles: ['CONSOLE', 'CONSOLE', 'ArrayConsoles'], Gamepad: ['GAMEPAD', 'GAMEPAD', 'ArrayGamepads'],
  VR: ['VR CONSOLE', 'VR', 'ArrayVRConsoles'],
  SmartphoneCPU: ['CPU SMARTPHONES', 'MYCPU_SMARTPHONE', 'ArrayMyCPU_SmartphonesEarnings'],
  LaptopCPU: ['CPU LAPTOPS', 'MYCPU_LAPTOP', 'ArrayMyCPU_LaptopsEarnings'],
  ConsoleCPU: ['CPU CONSOLES', 'MYCPU_CONSOLE', 'ArrayMyCPU_ConsolesEarnings'],
  VRCPU: ['CPU VR', 'MYCPU_VR', 'ArrayMyCPU_VREarnings'],
  GPU: ['GPU', 'MYGPU_LAPTOP', 'ArrayMyGPU_LaptopsEarnings'],
};
const DB = json('ArrayReviews/ArrayReviews_DB.json').data;   // [x 0 = min, x 1 = max][index][0]
const ENG = json('ArrayReviews/ArrayReviews_ENG.json').data[0].map(r => String(r[0]));
const dbMin = (i) => Number(DB[0][i][0]), dbMax = (i) => Number(DB[1][i][0]);
const MODEL = varSid('ReviewDeviceNowID');
const TEMP = objId('ArrayReviews_Temp');

// Walks a review function in order. A variable set to <component array>.Width − 1 and then lowered by a For over
// that array (compare of the born column with DayTotal) to the newest row with born day ≤ DayTotal is the newest
// dated row (FunctionID_Max in the smartphone review, other variables in the others); a condition on that variable
// minus a column of the device is the game's generational check.
function reviewAspects(fn, device) {
  const dev = objId(device), out = [];
  let gen = null;   // the variable set last: { sid, obj, array, bornCol }
  const genVars = new Map();
  function walk(e, stack) {
    if (!isEvent(e)) { for (const c of arr(e[8])) walk(c, stack); return; }
    const conds = arr(e[6]), st = stack.concat([conds]);
    for (const c of conds) {
      // For each element of a component array, compare at (loopindex, bornCol) with DayTotal
      const g = gen && gen.arrays.find(x => x.obj === c[0] && x.bornCol === null);
      if (g) {
        const p = c[9] || [];
        const col = constOf(p[1]);
        if (col !== null) g.bornCol = col;
      }
    }
    for (const a of arr(e[7])) {
      const p = a[6] || [];
      // Sys.SetVar <var> = <array>.Width − 1, or ("ON" = device col) ? <array A>.Width − 1 : <array B>.Width − 1
      if (a[0] === -1 && Array.isArray(p[0]) && p[0][0] === 11) {
        const x = exprOf(p[1]), objs = x ? x.nodes.filter(n => Array.isArray(n) && n[0] === 1 && n[2] === 120).map(n => n[1]) : [];
        const choice = x && /^"ON"===t\.ExpObject\(0,n\.GetValue\(\),(\d+)\)\?o\.ExpObject\(\)-1:a\.ExpObject\(\)-1$/.exec(x.src.replace(/^[^]*return\(\)=>/, '').replace(/}$/, ''));
        if (x && choice && objs.length === 2) {
          gen = { sid: p[0][1], arrays: [
            { obj: objs[0], array: OBJ[objs[0]], bornCol: null, when: { col: +choice[1], on: true } },
            { obj: objs[1], array: OBJ[objs[1]], bornCol: null, when: { col: +choice[1], on: false } }] };
          genVars.set(gen.sid, gen);
        } else if (x && /=>[a-z]\.ExpObject\(\)-1}?$/.test(x.src) && objs.length === 1) {
          gen = { sid: p[0][1], arrays: [{ obj: objs[0], array: OBJ[objs[0]], bornCol: null }] };
          genVars.set(gen.sid, gen);
        }
      }
      if (a[0] === TEMP) for (const x of exprs(p)) {
        const m = /Math\.round\(t\((\d+),(\d+)\)\)/.exec(x.src);
        if (m) out.push(classify(+m[1], +m[2], st, genVars, dev));
      }
    }
    for (const c of arr(e[8])) walk(c, st);
  }
  const f = findFunc(fn);
  for (const e of arr(f[8])) walk(e, []);
  return out;
}
function classify(a, b, stack, genVars, dev) {
  const conds = stack.flat();
  const srcs = conds.flatMap(c => exprs(c[9]).map(x => ({ ...x, c })));
  // the device side is the design array (x 0, y model, col) or, for processors and graphics cards, the chip's own
  // array (x 0, col)
  const usesFmax = srcs.find(x => x.nodes.some(n => Array.isArray(n) && n[0] === 3 && genVars.has(n[1]))
    && x.nodes.some(n => Array.isArray(n) && n[0] === 1));
  if (usesFmax) {
    const gen = genVars.get(usesFmax.nodes.find(n => Array.isArray(n) && n[0] === 3 && genVars.has(n[1]))[1]);
    const m = /ExpObject\(0,(?:([a-z])\.GetValue\(\),)?(\d+)\)/.exec(usesFmax.src);
    const devObj = usesFmax.nodes.find(n => Array.isArray(n) && n[0] === 1)[1];
    // copied now: a later assignment of the same variable starts a new gen object
    const arrays = gen.arrays.map(({ array, bornCol, when }) => when ? { array, bornCol, when } : { array, bornCol });
    return { a, b, kind: 'gen', gen: { arrays, src: OBJ[devObj], model: !!(m && m[1]), col: m ? +m[2] : -1 } };
  }
  if (srcs.some(x => /ExpObject\(0,(?:[a-z]\.GetValue\(\)|0),4\),100\)/.test(x.src))) return { a, b, kind: 'price' };
  // the nearest condition that is not the model position decides the aspect's key (for yes/no)
  const key = conds.filter(c => !(c[0] === -1 && JSON.stringify(c[9] && c[9][0]) === JSON.stringify([11, MODEL]))).slice(-1)
    .map(c => JSON.stringify(exprs(c[9]).map(x => x.src + JSON.stringify(x.nodes))))[0] || '';
  return { a, b, kind: 'other', key };
}

const engines = {};
for (const [suffix, [creating, costType, device]] of Object.entries(TYPE)) {
  const fn = 'ReviewsEngine_' + suffix;
  if (!findFunc(fn)) { console.error('missing', fn); process.exit(1); }
  const seen = new Map();
  for (const x of reviewAspects(fn, device)) {
    const k = x.a + '-' + x.b;
    if (!seen.has(k)) seen.set(k, x);
  }
  engines[fn] = { suffix, creating, costType, device, priceCol: 4, costCol: 3, aspects: [...seen.values()] };
}

// ── categories ──────────────────────────────────────────────────────────────────────────────────────────────────────
const CATS = {
  Smartphones: ['display', 'camera', 'video', 'cpu', 'memory', 'battery', 'connectivity', 'sound', 'design', 'features'],
  Tablets: ['display', 'camera', 'video', 'cpu', 'memory', 'battery', 'connectivity', 'sound', 'design', 'features'],
  Laptops: ['display', 'cpu', 'memory', 'battery', 'connectivity', 'sound', 'webcam', 'design', 'features'],
  Watches: ['display', 'memory', 'battery', 'connectivity', 'sound', 'design', 'health'],
  Headphones: ['sound', 'battery', 'connectivity', 'design', 'features'],
  TV: ['picture', 'sound', 'connectivity', 'tvperf', 'design', 'features'],
  Scooter: ['ride', 'range', 'safety', 'comfort', 'smart', 'design'],
  Keyboards: ['keys', 'connectivity', 'design', 'features'],
  Consoles: ['perf', 'memory', 'picture', 'connectivity', 'sound', 'design', 'features'],
  Gamepad: ['controls', 'battery', 'connectivity', 'design', 'features'],
  VR: ['display', 'perf', 'memory', 'tracking', 'connectivity', 'battery', 'sound', 'design', 'features'],
  SmartphoneCPU: ['perf', 'cache', 'heat', 'graphics', 'chipfeat'], LaptopCPU: ['perf', 'cache', 'heat', 'graphics', 'chipfeat'],
  ConsoleCPU: ['perf', 'cache', 'heat', 'graphics', 'chipfeat'], VRCPU: ['perf', 'cache', 'heat', 'graphics', 'chipfeat'],
  GPU: ['perf', 'vram', 'interface', 'tech'],
};
// A generic topic first, from the component array of a generational aspect or else from the English text; then the
// topic is mapped to the categories of the type (TOPIC_MAP; the type's own category of that name otherwise).
const ARRAY_TOPICS = [
  ['tech', /DirectX|OpenCL|OpenGL|Vulkan|DLSS|RayTrasing/],
  ['interface', /PCIe|PowerConnectors/],
  ['graphics', /^ArrayGPU(?!Memory)|AIAccelerator|AIComputePower|ShaderLatency|Graphics[23]D|PhysicalEngine/],
  ['vram', /^ArrayGPUMemory/],
  ['cache', /Cashe|Bandwidth|MemoryBus|MemoryChannels|Interconnect|DataPrefetch/],
  ['heat', /PowerEfficiency|Thermal|CoolingSupport|OperatingTemperature/],
  ['chipfeat', /SecurityEngine|ISP_/],
  ['cpuperf', /^ArrayCPU/],
  ['display', /^ArrayScreen|DimmingTechnology/],
  ['webcam', /FrontalCamera/],
  ['tracking', /^ArrayCamera[A-Za-z]*_VR/],
  ['video', /CameraVideo|CameraSlowMotion/],
  ['camera', /^ArrayCamera/],
  ['memory', /RAM|ROM|MicroSD|DriveSupported|MaxBittrate/],
  ['battery', /Battery|Charging/],
  ['brakes', /Breaks/],
  ['gps', /GPS/],
  ['connectivity', /Bluetooth|Wifi|Network|Ethernet|Port|Connectors|VideoPort/],
  ['sound', /Sound|Acoustic|Headphones_Smartphone|Microphone|Bass|DriverConfiguration|Equalizer|Spatial|NoiseReduction/],
  ['design', /EarFitting/],
  ['cooling', /Cooling/],
  ['features', /Waterproof|SecureSystem|Assistant|Anticheat|Crypting/],
];
// [topic, text, only for these types]
const TEXT_TOPICS = [
  ['cpuperf', /\bSMT\b|multithread|hyper-?thread/i],
  ['design', /lighting|\brgb\b|backlight|illuminat|glow|packag|\bbox\b|colou?r|bezel|border thickness|slim|thick|logo|dimension|body|button placement/i],
  ['range', /range|distance|kilomet|mileage/i, ['Scooter']],
  ['safety', /brake|\blight|lamp|reflector|turn signal|horn|safety|fall|crash|anti-skid|skid|tilt|accident|identification|alarm/i, ['Scooter']],
  ['comfort', /suspension|seat|deck|tyre|tire|wheel|handlebar|comfort|folding|weight|terrain/i, ['Scooter']],
  ['ride', /motor|speed|power|climb|acceleration|torque|parking|cruise/i, ['Scooter']],
  ['smart', /.*/, ['Scooter']],
  ['webcam', /webcam/i],
  ['video', /video|recording|slow-motion|cinematic|footage/i],
  ['camera', /camera|photo|zoom|portrait|night mode|lens|flash|selfie/i, ['Smartphones', 'Tablets', 'Laptops', 'Watches', 'VR']],
  ['battery', /battery|charg|autonomy|runtime/i],
  ['keys', /\bkeys?\b|keycap|switch|typing|keyboard layout|numpad|key travel|macro|anti-ghosting|rollover/i, ['Keyboards']],
  ['controls', /trigger|stick|d-pad|vibration|gyroscope|accelerometer|button|haptic|touchpad|layout|grip/i, ['Gamepad']],
  ['health', /heart|pulse|blood|oxygen|ecg|sleep|fall detection|stress|temperature|fitness|workout|barometer|compass|accelerometer|gyroscope|gps|sensor/i, ['Watches']],
  ['display', /display|screen|resolution|hdr|brightness|pixel|refresh rate|panel|image|picture|contrast/i],
  ['memory', /\bram\b|memory|storage|capacity|microsd|external drive/i],
  ['sound', /speaker|sound|audio|microphone|noise|bass|volume|minijack|headphone|dolby|stereo|hires|voice optimized|dialogue/i],
  ['connectivity', /wi-?fi|bluetooth|5g|4g|lte|network|nfc|usb|port|connector|cable|wireless|signal|\bsim\b|esim|ethernet|hdmi|miracast|cast|peripheral/i],
  ['cpuperf', /processor|cpu|core|performance|clock|frequenc|cooling|heat|thermal|fan/i],
  ['features', /.*/],
];
// topic -> category, per type when it differs from the topic's own name
const TOPIC_MAP = {
  default: { cpuperf: 'cpu', cooling: 'cpu', gps: 'connectivity', brakes: 'features', tracking: 'camera', heat: 'cpu',
    graphics: 'cpu', cache: 'cpu', chipfeat: 'features', webcam: 'camera' },
  Laptops: { camera: 'webcam', video: 'webcam', webcam: 'webcam' },
  Watches: { features: 'health', cpuperf: 'health', heat: 'health', camera: 'health', video: 'health' },
  Headphones: { memory: 'features' },
  TV: { display: 'picture', camera: 'picture', video: 'picture', memory: 'tvperf', cpuperf: 'tvperf', cooling: 'tvperf', graphics: 'tvperf' },
  Scooter: { battery: 'range', brakes: 'safety', gps: 'smart', connectivity: 'smart', features: 'safety', display: 'smart', cpuperf: 'ride', sound: 'smart' },
  Keyboards: { battery: 'connectivity', sound: 'features', display: 'features' },
  Consoles: { display: 'picture', cpuperf: 'perf', cooling: 'perf', graphics: 'perf', camera: 'features' },
  Gamepad: { sound: 'features', display: 'features', cpuperf: 'controls', memory: 'features' },
  VR: { cpuperf: 'perf', cooling: 'perf', graphics: 'perf', camera: 'tracking', video: 'tracking', tracking: 'tracking' },
  chip: { cpuperf: 'perf', cooling: 'heat', features: 'chipfeat', memory: 'cache', display: 'graphics', camera: 'chipfeat', interface: 'chipfeat', tech: 'graphics', price: 'price' },
  GPU: { cpuperf: 'perf', graphics: 'perf', heat: 'perf', cooling: 'perf', memory: 'vram', cache: 'vram', chipfeat: 'tech', features: 'tech' },
};
const OVERRIDES = JSON.parse(readFileSync(join(ROOT, 'tools/review-overrides.json'), 'utf8'));
function topicOf(x, suffix) {
  const arrName = x.gen ? x.gen.arrays[0].array : '';
  if (arrName) for (const [t, re] of ARRAY_TOPICS) if (re.test(arrName)) return t;
  if (x.kind === 'price') return 'price';
  for (const [t, re, only] of TEXT_TOPICS) if ((!only || only.includes(suffix)) && re.test(ENG[x.a])) return t;
  return null;
}
// Aspects of one property are adjacent DB ranges with rising scores: bad, normal, good, or missing, present. They get
// one category (the most common of their own), and a missing/present property is a yes/no aspect.
function groups(aspects) {
  const out = [];
  for (const x of [...aspects].sort((p, q) => p.a - q.a)) {
    const g = out[out.length - 1], prev = g && g[g.length - 1];
    if (prev && prev.kind === x.kind && x.a === prev.b + 1 && dbMin(x.a) > dbMin(prev.a)) g.push(x);
    else out.push([x]);
  }
  return out;
}
const problems = [];
for (const [fn, e] of Object.entries(engines)) {
  const cats = CATS[e.suffix], chip = /CPU$/.test(e.suffix);
  const map = chip ? TOPIC_MAP.chip : { ...TOPIC_MAP.default, ...(TOPIC_MAP[e.suffix] || {}) };
  e.categories = cats;
  for (const x of e.aspects) {
    x.topic = topicOf(x, e.suffix);
    x.cat = x.topic === 'price' ? 'price' : x.topic && (map[x.topic] || x.topic);
  }
  // a missing feature: a lone bad range whose text says so
  const missing = (x) => dbMax(x.b) <= 4 && /\b(no|not|lacks?|without|absent|absence|omits?|missing|unfortunate|cannot|unavailable)\b/i.test(ENG[x.a]);
  for (const g of groups(e.aspects)) {
    const n = new Map();
    for (const x of g) n.set(x.cat, (n.get(x.cat) || 0) + 1);
    const own = OVERRIDES[e.suffix] && OVERRIDES[e.suffix][g[0].a], all = OVERRIDES['*'][g[0].a];
    const cat = own || (all && cats.includes(all) ? all : [...n].sort((p, q) => q[1] - p[1])[0][0]);
    const yesno = g.every(x => x.kind === 'other') && (g.length === 1 ? missing(g[0]) || dbMin(g[0].a) >= 7
      : g.length === 2 && missing(g[0]) && dbMin(g[1].a) >= 7);
    for (const x of g) {
      x.cat = cat;
      if (yesno) x.kind = 'yesno';
      x.group = g[0].a;
    }
  }
  for (const x of e.aspects) {
    if (!x.cat || (x.cat !== 'price' && !cats.includes(x.cat))) problems.push(`${e.suffix} ${x.a}-${x.b} topic ${x.topic} -> ${x.cat} | ${ENG[x.a].slice(0, 100)}`);
  }
}

// ── fixes ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// A DB band: the indexes from i on with the same min and max (the texts of one score).
const band = (i) => { let j = i; while (dbMin(j + 1) === dbMin(i) && dbMax(j + 1) === dbMax(i)) j++; return [i, j]; };
const added = [];
for (const e of Object.values(engines)) {
  // the smartphone feature-load check pushes 234–245 (all loads) where only its good band 243–245 is meant
  for (const x of e.aspects) if (x.a === 234 && x.b === 245) x.a = 243;
  // a generational property whose newest-generation band the game never pushes (it compares with > where ≥ is
  // meant): the band after the property's last one is its 8–10 band
  for (const g of groups(e.aspects)) {
    if (g[0].kind !== 'gen' || g.some(x => dbMin(x.a) >= 8)) continue;
    const last = g[g.length - 1], [a, b] = band(last.b + 1);
    if (e.aspects.some(x => x.a === a)) continue;
    if (dbMin(a) < 8) continue;
    const x = { ...last, a, b, gen: { ...last.gen, arrays: last.gen.arrays.map(y => ({ ...y })) } };
    e.aspects.push(x); added.push(`${e.suffix} ${a}-${b} after ${g[0].a}-${last.b} | ${ENG[a].slice(0, 70)}`);
  }
  // a band missing between two bands of one generational check (TV dimming 997–999, –, 1003–1005)
  const gens = e.aspects.filter(x => x.kind === 'gen').sort((p, q) => p.a - q.a);
  for (let i = 1; i < gens.length; i++) {
    const p = gens[i - 1], q = gens[i];
    if (p.gen.src !== q.gen.src || p.gen.col !== q.gen.col || q.a === p.b + 1) continue;
    const [a, b] = band(p.b + 1);
    if (b !== q.a - 1 || !(dbMin(a) > dbMin(p.a) && dbMin(q.a) > dbMin(a))) continue;
    e.aspects.push({ ...p, a, b, gen: { ...p.gen, arrays: p.gen.arrays.map(y => ({ ...y })) } });
    added.push(`${e.suffix} ${a}-${b} between ${p.a}-${p.b} and ${q.a}-${q.b} | ${ENG[a].slice(0, 70)}`);
  }
  e.aspects.sort((p, q) => p.a - q.a);
  for (const g of groups(e.aspects)) for (const x of g) { x.group = g[0].a; x.cat = g[0].cat; }
}

// ── research ────────────────────────────────────────────────────────────────────────────────────────────────────────
// _CATEGORY_ROWS in c3main.js: { page: [[research id, start day, component array, born column] | [id, start] …] }
function literalAfter(marker) {
  const s = C3MAIN.slice(C3MAIN.indexOf(marker) + marker.length);
  let d = 0, j = 0;
  for (; j < s.length; j++) { const c = s[j]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (!d) break; } }
  return new Function('return ' + s.slice(0, j + 1))();
}
const ROWS = literalAfter('_CATEGORY_ROWS=');
const RESEARCH = json('ArrayResearch.json').data;   // [id] = [[""], [RP cost], [money]]
// the research page: Sys.SetVar <id var> = id, then ArrayResearchPage_Temp at column 1 = ArrayLanguage(lang, nameText)
const nameTexts = new Map();
{
  const ID = 361892595884345, PAGE = objId('ArrayResearchPage_Temp');
  let id = null;
  (function walk(a) {
    if (!Array.isArray(a)) return;
    if (isEvent(a)) {
      for (const act of arr(a[7])) {
        const p = act[6] || [];
        if (act[0] === -1 && Array.isArray(p[0]) && p[0][0] === 11 && p[0][1] === ID) {
          const m = exprOf(p[1]) && /^\(\)=>(\d+)$/.exec(exprOf(p[1]).src);
          id = m ? +m[1] : constOf(p[1]);
        }
        if (act[0] === PAGE && id !== null && constOf(p[1]) === 1) {
          // the name, sometimes wrapped with an icon tag
          const m = exprOf(p[2]) && /ExpObject\([a-z]\.GetValue\(\),(\d+)\)/.exec(exprOf(p[2]).src);
          if (m && !nameTexts.has(id)) nameTexts.set(id, +m[1]);
        }
      }
      for (const c of arr(a[8])) walk(c);
      return;
    }
    for (const c of a) walk(c);
  })(findFunc('Research_ButtonsOpacity')[8]);
}
const research = {};
for (const rows of Object.values(ROWS)) for (const [id, start, array, bornCol] of rows) {
  if (!array) continue;
  const creating = Object.values(engines).filter(e => e.aspects.some(x => x.gen && x.gen.arrays.some(y => y.array === array))).map(e => e.creating);
  research[id] = { array, bornCol, start, cost: Number(RESEARCH[id][1][0]), nameText: nameTexts.get(id) ?? -1, creating: [...new Set(creating)] };
}

// ── editors ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// An editor list of the device designer counts the dated rows of its component array into ArrayFunctionsOpened
// (set to 0, then + 1 for every row with born day ≤ DayTotal) and lists the rows below that count; rows at or above
// the research level are shown locked. counters[array] = the SIDs of the "set to 0" actions of that array's counts.
const counters = {}, counterFns = {};
{
  const AFO = varSid('ArrayFunctionsOpened');
  const setsTo = (act, ace) => act[0] === -1 && act[1] === ace && Array.isArray(act[6]) && Array.isArray(act[6][0]) && act[6][0][0] === 11 && act[6][0][1] === AFO;
  // the component array of the first "+ 1" in a subtree: an object in the conditions above it
  function counted(e, stack) {
    if (!isEvent(e)) { for (const c of arr(e[8])) { const r = counted(c, stack); if (r) return r; } return null; }
    const st = stack.concat(arr(e[6]));
    if (arr(e[7]).some(x => setsTo(x, 102))) {
      for (const c of st.slice().reverse()) {
        const objs = [c[0], ...exprs(c[9]).flatMap(x => x.nodes.filter(n => Array.isArray(n) && n[0] === 1).map(n => n[1]))];
        const o = objs.find(i => i >= 0 && /^Array/.test(OBJ[i] || ''));
        if (o !== undefined) return OBJ[o];
      }
      return null;
    }
    for (const c of arr(e[8])) { const r = counted(c, st); if (r) return r; }
    return null;
  }
  (function walk(list, fn) {
    if (!Array.isArray(list)) return;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!Array.isArray(e)) continue;
      const zero = isEvent(e) && arr(e[7]).find(x => setsTo(x, 34) && constOf(x[6][1]) === 0 || (setsTo(x, 34) && exprOf(x[6][1]) && exprOf(x[6][1]).src === '()=>0'));
      if (zero) {
        // the count is in the same event's sub events or in the next sibling
        const array = counted({ 8: arr(e[8]) }, []) || (list[i + 1] && counted(list[i + 1], []));
        if (array) { (counters[array] ||= []).push(zero[3]); counterFns[zero[3]] = fn; }
      }
      const name = e[0] === 4 && Array.isArray(e[1]) && typeof e[1][0] === 'string' ? e[1][0] : fn;
      for (const c of e) if (Array.isArray(c)) walk(c, name);
    }
  })(project[6], null);
}
const datedArrays = new Set(Object.values(research).map(r => r.array));
for (const k of Object.keys(counters)) if (!datedArrays.has(k)) delete counters[k];

// ── rating writes and the daily sales script ────────────────────────────────────────────────────────────────────────
// the actions that store a review's rating: their expression is the mean of ReviewRating_1..4
const ratingSids = [];
(function walk(a) {
  if (!Array.isArray(a)) return;
  if (isEvent(a)) {
    for (const act of arr(a[7])) if (exprs(act[6]).some(x => /Math\.round\(\(t\.GetValue\(\)\+n\.GetValue\(\)\+o\.GetValue\(\)\+a\.GetValue\(\)\)\/4\)/.test(x.src))) ratingSids.push(act[3]);
    for (const c of arr(a[8])) walk(c);
    return;
  }
  for (const c of a) walk(c);
})(project[6]);
const salesScript = /async ([A-Za-z0-9_]+)\(e,t\)\{tickDeviceSales\(/.exec(C3MAIN)?.[1];

const out = {
  gameVersion: String(project[16]),
  engines: Object.fromEntries(Object.entries(engines).map(([fn, e]) => [fn, {
    suffix: e.suffix, creating: e.creating, costType: e.costType, device: e.device, priceCol: e.priceCol, costCol: e.costCol,
    categories: e.categories,
    aspects: e.aspects.map(({ a, b, kind, cat, group, gen }) => gen ? { a, b, kind, cat, group, gen } : { a, b, kind, cat, group }),
  }])),
  research, counters, ratingSids, salesScript,
  closing: [[2629, 2658], [2659, 2688], [2689, 2718]],
  // design array columns (z) of a released device: rating, release day (the review screen writes them)
  releaseCol: 7, ratingCol: 5,
};
const checks = [];
if (ratingSids.length !== 32) checks.push(`${ratingSids.length} rating writes, expected 32`);
if (!salesScript) checks.push('no sales script');
for (const [id, r] of Object.entries(research)) if (!(r.cost > 0) || r.nameText < 0) checks.push(`research ${id} ${r.array}: cost ${r.cost}, name ${r.nameText}`);
if (!LIST && !process.argv.includes('--groups') && !process.argv.includes('--counters')) {
  writeFileSync(join(ROOT, 'mod/mods/lib-review-data.js'),
    `// Generated by tools/gen-review-data.mjs from game ${out.gameVersion}. Do not edit; change tools/review-overrides.json.\r\n` +
    `globalThis.BDTReviewData = ${JSON.stringify(out)};\r\n`);
  console.log('added bands:\n  ' + added.join('\n  '));
  console.log(Object.keys(research).length, 'research rows,', Object.keys(counters).length, 'editor lists,', ratingSids.length, 'rating writes, sales', salesScript);
}
if (checks.length) { console.error(checks.join('\n')); process.exitCode = 1; }

if (LIST) {
  for (const [fn, e] of Object.entries(engines)) for (const x of e.aspects) {
    console.log(e.suffix, x.cat, x.a + '-' + x.b, dbMin(x.a) + '..' + dbMax(x.b), x.kind,
      x.gen ? x.gen.arrays.map(g => g.array + '/' + g.bornCol + (g.when ? (g.when.on ? '(on' : '(off') + g.when.col + ')' : '')).join('+') + ' ' + x.gen.src + (x.gen.model ? '[m]' : '') + ':' + x.gen.col : '', '|', ENG[x.a].slice(0, 90));
  }
}
export { engines, ENG, dbMin, dbMax, OBJ, EXPR, C3MAIN, project, findFunc, findGroup, allFuncs, exprs, exprOf, isEvent, VAR, varSid, objId, json, ROOT };
if (problems.length) { console.error(problems.join('\n')); console.error(problems.length, 'aspects without a category of their type'); }
if (process.argv.includes('--counters')) {
  for (const [a, sids] of Object.entries(counters)) console.log(a.padEnd(40), sids.map(x => counterFns[x]).join(' '));
}
if (process.argv.includes('--groups')) {
  for (const e of Object.values(engines)) for (const g of groups(e.aspects)) {
    if (g[0].kind === 'price') continue;
    console.log(e.suffix.padEnd(13), g[0].cat.padEnd(12), (g[0].a + '-' + g[g.length - 1].b).padEnd(10), g[0].kind.padEnd(5), ENG[g[0].a].slice(0, 80));
  }
}
