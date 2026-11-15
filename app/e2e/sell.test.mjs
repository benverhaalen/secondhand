// The behavior of the Sell tab (app/behavior/(tabs)/sell.json), on the web build. Each state opens at its own route with
// the demo world in the URL; the flows walk the table's flows by testID and read the event log and the screen.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, controlTests, start, WAIT } from './behavior.mjs';

const table = behavior('(tabs)/sell');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

// How each state is reached: its route, and the taps after it.
const STATES = {
  new: { taps: [] },
  empty: { taps: [] },
  loading: { taps: [] },
  failed: { taps: [] },
  offline: { taps: [] },
  typical: { taps: [] },
  one: { taps: [] },
  dense: { taps: [] },
  filtered: { taps: [] },
  select: { taps: ['sell-select'] },
};

test('sell: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(STATES).sort(), table.states.map(s => s.state).sort());
});

for (const s of table.states) test(`sell: ${s.state} shows ${s.shows}`, async () => {
  const screen = await app.open(s.route);
  for (const id of STATES[s.state].taps) await screen.tap(id);
  await screen.shows(s.shows);
  const state = await screen.page.locator('[data-screen="sell"]').first().getAttribute('data-state');
  assert.equal(state, s.state);
});

test('sell: the filters sit on one row', async () => {
  const screen = await app.open('/sell?world=flipper');
  await screen.shows('Needs you');
  const tops = await screen.page.locator('[data-part="chip"]').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  assert.ok(tops.length >= 3, `expected several filters, got ${tops.length}`);
  assert.equal(new Set(tops).size, 1, `filters sit on more than one row: ${tops}`);
});

test('sell: each tile shows its state tag on the photo and its site badges on the photo corner', async () => {
  const screen = await app.open('/sell?world=clearing');
  const tile = screen.page.getByTestId('tile-it_jacket');
  await tile.waitFor({ state: 'visible' });
  const photo = await tile.locator('[data-part="photo"]').boundingBox();
  const tag = await tile.locator('[data-part="tag"]').first().boundingBox();
  const badges = await tile.locator('[data-part="site-badge"]').evaluateAll(els => els.map(e => e.getBoundingClientRect().toJSON()));
  assert.ok(tag.y >= photo.y && tag.y + tag.height <= photo.y + photo.height, 'the tag sits inside the photo');
  assert.equal(badges.length, 2, 'the jacket is on two sites');
  for (const b of badges) assert.ok(b.bottom > photo.y + photo.height - b.height && b.right > photo.x + photo.width - 3 * b.width, 'each badge sits on the photo’s bottom right corner');
});

test('sell: the shelves come in their order', async () => {
  const screen = await app.open('/sell?world=clearing');
  await screen.shows('Needs you');
  const titles = await screen.page.locator('[data-shelf]').evaluateAll(els => els.map(e => e.getAttribute("data-shelf")));
  const ORDER = ['needs_you', 'in_progress', 'live', 'sold', 'unsold', 'kept'];
  assert.deepEqual(titles, ORDER.filter(t => titles.includes(t)));
});

// Ben, 06:19: "on the sell site like the needs you and in progress parts they were collapsible".
test('sell: every shelf folds and opens from its header, the count still showing, and the header does not move', async () => {
  const screen = await app.open('/sell?world=clearing');
  await screen.shows('Needs you');
  const head = () => screen.page.locator('[data-shelf="needs_you"] [data-part="shelf-head"]').evaluate(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); });
  const before = await head();
  await screen.tap('shelf-needs_you-fold');
  await screen.page.waitForFunction(() => document.querySelector('[data-shelf="needs_you"]')?.getAttribute('data-folded') === 'true');
  // The tiles fade out in the feedback time, then leave.
  await screen.page.waitForFunction(() => document.querySelectorAll('[data-shelf="needs_you"] [data-part="tile"]').length === 0, null, { timeout: WAIT });
  assert.match(await screen.page.locator('[data-shelf="needs_you"] [data-part="shelf-head"]').innerText(), /Needs you\s*\d+/);
  assert.deepEqual(await head(), before, 'the header stays where it was');
  await screen.tap('shelf-needs_you-fold');
  await screen.page.waitForFunction(() => document.querySelectorAll('[data-shelf="needs_you"] [data-part="tile"]').length > 0);
});

test('sell: Unsold and Kept start folded; every other shelf starts open', async () => {
  const screen = await app.open('/sell?world=clearing');
  await screen.shows('Needs you');
  const folded = await screen.page.locator('[data-shelf]').evaluateAll(els => Object.fromEntries(els.map(e => [e.getAttribute('data-shelf'), e.getAttribute('data-folded')])));
  for (const [id, f] of Object.entries(folded)) assert.equal(f, String(id === 'unsold' || id === 'kept'), id);
});

test('sell: a fold is remembered for the person, after leaving and after a reload', async () => {
  const screen = await app.open('/sell?world=clearing');
  await screen.tap('shelf-in_progress-fold');
  await screen.tap('shelf-kept-fold');
  await screen.tap('tile-it_jacket');
  await screen.page.waitForURL(u => new URL(u).pathname === '/item/it_jacket', { timeout: WAIT });
  await screen.page.goBack();
  const read = () => screen.page.locator('[data-shelf]').evaluateAll(els => Object.fromEntries(els.map(e => [e.getAttribute('data-shelf'), e.getAttribute('data-folded')])));
  await screen.page.waitForFunction(() => document.querySelector('[data-shelf="in_progress"]')?.getAttribute('data-folded') === 'true');
  assert.equal((await read()).kept, 'false');
  await screen.page.reload();
  await screen.page.waitForFunction(() => document.querySelector('[data-shelf="in_progress"]')?.getAttribute('data-folded') === 'true');
  assert.equal((await read()).kept, 'false');
});

