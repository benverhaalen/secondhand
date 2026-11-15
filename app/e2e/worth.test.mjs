// The behavior of What's it worth (app/behavior/worth.json), on the web build: each stage of the appraisal, the value
// only from sold comparables, what the person keeps per site, and the ways out (Keep it, a typed model number).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, controlTests, start } from './behavior.mjs';

const table = behavior('worth');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

const STATES = { glance: [], check: [], unsure: [], kept: ['worth-keep'], unknown: [], loading: [], failed: [], offline: [] };

test('worth: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(STATES).sort(), table.states.map(s => s.state).sort());
});

for (const s of table.states) test(`worth: ${s.state} shows ${s.shows}`, async () => {
  const screen = await app.open(s.route);
  for (const id of STATES[s.state]) await screen.tap(id);
  await screen.shows(s.shows);
  assert.equal(await screen.page.locator('[data-screen="worth"]').first().getAttribute('data-state'), s.state);
});

test('worth: the value is a range, and its source is one tap away', async () => {
  const screen = await app.open('/worth?world=clearing');
  await screen.shows(/^\$[\d,]+ to \$[\d,]+$/);
  await screen.tap('worth-sources');
  await screen.page.locator('[data-part="sheet"]').waitFor({ state: 'visible' });
  await screen.page.locator('[data-part="sheet"]', { hasText: /sold/i }).waitFor({ state: 'visible' });
});

// Ben, 06:19: "for buying what it's worth, you should be able to obviously investigate. Like human in the loop is very
// important." The person leaves out a site's sales and the value is worked out again from the rest.
test('worth: the person can leave out sales that aren’t the same, and the range follows', async () => {
  const screen = await app.open('/worth?world=clearing&product=pr_dunk');
  const range = () => screen.page.locator('[data-part="range"]').first().innerText();
  const before = await range();
  await screen.tap('worth-sources');
  await screen.page.locator('[data-part="sheet"]').waitFor({ state: 'visible' });
  await screen.tap('worth-sale-mercari');
  await screen.page.locator('[data-part="sale-row"][data-site="mercari"][data-counted="false"]').waitFor({ state: 'visible' });
  await screen.page.locator('[data-part="sheet"]').getByText('From the sales you kept').waitFor({ state: 'visible' });
  await screen.tap('worth-sale-mercari');
  await screen.page.locator('[data-part="sale-row"][data-site="mercari"][data-counted="true"]').waitFor({ state: 'visible' });
  for (const site of ['ebay', 'depop', 'mercari']) await screen.tap(`worth-sale-${site}`);
  await screen.page.locator('[data-part="sheet"]').getByText('No sales left to go by.').waitFor({ state: 'visible' });
  for (const site of ['ebay', 'depop']) await screen.tap(`worth-sale-${site}`);
  assert.notEqual(await range(), '', 'a range is back');
  assert.ok(before, 'there was a range before');
});

test('worth: a left-out site keeps nothing in You get', async () => {
  const screen = await app.open('/worth?world=clearing&product=pr_dunk');
  await screen.tap('worth-sources');
  await screen.tap('worth-sale-ebay');
  await screen.page.keyboard.press('Escape');
  const row = screen.page.locator('[data-part="keep-row"][data-site="ebay"]');
  assert.match(await row.innerText(), /Left out/);
  assert.doesNotMatch(await row.innerText(), /\$/);
});

test('worth: a site with too few sales shows no number', async () => {
  // The Dunk Low has no sold range on Poshmark or Facebook in the market data.
  const screen = await app.open('/worth?world=new&product=pr_dunk');
  await screen.shows('You get');
  const row = screen.page.locator('[data-site="poshmark"]');
  await row.waitFor({ state: 'visible' });
  assert.doesNotMatch(await row.innerText(), /\$/);
});

test('worth: each site row says what the person keeps there, after fees, never more than it sold for', async () => {
  const screen = await app.open('/worth?world=clearing&product=pr_dunk');
  await screen.shows('You get');
  const rows = await screen.page.locator('[data-part="keep-row"]').evaluateAll(els => els.map(e => ({ site: e.getAttribute('data-site'), text: e.innerText })));
  assert.ok(rows.length >= 3, `expected a row per site, got ${rows.length}`);
});

test('worth: glance is labelled rough and offers no next step yet', async () => {
  const screen = await app.open('/worth?stage=glance');
  await screen.shows('Rough guess');
  assert.equal(await screen.page.getByTestId('worth-sell').count(), 0);
});

test('worth: Keep it, then Undo', async () => {
  const screen = await app.open('/worth');
  await screen.tap('worth-keep');
  await screen.shows('Kept');
  await screen.tap('worth-keep-undo');
  await screen.page.getByTestId('worth-keep').waitFor({ state: 'visible' });
});

test('worth: a typed model number gives the value when the photo was not enough', async () => {
  const screen = await app.open('/worth?stage=unsure');
  await screen.shows('Which one is it?');
  assert.equal(await screen.page.getByTestId('worth-sell').count(), 0, 'no next step without a number');
  await screen.tap('worth-model-field');
  const input = screen.page.getByTestId('worth-model-field-input');
  await input.fill('HEG-001');
  await input.press('Enter');
  await screen.shows('You get');
});

// edge-cases §4: "I don't know" is an answer. No number, and selling still works from the photos.
test('worth: I don’t know leads on to selling, with no number', async () => {
  const screen = await app.open('/worth?stage=unsure');
  await screen.tap('worth-unknown');
  await screen.shows('No number yet');
  assert.equal(await screen.page.getByText(/^\$[\d,]+ to \$[\d,]+$/).count(), 0);
  assert.equal(await screen.page.getByTestId('worth-sell').count(), 1);
});

// edge-cases §3, "Oops, $500, I meant $50": a price far from the sales asks once, with the range and the price on the button.
test('worth: a typed price far from the sales asks once', async () => {
  const screen = await app.open('/worth?world=clearing');
  await screen.tap('worth-price');
  await screen.tap('worth-price-field');
  const input = screen.page.getByTestId('worth-price-field-input');
  await input.fill('5000');
  await input.press('Enter');
  await screen.shows(/^Similar ones sold for \$[\d,]+ to \$[\d,]+\. Sell at \$5,000(\.00)?\?$/);
  await screen.tap('worth-price-fix');
  assert.equal(await screen.page.getByTestId('worth-price-yes').count(), 0);
  await screen.tap('worth-price-field');
  await input.fill('60');
  await input.press('Enter');
  assert.equal(await screen.page.getByTestId('worth-price-yes').count(), 0, 'a price inside the sales asks nothing');
});

test('worth: the break content holds: a huge range and a long title stay on the screen', async () => {
  for (const id of ['it_huge', 'it_long']) {
    const screen = await app.open(`/worth?world=edge&item=${id}`);
    await screen.shows('You get');
    const over = await screen.page.evaluate(() => [...document.querySelectorAll('[data-screen="worth"] *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length);
    assert.equal(over, 0, `${id}: something runs off the screen`);
  }
});

controlTests(test, table, c => app.open(c.at));
