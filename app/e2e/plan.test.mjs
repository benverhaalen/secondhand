// The behavior of the Plan sheet (app/behavior/item/[id]/plan.json), on the web build: node --test app/e2e/plan.test.mjs
// Written from the render and the spec (pages §6.7, ways-out §6.7, edge-cases §3, §10, §11), not from the page's code.
// Amounts are matched, not the words around them: the money line is moving from "You keep" to "You get" (Ben, 06:19).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemPage, reach, press, switchState } from './item-common.mjs';

const ctx = itemPage(test, 'item/[id]/plan', 'plan');
const JP = '/item/it_jacket/plan';
const price = n => ['plan-price', ['plan-price-input', String(n)]]; // types a price of my own

// edge-cases §3 and ways-out §6.7 ("Oops, $500, I meant $50"): a typed price over 3 times the top of the sold range asks
// once with the range, and nothing can be saved until Yes.
test('plan: a typed price far over the sold range asks once with the range, and Save waits for Yes', async () => {
  const s = await reach(ctx, JP, price(500));
  await s.shows('List at $500?');
  assert.equal(await s.page.getByTestId('save-plan').count(), 0, 'no Save before Yes');
  await press(s, 'far-yes');
  await s.page.getByTestId('save-plan').waitFor({ timeout: 3000 });
  assert.equal(await s.page.getByText('List at $500?', { exact: false }).count(), 0, 'it asks once');
});

// edge-cases §3 (under a third of the bottom) and decision "a price below your floor always asks".
test('plan: a typed price far under the range asks, and under the lowest it waits for its own tap', async () => {
  const s = await reach(ctx, JP, price(20));
  await s.shows('List at $20?');
  await press(s, 'far-yes');
  await s.shows('Under your lowest, $70. It waits for your tap.');
  await s.shows('Set $20, under your lowest');
});

// edge-cases §3: a floor above the asking price is refused in place, with the reason.
test('plan: a lowest over the price is refused in place, and the lowest stays', async () => {
  const s = await reach(ctx, JP, ['plan-floor', ['plan-floor-input', '120']]);
  await s.shows('Can’t be over the price, $95. Kept at $70.');
  assert.equal(await s.page.getByTestId('plan-floor').getAttribute('aria-label'), 'Lowest you take: $70');
});

// ways-out §6.7 ("My price, not yours"): the suggestion stays as one line beside a typed price, never forced.
test('plan: a typed price keeps the sold range beside it', async () => {
  const s = await reach(ctx, JP, price(100));
  assert.equal(await s.page.getByTestId('plan-price').getAttribute('aria-label'), 'Price: $100');
  await s.shows('Similar ones sold for $85 to $115');
  await s.shows('Save: $100 on 2 sites');
});

// edge-cases §11: an avoided site is greyed with its one-line reason and a tap adds it; a blocked site can't be added and says why.
test('plan: an avoided site says why and can be added; a blocked one says why and can’t', async () => {
  const s = await reach(ctx, '/item/it_chair/plan');
  await s.shows('A Home > Furniture category exists, but it ships only and its buyers want clothes');
  assert.notEqual(await s.page.getByTestId('site-depop').getAttribute('aria-disabled'), 'true', 'an avoided site stays switchable');
  await s.shows('Not allowed here. Over the 15 lb cap, no pickup');
  assert.equal(await s.page.getByTestId('site-poshmark').getAttribute('aria-disabled'), 'true', 'a blocked site can’t be added');
  const sw = await reach(ctx, '/item/it_switch/plan');
  await sw.shows('Not allowed here. Headphones, speakers and consoles are banned; cameras, film and lenses are allowed');
  assert.equal(await sw.page.getByTestId('site-depop').getAttribute('aria-disabled'), 'true');
});

// edge-cases §10 (Returns terms): each postable site shows its returns rule in one line.
test('plan: each site shows its returns rule in one line', async () => {
  const s = await reach(ctx, JP);
  for (const t of ['Returns as you set them', 'Refunds only if not as described', 'No returns on pickup']) await s.shows(t);
});

// ways-out Everywhere ("VoiceOver"): each site's switch names its site and says whether it is on; the logo is not read.
test('plan: each site switch names its site and says whether it posts there', async () => {
  const s = await reach(ctx, JP);
  const want = { 'site-ebay': [/ebay/i, 'true'], 'site-depop': [/depop/i, 'true'], 'site-facebook': [/facebook/i, 'false'] };
  for (const [id, [name, on]] of Object.entries(want)) {
    const x = await switchState(s, id);
    assert.match(x.label ?? '', name, `${id} is read as "${x.label}"`);
    assert.deepEqual([x.role, x.checked], ['switch', on], id);
  }
});

// pages §6.7 pill: Preview listings closes the plan and opens the Post preview with the plan's price; nothing goes public here.
test('plan: Preview carries the typed price into the Post preview', async () => {
  const s = await reach(ctx, '/item/it_switch/plan', price(250));
  await press(s, 'preview');
  await s.page.waitForURL(u => new URL(u).pathname === '/item/it_switch/post', { timeout: 5000 });
  await s.page.getByText(/\$250 on 2 sites/).first().waitFor({ timeout: 3000 });
  assert.equal(await s.page.getByText('Posted on 2 sites').count(), 0);
});

// ways-out §6.7 ("No price drops"): drops off in any choice.
test('plan: price drops can be turned off under any choice', async () => {
  const s = await reach(ctx, JP, ['choice-best', 'drops']);
  assert.equal((await switchState(s, 'drops')).checked, 'false');
  assert.equal(await s.page.getByText(/drops to \$/).count(), 0, 'no dated drops once they are off');
});

// ways-out Everywhere ("I'm on bad signal"): a save waits for signal and does not claim it is saved.
test('plan: offline, Save waits for signal and does not claim it is saved', async () => {
  const s = await reach(ctx, `${JP}?state=offline&flip=facebook`, ['save-plan']);
  await s.page.getByText('Waiting for signal', { exact: false }).first().waitFor({ timeout: 3000 });
  assert.equal(await s.page.getByText('Saved.', { exact: false }).count(), 0);
});
