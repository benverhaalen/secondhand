// First launch (app/behavior/onboarding.json) on the web build: each state, and every control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start } from './behavior.mjs';
import { youControlTests } from './you-common.mjs';

const table = behavior('onboarding');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

const STATES = {
  new: { shows: ['secondhand', '1 of 2', 'Your sites', 'Link the ones you sell on. Each one is optional.', 'Not linked', 'Skip for now'], state: 'new' },
  loading: { taps: ['link-ebay'], shows: ['Signing in'], state: 'loading' },
  typical: { taps: ['link-ebay'], wait: 1600, shows: ['Linked', '1 site linked. Add the rest now or later.', 'Continue'], state: 'typical' },
  failed: { taps: ['link-mercari'], wait: 1600, shows: ['Didn’t link', 'The code from your phone timed out', 'Try again'], state: 'failed' },
  photo: { taps: ['onboarding-next'], shows: ['2 of 2', 'First photo', 'Later', 'Take a photo'] },
};

test('onboarding: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(STATES).sort(), table.states.map(s => s.state).sort());
});

for (const st of table.states) test(`onboarding: ${st.state} shows ${st.shows.slice(0, 70)}`, async () => {
  const want = STATES[st.state], s = await app.open('/onboarding');
  for (const id of want.taps ?? []) await s.tap(id);
  if (want.wait) await s.page.waitForTimeout(want.wait);
  for (const t of want.shows) await s.shows(t);
  if (want.state) assert.equal(await s.page.locator('[data-screen="onboarding"]').getAttribute('data-state'), want.state);
});

// Continue never waits for every site: with one still signing in, the next step opens.
test('onboarding: moving on never waits for every site', async () => {
  const s = await app.open('/onboarding');
  await s.tap('link-ebay');
  await s.shows('Signing in');
  await s.tap('onboarding-next');
  await s.shows('First photo');
});

youControlTests(test, table, () => app, '/onboarding');
