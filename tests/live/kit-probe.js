// Live check of the kit hooks: call sites of an event function, an action by SID, a script action, and that a
// wrap runs and is undone.
const esm = BetterDTKit.eventSheets();
if (!esm) return 'no esm';
const eb = esm.GetFunctionBlockByName('ReviewsEngineResults')?.GetEventBlock();
const sites = [...esm._actsBySid.values()].filter(a => a._callEventBlock === eb).length;
const rating = esm.GetActionBySID(778761487654340) ? 'ok' : 'missing';
const scripts = [];
for (const b of esm._blocksBySid.values()) for (const a of b._actions || []) if (a._func && a._func.name === 'bound EventGameplay_Event449_Act1') scripts.push(a);
// a daily function: count its calls for a few game days through a wrapped call site
let hits = 0;
const fb = esm.GetFunctionBlockByName('ResearchInvestEngine').GetEventBlock();
const acts = [...esm._actsBySid.values()].filter(a => a._callEventBlock === fb);
const orig = acts.map(a => a.Run);
acts.forEach(a => { const o = a.Run; a.Run = function () { hits++; return o.apply(this, arguments); }; });
const day = rt.globalVars.DayTotal;
for (let i = 0; i < 40 && rt.globalVars.DayTotal < day + 2; i++) await new Promise(r => setTimeout(r, 500));
acts.forEach((a, i) => a.Run = orig[i]);
return { sites, rating, scripts: scripts.length, investSites: acts.length, days: rt.globalVars.DayTotal - day, hits };
