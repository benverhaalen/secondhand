import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planCrosslist, planItem, postCrosslist, productType, operationId, type Post, type Site, type SourceListing } from './crosslist.ts';
import { keep } from '../valuation/keep.ts';

const { rows } = JSON.parse(readFileSync(new URL('../../../../spec/fixtures/requirement/requirement.json', import.meta.url), 'utf8'));
const LINKED: Site[] = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'];

const tee = (over: Partial<SourceListing> = {}): SourceListing => ({
  site: 'depop', external_id: '101', url: 'https://www.depop.com/products/x/', state: 'active',
  title: 'Vintage 90s Champion Wisconsin Badgers reverse weave tee', description: 'Vintage 90s Champion Wisconsin Badgers reverse weave tee\n#vintage #badgers',
  price_cents: 3000, floor_cents: 2400, currency: 'USD', brand: 'Champion', size: 'L', condition: 'good', colours: ['red'], department: 'menswear',
  category: 'tshirts', tags: ['vintage', 'badgers'], photos: ['p0', 'p1', 'p2'], ...over,
});

test('every other linked site keeps what the Depop listing keeps today', () => {
  const plan = planItem(tee(), { rows, linked: LINKED });
  const target = keep('depop', 3000).keep_cents;
  assert.equal(plan.target_keep_cents, target);
  const priced = plan.sites.filter(d => d.price_cents !== undefined);
  assert.ok(priced.length >= 2);
  for (const d of priced) assert.ok((d.keep_cents as number) >= target && (d.keep_cents as number) - target < 200, `${d.site} keeps ${d.keep_cents} for ${target}`);
  assert.ok(!plan.sites.some(d => d.site === 'depop'), 'the source site is not a target');
});

test('a site the person did not link gets no draft', () => {
  const plan = planItem(tee(), { rows, linked: ['depop', 'ebay'] });
  assert.deepEqual(plan.sites.map(d => d.site), ['ebay']);
});

test('sold listings are comps, not cross-listed', () => {
  assert.equal(planCrosslist([tee({ state: 'sold' }), tee({ external_id: '102' })], { rows, linked: LINKED }).plans.length, 1);
});

test('product type routes by what the listing says', () => {
  assert.equal(productType(tee()), 'vintage_clothing');
  assert.equal(productType(tee({ title: 'Travis Scott Cactus Jack tee', description: '', tags: [], brand: undefined })), 'streetwear');
  assert.equal(productType(tee({ title: 'Patagonia Baggies shorts', description: '', tags: [], brand: 'Patagonia', category: 'shorts' })), 'outdoor_apparel');
  assert.equal(productType(tee({ title: 'Nike Dunk Low', description: '', tags: [], brand: 'Nike', category: 'sneakers' })), 'sneakers');
});

test('a missing size is asked once across the sites that require it, and those drafts are not ready', () => {
  const plan = planItem(tee({ size: undefined }), { rows, linked: LINKED });
  const ask = plan.asks.find(a => a.field === 'size_label');
  assert.ok(ask && ask.sites.includes('ebay'));
  assert.equal(plan.sites.find(d => d.site === 'ebay')?.listing?.ready, false);
});

test('posting runs only for ready, approved drafts, with one operation id per listing and site', async () => {
  const calls: { site: Site; op: unknown }[] = [];
  const post: Post = async (site, args) => { calls.push({ site, op: args.operation_id }); return { ok: true }; };
  const { plans } = planCrosslist([tee()], { rows, linked: LINKED });
  const none = await postCrosslist(plans, post, () => false);
  assert.equal(calls.length, 0);
  assert.ok(none.every(r => r.state === 'not_approved' || r.state === 'not_ready'));
  const res = await postCrosslist(plans, post, (_p, site) => site === 'ebay');
  assert.deepEqual(calls, [{ site: 'ebay', op: operationId(plans[0], 'ebay') }]);
  assert.equal(res.find(r => r.site === 'ebay')?.state, 'posted');
});

test('the floor keeps the same payout on every site; with no floor the draft asks for one and is not ready', () => {
  const plan = planItem(tee(), { rows, linked: LINKED });
  const floorKeep = keep('depop', 2400).keep_cents;
  for (const d of plan.sites.filter(d => d.floor_cents !== undefined)) {
    assert.ok((d.floor_cents as number) <= (d.price_cents as number));
    assert.equal(d.listing?.price_cents, d.price_cents, 'the floor never raises the price');
  }
  assert.ok(floorKeep < plan.target_keep_cents);
  const none = planItem(tee({ floor_cents: undefined }), { rows, linked: LINKED });
  assert.ok(none.asks.some(a => a.field === 'floor'));
  assert.ok(none.sites.every(d => !d.listing || d.listing.ready === false));
});

test('a listing priced in another currency is skipped with its reason', () => {
  const { plans, skipped } = planCrosslist([tee({ currency: 'GBP' })], { rows, linked: LINKED });
  assert.equal(plans.length, 0);
  assert.match(skipped[0].why, /GBP/);
});

test('a site where the item is already live gets no draft', () => {
  const plan = planItem(tee(), { rows, linked: LINKED, live_on: (_l, site) => site === 'ebay' });
  const ebay = plan.sites.find(d => d.site === 'ebay');
  assert.equal(ebay?.action, 'live');
  assert.equal(ebay?.listing, undefined);
});

test('a post whose outcome is unknown is reconciled, not marked failed or posted', async () => {
  const { plans } = planCrosslist([tee()], { rows, linked: LINKED });
  const post: Post = async () => ({ ok: false, error: { code: 'outcome_unknown' } });
  const res = await postCrosslist(plans, post, (_p, site) => site === 'ebay');
  assert.equal(res.find(r => r.site === 'ebay')?.state, 'reconcile');
});

test('each spread prices the other sites its own way, keeps the same floor, and gives a plain reason before the numbers', () => {
  const at = (spread: Parameters<typeof planItem>[1]['spread'], extra = {}) => planItem(tee(), { rows, linked: LINKED, spread, ...extra });
  const keepSame = at('same_keep'), samePrice = at('same_price'), home = at('home_first');
  const market = at('site_market', { site_market: (_l: SourceListing, site: Site) => (site === 'ebay' ? 4200 : undefined) });
  for (const d of samePrice.sites) if (d.price_cents !== undefined) assert.equal(d.price_cents, 3000);
  const on = (p: typeof keepSame, site: Site) => p.sites.find(d => d.site === site)!;
  assert.ok(on(home, 'ebay').price_cents! > on(keepSame, 'ebay').price_cents!);
  assert.equal(on(market, 'ebay').price_cents, 4200);
  assert.equal(on(market, 'poshmark').price_cents, on(keepSame, 'poshmark').price_cents, 'no market range falls back to the same take-home');
  for (const p of [keepSame, samePrice, home, market]) {
    assert.deepEqual(p.sites.map(d => d.floor_cents), keepSame.sites.map(d => d.floor_cents));
    for (const d of p.sites.filter(d => d.price_cents !== undefined)) {
      assert.ok(!/\$|\d/.test(d.why!.says), `the reason is words, not numbers: ${d.why!.says}`);
      assert.match(d.why!.numbers, /you get \$/);
    }
  }
});
