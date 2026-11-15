// The pages under You (app/behavior/you/[page].json) on the web build: each page's states, the linking states, and every control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start, WAIT } from './behavior.mjs';
import { youControlTests } from './you-common.mjs';

const table = behavior('you/[page]');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

// What each state shows, from the table. A state reached by taps lists them in "taps" and waits between them.
const STATES = {
  'payouts typical': { shows: ['Payouts', '$132.33', 'On its way, after fees', 'On its way', 'Paid out', 'On its way after you ship', 'In your hand at pickup', 'In your bank Nov 4'] },
  'payouts new': { shows: ['Payouts', 'No payouts yet'] },
  'insights typical': { shows: ['Insights', 'Sales each week', 'Your things', 'Kept, worth $70 to $95', 'How they’re doing', 'Brass desk lamp with cream shade', 'The tick is what’s usual for it', 'By site', '2 sales', 'Sells in about 11 days', 'What your things are worth', '$85 to $115', 'November goal', 'Kept so far', '$300 a month'] },
  'insights new': { shows: ['Insights', 'By site', 'Each site you sell on shows here once it has a sale.', 'Amount'] },
  'records typical': { shows: ['Records', '2026', 'Sold, 4 sales', 'Fees and labels', '$25.37', 'Kept', '$163.63', 'Download CSV'] },
  'records new': { shows: ['Records', 'No sales this year'], hidden: ['Download CSV'] },
  'connections mismatch': { shows: ['Doesn’t match', 'Brass desk lamp with cream shade', 'Open on the site'] },
  'connections typical': { shows: ['Your sites', 'Linked', 'Needs you', 'Signed out yesterday at 9 pm', 'Retry', 'Not linked', 'Link', 'Your password goes to the site, never to secondhand.'] },
  'connections loading': { taps: ['link-mercari'], shows: ['Signing in'] },
  'connections failed': { taps: ['link-mercari'], wait: 1600, shows: ['Didn’t link', 'The code from your phone timed out'] },
  'rules typical': { shows: ['Rules and limits', 'Runs on its own', 'Answer questions about facts', 'Asks you first. Approved 2 of 3 times without a change', 'Permissions', 'Lowest prices', 'Brass desk lamp with cream shade'] },
  'rules new': { shows: ['Rules and limits', 'Approve the same kind of card 3 times without a change, and it can run on its own here.', 'Permissions'] },
  'log typical': { shows: ['Activity', 'Today', 'Yesterday', 'Answered “blanket lined” from the tag photo', 'Undo'] },
  'log new': { shows: ['Activity', 'Nothing done for you yet'] },
  'notifications typical': { shows: ['Notifications', 'Right away', 'In the next summary', 'It sold', 'An offer you’d take', 'Never sent', 'Group by item', 'Quiet hours', '10 pm', '8 am', 'On the lock screen', 'Accept, Approve and Counter', 'Face ID', 'Show messages and addresses'] },
  'defaults typical': { shows: ['App defaults', 'How it sells', 'Sell it', 'Sites', 'Prices across sites', 'Same take-home', 'Ship or pickup', 'Pickup spot', 'Library parking lot, Main St', 'Lowest price', 'Suggested', 'Clean up', 'Enhance with AI', 'Off: photos are never redrawn', 'Never suggest photo edits', 'Replies sound', 'Like you', 'Measurements', 'Inches', 'US dollars'] },
  'permissions typical': { shows: ['Permissions', 'Counter offers above your lowest', 'On its own', 'Asks first', 'Take a listing down after it sells', 'So it can’t sell twice', 'Always asks you', 'Sharing your address', 'Always asks', 'Never', 'Taking a deal off the site', 'Rules and limits'] },
  'loading (any page)': { shows: ['Payouts'], state: 'loading' },
  'failed (any page)': { shows: ['Couldn’t load your payouts', 'Retry'], state: 'failed' },
  'offline (any page)': { shows: ['Waiting for signal', 'On its way'], state: 'offline' },
  'settings typical': { shows: ['Settings', 'Pause selling', 'Notifications', 'App defaults', 'Permissions', 'Signed in with', 'Apple', 'Export your data', 'Sign out', 'Delete account'] },
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
  if (want.state) assert.equal(await s.page.locator('[data-screen]').first().getAttribute('data-state'), want.state);
  for (const t of want.hidden ?? []) assert.equal(await s.count(t, { exact: true }), 0, `${st.state} should not show "${t}"`);
});

// Linking one site never blocks another (Ben, 03:22): while Mercari signs in, Poshmark's Retry still works.
test('you/[page]: one site signing in never blocks the rest', async () => {
  const s = await app.open('/you/connections');
  await s.tap('link-mercari');
  await s.shows('Signing in');
  await s.tap('link-poshmark');
  await s.saw({ type: 'change', entity: 'account', id: 'poshmark', to: 'loading' });
  await s.saw({ type: 'change', entity: 'account', id: 'poshmark', to: 'connected' }, { timeout: WAIT });
  await s.saw({ type: 'change', entity: 'account', id: 'mercari', to: 'error' }, { timeout: WAIT });
  await s.tap('link-mercari');
  await s.saw({ type: 'change', entity: 'account', id: 'mercari', to: 'connected' }, { timeout: WAIT });
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
  assert.equal(await s.countId('delete-confirm'), 0);
  const n = await app.open('/you/settings?world=new');
  await n.tap('delete-row');
  await n.shows('Delete account');
  await n.tap('delete-confirm');
  await n.saw({ type: 'change', entity: 'account', to: 'delete_requested' });
});

