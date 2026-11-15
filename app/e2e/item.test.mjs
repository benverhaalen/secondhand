// The behavior of Item (app/behavior/item/[id]/index.json), on the web build: node --test app/e2e/item.test.mjs
// Written from the render and the spec (pages §6.6, ways-out §6.6, edge-cases §3, §5, §6, §7), not from the page's code.
// Amounts are matched, not the words around them: the money line is moving from "You keep" to "You get" (Ben, 06:19).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemPage, reach, press, switchState } from './item-common.mjs';

const ctx = itemPage(test, 'item/[id]/index', 'item');
const J = '/item/it_jacket';

// edge-cases §6: Clean up and Enhance with AI are two named choices, neither applied without a pick; on a live item the change
// waits for an Approve that names the listings (the hand-off rule: a change to live listings is public).
test('item: photos offer Clean up and Enhance with AI as two choices, and a live change waits for an Approve naming the listings', async () => {
  const s = await reach(ctx, J, ['photos']);
  for (const t of ['Clean up', 'Enhance with AI', '~Never redraws it', '~Marked as AI', 'Use original']) await (t.startsWith('~') ? s.page.getByText(t.slice(1)).first().waitFor() : s.shows(t));
  assert.equal(await s.page.getByTestId('use-original').getAttribute('aria-disabled'), 'true', 'Use original waits for a pick');
  assert.equal(await s.page.getByTestId('photos-apply').count(), 0, 'nothing to apply before a pick');
  await press(s, 'clean-up');
  await s.shows('Update the photos on 2 listings');
  assert.equal(await s.page.getByText('Updated on 2 listings').count(), 0, 'nothing reaches the listings before the Approve');
});

// ways-out Everywhere ("VoiceOver"): a switch says it is a switch and whether it is on; and at most one of the two is on.
test('item: the photo switches tell a screen reader whether each is on, and only one is on at a time', async () => {
  const s = await reach(ctx, J, ['photos']);
  for (const id of ['clean-up', 'enhance-ai']) assert.deepEqual(await switchState(s, id).then(x => [x.role, x.checked]), ['switch', 'false'], `${id} before a pick`);
  await press(s, 'clean-up'); await press(s, 'enhance-ai'); await s.page.waitForTimeout(300);
  assert.equal((await switchState(s, 'clean-up')).checked, 'false');
  assert.equal((await switchState(s, 'enhance-ai')).checked, 'true');
});

// edge-cases §7: a stop in the auto-list tree is one question on one card; an answer fills the field, and the next stop
// takes the card's place, so a stop costs a tap, not a restart.
test('item: review asks one question at a time, and an answer fills the field', async () => {
  const s = await reach(ctx, '/item/it_switch');
  await s.shows('Do the Joy-Cons drift?');
  const asks = await s.page.locator('[data-testid^="ask-fact-"]').evaluateAll(els => [...new Set(els.map(e => e.dataset.testid.replace(/^ask-fact-([a-z_]+)-.*$/, '$1')))]);
  assert.deepEqual(asks, ['joy_con_drift'], 'one question on screen');
  await press(s, 'ask-fact-joy_con_drift-no');
  await s.page.getByText('Do the Joy-Cons drift?').waitFor({ state: 'hidden', timeout: 3000 });
  assert.equal(await s.page.getByTestId('field-joy_con_drift').getAttribute('aria-label'), 'Joy-Con drift: No');
  await s.shows('Ready to plan');
});

// edge-cases §5: each site's listing is written for its buyers, and the item says where a site's listing differs.
test('item: each site row says how its listing differs for its buyers', async () => {
  const s = await reach(ctx, J);
  for (const t of ['Says “size L”', 'No title here: the name opens the description', '$3 more here']) await s.page.getByText(t, { exact: false }).first().waitFor({ timeout: 3000 });
  const r = await reach(ctx, '/item/it_switch');
  await r.page.getByText('Model and specs in the title', { exact: false }).first().waitFor({ timeout: 3000 });
});

