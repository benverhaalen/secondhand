import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_CODES, HINT_DO, createHarness, fakeAdapter, fakeSite, fail, parseEnvelope, classifyRead, fakeManifest, needsSession,
  type Adapter, type Envelope, type ErrorCode } from './protocol.ts';
import { createLog } from '../../../../log/index.js';

const harness = createHarness({ adapters: fakeSite('depop'), timeoutMs: 50 });

for (const rejects of [false, true]) test(`caller abort reaches the adapter and settles even when it ${rejects ? 'rejects' : 'ignores cancellation'}`, async () => {
  const ctl = new AbortController(), began = Promise.withResolvers<AbortSignal>();
  let fallback = 0;
  const adapter: Adapter = { route_id: 'slow', manifest: fakeManifest('depop', 'search'), run(_args, signal) {
    began.resolve(signal);
    return new Promise((_resolve, reject) => {
      if (rejects) signal.addEventListener('abort', () => reject(new Error('private abort reason')));
    });
  } };
  const h = createHarness({ timeoutMs: 100, adapters: [adapter, { ...fakeAdapter('depop', 'search'), async run() {
    fallback++; return { ok: true, data: [] };
  } }] });
  const pending = h.call('depop', 'search', {}, { signal: ctl.signal });
  const received = await began.promise, start = performance.now();
  ctl.abort(new Error('private caller reason'));
  const result = await pending;
  assert.equal(received.aborted, true);
  assert.ok(performance.now() - start < 30, 'abort must settle without waiting for the harness deadline');
  assert.ok(!result.ok && result.error.code === 'rate_limited');
  assert.equal(result.error.message, 'the site did not answer in time');
  assert.equal(fallback, 0);
});

test('a pre-aborted call runs no adapter; cancelling a sent write stays outcome_unknown', async () => {
  let runs = 0;
  const adapter = fakeAdapter('depop', 'search');
  const h = createHarness({ adapters: [{ ...adapter, async run() { runs++; return { ok: true, data: [] }; } }] });
  const result = await h.call('depop', 'search', {}, { signal: AbortSignal.abort() });
  assert.ok(!result.ok && result.error.code === 'rate_limited');
  assert.equal(runs, 0);
  const ctl = new AbortController(), began = Promise.withResolvers<void>();
  const w = createHarness({ timeoutMs: 100, adapters: [{ ...fakeAdapter('depop', 'post'), run() {
    began.resolve(); return new Promise(() => {});
  } }] });
  const pending = w.call('depop', 'post', { operation_id: 'cancelled-write' }, { signal: ctl.signal });
  await began.promise; ctl.abort();
  const write = await pending;
  assert.ok(!write.ok && write.error.code === 'outcome_unknown');
});

// The scripted agent from §9: it branches on hint.do only, never on message.
function nextStep(e: Envelope): string {
  if (e.ok) return 'use_data';
  const h = e.error.hint;
  switch (h.do) {
    case 'relink': return 'raise_relink';
    case 'reconcile': return 'operation_id' in h ? 'reconcile_write' : 'mark_gone';
    case 'retry_after': return `wait_${h.after_s}`;
    case 'author': return 'next_route_and_author';
    case 'pause_session': return 'pause_and_warn';
    case 'raise_decision': return `decision_${h.kind}`;
    case 'handoff': return 'handoff_link';
  }
}

test('envelope contract: every code maps to its hint and the scripted agent takes the right step, 8 of 8', async () => {
  const want: Record<ErrorCode, string> = {
    auth_expired: 'raise_relink', not_found: 'mark_gone', rate_limited: 'wait_60', page_changed: 'next_route_and_author',
    blocked: 'pause_and_warn', policy_refused: 'decision_price_under_floor', outcome_unknown: 'reconcile_write', no_route: 'handoff_link',
  };
  let right = 0;
  for (const code of ERROR_CODES) {
    const verb = code === 'outcome_unknown' ? 'post' : 'search';
    const e = await harness.call('depop', verb, { fake: code, operation_id: 'op-1' });
    assert.equal(e.ok, false);
    if (e.ok) continue;
    assert.equal(e.error.code, code);
    assert.equal(e.error.hint.do, HINT_DO[code]);
    assert.equal(parseEnvelope(JSON.parse(JSON.stringify(e))).ok, false);
    if (nextStep(e) === want[code]) right++;
  }
  assert.equal(right, 8);
});

