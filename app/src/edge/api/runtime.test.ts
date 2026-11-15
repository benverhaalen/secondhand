import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runtime, createRuntime } from './runtime.ts';
import { memoryStore } from '../events/ports.ts';
import { createLog, memorySink } from '../../../../log/index.js';

process.env.SECONDHAND_LIVE_SITES = '';

const log = () => createLog({ src: 'test', build: 'test', sink: memorySink() });
test('runtime shares the route Store and never links a row without vault state', async () => {
  const { store } = await import('./store.ts');
  assert.equal(runtime.store, store);
  const r = createRuntime(memoryStore(), log());
  assert.equal(await r.accounts.byId('acc_dp1'), undefined);
  const a = r.store.get('account', 'usr_8f2k', 'acc_dp1')!;
  r.store.put('account', { ...a, token_ref: 'test/session' });
  assert.equal(await r.accounts.byId(a.id), undefined);
  await r.vault.put('test/session', { cookies: [], origins: [] });
  assert.equal((await r.accounts.byId(a.id))?.account_id, a.id);
  await r.vault.delete('test/session');
  assert.equal(await r.accounts.byId(a.id), undefined);
});

test('unlinked account is policy_refused before any adapter runs; offline reads are no_route', async () => {
  const r = createRuntime(memoryStore(), log());
  const reply = await r.harness.call('depop', 'read_listings', { account_id: 'acc_dp1', shop_id: 'test' });
  assert.equal(reply.ok, false);
  if (!reply.ok) { assert.equal(reply.error.code, 'policy_refused'); assert.equal(reply.meta.route_id, 'none'); }
  const read = await r.harness.call('depop', 'search', { q: 'test' });
  assert.equal(read.ok, false);
  if (!read.ok) assert.equal(read.error.code, 'no_route');
});

test('pipeline Depop write returns a dry plan and current limits override stale job arguments', async () => {
  const r = createRuntime(memoryStore(), log());
  const account = r.store.get('account', 'usr_8f2k', 'acc_dp1')!;
  r.store.put('account', { ...account, token_ref: 'test/session' });
  await r.vault.put('test/session', { cookies: [], origins: [] });
  const enqueue = (key: string, price: number) => {
    const event = r.store.insertEvent({ user_id: 'usr_8f2k', source: 'app', action: 'app.reprice', actor: 'auto', site: 'depop', account_id: 'acc_dp1', item_id: 'it_7c2m', dedupe_key: key, observed_at: new Date().toISOString(), effective_at: new Date().toISOString(), trace_id: key }).row;
    return r.store.insertJob({ user_id: event.user_id, event_id: event.id, kind: 'post', state: 'queued', site: 'depop', account_id: 'acc_dp1', item_id: 'it_7c2m', idempotency_key: key, args: { slug: 'test-listing', listing: { price_amount: price / 100 }, price_cents: price, floor_cents: 1 }, stages: [], attempts: 0, trace_id: key, created_at: event.observed_at }).row;
  };
  const first = enqueue('dry-write', 8000);
  await r.pipeline.runOnce(1);
  assert.equal(r.store.getJob(first.id)?.state, 'done');
  assert.equal((r.store.getJob(first.id)?.result as { dry: boolean }).dry, true);
  const second = enqueue('new-floor', 8000);
  const limits = r.store.get('limits', 'usr_8f2k', 'it_7c2m')!;
  r.store.put('limits', { ...limits, floor_cents: { amount_cents: 8500, currency: 'USD' } });
  await r.pipeline.runOnce(1);
  assert.ok((r.store.getJob(second.id)?.result as { refused: string }).refused);
  assert.ok(!r.store.getJob(second.id)?.stages.some(s => s.name === 'revise'));
});