// A sale's money moves through four words, each with its date (spec/edge-cases.md, Ben 05:05), and instant payout is offered
// with its fee only once the money is ready on the site, never as the default.
test('you/[page]: a payout shows its four words with dates, and instant payout with its fee', async () => {
  const s = await app.open('/you/payouts');
  await s.tap('payout-ord_kin');
  for (const t of ['Sold', 'On its way', 'After you ship', 'Ready on the site', 'About Tuesday', 'In your bank', 'About Friday', 'See the item']) await s.shows(t);
  assert.equal(await s.countId('payout-instant'), 0, 'no instant payout before the money is ready on the site');
  const f = await app.open('/you/payouts?world=flipper');
  await f.shows('Ready on the site. In your bank about Wednesday');
  await f.tap('payout-ord_f6');
  await f.shows('Free if you wait: in your bank about Wednesday.');
  await f.shows('Get it today for $3');
  await f.tap('payout-instant');
  await f.saw({ type: 'change', entity: 'payout', id: 'ord_f6', to: 'instant_requested' });
  await f.shows('Today, with the fee');
});

// Face ID guards every lock-screen act that commits the person, and has no switch (spec/notifications.md).
test('you/[page]: lock-screen Accept, Approve and Counter need Face ID, with no switch', async () => {
  const s = await app.open('/you/notifications');
  await s.shows('Accept, Approve and Counter');
  await s.shows('Face ID');
  assert.equal(await s.page.getByRole('switch', { name: /Accept|Face ID/ }).count(), 0, 'the Face ID row has no switch');
  assert.ok(await s.page.getByRole('switch').count() > 5, 'the kinds do have switches');
});

// Mismatches lead Your sites, across every site (Ben 05:18), and a clean world has none.
test('you/[page]: what doesn’t match comes before the sites', async () => {
  const s = await app.open('/you/connections?world=edge');
  const top = await s.page.getByText('Doesn’t match', { exact: true }).boundingBox();
  const site = await s.page.getByTestId('site-row-ebay').boundingBox();
  assert.ok(top && site && top.y < site.y, 'Doesn’t match sits above the site rows');
  const c = await app.open('/you/connections');
  await c.shows('Your sites');
  assert.equal(await c.count('Doesn’t match', { exact: true }), 0);
});

// Every page under You draws the network states from ?state= (app/src/demo/screen.ts).
for (const page of ['payouts', 'insights', 'records', 'connections', 'rules', 'log', 'notifications', 'defaults', 'permissions', 'settings']) {
  test(`you/[page]: ${page} draws loading, failed and offline`, async () => {
    for (const st of ['loading', 'failed', 'offline']) {
      const s = await app.open(`/you/${page}?state=${st}`);
      await s.page.locator(`[data-screen="you-${page === 'connections' ? 'connections' : page}"]`).first().waitFor({ state: 'attached' });
      assert.equal(await s.page.locator('[data-screen]').first().getAttribute('data-state'), st, `${page} at ${st}`);
    }
  });
}

// A kind that starts by asking is never offered On its own: running alone is earned (decisions: tiers that learn).
test('you/[page]: a kind that asks can be made Never, but not On its own, from defaults', async () => {
  const s = await app.open('/you/permissions');
  await s.tap('perm-reply_other');
  await s.shows('To let it run on its own, approve it 3 times without a change.');
  assert.equal(await s.countId('mode-auto'), 0);
  await s.tap('mode-never');
  await s.saw({ type: 'change', entity: 'permission', id: 'reply_other', to: 'never' });
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

// The account's price rule: words first, the numbers for one jacket a tap under them (Ben 06:53), Same take-home by default.
test('you/[page]: prices across sites start on Same take-home, and the numbers show what each site pays you', async () => {
  const s = await app.open('/you/defaults');
  await s.tap('default-spread');
  await s.shows('You get the same money wherever it sells. Sites with higher fees show a higher price.');
  await s.tap('spread-numbers');
  await s.shows('$95 now');
  await s.shows('$3.80 in fees');
  assert.equal(await s.count('You get $91.20', { exact: true }), 3, 'Depop, eBay and Facebook each pay $91.20');
  await s.tap('spread-rules');
  await s.tap('spread-same_price');
  await s.saw({ type: 'change', entity: 'setting', id: 'crosslist_spread', to: 'same_price' });
  await s.tap('spread-numbers');
  await s.shows('Lists at $95');
  assert.equal(await s.count('Lists at $95', { exact: true }), 2, 'one price on every site');
});

youControlTests(test, table, () => app, '/you/settings');
