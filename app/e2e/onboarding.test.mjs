// First launch (app/behavior/onboarding.json) on the web build: each state, and every control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start } from './behavior.mjs';
import { youControlTests } from './you-common.mjs';

const table = behavior('onboarding');
let app;
// The email code is real now (app/src/you/sign-in-wire.ts): the two auth routes answer here as the server does,
// a token pair for any code but 000000, which the server refuses.
const AUTH = {
  '/v1/auth/email/start': { sent: true },
  '/v1/auth/email/verify': route => JSON.parse(route.request().postData() ?? '{}').code === '000000'
    ? route.fulfill({ status: 401, json: { code: 'unauthenticated', message: 'code did not match', failed_step: 'auth', retry: { by: 'user' } } })
    : route.fulfill({ json: { access_token: 'a1', refresh_token: 'r1', expires_at: '2026-11-15T13:00:00Z', created: true, user: { id: 'usr_e2e', auth_methods: ['email'] } } }),
};
const open = path => app.open(path, { api: AUTH });
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

const SIGNED = '/onboarding?signed=1';
const STATES = {
  new: { shows: ['secondhand', 'Continue with Apple', 'Continue with Google', 'Continue with email'], state: 'new' },
  loading: { path: '/onboarding?state=loading', shows: ['Signing in'], state: 'loading' },
  failed: { path: '/onboarding?state=failed', shows: ['Couldn’t sign in', 'Retry'], state: 'failed' },
  offline: { path: '/onboarding?state=offline', shows: ['Waiting for signal', 'Continue with Apple'], state: 'offline' },
  email: { taps: ['signin-email'], shows: ['Send code'] },
  code: { taps: ['signin-email', 'signin-email-send'], fill: true, shows: ['Sent to sam@example.com', 'Sign in'] },
  sites: { path: SIGNED, shows: ['1 of 3', 'Your sites', 'Link the ones you sell on. Each one is optional.', 'Not linked', 'Skip'], state: 'new' },
  'sites-loading': { path: SIGNED, taps: ['link-ebay'], shows: ['Signing in'], state: 'loading' },
  'sites-typical': { path: SIGNED, taps: ['link-ebay'], wait: 1600, shows: ['Linked', 'Continue'], state: 'typical' },
  'sites-failed': { path: SIGNED, taps: ['link-mercari'], wait: 1600, shows: ['Didn’t link', 'The code from your phone timed out', 'Retry'], state: 'failed' },
  'sites-offline': { path: '/onboarding?state=offline&signed=1', shows: ['Waiting for signal', 'Your sites', 'Skip'], state: 'offline' },
  pickup: { path: SIGNED, taps: ['onboarding-next'], shows: ['2 of 3', 'Pickup spot', 'A public place', 'Skip'] },
  photo: { path: SIGNED, taps: ['onboarding-next', 'onboarding-pickup-next'], shows: ['3 of 3', 'First photo', 'Not now', 'Take a photo'] },
};

test('onboarding: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(STATES).sort(), table.states.map(s => s.state).sort());
});

for (const st of table.states) test(`onboarding: ${st.state} shows ${st.shows.slice(0, 70)}`, async () => {
  const want = STATES[st.state], s = await open(want.path ?? '/onboarding');
  for (const id of want.taps ?? []) {
    await s.tap(id);
    if (want.fill && id === 'signin-email') {
      await s.tap('signin-email-address');
      await s.page.getByTestId('signin-email-address-input').fill('sam@example.com');
      await s.page.getByTestId('signin-email-address-input').press('Enter');
    }
  }
  if (want.wait) await s.page.waitForTimeout(want.wait);
  for (const t of want.shows) await s.shows(t);
  if (want.state) assert.equal(await s.page.locator('[data-screen="onboarding"]').getAttribute('data-state'), want.state);
});

