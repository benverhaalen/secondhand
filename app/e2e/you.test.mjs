// The You tab (app/behavior/(tabs)/you.json) on the web build: each state in its world, and every control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start, WAIT } from './behavior.mjs';
import { at, youControlTests } from './you-common.mjs';

const table = behavior('(tabs)/you');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

// What each state must show, read from the table's "shows", in the world it names.
const SHOWS = {
  typical: ['You', '$163.63', 'You got from 4 sales, after fees', '$132.33', 'On its way', 'Live', 'Insights', 'Payouts', 'Your sites', 'Signed out', 'Rules and limits', 'Notifications', 'Settings'],
  dense: ['You', 'You got from 8 sales, after fees', 'On its way', '16', 'Live', 'Insights', 'Payouts', 'Your sites'],
  one: ['Nothing sold yet', 'Insights', 'Your sites', 'Signed out', 'Settings'],
  loading: ['You'],
  failed: ['Couldn’t load your numbers', 'The site didn’t answer.', 'Try again'],
  offline: ['Waiting for signal', 'You got from 4 sales, after fees'],
  new: ['Nothing sold yet', 'Sell something', 'Your sites', 'Rules and limits', 'Settings'],
};
// Ben 10:27: "profile shouldnt have analytics, linking services, tracking things, settings". Each of these lives behind its row.
const HIDDEN = {
  typical: ['November goal', 'Sales each week', 'Your things', 'How they’re doing', 'Could still earn', 'Sign in', 'Activity', 'Records', '3 of 5', '3 on their own'],
  new: ['On its way', 'Insights', 'Payouts', 'Activity', 'November goal', 'Sales each week', 'Your things'],
  one: ['Sell something', 'Payouts', 'Sales each week', 'November goal'],
  dense: ['Signed out', 'November goal', 'All 16 live'],
};

test('you: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(SHOWS).sort(), table.states.map(s => s.state).sort());
});

for (const st of table.states) test(`you: ${st.state} (${st.world}) shows ${st.shows.slice(0, 80)}`, async () => {
  const s = await app.open(st.path ?? at('/you', st.world));
  for (const t of SHOWS[st.state]) await s.shows(t);
  for (const t of HIDDEN[st.state] ?? []) assert.equal(await s.count(t, { exact: true }), 0, `${st.state} should not show "${t}"`);
  assert.equal(await s.page.locator(`[data-screen="you"]`).getAttribute('data-state'), st.state);
});

test('you: no tap goes to a control the table does not list', async () => {
  const s = await app.open('/you');
  await s.shows('Settings');
  const listed = new Set(table.controls.map(c => c.id).concat(['tab-today', 'tab-sell', 'tab-new', 'tab-buy', 'tab-you']));
  const ids = await s.page.locator('[data-testid]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')));
  assert.deepEqual(ids.filter(id => !listed.has(id)), []);
});

// One purpose: the glance, then rows that each open a page; the analytics moved to Insights, signing back in to Your sites.
test('you: the glance comes first, then one-line rows, and a signed-out site is one quiet tag on Your sites', async () => {
  const s = await app.open('/you');
  await s.shows('$163.63');
  const top = async t => (await s.page.getByText(t, { exact: true }).first().boundingBox()).y;
  assert.ok(await top('$163.63') < await top('Insights'), 'the money sits above the rows');
  const row = s.page.getByTestId('you-connections');
  assert.equal(await row.locator('[data-part="tag"][data-quiet="true"]').count(), 1, 'Your sites carries one quiet tag');
  assert.equal(await s.page.locator('[data-part="list-row-two"]').count(), 0, 'every row is one line');
  await s.tap('you-insights');
  await s.page.waitForURL(u => new URL(u).pathname === '/you/insights', { timeout: WAIT });
  await s.shows('Sales each week');
});

// One big week is read with its count of sales under it: each week's column names how many sales made it.
test('you: each week in the chart, now on Insights, says how many sales made it', async () => {
  const s = await app.open('/you/insights?world=flipper');
  await s.shows('Sales each week');
  const label = await s.page.getByLabel(/^Week of 9: \$243\.90 from 6 sales$/).count();
  assert.equal(label, 1, 'this week reads as 6 sales');
});

youControlTests(test, table, () => app, '/you');
