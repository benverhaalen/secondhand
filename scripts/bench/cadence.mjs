import { fileURLToPath } from 'node:url';
import { doubleSaleRate, INPUTS as ROI_INPUTS } from './roi.mjs';

const NOTE = 'research/sold/ben/check-interval-evidence.md';
const read = source => `${source}; read 2026-11-15`;
const assumption = (value, unit, source) => ({ value, unit, mark: 'assumption', source: read(`${NOTE}: ${source}`) });

export const INPUTS = {
  month_days: assumption(30, 'days/month', 'accounting month; range 28 to 31'),
  sales_per_site_month: assumption(2, 'first sales/user-site-month', 'one linked account on each site, 10 first sales total; range 0.2 to 20 per site'),
  active_listings: assumption(10, 'public pages/user-site', 'range 1 to 100; Depop sweeps are per account, public checks per listing'),
  mean_days: assumption({ ebay: 90, poshmark: 30, depop: 126, mercari: 30, facebook: 14 }, 'days per counterfactual site sale', 'eBay FLUF 91.1, Depop FLUF 126.2 are vendor averages of sold items; Poshmark Closo 25 to 30 typical days conflicts with SoldStack 5-day median. These are hazard assumptions, not cohort estimates; ranges eBay 7 to 180, Poshmark 5 to 180, Depop 7 to 240, Mercari 1 to 180, Facebook 1 to 90'),
  delist_minutes: assumption(2, 'minutes after detection', 'OPERATING.md budget, not measured; includes confirmation and all delists in parallel; range 1 to 10'),
  item_price: { value: 33, unit: '$/item', mark: 'observed', source: read('https://www.sec.gov/Archives/edgar/data/1825480/000119312520320132/d66583ds1.htm : 2019 average order value; historical anchor only') },
  refund_minutes: assumption(10, 'minutes/double sale', 'contact buyer, refund, check state; range 5 to 30'),
  time_value_hour: assumption(20, '$/seller-hour', 'opportunity cost, no wage claim; range 0 to 40'),
  trust_loss: assumption(10, '$/double sale', 'lost goodwill and distress; range 0 to 50, never measured retention'),
  penalty_loss: assumption({ ebay: 10, poshmark: 5, depop: 2, mercari: 5, facebook: 0 }, '$/cancellation', 'shadow cost of account standing, not a published fine; ranges eBay 0 to 200, Poshmark 0 to 100, Depop 0 to 50, Mercari 0 to 100, Facebook 0 to 50'),
  mercari_fee_rate: { value: 0.05, unit: 'share of price', mark: 'observed', source: read('https://www.mercari.com/us/help_center/article/251/ : may charge, not every cancellation') },
  mercari_fee_cap: { value: 25, unit: '$/cancellation', mark: 'observed', source: read('https://www.mercari.com/us/help_center/article/251/') },
  mercari_fee_probability: assumption(0.5, 'share of cancellations charged', 'policy says may; range 0 to 1'),
  browser_hour: { value: 0.06, unit: '$/browser-hour', mark: 'observed', source: read('https://browser-use.com/pricing : browser only, traffic extra') },
  browser_minutes: assumption(1, 'billed browser-minutes/sweep', 'numbers.md assumed one started minute; range 0.25 to 4; four watcher sections must fit together'),
  browser_mb: assumption(1, 'MB/sweep', 'range 0.1 to 5; no payload measurement'),
  direct_gb: { value: 0.2, unit: '$/GB', mark: 'observed', source: read('https://browser-use.com/pricing : own proxy or direct traffic') },
  residential_gb: { value: 5, unit: '$/GB', mark: 'observed', source: read('https://browser-use.com/pricing : home-IP traffic, sensitivity only') },
  public_request: assumption(0.000001, '$/plain page request', 'allocated server cost, range 0 to 0.0001; not a free external scrape credit'),
  job_run: assumption(0.00001, '$/account sweep or mail/API poll', 'allocated compute and logging; range 0.000001 to 0.001'),
  mercari_browser_share: assumption(0, 'share of public reads needing browser', 'cheap-route hypothetical; range 0 to 1. Unknown/bot wall is failure, never an automatic browser retry'),
  restriction_hazard_15: assumption({ depop: 0.001, poshmark: 0.0001, mercari: 0.0001 }, 'incident hazard/user-site-month at 15 min', 'restriction or access-loss reserve, not measured bans: signed-in range 0 to 0.01, public range 0 to 0.001. Public access risk is not zero'),
  restriction_exponent: assumption(1.5, 'frequency exponent', 'hazard rises faster than request count; range 1 to 2'),
  restriction_loss: assumption(100, '$/restriction or access incident', 'seller downtime/support/opportunity cost; range 20 to 1000'),
  hazard_multiplier: assumption(1, 'multiplier', 'conditional demand clustering; sensitivity 0.25 to 20'),
  time_shares: assumption({ hot: 0.05, live: 0.75, quiet: 0.20 }, 'share of account-month', '36 hot hours, 540 live hours, 144 quiet hours. Account states, not listing ages; replace with traces'),
  sale_shares: assumption({ hot: 0.35, live: 0.65, quiet: 0 }, 'share of first sales', 'interest-enriched scenario, not derived from first-week sales; hot range 0.05 to 0.70'),
  state_hazard: assumption({ hot: 10, live: 1, quiet: 0 }, 'multiplier of other-site sale hazard', 'likes/offers may cluster buyers; hot range 1 to 20. Quiet means no live listings'),
  stage_seconds: assumption(10, 'seconds/check', 'isolated backend stage param profile, design only; not a production rate'),
  push_miss_share: assumption(0.01, 'share of eBay sales missed by push', 'range 0 to 0.10; delivery SLA/missed fraction not measured'),
  mail_delivery_minutes: assumption(2, 'minutes before email available', 'hypothetical only, range 0 to 60; no Facebook sold-email coverage established'),
  reconcile_run: assumption(0.0015, '$/user-job', 'incremental full inventory comparison across linked sites, range 0.0001 to 0.01; exclude sale detection already counted'),
  reconcile_events: assumption(1, 'unnoticed non-sale drifts/user-month', 'range 0.1 to 10'),
  reconcile_loss_hour: assumption(1, '$/hour of unresolved drift', 'range 0.05 to 10, linear while unresolved'),
  session_run: assumption(0.0015, '$/user-job', 'light health probes across accounts, range 0.0001 to 0.01; demand refresh is separate'),
  session_events: assumption(0.2, 'unexpected session failures/user-month', 'range 0.01 to 2'),
  session_loss_hour: assumption(2, '$/hour of hidden session failure', 'range 0.10 to 20; value only if earlier probe can enable recovery'),
  comps_run: assumption(0.0001, '$/user-job', 'amortised seller valuation comps, range 0.00001 to 0.01; no buyer wants'),
  comps_events: assumption(1, 'material comp changes/user-month', 'range 0.1 to 10'),
  comps_loss_hour: assumption(0.1, '$/hour of stale valuation', 'range 0.001 to 1; excludes losses already counted as inventory drift'),
  internal_run: assumption({ rollups: 0.00001, thresholds: 0.00002, nightly_fits: 0.001, retention: 0.00001 }, '$/user-job', 'amortised batch work, not a Databricks quote; each range 0.1x to 100x'),
  internal_events: assumption({ rollups: 1, thresholds: 0.1, nightly_fits: 0.01, retention: 0.01 }, 'drifts/user-month', 'seller-facing share only; each range 0 to 10x'),
  internal_loss_hour: assumption({ rollups: 0.01, thresholds: 1, nightly_fits: 0.1, retention: 0.1 }, '$/hour of unresolved drift', 'shadow values only, each range 0 to 10x; retention deadlines still bind'),
};

