// The behavior of New, the ＋ (app/behavior/new.json), on the web build. Written from the table before the behavior.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, controlTests, start, WAIT } from './behavior.mjs';

const table = behavior('new');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

// How each state is reached: the route, and what must be on screen.
const STATES = {
  typical: { route: '/new', shows: ['Appraise an item', 'Sell an item', 'Track an item', 'Find an item'] },
  sell: { route: '/new?sheet=sell', shows: ['Sell an item', 'Your price', 'Make a draft'] },
  worth: { route: '/new?sheet=worth', shows: ['Appraise an item', 'See what it’s worth'] },
  track: { route: '/new?sheet=track', shows: ['Track an item', 'Watch for it'] },
  find: { route: '/new?sheet=find', shows: ['Find an item', 'See what it is'] },
  ask: { route: `/new?sheet=sell&what=${encodeURIComponent('carhart detroit jacket')}&price=500&ask=1`, shows: ['Similar ones sold for $85 to $115. List at $500?', 'List at $500'] },
};
const JACKET = encodeURIComponent('carhart detroit jacket');

test('new: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(STATES).sort(), table.states.map(s => s.state).sort());
});

for (const [name, { route, shows }] of Object.entries(STATES)) test(`new: ${name} shows ${table.state(name).shows}`, async () => {
  const s = await app.open(route);
  for (const t of shows) await s.shows(t);
  await s.page.close();
});

test('new: before any is used, the four stand in Ben’s order, the first nearest the ×', async () => {
  const s = await app.open('/new');
  await s.shows('Sell an item');
  const ys = await Promise.all(['new-worth', 'new-sell', 'new-track', 'new-find'].map(id => s.page.getByTestId(id).boundingBox().then(b => b.y)));
  assert.ok(ys[0] > ys[1] && ys[1] > ys[2] && ys[2] > ys[3], `Appraise sits lowest, nearest the ×, then Sell, Track, Find: ${ys}`);
  await s.page.close();
});

test('new: the jobs stand centered on the screen, between its top and the ×', async () => {
  const s = await app.open('/new');
  await s.shows('Sell an item');
  // Measured once the circle has grown and the jobs have risen (newOpen, then the stagger).
  await s.page.waitForTimeout(1000);
  const [top, low, close] = await Promise.all(['new-find', 'new-worth', 'new-close'].map(id => s.page.getByTestId(id).boundingBox()));
  const middle = (top.y + low.y + low.height) / 2, room = close.y / 2;
  assert.ok(Math.abs(middle - room) < 40, `the column's middle ${middle} sits near the middle of the room above the × ${room}`);
  const vw = s.page.viewportSize().width, left = low.x, right = vw - (low.x + low.width);
  assert.ok(Math.abs(left - right) < 2, `the column is centered across: ${left} left, ${right} right`);
  await s.page.close();
});

test('new: the circle is the brand field, over the whole screen, and never the tab wash', async () => {
  const s = await app.open('/new');
  await s.shows('Sell an item');
  assert.equal(await s.page.locator('[data-part="wash"]').count(), 0, 'no tab wash on New (U8)');
  const ground = await s.page.locator('[data-part="circle-stage"]').first().getAttribute('data-ground');
  assert.equal(ground, 'field');
  await s.page.close();
});

test('new: the four jobs carry no pencil; words come in through Buy’s search or a shared link (Ben, 11:29)', async () => {
  const s = await app.open('/new');
  await s.shows('Sell an item');
  assert.equal(await s.page.locator('[data-part="choice-type"]').count(), 0);
  assert.equal(await s.page.locator('[data-part="choice"]').count(), 4);
  await s.page.close();
});

test('new: each choice opens the camera in its own mode', async () => {
  for (const mode of ['sell', 'worth', 'track', 'find']) {
    const s = await app.open('/new');
    await s.tap(`new-${mode}`);
    await s.page.waitForURL(u => new URL(u).pathname === '/camera' && new URL(u).searchParams.get('mode') === mode, { timeout: WAIT });
    await s.page.close();
  }
});