test('not_found carries searched[]', async () => {
  const e = await harness.call('depop', 'read_listings', { fake: 'not_found', id: 'L9' });
  assert.ok(!e.ok && e.error.code === 'not_found' && 'searched' in e.error.hint && e.error.hint.searched[0] === 'L9');
});

test('empty is not broken: ok [] is ok, never an error', async () => {
  const e = await harness.call('depop', 'search', { fake: 'empty' });
  assert.deepEqual(e.ok && e.data, []);
});

test('soft block: a challenge page is blocked, even with zero rows', async () => {
  const e = await harness.call('depop', 'search', { fake: 'soft_block' });
  assert.ok(!e.ok && e.error.code === 'blocked' && e.error.hint.do === 'pause_session');
});

test('a missing required field is page_changed with the field named', () => {
  const r = classifyRead({ challenge: false, rows: [{ id: 'a', title: 't' }] }, fakeManifest('depop', 'search'));
  assert.ok(!r.ok && r.error.code === 'page_changed' && 'missing' in r.error.hint && r.error.hint.missing.includes('price_cents'));
});

test('ok carries meta', async () => {
  const e = await harness.call('depop', 'read_listings');
  assert.ok(e.ok);
  assert.equal(e.meta.route_id, 'fake.depop.read_listings');
  assert.equal(e.meta.adapter_version, '1.0.0');
  assert.equal(e.meta.fell_back, false);
  assert.deepEqual(e.meta.observation_ids, ['obs-fake-1']);
  assert.equal(typeof e.meta.ms, 'number');
});

test('a write without operation_id is refused before any adapter runs', async () => {
  const e = await harness.call('depop', 'post', {});
  assert.ok(!e.ok && e.error.code === 'policy_refused');
});

test('a write that hangs is outcome_unknown, never replayed on another route', async () => {
  let runs = 0;
  const second = { ...fakeAdapter('depop', 'post'), route_id: 'second', run: async () => { runs++; return { ok: true as const, data: {} }; } };
  const h = createHarness({ adapters: [fakeAdapter('depop', 'post'), second], timeoutMs: 20 });
  const e = await h.call('depop', 'post', { fake: 'hang', operation_id: 'op-7' });
  assert.ok(!e.ok && e.error.code === 'outcome_unknown' && 'operation_id' in e.error.hint && e.error.hint.operation_id === 'op-7');
  assert.equal(runs, 0);
});

test('a read whose page changed falls to the next route with fell_back', async () => {
  const h = createHarness({ adapters: [fakeAdapter('depop', 'search'), { ...fakeAdapter('depop', 'search'), route_id: 'public' }] });
  const e = await h.call('depop', 'search', { fake: 'throw' });
  assert.equal(e.ok, false); // both are the same fake, so both throw
  const h2 = createHarness({ adapters: [fakeAdapter('depop', 'search'), { ...fakeAdapter('depop', 'search'), route_id: 'public', run: async () => ({ ok: true as const, data: [] }) }] });
  const e2 = await h2.call('depop', 'search', { fake: 'page_changed' });
  assert.ok(e2.ok && e2.meta.fell_back && e2.meta.route_id === 'public');
});

test('a read a route has no way to answer (no_route) moves on to the next route; alone, its handoff comes back unchanged', async () => {
  const served = { ...fakeAdapter('depop', 'search'), route_id: 'page', run: async () => ({ ok: true as const, data: [] }) };
  const e = await createHarness({ adapters: [fakeAdapter('depop', 'search'), served] }).call('depop', 'search', { fake: 'no_route' });
  assert.ok(e.ok && e.meta.fell_back && e.meta.route_id === 'page');
  const alone = fakeAdapter('depop', 'search');
  const direct = await alone.run({ fake: 'no_route' }, AbortSignal.timeout(1000));
  const e2 = await createHarness({ adapters: [alone] }).call('depop', 'search', { fake: 'no_route' });
  assert.ok(!e2.ok && !direct.ok && e2.error.code === 'no_route');
  assert.deepEqual(e2.error, direct.error);
  const changed = { ...fakeAdapter('depop', 'search'), route_id: 'page', run: async () => fail('page_changed', 'x', { do: 'author', missing: [] }) };
  const e3 = await createHarness({ adapters: [alone, changed] }).call('depop', 'search', { fake: 'no_route' });
  assert.ok(!e3.ok && e3.error.code === 'no_route' && e3.meta.route_id === alone.route_id); // the handoff, not the later page_changed
});

