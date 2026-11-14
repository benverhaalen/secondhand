import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTitle, lint, sites } from './listing-lint.mjs';

const fleece = {
  brand: 'Patagonia', line: 'Better Sweater', detail: '1/4 Zip', type: 'Fleece Pullover', department: "Men's",
  size: 'Large', color: 'Gray', mpn: '25523', category: 'Sweaters', condition: 'good', style: ['outdoor', 'gorpcore'],
};
const boots = { brand: 'Rick Owens', model: 'Geobasket', type: 'Sneakers', era: 'FW14', color: 'Black Milk', size: '43', category: 'Hi-Top Sneakers', condition: 'used', department: 'Menswear' };
const dresser = { brand: 'IKEA', line: 'Hemnes', detail: '8 Drawer', type: 'Dresser', color: 'White', size: '63 in Wide', category: 'Furniture', condition: 'good' };
const ids = (site, draft, facts) => lint(site, draft, facts).map(p => p.id);

test('each site builds its own title from the same facts', () => {
  assert.equal(buildTitle('ebay', fleece), "Patagonia Better Sweater 1/4 Zip Fleece Pullover Men's Large Gray 25523");
  assert.equal(buildTitle('poshmark', fleece), 'Patagonia Better Sweater 1/4 Zip Fleece Pullover Gray Size Large');
  assert.equal(buildTitle('grailed', boots), 'Rick Owens Geobasket FW14 Black Milk 43');
  assert.equal(buildTitle('depop', { ...fleece, era: 'Vintage' }), 'Vintage Patagonia Better Sweater 1/4 Zip Fleece Pullover Gray');
});

test('a part that does not fit is left out, and the brand stays', () => {
  const t = buildTitle('offerup', { ...dresser, size: '63 in Wide by 20 in Deep by 38 in Tall' });
  assert.equal(t, 'IKEA Hemnes Dresser White');
  assert.ok(buildTitle('grailed', { ...boots, color: 'Black Milk Dust Pearl Grey' }).split(' ').length <= 7);
});

test('a word is used once', () => {
  assert.equal(buildTitle('ebay', { brand: 'Sony', model: 'WH-1000XM4', type: 'Sony Wireless Headphones', color: 'Black' }), 'Sony WH-1000XM4 Wireless Headphones Black');
});

test('a built title passes its own site with nothing blocking', () => {
  for (const site of sites) for (const facts of [fleece, boots, dresser]) {
    const title = buildTitle(site, facts);
    const blocks = lint(site, { title, body: `${title}\nGood used condition.`, tags: [] }, facts).filter(p => p.level === 'block');
    assert.deepEqual(blocks, [], `${site}: ${title}`);
  }
});

test('a word no fact backs blocks the draft', () => {
  assert.ok(ids('ebay', { title: 'Patagonia Better Sweater Fleece Rare Arcteryx', body: '' }, fleece).includes('K1'));
  assert.ok(ids('depop', { title: buildTitle('depop', fleece), body: buildTitle('depop', fleece), tags: ['patagonia', 'lululemon'] }, fleece).includes('K1'));
});

test('a hashtag made of backed words passes', () => {
  const title = buildTitle('depop', fleece);
  assert.deepEqual(ids('depop', { title, body: title, tags: ['patagonia', 'bettersweater', 'gorpcore'] }, fleece).filter(i => i === 'K1'), []);
});

test('length and word limits', () => {
  assert.ok(ids('ebay', { title: 'Patagonia '.repeat(9).trim(), body: '' }, fleece).includes('T1'));
  assert.ok(ids('grailed', { title: 'Rick Owens Geobasket Sneakers FW14 Black Milk 43', body: '' }, boots).includes('T2'));
});

test('the brand leads', () => {
  assert.ok(ids('mercari', { title: "Better Sweater 1/4 Zip Fleece Pullover Men's Large Gray Patagonia", body: '' }, fleece).includes('T3'));
});

test('shouting, prices and sales talk are flagged', () => {
  for (const title of ['PATAGONIA BETTER SWEATER FLEECE', 'Patagonia Fleece L@@K', 'Patagonia Fleece $40', 'Patagonia Fleece Free Shipping'])
    assert.ok(ids('ebay', { title, body: '' }, fleece).includes('T5'), title);
});

test('contact details and other payment apps block', () => {
  for (const body of ['Text me at 555-123-4567', 'Pay with venmo', 'see more at myshop.com'])
    assert.ok(ids('facebook', { title: 'Patagonia Fleece', body }, fleece).includes('C1'), body);
});

test('another brand as bait is flagged', () => {
  for (const body of ['Similar to Arcteryx.', 'Looks like North Face.', 'A dupe for Lululemon'])
    assert.ok(ids('poshmark', { title: 'Patagonia Fleece', body }, fleece).includes('K2'), body);
  assert.deepEqual(ids('poshmark', { title: 'Patagonia Fleece', body: 'Like new. Fits like a medium.' }, fleece).filter(i => i === 'K2'), []);
});

test('a missing filter field is a question for the person, unless it does not apply', () => {
  const { size, ...noSize } = fleece;
  const p = lint('poshmark', { title: 'Patagonia Fleece', body: '' }, noSize).find(x => x.id === 'F1');
  assert.equal(p.level, 'ask');
  assert.equal(p.field, 'size');
  assert.deepEqual(ids('depop', { title: 'Patagonia Fleece', body: 'Patagonia Fleece' }, { ...noSize, na: ['size'] }).filter(i => i === 'F1'), []);
});

test('tag counts and repeats follow the site', () => {
  assert.ok(ids('mercari', { title: 'Patagonia Fleece', body: '', tags: ['patagonia', 'outdoor', 'gorpcore', 'gray'] }, fleece).includes('G1'));
  assert.ok(ids('mercari', { title: 'Patagonia Fleece', body: '', tags: ['patagonia'] }, fleece).includes('G2'));
  assert.deepEqual(ids('poshmark', { title: 'Patagonia Fleece', body: '', tags: ['patagonia'] }, fleece).filter(i => i === 'G2'), []);
  assert.ok(ids('ebay', { title: 'Patagonia Fleece', body: '', tags: ['patagonia'] }, fleece).includes('G1'));
});

test('on Depop the title is the first line of the description', () => {
  assert.ok(ids('depop', { title: 'Patagonia Fleece', body: 'Selling my fleece' }, fleece).includes('D2'));
});

test('description limits', () => {
  assert.ok(ids('depop', { title: 'Patagonia Fleece', body: 'Patagonia Fleece\n' + 'x'.repeat(1000) }, fleece).includes('D1'));
  assert.ok(ids('poshmark', { title: 'Patagonia Fleece', body: 'Nice. #fleece' }, fleece).includes('D3'));
  assert.ok(ids('grailed', { title: 'Rick Owens Geobasket', body: 'Worn.', tags: ['rickowens', 'geobasket', 'fw14'] }, boots).includes('D4'));
});
