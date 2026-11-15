import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, MODE_FOR, NEVER_PROMOTED, NEVER_PERFORMED } from './policy.ts';
import { NEVER_PROMOTED as LIFECYCLE_NEVER_PROMOTED } from '../../../../spec/lifecycle.mjs';

const base = { action: 'post', decision_kind: 'first_post', actor: 'auto' as const, promoted: new Set<string>(), site: 'ebay' };

test('never performed by anyone: refused with a handoff, even on the user tap', () => {
  for (const a of NEVER_PERFORMED) for (const actor of ['user', 'auto', 'site'] as const) {
    const r = check({ ...base, action: a, decision_kind: a, actor, promoted: new Set([a]) });
    assert.deepEqual(r, { allow: false, mode: 'never', decision_kind: a, hint: { do: 'handoff' } });
  }
});

test('share_address acts only on the person tap', () => {
  const k = { action: 'send_message', decision_kind: 'share_address' };
  assert.equal(check({ ...base, ...k, actor: 'user' }).allow, true);
  const r = check({ ...base, ...k, promoted: new Set(['share_address']) });
  assert.deepEqual(r, { allow: false, mode: 'locked', decision_kind: 'share_address', hint: { do: 'raise_decision', kind: 'share_address' } });
});

test('a user tap approves an ask kind; auto does not, until promoted', () => {
  assert.equal(check({ ...base, actor: 'user' }).allow, true);
  assert.deepEqual(check(base), { allow: false, mode: 'ask', decision_kind: 'first_post', hint: { do: 'raise_decision', kind: 'first_post' } });
  assert.equal(check({ ...base, actor: 'site' }).allow, false);
  assert.equal(check({ ...base, promoted: new Set(['first_post']) }).allow, true);
});

test('auto kinds act without a tap', () => {
  assert.equal(check({ ...base, action: 'end', decision_kind: 'delist_after_sale' }).allow, true);
});

test('a kind that is not promotable stays ask even if listed as promoted', () => {
  const r = check({ ...base, action: 'post', decision_kind: 'failed_post', promoted: new Set(['failed_post']) });
  assert.equal(r.allow, false);
});

test('never promoted: a promotion cannot lift these', () => {
  for (const k of ['price_below_floor', 'pickup_outside_hours', 'buy_offer', 'confirm_trade']) {
    const r = check({ ...base, action: 'answer_offer', decision_kind: k, promoted: new Set([k]) });
    assert.equal(r.allow, false, k);
    assert.equal(NEVER_PROMOTED.has(k), true, k);
  }
});

test('relist is never promoted on Poshmark, promotable elsewhere', () => {
  const p = new Set(['relist']);
  assert.equal(check({ ...base, action: 'relist', decision_kind: 'relist', site: 'poshmark', promoted: p }).allow, false);
  assert.equal(check({ ...base, action: 'relist', decision_kind: 'relist', site: 'ebay', promoted: p }).allow, true);
  assert.equal(check({ ...base, action: 'relist', decision_kind: 'relist', site: 'poshmark', actor: 'user' }).allow, true);
});

test('a price below the floor by the system becomes price_below_floor ask', () => {
  const m = { ...base, action: 'revise', decision_kind: 'markdown', floor_cents: 5000 };
  assert.equal(check({ ...m, price_cents: 5000 }).allow, true); // at the floor is fine
  const r = check({ ...m, price_cents: 4999, promoted: new Set(['markdown', 'price_below_floor']) });
  assert.deepEqual(r, { allow: false, mode: 'ask', decision_kind: 'price_below_floor', hint: { do: 'raise_decision', kind: 'price_below_floor' } });
  assert.equal(check({ ...m, price_cents: 4999, actor: 'user' }).allow, true);
});

test('accept_offer is auto at or above always_accept, else ask', () => {
  const o = { ...base, action: 'answer_offer', decision_kind: 'accept_offer', floor_cents: 1000, always_accept_cents: 8000 };
  assert.equal(check({ ...o, price_cents: 8000 }).allow, true);
  assert.equal(check({ ...o, price_cents: 7000 }).allow, false);
});

test('an unknown decision kind fails closed as ask', () => {
  const r = check({ ...base, decision_kind: 'made_up' });
  assert.equal(r.allow, false);
});

test('the map matches product.md §5 and lifecycle.mjs NEVER_PROMOTED', () => {
  const snake = (s: string) => s.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
  const name: Record<string, string> = { address: 'share_address', pickupTime: 'pickup_outside_hours', payment: 'refund' };
  for (const k of LIFECYCLE_NEVER_PROMOTED as Set<string>) assert.equal(NEVER_PROMOTED.has(name[k] ?? snake(k)), true, k);
  assert.equal(MODE_FOR.confirm_trade, 'ask');
  assert.equal(MODE_FOR.buy_offer, 'ask');
  for (const k of ['refund', 'complete_purchase', 'move_off_site', 'share_address', 'identity_claim']) assert.equal(MODE_FOR[k], 'locked', k);
  for (const k of ['delist_after_sale', 'answer_fact', 'markdown', 'counter_offer', 'decline_offer', 'offer_to_watchers', 'book_pickup', 'digest']) assert.equal(MODE_FOR[k], 'auto', k);
});
