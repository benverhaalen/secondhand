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

test('last_open_at survives a new handler instance and a restarted process on the same SQLite file', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'today-restart-'));
  const code = `
    const { deps, route } = await import(${JSON.stringify(new URL('./http.ts', import.meta.url).href)});
    deps.verify = async () => 'usr_restart';
    const { today, headlinePort } = await import(${JSON.stringify(new URL('./today.ts?restart=1', import.meta.url).href)});
    const at = Date.now(); Date.now = () => at;
    let since; headlinePort.get = (_user, previous) => { since = previous; return null; };
    const response = await route('GET /v1/today', today)(new Request('http://edge.test/v1/today', { headers: { Authorization: 'Bearer test' } }));
    process.stdout.write(JSON.stringify({ status: response.status, body: await response.json(), since, at: new Date(at).toISOString() }));
  `;
  try {
    const run = () => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, NODE_ENV: 'development', SECONDHAND_DATA_DIR: dir }, encoding: 'utf8' }).trim().split('\n').at(-1)!);
    const first = run(), second = run();
    assert.equal(first.status, 200); assert.equal(first.body.last_open_at, null);
    assert.equal(second.status, 200); assert.equal(second.body.last_open_at, first.at); assert.equal(second.since, first.at);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
