import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { headlinePort, today } from './today.ts';
import { store } from './store.ts';

const TODAY = route('GET /v1/today', today);
beforeEach(() => {
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.verify = async (t) => ({ a: 'usr_ta', b: 'usr_tb' } as Record<string, string>)[t] ?? null;
  headlinePort.get = () => null;
});
const get = (token: string) => TODAY(new Request('http://edge.test/v1/today', { headers: { Authorization: `Bearer ${token}` } }));
const raise = (user_id: string, kind: string, deadline?: string) =>
  store.raiseDecision({ user_id, kind, subject: crypto.randomUUID(), why: 'x', options: [{ id: 'opt_a', label: 'A' }], deadline }).row;

test('Today lists only the caller\'s open decisions, deadline sooner first, in the contract view', async () => {
  const later = raise('usr_ta', 'first_post', new Date(Date.now() + 5 * 86400_000).toISOString());
  const sooner = raise('usr_ta', 'accept_offer', new Date(Date.now() + 3600_000).toISOString());
  raise('usr_tb', 'accept_offer');
  const b = await (await get('a')).json();
  assert.deepEqual(b.decisions.map((d: { id: string }) => d.id), [sooner.id, later.id]);
  assert.equal(b.counts.open, 2); assert.equal(b.counts.due_today, 1);
  assert.equal(b.decisions[0].feed, 'now');
});

test('no headline unless the port gives one, and never a kept amount of zero', async () => {
  assert.ok(!('headline' in (await (await get('b')).json())));
  headlinePort.get = () => ({ kind: 'kept_since_last_open', value: { amount_cents: 0, currency: 'USD' }, label: 'Since yesterday', sub: '', citation_id: null });
  assert.ok(!('headline' in (await (await get('b')).json())));
  headlinePort.get = () => ({ kind: 'kept_since_last_open', value: { amount_cents: 9620, currency: 'USD' }, label: 'Since yesterday', sub: '2 sold, after fees', citation_id: 'ci_41x' });
  assert.equal((await (await get('b')).json()).headline.value.amount_cents, 9620);
});

test('last_open_at answers the previous open, then moves to now', async () => {
  const first = await (await get('b')).json();
  const second = await (await get('b')).json();
  assert.ok(second.last_open_at && (!first.last_open_at || second.last_open_at >= first.last_open_at));
});

test('no token is 401', async () => {
  assert.equal((await TODAY(new Request('http://edge.test/v1/today'))).status, 401);
});
