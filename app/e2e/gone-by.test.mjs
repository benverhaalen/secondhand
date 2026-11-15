// The behavior of the gone-by screen (app/behavior/gone-by.json), on the web build. Written from the table's
// states and controls only, before the behavior exists: one test per state, one per control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { behavior, start } from './behavior.mjs';

const table = behavior('gone-by');
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

// ---- helpers (this file only) ----
const sleep = ms => new Promise(r => setTimeout(r, ms));
const has = words => new RegExp(words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));   // the table's quoted words, anywhere in a line
async function until(fn, what, timeout = 3000) {
  const end = Date.now() + timeout;
  for (;;) { if (await fn()) return; if (Date.now() > end) assert.fail(what); await sleep(50); }
}
async function count(loc) { let n = 0; for (const el of await loc.all()) if (await el.isVisible().catch(() => false)) n++; return n; }
const gone = (s, text, timeout) => until(async () => await count(s.page.getByText(text, { exact: typeof text === 'string' })) === 0, `"${text}" is still on screen`, timeout);
const absent = async (s, text) => assert.equal(await count(s.page.getByText(text, { exact: typeof text === 'string' })), 0, `"${text}" is on screen`);

// Opens a state the way the table says: its route, then (posting) the tap its "reach" names, then its "shows" text.
async function open(name, { wait = true } = {}) {
  const st = table.state(name), s = await app.open(st.open);
  if (name === 'posting') {
    // Posting lasts only until the site answers, so the page is watched from before the tap and the text may already be gone again.
    await s.shows(table.state('plan').shows, { timeout: 5000 });
    await s.page.evaluate(words => {
      const look = () => { if (document.body.innerText.includes(words)) globalThis.__sawWords = true; };
      new MutationObserver(look).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
      look();
    }, st.shows);
    assert.equal(await s.page.evaluate(() => !!globalThis.__sawWords), false, `"${st.shows}" is on screen before the tap`);
    await s.tap('approve');
    if (wait) await until(() => s.page.evaluate(() => !!globalThis.__sawWords), `"${st.shows}" never showed after the tap`, 5000);
    return s;
  }
  if (wait) await s.shows(st.shows, { timeout: 5000 });
  return s;
}

// A sheet's rows carry the opener's id, a dash and the choice id.
const rows = (s, opener) => s.page.locator(`[data-testid^="${opener}-"]`);
const texts = loc => loc.evaluateAll(els => els.map(e => `${e.dataset.testid}: ${(e.innerText ?? '').replace(/\s+/g, ' ')}`));
async function sheet(s, opener) {
  const ids = () => s.page.evaluate(() => [...document.querySelectorAll('[data-testid]')].map(e => e.dataset.testid));
  const was = await ids();
  await s.tap(opener);
  await s.saw({ type: 'tap', id: opener });
  const end = Date.now() + 3000;
  while (await count(rows(s, opener)) === 0) {
    if (Date.now() > end) assert.fail(`no row of the "${opener}" sheet became visible; the tap added these ids: ${JSON.stringify((await ids()).filter(i => !was.includes(i)))} at ${s.path()}`);
    await sleep(50);
  }
  return rows(s, opener);
}
// Opens the sheet and taps a row that is not the current choice (rows matching `not`), then waits for the sheet to close.
async function pick(s, opener, not) {
  const all = await sheet(s, opener), free = [];
  // A field to type in is not a row to choose, so it is left out.
  for (const el of await all.locator('visible=true').all()) if (!await el.evaluate(e => /^(INPUT|TEXTAREA)$/.test(e.tagName)) && !(not && not.test(await el.innerText()))) free.push(el);
  assert.ok(free.length, `the "${opener}" sheet has no choice other than the current one`);
  const id = await free[0].getAttribute('data-testid'), text = await free[0].innerText();
  await free[0].tap();
  await s.saw({ type: 'tap', id });
  await until(async () => await count(rows(s, opener)) === 0, `the "${opener}" sheet did not close`);
  return { id, text };
}
// "Opens <a thing>" outside the plan: the thing's name shows once more than before (a sheet over the page), or the path changes (its page).
async function opens(s, id, title) {
  const named = s.page.getByText(has(title)), n = await count(named), from = s.path();
  await s.tap(id);
  await s.saw({ type: 'tap', id });
  await until(async () => s.path() !== from || await count(named) > n, `"${title}" did not open`);
}
// A tile carries a tag (New, Live, Free). The word is read from the tag part itself: a tile's text runs its tag and its
// title together ("NewNintendo Switch"), so a word boundary in the whole tile's text never matches.
const tagged = (s, tile, tag, timeout) => until(async () => await count(s.page.getByTestId(tile).locator('[data-part="tag"]').filter({ hasText: new RegExp(`^${tag}\\b`) })) > 0, `${tile} is not tagged ${tag}`, timeout);
// The tile sits under this group heading, with none of the other headings between them.
const under = (s, tile, heading, others) => s.page.waitForFunction(([tile, heading, others]) => {
  const t = document.querySelector(`[data-testid="${tile}"]`); if (!t) return false;
  const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const leaves = words => [...document.querySelectorAll('*')].filter(e => !e.children.length && e.textContent.trim() === words);
  const h = leaves(heading).filter(e => before(e, t)).pop(); if (!h) return false;
  return !others.some(o => leaves(o).some(e => before(h, e) && before(e, t)));
}, [tile, heading, others], { timeout: 3000 }).catch(() => assert.fail(`${tile} is not under "${heading}"`));
// A part that can no longer be pressed: it is gone, or tapping it opens no sheet.
async function inert(s, id) {
  const el = s.page.getByTestId(id).first();
  if (!await el.isVisible().catch(() => false)) return;
  await el.tap({ force: true, timeout: 1000 }).catch(() => {});
  await sleep(500);
  assert.equal(await count(rows(s, id)), 0, `${id} still opens its sheet`);
}
// A tap that must do nothing: pressed even if the button is disabled.
async function press(s, id) {
  const el = s.page.getByTestId(id);
  await el.waitFor({ state: 'visible', timeout: 3000 });
  await el.tap({ force: true, timeout: 1000 }).catch(() => {});
  await sleep(1500);
}
const goes = (s, path) => s.page.waitForURL(u => new URL(u).pathname === path, { timeout: 3000 });

