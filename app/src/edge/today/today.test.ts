import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queue, expire, undo, DECISION_KINDS } from './today.ts';
import { memoryStore } from '../events/ports.ts';
import type { EventRow } from '../events/event.ts';

const NOW = '2026-06-01T12:00:00Z';
const raise = (s: ReturnType<typeof memoryStore>, o: Record<string, unknown>) =>
  s.raiseDecision({ user_id: 'u1', kind: 'markdown', subject: String(Math.random()), why: 'w', options: [], ...o } as never).row;

test('queue orders by value, then sooner expiry; no deadline last; other people and closed ones left out', () => {
  const s = memoryStore();
  raise(s, { subject: 'low', value_cents: 100, deadline: '2026-06-01T13:00:00Z' });
  raise(s, { subject: 'hi_late', value_cents: 900, deadline: '2026-06-02T00:00:00Z' });
  raise(s, { subject: 'hi_soon', value_cents: 900, deadline: '2026-06-01T14:00:00Z' });
  raise(s, { subject: 'hi_none', value_cents: 900 });
  raise(s, { subject: 'other', user_id: 'u2', value_cents: 9999 });
  const done = raise(s, { subject: 'done', value_cents: 5000 }); s.updateDecision(done.id, { state: 'answered' });
  assert.deepEqual(queue(s, { user_id: 'u1', now: NOW }).map(d => d.subject), ['hi_soon', 'hi_late', 'hi_none', 'low']);
});

test('expire closes past-deadline decisions as expired and never acts outward', () => {
  const s = memoryStore();
  const late = raise(s, { kind: 'counter_offer', deadline: '2026-06-01T11:00:00Z' });
  const claim = raise(s, { kind: 'unbacked_claim', deadline: '2026-06-01T11:59:00Z' });
  const fine = raise(s, { deadline: '2026-06-01T13:00:00Z' });
  const out = expire(s, { now: NOW });
  assert.equal(s.decisions({ state: 'expired' }).length, 2);
  assert.equal(s.decisions().find(d => d.id === fine.id)!.state, 'open');
  assert.deepEqual(out.find(o => o.id === claim.id), { id: claim.id, kind: 'unbacked_claim', default: 'send_without_claim' });
  assert.equal(out.find(o => o.id === late.id)!.default, 'nothing');
  assert.equal(s.jobs().length, 0, 'no job, so nothing runs on a site');
  assert.equal(expire(s, { now: NOW }).length, 0, 'a second run changes nothing');
});

test('the decision kinds are product.md section 5 plus the three named', () => {
  for (const k of ['first_post', 'unbacked_claim', 'price_below_floor', 'end_unsold', 'return_claim', 'dispute', 'category_unsure', 'confirm_trade', 'ask']) assert.ok(DECISION_KINDS.includes(k), k);
  assert.equal(new Set(DECISION_KINDS).size, DECISION_KINDS.length);
});

const orig = (s: ReturnType<typeof memoryStore>, o: Partial<EventRow>) => s.insertEvent({ user_id: 'u1', source: 'app', action: 'app.reprice', item_id: 'i1', dedupe_key: Math.random().toString(), actor: 'auto', observed_at: '2026-06-01T10:00:00Z', effective_at: '2026-06-01T10:00:00Z', trace_id: 't', ...o }).row;

test('undo writes an event with undo_of while allowed and before until', () => {
  const s = memoryStore();
  const e = orig(s, { undo: { allowed: true, until: '2026-06-01T13:00:00Z' } });
  const r = undo(s, e.id, NOW);
  assert.ok('event' in r);
  assert.equal(r.event.undo_of, e.id);
  assert.equal(s.events().filter(x => x.undo_of === e.id).length, 1);
  assert.deepEqual(undo(s, e.id, NOW), { error: 'site_no_undo', status: 409 }, 'a second undo is refused');
});

test('undo is refused when not allowed, past until, or past 24 h with no until', () => {
  const s = memoryStore();
  assert.deepEqual(undo(s, orig(s, { undo: { allowed: false } }).id, NOW), { error: 'site_no_undo', status: 409 });
  assert.deepEqual(undo(s, orig(s, { undo: { allowed: true, until: '2026-06-01T11:00:00Z' } }).id, NOW), { error: 'site_no_undo', status: 409 });
  assert.deepEqual(undo(s, orig(s, { undo: { allowed: true }, observed_at: '2026-05-30T10:00:00Z' }).id, NOW), { error: 'site_no_undo', status: 409 });
  assert.ok('event' in undo(s, orig(s, { undo: { allowed: true }, observed_at: '2026-06-01T01:00:00Z' }).id, NOW));
  assert.deepEqual(undo(s, 'missing', NOW), { error: 'not_found', status: 404 });
});
