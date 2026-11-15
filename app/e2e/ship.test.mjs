// The behavior of item/[id]/ship (app/behavior/item/[id]/ship.json), on the web build: every state, no unlisted tap, every control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start } from './behavior.mjs';
import { pageTests, reach } from './steps.mjs';

const table = behavior('item/[id]/ship');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

pageTests(test, table, () => app);

// What the edge cases (spec/edge-cases.md §1, §2) ask of this page, beyond its controls.
test('ship: a thing sold on two sites offers no label', async () => {
  const s = await reach(app, table, { route: '/item/it_kindle/ship?case=double' });
  await s.shows('Sold on two sites');
  assert.equal(await s.page.getByTestId('ship-print').count(), 0);
});

test('ship: the money shows its four words, and instant payout is offered with its fee but not picked', async () => {
  const s = await reach(app, table, { route: '/item/it_f017/ship?world=flipper' });
  for (const w of ['Sold', 'On its way', 'Ready on the site', 'In your bank', 'Same day, $3']) await s.shows(w);
  // The free, standard payout is the one standing; same day shows only after its own tap.
  await s.shows('About 5 business days after that');
  assert.equal(await s.page.getByText('The day it’s ready, for $3').count(), 0);
  await s.tap('payout-speed-today');
  await s.shows('The day it’s ready, for $3');
});

test('ship: no instant payout where the site states no fee', async () => {
  const s = await reach(app, table);
  await s.shows('In your bank');
  assert.equal(await s.page.getByTestId('payout-speed-today').count(), 0);
});

test('ship: offline, Buy label holds on its pill and nothing is printed', async () => {
  const s = await reach(app, table, { route: '/item/it_kindle/ship?state=offline' });
  await s.tap('ship-print');
  await s.page.waitForTimeout(1500);
  assert.equal(await s.page.getByText('Waiting for signal').count(), 2);
  assert.equal(await s.page.getByText('Label printed').count(), 0);
});

test('ship: going without tracking says what it gives up', async () => {
  const s = await reach(app, table, { after: ['ship-myself', 'self-tracking-without'] });
  await s.shows('Without tracking, the site can’t protect you if the buyer says it never came.');
});
