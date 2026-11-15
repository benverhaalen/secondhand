// The behavior of item/[id]/pickup (app/behavior/item/[id]/pickup.json), on the web build: every state, no unlisted tap, every control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start, WAIT } from './behavior.mjs';
import { drag, pageTests, reach } from './steps.mjs';

const table = behavior('item/[id]/pickup');
const ASK = '/item/it_chair/pickup?case=ask';
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

pageTests(test, table, () => app);

// The address waits for the person's own words and tap (share_address is locked; ways-out §6.9).
test('pickup: Send my address sends nothing until an address is typed', async () => {
  const s = await reach(app, table, { after: ['pickup-share'] });
  await s.tap('pickup-send-address');
  await s.page.waitForTimeout(1200);
  assert.equal(await s.count('Sent your address to Jordan'), 0);
  await s.tap('pickup-address');
  await s.page.getByTestId('pickup-address-input').fill('12 Elm St');
  await s.tap('pickup-send-address');
  await s.shows('Sent your address to Jordan');
});

// edge-cases §16: no day is picked for the person, and the message says what they tapped, the way a person says it.
test('pickup: nothing is offered until the person picks a day, then the message says it in words', async () => {
  const s = await reach(app, table, { route: ASK });
  await s.shows('Days that work');
  assert.equal(await s.countId('meet-draft-send'), 0);
  await s.tap('meet-day-2026-11-16');
  await s.tap('meet-day-2026-11-20');
  await s.shows(/I’m free tomorrow 2 to 4 pm or Fri 2 to 4 pm\. Library parking lot on Main St works for me\. Does either suit you\?/);
  await s.tap('place-sp_police');
  await s.shows(/Police station on Elm St works for me/);
});

test('pickup: dragging a span changes the time it says, and a span after dark holds Send until the person says so', async () => {
  const s = await reach(app, table, { route: ASK, after: ['meet-day-2026-11-16'] });
  await drag(s, 'span-2026-11-16-end', 120);
  await s.shows('Ends after dark');
  await s.shows(/I’m free tomorrow 2 to \d+(:30)? pm/);
  assert.equal(await s.count('2 to 4 pm'), 0);
  assert.equal(await s.page.getByTestId('meet-draft-send').getAttribute('aria-disabled'), 'true');
  await s.tap('meet-dark-ok');
  assert.notEqual(await s.page.getByTestId('meet-draft-send').getAttribute('aria-disabled'), 'true');
});

// spec/notifications.md, "A pickup within the hour": On my way, only then.
test('pickup: On my way shows within the hour and tells the buyer', async () => {
  const later = await reach(app, table);
  assert.equal(await later.countId('pickup-on-my-way'), 0);
  const s = await reach(app, table, { route: '/item/it_chair/pickup?case=soon' });
  await s.tap('pickup-on-my-way');
  await s.shows('Told Jordan you’re on your way');
});

// Ben, 06:19: a way back to the site, and its own picture where a time has to be checked.
test('pickup: the site is one tap away, by its logo, with its own picture of the thread', async () => {
  const s = await reach(app, table);
  await s.page.getByTestId('pickup-site').filter({ visible: true }).waitFor({ state: 'visible', timeout: WAIT });
  assert.equal(await s.page.getByText('Facebook', { exact: true }).filter({ visible: true }).count(), 0);
  await s.tap('pickup-snapshot');
  await s.shows('As the site shows it');
  await s.page.getByTestId('pickup-copy-site').filter({ visible: true }).waitFor({ state: 'visible', timeout: WAIT });
});

// edge-cases §16 step 3 and 4: who is coming before the yes, and the calendar only after it.
test('pickup: the buyer’s pick shows who is coming, and the calendar comes only after Approve', async () => {
  const s = await reach(app, table, { route: '/item/it_chair/pickup?case=pick' });
  await s.shows('4.9 stars from 31 reviews, on the site since 2019');
  assert.equal(await s.countId('cal-google'), 0);
  await s.tap('meet-approve');
  await s.page.getByTestId('cal-google').waitFor({ state: 'visible', timeout: WAIT });
  await s.shows('Told Jordan you’ll meet tomorrow at 3 pm');
});
