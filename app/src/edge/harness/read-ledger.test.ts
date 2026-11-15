import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { memoryStore } from '../../engines/param/param.ts';
import { fail, type Envelope } from './protocol.ts';
import { classOf, createReadLedger, type ReadClass } from './read-ledger.ts';

const meta = { route_id: 'planted', adapter_version: '1.0.0', ms: 7, fell_back: false, observation_ids: [] };
const cases: [string, ReadClass, Envelope][] = [
  ['a row is lost as empty', 'answered', { ok: true, data: [{ id: 'one' }], meta }],
  ['a single-object read is lost as empty', 'answered', { ok: true, data: { id: 'one' }, meta }],
  ['zero rows are called broken', 'empty', { ok: true, data: [], meta }],
  ['not_found is called broken', 'empty', { ...fail('not_found', 'absent', { do: 'reconcile', searched: [] }), meta }],
  ['an HTTP refusal is mistaken for a challenge', 'refused', { ...fail('blocked', '/search answered 403', { do: 'pause_session', site: 'depop' }), meta }],
  ['an HTTP server refusal is missed', 'refused', { ...fail('blocked', 'HTTP 503', { do: 'pause_session', site: 'depop' }), meta }],
  ['a query containing captcha changes an HTTP refusal class', 'refused', { ...fail('blocked', '/api/search?q=captcha answered 403', { do: 'pause_session', site: 'depop' }), meta }],
  ['a URL containing challenge changes an HTTP refusal class', 'refused', { ...fail('blocked', 'https://site.test/search?q=challenge answered 403', { do: 'pause_session', site: 'depop' }), meta }],
  ['a query containing robot changes an HTTP refusal class', 'refused', { ...fail('blocked', '/api/search?q=robot answered 503', { do: 'pause_session', site: 'depop' }), meta }],
  ['a rate limit is missed', 'refused', { ...fail('rate_limited', 'slow down', { do: 'retry_after', after_s: 60 }), meta }],
  ['a challenge is mistaken for a refusal', 'challenged', { ...fail('blocked', 'HTTP 403: bot check', { do: 'pause_session', site: 'depop' }), meta }],
  ['a sign-in wall is missed', 'challenged', { ...fail('blocked', 'sign-in wall', { do: 'pause_session', site: 'depop' }), meta }],
  ['an ambiguous block is called a refusal', 'challenged', { ...fail('blocked', 'blocked', { do: 'pause_session', site: 'depop' }), meta }],
  ['a missing field is called empty', 'shape_changed', { ...fail('page_changed', 'missing price', { do: 'author', missing: ['price'] }), meta }],
  ['a missing timeout field is counted as a deadline', 'shape_changed', { ...fail('page_changed', 'missing timeout_ms', { do: 'author', missing: ['timeout_ms'] }), meta }],
  ['a harness timeout is called a refusal', 'timed_out', { ...fail('rate_limited', 'the site did not answer in time', { do: 'retry_after', after_s: 30 }), meta }],
  ['a deadline abort is called a shape change', 'timed_out', { ...fail('page_changed', 'adapter threw: aborted by deadline', { do: 'author', missing: [] }), meta }],
  ['an unrelated failure disappears', 'failed', { ...fail('auth_expired', 'relink', { do: 'relink', site: 'depop' }), meta }],
];
for (const [name, cls, envelope] of cases) test(name, () => assert.equal(classOf(envelope), cls));

function rig(at = Date.parse('2026-11-15T23:59:59Z')) {
  let time = at;
  const sink = memorySink(), params = memoryStore();
  const log = createLog({ src: 'read-ledger.test', build: 'test', sink });
  const ledger = createReadLedger({ now: () => time, log, params });
  return { ledger, params, sink, log, set: (t: number) => { time = t; } };
}

test('counts mix sites or fail to roll at UTC midnight', () => {
  const r = rig();
  r.ledger.record('depop', 'search', 'answered', 7);
  r.ledger.record('ebay', 'search', 'empty', 8);
  assert.equal(r.ledger.counts().length, 2);
  assert.equal(r.ledger.counts('depop')[0].classes.answered, 1);
  const snapshot = r.ledger.counts('depop')[0];
  snapshot.classes.answered = 100;
  assert.equal(r.ledger.counts('depop')[0].classes.answered, 1);
  r.set(Date.parse('2026-11-16T00:00:00Z'));
  assert.equal(r.ledger.counts('depop')[0].day, '2026-11-16');
  assert.equal(r.ledger.counts('depop')[0].classes.answered, 0);
  r.ledger.record('depop', 'read_listings', 'empty', 9);
  assert.equal(r.ledger.counts('depop')[0].classes.empty, 1);
});