export const value = (key, overrides = {}) => key in overrides ? overrides[key] : INPUTS[key].value;
export const GRID = [1, 2, 5, 10, 15, 23, 30, 60, 120, 240];
export const ACTIONS = {
  depop: { label: 'Depop signed-in sweep', site: 'depop', kind: 'sale' },
  poshmark: { label: 'Poshmark public pages', site: 'poshmark', kind: 'sale' },
  mercari: { label: 'Mercari public pages (conditional)', site: 'mercari', kind: 'sale' },
  facebook_email: { label: 'Facebook email (hypothetical)', site: 'facebook', kind: 'sale' },
  ebay_backstop: { label: 'eBay missed-push backstop', site: 'ebay', kind: 'sale' },
  reconcile: { label: 'Reconcile non-sale inventory drift', kind: 'drift' },
  session: { label: 'Session health probe', kind: 'drift' },
  comps: { label: 'Seller comps refresh', kind: 'drift' },
  rollups: { label: 'Seller analytics rollups', kind: 'internal' },
  thresholds: { label: 'Threshold evaluation', kind: 'internal' },
  nightly_fits: { label: 'Nightly parameter fits', kind: 'internal' },
  retention: { label: 'Daily retention scan', kind: 'internal' },
};

export function cancellationCost(site, overrides = {}) {
  const v = key => value(key, overrides);
  const fee = site === 'mercari' ? v('mercari_fee_probability') * Math.min(v('item_price') * v('mercari_fee_rate'), v('mercari_fee_cap')) : 0;
  return v('refund_minutes') / 60 * v('time_value_hour') + v('trust_loss') + v('penalty_loss')[site] + fee;
}

