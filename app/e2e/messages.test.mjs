// The behavior of messages/index (app/behavior/messages/index.json), on the web build: every state, no unlisted tap, every control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start } from './behavior.mjs';
import { pageTests, reach } from './steps.mjs';

const table = behavior('messages/index');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

pageTests(test, table, () => app);

// Offline (ways-out, Everywhere): the last copy stays readable, and nothing on the list can send.
test('messages: offline, the list stays and nothing on it sends', async () => {
  const s = await reach(app, table, { route: '/messages?state=offline' });
  await s.shows('Waiting for signal');
  await s.page.getByTestId('thread-cv_pd').waitFor({ state: 'visible' });
  for (const id of ['queue-send', 'queue-send-all']) assert.equal(await s.page.getByTestId(id).count(), 0, id);
});

// Ben, 09:56: "messages should just list the messages". The list holds rows and no buttons; a draft is answered in its conversation.
test('messages: the page is the list: one row per conversation, and no button but Back', async () => {
  const s = await reach(app, table);
  await s.page.getByTestId('thread-cv_pd').waitFor({ state: 'visible' });
  assert.equal(await s.page.locator('[data-part="thread-row"]').count(), 5);
  assert.equal(await s.page.locator('[data-part="button"],[data-part="pill-card"]').count(), 0, 'no buttons on the list');
  assert.equal(await s.page.getByText('Send all').count(), 0);
});

// Each row: who, the thing's short name, their last words, the time; a reply waiting is one quiet word.
test('messages: a row says who, the thing, the last words and Draft ready', async () => {
  const s = await reach(app, table);
  const row = s.page.getByTestId('thread-cv_pd');
  await row.waitFor({ state: 'visible' });
  const text = await row.innerText();
  for (const want of ['canvasfan', 'Carhartt canvas work pants', 'Is the inseam really 36 or more like 34?', 'Draft ready', '9h ago']) assert.ok(text.includes(want), `row lacks "${want}": ${text}`);
  assert.ok(!text.includes('faded black'), 'the row shows the short name, not the listing title');
});

// The draft moved off the list; it waits in its conversation with the three ways to answer it (ways-out §6.3).
test('messages: the draft is answered in its conversation, with Send, Edit and Take over', async () => {
  const s = await reach(app, table);
  await s.tap('thread-cv_pd');
  await s.page.waitForURL(u => new URL(u).pathname === '/messages/cv_pd');
  for (const id of ['draft-send', 'draft-edit', 'draft-take']) await s.page.getByTestId(id).waitFor({ state: 'visible' });
});

test('messages: ?item= shows one thing’s conversations', async () => {
  const s = await reach(app, table, { route: '/messages?item=it_jacket' });
  await s.page.getByTestId('thread-cv_jd').waitFor({ state: 'visible' });
  assert.equal(await s.page.getByTestId('thread-cv_cf').count(), 0);
});

test('messages: the possible scam is flagged on its row', async () => {
  const s = await reach(app, table);
  const row = s.page.getByTestId('thread-cv_lf');
  await row.waitFor({ state: 'visible' });
  assert.ok((await row.innerText()).includes('Possible scam'));
});
