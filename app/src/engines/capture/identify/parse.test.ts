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

test('Carhartt RN and lexicon survive while flattened unsegmented facts abstain', () => {
  const out = garment('carhartt-pants');
  assert.ok(out.brands.some(b => b.brand === 'Carhartt' && b.s === 1 && b.rule === 'rn'));
  assert.ok(out.brands.some(b => b.brand === 'Carhartt' && b.s === 0.9 && b.rule === 'brand_lexicon'));
  for (const name of ['fabric', 'origin']) assert.deepEqual(field(out, name), []);
  assert.equal(out.style_code, undefined);
  assert.deepEqual(field(out, 'colour'), []);
  assert.deepEqual(field(out, 'size_label'), []);
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
  assert.deepEqual(field(parseTag([{line: 'US 10', confidence: 0.8}]), 'size_label'), []);
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
  assert.deepEqual(field(parseTag([{line: "Levi's 38 X 36", confidence: 1}]), 'size_label'), []);
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

for (const line of [
  'Lining: 100% polyester\nMade in China', 'Hood lining: 100% polyester\nM',
  'Nike\nL\nRib: 98% cotton 2% elastane',
  ...['pocket', 'pocketing', 'ribbing', 'trim', 'contrast', 'insulation', 'filling', 'padding', 'sleeve lining', 'collar',
    'doublure', 'forro', 'Futter', 'fodera'].map(part => `${part}: 100% cotton`),
  'Lining:\n100% polyester', 'Unknown: 100% cotton', '100% cotton mystery', 'not 100% cotton',
  'Sleeves:\n100% polyester', 'Pocket bag:\n100% polyester', 'Unknown:\n100% cotton', '100% cotton,',
  'Main: 60% cotton\nSleeves:\n40% polyester',
  'Hood lining -\n100% polyester', 'Lining.\n100% polyester', 'Unknown.\n100% cotton',
  'Sleeves\n100% polyester', 'Pocket bags\n100% cotton', 'Panel 2\n100% cotton', 'Collar & cuffs\n100% cotton',
]) test(`M1: a part or unconsumed composition cannot state main fabric: ${line}`, () => {
  assert.deepEqual(field(tag(line), 'fabric'), []);
});
for (const main of ['Shell', 'Body', 'Outer', 'Main', 'Self', 'Fabric', 'Extérieur', 'Tejido principal', 'Oberstoff', 'Esterno'])
  for (const separator of ['\n', '; ', ' ']) test(`M1: only ${main} counts beside lining (${JSON.stringify(separator)})`, () => {
    assert.deepEqual(field(tag(`${main}: 100% cotton${separator}Lining: 100% polyester`), 'fabric').map(f => f.value), ['100% cotton']);
  });

for (const line of [
  'SIZE S M L XL', 'S M L XL', 'US M 9 / W 10.5', 'Pat. US 5,987,654', 'Patent US 5,987,654', 'Pat. No. US 5,987,654',
  'UK 10', 'Dr. Martens\nAIRWAIR\nUK 8\nMade in Thailand', 'Nike EU42',
  'Adidas\nGL9876\nUK 8 FR 42 2/3\nMade in Vietnam', 'EU 42 / US 9',
  'Size 9 US', 'US 9.5', 'EUR42', 'FR 42', 'IT 42', 'JP 26', 'CN 42', 'MX 8', 'W 10', 'M 10',
  'Size M mystery', 'Size M Size L', 'RN 12345 Size M', 'CA 12345 Size M', 'LOT K1234 Size M',
  'Style 10', 'Date US 9', '2023-10-10 Size M', 'Size 5,987', 'Size 10.25', 'Size 10%',
  'Sizes', 'Tallas', 'TailleS', 'SizeS',
  'Size M\nSIZE S M L XL', 'M\nUK 10', 'US M\nUK L', 'US M\nUK M', 'M\nEU L', 'US M 9 / W 10.5\nM',
]) test(`M2/M3: size grammar cannot discard tokens or the system: ${line}`, () => {
  assert.deepEqual(field(tag(line), 'size_label'), []);
});
for (const line of ['Taille M', 'Talla M', 'Größe M', 'SIZE/TAILLE/TALLA: M', 'Size: M', 'US M', 'Size: L (G)'])
  test(`M2: a complete letter-size segment is read: ${line}`, () => {
    assert.deepEqual(field(tag(line), 'size_label').map(f => f.value), [line.endsWith('(G)') ? 'L' : 'M']);
  });

for (const [line, expected] of [
  ['Fabric made in Italy\nMade in China', ['China']], ['Fabric made in Japan\nMade in USA', ['United States']],
  ['Made in China\nMade in Vietnam', []], ['Made in China / Made in Vietnam', []],
  ['Material made in Italy', []], ['Designed made in Italy', []], ['Something made in Italy', []],
  ['Fabric from Japan', []], ['Designed in USA', []], ['Assembled in USA', []], ['Printed in USA', []],
  ['Made in China mystery', []], ['Made in China or elsewhere', []],
  ['Designed in California / Made in China', ['China']], ['(Imported) Made in China', ['China']],
  ['MADE IN CHINA / FABRIQUÉ EN CHINE / HECHO EN CHINA', ['China']], ['Made in P.R.C.', ['China']],
] as const) test(`M4: only a complete garment-origin segment counts: ${line}`, () => {
  assert.deepEqual(field(tag(line), 'origin').map(f => f.value), expected);
});

for (const line of ['Patagonia F23', 'Nike EUR42', 'Nike M10', 'Nike FY23', 'Nike FY23\nM\nMade in Vietnam',
  'CARHARTT LOT K1234', 'LOT K1234', 'Nike ZZ12345', 'Nike FY2023', 'Nike H23', 'Nike W10',
  'Carhartt B324 unknown', 'Style AB1234 unknown', 'Style FW23', 'Style EUR42',
  'Style EU-42', 'Style FY-23', 'Nike\nStyle FY-23', 'Style LOT123', 'Style LOT-123', 'Style AB1234 unknown\nStyle CD5678',
  'Style LOT-K1234', 'Style LOT123A', 'Style FW2023-24', 'Carhartt B324\nCarhartt J97 unknown'])
  test(`M5: a season, system, lot or unaccounted token cannot become a model: ${line}`, () => {
    assert.equal(tag(line).style_code, undefined);
    assert.deepEqual(field(tag(line), 'style_code'), []);
  });
for (const [line, value] of [['RN: 14806', 'Carhartt']])
  test(`review recall: labelled registration: ${line}`, () => assert.equal(tag(line).brands[0]?.brand, value));
for (const [line, value] of [['Style No. 25551', '25551'], ['Carhartt B324', 'B324']])
  test(`review recall: whole style segment: ${line}`, () => assert.equal(tag(line).style_code?.value, value));
for (const [line, value] of [['Polyester 100%', '100% polyester'], ['98% Algodón 2% Élasthanne', '98% cotton, 2% elastane']])
  test(`review recall: whole translated or reversed composition: ${line}`, () => assert.deepEqual(field(tag(line), 'fabric').map(f => f.value), [value]));
for (const line of ['Size: 10', 'lululemon\n6'])
  test(`review recall: numeric size without a system still abstains: ${line}`, () => assert.deepEqual(field(tag(line), 'size_label'), []));
for (const [line, expected] of [
  ['Made in Viet Nam', ['Vietnam']], ['Made in Vietnam', ['Vietnam']],
  ['Made in USA', ['United States']], ['Made in U.S.A.', ['United States']],
  ['Made in the USA of imported fabric', ['United States']], ['Made in the USA of imported materials', ['United States']],
  ['Made in China, Assembled in USA', ['China']], ['Made in China and Vietnam', []],
  ['Made in Italy, fabric from Japan', ['Italy']], ['Made in China, Made in USA', []],
  ['Made in UK', ['United Kingdom']], ['Made in UAE', ['United Arab Emirates']], ['Made in PRC', ['China']],
  ['Made in Hong Kong', ['Hong Kong']], ['Made in Korea', ['South Korea']],
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
for (const [line, value] of [['M', 'M'], ['XS', 'XS'], ['L.L.Bean\nL', 'L'], ['Size M', 'M'], ['Sz: XL', 'XL'], ['US M', 'M'], ['38 X 36', '38x36']])
  test(`size context establishes the token: ${line}`, () => assert.equal(field(tag(line), 'size_label')[0]?.value, value));
for (const line of ['EU 40', 'Size 9 US'])
  test(`system-qualified number cannot be stored as a bare size: ${line}`, () => assert.deepEqual(field(tag(line), 'size_label'), []));
test('numeric Size label alone is not a shoe-size system', () => assert.deepEqual(field(tag('Size 9'), 'size_label'), []));

for (const line of ['AB1234 Size M', 'AB1234 BLK M', 'Carhartt\nAB1234 BLK Size M'])
  test(`style proximity alone is not a brand line or label: ${line}`, () => assert.equal(tag(line).style_code, undefined));
for (const line of ['Style AB1234 Size M', 'Style No. AB1234', 'Art AB1234', 'Model AB1234', 'Item AB1234'])
  test(`style brand line or explicit label establishes code: ${line}`, () => assert.equal(tag(line).style_code?.value, 'AB1234'));
test('Carhartt AB1234 is not in the sourced brand style grammar', () => assert.equal(tag('Carhartt AB1234').style_code, undefined));

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
  assert.equal(tag('CHAMPION AB1234').style_code, undefined);
});

test('unrelated company cue cannot turn a care sentence into a common-word brand', () => {
  for (const line of ['Wash with apple juice. Acme Co.', 'WASH WITH APPLE JUICE', 'APPLE JUICE STAIN']) assert.deepEqual(matchBrands(line), []);
});

for (const line of ['50% cotton 50% modal', '80% cotton 20% lyocell', '60% cotton', '0% cotton', '100% cotton 0% polyester', '100% cotton 10%', '100% cotton 10% modal', '60% cotton 60% polyester', '100% cotton 100% cotton', '50% cotton 50% cotton'])
  test(`incomplete, unknown or zero fibre percentages cannot state fabric: ${line}`, () => {
    assert.deepEqual(field(tag(line), 'fabric'), []);
  });
for (const [line, value] of [['60% cotton 40% poly', '60% cotton, 40% polyester'], ['88% polyamide 12% elastane', '88% polyamide, 12% elastane']])
  test(`known fibre aliases complete the whole composition: ${line}`, () => {
    assert.deepEqual(field(tag(line), 'fabric').map(fact => fact.value), [value]);
  });
test('an incomplete translation cannot borrow percentages from another language group', () => {
  assert.deepEqual(field(tag('60% cotton 40% polyester\n60% coton'), 'fabric'), []);
});
test('unknown percentages on another line cannot disappear from a language group', () => {
  assert.deepEqual(field(tag('100% cotton\n50% modal'), 'fabric'), []);
});

for (const line of ['Nike EU42', 'Nike US10', 'Nike UK8', 'Nike W32', 'Nike L34', 'Nike SS23', 'Nike FW22 Size M', 'Nike AW21', 'Nike SP24', 'Nike FA23', 'Nike HO22', 'Nike SU23', 'Nike Size EU42'])
  test(`size systems, waist markers and seasons cannot state a style: ${line}`, () => {
    assert.equal(tag(line).style_code, undefined);
    assert.deepEqual(field(tag(line), 'style_code'), []);
  });
for (const line of ['Size S/M', 'Size M/L', 'S/M', 'M/L', 'Size S / M', 'M/Size L', 'Size M-L', 'Size M - L', 'Size S/M\nM'])
  test(`letter size beside a range separator cannot state one size: ${line}`, () => {
    assert.deepEqual(field(tag(line), 'size_label'), []);
  });
for (const line of ['Made in China or Vietnam', 'Made in Vietnam/China', 'Made in USA/Mexico', 'Made in China, Vietnam or Mexico', 'Made in China, Vietnam/Mexico'])
  test(`alternative countries cannot state an origin: ${line}`, () => assert.deepEqual(field(tag(line), 'origin'), []));
for (const alias of ['Congo, Democratic Republic', 'DR Congo', 'DRC', 'Congo, The Democratic Republic of the'])
  test(`long Congo alias cannot truncate to the other Congo: ${alias}`, () => {
    assert.deepEqual(field(tag(`Made in ${alias}`), 'origin').map(fact => fact.value), ['Democratic Republic of the Congo']);
  });
for (const line of ['Made in Georgia', 'Made in Georgia, USA'])
  test(`Georgia without a country cue cannot state origin: ${line}`, () => assert.deepEqual(field(tag(line), 'origin'), []));
for (const line of ['Made in Republic of Georgia', 'Made in Georgia, Tbilisi', 'Made in Georgia\nTbilisi'])
  test(`explicit country cue disambiguates Georgia: ${line}`, () => {
    assert.deepEqual(field(tag(line), 'origin').map(fact => fact.value), ['Georgia']);
  });
for (const line of ['Tbilisi', 'Republic of Georgia'])
  test(`Georgia origin confidence includes its required country cue: ${line}`, () => {
    const out = parseTag([{line: 'Made in Georgia', confidence: 1}, {line, confidence: 0}]);
    assert.deepEqual(field(out, 'origin').map(fact => [fact.value, fact.confidence]), [['Georgia', 0]]);
  });

for (const [alias, expected] of [
  ['Korea, Republic of', 'South Korea'], ['South Korea', 'South Korea'], ['Viet Nam', 'Vietnam'],
  ['Turkey', 'Turkey'], ['Türkiye', 'Turkey'], ['England', 'United Kingdom'], ['Scotland', 'United Kingdom'], ['Wales', 'United Kingdom'],
  ['Great Britain', 'United Kingdom'], ['Russia', 'Russia'], ['Russian Federation', 'Russia'],
  ['Czech Republic', 'Czechia'], ['Czechia', 'Czechia'], ['Holland', 'Netherlands'],
  ['Republic of the Congo', 'Republic of the Congo'], ['Macau', 'Macau'], ['Ivory Coast', 'Ivory Coast'],
]) test(`country spellings yield the seller display name: ${alias}`, () => {
  assert.deepEqual(field(tag(`Made in ${alias}`), 'origin').map(fact => fact.value), [expected]);
});
test('every country has a display name that the parser emits', () => {
  const table = JSON.parse(readFileSync(new URL('./countries.json', import.meta.url), 'utf8')) as {rows: {code: string; name: string; display_name?: string}[]};
  for (const row of table.rows) {
    assert.ok(row.display_name?.trim(), row.code);
    if (row.code !== 'GE') assert.deepEqual(field(tag(`Made in ${row.name}`), 'origin').map(fact => fact.value), [row.display_name], row.code);
  }
});

for (const line of ['Lot 28x30', 'B324 BLK 38 X 36', "Levi's 38 X 36"])
  test(`unlabelled dimensions among other tokens cannot state waist length: ${line}`, () => assert.deepEqual(field(tag(line), 'size_label'), []));
for (const [line, expected] of [['28x30', '28x30'], ['Size 28x30', '28x30'], ['Sz: 28 × 30', '28x30'], ['W32 L34', '32x34'], ['Nike W32 L34', '32x34']])
  test(`waist length needs a size line, label or both markers: ${line}`, () => {
    assert.deepEqual(field(tag(line), 'size_label').map(fact => fact.value), [expected]);
    assert.equal(tag(line).style_code, undefined);
  });
