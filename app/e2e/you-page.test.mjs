// The pages under You (app/behavior/you/[page].json) on the web build: each page's states, the linking states, and every control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start } from './behavior.mjs';
import { youControlTests } from './you-common.mjs';

const table = behavior('you/[page]');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

// What each state shows, from the table. A state reached by taps lists them in "taps" and waits between them.
const STATES = {
  'payouts typical': { shows: ['Payouts', '$132.33', 'On its way, after fees', 'On its way', 'Paid out', 'Paid in hand at pickup', 'Landed Nov 1'] },
  'payouts new': { shows: ['Payouts', 'No payouts yet'] },
  'insights typical': { shows: ['By site', '2 sales', 'Sells in about 11 days', 'What your things are worth', '$85 to $115', 'November goal', 'Kept so far', '$300 a month'] },
  'insights new': { shows: ['By site', 'Each site you sell on shows here once it has a sale.', 'Amount'] },
  'records typical': { shows: ['Records', '2026', 'Sold, 4 sales', 'Fees and labels', '$25.37', 'Kept', '$163.63', 'Download CSV'] },
  'records new': { shows: ['Records', 'No sales this year'], hidden: ['Download CSV'] },
  'connections typical': { shows: ['Your sites', 'Linked', 'Needs you', 'Signed out yesterday at 9 pm', 'Try again', 'Not linked', 'Link', 'Your password goes to the site, never to secondhand.'] },
  'connections loading': { taps: ['link-mercari'], shows: ['Signing in'] },
  'connections failed': { taps: ['link-mercari'], wait: 1600, shows: ['Didn’t link', 'The code from your phone timed out'] },
  'rules typical': { shows: ['Rules and limits', 'Runs on its own', 'Answer questions about facts', 'Asks you first. Approved 2 of 3 times without a change', 'Always asks you', 'Sharing your address', 'Lowest prices', 'Brass desk lamp with cream shade'] },
  'rules new': { shows: ['Rules and limits', 'Approve the same kind of card 3 times without a change, and it can run on its own here.', 'Always asks you'] },
  'log typical': { shows: ['Activity', 'Today', 'Yesterday', 'Answered “blanket lined” from the tag photo', 'Undo'] },
  'log new': { shows: ['Activity', 'Nothing done for you yet'] },
  'settings typical': { shows: ['Settings', 'Pause selling', 'Quiet hours', 'Never suggest photo edits', 'Notifications', 'Offers', 'Right away', 'In a batch', 'Measurements', 'Inches', 'US dollars', 'Signed in with', 'Apple', 'Export your data', 'Sign out', 'Delete account'] },
  'not found': { shows: ['Not found'] },
};

test('you/[page]: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(STATES).sort(), table.states.map(s => s.state).sort());
});

for (const st of table.states) test(`you/[page]: ${st.state} shows ${st.shows.slice(0, 70)}`, async () => {
  const want = STATES[st.state], s = await app.open(st.path);
  for (const id of want.taps ?? []) await s.tap(id);
  if (want.wait) await s.page.waitForTimeout(want.wait);
  for (const t of want.shows) await s.shows(t);
  for (const t of want.hidden ?? []) assert.equal(await s.page.getByText(t, { exact: true }).count(), 0, `${st.state} should not show "${t}"`);
});

// Linking one site never blocks another (Ben, 03:22): while Mercari signs in, Poshmark's Try again still works.
test('you/[page]: one site signing in never blocks the rest', async () => {
  const s = await app.open('/you/connections');
  await s.tap('link-mercari');
  await s.shows('Signing in');
  await s.tap('link-poshmark');
  await s.saw({ type: 'change', entity: 'account', id: 'poshmark', to: 'loading' });
  await s.saw({ type: 'change', entity: 'account', id: 'poshmark', to: 'connected' }, { timeout: 4000 });
  await s.saw({ type: 'change', entity: 'account', id: 'mercari', to: 'error' }, { timeout: 4000 });
  await s.tap('link-mercari');
  await s.saw({ type: 'change', entity: 'account', id: 'mercari', to: 'connected' }, { timeout: 4000 });
});

// A rule under three unedited approvals cannot be switched on; one at three can (decisions: tiers that learn).
test('you/[page]: a rule turns on only after three approvals without a change', async () => {
  const s = await app.open('/you/rules?world=flipper');
  await s.shows('Buy shipping labels');
  await s.tap('rule-switch-ru_flb');
  await s.saw({ type: 'change', entity: 'rule', id: 'ru_flb', to: 'auto' });
});

// Delete is refused while a sale is open (ways-out, Delete it), and offered on Approve when none is.
test('you/[page]: delete account waits for open sales to finish', async () => {
  const s = await app.open('/you/settings');
  await s.tap('delete-row');
  await s.shows('3 sales are still open. You can delete once they are done.');
  assert.equal(await s.page.getByTestId('delete-confirm').count(), 0);
  const n = await app.open('/you/settings?world=new');
  await n.tap('delete-row');
  await n.shows('Delete account');
  await n.tap('delete-confirm');
  await n.saw({ type: 'change', entity: 'account', to: 'delete_requested' });
});

// A price is saved only on Approve, and the save can be undone (README, the hand-off rule).
test('you/[page]: limits save on Approve and undo', async () => {
  const s = await app.open('/you/rules');
  await s.tap('limit-it_lamp');
  await s.shows('Lowest you’d take');
  await s.tap('limit-save');
  await s.saw({ type: 'change', entity: 'limits', id: 'it_lamp' });
  await s.shows('Saved');
  await s.tap('limit-save-undo');
  await s.saw({ type: 'change', entity: 'limits', id: 'it_lamp', to: 'undone' });
});

youControlTests(test, table, () => app, '/you/settings');
