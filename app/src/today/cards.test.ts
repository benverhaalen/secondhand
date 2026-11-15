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

test('today: a tier label shows only where two tiers meet', () => {
  for (const [, w] of ALL) tiers(cards(w)).forEach((t, i) => assert.equal(t.label === null, i === 0));
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
  assert.equal(addr.primary.label, 'Keep the lot');
  assert.equal(addr.second?.label, 'Share address');
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
  assert.equal(c.primary.label, 'Keep the first');
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
