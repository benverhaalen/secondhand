import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, appendFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from './migrate.mjs';
import { LISTING_STATES } from '../spec/lifecycle.mjs';
import row from '../app/src/engines/param/row.json' with { type: 'json' };

const PERSON = ['user', 'account', 'item', 'capture', 'photo', 'attribute', 'job', 'valuation', 'strategy', 'listing', 'conversation', 'message', 'offer', 'order', 'sale_receipt', 'decision', 'rule', 'limits', 'want', 'match', 'appointment', 'goal', 'label', 'recording', 'score', 'claim_check', 'follow', 'style_profile', 'intent', 'session_lease', 'for_you_cache', 'answer', 'gather_request', 'swarm_result', 'event', 'outbox', 'param'];
const SHARED = ['product', 'experiment', 'arm', 'notice', 'visitor', 'route_table', 'route_truth', 'adapter_release', 'family_band', 'script_print', 'extractor_schema', 'offer_outcome'];
const MIGS = new URL('./migrations/', import.meta.url);

const db = new PGlite();
const applied = await migrate(db);
// The PGlite superuser bypasses row security, so isolation is asserted as a plain role.
await db.exec('create role app_api nologin; grant all on all tables in schema public to app_api; grant all on all sequences in schema public to app_api;');

// Runs fn as app_api with app.user_id set (unset when uid is null); always rolled back.
async function as(uid, fn) {
  await db.exec('begin; set local role app_api');
  try {
    if (uid) await db.query("select set_config('app.user_id', $1, true)", [uid]);
    return await fn(db);
  } finally { await db.exec('rollback'); }
}

test('applies every migration in order and records filename + sha256', async () => {
  assert.deepEqual(applied, readdirSync(MIGS).sort());
  const { rows } = await db.query('select filename, sha256 from schema_migrations order by filename');
  assert.equal(rows.length, applied.length);
  assert.ok(rows.every(r => /^[0-9a-f]{64}$/.test(r.sha256)));
  const t = (await db.query("select tablename from pg_tables where schemaname = 'public'")).rows.map(r => r.tablename);
  for (const n of [...PERSON, ...SHARED]) assert.ok(t.includes(n), `missing table ${n}`);
});

test('idempotent: a second run changes nothing; a changed applied file is an error', async () => {
  const before = (await db.query('select * from schema_migrations order by filename')).rows;
  assert.deepEqual(await migrate(db), []);
  assert.deepEqual((await db.query('select * from schema_migrations order by filename')).rows, before);
  const dir = mkdtempSync(join(tmpdir(), 'mig-'));
  cpSync(MIGS, dir, { recursive: true });
  appendFileSync(join(dir, '0001_base.sql'), '\n-- edited after apply\n');
  await assert.rejects(migrate(db, dir), /applied migration changed: 0001_base\.sql/);
});

test('a failing migration rolls back whole and is not recorded', async () => {
  const d2 = new PGlite();
  const dir = mkdtempSync(join(tmpdir(), 'mig-'));
  writeFileSync(join(dir, '0001_x.sql'), 'create table a (id int); select nope_fn();');
  await assert.rejects(migrate(d2, dir), /0001_x\.sql failed/);
  assert.equal((await d2.query("select count(*)::int n from pg_tables where tablename = 'a'")).rows[0].n, 0);
  assert.equal((await d2.query('select count(*)::int n from schema_migrations')).rows[0].n, 0);
  await d2.close();
});

test('row security: every person table is forced with a user_id policy; shared tables have none', async () => {
  const rls = (await db.query("select relname, relrowsecurity, relforcerowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'")).rows;
  const pol = (await db.query("select tablename, qual, with_check from pg_policies where schemaname = 'public'")).rows;
  for (const n of PERSON) {
    const r = rls.find(x => x.relname === n);
    assert.ok(r.relrowsecurity && r.relforcerowsecurity, `${n}: row security not forced`);
    const p = pol.find(x => x.tablename === n);
    assert.match(p.qual, /user_id/);
    assert.match(p.with_check, /user_id/);
    const nullable = (await db.query("select is_nullable from information_schema.columns where table_name = $1 and column_name = 'user_id'", [n])).rows[0].is_nullable;
    assert.equal(nullable, n === 'param' ? 'YES' : 'NO', `${n}: user_id nullability`);
  }
  for (const n of SHARED) assert.ok(!rls.find(x => x.relname === n).relrowsecurity, `${n}: should not have row security`);
});

