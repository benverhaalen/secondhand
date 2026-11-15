// The behavior of the Post preview (app/behavior/item/[id]/post.json), on the web build: node --test app/e2e/post.test.mjs
// Written from the render and the spec (pages §6.8, ways-out §6.8, edge-cases §5, §7), not from the page's code.
// Amounts are matched, not the words around them: the money line is moving from "You keep" to "You get" (Ben, 06:19).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemPage, reach, press } from './item-common.mjs';

const ctx = itemPage(test, 'item/[id]/post', 'post');
const SP = '/item/it_switch/post';

// edge-cases §5: each site gets the listing its own buyers want, and one line says who buys there.
test('post: each site’s preview is written for its buyers', async () => {
  const s = await reach(ctx, SP);
  await s.shows('Nintendo Switch OLED, white, with dock, HEG-001, 64 GB'); // eBay: model and specs in the title
  await s.shows('Nintendo Switch OLED, white, with dock'); // Facebook: short
  await s.shows('Searched by model: specs in the title');
  await s.shows('Nearby, picks up today: pickup price');
  const j = await reach(ctx, '/item/it_jacket/post');
  await j.shows('Carhartt Detroit Jacket J97, brown duck, size L'); // Depop: size spelled out
  await j.shows('Young, shops a look: size up front');
});

// pages §6.8 and the hand-off rule: Approve names the price and the count of sites, and the count follows the ticks.
test('post: Approve names the price and the sites, and unticking every site leaves nothing to post', async () => {
  const s = await reach(ctx, SP);
  await s.shows('Post from $225 on 2 sites');
  await press(s, 'post-facebook'); await s.shows('Post at $235 on 1 site');
  await press(s, 'post-ebay'); await s.shows('Pick a site');
  await press(s, 'post').catch(() => {}); await s.page.waitForTimeout(800);
  assert.equal(await s.page.getByText(/^Posted/).count(), 0, 'nothing posts with no site ticked');
});

// edge-cases §7 step 7 and pages §6.8: a site that still needs a field shows a dot there, and does not post until it is filled.
test('post: a site still missing a field does not post until the field is filled', async () => {
  const s = await reach(ctx, SP);
  await s.page.getByTestId('needs-ebay').waitFor({ timeout: 3000 });
  await press(s, 'post');
  const posted = await s.page.getByText(/^Post(ing|ed)\b/).first().waitFor({ timeout: 5000 }).then(() => true, () => false);
  assert.equal(posted, false, 'started posting while eBay and Facebook still need Joy-Con drift');
});

// The item is one record and each listing is built from it (edge-cases §10): a field filled on one site's card fills every site.
test('post: a field filled for one site fills it on every site', async () => {
  const s = await reach(ctx, SP, ['needs-ebay', ['needs-ebay-input', 'No']]);
  for (const id of ['needs-ebay', 'needs-facebook']) assert.equal(await s.page.getByTestId(id).getAttribute('aria-label'), 'Joy-Con drift: No', id);
});

// ways-out Everywhere ("I'm on bad signal"): Post waits for signal and does not claim anything is live.
test('post: offline, Post waits for signal and does not claim it posted', async () => {
  const s = await reach(ctx, `${SP}?state=offline`, ['post']);
  await s.page.getByText('Waiting for signal', { exact: false }).first().waitFor({ timeout: 3000 });
  assert.equal(await s.page.getByText('Posted on 2 sites').count(), 0);
});

// ways-out §6.8 ("Post it Sunday evening"): the typed time is on the button, so the tap says when.
test('post: a later time is named on the button', async () => {
  const s = await reach(ctx, SP, ['when-other', ['when-other-input', 'Sunday 6 pm']]);
  await s.shows('Post from $225 on 2 sites, Sunday 6 pm');
});