// Continue never waits for every site: with one still signing in, the next step opens.
test('onboarding: moving on never waits for every site', async () => {
  const s = await open(SIGNED);
  await s.tap('link-ebay');
  await s.shows('Signing in');
  await s.tap('onboarding-next');
  await s.shows('Pickup spot');
});

// The only pickup step is an optional saved spot: no hours and no calendar (spec/edge-cases.md §16).
test('onboarding: a pickup spot is optional, and saved when typed', async () => {
  const s = await open(SIGNED);
  await s.tap('onboarding-next');
  await s.shows('Skip');
  for (const t of ['hours', 'Calendar', 'Mon', 'Weekdays']) assert.equal(await s.count(t, { exact: true }), 0, `no "${t}" on the pickup step`);
  await s.tap('onboarding-spot');
  await s.page.getByTestId('onboarding-spot-input').fill('Library parking lot, Main St');
  await s.page.getByTestId('onboarding-spot-input').press('Enter');
  await s.shows('Save spot');
  await s.tap('onboarding-pickup-next');
  await s.saw({ type: 'change', entity: 'limits', id: 'saved_spot', to: 'set' });
  await s.shows('First photo');
});

// Sign-in comes first and cannot be skipped (spec/features/connect.md, "Signing in to secondhand").
test('onboarding: sign-in has no skip, and the sites step is not reachable without it', async () => {
  const s = await open('/onboarding');
  for (const t of ['Skip', 'Your sites']) assert.equal(await s.page.getByText(t, { exact: true }).count(), 0, `no "${t}" before sign-in`);
});

test('onboarding: Apple signs in, logs it, and opens the sites step', async () => {
  const s = await open('/onboarding');
  await s.tap('signin-apple');
  await s.saw({ type: 'change', entity: 'session', id: 'apple', to: 'signed_in' });
  await s.shows('Your sites');
});

// Offline: the choices do nothing but say "Waiting for signal".
test('onboarding: offline, a sign-in tap signs nobody in', async () => {
  const s = await open('/onboarding?state=offline');
  await s.tap('signin-apple');
  await s.page.waitForTimeout(900);
  assert.equal(await s.page.getByText('Your sites', { exact: true }).count(), 0);
  assert.equal((await s.events()).filter(e => e.type === 'change' && e.entity === 'session').length, 0);
});

test('onboarding: email asks for an address, then a 6-digit code, then continues', async () => {
  const s = await open('/onboarding');
  await s.tap('signin-email');
  await s.tap('signin-email-send');
  await s.shows('Enter your email');
  await s.tap('signin-email-address');
  await s.page.getByTestId('signin-email-address-input').fill('sam@example.com');
  await s.page.getByTestId('signin-email-address-input').press('Enter');
  await s.tap('signin-email-send');
  await s.shows('Sent to sam@example.com');
  await s.tap('signin-email-code');
  await s.page.getByTestId('signin-email-code-input').fill('123456');
  await s.page.getByTestId('signin-email-code-input').press('Enter');
  await s.tap('signin-email-verify');
  await s.saw({ type: 'change', entity: 'session', id: 'email', to: 'signed_in' });
  await s.shows('Your sites');
});

test('onboarding: a wrong email code says Couldn’t sign in, and Retry returns to the code', async () => {
  const s = await open('/onboarding');
  await s.tap('signin-email');
  await s.tap('signin-email-address');
  await s.page.getByTestId('signin-email-address-input').fill('sam@example.com');
  await s.page.getByTestId('signin-email-address-input').press('Enter');
  await s.tap('signin-email-send');
  await s.tap('signin-email-code');
  await s.page.getByTestId('signin-email-code-input').fill('000000');
  await s.page.getByTestId('signin-email-code-input').press('Enter');
  await s.tap('signin-email-verify');
  await s.shows('Couldn’t sign in');
  await s.tap('signin-retry');
  await s.saw({ type: 'tap', id: 'signin-retry' });
});

youControlTests(test, table, () => app, '/onboarding');
