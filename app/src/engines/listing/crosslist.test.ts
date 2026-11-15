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
  price_cents: 3000, currency: 'USD', brand: 'Champion', size: 'L', condition: 'good', colours: ['red'], department: 'menswear',
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
  assert.equal(planCrosslist([tee({ state: 'sold' }), tee({ external_id: '102' })], { rows, linked: LINKED }).length, 1);
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
  const plans = planCrosslist([tee()], { rows, linked: LINKED });
  const none = await postCrosslist(plans, post, () => false);
  assert.equal(calls.length, 0);
  assert.ok(none.every(r => r.state === 'not_approved' || r.state === 'not_ready'));
  const res = await postCrosslist(plans, post, (_p, site) => site === 'ebay');
  assert.deepEqual(calls, [{ site: 'ebay', op: operationId(plans[0], 'ebay') }]);
  assert.equal(res.find(r => r.site === 'ebay')?.state, 'posted');
});
