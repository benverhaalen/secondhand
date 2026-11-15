// The behavior of the index screen (app/behavior/index.json), on the web build. Copy this file for a new page:
// one fixture per state in the table, one test per state, and controlTests() for every control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, controlTests, start } from './behavior.mjs';

const table = behavior('index');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

// What the backend answers for each state in the table. The keys must be the table's states, no more and no fewer.
const connected = { ok: true, state: 'SUCCEEDED', catalog: 'secondhand', at: '2026-11-15 04:00' };
const STATES = {
  loading: { api: { '/v1/health': { wait: 2000, body: connected } }, shows: 'Checking Databricks' },
  connected: { api: { '/v1/health': connected }, shows: 'Databricks connected: secondhand, 2026-11-15 04:00' },
  'not ready': { api: { '/v1/health': { ok: false, state: 'PENDING' } }, shows: 'Databricks not ready: PENDING' },
  unreachable: { api: { '/v1/health': 'fail' }, shows: 'The server did not answer' },
};

test('index: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(STATES).sort(), table.states.map(s => s.state).sort());
});

for (const [name, { api, shows }] of Object.entries(STATES)) test(`index: ${name} shows ${table.state(name).shows}`, async () => {
  const s = await app.open('/', { api });
  await s.shows('secondhand');
  await s.shows(shows);
});

// Every tap the screen logs is a control the table lists, so nothing on screen does something nobody wrote down.
test('index: no tap goes to a control the table does not list', async () => {
  const s = await app.open('/', { api: STATES.connected.api });
  await s.shows(STATES.connected.shows);
  for (const el of await s.page.locator('[data-testid]').all()) if (await el.isVisible()) await el.tap().catch(() => {});
  const listed = new Set(table.controls.map(c => c.id));
  assert.deepEqual((await s.events()).filter(e => e.type === 'tap' && !listed.has(e.id)), []);
});

controlTests(test, table, () => app.open('/', { api: STATES.connected.api }));
