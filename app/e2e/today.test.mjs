// The behavior of Today (app/behavior/(tabs)/index.json), on the web build: node --test "app/e2e/*.test.mjs"
// One test per state in the table, and one per control: pressing it logs the tap and goes where the table says.
// Tests read the event log and the words on screen, not pixels.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start } from './behavior.mjs';

const table = behavior('(tabs)/index');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

const ROUTE = { clearing: '/?world=clearing', new: '/?state=new', flipper: '/?state=dense', stops: '/?world=stops' };
const open = (route = ROUTE.clearing) => app.open(route);
const count = (s, sel) => s.page.locator(sel).count();
const text = s => s.page.locator('body').innerText();

// Each state: how to reach it, and what must then be on screen.
const STATES = {
  typical: async () => { const s = await open(); for (const t of ['Since yesterday', '$97.33', '2 sold, after fees', 'When you can', 'Good to know', 'Keep the lot', 'Accept $85', 'Counter $92', 'Buy 2 labels', 'Took 2 listings down, and 1 more']) await s.shows(t); },
  new: async () => { const s = await open(ROUTE.new); await s.shows('Link a site'); await s.shows('What’s something worth?'); assert.equal(await count(s, '[data-part="card-decision"]'), 0); },
  dense: async () => { const s = await open(ROUTE.flipper); await s.shows('Since this morning'); await s.shows('5 to ship'); await s.shows('40 to post'); await s.shows('Review 40'); assert.equal(await count(s, '[data-part="card-stack"]'), 1); },
  empty: async () => {
    const s = await open('/?state=empty'); await s.shows('Nothing needs you');
    for (const sel of ['[data-part="top-slot"]', '[data-part="card-decision"]', '[data-part="notice"]']) assert.equal(await count(s, sel), 0, sel);
  },
  one: async () => { const s = await open('/?state=one'); await s.shows('$97.33'); await s.shows('Keep the lot'); assert.equal(await count(s, '[data-part="card-decision"]'), 1); },
  'did not load': async () => {
    const s = await open('/?state=failed'); await s.shows('Today didn’t load'); assert.equal(await count(s, '[data-part="card-decision"]'), 0);
    await s.tap('retry'); await s.shows('Keep the lot');
  },
  loading: async () => { const s = await open('/?state=loading'); await s.page.locator('[data-skeleton="true"]').first().waitFor({ timeout: 3000 }); assert.equal(await count(s, '[data-skeleton="true"]'), 3); assert.equal(await count(s, '[data-part="top-slot"]'), 0); },
  working: async () => { const s = await open(); await s.tap('dec_jacket-acc'); await s.shows('Accepting'); },
  done: async () => {
    const s = await open(); await s.tap('dec_jacket-acc'); await s.shows('Accepted $85', { timeout: 4000 });
    await s.page.getByTestId('dec_jacket-open').waitFor({ state: 'detached', timeout: 2000 }); // the answered card left, after its fade
    await s.tap('dec_jacket-undo'); await s.page.getByTestId('dec_jacket-open').waitFor({ state: 'visible', timeout: 3000 });
  },
  failed: async () => { const s = await open('/?world=clearing&fail=dec_jacket'); await s.tap('dec_jacket-acc'); await s.shows('The site did not answer', { timeout: 4000 }); await s.shows('Retry'); },
  'batch failed': async () => {
    const s = await open('/?world=clearing&fail=dec_lbl2'); await s.tap('batch-buy_label-all'); await s.shows('1 of 2');
    await s.shows(/did not go through/, { timeout: 5000 }); await s.shows('Retry');
  },
  queue: async () => {
    const s = await open(ROUTE.flipper); await s.tap('queue-first_post-review'); await s.shows('Ready to post'); await s.shows('1 of 40');
    await s.tap('queue-approve'); await s.shows('2 of 40', { timeout: 4000 });
  },
  offline: async () => {
    const s = await open('/?state=offline'); await s.shows('Waiting for signal'); await s.tap('dec_jacket-acc');
    await s.page.getByTestId('dec_jacket-acc').getByText('Waiting for signal').waitFor({ timeout: 3000 });
  },
  stops: async () => {
    const s = await open(ROUTE.stops); for (const t of ['Sold twice', 'Both paid, $42 and $40', '3 sold, after fees', 'Do the Joy-Cons drift?', 'The tag photo is blurry', 'The site shows $44, not your $48']) await s.shows(t);
    await s.tap('dec_double-compare'); await s.shows(/workpants_jo paid \$42, first/); await s.shows(/Cancelling here marks your seller record/);
  },
  break: async () => { const s = await open('/?world=edge'); await s.shows('99+'); await s.shows('Accept $10,999.99'); await s.shows('Counter'); assert.equal(await count(s, '[data-part="card-decision"]') > 10, true); },
};

test('today: every state in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(STATES).sort(), table.states.map(s => s.state).sort());
});
for (const [name, run] of Object.entries(STATES)) test(`today: ${name} shows ${table.state(name).shows.slice(0, 80)}`, run);

// The top of Today is never $0 (decision 2026-11-15), in any world.
for (const w of ['new', 'clearing', 'flipper', 'one', 'edge']) test(`today: ${w} never shows $0`, async () => {
  const s = await open(`/?world=${w}`); await s.shows('secondhand');
  assert.doesNotMatch(await text(s), /\$0(\.00)?(?![\d.,])/);
});

// The steps that put a control on screen: a sheet or the queue opens first.
const BEFORE = {
  'dec_jacket-amount': ['dec_jacket-more'], 'dec_jacket-later': ['dec_jacket-more'], 'dec_jacket-go-chat': ['dec_jacket-more'],
  'log-all': ['handled'], 'dec_double-keep-first': ['dec_double-compare'], 'dec_jacket-elsewhere': ['dec_jacket-more'], 'queue-approve': ['queue-first_post-review'], 'queue-skip': ['queue-first_post-review'], 'nav-back': ['queue-first_post-review'],
};
for (const c of table.controls) test(`today: ${c.id} ${c.on_tap}`, async () => {
  const s = await open(c.route ?? ROUTE[c.world ?? 'clearing']);
  for (const id of BEFORE[c.id] ?? []) await s.tap(id);
  await s.tap(c.id);
  await s.saw({ type: 'tap', id: c.id });
  if (c.goes) await s.page.waitForURL(u => new URL(u).pathname === c.goes, { timeout: 3000 });
});

// An amount under the person's lowest asks once before it goes (edge-cases §3).
test('today: a counter under the lowest asks once', async () => {
  const s = await open(); await s.tap('dec_jacket-more'); await s.tap('dec_jacket-amount'); await s.tap('amount-value');
  await s.page.getByTestId('amount-value-input').fill('60'); await s.page.getByTestId('amount-value-input').press('Enter');
  await s.tap('amount-send'); await s.shows('Under your lowest, $70. Tap again to send it.');
  await s.tap('amount-send'); await s.shows('Sending');
});

// One black pill per view (C4): the lead card, nearest its deadline, and any card due within the hour; the rest lead light.
for (const [route, lead] of [['/?world=clearing', 'dec_addr'], ['/?state=dense', null]]) test(`today: ${route} has one black pill per view (C4)`, async () => {
  const s = await open(route); await s.page.locator('[data-part="card-decision"]').first().waitFor();
  const black = s.page.locator('[data-part="pill-card"][data-kind="primary"]');
  assert.equal(await black.count(), 1);
  if (lead) assert.equal(await s.page.getByTestId(`${lead}-open`).locator('[data-part="pill-card"][data-kind="primary"]').count(), 1);
});