function saleInputs(action, state, overrides) {
  const v = key => value(key, overrides);
  const { site } = ACTIONS[action];
  const means = v('mean_days');
  const otherSites = Object.keys(means).filter(other => other !== site);
  const hazard = v('hazard_multiplier') * (state ? v('state_hazard')[state] : 1);
  const perDay = otherSites.reduce((sum, other) => sum + 1 / means[other], 0) * hazard;
  const lossPerDoubleSale = perDay === 0 ? 0 : otherSites.reduce((sum, other) => sum + cancellationCost(other, overrides) / means[other], 0) * hazard / perDay;
  const sales = v('sales_per_site_month') * (state ? v('sale_shares')[state] / v('time_shares')[state] : 1);
  const covered = action === 'ebay_backstop' ? v('push_miss_share') : 1;
  return { perDay, lossPerDoubleSale, sales: sales * covered, otherListings: otherSites.length };
}

export function evaluate(action, minutes, { state, overrides = {} } = {}) {
  if (!(Number.isFinite(minutes) && minutes > 0)) throw new RangeError('minutes must be positive');
  const spec = ACTIONS[action];
  if (!spec) throw new RangeError(`unknown action ${action}`);
  const v = key => value(key, overrides);
  const runs = v('month_days') * 1440 / minutes;
  const browser = v('browser_hour') * v('browser_minutes') / 60 + v('browser_mb') / 1000 * v('direct_gb');
  let perRun = v('job_run');
  if (action === 'depop') perRun += browser;
  const publicPages = action === 'poshmark' || action === 'mercari';
  if (publicPages && state !== 'quiet') perRun += v('active_listings') * (v('public_request') + (action === 'mercari' ? v('mercari_browser_share') * browser : 0));
  if (spec.kind === 'drift') perRun = v(`${action}_run`);
  if (spec.kind === 'internal') perRun = v('internal_run')[action];
  const cash = runs * perRun;
  const incidentHazard = publicPages && state === 'quiet' ? 0 : (v('restriction_hazard_15')[spec.site] ?? 0) * (15 / minutes) ** v('restriction_exponent');
  const restrictionProbability = -Math.expm1(-incidentHazard);
  const exposure = restrictionProbability * v('restriction_loss');
  let harm, doubleSales = 0, lossPerDoubleSale = 0;
  const delayMinutes = minutes / 2;
  const windowMinutes = delayMinutes + v('delist_minutes') + (action === 'facebook_email' ? v('mail_delivery_minutes') : 0);
  if (spec.kind === 'sale') {
    const sale = saleInputs(action, state, overrides);
    lossPerDoubleSale = sale.lossPerDoubleSale;
    const probability = sale.perDay === 0 ? 0 : doubleSaleRate({ windowMin: windowMinutes, otherListings: sale.otherListings, meanDaysToSell: sale.otherListings / sale.perDay });
    doubleSales = sale.sales * probability;
    harm = doubleSales * lossPerDoubleSale;
  } else {
    const events = spec.kind === 'drift' ? v(`${action}_events`) : v('internal_events')[action];
    const lossHour = spec.kind === 'drift' ? v(`${action}_loss_hour`) : v('internal_loss_hour')[action];
    harm = events * lossHour * delayMinutes / 60;
  }
  return { minutes, runs, cash, exposure, checkCost: cash + exposure, harm, total: cash + exposure + harm,
    delayMinutes, windowMinutes, doubleSales, lossPerDoubleSale, refunds: doubleSales * v('item_price'), restrictionProbability, incidentHazard };
}

