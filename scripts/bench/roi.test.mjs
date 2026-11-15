// The cost and revenue model must be inspectable: every input names its source and mark, and the math is checkable by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { INPUTS, SCENARIOS, commission, doubleSaleRate, perMau, atScale, breakEvenPurchases } from './roi.mjs';

test('every input carries a source and one of the four marks', () => {
  for (const [k, v] of Object.entries(INPUTS)) {
    assert.ok(v.source && v.source.length > 5, `${k} has no source`);
    assert.ok(['observed', 'asserted', 'inferred', 'assumption'].includes(v.mark), `${k} mark ${v.mark}`);
  }
});

test('a $40 eBay fashion purchase pays 4%, and a network keeps 30% of what a merchant pays', () => {
  assert.equal(commission(40, 'ebay_fashion'), 1.6);
  assert.equal(Math.round(commission(40, 'network_resale') * 100) / 100, Math.round(40 * INPUTS.network_merchant_rate.value * 0.7 * 100) / 100);
  assert.equal(commission(40, 'facebook'), 0);
});

test('a wider take-down window means more double sales, in the order ours, a 10-minute poller, once a day', () => {
  const ours = doubleSaleRate({ windowMin: 4, otherListings: 3, meanDaysToSell: 14 });
  const poller = doubleSaleRate({ windowMin: 12, otherListings: 3, meanDaysToSell: 14 });
  const daily = doubleSaleRate({ windowMin: 24 * 60, otherListings: 3, meanDaysToSell: 14 });
  assert.ok(ours < poller && poller < daily);
  // by hand: 1 - exp(-3 * 4 / (14 * 1440)) = 0.000595
  assert.ok(Math.abs(ours - 0.000595) < 0.000002);
});

test('per active user the model adds up: revenue minus cost is the margin, and break-even is where they meet', () => {
  for (const s of Object.keys(SCENARIOS)) {
    const r = perMau(SCENARIOS[s]);
    assert.ok(Math.abs(r.revenue - (r.buy + r.studio + r.plan)) < 1e-9);
    assert.ok(Math.abs(r.cost - (r.listing + r.studioCost + r.watching + r.search + r.platform)) < 1e-9);
    assert.ok(Math.abs(r.margin - (r.revenue - r.cost)) < 1e-9);
    const be = breakEvenPurchases(SCENARIOS[s]);
    const at = perMau({ ...SCENARIOS[s], purchases_per_mau: be });
    if (be > 0) assert.ok(Math.abs(at.margin) < 1e-6, `${s} break-even ${be}`);
    else assert.ok(at.margin >= 0, `${s} pays for itself before any purchase`);
  }
});

test('the scenarios are ordered: conservative earns least per user, flattering most', () => {
  const m = k => perMau(SCENARIOS[k]).margin;
  assert.ok(m('conservative') < m('base') && m('base') < m('flattering'));
});

test('the seller value matches the fee bench: $18.69 on Depop against $16.00 on Poshmark for a $20 item', async () => {
  const { sellerValue } = await import('./roi.mjs');
  const r = sellerValue(20);
  assert.deepEqual(r.best, ['depop', 18.69]);
  assert.equal(r.site_choice, 2.69);
});

test('at scale the fixed platform cost spreads out', () => {
  const small = atScale(SCENARIOS.base, 10_000), big = atScale(SCENARIOS.base, 1_000_000);
  assert.ok(big.margin_per_mau > small.margin_per_mau);
});
