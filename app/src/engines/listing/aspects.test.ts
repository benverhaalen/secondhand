import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aspectRows, aspectGaps } from './aspects.ts';
import { buildListing, type ItemCard } from './build.ts';
import { missingFor } from '../capture/complete.ts';

const reply = JSON.parse(readFileSync(new URL('../../../../spec/fixtures/ebay/aspects-mens-tshirts.json', import.meta.url), 'utf8'));
const tee = (attrs: ItemCard['attrs']): ItemCard => ({ item_id: 'i1', kind: 'apparel', attrs: { condition: said('good'), ...attrs }, photos: [{ photo_id: 'p1', score: 1 }] });
const said = (value: string) => ({ value, source: 'you_said' as const, confirmed: true });

test("eBay's aspects become requirement rows under eBay's own names, ranked by what buyers search", () => {
  const rows = aspectRows('apparel', reply);
  const by = (n: string) => rows.find(r => r.site_names.ebay.name === n)!;
  assert.equal(by('Brand').field, 'brand');
  assert.equal(by('Color').field, 'colour');
  assert.equal(by('Neckline').field, 'ebay:Neckline', 'an aspect we have no field for keeps its eBay name');
  assert.equal(by('Brand').site_names.ebay.required, true);
  assert.equal(by('Color').site_names.ebay.required, false);
  assert.equal(by('Brand').importance.rank.ebay, 'high');
  assert.equal(by('Material').importance.rank.ebay, 'medium', 'recommended without search data');
  assert.equal(by('Theme').importance.rank.ebay, 'low', 'optional');
  assert.deepEqual(by('Size').allowed, ['S', 'M', 'L', 'XL']);
  assert.ok(rows.every(r => r.site_names.ebay && Object.keys(r.site_names).length === 1), 'eBay data stays on eBay rows only');
});

test('capture owns draft readiness; required and recommended eBay aspect gaps stay explicit', () => {
  const rows = aspectRows('apparel', reply);
  const item = tee({ brand: said('Patagonia'), size_label: said('M'), department: said('Men') });
  const listing = buildListing(item, 'ebay', { rows, price_cents: 3000, floor_cents: 2000, posted_before: true, promoted: false });
  assert.deepEqual(listing.missing, []);
  assert.equal(listing.fields.Brand, 'Patagonia');
  const gaps = aspectGaps(item, rows);
  assert.deepEqual(gaps.required, []);
  assert.deepEqual(gaps.recommended, ['colour', 'material', 'ebay:Neckline']);
  const card = tee({ size_label: said('M'), department: said('Men') });
  const noBrand = buildListing(card, 'ebay', { rows, price_cents: 3000, floor_cents: 2000, posted_before: true, promoted: false });
  assert.deepEqual(noBrand.missing, missingFor(card.attrs, card.kind, 'ebay', 'tap'));
  assert.deepEqual(aspectGaps(card, rows).required, ['brand']);
  delete card.attrs.condition;
  assert.deepEqual(buildListing(card, 'ebay', { rows, price_cents: 3000, floor_cents: 2000, posted_before: true, promoted: false }).missing, ['condition']);
});

test("a value outside a selection-only aspect's list is flagged, so it never reaches eBay as is", () => {
  const rows = aspectRows('apparel', reply);
  const gaps = aspectGaps(tee({ brand: said('Patagonia'), size_label: said('Medium'), department: said('Men') }), rows);
  assert.deepEqual(gaps.invalid, [{ field: 'size_label', aspect: 'Size', value: 'Medium', allowed: ['S', 'M', 'L', 'XL'] }]);
});

test('an unknown free text aspect limit refuses rather than guessing 65', () => {
  assert.throws(() => aspectRows('apparel', {aspects: [{localizedAspectName: 'Brand', aspectConstraint: {aspectMode:'FREE_TEXT'}}]}), /aspectMaxLength/);
});
