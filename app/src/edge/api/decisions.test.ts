import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { act, list, sign, feedOf, formOf } from './decisions.ts';
import { store } from './store.ts';

const LIST = route('GET /v1/decisions', list);
const ACT = route('POST /v1/decisions/:id/act', act);
beforeEach(() => {
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.verify = async (t) => ({ a: 'usr_a', b: 'usr_b' } as Record<string, string>)[t] ?? null;
});
const req = (path: string, token: string, body?: unknown, key = crypto.randomUUID()) =>
  new Request(`http://edge.test${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key }, body: body ? JSON.stringify(body) : undefined });
const raise = (user_id: string, kind: string, extra: Record<string, unknown> = {}) =>
  store.raiseDecision({ user_id, kind, subject: `it_${crypto.randomUUID().slice(0, 6)}`, item_id: 'it_7c2m', why: 'test', options: [{ id: 'opt_yes', label: 'Yes' }, { id: 'opt_no', label: 'No' }], suggested: 'opt_yes', ...extra }).row;

test('a list shows only the caller\'s open decisions, each with tier, feed, form, signed options and a version', async () => {
  const mine = raise('usr_a', 'accept_offer'); raise('usr_b', 'accept_offer');
  const body = await (await LIST(req('/v1/decisions?state=open', 'a'))).json();
  assert.ok(body.data.every((d: { id: string }) => store.decisions({ user_id: 'usr_a' }).some((x) => x.id === d.id)));
  const d = body.data.find((x: { id: string }) => x.id === mine.id);
  assert.equal(d.tier, 'ask'); assert.equal(d.feed, 'now'); assert.equal(d.group_form, 'single'); assert.equal(d.version, 1);
  assert.ok(d.options.every((o: { signature: string }) => typeof o.signature === 'string' && o.signature.includes('.')));
  assert.equal(body.next_cursor, null);
});

test('stacks: two buy_label cards form a batch; one due within a day never groups', () => {
  assert.equal(formOf('buy_label'), 'batch'); assert.equal(formOf('first_post'), 'queue'); assert.equal(formOf('accept_offer'), 'single');
  const soon = new Date(Date.now() + 3600_000).toISOString();
  assert.equal(feedOf({ kind: 'first_post', deadline: soon } as never, Date.now()), 'now');
  assert.equal(feedOf({ kind: 'digest' } as never, Date.now()), 'good_to_know');
});

test('act: the right answer moves the decision to acting and makes one job through intake', async () => {
  const d = raise('usr_a', 'accept_offer');
  const r = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_yes'), version: 1 }));
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.decision.state, 'acting'); assert.equal(b.decision.version, 2); assert.match(b.job.id, /^job_/); assert.equal(b.job.kind, 'answer_offer');
  assert.match(b.event_id, /^ev_/);
});

test('act refuses: a foreign decision 404, a stale version 409, a forged or expired signature 400, a rule on a locked kind 403', async () => {
  const theirs = raise('usr_b', 'accept_offer');
  assert.equal((await ACT(req(`/v1/decisions/${theirs.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(theirs, 'opt_yes'), version: 1 }))).status, 404);
  const d = raise('usr_a', 'counter_offer');
  const stale = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_yes'), version: 7 }));
  assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'stale');
  const forged = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_no'), version: 1 }));
  assert.equal(forged.status, 400);
  const old = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_yes', Date.now() - 16 * 60_000), version: 1 }));
  assert.equal(old.status, 400);
  const locked = raise('usr_a', 'share_address');
  const r = await ACT(req(`/v1/decisions/${locked.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(locked, 'opt_yes'), version: 1, via: 'rule' }));
  assert.equal(r.status, 403); assert.equal((await r.json()).code, 'locked');
});

test('act on an answered decision is 409 stale; a missing field is 400 invalid with fields', async () => {
  const d = raise('usr_a', 'studio_approve');
  const ok = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_yes'), version: 1 }));
  assert.equal((await ok.json()).decision.state, 'answered');
  const again = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_yes'), version: 2 }));
  assert.equal(again.status, 409);
  const bad = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes' }));
  assert.equal(bad.status, 400); assert.deepEqual((await bad.json()).fields, ['signature', 'version']);
});