export function optimum(action, options) {
  const rows = GRID.map(minutes => evaluate(action, minutes, options));
  const best = rows.reduce((a, b) => b.total < a.total ? b : a);
  return { ...best, band: rows.filter(row => row.total <= best.total * 1.1 + 1e-12).map(row => row.minutes), boundary: best.minutes === GRID[0] || best.minutes === GRID.at(-1) };
}

export function hourlyDifference(action) {
  const a = evaluate(action, 15), b = evaluate(action, 60);
  return { runsSaved: a.runs - b.runs, cashSaved: a.cash - b.cash, exposureSaved: a.exposure - b.exposure,
    harmAdded: b.harm - a.harm, totalChange: b.total - a.total, extraDoubleSales: b.doubleSales - a.doubleSales,
    extraRefunds: b.refunds - a.refunds, delayAdded: b.delayMinutes - a.delayMinutes };
}

export function adaptive(action, intervals, overrides = {}) {
  const rows = Object.entries(value('time_shares', overrides)).map(([state, share]) => {
    const minutes = intervals?.[state] ?? optimum(action, { state, overrides }).band[0];
    return { state, share, ...evaluate(action, minutes, { state, overrides }) };
  });
  const out = { intervals: Object.fromEntries(rows.map(row => [row.state, row.minutes])) };
  for (const key of ['runs', 'cash', 'harm', 'doubleSales', 'incidentHazard']) out[key] = rows.reduce((sum, row) => sum + row.share * row[key], 0);
  out.exposure = -Math.expm1(-out.incidentHazard) * value('restriction_loss', overrides);
  out.total = out.cash + out.exposure + out.harm;
  return out;
}

export function paramRows() {
  return Object.fromEntries(['depop', 'poshmark', 'mercari', 'facebook_email', 'ebay_backstop'].flatMap(action =>
    Object.entries(adaptive(action).intervals).map(([state, minutes]) => [`watch_cadence_s@${ACTIONS[action].site}/${state}`, minutes * 60])));
}

export function adaptiveOptimum(action) {
  let best;
  for (const hot of GRID) for (const live of GRID) for (const quiet of GRID) {
    const row = adaptive(action, { hot, live, quiet });
    if (!best || row.total < best.total) best = row;
  }
  return best;
}

export function stageRows(production = paramRows()) {
  return Object.fromEntries(Object.keys(production).map(key => [key, value('stage_seconds')]));
}

const dollars = n => n.toFixed(4);