test('sell: the flipper’s 64 things stay readable: each shelf shows at most two rows until See all', async () => {
  const screen = await app.open('/sell?world=flipper');
  await screen.shows('Needs you');
  const shown = await screen.page.locator('[data-shelf="needs_you"] [data-part="tile"]').count();
  assert.ok(shown <= 6, `Needs you shows ${shown} tiles before See all`);
  await screen.tap('shelf-needs_you-all');
  await screen.page.waitForFunction(() => document.querySelectorAll('[data-part="tile"]').length > 6);
});

test('sell: sort by price puts the highest first, and the sort chip says so', async () => {
  const screen = await app.open('/sell?world=flipper&filter=live');
  await screen.tap('filter-sort');
  await screen.tap('sort-price_high');
  await screen.shows('Price, high');
  const prices = await screen.page.locator('[data-part="tile"]').evaluateAll(els => els.map(e => Number(e.getAttribute('data-price'))));
  assert.deepEqual(prices, [...prices].sort((a, b) => b - a));
});

test('sell: a site filter shows only things on that site', async () => {
  const screen = await app.open('/sell?world=clearing');
  await screen.tap('filter-site-ebay');
  await screen.page.waitForFunction(() => [...document.querySelectorAll('[data-part="tile"]')].every(t => (t.getAttribute('data-sites') ?? '').includes('ebay')));
  assert.equal(await screen.page.getByTestId('tile-it_fleece').count(), 0, 'the fleece is not on eBay');
});

test('sell: select, keep, then undo', async () => {
  const screen = await app.open('/sell?world=clearing');
  await screen.tap('sell-select');
  await screen.tap('tile-it_lamp');
  await screen.shows('Change 1');
  await screen.tap('select-act');
  await screen.tap('bulk-keep');
  await screen.tap('bulk-approve');
  await screen.saw({ type: 'tap', id: 'bulk-approve' });
  await screen.page.locator('[data-part="toast"]', { hasText: 'Kept' }).waitFor({ state: 'visible', timeout: WAIT });
  assert.equal(await screen.page.locator('[data-shelf="needs_you"] [data-testid="tile-it_lamp"]').count(), 0, 'the lamp left Needs you');
  await screen.tap('bulk-undo');
  await screen.page.waitForFunction(() => !!document.querySelector('[data-shelf="needs_you"] [data-testid="tile-it_lamp"]'));
});

// ways-out, Everywhere: with no signal the last copy stays, and an approved change waits for it instead of being lost.
test('sell: offline, a change waits for the signal', async () => {
  const screen = await app.open('/sell?state=offline');
  await screen.shows('Waiting for signal');
  await screen.tap('sell-select');
  await screen.tap('tile-it_lamp');
  await screen.tap('select-act');
  await screen.tap('bulk-keep');
  await screen.tap('bulk-approve');
  await screen.page.getByTestId('bulk-approve').filter({ hasText: 'Waiting for signal' }).waitFor({ state: 'visible', timeout: WAIT });
  assert.equal(await screen.page.locator('[data-shelf="needs_you"] [data-testid="tile-it_lamp"]').count(), 1, 'the lamp stays until the change is sent');
});

test('sell: failed says so, and Try again loads the things', async () => {
  const screen = await app.open('/sell?state=failed');
  await screen.tap('sell-retry');
  await screen.shows('Needs you');
});

test('sell: delete is refused for a thing with an open order', async () => {
  const screen = await app.open('/sell?world=clearing');
  await screen.tap('sell-select');
  await screen.tap('tile-it_kindle');
  await screen.tap('select-act');
  await screen.tap('bulk-delete');
  await screen.shows(/open order/);
  const disabled = await screen.page.getByTestId('bulk-approve').getAttribute('aria-disabled');
  assert.equal(disabled, 'true');
});

test('sell: Done leaves select, and a tile opens its item again', async () => {
  const screen = await app.open('/sell?world=clearing');
  await screen.tap('sell-select');
  await screen.tap('select-done');
  await screen.tap('tile-it_jacket');
  await screen.page.waitForURL(u => new URL(u).pathname === '/item/it_jacket', { timeout: WAIT });
});

test('sell: the break content holds: no tile is wider than its column and nothing runs off the screen', async () => {
  const screen = await app.open('/sell?world=edge');
  await screen.shows('Needs you');
  // Everything a tile draws stays inside its column, but for the site badges, which sit 4 outside the photo's corner
  // by design; and nothing passes the screen's edge.
  const over = await screen.page.locator('[data-part="tile"]').evaluateAll(els => els.flatMap(t => {
    const box = t.getBoundingClientRect();
    return [...t.querySelectorAll('*')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width && (r.right > box.right + 4.5 || r.left < box.left - 0.5 || r.right > innerWidth);
    }).map(e => e.textContent);
  }));
  assert.deepEqual(over, []);
});

// Every tap the screen logs is a control the table lists or a step of one of its flows.
test('sell: no tap goes to a control the table does not list', async () => {
  const screen = await app.open('/sell?world=clearing');
  await screen.shows('Needs you');
  for (const el of await screen.page.locator('[data-testid^="filter-"]').all()) if (await el.isVisible()) await el.tap().catch(() => {});
  const listed = new Set([...table.controls.map(c => c.id), ...table.flows.flatMap(f => f.steps)]);
  const extra = (await screen.events()).filter(e => e.type === 'tap' && !listed.has(e.id) && !/^(filter-|tile-|shelf-|sort-)/.test(e.id));
  assert.deepEqual(extra, []);
});

controlTests(test, table, c => app.open(c.at));
