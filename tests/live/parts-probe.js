// Own parts probe (test copy, nothing kept): what parts-reviews.js and own-chip-savings.js rely on.
const gv = rt.globalVars, out = {};
const arr = (n) => rt.objects[n] && rt.objects[n].getFirstInstance();
const dump = (a, w = 40, h = 12, d = 1) => {
  const r = [];
  for (let x = 0; x < Math.min(a.width, w); x++) {
    const row = [];
    for (let y = 0; y < Math.min(a.height, h); y++) {
      row.push(d > 1 ? [...Array(Math.min(a.depth, d)).keys()].map(z => a.getAt(x, y, z)) : a.getAt(x, y));
    }
    r.push(row);
  }
  return r;
};
// 1. the game functions are globals
out.fns = ['computeDeviceCost', 'getDeviceCostBreakdown', 'getDeviceSalesConfig', 'getChipCostConfig', 'getLaptopChipCostConfig',
  'getConsoleChipCostConfig', 'getVRChipCostConfig', 'computeSpecScores',
  'computeTabletSpecScores', 'computeLaptopSpecScores', 'computeWatchesSpecScores', 'computeHeadphonesSpecScores',
  'computeTVSpecScores', 'computeScooterSpecScores', 'computeKeyboardSpecScores', 'computeConsoleSpecScores',
  'computeVRSpecScores'].map(f => [f, typeof globalThis[f]]);
out.chipConfigs = ['getChipCostConfig', 'getLaptopChipCostConfig', 'getConsoleChipCostConfig', 'getVRChipCostConfig']
  .map(k => [k, JSON.stringify(globalThis[k]().TYPE_MULT), globalThis[k]() === globalThis[k]()]);
// 2. OS arrays: names, sizes, first rows; licences; own OS
out.osArrays = Object.keys(rt.objects).filter(n => /^ArrayOperationSystem|^ArrayMyOS_/.test(n))
  .map(n => { const a = arr(n); return a ? [n, a.width, a.height, a.depth] : [n, null]; });
for (const n of ['ArrayOperationSystem_Smartphone', 'ArrayOperationSystem_Laptop', 'ArrayOperationSystem_Watches',
  'ArrayOperationSystem_TV', 'ArrayOperationSystem_License']) {
  const a = arr(n);
  if (a) out[n] = dump(a, 60, 8);
}
for (const n of Object.keys(rt.objects).filter(n => /^ArrayMyOS_.*Earnings$/.test(n))) out[n] = dump(arr(n), 3, 12, 12);
// 3. released models: chip and OS columns, and the editor result with them (withModel)
const MAP = {
  ArraySmartphones: { type: 'SMARTPHONE', fn: 'computeSpecScores', cols: { 44: 'ProcessorType', 45: 'ProcessorID', 46: 'ProcessorSeriesID', 51: 'GraphicProcessorType', 52: 'GraphicProcessorID', 53: 'GraphicProcessorSeriesID', 64: 'OperationSystemID', 65: 'OperationSystem_Text', 66: 'OperationSystemVersion_Text' } },
  ArrayLaptops: { type: 'LAPTOP', fn: 'computeLaptopSpecScores', cols: { 22: 'ProcessorType', 23: 'ProcessorID', 24: 'ProcessorSeriesID', 25: 'ProcessorModelID', 30: 'GraphicProcessorType', 31: 'GraphicProcessorID', 32: 'GraphicProcessorSeriesID', 33: 'GraphicProcessorModelID', 49: 'OperationSystemID', 50: 'OperationSystem_Text', 51: 'OperationSystemVersion_Text' } },
};
out.models = {};
for (const [name, m] of Object.entries(MAP)) {
  const a = arr(name);
  if (!a) continue;
  const list = [];
  for (let y = 0; y < Math.min(3, a.height); y++) {
    if (!(Number(a.getAt(0, y, 7)) >= 0)) continue;
    const saved = {};
    for (const k of Object.keys(gv)) saved[k] = gv[k];
    try {
      for (const [c, v] of Object.entries(m.cols)) gv[v] = a.getAt(0, y, +c);
      const s = globalThis[m.fn](rt, Number(a.getAt(0, y, 7)));
      gv.DayTotal = Number(a.getAt(0, y, 7));
      globalThis.computeDeviceCost(rt, m.type);
      const cost = globalThis.getDeviceCostBreakdown();
      list.push({
        y, cols: Object.fromEntries(Object.keys(m.cols).map(c => [m.cols[c], a.getAt(0, y, +c)])),
        scores: s && { power: s.power, perf: s.perf, gaming: s.gaming, energy: s.energy, source: s.info && s.info.source, gpu: s.gpu },
        gvAfter: { Processor_Power: gv.Processor_Power, GPU_Gaming: gv.GPU_Gaming },
        cost: cost && { total: cost.total, cost3: a.getAt(0, y, 3), groups: cost.groups, chip: cost.chip && { cpuSource: cost.chip.cpuSource, gpuSource: cost.chip.gpuSource, cpuMult: cost.chip.cpuMult } },
      });
    } finally { for (const k of Object.keys(saved)) gv[k] = saved[k]; }
  }
  out.models[name] = list;
}
// 4. the editor vars around the OS and the company / campaign
out.vars = Object.fromEntries(['OperationSystem', 'OperationSystemVersion', 'OperationSystemID', 'OperationSystem_Text',
  'OperationSystemVersion_Text', 'UseMyProcessor', 'ProcessorType', 'GraphicProcessorType', 'CompanyName',
  'DayTotal', 'Year', 'DeviceType', 'class'].map(v => [v, gv[v]]));
try { out.daysLived = globalThis.getCampaignDaysLived(); } catch (e) { out.daysLived = String(e); }
out.companyVars = Object.keys(gv).filter(k => /^Company|Name$/.test(k)).slice(0, 30);
// 5. the editor texts (only on their layouts)
out.uids = [1135, 2228, 3039, 3625, 4563, 1040, 2140, 2909, 2947, 12093, 1392].map(u => {
  const i = rt.getInstanceByUid(u);
  return [u, i ? { layout: rt.layout.name, layer: i.layer && i.layer.name, x: i.x, y: i.y, w: i.width, text: String(i.text).slice(0, 60) } : null];
});
// 6. the licence of own chips and own OS (to find the PRIVATE value)
out.chipLicence = ['ArrayMyCPU_Smartphones', 'ArrayMyCPU_Laptops'].map(n => {
  const a = arr(n);
  return a ? [n, [...Array(Math.min(a.width, 6)).keys()].map(x => a.getAt(x, 54))] : [n, null];
});
return out;
