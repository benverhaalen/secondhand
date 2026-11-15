// The shop takeover (app/behavior/shop.json), on the web build, driven by a stream recorded from the dev server
// (app/src/buy/fixtures/search-live-levi.json). The first read of the job's events ends after frame 9, as a dropped
// connection would; the client reconnects with Last-Event-ID 9 and gets the rest 1.5 s later, so the building state can be read.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { start, WAIT } from './behavior.mjs';

const fixture = JSON.parse(readFileSync(new URL('../src/buy/fixtures/search-live-levi.json', import.meta.url), 'utf8'));
const sse = frames => frames.map(f => `id: ${f.id}\nevent: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`).join('');
const events = `/v1/jobs/${fixture.start.id}/events`;

function stream() {
  const seen = [];
  return {
    seen,
    async answer(route) {
      const after = Number(route.request().headers()['last-event-id']) || 0;
      seen.push(after);
      if (after < 9) return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(fixture.frames.filter(f => f.id > after && f.id <= 9)) });
      await new Promise(r => setTimeout(r, 1500));
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(fixture.frames.filter(f => f.id > after)) });
    },
  };
}
const state = (v, s) => v.page.locator(`[data-screen="shop"][data-state="${s}"]`).first().waitFor({ timeout: WAIT });

let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

const bubbles = (v, state) => v.page.locator(`[data-part="source-bubble"][data-state="${state}"]`).count();

test('shop: each source floats in as its logo while asked, unconnected ones are not shown, then what the listings say and the bar at the bottom', async () => {
  const s = stream();
  const v = await app.open('/shop?q=levi%20501', { api: { '/v1/search': fixture.start, [events]: r => s.answer(r) } });
  await state(v, 'building');
  await v.shows('levi 501');
  // Building: the four no_route sources have landed and are not shown (Nate: "if not connected, don't list it");
  // Poshmark and Dupe float in, faded, while they are still asked.
  await v.page.getByTestId('float-poshmark').first().waitFor({ timeout: WAIT });
  await v.page.waitForFunction(() => document.querySelectorAll('[data-part="source-bubble"][data-state="asking"]').length === 2, null, { timeout: WAIT });
  for (const id of ['depop', 'mercari', 'facebook', 'ebay']) assert.equal(await v.countId(`float-${id}`), 0, `${id} is not connected, so not shown`);
  // Chat: the reconnect carried on after frame 9; each logo carries the count it kept; the listings' read leads.
  await state(v, 'chat');
  assert.equal(await bubbles(v, 'landed'), 2);
  await v.shows('47');
  await v.shows('22');
  await v.shows(/^From \d+ listings for sale now, read in 1\.5\s?s$/);
  await v.shows(/^Most ask /);
  assert.deepEqual(s.seen, [0, 9], 'one read, then one reconnect after frame 9');
  const bar = await v.page.getByTestId('shop-bar-input').boundingBox();
  assert.ok(bar && bar.y > 844 / 2, `the bar dropped to the bottom (y ${bar?.y})`);
});

test('shop: closing keeps the chat on this device without a Dupe row, and it opens again from the list', async () => {
  const v = await app.open('/shop?q=levi%20501', { api: { '/v1/search': fixture.start, [events]: r => r.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(fixture.frames) }) } });
  await state(v, 'chat');
  await v.tap('shop-close');
  const kept = await v.page.evaluate(() => JSON.parse(localStorage.getItem('secondhand.shop.chats.v1') ?? '[]'));
  assert.equal(kept.length, 1);
  assert.equal(kept[0].title, 'levi 501');
  assert.equal(kept[0].turns.flatMap(t => t.kind === 'search' ? t.reach.results : []).filter(r => r.site === 'dupe').length, 0);
  await v.page.goto(new URL('/shop', v.page.url()).href);
  await v.tap(`shop-chat-${kept[0].id}`);
  await v.shows(/^Most ask /);
});

test('shop: a search that cannot start says so, with Try again', async () => {
  const v = await app.open('/shop?q=levi%20501', { api: { '/v1/search': 'fail' } });
  await state(v, 'failed');
  await v.shows('Couldn’t search');
  await v.shows('Try again');
});