test('the ledger forgets a retained site early or keeps it beyond seven UTC days', () => {
  const r = rig(Date.parse('2026-11-01T00:00:00Z'));
  r.ledger.record('depop', 'search', 'empty', 1);
  r.set(Date.parse('2026-11-07T23:59:59Z'));
  assert.equal(r.ledger.counts('depop').length, 1);
  r.set(Date.parse('2026-11-08T00:00:00Z'));
  assert.deepEqual(r.ledger.counts(), []);
});

test('refusals fail to double during and just after a pause or exceed the cap', () => {
  const r = rig(0);
  assert.equal(r.params.read('search_backoff_ms', {}).value, 900_000);
  assert.equal(r.params.read('search_backoff_max_ms', {}).value, 14_400_000);
  for (let i = 0; i < 7; i++) {
    r.set(i);
    r.ledger.record('depop', 'search', i % 2 ? 'refused' : 'challenged', 1);
    assert.equal(r.ledger.paused('depop')?.until_ms, i + Math.min(900_000 * 2 ** i, 14_400_000));
  }
  const until = r.ledger.paused('depop')!.until_ms;
  r.set(until + 1);
  assert.equal(r.ledger.paused('depop'), undefined);
  r.ledger.record('depop', 'search', 'refused', 1);
  assert.equal(r.ledger.paused('depop')?.until_ms, until + 1 + 14_400_000);
  assert.equal(r.ledger.paused('ebay'), undefined);
});

for (const cls of ['answered', 'empty'] as const) test(`${cls} after expiry fails to reset the next pause`, () => {
  const r = rig(0);
  r.ledger.record('depop', 'search', 'challenged', 1);
  r.set(1);
  r.ledger.record('depop', 'search', 'refused', 1);
  r.set(1_800_001);
  r.ledger.record('depop', 'search', cls, 1);
  r.ledger.record('depop', 'search', 'refused', 1);
  assert.equal(r.ledger.paused('depop')?.until_ms, 2_700_001);
});

test('a clean in-flight read erases an active pause', () => {
  const r = rig(0);
  r.ledger.record('depop', 'search', 'refused', 1);
  r.ledger.record('depop', 'search', 'answered', 1);
  assert.equal(r.ledger.paused('depop')?.until_ms, 900_000);
});

test('a refusal outside the recovery period incorrectly doubles', () => {
  const r = rig(0);
  r.ledger.record('depop', 'search', 'refused', 1);
  r.set(1_800_001);
  r.ledger.record('depop', 'search', 'refused', 1);
  assert.equal(r.ledger.paused('depop')?.until_ms, 2_700_001);
});

test('pause transitions are missing or expiry is logged more than once', () => {
  const r = rig(0);
  r.ledger.record('depop', 'search', 'challenged', 3);
  r.set(900_000);
  r.ledger.paused('depop'); r.ledger.paused('depop');
  const changes = r.sink.lines.map(line => JSON.parse(line)).filter(e => e.event === 'state.change');
  assert.deepEqual(changes.map(e => e.to), ['paused', 'ready']);
});

test('counted lines leak arguments or fail to contain exactly one event per read', () => {
  const r = rig(0);
  r.ledger.record('depop', 'search', 'answered', 7);
  r.ledger.record('depop', 'search', 'refused', 8);
  const entries = r.sink.lines.map(line => JSON.parse(line));
  const reads = entries.filter(e => e.event === 'note' && e.msg === 'site read');
  assert.equal(reads.length, 2);
  for (const e of reads) {
    assert.deepEqual(Object.keys(e).filter(k => !['ts', 'session', 'seq', 'src', 'level', 'event', 'msg'].includes(k)).sort(), ['class', 'ms', 'site', 'verb']);
  }
});

test('back-off ignores the declared site-scoped param values', () => {
  const r = rig(0);
  for (const [name, value] of [['search_backoff_ms', 1000], ['search_backoff_max_ms', 2500]] as const) {
    const row = r.params.propose({ name, scope: { site: 'depop' }, family: 'scalar', value_or_hyperparams: value,
      prior: value, fitted_on_ids_hash: null, n_eff: 1, metric: null, held_out_score: 1, guard_lo: 1, guard_hi: null }, 0);
    r.params.promote(name, { site: 'depop' }, row.version, 0, new Date(0).toISOString());
  }
  r.ledger.record('depop', 'search', 'refused', 1);
  assert.equal(r.ledger.paused('depop')?.until_ms, 1000);
  r.ledger.record('depop', 'search', 'refused', 1);
  assert.equal(r.ledger.paused('depop')?.until_ms, 2000);
  r.ledger.record('depop', 'search', 'refused', 1);
  assert.equal(r.ledger.paused('depop')?.until_ms, 2500);
});
