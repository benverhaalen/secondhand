import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describe, fieldWhy, titleWhy } from './field-why.ts';
import { fields, find } from './model.ts';

const draft = () => { const f = find('it_draft'); assert.ok(f, 'it_draft'); return f.item; };
const field = (name: string) => { const f = fields(draft()).find(x => x.attr.name === name); assert.ok(f, name); return f; };

test('Why on a field says the reason in words first, and the source is its own line', () => {
  const size = fieldWhy(draft(), field("size"));
  assert.equal(size.says, 'The tag reads L.');
  assert.equal(size.source, 'From the tag: the close photo of the tag');
  const brand = fieldWhy(draft(), field("brand"));
  assert.equal(brand.says, 'The photos show Carhartt.');
  assert.equal(brand.source, 'From the photos: the photo of the whole front');
  const chest = fieldWhy(draft(), field("pit_to_pit"));
  assert.equal(chest.says, 'Measured on the photo with it laid flat: 24 in.');
  assert.equal(chest.source, 'Measured: the photo laid flat');
});

test('a field the person changed says so, and a blank says why it is blank', () => {
  const f = field('size');
  assert.equal(fieldWhy(draft(), f, "M").says, 'You changed it to M.');
  assert.equal(fieldWhy(draft(), { ...f, value: null, from: "Not in the photos" }, null).says, 'Not in the photos, so it’s yours to fill.');
});

test('the draft has a description written from its fields, and Why on the title and description names them', () => {
  const it = draft();
  assert.equal(describe(it), 'Carhartt Detroit Jacket. Brown, Men’s, size L, cotton duck, 1990s. Pit to pit 24 in, length 26 in, sleeve 33 in. Worn cuffs.');
  assert.equal(titleWhy(it).says, 'Written from what the photos and the tag show: the brand, the model, the color and the size.');
});
