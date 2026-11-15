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

// Offline (ways-out, Everywhere): the last copy stays readable, and nothing can be sent until the signal returns.
test('messages: offline, a reply cannot be sent and Send all is hidden', async () => {
  const s = await reach(app, table, { route: '/messages?state=offline' });
  await s.shows('Waiting for signal');
  assert.equal(await s.page.getByTestId('queue-send-all').count(), 0);
  assert.equal(await s.page.getByTestId('queue-send').getAttribute('aria-disabled'), 'true');
});

// ways-out §6.3, "Let me approve replies fast": the queue of drafted replies, each sent only by a tap.
test('messages: opens on the replies to send, and Send moves to the next one', async () => {
  const s = await reach(app, table);
  await s.shows('2 replies to send');
  await s.shows('Is the inseam really 36 or more like 34?');
  await s.shows('from the label');
  await s.tap('queue-send');
  await s.shows('1 reply to send');
  await s.shows('Sent 1 reply');
});

test('messages: Send all sends only replies whose facts are all confirmed', async () => {
  const s = await reach(app, table);
  await s.tap('queue-send-all');
  await s.shows('Replies sent');
  await s.shows('Sent 2 replies');
});

test('messages: showing one item hides the others', async () => {
  const s = await reach(app, table, { after: ['messages-filter', 'filter-it_jacket'] });
  await s.page.getByTestId('thread-cv_jd').waitFor({ state: 'visible' });
  assert.equal(await s.page.getByTestId('thread-cv_cf').count(), 0);
});

test('messages: the possible scam is flagged on its row', async () => {
  const s = await reach(app, table);
  await s.shows('Possible scam');
});
