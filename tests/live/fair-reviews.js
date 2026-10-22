// Reviews the newest device of every type in the open save 20 times through the mod and checks the result.
const F = globalThis.__bdtFairReviews, C = BDTReviewCore;
if (!F) return 'mod not running';
const out = {};
for (const fn of Object.keys(BDTReviewData.engines)) {
  const e = BDTReviewData.engines[fn], a = rt.objects[e.device].getFirstInstance();
  if (!a || !(a.getAt(0, 0, e.costCol) > 0)) { out[fn] = 'no device'; continue; }
  rt.globalVars.ReviewDeviceNowID = 0;
  const finals = [], problems = [];
  for (let i = 0; i < 20; i++) {
    const r = F.review(fn);
    finals.push(r.final);
    if (r.shown.length !== 4 || new Set(r.shown).size !== 4) problems.push('shown ' + r.shown);
    if (!(r.final >= 1 && r.final <= 10)) problems.push('final ' + r.final);
    const over = 'price' in r.scores && C.overpriced(r.markup, C.priceLimits(r.cls, r.parts));
    if (over && !r.shown.slice(2).includes('price')) problems.push('overpriced not shown');
  }
  const l = F.last;
  out[fn] = { min: Math.min(...finals), max: Math.max(...finals), cls: l.cls, share: +l.share.toFixed(2),
    markup: Math.round(l.markup), parts: l.parts, shown: l.shown.map(c => c + ' ' + l.scores[c]).join(', '),
    problems: [...new Set(problems)] };
}
return out;
