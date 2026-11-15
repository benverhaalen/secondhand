import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTag, matchBrands } from './parse.ts';

const root = new URL('../../../../../', import.meta.url);
const record = JSON.parse(readFileSync(new URL('spec/items/capture-real/2026-11-15.json', root), 'utf8')) as {items: {item: string; manifest: string}[]};
function garment(item: string) {
  const row = record.items.find(row => row.item === item)!;
  const manifest = JSON.parse(readFileSync(new URL(row.manifest, root), 'utf8')) as {read: {tag_text: string}};
  return parseTag([{line: manifest.read.tag_text, confidence: 0}]);
}
const field = (result: ReturnType<typeof parseTag>, name: string) => result.facts.filter(fact => fact.field === name);

test('Carhartt RN and lexicon survive while translated cotton is counted once', () => {
  const out = garment('carhartt-pants');
  assert.ok(out.brands.some(b => b.brand === 'Carhartt' && b.s === 1 && b.rule === 'rn'));
  assert.ok(out.brands.some(b => b.brand === 'Carhartt' && b.s === 0.9 && b.rule === 'brand_lexicon'));
  for (const [name, value] of Object.entries({size_label: '38x36', fabric: '100% cotton', origin: 'Mexico', colour: 'black', style_code: 'B324'}))
    assert.deepEqual(field(out, name).map(f => f.value), [value]);
  assert.equal(out.style_code?.value, 'B324');
  assert.ok(out.facts.every(f => f.source === 'label' && f.confidence === 0 && f.rule));
});

test('Russell keeps XXL and Mexico without inventing fabric', () => {
  const out = garment('chico-hoodie');
  assert.equal(out.brands[0].brand, 'Russell Athletic');
  assert.equal(field(out, 'size_label')[0]?.value, 'XXL');
  assert.equal(field(out, 'origin')[0]?.value, 'Mexico');
  assert.equal(field(out, 'fabric').length, 0);
});

test('Fruit of the Loom keeps XL and its cotton and Honduras facts', () => {
  const out = garment('marquette-tee');
  assert.equal(out.brands[0].brand, 'Fruit of the Loom');
  assert.equal(field(out, 'size_label')[0]?.value, 'XL');
  assert.equal(field(out, 'fabric')[0]?.value, '100% cotton');
  assert.equal(field(out, 'origin')[0]?.value, 'Honduras');
});

test('embedded letters never become brand or size matches', () => {
  assert.equal(matchBrands('GAPPED').length, 0);
  const out = parseTag([{line: 'Made in Mexico Dearborn, MI 48121 P.O. Box 600', confidence: 1}]);
  assert.equal(field(out, 'size_label').length, 0);
  assert.equal(out.style_code, undefined);
  assert.equal(matchBrands('CARHARTT')[0]?.brand, 'Carhartt');
  assert.equal(matchBrands('Levi Strauss')[0]?.brand, "Levi's");
});

test('ambiguous sizes and impossible fabric totals abstain', () => {
  const out = parseTag([{line: 'M XL 60% cotton 60% polyester', confidence: 1}]);
  assert.equal(field(out, 'size_label').length, 0);
  assert.equal(field(out, 'fabric').length, 0);
});

test('shoe numbers require a sizing system and style and colour require local context', () => {
  assert.equal(field(parseTag([{line: '10', confidence: 1}]), 'size_label').length, 0);
  assert.equal(field(parseTag([{line: 'US 10', confidence: 0.8}]), 'size_label')[0]?.value, '10');
  assert.equal(parseTag([{line: 'AB123 far away from everything BLK', confidence: 1}]).style_code, undefined);
  assert.equal(parseTag([{line: 'RN14806 BLK M', confidence: 1}]).style_code, undefined);
  assert.equal(parseTag([{line: 'SW1A 1AA BLK M', confidence: 1}]).style_code, undefined);
  assert.equal(field(parseTag([{line: 'BLK M', confidence: 1}]), 'colour').length, 0);
});

test('facts use the least confidence of their supporting lines', () => {
  const out = parseTag([{line: '60% Cotton', confidence: 0.95}, {line: '40% Polyester', confidence: 0.4}]);
  assert.equal(field(out, 'fabric')[0]?.value, '60% cotton, 40% polyester');
  assert.equal(field(out, 'fabric')[0]?.confidence, 0.4);
});

test('a UK postcode beside a size cannot be mistaken for a style', () => {
  assert.equal(parseTag([{line: 'Carhartt AB12 3CD BLK M', confidence: 1}]).style_code, undefined);
});

test('a percentage beside a sizing-system label cannot become a shoe size', () => {
  assert.equal(field(parseTag([{line: 'US 60% cotton', confidence: 1}]), 'size_label').length, 0);
});

test('possessive brand and department endings cannot become size S', () => {
  for (const line of ["Levi's", 'Levi’s']) assert.equal(field(parseTag([{line, confidence: 1}]), 'size_label').length, 0);
  assert.equal(field(parseTag([{line: "Levi's 38 X 36", confidence: 1}]), 'size_label')[0]?.value, '38x36');
  assert.equal(field(parseTag([{line: "MEN'S XL", confidence: 1}]), 'size_label')[0]?.value, 'XL');
});

test('an observed RN number is not evidence for the same digits in the CA registry', () => {
  assert.equal(parseTag([{line: 'CA14806', confidence: 1}]).brands.length, 0);
});

test('the lexicon includes brands in demo titles as well as structured brand fields', () => {
  const source = readFileSync(new URL('app/src/demo/worlds/flipper.ts', root), 'utf8');
  assert.ok(source.includes('Champion reverse weave hoodie'));
  assert.equal(matchBrands('Champion reverse weave hoodie')[0]?.brand, 'Champion');
  assert.equal(matchBrands('NIKEISH').length, 0);
});
