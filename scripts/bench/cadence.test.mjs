import test from 'node:test';
import assert from 'node:assert/strict';
import { INPUTS, GRID, ACTIONS, value, evaluate, optimum, hourlyDifference, adaptive, adaptiveOptimum, paramRows, stageRows, cancellationCost } from './cadence.mjs';
import { doubleSaleRate } from './roi.mjs';

test('all numerical inputs retain the ROI evidence shape', () => {
  for (const [key, input] of Object.entries(INPUTS)) {
    assert.deepEqual(Object.keys(input).sort(), ['mark', 'source', 'unit', 'value']);
    assert.ok(['observed', 'asserted', 'inferred', 'assumption'].includes(input.mark), key);
    assert.ok(input.source.includes('2026-11-15'), key);
    assert.ok(input.unit && input.source.length > 20, key);
  }
  assert.deepEqual(GRID, [1, 2, 5, 10, 15, 23, 30, 60, 120, 240]);
});

test('checking less often lowers check cost and raises detection or drift harm', () => {
  for (const action of Object.keys(ACTIONS)) {
    const rows = GRID.map(minutes => evaluate(action, minutes));
    for (let i = 1; i < rows.length; i++) {
      assert.ok(rows[i].cash < rows[i - 1].cash, action);
      assert.ok(rows[i].checkCost <= rows[i - 1].checkCost, action);
      assert.ok(rows[i].harm > rows[i - 1].harm, action);
    }
    const best = optimum(action);
    assert.ok(GRID.includes(best.minutes), action);
    assert.ok(best.band.every(minutes => evaluate(action, minutes).total <= best.total * 1.1 + 1e-12), action);
    assert.equal(best.total, Math.min(...rows.map(row => row.total)));
  }
});

test('a sale row reuses the ROI probability with the other sites harmonic mean', () => {
  const row = evaluate('depop', 15);
  const others = Object.keys(value('mean_days')).filter(site => site !== 'depop');
  const harmonicDays = others.length / others.reduce((sum, site) => sum + 1 / value('mean_days')[site], 0);
  const p = doubleSaleRate({ windowMin: 15 / 2 + value('delist_minutes'), otherListings: 4, meanDaysToSell: harmonicDays });
  assert.ok(Math.abs(row.doubleSales - value('sales_per_site_month') * p) < 1e-12);
  assert.ok(Math.abs(row.harm - row.doubleSales * row.lossPerDoubleSale) < 1e-12);
  assert.ok(Math.abs(row.refunds - row.doubleSales * value('item_price')) < 1e-12);
  assert.ok(Math.abs(row.total - row.cash - row.exposure - row.harm) < 1e-12);
});

test('hourly differences use the actual two rows and 75% fewer runs', () => {
  for (const action of Object.keys(ACTIONS)) {
    const change = hourlyDifference(action);
    assert.equal(change.runsSaved, evaluate(action, 15).runs * 0.75);
    assert.ok(Math.abs(change.totalChange - (evaluate(action, 60).total - evaluate(action, 15).total)) < 1e-12);
    assert.ok(change.harmAdded > 0);
  }
});

test('adaptive comparison uses identical state exposure and sales, and quiet has no live sales', () => {
  const weights = value('time_shares');
  assert.ok(Math.abs(Object.values(weights).reduce((a, b) => a + b) - 1) < 1e-12);
  assert.equal(Object.values(value('sale_shares')).reduce((a, b) => a + b), 1);
  for (const site of ['depop', 'poshmark', 'mercari', 'facebook_email', 'ebay_backstop']) {
    const flat = adaptive(site, { hot: 15, live: 15, quiet: 15 });
    const normal = evaluate(site, 15);
    const manualHarm = Object.entries(weights).reduce((sum, [state, share]) => sum + share * evaluate(site, 15, { state }).harm, 0);
    const publicPages = ['poshmark', 'mercari'].includes(site);
    const cash = normal.cash - (publicPages ? weights.quiet * normal.runs * value('active_listings') * value('public_request') : 0);
    const exposure = -Math.expm1(-normal.incidentHazard * (publicPages ? 1 - weights.quiet : 1)) * value('restriction_loss');
    assert.ok(Math.abs(flat.total - (cash + exposure + manualHarm)) < 1e-12);
    assert.equal(evaluate(site, 60, { state: 'quiet' }).doubleSales, 0);
    assert.ok(adaptive(site).total <= flat.total + 1e-12);
    assert.ok(adaptive(site).total <= adaptiveOptimum(site).total * 1.1);
  }
});

test('stage overrides preserve every key and alter numbers only', () => {
  const production = paramRows();
  const stage = stageRows(production);
  assert.deepEqual(Object.keys(stage), Object.keys(production));
  assert.ok(Object.keys(stage).every(key => /^watch_cadence_s@\w+\/(hot|live|quiet)$/.test(key)));
  for (const key of Object.keys(stage)) {
    assert.equal(stage[key], value('stage_seconds'));
    assert.equal(typeof production[key], 'number');
  }
  assert.deepEqual(production, paramRows());
});

test('restriction and timing sensitivities reach the real objective', () => {
  assert.equal(evaluate('depop', 15, { overrides: { restriction_hazard_15: { depop: 0, poshmark: 0, mercari: 0 } } }).exposure, 0);
  const normal = evaluate('depop', 60);
  assert.ok(evaluate('depop', 60, { overrides: { hazard_multiplier: 10 } }).harm > normal.harm);
  assert.ok(evaluate('depop', 60, { overrides: { sales_per_site_month: 10 } }).harm > normal.harm);
  assert.ok(cancellationCost('mercari') > cancellationCost('depop'));
  assert.equal(evaluate('ebay_backstop', 15, { overrides: { push_miss_share: 0 } }).harm, 0);
  assert.equal(evaluate('poshmark', 60, { state: 'quiet' }).exposure, 0);
  assert.equal(evaluate('poshmark', 60, { state: 'quiet' }).cash, 720 * value('job_run'));
});
