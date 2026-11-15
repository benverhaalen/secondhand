import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DENSITIES, DEFAULT_DENSITY, PRESETS, filtersFor, pinchDensity, viewItems, type SellItem } from './grid.ts';

const item = (id: string, over: Partial<SellItem> = {}): SellItem =>
  ({ id, pill: 'Live', sites: ['ebay'], price_cents: 1000, listed_at: '2026-11-10T00:00:00Z', ...over });

const jacket = item('jacket', { price_cents: 4400, listed_at: '2026-11-14T00:00:00Z', sites: ['ebay', 'depop'] });
const desk = item('desk', { price_cents: 12000, listed_at: '2026-11-12T00:00:00Z', sites: ['facebook'], pill: 'Offer' });
const jersey = item('jersey', { price_cents: 2500, listed_at: '2026-11-13T00:00:00Z', sites: [], pill: 'Review' });
const draft = item('draft', { price_cents: null, listed_at: '2026-11-11T00:00:00Z', sites: [], pill: 'Researching' });
const all = [desk, jacket, draft, jersey];
const ids = (items: SellItem[]) => items.map(i => i.id);

test('latest first is the default order, and price sorts put items with no price last', () => {
  assert.deepEqual(ids(viewItems(all, {})), ['jacket', 'jersey', 'desk', 'draft']);
  assert.deepEqual(ids(viewItems(all, { sort: 'price_high' })), ['desk', 'jacket', 'jersey', 'draft']);
  assert.deepEqual(ids(viewItems(all, { sort: 'price_low' })), ['jersey', 'jacket', 'desk', 'draft']);
});

test('a store filter exists only for stores that hold an item, and a state filter only for states in use', () => {
  const f = filtersFor(all);
  assert.deepEqual(f.sites, ['ebay', 'facebook', 'depop']);
  assert.deepEqual(f.pills, ['Researching', 'Review', 'Live', 'Offer']);
  assert.deepEqual(filtersFor([]), { sites: [], pills: [] });
});

test('store and state filters narrow together', () => {
  assert.deepEqual(ids(viewItems(all, { site: 'depop' })), ['jacket']);
  assert.deepEqual(ids(viewItems(all, { pills: ['Offer', 'Review'] })), ['jersey', 'desk']);
  assert.deepEqual(ids(viewItems(all, { site: 'ebay', pills: ['Offer'] })), []);
});

test('the Needs you preset is every state that waits on the person', () => {
  const needs = PRESETS.find(p => p.id === 'needs_you');
  assert.deepEqual(needs?.view.pills, ['Review', 'Offer', 'Ship by', 'Failed']);
});

test('pinching out shows fewer, larger tiles and pinching in shows more, within the ends', () => {
  assert.equal(DENSITIES[DEFAULT_DENSITY].columns, 3);
  assert.equal(pinchDensity(DEFAULT_DENSITY, 1.4), DEFAULT_DENSITY - 1);
  assert.equal(pinchDensity(DEFAULT_DENSITY, 0.6), DEFAULT_DENSITY + 1);
  assert.equal(pinchDensity(DEFAULT_DENSITY, 1.05), DEFAULT_DENSITY);
  assert.equal(pinchDensity(0, 3), 0);
  assert.equal(pinchDensity(DENSITIES.length - 1, 0.1), DENSITIES.length - 1);
});

test('a denser grid only ever drops details, and the photo and state never drop', () => {
  for (let i = 1; i < DENSITIES.length; i++) {
    assert.ok(DENSITIES[i].columns > DENSITIES[i - 1].columns);
    for (const part of DENSITIES[i].shows) assert.ok(DENSITIES[i - 1].shows.includes(part), `${part} appears only when denser`);
  }
  for (const d of DENSITIES) assert.ok(d.shows.includes('photo') && d.shows.includes('pill'));
});
