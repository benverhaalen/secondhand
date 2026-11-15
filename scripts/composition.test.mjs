// Each rule in composition.mjs with the smallest render that breaks it, and the approved mock's shape, which passes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compose } from './composition.mjs';

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

test('U11: the tab frame is not read, and the top number with its window over it is one line', () => {
  const s = approved(); s.items[0].y = 330;
  s.texts.push(t('Today', 'heading', 108, { frame: true }), t('Since yesterday', 'caption', 112, { news: true }));
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