test('a blocked read does not fall back to another route', async () => {
  const h = createHarness({ adapters: [fakeAdapter('depop', 'search'), { ...fakeAdapter('depop', 'search'), route_id: 'public', run: async () => ({ ok: true as const, data: [] }) }] });
  const e = await h.call('depop', 'search', { fake: 'blocked' });
  assert.ok(!e.ok && e.error.code === 'blocked');
});

test('no adapter is no_route with a handoff url', async () => {
  const e = await createHarness({ adapters: [] }).call('mercari', 'read_offers');
  assert.ok(!e.ok && e.error.code === 'no_route' && 'url' in e.error.hint && e.error.hint.url.startsWith('https://'));
});

test('manifest carries needs_session per verb and per field', () => {
  const m = fakeManifest('depop', 'search');
  assert.equal(needsSession(m), false);
  assert.equal(needsSession(m, 'watchers'), true);
  assert.equal(needsSession(fakeManifest('depop', 'post')), true);
});

test('fail refuses a hint that does not fit its code', () => {
  assert.throws(() => fail('blocked', 'x', { do: 'relink', site: 'depop' } as never));
});

test('parseEnvelope refuses malformed results at the trust boundary', () => {
  const meta = { route_id: 'r', adapter_version: '1.0.0', ms: 1, fell_back: false, observation_ids: [] };
  assert.equal(parseEnvelope({ ok: true, data: [], meta }).ok, true);
  for (const bad of [null, {}, { ok: true, meta }, { ok: 'yes', data: 1, meta }, { ok: true, data: 1, meta: { ...meta, ms: '1' } },
    { ok: false, error: { code: 'nope', message: '', hint: {} }, meta }, { ok: false, error: { code: 'blocked', message: '', hint: { do: 'relink' } }, meta }])
    assert.ok('refused' in parseEnvelope(bad), JSON.stringify(bad));
});

test('a call logs through log/ with no args text', async () => {
  const lines: string[] = [];
  const sink = Object.assign((l: string) => { lines.push(l); }, { lines, text: () => lines.join('\n') });
  const h = createHarness({ adapters: fakeSite('depop'), log: createLog({ src: 'harness', build: 'test', sink }) });
  await h.call('depop', 'search', { query: 'secret-query-text' });
  assert.ok(sink.lines.length > 0);
  assert.ok(!sink.text().includes('secret-query-text'));
});


test("harness: one person's account id under another person is refused", async () => {
  const { memoryAccounts, memoryVault } = await import('../browser/auth.ts');
  const vault = memoryVault();
  await vault.put('fixture', { cookies: [], origins: [] });
  const accounts = memoryAccounts([{ account_id: 'owned', person_id: 'owner', site: 'depop', token_ref: 'fixture' }], vault);
  let runs = 0;
  const adapter = fakeAdapter('depop', 'read_listings');
  const h = createHarness({ accounts, adapters: [{ ...adapter, async run(args, signal) {
    runs++; return adapter.run(args, signal);
  } }] });
  for (const person_id of ['other', undefined, '', 42]) {
    const result = await h.call('depop', 'read_listings', { account_id: 'owned', person_id });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.equal(result.error.code, 'policy_refused');
      assert.deepEqual(result.error.hint, { do: 'raise_decision', kind: 'link_account' });
    }
    assert.equal(result.meta.route_id, 'none');
  }
  assert.equal(runs, 0, 'refused calls must never reach an adapter');
  assert.ok((await h.call('depop', 'read_listings', { account_id: 'owned', person_id: 'owner' })).ok,
    'the caller can still read their own linked account');
  assert.equal(runs, 1);
});
