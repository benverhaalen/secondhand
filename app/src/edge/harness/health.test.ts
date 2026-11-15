import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../../engines/param/param.ts';
import { fakeManifest, type Manifest } from './protocol.ts';
import { createRouter, ROUTE_PARAMS, type Route } from './health.ts';

const pub = (id: string, over: Partial<Manifest> = {}): Route => ({ route_id: id, manifest: fakeManifest('depop', 'read_listings', { session: 'public', ...over }) });
const signed = (id: string, over: Partial<Manifest> = {}): Route => ({ route_id: id, manifest: fakeManifest('depop', 'read_listings', { session: 'signed_in', ...over }) });
const setup = (rand = () => 0.99) => {
  let t = 0;
  const store = memoryStore();
  const r = createRouter({ store, now: () => t, rand });
  return { r, store, tick: (ms: number) => { t += ms; }, now: () => t };
};
const ids = (o: { order: Route[] }) => o.order.map(x => x.route_id);

test('health.test.ts: an untouched pair keeps the given order and the top stays top while healthy', () => {
  const s = setup(), routes = [pub('a'), pub('b')];
  for (let i = 0; i < 100; i++) {
    assert.equal(s.r.rank('depop', 'read_listings', routes, ['id']).order[0].route_id, 'a');
    s.r.record('depop', 'read_listings', 'a', { ok: true, complete: 1, ms: 50 });
    s.tick(1000);
  }
});

test('health.test.ts: demotion within 20 calls under 30% injected failures, stays demoted', () => {
  const s = setup(), routes = [pub('a'), pub('b')];
  let demotedAt = -1;
  for (let i = 0; i < 40; i++) {
    const top = s.r.rank('depop', 'read_listings', routes, ['id']).order[0].route_id;
    if (top !== 'a' && demotedAt < 0) demotedAt = i;
    if (top === 'a') s.r.record('depop', 'read_listings', 'a', { ok: i % 10 > 2, complete: 1, ms: 50 }); // 3 in 10 fail
    s.tick(1000);
  }
  assert.ok(demotedAt >= 0 && demotedAt <= 20, `demoted at ${demotedAt}`);
});

test('health.test.ts: recovery within 1 h on an injected clock once the failures stop', () => {
  const s = setup(), routes = [pub('a'), pub('b')];
  for (let i = 0; i < 20; i++) { s.r.record('depop', 'read_listings', 'a', { ok: i % 10 > 2, complete: 1, ms: 50 }); s.tick(1000); }
  assert.equal(ids(s.r.rank('depop', 'read_listings', routes, ['id']))[0], 'b');
  const start = s.now();
  let back = -1;
  while (s.now() - start <= 3_600_000) {
    const o = s.r.rank('depop', 'read_listings', routes, ['id']);
    if (o.order[0].route_id === 'a' && o.probe !== 'a') { back = s.now() - start; break; }
    if (o.probe === 'a') s.r.record('depop', 'read_listings', 'a', { ok: true, complete: 1, ms: 50 }); // the route probe
    s.tick(60_000);
  }
  assert.ok(back >= 0 && back <= 3_600_000, `recovered at ${back}`);
});

test('health.test.ts: needs_session respected', () => {
  const s = setup(), fields = ['id', 'watchers'];
  const fastPublic = pub('pub', { fields: fakeManifest('depop', 'read_listings').fields.map(f => ({ ...f, needs_session: false })) });
  const slowSigned = signed('in');
  // make the public route look perfect and the signed-in one poor
  for (let i = 0; i < 30; i++) { s.r.record('depop', 'read_listings', 'pub', { ok: true, complete: 1, ms: 5 }); s.r.record('depop', 'read_listings', 'in', { ok: i % 2 === 0, complete: 1, ms: 900 }); }
  for (const rand of [0, 0.01, 0.99]) {
    const r2 = createRouter({ store: s.store, now: s.now, rand: () => rand });
    const o = r2.rank('depop', 'read_listings', [fastPublic, slowSigned], fields);
    assert.deepEqual(ids(o), ['in'], 'the public route is not even a candidate');
  }
});

test('health.test.ts: exploration is capped by the declared share and never on a write', () => {
  const routes = [pub('a'), pub('b')];
  const share = setup(() => 0.04).r.rank('depop', 'read_listings', routes, ['id']);
  assert.equal(share.order[0].route_id, 'b');            // rand below the share (prior 0.05): explore
  assert.equal(share.explored, 'b');
  assert.equal(setup(() => 0.06).r.rank('depop', 'read_listings', routes, ['id']).order[0].route_id, 'a');
  const w = setup(() => 0).r.rank('depop', 'post', [signed('a'), signed('b')], ['id']);
  assert.equal(w.order[0].route_id, 'a');                 // a write never explores
  assert.equal(ROUTE_PARAMS.explore_share, 'route_explore_share');
});

test('health.test.ts: success, completeness and cost are param rows', () => {
  const s = setup(), routes = [pub('a')];
  s.r.record('depop', 'read_listings', 'a', { ok: true, complete: 0.5, ms: 40 });
  const scope = { site: 'depop', segment: 'read_listings.a' };
  assert.equal(s.store.rows(ROUTE_PARAMS.success, scope).length, 1);
  assert.equal(s.store.rows(ROUTE_PARAMS.completeness, scope).length, 1);
  assert.equal(s.store.read(ROUTE_PARAMS.cost, scope).from, 'prior');
  assert.ok(s.r.health('depop', 'read_listings', 'a').completeness < s.r.health('depop', 'read_listings', 'a').success);
  void routes;
});

test('health.test.ts: three straight failures open the breaker until the probe is due', () => {
  const s = setup(), routes = [pub('a'), pub('b')];
  for (let i = 0; i < 3; i++) s.r.record('depop', 'read_listings', 'a', { ok: false, complete: 0, ms: 10 });
  assert.equal(s.r.rank('depop', 'read_listings', routes, ['id']).order[0].route_id, 'b');
});

test('health.test.ts: failover adds under 1 s and a write never switches route', async () => {
  const s = setup(), routes = [pub('a'), pub('b')];
  const seen: string[] = [];
  const t0 = performance.now();
  const out = await s.r.call('depop', 'read_listings', routes, ['id'], async (r) => {
    seen.push(r.route_id);
    return r.route_id === 'a' ? { ok: false as const, code: 'blocked' as const } : { ok: true as const, complete: 1 };
  });
  assert.ok(performance.now() - t0 < 1000);
  assert.deepEqual(seen, ['a', 'b']);
  assert.equal(out.ok, true);
  const w: string[] = [];
  const wr = await s.r.call('depop', 'post', [signed('a'), signed('b')], ['id'], async (r) => { w.push(r.route_id); return { ok: false as const, code: 'outcome_unknown' as const }; });
  assert.deepEqual(w, ['a']);
  assert.equal(wr.ok, false);
});
