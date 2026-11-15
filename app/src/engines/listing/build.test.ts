import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildListing, buildAll } from './build.ts';
import type { Attr, ItemCard, Requirement } from './build.ts';
import { buildTitle } from '../../../../scripts/listing-lint.mjs';

const { rows }: { rows: Requirement[] } = JSON.parse(readFileSync(new URL('../../../../spec/fixtures/requirement/requirement.json', import.meta.url), 'utf8'));
const { platforms } = JSON.parse(readFileSync(new URL('../../../../research/list/ben/platforms/platform-fit.json', import.meta.url), 'utf8'));
const attr = (value: Attr['value'], source: Attr['source'] = 'label', confirmed = true): Attr => ({ value, source, confirmed });
const item = (): ItemCard => ({ item_id: 'item_1', kind: 'apparel', attrs: {
  brand: attr('Acme'), type: attr('Shirt'), size_label: attr('M'), condition: attr('Good'), colour: attr('Blue'),
}, photos: Array.from({ length: 30 }, (_, i) => ({ photo_id: `photo_${i}`, score: i % 7 })) });
const opts = { rows, price_cents: 4200, floor_cents: 3000, posted_before: false, promoted: false };

test('unknown required size is missing and asked once across two sites', () => {
  const card = item(); delete card.attrs.size_label;
  const result = buildAll(card, ['ebay', 'depop'], opts);
  assert.deepEqual(result.asks, [{ kind: 'clarify', field: 'size_label', sites: ['ebay', 'depop'] }]);
  for (const listing of result.listings) {
    assert.deepEqual(listing.missing, ['size_label']); assert.equal(listing.ready, false);
    assert.equal(Object.hasOwn(listing.fields, 'size_label'), false);
  }
});

test('title follows each site profile and stays within its limit on overflowing facts', () => {
  const card = item(); card.attrs.model = attr('Detailed model '.repeat(30));
  for (const site of ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'] as const) {
    const listing = buildListing(card, site, opts);
    const facts = { brand: 'Acme', type: 'Shirt', size_label: 'M', size: 'M', condition: 'Good', colour: 'Blue', color: 'Blue', model: card.attrs.model.value };
    assert.equal(listing.title, buildTitle(site, facts, []));
    assert.ok(listing.title.length <= (platforms[site].title.max ?? platforms[site].title.aim[1]));
    assert.ok(!listing.title.includes('Detailed'));
  }
});

test('unconfirmed inferred size, condition and authenticity cannot fill required fields; colour can', () => {
  for (const field of ['size_label', 'size_system', 'condition', 'authenticity']) {
    const card = item(); card.attrs[field] = attr('Inferred', 'inferred', false);
    card.attrs.colour = attr('Blue', 'inferred', false);
    const extra = [field, 'colour'].map(name => ({ ...rows[0], field: name, role: 'search', site_names: { ebay: { name, max_length: 65, required: true } } }));
    const listing = buildListing(card, 'ebay', { ...opts, rows: extra });
    assert.deepEqual(listing.missing, [field]); assert.equal(listing.fields.colour, 'Blue');
    assert.equal(Object.hasOwn(listing.fields, field), false);
    card.attrs[field].confirmed = true;
    assert.deepEqual(buildListing(card, 'ebay', { ...opts, rows: extra }).missing, []);
  }
});

test('price under floor is clamped; a higher posture price is preserved', () => {
  assert.equal(buildListing(item(), 'ebay', { ...opts, price_cents: 1000 }).price_cents, 3000);
  assert.equal(buildListing(item(), 'ebay', opts).price_cents, 4200);
});

test('photos are strongest first, capped per site, stable on ties and never mutate inputs', () => {
  const card = item(), before = structuredClone(card);
  for (const site of ['ebay', 'depop', 'facebook', 'poshmark', 'mercari'] as const) {
    const listing = buildListing(card, site, opts);
    assert.deepEqual(listing.photo_ids, [...card.photos].sort((a, b) => b.score - a.score || a.photo_id.localeCompare(b.photo_id)).slice(0, platforms[site].photos.max).map(p => p.photo_id));
    assert.deepEqual(buildListing(card, site, opts), listing);
  }
  assert.deepEqual(card, before);
});

test('first_post asks before first live post unless promoted; subsequent posts have no decision', () => {
  assert.deepEqual(buildListing(item(), 'ebay', opts).decision, { kind: 'first_post', ask: true });
  assert.deepEqual(buildListing(item(), 'ebay', { ...opts, promoted: true }).decision, { kind: 'first_post', ask: false });
  assert.equal(buildListing(item(), 'ebay', { ...opts, posted_before: true }).decision, null);
});

test('complete fixture is ready, unrelated kinds do not contribute missing fields, recall blocks readiness', () => {
  const card = item();
  assert.equal(buildListing(card, 'ebay', opts).ready, true);
  assert.deepEqual(buildListing(card, 'ebay', opts).missing, []);
  card.recall_flag = true;
  assert.equal(buildListing(card, 'ebay', opts).ready, false);
});

test('search fields precede other fields in site rank order and use site field names', () => {
  const card = item(); card.attrs.fabric = attr('Cotton');
  const ranked = rows.filter(r => r.item_kind === 'apparel').map(r => ({ ...r,
    role: ['brand', 'fabric'].includes(r.field) ? 'search' : r.role,
    site_names: { ebay: { ...r.site_names.ebay, name: `site_${r.field}` } },
  }));
  const listing = buildListing(card, 'ebay', { ...opts, rows: ranked });
  assert.deepEqual(Object.keys(listing.fields).slice(0, 2), ['site_brand', 'site_fabric']);
  assert.equal(listing.fields.site_size_label, 'M');
});

test('required whitespace, empty arrays and values too long for one whole word remain missing', () => {
  for (const value of ['', '   ', [], ['  '], 'X'.repeat(70)]) {
    const card = item(); card.attrs.size_label = attr(value);
    assert.ok(buildListing(card, 'ebay', opts).missing.includes('size_label'));
  }
});

test('site field limits cut only at whole words; false and zero remain allowed values', () => {
  const card = item(); card.attrs.brand = attr('Alpha Beta Gamma');
  card.attrs.fabric = attr(false); card.attrs.sleeve_length = attr(0);
  const limited = rows.map(r => r.field === 'brand' ? { ...r, site_names: { ebay: { name: 'Brand', required: true, max_length: 12 } } } : r);
  const listing = buildListing(card, 'ebay', { ...opts, rows: limited });
  assert.equal(listing.fields.Brand, 'Alpha Beta');
  assert.equal(listing.fields.fabric, false); assert.equal(listing.fields.sleeve_length, 0);
});

test('money boundaries reject invalid floor and price with the field name', () => {
  for (const field of ['price_cents', 'floor_cents']) for (const value of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => buildListing(item(), 'ebay', {...opts, [field]: value}), new RegExp(field));
});
test('tied photo scores use photo id', () => {
  const card = item(); card.photos = [{photo_id:'b',score:1},{photo_id:'a',score:1}];
  assert.deepEqual(buildListing(card,'ebay',opts).photo_ids, ['a','b']);
});
