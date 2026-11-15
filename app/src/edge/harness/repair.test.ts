import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeManifest, fail } from './protocol.ts';
import type { Envelope } from './protocol.ts';
import type { Fixture, GatePorts } from './release.ts';
import { shouldRepair, checkEmpty, repair, createCaptureAdapter, valueAnchoredAuthor, mutationDrill } from './repair.ts';
import type { Capture, Sources } from './repair.ts';

const fixture: Fixture<Capture> = JSON.parse(readFileSync(new URL('./fixtures/search.json', import.meta.url), 'utf8'));
const sources: Sources = { id: [[{ kind: 'embedded', path: ['listing', 'id'] }]], title: [[{ kind: 'dom', ref: '.title' }]], price_cents: [[{ kind: 'embedded', path: ['listing', 'price_cents'] }]], watchers: [[{ kind: 'network', url: 'https://example.test/api/stats', path: ['body', 'watchers'] }]] };
const make = () => createCaptureAdapter(fakeManifest('depop', 'search'), fixture.capture, sources);
const ports: GatePorts = { account: 'test', liveRead: async () => ({ ok: true, data: fixture.expected }), dryRun: async () => [] };
const meta = { route_id: 'depop.search', adapter_version: '1.0.0', ms: 1, fell_back: false, observation_ids: [] };

test('empty is not broken: ok [] never repairs; challenge and access failures pause', async () => {
  assert.equal(shouldRepair({ ok: true, data: [], meta }), false);
  for (const r of [fail('auth_expired', '', { do: 'relink', site: 'depop' }), fail('blocked', '', { do: 'pause_session', site: 'depop' }), fail('rate_limited', '', { do: 'retry_after', after_s: 3 })]) {
    assert.equal(shouldRepair({ ...r, meta }, { nightlyFailed: true }), false);
  }
  assert.equal(shouldRepair({ ...fail('page_changed', '', { do: 'author', missing: ['title'] }), meta }), true);
  assert.equal(shouldRepair({ ...fail('no_route', '', { do: 'handoff', url: '' }), meta }), true);
  assert.equal(shouldRepair({ ok: true, data: [1], meta }, { belowGuardProbability: 0.96 }), true);
  assert.equal(shouldRepair({ ok: true, data: [1], meta }, { completeness: 0.8, calls: 49 }), false);
  assert.equal(shouldRepair({ ok: true, data: [1], meta }, { completeness: 0.8, calls: 50 }), true);
  const empty: Envelope<unknown[]> = { ok: true, data: [], meta };
  const seen: string[] = [];
  const probes = { secondInput: async () => empty, fetch: async () => empty, retry: async () => empty, wait: async (ms: number) => { seen.push(String(ms)); } };
  assert.equal(await checkEmpty(empty, probes), 'empty'); assert.deepEqual(seen, ['3000']);
  assert.equal(await checkEmpty(empty, { ...probes, fetch: async () => ({ ok: true, data: [{}], meta }) }), 'repair');
  assert.equal(await checkEmpty(empty, { ...probes, fetch: async () => ({ ...fail('blocked', '', { do: 'pause_session', site: 'depop' }), meta }) }), 'blocked');
});

test('mutation drill: untouched fixture, ten independent breaks repaired within three rounds', async t => {
  const before = JSON.stringify(fixture), result = await mutationDrill(make(), fixture, ports);
  assert.equal(result.cases.length, 10);
  for (const c of result.cases) { t.diagnostic(`${c.name}: ${c.ok ? 'repaired' : c.reason} in ${c.rounds} rounds`); assert.ok(c.wasBroken, `${c.name}: mutation must break original recipe`); assert.ok(c.rounds <= 3); }
  assert.ok(result.passed >= 8, `${result.passed}/10 repaired`);
  assert.equal(result.ok, true); assert.equal(JSON.stringify(fixture), before);
});

test('ambiguous anchors: refuse duplicate value rather than choosing a wrong selector', async () => {
  const capture = structuredClone(fixture.capture); capture.dom = [{ ref: '.a', text: 'Blue jacket' }, { ref: '.b', text: 'Blue jacket' }];
  const result = await repair(make(), fixture, capture, valueAnchoredAuthor, 3, { gate: ports });
  assert.equal(result.ok, false); assert.match(result.reason ?? '', /ambiguous.*title/);
});

test('three rounds: failed candidate never passes by editing fixture or omitting full gate', async () => {
  let called = 0;
  const capture = structuredClone(fixture.capture); capture.dom = [];
  const result = await repair(make(), fixture, capture, async () => { called++; return make(); }, 9, { gate: ports });
  assert.equal(called, 3); assert.equal(result.ok, false); assert.equal(result.rounds, 3);
  const missingGate = await repair(make(), fixture, fixture.capture, valueAnchoredAuthor);
  assert.equal(missingGate.ok, false); assert.match(missingGate.reason ?? '', /live|proof/);
});

test('deadline: hanging author is aborted, no candidate later than thirty minutes', async () => {
  let signal: AbortSignal | undefined;
  const result = await repair(make(), fixture, fixture.capture, async input => { signal = input.signal; return new Promise(() => {}); }, 3, { gate: ports, deadlineMs: 5, now: () => 0 });
  assert.equal(result.ok, false); assert.match(result.reason ?? '', /deadline/); assert.equal(signal?.aborted, true);
});

test('repair never replays writes; external author cannot mutate fixture', async () => {
  const a = make(); a.manifest.verb = 'post'; let called = false;
  assert.equal((await repair(a, fixture, fixture.capture, async () => { called = true; return a; }, 3, { gate: ports })).ok, false);
  assert.equal(called, false);
  const original = JSON.stringify(fixture);
  await repair(make(), fixture, fixture.capture, async input => { input.fixture.expected[0].title = 'Wrong'; return make(); }, 3, { gate: ports });
  assert.equal(JSON.stringify(fixture), original);
});


test('author boundary: changed verb is refused before candidate execution or live probes', async () => {
  const calls: string[] = [];
  const result = await repair(make(), fixture, fixture.capture, async () => {
    const candidate = make(); candidate.manifest.verb = 'post'; candidate.manifest.version = '1.0.1';
    candidate.replay = async () => { calls.push('write replay'); return { ok: true, data: fixture.expected }; };
    return candidate;
  }, 1, { gate: { account: 'test', liveRead: async () => { calls.push('live'); return { ok: true, data: fixture.expected }; }, dryRun: async () => [], roundTrip: async () => { calls.push('roundTrip'); return { result: { ok: true, data: fixture.expected }, cleaned: true }; } } });
  assert.equal(result.ok, false); assert.deepEqual(calls, []);
});