const SWITCH = 'Nintendo Switch OLED, white, with dock', DUNKS = 'Nike Dunk Low, Grey Fog, men’s 10', JACKET = 'Carhartt Detroit Jacket J97, brown duck, L';
const KEEP = 'You get about $498 if all 5 sell', POST = 'Post 2 and lower 1', POSTED = 'Posted 2, lowered 1';
const FREE = 'What’s left goes up free', ERROR = 'The site didn’t answer, so nothing went up.';

// ---- states ----
for (const st of table.states) test(`gone-by: ${st.state} shows ${st.shows}`, async () => {
  await open(st.state);
});

// Every tap the screen logs is a control the table lists, so nothing on screen does something nobody wrote down.
test('gone-by: no tap goes to a control the table does not list', async () => {
  const s = await open('plan');
  for (const el of await s.page.locator('[data-testid]').all()) if (await el.isVisible().catch(() => false)) await el.tap({ timeout: 500 }).catch(() => {});
  const exact = new Set(table.controls.filter(c => !c.pattern).map(c => c.id));
  const patterns = table.controls.filter(c => c.pattern).map(c => new RegExp('^' + c.id.split(/<[^>]*>/).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+') + '$'));
  const listed = id => exact.has(id) || patterns.some(p => p.test(id));
  assert.deepEqual((await s.events()).filter(e => e.type === 'tap' && e.screen === '/gone-by' && !listed(e.id)), []);
});

// ---- controls: what each one does, keyed "<id> on <state>" as in the table ----
const CHECKS = {
  'nav-back on plan': async s => { await s.tap('nav-back'); await s.saw({ type: 'tap', id: 'nav-back' }); await goes(s, '/'); },
  'nav-back on empty': async s => { await s.tap('nav-back'); await s.saw({ type: 'tap', id: 'nav-back' }); await goes(s, '/'); },

  'moving on plan': async s => { await sheet(s, 'moving'); },
  'moving-<choice id> on plan': async s => {
    await s.shows(/^Gone by Friday/);
    await pick(s, 'moving', /Fri/);
    await gone(s, /^Gone by Friday/);
    await s.shows(/^Gone by (?!Friday)\w+/);
    await s.shows(/^Until (?!Friday)\w+/);
  },

  // The pattern itself: whichever tile comes first opens a sheet of its own rows.
  'thing-<item id> on plan': async s => {
    const tile = s.page.locator('[data-testid^="thing-"]').first();
    await tile.waitFor({ state: 'visible', timeout: 3000 });
    await sheet(s, await tile.getAttribute('data-testid'));
  },
  'thing-it_switch on plan': async s => {
    const named = s.page.getByText(has(SWITCH)), n = await count(named);
    const r = await sheet(s, 'thing-it_switch');
    await until(async () => await count(named) > n, `no sheet titled "${SWITCH}"`);
    assert.ok(await count(r) >= 3, 'the sheet offers sell, give away and keep');
  },
  'thing-it_dunks on plan': async s => {
    const named = s.page.getByText(has(DUNKS)), n = await count(named);
    const r = await sheet(s, 'thing-it_dunks');
    await until(async () => await count(named) > n, `no sheet titled "${DUNKS}"`);
    assert.ok(await count(r) >= 3, 'the sheet offers sell, give away and keep');
  },
  // The Switch is in Sell and is one of the 2 that go up, so any other group changes the money line and the foot button.
  'thing-<item id>-<choice id> on plan': async s => {
    await s.shows(has(KEEP));
    await pick(s, 'thing-it_switch', /sell/i);
    await gone(s, has(KEEP));
    await gone(s, POST);
  },
  'thing-it_switch on sweeping': async s => { await sheet(s, 'thing-it_switch'); await s.shows(table.state('sweeping').shows); },
  'thing-it_switch on started': async s => { await tagged(s, 'thing-it_switch', 'Live'); await opens(s, 'thing-it_switch', SWITCH); await s.shows(/\$225/); },
  'thing-it_pants on wednesday': async s => {
    await opens(s, 'thing-it_pants', 'You get $38.14');
    assert.equal(await count(rows(s, 'thing-it_pants')), 0, 'a sold thing has nothing left to choose');
  },
  'thing-it_jacket on done': async s => { await opens(s, 'thing-it_jacket', JACKET); },

  'price-<item id> on plan': async s => {
    const price = s.page.locator('[data-testid^="price-"]').first();
    await price.waitFor({ state: 'visible', timeout: 3000 });
    await sheet(s, await price.getAttribute('data-testid'));
  },
  'price-it_switch on plan': async s => { const r = await sheet(s, 'price-it_switch'); assert.ok(await count(r.filter({ hasText: /\$225\b/ })) > 0, `the price sheet has $225 in it; its rows: ${JSON.stringify(await texts(r))}`); },
  'price-it_jacket on plan': async s => { const r = await sheet(s, 'price-it_jacket'); assert.ok(await count(r.filter({ hasText: /\$95\b/ })) > 0, `the price sheet has $95 in it; its rows: ${JSON.stringify(await texts(r))}`); },
  'price-<item id>-<choice id> on plan': async s => {
    await s.shows(has(KEEP));
    const { text } = await pick(s, 'price-it_switch', /\$225\b/);
    const price = text.match(/\$[\d,]+(\.\d+)?/)?.[0];
    assert.ok(price, `the row picked ("${text}") names a price`);
    await s.shows(new RegExp(`For\\s*${price.replace(/[.$]/g, '\\$&')}`));
    await gone(s, has(KEEP));
    await s.shows(/You get about \$[\d,]+ if all 5 sell/);
  },
  'price-it_switch on failed': async s => { await sheet(s, 'price-it_switch'); },

  'ending on plan': async s => { const r = await sheet(s, 'ending'); assert.ok(await count(r.filter({ hasText: has(FREE) })) > 0, `the sheet has "${FREE}" in it`); },
  'ending-<choice id> on plan': async s => {
    await s.shows('Thursday at 9 am');
    const line = s.page.getByTestId('ending'), was = await line.innerText();
    await pick(s, 'ending', has(FREE));
    await until(async () => await line.innerText() !== was, `the line under "Thursday at 9 am" still reads "${was}"`);
  },
  'ending on started': async s => { await sheet(s, 'ending'); await s.shows(POSTED); },
  'ending on wednesday': async s => {
    await s.shows('Tomorrow at 9 am');
    const line = s.page.getByTestId('ending'), was = await line.innerText();
    await pick(s, 'ending', has(was.trim()));
    await until(async () => await line.innerText() !== was, `the line under "Tomorrow at 9 am" still reads "${was}"`);
  },

  'approve on plan': async s => {
    await tagged(s, 'thing-it_switch', 'New');
    await s.shows(has('2 go up, 1 gets cheaper'));
    await s.tap('approve'); await s.saw({ type: 'tap', id: 'approve' });
    await s.shows(POSTED, { timeout: 8000 });
    await s.page.getByTestId('approve-undo').waitFor({ state: 'visible', timeout: 3000 });
    await tagged(s, 'thing-it_switch', 'Live');
    await gone(s, has('2 go up, 1 gets cheaper'));
    for (const id of ['moving', 'price-it_switch']) await inert(s, id);
  },
  'approve on sweeping': async s => { await press(s, 'approve'); await s.shows(table.state('sweeping').shows); await absent(s, POSTED); await absent(s, 'Posting'); },
  'approve on failed': async s => {
    await s.tap('approve'); await s.saw({ type: 'tap', id: 'approve' });
    await s.shows(POSTED, { timeout: 8000 });
    await gone(s, has(ERROR));
  },
  'approve on offline': async s => { await press(s, 'approve'); await s.shows(table.state('offline').shows); await absent(s, POSTED); await absent(s, 'Posting'); },
  'approve-undo on started': async s => {
    await s.tap('approve-undo'); await s.saw({ type: 'tap', id: 'approve-undo' });
    await s.shows(POST);
    await gone(s, POSTED);
    await tagged(s, 'thing-it_switch', 'New');
    await s.shows(has('2 go up, 1 gets cheaper'));
  },

  'miss-open on wednesday': async s => { await opens(s, 'miss-open', JACKET); },
  'miss-pack on wednesday': async s => {
    await s.tap('miss-pack'); await s.saw({ type: 'tap', id: 'miss-pack' });
    await until(async () => await count(s.page.getByTestId('miss-pack')) === 0, 'the card at the top is still there');
    await under(s, 'thing-it_jacket', 'Coming with you', ['Still here']);
  },
  'miss-free on wednesday': async s => {
    await s.tap('miss-free'); await s.saw({ type: 'tap', id: 'miss-free' });
    await until(async () => await count(s.page.getByTestId('miss-free')) === 0, 'the card at the top is still there');
    await under(s, 'thing-it_jacket', 'Still here', ['Coming with you']);
    await tagged(s, 'thing-it_jacket', 'Free');
  },
  'miss-more on wednesday': async s => { await sheet(s, 'miss-more'); },
  'miss-more-<choice id> on wednesday': async s => {
    // The jacket may have no tile while its card is up; then the tile has to appear.
    const tile = s.page.getByTestId('thing-it_jacket'), read = async () => await count(tile) ? await tile.first().innerText() : null, was = await read();
    await pick(s, 'miss-more');
    await until(async () => await count(s.page.getByTestId('miss-more')) === 0, 'the card at the top is still there');
    await until(async () => { const now = await read(); return now !== null && now !== was; }, `the jacket's tile does not show the choice (it read ${JSON.stringify(was)} before)`);
  },

  // Added by the builder after Ben's 06:19 note ("always have a way to go back to the site"); the jacket is live on Depop.
  'open-site-<site> on plan': async s => {
    await s.tap('thing-it_jacket'); await s.saw({ type: 'tap', id: 'thing-it_jacket' });
    const row = s.page.locator('[data-testid^="open-site-"]').first();
    await row.waitFor({ state: 'visible', timeout: 3000 });
    const id = await row.getAttribute('data-testid');
    await row.tap(); await s.saw({ type: 'tap', id });
  },
  'open-item on plan': async s => {
    await s.tap('thing-it_jacket'); await s.saw({ type: 'tap', id: 'thing-it_jacket' });
    await s.tap('open-item'); await s.saw({ type: 'tap', id: 'open-item' });
    await goes(s, '/item/it_jacket');
  },

  // The table's "/scan" is not a route in app/src/app; the camera is /camera, the closest real one.
  'scan on empty': async s => { await s.tap('scan'); await s.saw({ type: 'tap', id: 'scan' }); await goes(s, '/camera'); },
};

const key = c => `${c.id} on ${c.on}`;
test('gone-by: every control in the behavior table has a test here', () => {
  assert.deepEqual(Object.keys(CHECKS).sort(), table.controls.map(key).sort());
});

for (const c of table.controls) test(`gone-by: ${key(c)}: ${c.on_tap}`, async () => {
  const check = CHECKS[key(c)] ?? assert.fail(`no test for ${key(c)}`);
  await check(await open(c.on));
});
