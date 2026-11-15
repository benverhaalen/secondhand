import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeManifest } from './protocol.ts';
import type { Adapter, AdapterResult } from './protocol.ts';
import { gate, canary, promote, rollback, versionChange } from './release.ts';
import type { Fixture, FixtureAdapter, GatePorts } from './release.ts';

const fixture: Fixture = JSON.parse(readFileSync(new URL('./fixtures/search.json', import.meta.url), 'utf8'));
function adapter(version = '1.0.0', data: unknown = fixture.expected): FixtureAdapter {
  return { route_id: 'depop.search', manifest: fakeManifest('depop', 'search', { version }),
    async run() { return { ok: true, data }; }, async replay() { return { ok: true, data }; } };
}
const ports = (data: unknown = fixture.expected): GatePorts => ({ account: 'test',
  async liveRead() { return { ok: true, data }; }, async dryRun() { return []; } });

test('field gate: every named field present, typed and equal before release', async () => {
  assert.equal((await gate(adapter(), fixture, ports())).ok, true);
  for (const data of [[{ id: 'listing-1', title: 'Blue jacket', price_cents: 2500 }], [{ ...fixture.expected[0], price_cents: '2500' }], [], [{ ...fixture.expected[0], title: 'Red jacket' }]]) {
    const result = await gate(adapter('1.0.0', data), fixture, ports());
    assert.equal(result.ok, false); assert.match(result.failures.join(','), /fixture/);
    assert.throws(() => canary(adapter(), adapter('1.0.1', data), result, { now: () => 0, liveHealth: { successes: 99, failures: 1 } }), /gate/);
  }
  const badFixture = { ...fixture, expected: [{ id: 'listing-1' }] };
  assert.equal((await gate(adapter('1.0.0', badFixture.expected), badFixture, ports(badFixture.expected))).ok, false);
});

test('proofs: nightly mismatch, absent probes, forbidden dry run and write cleanup block release', async () => {
  assert.equal((await gate(adapter(), fixture)).ok, false);
  assert.equal((await gate(adapter(), fixture, ports([]))).ok, false);
  assert.equal((await gate(adapter(), fixture, { ...ports(), account: 'live' })).ok, false);
  assert.equal((await gate(adapter(), fixture, { ...ports(), dryRun: async () => [{ ref: 'buy', name: 'Buy now' }] })).ok, false);
  const write = adapter(); write.manifest = fakeManifest('depop', 'post', { controls: ['submit'] });
  assert.equal((await gate(write, fixture, ports())).ok, false);
  assert.equal((await gate(write, fixture, { ...ports(), roundTrip: async () => ({ result: { ok: true, data: fixture.expected }, cleaned: false }) })).ok, false);
  assert.equal((await gate(write, fixture, { ...ports(), roundTrip: async () => ({ result: { ok: true, data: fixture.expected }, cleaned: true }) })).ok, true);
});

test('rollback: canary error rate rises, previous passing semver remains live', async () => {
  let time = 0;
  const old = adapter(), next = adapter('1.0.1'), proof = await gate(next, fixture, ports());
  const release = canary(old, next, proof, { now: () => time, liveHealth: { successes: 999, failures: 1 } });
  assert.equal(release.serves(0.049), next); assert.equal(release.serves(0.05), old);
  assert.equal(promote(release).state, 'candidate');
  for (let i = 0; i < 20; i++) release.record(i < 10);
  const decision = promote(release); assert.equal(decision.state, 'rolled_back'); assert.equal(decision.adapter.manifest.version, '1.0.0');
  assert.equal(rollback([adapter('1.2.0'), adapter('1.10.0'), adapter('2.0.0')], '2.0.0').manifest.version, '1.10.0');
  const passing = canary(old, next, proof, { now: () => time, liveHealth: { successes: 9, failures: 1 } });
  for (let i = 0; i < 20; i++) passing.record(true);
  assert.equal(promote(passing).state, 'live');
  const timed = canary(old, next, proof, { now: () => time, liveHealth: { successes: 9, failures: 1 } });
  timed.record(true); time = 3_600_000; assert.equal(promote(timed).state, 'live');
});

test('semver: schema major, endpoint minor, selector patch; reject same or wrong versions', async () => {
  const old = adapter(), next = adapter('1.0.1');
  assert.equal(versionChange(old.manifest, next.manifest), 'patch');
  next.manifest.route_kind = 'page'; assert.equal(versionChange(old.manifest, next.manifest), 'minor');
  assert.equal((await gate(next, fixture, ports(), old.manifest)).ok, false);
  next.manifest.version = '1.1.0'; assert.equal((await gate(next, fixture, ports(), old.manifest)).ok, true);
  next.manifest.output_schema = { ...next.manifest.output_schema, watchers: 'number' };
  assert.equal(versionChange(old.manifest, next.manifest), 'major');
  assert.equal((await gate(next, fixture, ports(), old.manifest)).ok, false);
  next.manifest.version = '2.0.0'; assert.equal((await gate(next, fixture, ports(), old.manifest)).ok, true);
  next.manifest.version = 'bad'; assert.equal((await gate(next, fixture, ports())).ok, false);
});

test('gate: thrown adapter names cause, failed receipt cannot promote another adapter', async () => {
  const next = adapter('1.0.1'); next.replay = async () => { throw new Error('capture unreadable'); };
  assert.match((await gate(next, fixture, ports())).failures.join(','), /fixture.*capture unreadable/);
  const good = adapter('1.0.1'), proof = await gate(good, fixture, ports());
  assert.throws(() => canary(adapter(), adapter('1.0.2'), proof, { now: () => 0, liveHealth: { successes: 9, failures: 1 } }), /gate/);
});

test('gate receipt: adapter implementation changed after proof is refused', async () => {
  const candidate = adapter('1.0.1'), proof = await gate(candidate, fixture, ports());
  candidate.run = async () => ({ ok: true, data: [] });
  assert.throws(() => canary(adapter(), candidate, proof, { now: () => 0, liveHealth: { successes: 9, failures: 1 } }), /gate/);
});

test('proofs: live session probes never interleave, while offline replay may overlap', async () => {
  const a = adapter(); a.manifest.verb = 'post'; let active = 0;
  const probe = async <T>(value: T) => { assert.equal(active++, 0, 'one leased test session'); await Promise.resolve(); active--; return value; };
  const result = await gate(a, fixture, { account: 'test',
    liveRead: () => probe({ ok: true as const, data: fixture.expected }),
    dryRun: () => probe([]), roundTrip: () => probe({ result: { ok: true as const, data: fixture.expected }, cleaned: true }),
  });
  assert.equal(result.ok, true, result.failures.join(','));
});

test('semver: structural failure refuses execution before any external proof', async () => {
  const calls: string[] = [], a = adapter('bad');
  a.replay = async () => { calls.push('replay'); return { ok: true, data: fixture.expected }; };
  const result = await gate(a, fixture, { ...ports(), liveRead: async () => { calls.push('live'); return { ok: true, data: fixture.expected }; } });
  assert.equal(result.ok, false); assert.deepEqual(calls, []);
});
