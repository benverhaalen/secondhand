import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTag, matchBrands } from './parse.ts';

const root = new URL('../../../../../', import.meta.url);
const record = JSON.parse(readFileSync(new URL('spec/items/capture-real/2026-11-15.json', root), 'utf8')) as {items: {item: string; manifest: string}[]};
const tagLines = JSON.parse(readFileSync(new URL('./fixtures/tag-lines.json', import.meta.url), 'utf8')) as {items: Record<string, string[]>};
function garment(item: string) {
  const row = record.items.find(row => row.item === item)!;
  const manifest = JSON.parse(readFileSync(new URL(row.manifest, root), 'utf8')) as {read: {tag_text: string}};
  assert.equal(tagLines.items[item].join(' '), manifest.read.tag_text);
  return parseTag(tagLines.items[item].map(line => ({line, confidence: 0})));
}
const field = (result: ReturnType<typeof parseTag>, name: string) => result.facts.filter(fact => fact.field === name);

test('Carhartt RN and lexicon survive while translated cotton is counted once', () => {
  const out = garment('carhartt-pants');
  assert.ok(out.brands.some(b => b.brand === 'Carhartt' && b.s === 1 && b.rule === 'rn'));
  assert.ok(out.brands.some(b => b.brand === 'Carhartt' && b.s === 0.9 && b.rule === 'brand_lexicon'));
  for (const [name, value] of Object.entries({size_label: '38x36', fabric: '100% cotton', origin: 'Mexico'}))
    assert.deepEqual(field(out, name).map(f => f.value), [value]);
  assert.equal(out.style_code, undefined);
  assert.deepEqual(field(out, 'colour'), []);
  assert.equal(field(out, 'size_label')[0]?.rule, 'waist_length');
  assert.ok(out.facts.every(f => f.source === 'label' && f.confidence === 0 && f.rule));
});

test('Russell keeps XXL and Mexico without inventing fabric', () => {
  const out = garment('chico-hoodie');
  assert.equal(out.brands[0].brand, 'Russell Athletic');
  assert.equal(field(out, 'size_label')[0]?.value, 'XXL');
  assert.equal(field(out, 'size_label')[0]?.rule, 'size_own_line');
  assert.equal(field(out, 'origin')[0]?.value, 'Mexico');
  assert.equal(field(out, 'fabric').length, 0);
});

test('Fruit of the Loom keeps XL and its cotton and Honduras facts', () => {
  const out = garment('marquette-tee');
  assert.equal(out.brands[0].brand, 'Fruit of the Loom');
  assert.equal(field(out, 'size_label')[0]?.value, 'XL');
  assert.equal(field(out, 'size_label')[0]?.rule, 'size_own_line');
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
  assert.equal(field(parseTag([{line: "MEN'S\nXL", confidence: 1}]), 'size_label')[0]?.value, 'XL');
});

test('an observed RN number is not evidence for the same digits in the CA registry', () => {
  assert.equal(parseTag([{line: 'CA14806', confidence: 1}]).brands.length, 0);
});

test('common English brand words require capitals or a brand cue even in demo titles', () => {
  const source = readFileSync(new URL('app/src/demo/worlds/flipper.ts', root), 'utf8');
  assert.ok(source.includes('Champion reverse weave hoodie'));
  assert.equal(matchBrands('Champion reverse weave hoodie').length, 0);
  assert.equal(matchBrands('CHAMPION')[0]?.brand, 'Champion');
  assert.equal(matchBrands('NIKEISH').length, 0);
});

const tag = (line: string) => parseTag([{line, confidence: 1}]);
for (const [line, expected] of [
  ['Made in Viet Nam', ['Viet Nam']], ['Made in Vietnam', ['Viet Nam']],
  ['Made in USA', ['United States']], ['Made in U.S.A.', ['United States']],
  ['Made in the USA of imported fabric', ['United States']], ['Made in the USA of imported materials', ['United States']],
  ['Made in China, Assembled in USA', ['China']], ['Made in China and Vietnam', ['China', 'Viet Nam']],
  ['Made in Italy, fabric from Japan', ['Italy']], ['Made in China, Made in USA', ['China', 'United States']],
  ['Made in UK', ['United Kingdom']], ['Made in UAE', ['United Arab Emirates']], ['Made in PRC', ['China']],
  ['Made in Hong Kong', ['Hong Kong']], ['Made in Korea', ['Korea, Republic of']],
  ['Hecho en México', ['Mexico']], ['Fabriqué au Mexique', ['Mexico']], ['Fabriqué en France', ['France']],
  ['Made in Atlantis', []], ['Made in Chinaland', []], ['Made in United', []],
  ['Assembled in USA', []], ['fabric from Japan', []],
] as const) test(`origin closed list avoids truncation or unrelated country: ${line}`, () => {
  assert.deepEqual(field(tag(line), 'origin').map(fact => fact.value), expected);
});

