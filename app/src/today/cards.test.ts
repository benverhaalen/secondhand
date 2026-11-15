// What Today draws, checked on every world: node --test src/today/cards.test.ts (from app/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_NAMES, world } from '../demo/index.ts';
import { ms } from '../demo/format.ts';
import { ROW_CHARS, cards, handledLine, log, sales, tiers, top } from './cards.ts';
import { oneCardWorld, quietWorld, stopsWorld } from './stops.ts';

const ALL = [...WORLD_NAMES.map(n => [n as string, world(n)] as const), ['stops', stopsWorld] as const];

// The top is the most flattering true number, by a ladder (Ben 07:12: "the top thing should be the most flattering metric ...
// updates from last time are definitely best but you dont always have updates. what do you say when nothings gone on yet").
// One test per rung, then the rules every rung keeps: never $0, never rounded up, always a named window.
test('today top, rung a: money since the last open, with what sold', () => {
  const t = top(world('clearing'));
  assert.equal(t.rung, 'since');
  assert.equal(t.caption, 'Since yesterday'); assert.equal(t.figure, '$97.27'); // eBay charges its fee on sales tax at valuation_sales_tax_rate (0.0753) assert.equal(t.line, '2 sold, after fees');
  assert.equal(t.things.length, 2); for (const x of t.things) { assert.ok(x.photo); assert.ok(x.site); }
});
test('today top, rung b: nothing new since the last open, so this week, else this month', () => {
  const week = top(oneCardWorld);
  assert.equal(week.rung, 'period');
  assert.equal(week.caption, 'This week'); assert.equal(week.line, '3 sold, after fees'); assert.equal(week.things.length, 3);
  const c = world('clearing'), kin = c.orders.find(o => o.id === 'ord_kin');
  assert.ok(kin);
  const month = top({ ...c, user: { ...c.user, last_open_at: c.now }, orders: [{ ...kin, created_at: '2026-11-03T18:00:00Z' }] });
  assert.equal(month.rung, 'period');
  assert.equal(month.caption, 'This month'); assert.equal(month.line, '1 sold, after fees');
});
test('today top, rung c: never sold and something is live, what it could bring, before fees', () => {
  const t = top(world('one'));
  assert.equal(t.rung, 'could');
  assert.equal(t.caption, 'Your listing could bring'); assert.equal(t.figure, '$85'); assert.equal(t.line, 'up to $115, before fees');
});
test('today top, rung d: sold before, nothing this month, so the interest since the last open', () => {
  const t = top(quietWorld);
  assert.equal(t.rung, 'interest');
  assert.equal(t.caption, 'Since yesterday'); assert.equal(t.figure, '38 views'); assert.equal(t.line, '6 likes, 2 watching');
  // With no new interest, what is live is still a true number: rung c again.
  const still = top({ ...quietWorld, items: quietWorld.items.map(i => ({ ...i, listings: i.listings.map(l => ({ ...l, interest_new: undefined })) })) });
  assert.equal(still.rung, 'could');
});
test('today top, rung e: nothing listed yet, no number, one way forward', () => {
  const t = top(world('new'));
  assert.equal(t.rung, 'start');
  if (t.rung === 'start') { assert.equal(t.step, 'See what your things are worth'); assert.equal(t.to, '/camera'); }
});
test('today top: never $0, never without its window, and new, one and empty land on different rungs', () => {
  for (const [n, w] of [...ALL, ['one-card', oneCardWorld] as const, ['quiet', quietWorld] as const]) {
    const t = top(w);
    if (t.rung === 'start') continue;
    assert.doesNotMatch(t.figure, /^\$0(\.00)?$|^0 /, n); assert.ok(t.caption.length > 0, n);
  }
  assert.equal(new Set([top(world('new')).rung, top(oneCardWorld).rung, top(quietWorld).rung]).size, 3);
});

test('today: no card shows an amount of $0 or less', () => {
  for (const [n, w] of ALL) for (const c of cards(w)) if (c.fact.cents != null) assert.ok(c.fact.cents > 0, `${n} ${c.key} ${c.fact.label}`);
});

// Ben 06:19: "the sell one seems very organized and it's very easy to see like needs you in progress": every tier has its
// header, as Sell's shelves do, and the first reads Needs you now.
test('today: every tier has its header, and the first one that needs you says so', () => {
  for (const [n, w] of ALL) tiers(cards(w)).forEach(t => assert.ok(t.label, `${n} ${t.tier}`));
  assert.equal(tiers(cards(world('clearing')))[0].label, 'Needs you now');
});