test('limits and rules survive a child-process restart without example reseeding overwriting them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-runtime-'));
  const prelude = `
    import assert from 'node:assert/strict';
    import { runtime } from './app/src/edge/api/runtime.ts';
    import { handlers } from './app/src/edge/api/rules.ts';
    import { deps, route } from './app/src/edge/api/http.ts';
    import { createLog, memorySink } from './log/index.js';
    deps.verify = async () => 'usr_8f2k';
    deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
    const call = async (endpoint, body) => {
      const [method, path] = endpoint.split(' ');
      const res = await route(endpoint, handlers[endpoint])(new Request('http://test'+path, { method, headers: { Authorization: 'Bearer test' }, ...(body ? { body: JSON.stringify(body) } : {}) }));
      assert.ok(res.status < 300, await res.clone().text());
      return res.json();
    };
  `;
  const run = (source: string) => {
    const child = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', prelude + source], { cwd: process.cwd(), env: { ...process.env, SECONDHAND_DATA_DIR: dir, SECONDHAND_LIVE_SITES: '' }, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr + child.stdout);
  };
  try {
    run(`const before = await call('GET /v1/limits'); await call('PUT /v1/limits', { version: before.version, ask_every_time: true, items: [{ item_id: 'it_7c2m', floor_cents: { amount_cents: 8100, currency: 'USD' } }] }); const rule = await call('POST /v1/rules', { kind: 'reply_other', scope: 'all' }); assert.equal(rule.kind, 'reply_other');`);
    run(`const limits = await call('GET /v1/limits'); assert.equal(limits.ask_every_time, true); assert.equal(limits.items[0].floor_cents.amount_cents, 8100); const rules = await call('GET /v1/rules'); assert.ok(rules.data.some(r => r.kind === 'reply_other')); assert.equal(runtime.store.rows('item', { user_id: 'usr_8f2k' }).filter(r => r.id === 'it_7c2m').length, 1);`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('current thresholds, rule conditions and ask_all refuse queued automatic acceptance', async () => {
  for (const [threshold, mode, rule] of [[null, 'auto', false], [{ amount_cents: 7500, currency: 'USD' }, 'ask_all', false], [null, 'auto', true]] as const) {
    const r = createRuntime(memoryStore(), log());
    const account = r.store.get('account', 'usr_8f2k', 'acc_dp1')!;
    r.store.put('account', { ...account, token_ref: 'test/session' });
    await r.vault.put('test/session', { cookies: [], origins: [] });
    const limits = r.store.get('limits', 'usr_8f2k', 'it_7c2m')!;
    r.store.put('limits', { ...limits, always_accept_cents: threshold, accept_mode: mode });
    if (rule) r.store.put('rule', { id: 'ru_accept', user_id: 'usr_8f2k', kind: 'accept_offer', scope: 'it_7c2m', state: 'auto', limits: { always_accept_cents: { amount_cents: 9000, currency: 'USD' } } });
    const job = r.store.insertJob({ kind: 'answer_offer', user_id: 'usr_8f2k', site: 'depop', account_id: 'acc_dp1', item_id: 'it_7c2m', event_id: 'test', idempotency_key: mode, args: { decision_kind: 'accept_offer', response: 'accept', offer_id: 'test-offer', price_cents: 8000, always_accept_cents: 7500 }, state: 'queued', stages: [], attempts: 0, trace_id: 'test', created_at: new Date().toISOString() }).row;
    await r.pipeline.runOnce(1);
    assert.ok((r.store.getJob(job.id)?.result as { refused: string }).refused, mode);
    assert.equal(r.store.getJob(job.id)?.stages.length, 0, mode);
  }
});

test('turning markdown off refuses an automatic reprice that was already queued', async () => {
  const r = createRuntime(memoryStore(), log());
  const limits = r.store.get('limits', 'usr_8f2k', 'it_7c2m')!;
  r.store.put('limits', { ...limits, markdown_on: false });
  const event = r.store.insertEvent({ user_id: 'usr_8f2k', source: 'app', action: 'app.reprice', actor: 'auto', site: 'depop', account_id: 'acc_dp1', item_id: 'it_7c2m', dedupe_key: 'no-markdown', observed_at: new Date().toISOString(), effective_at: new Date().toISOString(), trace_id: 'test' }).row;
  const job = r.store.insertJob({ kind: 'post', user_id: event.user_id, event_id: event.id, idempotency_key: event.dedupe_key, account_id: event.account_id, item_id: event.item_id, site: 'depop', state: 'queued', args: { price_cents: 8000, slug: 'test', listing: { price_amount: 80 } }, stages: [], attempts: 0, trace_id: 'test', created_at: event.observed_at }).row;
  await r.pipeline.runOnce(1);
  assert.equal(r.store.getJob(job.id)?.stages.length, 0);
  const refusal = (r.store.getJob(job.id)?.result as { refused: string }).refused;
  assert.equal(r.store.decisions({ user_id: 'usr_8f2k' }).find(row => row.id === refusal)?.kind, 'markdown');
});

test('runtime harness logs conform to the shared log contract', async () => {
  const sink = memorySink();
  const logger = createLog({ src: 'test.runtime', build: 'test', sink });
  const r = createRuntime(memoryStore(), logger);
  await r.harness.call('depop', 'search', { q: 'test' });
  logger.end();
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-runtime-log-'));
  try {
    const file = join(dir, 'proof.jsonl');
    writeFileSync(file, sink.text());
    const result = spawnSync(process.execPath, ['spec/log.mjs', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