for (const line of ['U.S.A.', 'Made in U.S.A.', 'Do not use chlorine bleach L', 'bleach L', 'L.L.Bean L', 'Style S 100', 'Style AB1234 Size M\nL', "MEN'S XL"])
  test(`size without a label, standalone line or system abstains: ${line}`, () => {
    assert.deepEqual(field(tag(line), 'size_label'), []);
  });
for (const [line, value] of [['M', 'M'], ['XS', 'XS'], ['L.L.Bean\nL', 'L'], ['Size M', 'M'], ['Sz: XL', 'XL'], ['US M', 'M'], ['EU 40', '40'], ['Size 9 US', '9'], ['38 X 36', '38x36']])
  test(`size context establishes the token: ${line}`, () => assert.equal(field(tag(line), 'size_label')[0]?.value, value));
test('numeric Size label alone is not a shoe-size system', () => assert.deepEqual(field(tag('Size 9'), 'size_label'), []));

for (const line of ['AB1234 Size M', 'AB1234 BLK M', 'Carhartt\nAB1234 BLK Size M'])
  test(`style proximity alone is not a brand line or label: ${line}`, () => assert.equal(tag(line).style_code, undefined));
for (const line of ['Style AB1234 Size M', 'Style No. AB1234', 'Art AB1234', 'Model AB1234', 'Item AB1234', 'Carhartt AB1234'])
  test(`style brand line or explicit label establishes code: ${line}`, () => assert.equal(tag(line).style_code?.value, 'AB1234'));

for (const line of ['champion quality', 'Apple juice stain', 'Amazon Prime', 'Wash with apple juice'])
  test(`ordinary sentence does not establish a common-word brand: ${line}`, () => assert.deepEqual(matchBrands(line), []));
test('common-word brand capitals or trademark cue establish brand', () => {
  for (const line of ['CHAMPION', 'Champion TM', 'Champion ®', 'Champion Inc.', 'Champion Co.'])
    assert.equal(matchBrands(line)[0]?.brand, 'Champion');
});

test('translated fibre lines count identical composition once without carrying language across lines', () => {
  for (const translation of ['55% algodon 45% poliester', '55% coton 45% polyester']) {
    const out = parseTag([{line: '55% cotton 45% polyester', confidence: 0.9}, {line: translation, confidence: 0.8}]);
    assert.deepEqual(field(out, 'fabric').map(fact => fact.value), ['55% cotton, 45% polyester']);
    assert.equal(field(out, 'fabric')[0].confidence, 0.8);
  }
});

test('brand punctuation is literal rather than a regular expression wildcard', () => {
  assert.equal(matchBrands('DrX Martens').length, 0);
  assert.equal(matchBrands('Dr. Martens')[0]?.brand, 'Dr. Martens');
});

test('flattened real-tag text does not invent lost size line boundaries', () => {
  for (const row of record.items.filter(row => row.item !== 'carhartt-pants')) {
    const manifest = JSON.parse(readFileSync(new URL(row.manifest, root), 'utf8')) as {read: {tag_text: string}};
    assert.deepEqual(field(tag(manifest.read.tag_text), 'size_label'), []);
  }
});

test('capital common-word tag heading can share its line with a style or size', () => {
  for (const line of ['CHAMPION AB1234', 'CHAMPION Size M']) {
    assert.equal(tag(line).brands[0]?.brand, 'Champion');
  }
  assert.equal(tag('CHAMPION AB1234').style_code?.value, 'AB1234');
});

test('unrelated company cue cannot turn a care sentence into a common-word brand', () => {
  for (const line of ['Wash with apple juice. Acme Co.', 'WASH WITH APPLE JUICE', 'APPLE JUICE STAIN']) assert.deepEqual(matchBrands(line), []);
});
