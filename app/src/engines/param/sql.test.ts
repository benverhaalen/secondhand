import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { VersionConflict } from './param.ts';
import { sqlStore, type Tx } from './sql.ts';
// @ts-expect-error plain .mjs
import { migrate } from '../../../../db/migrate.mjs';

const { PGlite } = createRequire(fileURLToPath(new URL('../../../../db/package.json', import.meta.url)))('@electric-sql/pglite');
const AT = '2026-11-14T22:00:00-06:00';

const db = new PGlite();
await migrate(db);
// The PGlite superuser bypasses row security, so every store runs as a plain role.
await db.exec('create role app_api nologin; grant all on all tables in schema public to app_api; grant all on all sequences in schema public to app_api;');

// One outcome transaction: the store gets the same tx the caller would write its event on; commit or roll back as asked.
async function run<T>(uid: string | null, fn: (s: ReturnType<typeof newStore>, tx: Tx) => Promise<T>, commit = true): Promise<T> {
  await db.exec('begin; set local role app_api');
  if (uid) await db.query("select set_config('app.user_id', $1, true)", [uid]);
  try {
    const out = await fn(newStore(db), db);
    await db.exec(commit ? 'commit' : 'rollback');
    return out;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}
function newStore(tx: Tx) {
  const s = sqlStore(tx);
  s.declare({ name: 'p_min_quick', family: 'scalar', prior: 0.6 });
  s.declare({ name: 'assist_span_open', family: 'beta', prior: { alpha: 8, beta: 2 }, guard_lo: 0.02, guard_hi: 0.98 });
  return s;
}
const fit = (over: Record<string, unknown> = {}) => ({
  name: 'p_min_quick', scope: { site: 'depop' }, family: 'scalar' as const, value_or_hyperparams: 0.7, prior: 0.6,
  fitted_on_ids_hash: 'h1', n_eff: 40, metric: 'brier', held_out_score: 0.5, guard_lo: 0, guard_hi: 1, ...over,
});
const reset = () => db.exec('delete from param');
const D = { site: 'depop' };

test('falls back to prior: a site with no row reads the declared prior with n_eff 0', async () => {
  await reset();
  assert.deepEqual(await run(null, (s) => s.read('p_min_quick', { site: 'mercari' })), { value: 0.6, version: 0, n_eff: 0, from: 'prior', scope: {} });
});

test('a child scope reads its parent; a sibling and the empty scope never read the child', async () => {
  await reset();
  await run(null, async (s) => { await s.propose(fit(), 0); await s.promote('p_min_quick', D, 1, 0, AT); });
  const r = await run('usr_1', (s) => s.read('p_min_quick', { site: 'depop', person: 'usr_1' }));
  assert.deepEqual([r.from, r.value, r.version, r.scope], ['parent', 0.7, 1, D]);
  assert.equal((await run(null, (s) => s.read('p_min_quick', {}))).from, 'prior');
  assert.equal((await run(null, (s) => s.read('p_min_quick', { site: 'ebay' }))).value, 0.6);
  assert.equal((await run(null, (s) => s.read('p_min_quick', D))).from, 'row');
});

test('the most specific champion wins over a parent', async () => {
  await reset();
  await run(null, async (s) => {
    await s.propose(fit({ scope: {}, value_or_hyperparams: 0.5 }), 0); await s.promote('p_min_quick', {}, 1, 0, AT);
    await s.propose(fit({ scope: { kind: 'shoes', site: 'depop' }, value_or_hyperparams: 0.9 }), 0); await s.promote('p_min_quick', { kind: 'shoes', site: 'depop' }, 1, 0, AT);
  });
  assert.equal((await run(null, (s) => s.read('p_min_quick', { kind: 'shoes', site: 'depop', state: 'listed' }))).value, 0.9);
  assert.equal((await run(null, (s) => s.read('p_min_quick', { kind: 'bags', site: 'depop' }))).value, 0.5);
});

test('RLS: a person read never sees another person row, and person rows carry the user_id', async () => {
  await reset();
  await run('usr_2', async (s) => { await s.propose(fit({ scope: { site: 'depop', person: 'usr_2' } }), 0); await s.promote('p_min_quick', { site: 'depop', person: 'usr_2' }, 1, 0, AT); });
  assert.equal((await db.query("select user_id from param")).rows[0].user_id, 'usr_2');
  assert.equal((await run('usr_1', (s) => s.read('p_min_quick', { site: 'depop', person: 'usr_1' }))).from, 'prior');
  assert.equal((await run('usr_1', (s) => s.read('p_min_quick', { site: 'depop', person: 'usr_2' }))).from, 'prior', 'asking for the other scope under RLS still sees nothing');
  assert.equal((await run('usr_2', (s) => s.read('p_min_quick', { site: 'depop', person: 'usr_2' }))).from, 'row');
});

test('a fit without its held-out score is refused before any write', async () => {
  await reset();
  await assert.rejects(run(null, (s) => s.propose(fit({ held_out_score: null }), 0)), /held-out/);
  assert.equal((await db.query('select count(*)::int n from param')).rows[0].n, 0);
});

test('held-out loss keeps the champion; a win retires it', async () => {
  await reset();
  await run(null, async (s) => { await s.propose(fit(), 0); await s.promote('p_min_quick', D, 1, 0.01, AT); });
  const lost = await run(null, async (s) => { await s.propose(fit({ value_or_hyperparams: 0.9, held_out_score: 0.505 }), 1); return s.promote('p_min_quick', D, 2, 0.01, AT); });
  assert.deepEqual(lost, { promoted: false, reason: 'lost held-out' });
  assert.equal((await run(null, (s) => s.read('p_min_quick', D))).version, 1);
  await run(null, async (s) => { await s.propose(fit({ value_or_hyperparams: 0.95, held_out_score: 0.9 }), 2); assert.deepEqual(await s.promote('p_min_quick', D, 3, 0.01, AT), { promoted: true, reason: 'beat v1' }); });
  assert.equal((await run(null, (s) => s.read('p_min_quick', D))).value, 0.95);
  assert.equal((await run(null, (s) => s.promote('p_min_quick', D, 9, 0, AT))).reason, 'no such challenger');
});

test('version conflict: a second fit from a stale version loses', async () => {
  await reset();
  await run(null, (s) => s.propose(fit(), 0));
  await assert.rejects(run(null, (s) => s.propose(fit({ value_or_hyperparams: 0.8 }), 0)), VersionConflict);
  assert.equal((await db.query('select count(*)::int n from param')).rows[0].n, 1);
});

test('version conflict on a true race: both read v0, the unique key lets one insert and maps to VersionConflict', async () => {
  await reset();
  await run(null, (s) => s.propose(fit(), 0));
  // The racing fit read max(version)=0 before the winner committed; its insert then hits unique (name, scope, version).
  const stale: Tx = { query: (sql, p) => (/max\(version\)/.test(sql) ? Promise.resolve({ rows: [{ v: 0 }] }) : db.query(sql, p)) };
  await db.exec('begin; set local role app_api');
  await assert.rejects(newStore(stale).propose(fit({ value_or_hyperparams: 0.8 }), 0), VersionConflict);
  await db.exec('rollback');
});

test('rollback restores the previous promoted version', async () => {
  await reset();
  await run(null, async (s) => {
    await s.propose(fit(), 0); await s.promote('p_min_quick', D, 1, 0, AT);
    await s.propose(fit({ value_or_hyperparams: 0.9, held_out_score: 0.8 }), 1); await s.promote('p_min_quick', D, 2, 0, AT);
  });
  assert.equal((await run(null, (s) => s.read('p_min_quick', D))).value, 0.9);
  assert.equal((await run(null, (s) => s.rollback('p_min_quick', D, AT))).version, 1);
  const r = await run(null, (s) => s.read('p_min_quick', D));
  assert.deepEqual([r.value, r.version], [0.7, 1]);
  await assert.rejects(run(null, (s) => s.rollback('p_min_quick', D, AT)), /earlier promoted/);
});

test('observe moves a beta mean, weighted, with forgetting, and writes a new champion version', async () => {
  await reset();
  const r = await run(null, (s) => s.observe('assist_span_open', D, { success: 0, weight: 1 }, AT));
  assert.deepEqual([r.applied, r.read.value, r.read.version], [true, { alpha: 8, beta: 3 }, 1]);
  const r2 = await run(null, (s) => s.observe('assist_span_open', D, { success: 1, weight: 2, days_since_last: 30 }, AT));
  const k = Math.exp(-1);
  const v = r2.read.value as { alpha: number; beta: number };
  assert.ok(Math.abs(v.alpha - (8 * k + 2)) < 1e-9 && Math.abs(v.beta - 3 * k) < 1e-9);
  assert.equal(r2.read.version, 2);
  assert.deepEqual((await db.query("select status from param order by version")).rows.map((x: { status: string }) => x.status), ['retired', 'champion']);
});

test('the outcome-transaction rule: observe in a rolled-back transaction leaves the param unchanged', async () => {
  await reset();
  await run(null, (s) => s.observe('assist_span_open', D, { success: 0, weight: 1 }, AT));
  await run(null, async (s, tx) => {
    await tx.query("select 1"); // the caller's outcome event would be written here, on the same tx
    await s.observe('assist_span_open', D, { success: 0, weight: 5 }, AT);
  }, false);
  const r = await run(null, (s) => s.read('assist_span_open', D));
  assert.deepEqual([r.value, r.version], [{ alpha: 8, beta: 3 }, 1]);
});

test('frozen scope does not move; a guard breach is not applied', async () => {
  await reset();
  await run(null, (s) => s.observe('assist_span_open', D, { success: 0, weight: 1 }, AT));
  await run(null, (s) => s.freeze('assist_span_open', D, true));
  const f = await run(null, (s) => s.observe('assist_span_open', D, { success: 0, weight: 5 }, AT));
  assert.deepEqual([f.applied, f.reason, f.read.version], [false, 'frozen', 1]);
  await run(null, (s) => s.freeze('assist_span_open', D, false));
  const g = await run(null, (s) => s.observe('assist_span_open', {}, { success: 1, weight: 1000 }, AT));
  assert.deepEqual([g.applied, g.reason], [false, 'guard']);
  assert.equal((await db.query("select count(*)::int n from param where scope = '{}'")).rows[0].n, 0);
});

test('an undeclared param is Unknown, and observe refuses a non-beta family', async () => {
  await reset();
  await assert.rejects(run(null, (s) => s.read('nope', {})), /not declared/);
  await assert.rejects(run(null, (s) => s.observe('p_min_quick', {}, { success: 1, weight: 1 }, AT)), /beta/);
});
