import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initial, actions, allActions, promote, invariants, explore, settles, itemPill, NEVER_ALONE } from './lifecycle.mjs';

const full = explore(initial(3), allActions, invariants);

// Exhaustive: every interleaving of posts, payments, dibs, delists, failures, markdowns, pickups and promotions across 3 sites.
test('every reachable state keeps the invariants (3 sites, all interleavings)', () => {
  assert.equal(full.violation, null, full.violation && `${full.violation.name}\n${full.violation.trace.join('\n')}`);
  assert.ok(full.states > 1000, `explored ${full.states} states`);
});

test('after a sale, every other listing comes down or is flagged red, without the user', () => {
  const stuck = full.sold.find(s => !settles(s, allActions));
  assert.equal(stuck, undefined, JSON.stringify(stuck));
});

test('address, pickup time and payment each have an action, and only the user does them', () => {
  for (const k of NEVER_ALONE) assert.ok(actions.some(a => a.kind === k), `no action of kind ${k}, so the rule could not fail`);
  for (const a of actions) if (NEVER_ALONE.has(a.kind)) assert.equal(a.actor, 'user', a.name);
});

test('a failed delist leaves the listing up: a buyer can still pay, and that payment opens a refund', () => {
  const s = initial(2), by = n => actions.find(a => a.name === n), step = (n, i) => { assert.ok(by(n).when(s, i), `${n}(${i})`); by(n).run(s, i, by(n).actor); };
  for (const [n, i] of [['post', 0], ['post', 1], ['postOk', 0], ['postOk', 1], ['buyerPays', 0], ['delist', 1], ['delistFail', 1], ['buyerPays', 1]]) step(n, i);
  assert.ok(s.decisions.includes('refund:1'));
  assert.equal(itemPill(s), 'Failed');
});

test('one pill per item: failures beat a sale, a sale beats live, live beats a draft', () => {
  const s = initial(2);
  assert.equal(itemPill(s), 'Review');
  s.listings[0].st = 'live'; assert.equal(itemPill(s), 'Live');
  s.sale = 0; s.listings[0].paid = true; assert.equal(itemPill(s), 'Sold');
  s.listings[1].st = 'delistFailed'; s.decisions.push('failed:1'); assert.equal(itemPill(s), 'Failed');
});

// The checker must catch real bugs, so plant them and expect counterexamples.
test('the checker finds a double sale when a second payment is not flagged', () => {
  const buggy = actions.map(a => a.name !== 'buyerPays' ? a : { ...a, run: (s, i) => { a.run(s, i); s.decisions = s.decisions.filter(d => !d.startsWith('refund')); } });
  const r = explore(initial(2), buggy, invariants);
  assert.equal(r.violation?.name, 'one kept sale');
  assert.ok(r.violation.trace.length >= 3);
});

test('the checker finds a markdown below the floor', () => {
  const buggy = actions.map(a => a.name !== 'markdown' ? a : { ...a, when: s => s.sale === null && s.price > 0 });
  assert.equal(explore(initial(1), buggy, invariants).violation?.name, 'price floor');
});

test('one approval below the floor does not let automation keep going lower', () => {
  const buggy = actions.map(a => a.name !== 'markdown' ? a : { ...a, when: s => s.sale === null && s.price > 10 && (s.price - 10 >= s.floor || s.approvedPrice !== null) });
  assert.equal(explore(initial(1), buggy, invariants).violation?.name, 'price floor');
});

test('promoting a Never alone kind is caught', () => {
  const careless = promote(new Set());
  const buggy = [...actions, { ...careless, when: (s, k) => !s.auto.includes(k) }]; // offers "Always do this" for anything
  assert.equal(explore(initial(3), buggy, invariants).violation?.name, 'never alone stays with the user');
});

// Ben's tiers say any price below the floor is an Ask, and Asks can be promoted. The model shows the two rules clash.
test('if "price below your floor" could be promoted, automation would break the floor (open question for Ben)', () => {
  const r = explore(initial(1), [...actions, promote(new Set(NEVER_ALONE))], invariants);
  assert.equal(r.violation?.name, 'price floor');
  assert.ok(r.violation.trace.includes('promote(priceBelowFloor)'), r.violation.trace.join(' '));
});