test('today: nothing due within a day stacks, and a queue never mixes kinds', () => {
  for (const [n, w] of ALL) for (const c of cards(w)) {
    if (c.form === 'single') continue;
    const ds = c.ids.map(id => w.decisions.find(d => d.id === id)!);
    assert.equal(new Set(ds.map(d => d.kind)).size, 1, `${n} ${c.key}`);
    if (c.form === 'queue') for (const d of ds) assert.ok(!d.deadline || ms(d.deadline) - ms(w.now) >= 864e5, `${n} ${d.id}`);
    if (c.form === 'batch') assert.ok(ds.length > 1);
  }
});

test('today: every card leads somewhere, and its two pills fit the row', () => {
  for (const [n, w] of ALL) for (const c of cards(w)) {
    assert.match(c.open, /^\//, `${n} ${c.key}`);
    assert.ok(c.primary.label.length + (c.second?.label.length ?? 0) <= ROW_CHARS, `${n} ${c.key}: ${c.primary.label} / ${c.second?.label}`);
  }
});

test('today: price, address and pickup are never acted on without a pill the person presses', () => {
  const addr = cards(world('clearing')).find(c => c.key === 'dec_addr')!;
  assert.equal(addr.primary.label, 'Meet in public');
  assert.equal(addr.second?.label, 'Send address');
});

test('today: the handled line names what was done, never a bare count (ledger L13)', () => {
  assert.equal(handledLine(world('clearing')), 'Took 2 listings down, and 1 more');
  assert.equal(handledLine(world('new')), null);
  for (const [n, w] of ALL) { const l = handledLine(w); if (l) assert.doesNotMatch(l, /^\d+ handled|handled \d+/i, n); }
});

test('today: the log shows what it did since the last look and what can still be undone', () => {
  const rows = log(world('clearing'));
  assert.ok(rows.some(r => r.can_undo));
  assert.ok(rows.every((r, i) => i === 0 || ms(rows[i - 1].at) >= ms(r.at)));
});

test('today: a fact is a label, not a sentence', () => {
  for (const [n, w] of ALL) for (const c of cards(w)) assert.doesNotMatch(c.fact.label, /\.$/, `${n} ${c.key}`);
});

test('today: a double sale names both sales, first paid first, with what each keeps and what cancelling costs (edge-cases §1)', () => {
  const c = cards(stopsWorld).find(x => x.key === 'dec_double')!;
  assert.equal(c.primary.label, 'Keep first buyer');
  assert.equal(c.second?.do, 'compare');
  const two = sales(stopsWorld, stopsWorld.decisions.find(d => d.id === 'dec_double')!);
  assert.deepEqual(two.map(o => o.site), ['ebay', 'depop']);
  for (const o of two) { assert.ok(o.keep > 0 && o.keep < o.price); assert.match(o.cancel, /^Cancelling here/); }
});

test('today: every stop on the auto-list tree is one card with one question (edge-cases §7)', () => {
  const stops = cards(stopsWorld).filter(c => ['dec_retake', 'dec_fact', 'dec_claim', 'dec_changed'].includes(c.key));
  assert.equal(stops.length, 4);
  for (const c of stops) { assert.equal(c.form, 'single'); assert.ok(c.fact.label.length > 0); assert.ok(c.primary.label && c.second); }
});

// Ben 06:19 on the first gallery: no "You keep", no "Careful", no "Keep the lot"; one money form on every card.
test('today: the words Ben found unclear are gone, and money reads one way', () => {
  for (const [n, w] of ALL) for (const c of cards(w)) {
    const words = [c.word, c.fact.label, c.primary.label, c.second?.label ?? '', ...c.more.map(a => a.label)].join(' | ');
    assert.doesNotMatch(words, /You keep|Careful|Keep the lot|Reply safely/, `${n} ${c.key}: ${words}`);
  }
  assert.equal(cards(world('clearing')).find(c => c.key === 'dec_scam')?.word, 'Possible scam');
});

// Always a way back to the site (Ben 06:19): a card for a listed item has Open on the site in its More.
test('today: a card on a listed item has the way back to its site', () => {
  for (const c of cards(world('clearing')).filter(c => c.form === 'single' && c.site)) {
    const it = world('clearing').items.find(i => i.photos[0]?.key === c.photo);
    if (it?.listings.some(l => l.site === c.site) && c.title === it.title) assert.ok(c.more.some(a => a.do === 'site'), c.key);
  }
});

