import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTS } from '../../../../spec/sites.mjs';
import { PROFILES, STOREFRONT_FIELDS, hasVerb, storefrontMissing } from './platform.ts';
import { SITES, VERBS, createHarness, fakeAdapter } from './protocol.ts';

test('every site has a profile with every verb answered, present or absent with a reason', () => {
  for (const site of SITES) for (const verb of VERBS) {
    const h = PROFILES[site].verbs[verb];
    assert.ok(h === true || (typeof h.absent === 'string' && h.absent.length > 10), `${site}.${verb}`);
  }
});

test('a verb the site lacks answers no_route with the reason, before any adapter runs', async () => {
  let ran = 0;
  const harness = createHarness({ adapters: [{ ...fakeAdapter('offerup', 'post'), run: async () => { ran++; return { ok: true as const, data: {} }; } }] });
  const e = await harness.call('offerup', 'post', { operation_id: 'op-1' });
  assert.ok(!e.ok && e.error.code === 'no_route' && /planned, not built/.test(e.error.message) && 'url' in e.error.hint && e.error.hint.url.startsWith('https://'));
  assert.equal(ran, 0);
  const fb = await createHarness({ adapters: [] }).call('facebook', 'read_offers');
  assert.ok(!fb.ok && /chat/.test(fb.error.message));
  assert.equal(hasVerb('depop', 'post'), true);
});

test('clocks and rules are the spec/sites.mjs facts, not copies', () => {
  const facts = FACTS as Record<string, Record<string, { v: unknown }>>;
  assert.equal(PROFILES.ebay.clocks['offer.buyer.expires_h'].v, facts['offer.buyer.expires_h'].ebay.v);
  assert.equal(PROFILES.ebay.clocks['offer.counter.expires_h'].v, 96);
  assert.equal(PROFILES.poshmark.clocks['offer.seller.expires_h'], undefined, 'an UNKNOWN fact is left out, never guessed');
  assert.deepEqual(PROFILES.offerup.clocks, {}, 'a site sites.mjs does not cover has no clocks');
});

test('listing fields and limits are the platform-fit entry', () => {
  assert.equal((PROFILES.ebay.listing?.title as { max: number }).max, 80);
  for (const site of SITES) assert.ok(PROFILES[site].listing, site);
});

test('storefront: each site names the figures it shows, the rest are fields_missing', () => {
  for (const site of SITES) {
    const shows = PROFILES[site].storefront.shows, missing = storefrontMissing(site);
    assert.deepEqual([...shows, ...missing].sort(), [...STOREFRONT_FIELDS].sort(), site);
    assert.ok(PROFILES[site].storefront.src.startsWith('research/list/ben/platforms/'));
  }
  assert.ok(storefrontMissing('ebay').includes('likes'), 'eBay has no likes to work (ebay.md §1)');
});
