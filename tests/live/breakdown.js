// Opens the review screen of the newest laptop and follows it: the headings come with the first card of their row,
// the strip only once all 4 cards are in, everything sits in the game's review page under its blur overlay; after the
// average rating the strip has every category with the 2 best framed green and the 2 worst red.
const g = rt.globalVars, wait = (ms) => new Promise(r => setTimeout(r, ms));
g.DeviceTypeCreatingNow = 'LAPTOPS'; g.ReviewDeviceNowID = 0; g.ReviewDeviceMax = 1;
g.class = 'REVIEWS'; rt.goToLayout('REVIEWS');
await wait(1200);
const op = (e) => e ? Number(getComputedStyle(e).opacity).toFixed(2) : -1;
const heads = () => [...document.querySelectorAll('#reviews-root #bdt-review-extra .bdt-review-heading')];
const start = { heads: heads().length, headOpacity: heads().map(op), strip: !!document.getElementById('bdt-review-strip') };
await wait(4500);
const cards = { headOpacity: heads().map(op), strip: !!document.getElementById('bdt-review-strip') };
await wait(6500);
const l = __bdtFairReviews.last, s = document.getElementById('bdt-review-strip');
const items = s ? [...s.lastChild.children] : [];
const color = (e) => getComputedStyle(e).borderTopColor;
const end = s ? { items: items.length, cats: Object.keys(l.scores).length,
  green: items.filter(e => color(e) === 'rgb(61, 220, 132)').length, red: items.filter(e => color(e) === 'rgb(255, 79, 109)').length,
  inReviewPage: s.closest('#reviews-root') !== null } : 'no strip';
return { start, cards, end };
