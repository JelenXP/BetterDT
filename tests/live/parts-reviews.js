// Parts in reviews on the loaded save (test copy): the OS rating of every OS on the market today per family, and the
// OS / processor / graphics rating of every released model; then the newest model of each type is reviewed 10 times
// and the new categories must be among the scores.
const A = globalThis.__bdtPartsReviews, F = globalThis.__bdtFairReviews, gv = rt.globalVars;
if (!A || !F) return 'mod not running';
const P = BDTPartsData, R = BDTReviewData, out = { os: {}, models: {}, reviews: {} };
const before = JSON.stringify(Object.keys(gv).map(k => [k, gv[k]]));
for (const [fn, e] of Object.entries(P.engines)) {
  const dev = rt.objects[R.engines[fn].device].getFirstInstance();
  if (!dev) continue;
  const list = [];
  for (let x = 0; x < dev.width; x++) for (let y = 0; y < Math.min(3, dev.height); y++) {
    if (!(Number(dev.getAt(x, y, R.releaseCol)) >= 0) || !(dev.getAt(x, y, R.engines[fn].costCol) > 0)) continue;
    const r = A.ratings(fn, x, y);
    list.push({ x, y, ...r, osName: e.os ? String(dev.getAt(x, y, +Object.keys(e.os.cols)[1])) : null });
  }
  if (list.length) out.models[fn] = list;
  // every OS of the family on the market today, as if chosen in the designer
  if (e.os && !out.os[e.os.family]) {
    const o = P.osArrays[e.os.family], a = rt.objects[o.array].getFirstInstance(), rows = [];
    const saved = { i: gv.OperationSystemID, t: gv.OperationSystem_Text, v: gv.OperationSystemVersion_Text };
    try {
      for (let x = 0; x < a.width; x++) {
        if (Number(a.getAt(x, o.fields.start)) > gv.DayTotal) continue;
        gv.OperationSystemID = a.getAt(x, o.fields.row);
        gv.OperationSystem_Text = a.getAt(x, o.fields.name); gv.OperationSystemVersion_Text = a.getAt(x, o.fields.version);
        rows.push([String(a.getAt(x, o.fields.name)), String(a.getAt(x, o.fields.version)), A.osOf(fn, 'editor')]);
      }
    } finally { gv.OperationSystemID = saved.i; gv.OperationSystem_Text = saved.t; gv.OperationSystemVersion_Text = saved.v; }
    out.os[e.os.family] = rows;
  }
}
out.varsRestored = JSON.stringify(Object.keys(gv).map(k => [k, gv[k]])) === before;
for (const fn of Object.keys(P.engines)) {
  const e = R.engines[fn], a = rt.objects[e.device].getFirstInstance();
  if (!a || !(a.getAt(0, 0, e.costCol) > 0)) continue;
  const savedId = gv.ReviewDeviceNowID;
  gv.ReviewDeviceNowID = 0;
  const seen = new Set(), problems = [];
  try {
    for (let i = 0; i < 10; i++) {
      const r = F.compute(fn);
      Object.keys(r.scores).forEach(c => seen.add(c));
      if ((fn === 'ReviewsEngine_Smartphones' || fn === 'ReviewsEngine_Tablets') && r.aspects.some(x => x.cat === 'cpu')) problems.push('CPU load review kept');
      if (fn === 'ReviewsEngine_Laptops' && r.aspects.some(x => x.cat === 'cpu')) problems.push('storage review left in cpu');
    }
  } finally { gv.ReviewDeviceNowID = savedId; }
  out.reviews[fn] = { categories: [...seen], problems: [...new Set(problems)] };
}
return out;