test("row security: a person reading another person's row gets 0 rows; unset gets 0; cross-write refused", async () => {
  await db.exec("insert into item (id, user_id, origin, state) values ('it_a', 'usr_a', 'capture', 'review'), ('it_b', 'usr_b', 'capture', 'live')");
  try {
    assert.deepEqual((await as('usr_a', d => d.query('select id from item'))).rows.map(r => r.id), ['it_a']);
    assert.deepEqual((await as('usr_b', d => d.query("select id from item where id = 'it_a'"))).rows, []);
    assert.deepEqual((await as(null, d => d.query('select id from item'))).rows, []);
    await assert.rejects(as('usr_a', d => d.query("insert into item (id, user_id, origin, state) values ('it_x', 'usr_b', 'capture', 'review')")), /row-level security/);
    assert.equal((await as('usr_a', d => d.query("update item set title = 'x' where id = 'it_b'"))).affectedRows, 0);
  } finally { await db.exec('delete from item'); }
});

test('param: person rows are private, global rows shared; challenger needs a score; one champion per (name, scope)', async () => {
  const ins = (d, o) => d.query('insert into param (user_id, name, scope, family, value_or_hyperparams, prior, version, fitted_on_ids_hash, n_eff, metric, held_out_score, guard_lo, guard_hi, status, frozen, promoted_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
    [o.user_id ?? null, o.name, JSON.stringify(o.scope), o.family, JSON.stringify(o.value_or_hyperparams), JSON.stringify(o.prior), o.version, o.fitted_on_ids_hash, o.n_eff, o.metric, o.held_out_score, o.guard_lo, o.guard_hi, o.status, o.frozen, o.promoted_at]);
  try {
    await ins(db, row);
    await assert.rejects(ins(db, { ...row, version: 2, held_out_score: null }), /check/);
    await assert.rejects(ins(db, { ...row, version: 2, scope: { site: 'depop', bogus: 1 } }), /check/);
    await assert.rejects(ins(db, { ...row, version: 3, scope: { person: 'usr_a' } }), /check/);
    await ins(db, { ...row, version: 2, status: 'champion' });
    await assert.rejects(ins(db, { ...row, version: 3, status: 'champion' }), /duplicate key/);
    await assert.rejects(ins(db, { ...row, version: 2, status: 'retired' }), /duplicate key/);
    await ins(db, { ...row, user_id: 'usr_a', scope: { site: 'depop', person: 'usr_a' }, status: 'champion', version: 1 });
    const seen = async u => (await as(u, d => d.query("select scope from param where name = 'p_min_quick' and status = 'champion'"))).rows.map(r => r.scope);
    assert.equal((await seen('usr_a')).length, 2);
    assert.deepEqual(await seen('usr_b'), [{ site: 'depop' }]);
  } finally { await db.exec('delete from param'); }
});

test('state lists are checked: listing mirrors lifecycle.mjs; an unknown item state is refused', async () => {
  try {
    for (const s of LISTING_STATES) await db.exec(`insert into listing (id, user_id, item_id, site, state) values ('ls_${s}', 'u', 'it_1', 'ebay', '${s}')`);
    await assert.rejects(db.exec("insert into listing (id, user_id, item_id, site, state) values ('ls_bad', 'u', 'it_1', 'ebay', 'bogus')"), /check/);
    await assert.rejects(db.exec("insert into item (id, user_id, origin, state) values ('it_bad', 'u', 'capture', 'bogus')"), /check/);
  } finally { await db.exec('delete from listing'); }
});

test('ids carry their section 7 prefix; version and updated_at bump on every update', async () => {
  await assert.rejects(db.exec("insert into item (id, user_id, origin, state) values ('xx_1', 'u', 'capture', 'review')"), /check/);
  try {
    await db.exec("insert into item (id, user_id, origin, state) values ('it_v', 'u', 'capture', 'review')");
    await db.exec("update item set title = 'a' where id = 'it_v'");
    await db.exec("update item set title = 'b' where id = 'it_v'");
    assert.equal((await db.query("select version from item where id = 'it_v'")).rows[0].version, 3);
  } finally { await db.exec('delete from item'); }
});

test('idempotency and dedupe keys are unique per person', async () => {
  try {
    await db.exec("insert into job (id, user_id, kind, state, idempotency_key) values ('job_1', 'u1', 'post', 'queued', 'k'), ('job_2', 'u2', 'post', 'queued', 'k')");
    await assert.rejects(db.exec("insert into job (id, user_id, kind, state, idempotency_key) values ('job_3', 'u1', 'post', 'queued', 'k')"), /duplicate key/);
    await db.exec("insert into event (id, user_id, actor, action, dedupe_key) values ('ev_1', 'u1', 'site', 'a', 'd')");
    await assert.rejects(db.exec("insert into event (id, user_id, actor, action, dedupe_key) values ('ev_2', 'u1', 'site', 'a', 'd')"), /duplicate key/);
  } finally { await db.exec('delete from job; delete from event'); }
});

test.after(() => db.close());
