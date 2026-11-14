import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initial, actions, invariants, explore, settles, NEVER_ALONE } from './lifecycle.mjs';

// Exhaustive: every interleaving of posts, payments, dibs, delists, failures and markdowns across 3 sites.
test('every reachable state keeps the invariants (3 sites, all interleavings)', () => {
  const r = explore(initial(3), actions, invariants);
  assert.equal(r.violation, null, r.violation && `${r.violation.name}\n${r.violation.trace.join('\n')}`);
  assert.ok(r.states > 1000, `explored ${r.states} states`);
});

test('after a sale, every other listing comes down or is flagged red, without the user', () => {
  const r = explore(initial(3), actions, invariants);
  const stuck = r.sold.find(s => !settles(s, actions));
  assert.equal(stuck, undefined, JSON.stringify(stuck));
});

test('address, pickup time and payment are never done by automation', () => {
  for (const a of actions) if (NEVER_ALONE.has(a.kind)) assert.equal(a.actor, 'user', a.name);
});

// The checker must catch real bugs, so plant two and expect counterexamples.
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
