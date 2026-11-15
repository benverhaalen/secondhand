// The behavior of the camera (app/behavior/camera.json), on the web build, where a photo stands in for the feed.
// Written from the table before the behavior. The screen pushes { type: 'show' }, { type: 'found' }, { type: 'stage' } and
// { type: 'haptic' } to globalThis.__events, so the tests read what happened, not pixels.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, controlTests, start } from './behavior.mjs';

const table = behavior('camera');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

const STATES = {
  typical: { route: '/camera?world=new', shows: ['Show the whole front', 'Brand', 'Size', 'Sell', 'Worth', 'Find'] },
  loading: { route: '/camera?world=new&state=loading', shows: ['Show the whole front'] },
  found: { route: '/camera?world=new&state=found', shows: ['Carhartt'] },
  same: { route: '/camera?world=clearing&state=same', shows: ['Same thing?', 'Same one', 'Another one'] },
  offline: { route: '/camera?world=new&state=offline', shows: [/waiting for signal/i] },
  done: { route: '/camera?world=new&state=done', shows: ['Matching against 41 sold jackets', 'Clean up', 'Enhance with AI', 'Review the draft'] },
  denied: { route: '/camera?state=denied', shows: ['Camera is off', 'Open Settings', 'Choose photos'] },
  unsure: { route: '/camera?world=clearing&state=unsure', shows: ['Which one is it?', 'Banker’s lamp', 'Desk lamp', 'I don’t know'] },
  valuable: { route: '/camera?world=clearing&state=valuable', shows: ['It may be worth more', 'Appraise first', 'Price it anyway'] },
};
const LAMP = new Set(['same', 'unsure', 'valuable']);

test('camera: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(STATES).sort(), table.states.map(s => s.state).sort());
});

for (const [name, { route, shows }] of Object.entries(STATES)) test(`camera: ${name} shows ${table.state(name).shows}`, async () => {
  const s = await app.open(route);
  for (const t of shows) await s.shows(t);
  await s.page.close();
});

test('camera: a still is judged, the found pop-up says what it read, a light haptic fires, and the stage fills', async () => {
  const s = await app.open('/camera?world=new');
  await s.shows('Show the whole front');
  await s.tap('cam-shutter');
  const found = await s.saw({ type: 'found', text: 'Carhartt' }, { timeout: 4000 });
  assert.equal(found.stage, 'Kind');
  await s.shows('Carhartt');
  await s.saw({ type: 'haptic', kind: 'light' });
  await s.saw({ type: 'stage', stage: 'Kind', done: true }, { timeout: 4000 });
  await s.shows('Turn it over', { timeout: 4000 });
  await s.page.close();
});

test('camera: all five stages end in a success haptic and the real comparison', async () => {
  const s = await app.open('/camera?world=new');
  for (const ask of ['Show the whole front', 'Turn it over', 'Closer on the tag', 'Smooth it flat', 'Closer on any wear']) {
    await s.shows(ask, { timeout: 5000 });
    await s.tap('cam-shutter');
  }
  await s.saw({ type: 'haptic', kind: 'success' }, { timeout: 6000 });
  await s.shows('Matching against 41 sold jackets', { timeout: 3000 });
  const stages = (await s.events()).filter(e => e.type === 'stage' && e.done).map(e => e.stage);
  assert.deepEqual(stages, ['Kind', 'Photos', 'Label', 'Measure', 'Condition']);
  await s.page.close();
});

test('camera: Worth walks only the stages that set a price, and ends at what it is worth', async () => {
  const s = await app.open('/camera?world=new&mode=worth&state=done');
  await s.shows('See what it’s worth');
  await s.tap('cam-done');
  await s.page.waitForURL(u => new URL(u).pathname === '/worth', { timeout: 3000 });
  // The value is of the thing the camera read, the jacket, not another product.
  await s.shows(/Carhartt Detroit Jacket J97/);
  await s.page.close();
});

test('camera: switching mode keeps the stills', async () => {
  const s = await app.open('/camera?world=new');
  await s.tap('cam-shutter');
  await s.saw({ type: 'stage', stage: 'Kind', done: true }, { timeout: 5000 });
  await s.tap('cam-mode-find');
  await s.saw({ type: 'show', screen: 'camera', mode: 'find', stills: 1 });
  await s.page.close();
});

test('camera: a still that matches a held item asks Same thing? before making a second', async () => {
  const s = await app.open('/camera?world=clearing');
  await s.tap('cam-shutter');
  await s.shows('Same thing?', { timeout: 6000 });
  await s.page.close();
});

test('camera: a brand typed with a typo shows on its chip as the catalog spells it', async () => {
  const s = await app.open('/camera?world=new');
  await s.tap('fact-brand');
  await s.page.getByTestId('fact-brand-input').fill('Carhart');
  await s.page.getByTestId('fact-brand-input').press('Enter');
  await s.shows('Carhartt');
  await s.page.close();
});

test('camera: I don’t know is an answer, and a maker’s mark then asks for an appraisal before a price', async () => {
  const s = await app.open('/camera?world=clearing&state=unsure');
  await s.tap('unsure-none');
  await s.shows('It may be worth more');
  await s.tap('valuable-appraise');
  await s.shows('Listed from what can be seen');
  await s.shows('Appraise first: no quick sale');
  await s.page.close();
});

test('camera: Clean up and Enhance with AI are two choices, both off until picked', async () => {
  const s = await app.open('/camera?world=new&state=done');
  const on = id => s.page.locator(`[data-testid="${id}"] [data-part="fix"]`).getAttribute('data-on');
  assert.deepEqual([await on('cam-clean'), await on('cam-ai')], ['false', 'false']);
  await s.tap('cam-clean');
  assert.deepEqual([await on('cam-clean'), await on('cam-ai')], ['true', 'false'], 'Clean up never turns on the AI');
  await s.tap('cam-clean');
  assert.equal(await on('cam-clean'), 'false', 'a second tap goes back to the original');
  await s.page.close();
});

test('camera: no tap goes to a control the table does not list', async () => {
  const s = await app.open('/camera?world=new');
  await s.shows('Show the whole front');
  const listed = new Set(table.controls.map(c => c.id));
  const ids = await s.page.locator('[data-testid]').evaluateAll(els => els.filter(e => e.offsetParent !== null).map(e => e.dataset.testid));
  assert.deepEqual(ids.filter(id => !listed.has(id) && !/^fact-/.test(id) && !/-input$/.test(id)), []);
  await s.page.close();
});

controlTests(test, table, c => app.open(`/camera?world=${LAMP.has(c.state) ? 'clearing' : 'new'}${c.state ? `&state=${c.state}` : ''}`));
