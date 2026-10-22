// Puts the game in the state of the review screen (class = REVIEWS, the type of the last review) and checks the
// strip, then restores the state and checks that the strip is gone.
const l = __bdtFairReviews.last, g = rt.globalVars;
if (!l) return 'no review yet';
const before = { cls: g.class, type: g.DeviceTypeCreatingNow };
g.class = 'REVIEWS'; g.DeviceTypeCreatingNow = BDTReviewData.engines[l.fn].creating;
await new Promise(r => setTimeout(r, 600));
const s = document.getElementById('bdt-review-strip');
const items = s ? [...s.lastChild.children] : [];
const res = s ? { items: items.length, cats: Object.keys(l.scores).length,
  framed: items.filter(e => e.style.borderColor && e.style.borderColor !== 'transparent').length,
  parts: l.parts, first: s.firstChild.textContent.slice(0, 40) } : 'no strip';
g.class = before.cls; g.DeviceTypeCreatingNow = before.type;
await new Promise(r => setTimeout(r, 600));
return { res, removed: !document.getElementById('bdt-review-strip') || String(before.cls).startsWith('REVIEWS') };
