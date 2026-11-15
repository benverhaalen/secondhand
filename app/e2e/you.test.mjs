// The You tab (app/behavior/(tabs)/you.json) on the web build: each state in its world, and every control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start } from './behavior.mjs';
import { at, youControlTests } from './you-common.mjs';

const table = behavior('(tabs)/you');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

// What each state must show, read from the table's "shows", in the world it names.
const SHOWS = {
  typical: ['You', 'A site signed you out', '$163.63', 'Earned after fees, from 4 sales', 'On its way', 'Ready on the site about Tuesday', '$132.33', '4 live, could earn', '1 kept, worth', 'November goal', 'By site', 'Records', 'Your sites', '3 of 5', 'Rules and limits', '3 on their own', 'Activity', 'Notifications', 'Settings'],
  dense: ['You', 'Earned after fees, from 8 sales', 'On its way', 'November goal', 'Your sites', '5 of 5'],
  one: ['Nothing sold yet', '1 live, could earn', 'November goal', 'Your sites', 'Settings'],
  new: ['Nothing sold yet', 'Sell something', 'Your sites', '0 of 5', 'Rules and limits', 'Settings'],
};
const HIDDEN = { new: ['On its way', 'By site', 'Records', 'Activity', 'November goal'], one: ['Sell something', 'Records'], dense: ['A site signed you out'] };

test('you: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(SHOWS).sort(), table.states.map(s => s.state).sort());
});

for (const st of table.states) test(`you: ${st.state} (${st.world}) shows ${st.shows.slice(0, 80)}`, async () => {
  const s = await app.open(at('/you', st.world));
  for (const t of SHOWS[st.state]) await s.shows(t);
  for (const t of HIDDEN[st.state] ?? []) assert.equal(await s.page.getByText(t, { exact: true }).count(), 0, `${st.state} should not show "${t}"`);
  assert.equal(await s.page.locator(`[data-screen="you"]`).getAttribute('data-state'), st.state);
});

test('you: no tap goes to a control the table does not list', async () => {
  const s = await app.open('/you');
  await s.shows('Settings');
  const listed = new Set(table.controls.map(c => c.id).concat(['tab-today', 'tab-sell', 'tab-new', 'tab-buy', 'tab-you']));
  const ids = await s.page.locator('[data-testid]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')));
  assert.deepEqual(ids.filter(id => !listed.has(id)), []);
});

youControlTests(test, table, () => app, '/you');
