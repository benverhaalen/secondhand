// Each rule in composition.mjs with the smallest render that breaks it, and the approved mock's shape, which passes.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { playwright } from './brand-check.mjs';
import { compose, snapshot } from './composition.mjs';

const t = (s, role, y, more = {}) => ({ s, role, color: 'rgb(10, 10, 10)', size: 15, y, bottom: y + 20, seen: true, bar: false, head: false, shelf: null, item: null, cut: false, ...more });
const ids = f => f.map(x => x.id).sort();
// Ben's approved Today (round 11 mock, today-v3): the wordmark, the money and one line, then cards; six presses; no headers.
const approved = () => ({ vh: 844, insetTop: 59, nav: { y: 59, bottom: 103 }, shelves: [],
  texts: [t('secondhand', 'title', 67, { bar: true }), t('$96.20', 'amount', 120), t('Kept this week, 3 sold', 'body', 180),
    t('Carhartt Detroit jacket', 'headline', 260, { item: 'card-decision' }), t('Nike Dunks', 'headline', 430, { item: 'card-decision' })],
  pills: [1, 2, 3, 4, 5, 6].map(i => ({ part: 'pill-card', y: 300 + i * 10, bottom: 340 + i * 10, seen: true })),
  items: [{ part: 'card-decision', y: 230, bottom: 386, seen: true }, { part: 'card-decision', y: 402, bottom: 558, seen: true }] });

test('the approved Today passes every composition rule', () => {
  assert.deepEqual(compose(approved(), { route: '(tabs)/index' }), []);
});

test('U9: a word or the nav under the status bar fails; the wash may run under it', () => {
  const s = approved(); s.nav = { y: 14, bottom: 58 }; s.texts.push(t('Since yesterday', 'caption', 52));
  assert.deepEqual(ids(compose(s, { route: '(tabs)/index' })), ['U9']);
});

test('U10: a section header set like the card titles under it fails; a quiet label or a header over 15 titles passes', () => {
  const s = approved(); s.texts.push(t('Needs you now', 'headline', 205, { head: true }));
  assert.match(compose(s, { route: '(tabs)/index' }).find(f => f.id === 'U10').msg, /set like the item title/);
  const quiet = approved(); quiet.texts.push(t('Needs you now', 'body', 205, { head: true, color: 'rgb(10 10 10 / 0.65)' }));
  assert.deepEqual(compose(quiet, { route: '(tabs)/index' }), []);
});

test('U11: five lines before the first card on a main tab fails; a pushed page is not held to it', () => {
  const s = approved(); s.items[0].y = 330;
  s.texts.push(t('Since yesterday', 'caption', 108), t('Needs you now', 'body', 250, { head: true }), t('Due first, today at 3 pm', 'caption', 290));
  assert.deepEqual(ids(compose(s, { route: '(tabs)/index' })), ['U11']);
  assert.deepEqual(compose(s, { route: 'item/[id]' }), []);
});

test('U11: the top number with its window over it is one line', () => {
  const s = approved(); s.items[0].y = 330;
  s.texts.push(t('Today', 'heading', 108, { bar: true }), t('Since yesterday', 'caption', 112, { news: true }));
  s.texts.find(x => x.s === '$96.20').news = true; s.texts.find(x => x.s.startsWith('Kept')).news = true;
  s.texts.push(t('Needs you now', 'body', 250, { head: true }));
  assert.deepEqual(compose(s, { route: '(tabs)/index' }), []);
  s.texts.push(t('Due first, today at 3 pm', 'caption', 290));
  assert.deepEqual(ids(compose(s, { route: '(tabs)/index' })), ['U11']);
});

test('U12: more than seven buttons on the first screen fails, but not on a ?state= page', () => {
  const s = approved(); for (let i = 0; i < 3; i++) s.pills.push({ part: 'icon-button', y: 500, bottom: 540, seen: true });
  assert.deepEqual(ids(compose(s, { route: '(tabs)/index' })), ['U12']);
  assert.deepEqual(compose(s, { route: '(tabs)/index', typical: false }), []);
});

test('U13: a header and a tag on every item that say the same state fail; tags that tell items apart pass', () => {
  const s = approved(); s.shelves = [{ id: 'needs_you', head: true, tags: ['hot', 'hot', 'hot'] }];
  assert.deepEqual(ids(compose(s, { route: '(tabs)/index' })), ['U13']);
  s.shelves = [{ id: 'needs_you', head: true, tags: ['offer', 'pickup', 'scam'] }];
  assert.deepEqual(compose(s, { route: '(tabs)/index' }), []);
});

test('U14: a cut title fails in the typical world', () => {
  const s = approved(); s.texts[3].cut = true;
  assert.deepEqual(ids(compose(s, { route: '(tabs)/index' })), ['U14']);
});

// The snapshot runs in the page, so these render a page shaped like a main tab and read it as app-check does.
const pw = playwright(); let browser;
before(async () => { if (pw) browser = await pw.chromium.launch(); });
after(async () => { await browser?.close(); });
const tab = async body => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(`<body style="margin:0;font:15px/20px sans-serif"><div style="padding:59px 20px 0">${body}</div></body>`);
  const snap = await page.evaluate(snapshot, { insetTop: 59 }); await page.close();
  return compose(snap, { route: '(tabs)/sell' });
};
const line = (s, role = 'body') => `<div data-role="${role}" style="height:20px;margin-bottom:12px">${s}</div>`;
const head = `<div data-part="page-head" style="height:48px;display:flex;justify-content:space-between;align-items:center">
  <span data-role="heading" style="font-size:36px;line-height:40px">Sell</span><span style="margin-top:20px" data-role="body">Select</span><span data-role="caption">4</span></div>`;
const grid = '<div data-part="tile" style="height:200px;width:160px"></div>';

// Sell, 11-15 10:20: the title row (TabNav) replaced the nav on the tabs, and its title, its count and Select were counted as
// lines before the first tile, so every main tab failed U11 for its own name.
test('U11: a main tab\'s title row (page-head) is the nav, not lines before the first item', { skip: !pw }, async () => {
  assert.deepEqual(ids(await tab(`${head}${line('Latest All Needs you')}${line('Needs you 8')}${grid}`)), []);
});
test('U11: four lines under the title row still fail', { skip: !pw }, async () => {
  assert.deepEqual(ids(await tab(`${head}${line('Since yesterday')}${line('$96.20', 'amount')}${line('Needs you now')}${line('Due first, today at 3 pm')}${grid}`)), ['U11']);
});

// Buy, 11-15: Section sets its title at 18 in ink and marks nothing, so "Needs you" over cards titled at 18 passed U10
// unseen. A line with items after it in its own group is a header, marked or not.
test('U10: an unmarked section title set like the card titles under it fails; a quiet label over the cards passes', { skip: !pw }, async () => {
  const card = '<div data-part="card-decision" style="height:156px"><div data-role="headline" style="font-size:18px">Nike Dunk Low</div></div>';
  const section = title => `<div style="padding-top:59px">${title}${card}${card}</div>`;
  const read = async body => { const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); await page.setContent(body);
    const snap = await page.evaluate(snapshot, { insetTop: 59 }); await page.close(); return compose(snap, { route: 'listing/[id]' }); };
  assert.deepEqual(ids(await read(section('<div data-role="headline" style="font-size:18px">Needs you</div>'))), ['U10']);
  assert.deepEqual(ids(await read(section('<div data-head="cards"><div data-role="body" style="font-size:15px;color:rgb(10 10 10 / 0.65)">Needs you</div></div>'))), []);
});
