// The behavior of messages/[id] (app/behavior/messages/[id].json), on the web build: every state, no unlisted tap, every control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start } from './behavior.mjs';
import { pageTests, reach } from './steps.mjs';

const table = behavior('messages/[id]');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

pageTests(test, table, () => app);

// What the thread promises beyond its controls (spec/ways-out.md §6.3, spec/features/assist.md).
test('message: Take over puts the draft away and says offers still follow the Plan', async () => {
  const s = await reach(app, table, { route: '/messages/cv_pd', after: ['draft-take'] });
  await s.shows('Offers still follow your Plan');
  assert.equal(await s.countId('draft-send'), 0);
  await s.page.getByTestId('composer-input').waitFor({ state: 'visible' });
});

// ways-out §6.3: each message says who wrote it, and a draft sent with a tap says so.
test('message: a sent draft says it was drafted and sent by you, and shows its facts before', async () => {
  const s = await reach(app, table, { route: '/messages/cv_pd' });
  await s.shows('from your tape');
  await s.tap('draft-send');
  await s.shows('Drafted and sent by you, now');
});

test('message: what the agent sent says Sent for you', async () => {
  const s = await reach(app, table);
  await s.shows(/^Sent for you, /);
});

test('message: guessed words are the agent’s until the person changes them', async () => {
  const s = await reach(app, table, { route: '/messages/cv_pd' });
  await s.shows('Draft to canvasfan');
  assert.ok(await s.page.locator('[data-mark="agent"]').count() > 0);
  assert.equal(await s.page.locator('[data-mark="person"]').count(), 0);
  await s.tap('draft-edit');
  const input = s.page.getByTestId('draft-input');
  await input.fill((await input.inputValue()).replace('35 inches', '34 inches'));
  await s.tap('draft-done');
  assert.ok(await s.page.locator('[data-mark="person"]').count() > 0);
});

test('message: Correct it drafts a fix to send instead of sending one', async () => {
  const s = await reach(app, table, { after: ['why-msg_jd2', 'why-correct'] });
  await s.page.getByTestId('draft-input').waitFor({ state: 'visible' });
  assert.equal(await s.count('Now', { exact: true }), 0);
});

test('message: a possible scam says why, and Block takes it out of the thread', async () => {
  const s = await reach(app, table, { route: '/messages/cv_lf' });
  await s.shows('Possible scam');
  await s.tap('thread-block');
  await s.shows('You blocked Alex');
});
