import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchSource } from './search.ts';
import { SOURCES } from './sources.ts';
import { createHarness, fakeAdapter } from '../../harness/protocol.ts';

// Nate, 2026-11-15: "Why do photos not show up? ensure all data is sent to the server". A harness read's listing
// reached the row with eight of its fields; the photo, brand, shipping and the rest were dropped in one map.
test('every field a harness read returns reaches the row, under the row\'s names, and the slug and state do not', async () => {
  const listing = { external_id: 'e1', title: 'Patagonia Retro-X', price_cents: 8900, currency: 'USD', url: 'https://www.ebay.com/itm/e1', state: 'active',
    image_url: 'https://i.ebayimg.com/images/g/x/s-l500.webp', brand: 'Patagonia', size: 'M', condition: 'Pre-Owned', shipping_cents: 599,
    buying_format: 'Buy It Now', watchers: 12, ships_from: 'Denver, Colorado', listed_at: '2026-11-01', sold_at: '2026-11-10', slug: 'handle-patagonia-retro-x-ab12', seller_ref_hash: 'h1' };
  const ebay = SOURCES.find(s => s.id === 'ebay')!;
  const result = await searchSource(ebay, 'patagonia retro-x', 'search', { paced: true, caller: 'person', visitor_id: 'fields',
    harness: createHarness({ adapters: [{ ...fakeAdapter('ebay', 'search'), run: async () => ({ ok: true as const, data: [listing] }) }] }) });
  assert.equal(result.searched.outcome, 'hit');
  const row = result.rows[0] as Record<string, unknown>;
  for (const [name, value] of Object.entries({ id: 'e1', image_url: listing.image_url, brand: 'Patagonia', size: 'M', condition: 'Pre-Owned', shipping_cents: 599,
    buying_format: 'Buy It Now', watchers: 12, ships_from: 'Denver, Colorado', listed_at: '2026-11-01', sold_date: '2026-11-10', seller_hash: 'h1' }))
    assert.equal(row[name], value, name);
  for (const gone of ['external_id', 'slug', 'state', 'sold_at', 'seller_ref_hash']) assert.equal(gone in row, false, gone);
});
