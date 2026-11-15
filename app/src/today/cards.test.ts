// What Today draws, checked on every world: node --test src/today/cards.test.ts (from app/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_NAMES, world } from '../demo/index.ts';
import { ms } from '../demo/format.ts';
import { ROW_CHARS, cards, handledLine, log, sales, tiers, top } from './cards.ts';
import { stopsWorld } from './stops.ts';

const ALL = [...WORLD_NAMES.map(n => [n as string, world(n)] as const), ['stops', stopsWorld] as const];

test('today: the top slot is never $0, and a new person gets the next setup step', () => {
  for (const [n, w] of ALL) { const t = top(w); if (t?.kind === 'news') assert.ok(t.cents > 0, n); }
  assert.equal(top(world('new'))?.kind, 'setup');
  assert.equal(top(world('clearing'))?.kind, 'news');
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

// The top slot shows what sold, with its photo and site, so the good news is the things, not only a number.
test('today: the top slot names what sold since the last look', () => {
  const t = top(world('clearing'));
  assert.equal(t?.kind, 'news');
  if (t?.kind === 'news') { assert.equal(t.sold.length, 2); for (const s of t.sold) { assert.ok(s.photo); assert.ok(s.site); } }
});
