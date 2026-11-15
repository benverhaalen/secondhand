// One site under Your sites (app/behavior/you/connections/[site].json) on the web build: each state, and every control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start } from './behavior.mjs';
import { youControlTests } from './you-common.mjs';

const table = behavior('you/connections/[site]');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

const STATES = {
  typical: ['Linked', 'What we read', '4 live listings', '1 thread with buyers', 'What we did', 'Took this listing down because it sold on the other site. Checked on the site after', 'Changed there, not by us', 'Unlink'],
  mismatch: ['Doesn’t match', 'Brass desk lamp with cream shade', 'Open on the site'],
  failed: ['Needs you', 'Try again', 'Nothing until you sign in again'],
  new: ['Not linked', 'Link', 'What we did'],
  empty: ['Linked', 'Nothing yet. Each step shows here with what the site showed after.'],
  'not found': ['Not found'],
};

test('you/connections/[site]: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(STATES).sort(), table.states.map(s => s.state).sort());
});

for (const st of table.states) test(`you/connections/[site]: ${st.state} shows ${st.shows.slice(0, 70)}`, async () => {
  const s = await app.open(st.path);
  for (const t of STATES[st.state]) await s.shows(t);
});

// The three lists come in Ben's order (05:18), with what doesn't match above them.
test('you/connections/[site]: doesn’t match, then read, did, and changed, in that order', async () => {
  const s = await app.open('/you/connections/ebay?world=edge');
  const y = async t => (await s.page.getByText(t, { exact: true }).first().boundingBox())?.y ?? -1;
  const ys = [await y('Doesn’t match'), await y('What we read'), await y('What we did'), await y('Changed there, not by us')];
  assert.ok(ys.every(v => v >= 0), `every section shows: ${ys}`);
  assert.deepEqual([...ys].sort((a, b) => a - b), ys, 'sections in order');
});

youControlTests(test, table, () => app, '/you/connections/ebay');
