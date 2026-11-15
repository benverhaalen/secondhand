// The behavior of New, the ＋ (app/behavior/new.json), on the web build. Written from the table before the behavior.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, controlTests, start } from './behavior.mjs';

const table = behavior('new');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

// How each state is reached: the route, and what must be on screen.
const STATES = {
  typical: { route: '/new', shows: ['Sell this', 'What’s it worth', 'Find this', 'Paste a link', 'Describe it'] },
  link: { route: '/new?sheet=link', shows: ['Paste a link', 'Bring it in'] },
  describe: { route: '/new?sheet=describe', shows: ['Describe it', 'Your price', 'Make a draft'] },
  ask: { route: `/new?sheet=describe&what=${encodeURIComponent('carhart detroit jacket')}&price=500&ask=1`, shows: ['Similar ones sold for $85 to $115. List at $500?', 'List at $500'] },
};

test('new: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(STATES).sort(), table.states.map(s => s.state).sort());
});

for (const [name, { route, shows }] of Object.entries(STATES)) test(`new: ${name} shows ${table.state(name).shows}`, async () => {
  const s = await app.open(route);
  for (const t of shows) await s.shows(t);
  await s.page.close();
});

test('new: the last choice used comes first, nearest the ×', async () => {
  const s = await app.open('/new');
  await s.shows('Sell this');
  const ys = await Promise.all(['new-sell', 'new-worth', 'new-find'].map(id => s.page.getByTestId(id).boundingBox().then(b => b.y)));
  assert.ok(ys[0] > ys[1] && ys[1] > ys[2], `Sell this sits lowest, nearest the ×: ${ys}`);
  await s.page.close();
});

test('new: each choice opens the camera in its own mode', async () => {
  for (const mode of ['sell', 'worth', 'find']) {
    const s = await app.open('/new');
    await s.tap(`new-${mode}`);
    await s.page.waitForURL(u => new URL(u).pathname === '/camera' && new URL(u).searchParams.get('mode') === mode, { timeout: 3000 });
    await s.page.close();
  }
});

test('new: a link shared in from outside is already pasted', async () => {
  const s = await app.open('/new?sheet=link&link=https%3A%2F%2Fexample.invalid%2Flisting%2F42');
  await s.shows('https://example.invalid/listing/42');
  await s.page.close();
});

test('new: a misspelled description shows the product it names, spelled right', async () => {
  const s = await app.open(`/new?sheet=describe&what=${encodeURIComponent('carhart detroit jacket')}`);
  await s.shows('Carhartt Detroit Jacket J97');
  await s.page.close();
});

test('new: a price far outside the sold range asks once with the range, and the next tap makes the draft', async () => {
  const s = await app.open(`/new?sheet=describe&what=${encodeURIComponent('carhart detroit jacket')}&price=500`);
  await s.shows('Make a draft');
  await s.tap('describe-go');
  await s.shows('Similar ones sold for $85 to $115. List at $500?');
  assert.equal(s.path(), '/new', 'the first tap only asks');
  await s.tap('describe-go');
  await s.page.waitForURL(u => new URL(u).pathname === '/sell', { timeout: 3000 });
  await s.page.close();
});

test('new: a price inside the sold range asks nothing', async () => {
  const s = await app.open(`/new?sheet=describe&what=${encodeURIComponent('carhart detroit jacket')}&price=98`);
  await s.tap('describe-go');
  await s.page.waitForURL(u => new URL(u).pathname === '/sell', { timeout: 3000 });
  await s.page.close();
});

// Every tap the screen logs is a control the table lists, so nothing on screen does something nobody wrote down.
test('new: no tap goes to a control the table does not list', async () => {
  const s = await app.open('/new');
  await s.shows('Sell this');
  const listed = new Set(table.controls.map(c => c.id));
  const ids = await s.page.locator('[data-testid]').evaluateAll(els => els.filter(e => e.offsetParent !== null).map(e => e.dataset.testid));
  assert.deepEqual(ids.filter(id => !listed.has(id) && !/-input$/.test(id)), []);
  await s.page.close();
});

controlTests(test, table, c => app.open(c.sheet ? `/new?sheet=${c.sheet}&link=https%3A%2F%2Fexample.invalid%2Fl%2F1&what=A%20blue%20sofa` : '/new'));
