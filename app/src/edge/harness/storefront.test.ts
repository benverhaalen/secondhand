import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryAccounts, memoryVault } from '../browser/auth.ts';
import { sweepStorefronts, toSnapshot, type StorefrontSnapshot } from './storefront.ts';
import { createHarness, fakeAdapter, type Site } from './protocol.ts';

test('the sweep reads each linked storefront once and stores a snapshot; a planted unlinked site gets zero calls', async () => {
  const vault = memoryVault();
  await vault.put('ref-d', { cookies: [], origins: [] });
  await vault.put('ref-e', { cookies: [], origins: [] });
  const accounts = memoryAccounts([
    { account_id: 'a-depop', person_id: 'p1', site: 'depop', token_ref: 'ref-d' },
    { account_id: 'a-ebay', person_id: 'p1', site: 'ebay', token_ref: 'ref-e' },
    { account_id: 'a-mercari', person_id: 'p1', site: 'mercari' },             // planted: not linked
    { account_id: 'a-other', person_id: 'p2', site: 'poshmark', token_ref: 'ref-d' },
  ], vault);
  const calls: Site[] = [];
  const sites: Site[] = ['depop', 'ebay', 'mercari', 'poshmark'];
  const harness = createHarness({ adapters: sites.map(s => { const a = fakeAdapter(s, 'read_storefront'); return { ...a, run: (x, sig) => { calls.push(s); return a.run(x, sig); } }; }) });
  const rows: StorefrontSnapshot[] = [];
  const out = await sweepStorefronts({ accounts, harness, store: { put: async r => { rows.push(r); } }, person_id: 'p1', now: () => new Date('2026-11-15T05:00:00Z') });
  assert.deepEqual(calls.sort(), ['depop', 'ebay']);
  assert.deepEqual(out.swept.sort(), ['a-depop', 'a-ebay']);
  assert.equal(rows.length, 2);
  const ebay = rows.find(r => r.site === 'ebay')!;
  assert.equal(ebay.shop.sold_count, 51);
  assert.equal(ebay.as_of, '2026-11-15T05:00:00.000Z');
  assert.ok(ebay.fields_missing.includes('likes'), 'eBay does not show likes');
  assert.ok(!ebay.fields_missing.includes('rating'));
  assert.equal(ebay.citation_id, 'obs-fake-1');
});

test('a site that fails is reported, and the others are still stored', async () => {
  const vault = memoryVault();
  await vault.put('r', { cookies: [], origins: [] });
  const accounts = memoryAccounts([{ account_id: 'a1', person_id: 'p', site: 'depop', token_ref: 'r' }, { account_id: 'a2', person_id: 'p', site: 'ebay', token_ref: 'r' }], vault);
  const harness = createHarness({ adapters: [fakeAdapter('depop', 'read_storefront'),
    { ...fakeAdapter('ebay', 'read_storefront'), run: a => fakeAdapter('ebay', 'read_storefront').run({ ...a, fake: 'blocked' }, new AbortController().signal) }] });
  const rows: StorefrontSnapshot[] = [];
  const out = await sweepStorefronts({ accounts, harness, store: { put: async r => { rows.push(r); } } });
  assert.deepEqual(out.swept, ['a1']);
  assert.deepEqual(out.failed, [{ account_id: 'a2', code: 'blocked' }]);
});

test('untrusted data: wrong types and negative counts are dropped and named missing; a non-object is refused', () => {
  const s = toSnapshot('a', 'depop', { followers: '12', rating: 4.8, sold_count: -3, views: 900, extra: 'x' }, { as_of: 't', window_days: 30, citation_id: 'c' });
  assert.ok(!('refused' in s));
  if ('refused' in s) return;
  assert.equal(s.shop.rating, 4.8);
  assert.equal(s.totals.views, 900);
  assert.ok(s.fields_missing.includes('followers') && s.fields_missing.includes('sold_count'));
  assert.equal((s.shop as Record<string, unknown>).extra, undefined);
  assert.ok('refused' in toSnapshot('a', 'depop', [1, 2], { as_of: 't', window_days: 30, citation_id: 'c' }));
});

test('read_storefront on a search-only site answers no_route with the reason', async () => {
  const e = await createHarness({ adapters: [] }).call('grailed', 'read_storefront');
  assert.ok(!e.ok && e.error.code === 'no_route' && /search and price only/.test(e.error.message));
});
