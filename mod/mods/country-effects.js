// Country effects – the company's country's cost of production and international trade do something.
//
// Every country (ArrayCountries) has a budget, a tax rate, a cost of production, international trade and a research
// level (the game's labels on COMPANY COUNTRY). The game uses the budget (start money), the research level (start
// research points) and the tax rate (every month); cost of production and trade are only shown.
//
// Here both become part of the choice, through the game's own config objects:
// - cost of production: the salary module (applySalaryExpences, every month) already has a scale of all salaries
//   by this column, turned off (getSalaryConfig().COUNTRY_SCALE, ×0.6…×1.4). We turn it on with a milder range,
//   ×0.8 at 1 % … ×1.2 at 100 %: a cheap country pays less, an expensive one more. The salaries the game shows on
//   the employees stay the same; the monthly payment (SalaryExpences) uses the factor.
// - international trade: devices sell more. The potential of a device is (AUDIENCE_SEED + fans × AUDIENCE_FAN_W …)
//   × …, and the daily sales are a share of it; both multiplied by the same factor make the sales that much higher
//   (the game's recommended batch size follows). ×0.90 at 0 % … ×1.15 at 100 % (the countries have 1…99 %).
// The cost of the devices themselves stays: the game also judges the price against it (demand), so a lower cost
// would make every device look overpriced. The country picker shows both effects (country-picker.js).
BetterDTKit.mod('country-effects', {
  needs: {
    functions: ['setSalaryConfig', 'getSalaryConfig', 'setDeviceSalesConfig', 'getDeviceSalesConfig'],
    vars: ['CompanyCountryID'],
  },
}, (rt, kit) => {
  if (globalThis.__dtCountryEffects) globalThis.__dtCountryEffects.dispose();

  const gv = rt.globalVars;
  const COST = 3, TRADE = 4;
  const SALARY_MIN = 0.8, SALARY_MAX = 1.2;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
  // as the game's salary module counts it (_countryFactor): 1…100 % → min…max
  const salaryOf = (c) => SALARY_MIN + (SALARY_MAX - SALARY_MIN) * (clamp(c, 1, 100) - 1) / 99;
  const salesOf = (t) => 0.90 + 0.25 * clamp(t, 0, 100) / 100;

  // the game's values, to give back
  const sal = globalThis.getSalaryConfig(), s = globalThis.getDeviceSalesConfig();
  if (sal.COUNTRY_ARRAY !== 'ArrayCountries' || sal.COUNTRY_PROD_Y !== COST || sal.COUNTRY_VAR !== 'CompanyCountryID') {
    throw new Error('salary country scale reads ' + sal.COUNTRY_ARRAY + '/' + sal.COUNTRY_PROD_Y + '/' + sal.COUNTRY_VAR);
  }
  const base = {
    COUNTRY_SCALE: sal.COUNTRY_SCALE, COUNTRY_MIN: sal.COUNTRY_MIN, COUNTRY_MAX: sal.COUNTRY_MAX,
    AUDIENCE_SEED: s.AUDIENCE_SEED, AUDIENCE_FAN_W: s.AUDIENCE_FAN_W,
  };
  if (!(base.AUDIENCE_SEED > 0) || !(base.AUDIENCE_FAN_W > 0)) throw new Error('device sales config has no audience');

  // the salary scale follows CompanyCountryID by itself; the sales are set for the country now
  globalThis.setSalaryConfig({ COUNTRY_SCALE: true, COUNTRY_MIN: SALARY_MIN, COUNTRY_MAX: SALARY_MAX });

  function trade(id) {
    try {
      const a = rt.objects.ArrayCountries.getFirstInstance();
      return a && id >= 0 && id < a.width ? Number(a.getAt(id, TRADE)) || 0 : null;
    } catch { return null; }
  }
  let applied = { id: NaN, sales: 1 };
  function apply() {
    const id = Math.round(Number(gv.CompanyCountryID));
    const t = trade(id), sales = t === null ? 1 : salesOf(t);
    if (id === applied.id && sales === applied.sales) return;
    globalThis.setDeviceSalesConfig({ AUDIENCE_SEED: base.AUDIENCE_SEED * sales, AUDIENCE_FAN_W: base.AUDIENCE_FAN_W * sales });
    applied = { id, sales };
    BetterDT.log('country effects', id, 'sales x' + sales.toFixed(3));
  }
  const timer = setInterval(kit.guard(apply), 1000);
  apply();

  const dispose = () => {
    clearInterval(timer);
    globalThis.setSalaryConfig({ COUNTRY_SCALE: base.COUNTRY_SCALE, COUNTRY_MIN: base.COUNTRY_MIN, COUNTRY_MAX: base.COUNTRY_MAX });
    globalThis.setDeviceSalesConfig({ AUDIENCE_SEED: base.AUDIENCE_SEED, AUDIENCE_FAN_W: base.AUDIENCE_FAN_W });
    if (globalThis.__dtCountryEffects === api) delete globalThis.__dtCountryEffects;   // the picker shows "no effect" again
  };
  const api = { dispose, salaryOf, salesOf, get state() { return { ...applied }; } };
  globalThis.__dtCountryEffects = api;
  return dispose;
});