// edge-cases §3 and decision "a price below your floor always asks": a typed counter under the lowest says so before it goes.
test('item: a counter typed under the lowest says so on its button, and nothing is sent before the tap', async () => {
  const s = await reach(ctx, J, ['counter', 'counter-amount-other', ['counter-amount-other-input', '60']]);
  await s.shows('Send $60, under your lowest');
  assert.equal(await s.page.getByText(/^Sent \$60/).count(), 0);
});

// edge-cases §3: a misspelled brand is matched against the catalog, and the right spelling is what the person sees.
test('item: a misspelled brand is corrected to the catalog spelling', async () => {
  const s = await reach(ctx, J, ['field-brand', ['field-brand-input', 'Carhart']]);
  await s.page.getByTestId('field-brand').waitFor({ timeout: 3000 });
  assert.equal(await s.page.getByTestId('field-brand').getAttribute('aria-label'), 'Brand: Carhartt');
});

// ways-out Everywhere ("That wasn't what I wanted"): where a site allows no Undo (an accepted offer), the card says so
// before the tap.
test('item: accepting an offer either comes with Undo or said before the tap that it can’t be taken back', async () => {
  const s = await reach(ctx, J);
  const warned = await s.page.getByText(/can’t be undone|can't be undone|can’t take it back|no undo/i).count();
  await press(s, 'accept'); await s.page.getByText('Accepted $85', { exact: false }).first().waitFor({ timeout: 3000 });
  const undo = await s.page.getByText('Undo', { exact: true }).count();
  assert.ok(warned > 0 || undo > 0, 'no Undo after accepting, and nothing said so before the tap');
});

// pages §3 Standing (Slow): the one change worth the most, always with its consequence ("sells about 6 days sooner").
test('item: a slow item’s change says what it does for the sale', async () => {
  const s = await reach(ctx, '/item/it_lamp');
  await s.shows('Lower to $38 on 2 sites');
  await s.page.getByText(/sooner|days faster|sells in about/i).first().waitFor({ timeout: 3000 });
});

// pages §6.6 Sold: the order's clocks, ship by and when the money arrives.
test('item: a sold item shows its ship-by and when the money arrives', async () => {
  const s = await reach(ctx, '/item/it_kindle');
  await s.page.getByText('Ship by', { exact: false }).first().waitFor({ timeout: 3000 });
  await s.page.getByText(/in your bank|money arrives|arrives|paid out/i).first().waitFor({ timeout: 3000 });
});

// ways-out Everywhere ("I'm on bad signal"): taps queue and show Waiting for signal; nothing claims it is done.
for (const [id, done] of [['accept', 'Accepted $85'], ['keep', 'Kept. Took down 2 listings.']]) test(`item: offline, ${id} waits for signal and does not claim it is done`, async () => {
  const s = await reach(ctx, `${J}?state=offline`, [id]);
  await s.page.getByText('Waiting for signal', { exact: false }).first().waitFor({ timeout: 3000 });
  assert.equal(await s.page.getByText(done, { exact: false }).count(), 0);
});

// The testID is how Maestro and the tests find a control (app/e2e/README.md): one control per id on a screen.
for (const route of ['/item/it_hoodie', '/item/it_tee', J]) test(`item: ${route} gives each testID to one control only`, async () => {
  const s = await reach(ctx, route);
  const ids = await s.page.locator('[data-testid]').evaluateAll(els => els.map(e => e.dataset.testid));
  const twice = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  assert.deepEqual(twice, []);
});

// Decision: photos slide in a pager with dots (Ben round 11).
test('item: the photos slide, one at a time', async () => {
  const s = await reach(ctx, '/item/it_tee');
  const pager = s.page.locator('[role="slider"]').first();
  await pager.waitFor({ timeout: 3000 });
  assert.match(await pager.getAttribute('aria-label'), /photo 1 of 8/);
  // A thumb's swipe to the left, as touch events.
  const b = await pager.boundingBox(), y = b.y + b.height / 2, cdp = await s.page.context().newCDPSession(s.page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width * 0.85, y }] });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + b.width * (0.85 - 0.07 * i), y }] }); await s.page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await s.page.waitForTimeout(800);
  assert.match(await pager.getAttribute('aria-label'), /photo 2 of 8/);
});
