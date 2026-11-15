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
  typical: ['You', 'Signed out yesterday at 9 pm', 'Sign in', '$163.63', 'You got from 4 sales, after fees', 'Paid out', '$31.30', 'On its way', 'Ready on the site about Tuesday', '$132.33',
    'Could still earn', 'If your 4 live things sell', '$253 to $276', 'Sales each week', '$200', 'Sales', 'Your things', 'Getting ready', 'Kept, worth $70 to $95',
    'How they’re doing', 'Brass desk lamp with cream shade', 'days up', 'The tick is what’s usual for it', 'By site', 'Records', 'Your sites', '3 of 5', 'Rules and limits', '3 on their own', 'Activity', 'Notifications', 'Settings'],
  dense: ['You', 'You got from 8 sales, after fees', 'On its way', '$250', 'All 16 live', 'Your sites', '5 of 5'],
  one: ['Sign in', 'Nothing sold yet', 'Could still earn', 'If your 1 live thing sells', 'How they’re doing', 'Your sites', 'Settings'],
  loading: ['You'],
  failed: ['Couldn’t load your numbers', 'The site didn’t answer. Nothing changed.', 'Try again'],
  offline: ['Waiting for signal', 'You got from 4 sales, after fees'],
  new: ['Nothing sold yet', 'Sell something', 'Your sites', '0 of 5', 'Rules and limits', 'Settings'],
};
// Ben 06:19: no month goal on You, and no "4 live, could earn".
const HIDDEN = {
  typical: ['November goal', '4 live, could earn', 'A site signed you out'],
  new: ['On its way', 'By site', 'Records', 'Activity', 'November goal', 'Sales each week', 'Your things'],
  one: ['Sell something', 'Records', 'Sales each week', 'November goal'],
  dense: ['Sign in', 'November goal'],
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

// One tap on the signed-out row starts that site's own sign-in, in place, and the row says when it is done (Ben 06:19).
test('you: Sign in on a signed-out site signs back in without leaving You', async () => {
  const s = await app.open('/you');
  await s.tap('you-signin-poshmark');
  await s.shows('Signing in');
  await s.shows('Finish on Poshmark’s own page');
  await s.saw({ type: 'change', entity: 'account', id: 'poshmark', to: 'connected' }, { timeout: WAIT });
  await s.shows('Linked again');
  assert.equal(new URL(s.page.url()).pathname, '/you');
});

// The order a person looks: the money first, then the signed-out site, still on the first screen of a phone (Art. 7.4).
test('you: the money comes first, and the signed-out row sits under it on the first screen', async () => {
  const s = await app.open('/you');
  await s.shows('$163.63');
  const top = async t => (await s.page.getByText(t, { exact: true }).first().boundingBox()).y;
  const money = await top('$163.63'), signedOut = await top('Signed out yesterday at 9 pm');
  assert.ok(money < signedOut, `the money (${money}) sits above the sign-in row (${signedOut})`);
  assert.ok(signedOut < 844 - 34, `the sign-in row (${signedOut}) is on the first screen`);
});

// One big week is read with its count of sales under it: each week's column names how many sales made it.
test('you: each week in the chart says how many sales made it', async () => {
  const s = await app.open('/you?world=flipper');
  await s.shows('Sales each week');
  const label = await s.page.getByLabel(/^Week of 9: \$243\.90 from 6 sales$/).count();
  assert.equal(label, 1, 'this week reads as 6 sales');
});

youControlTests(test, table, () => app, '/you');