test('new: a link shared in from outside opens Sell it with the link pasted, and brings the listing in', async () => {
  const s = await app.open('/new?link=https%3A%2F%2Fexample.invalid%2Flisting%2F42');
  await s.shows('https://example.invalid/listing/42');
  await s.shows('Bring it in');
  await s.page.close();
});

test('new: misspelled words show the product they name, spelled right, in every job', async () => {
  for (const mode of ['sell', 'worth', 'track', 'find']) {
    const s = await app.open(`/new?sheet=${mode}&what=${JACKET}`);
    await s.shows('Carhartt Detroit Jacket J97');
    await s.page.close();
  }
});

test('new: words in What’s it worth open the value page for the product they name', async () => {
  const s = await app.open(`/new?sheet=worth&what=${JACKET}`);
  await s.tap('worth-go');
  await s.page.waitForURL(u => new URL(u).pathname === '/worth' && new URL(u).searchParams.get('product') === 'pr_j97', { timeout: WAIT });
  await s.page.close();
});

test('new: words in Find an item open what the thing is, the product they name', async () => {
  const s = await app.open(`/new?sheet=find&what=${JACKET}`);
  await s.tap('find-go');
  await s.page.waitForURL(u => new URL(u).pathname === '/product/pr_j97', { timeout: WAIT });
  await s.page.close();
});

test('new: words in Track an item open a new want for the product they name, spelled right', async () => {
  const s = await app.open(`/new?sheet=track&what=${JACKET}`);
  await s.tap('track-go');
  await s.page.waitForURL(u => new URL(u).pathname === '/want' && /Carhartt Detroit Jacket/.test(new URL(u).searchParams.get('q') ?? ''), { timeout: WAIT });
  await s.page.close();
});

test('new: a price far outside the sold range asks once with the range, and the next tap makes the draft', async () => {
  const s = await app.open(`/new?sheet=sell&what=${JACKET}&price=500`);
  await s.shows('Make a draft');
  await s.tap('sell-go');
  await s.shows('Similar ones sold for $85 to $115. List at $500?');
  assert.equal(s.path(), '/new', 'the first tap only asks');
  await s.tap('sell-go');
  await s.page.waitForURL(u => new URL(u).pathname === '/item/it_draft', { timeout: WAIT });
  await s.page.close();
});

test('new: a price inside the sold range asks nothing', async () => {
  const s = await app.open(`/new?sheet=sell&what=${JACKET}&price=98`);
  await s.tap('sell-go');
  await s.page.waitForURL(u => new URL(u).pathname === '/item/it_draft', { timeout: WAIT });
  await s.page.close();
});

// Every tap the screen logs is a control the table lists, so nothing on screen does something nobody wrote down.
test('new: no tap goes to a control the table does not list', async () => {
  const s = await app.open('/new');
  await s.shows('Sell an item');
  const listed = new Set(table.controls.map(c => c.id));
  const ids = await s.page.locator('[data-testid]').evaluateAll(els => els.filter(e => e.offsetParent !== null).map(e => e.dataset.testid));
  assert.deepEqual(ids.filter(id => !listed.has(id) && !/-input$/.test(id)), []);
  await s.page.close();
});

controlTests(test, table, c => app.open(c.sheet ? `/new?sheet=${c.sheet}&what=A%20blue%20sofa` : '/new'));

// The ＋ turns into × in place: New's close button has the tab bar's New button's frame, to the point, so nothing jumps when
// New opens (the phone capture, 2026-11-15 11:09: it was 56 at y 801 over a 48 at 798, and ran into the home bar).
test('new: the close button lands exactly on the + it replaces', async () => {
  const s = await app.open('/');
  const frame = id => s.page.getByTestId(id).evaluate(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); });
  await s.page.getByTestId('tab-new').waitFor();
  const plus = await frame('tab-new');
  await s.tap('tab-new'); await s.page.getByTestId('new-close').waitFor({ timeout: WAIT });
  await s.page.waitForTimeout(400);
  assert.deepEqual(await frame('new-close'), plus);
});