export function report() {
  const lines = ['All dollar rows are per hypothetical linked user per 30-day month. Partial cadence cost: check cash + access reserve + delay harm. Interval-independent sale handling is excluded. Conditional model, not measured outcomes.', '',
    '| Action | Grid minimum min | Within 10% min | Total $ | Grid boundary? |', '|---|---:|---|---:|---|'];
  for (const [action, spec] of Object.entries(ACTIONS)) {
    const best = optimum(action);
    lines.push(`| ${spec.label} | ${best.minutes} | ${best.band.join(', ')} | ${dollars(best.total)} | ${best.boundary ? 'yes' : 'no'} |`);
  }
  for (const [action, spec] of Object.entries(ACTIONS)) {
    lines.push('', `### ${spec.label}`, '', '| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |', '|---:|---:|---:|---:|---:|---:|---:|');
    for (const minutes of GRID) {
      const r = evaluate(action, minutes);
      lines.push(`| ${minutes} | ${r.runs.toFixed(1)} | ${dollars(r.cash)} | ${dollars(r.exposure)} | ${dollars(r.harm)} | ${dollars(r.total)} | ${spec.kind === 'sale' ? (r.doubleSales / value('sales_per_site_month') * 1000).toFixed(4) : 'n/a'} |`);
    }
  }
  lines.push('', '### Hourly instead of 15 minutes', '', '| Action | Cash saved $ | Access reserve saved $ | Extra harm $ | Net total change $ | Extra double sales / 1,000 user-months | Extra item refunds $ |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const [action, spec] of Object.entries(ACTIONS)) {
    const r = hourlyDifference(action);
    lines.push(`| ${spec.label} | ${dollars(r.cashSaved)} | ${dollars(r.exposureSaved)} | ${dollars(r.harmAdded)} | ${dollars(r.totalChange)} | ${(r.extraDoubleSales * 1000).toFixed(4)} | ${dollars(r.extraRefunds)} |`);
  }
  lines.push('', '### Adaptive against flat intervals on the same state mixture', '', '| Action | hot/live/quiet min | Adaptive cash $ | Adaptive reserve $ | Adaptive harm $ | Adaptive total $ | Global adaptive minimum $ | Above minimum % | Best flat min | Best flat total $ | Flat 15 $ | Flat 60 $ |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const action of ['depop', 'poshmark', 'mercari', 'facebook_email', 'ebay_backstop']) {
    const r = adaptive(action);
    const flats = GRID.map(minutes => ({ minutes, ...adaptive(action, { hot: minutes, live: minutes, quiet: minutes }) }));
    const best = flats.reduce((a, b) => b.total < a.total ? b : a);
    const global = adaptiveOptimum(action);
    const at = minutes => flats.find(row => row.minutes === minutes).total;
    lines.push(`| ${ACTIONS[action].label} | ${Object.values(r.intervals).join('/')} | ${dollars(r.cash)} | ${dollars(r.exposure)} | ${dollars(r.harm)} | ${dollars(r.total)} | ${dollars(global.total)} | ${(100 * (r.total / global.total - 1)).toFixed(2)} | ${best.minutes} | ${dollars(best.total)} | ${dollars(at(15))} | ${dollars(at(60))} |`);
  }
  lines.push('', '### State optima and within-10% intervals', '', '| Action | State | Minimum min | Within 10% min | Proposed min |', '|---|---|---:|---|---:|');
  for (const action of ['depop', 'poshmark', 'mercari', 'facebook_email', 'ebay_backstop']) {
    for (const state of ['hot', 'live', 'quiet']) {
      const r = optimum(action, { state });
      lines.push(`| ${ACTIONS[action].label} | ${state} | ${r.minutes} | ${r.band.join(', ')} | ${r.band[0]} |`);
    }
  }
  lines.push('', '### Sale sensitivity: optimal flat minutes / monthly total $', '', '| Scenario | Depop | Poshmark | Mercari | Facebook email | eBay backstop |', '|---|---|---|---|---|---|');
  const cases = {
    base: {},
    'no access incidents': { restriction_hazard_15: { depop: 0, poshmark: 0, mercari: 0 } },
    'all sites 7-day mean': { mean_days: Object.fromEntries(Object.keys(value('mean_days')).map(site => [site, 7])) },
    'no competing Facebook checkout': { mean_days: { ...value('mean_days'), facebook: Infinity } },
    '10x clustered hazard': { hazard_multiplier: 10 },
    '10 first sales/site/month': { sales_per_site_month: 10 },
    'one public page': { active_listings: 1 },
    'public requests cost zero': { public_request: 0 },
    'Mercari all reads browser': { mercari_browser_share: 1 },
    'residential Depop traffic': { direct_gb: value('residential_gb') },
    'no trust or standing shadow cost': { trust_loss: 0, penalty_loss: Object.fromEntries(Object.keys(value('mean_days')).map(site => [site, 0])) },
    '10-minute confirmation/delist': { delist_minutes: 10 },
  };
  for (const [name, overrides] of Object.entries(cases)) lines.push(`| ${name} | ${['depop', 'poshmark', 'mercari', 'facebook_email', 'ebay_backstop'].map(action => { const r = optimum(action, { overrides }); return `${r.minutes} / ${dollars(r.total)}`; }).join(' | ')} |`);
  lines.push('', '### Numeric param proposal (production profile)', '', '```json', JSON.stringify(paramRows(), null, 2), '```', '',
    `ROI legacy Depop anchor: $${ROI_INPUTS.depop_live_day.value}/account-day. This model at 15 min: $${dollars(evaluate('depop', 15).cash / value('month_days'))}/day; traffic and allocated job cost included.`);
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(report());
