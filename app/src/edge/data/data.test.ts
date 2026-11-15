// du-1: export and delete a person. Breaks tested: a saved password survives delete; export misses a table or a row, or holds another user's row; rows vanish while a secret failed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { createLog, memorySink } from '../../../../log/index.js';
import { migrate } from '../../../../db/migrate.mjs';
import { exportUser, deleteUser } from './data.ts';

const require = createRequire(fileURLToPath(new URL('../../../../db/package.json', import.meta.url)));
const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);

const fakeVault = (keys: string[], failOn?: string) => {
  const s = new Set(keys);
  return {
    s,
    async delete(k: string) { if (k === failOn) throw new Error('vault down'); s.delete(k); },
    async list(prefix: string) { return [...s].filter(k => k.startsWith(prefix)); },
  };
};

async function seed() {
  const pg = new PGlite();
  await migrate({ query: (q: string, p?: unknown[]) => pg.query(q, p), exec: (q: string) => pg.exec(q) });
  for (const u of ['u_a', 'u_b']) {
    await pg.query(`insert into "user" (id, user_id) values ($1, $1)`, [u]);
    await pg.query(`insert into account (id, user_id, site, route, token_ref) values ($1, $2, 'ebay', 'harness', $3), ($4, $2, 'depop', 'harness', $5)`,
      [`acc_${u}1`, u, `sec/${u}/ebay`, `acc_${u}2`, `sec/${u}/depop`]);
  }
  return pg;
}
const log = () => createLog({ src: 'test', build: 't', sink: memorySink(), seed: 1 });

test('export holds every row of every person table for this user only, secrets by key', async () => {
  const pg = await seed();
  const v = fakeVault(['sec/u_a/ebay', 'sec/u_a/depop', 'sec/u_b/ebay']);
  const out = await exportUser(pg, v, 'u_a', log());
  assert.deepEqual(Object.keys(out.tables).sort(), ['account', 'user']);
  assert.equal(out.tables.account.length, 2);
  assert.ok(Object.values(out.tables).flat().every((r: any) => r.user_id === 'u_a'));
  assert.deepEqual(out.secrets.sort(), ['sec/u_a/depop', 'sec/u_a/ebay']);
  assert.ok(!JSON.stringify(out).includes('sec/u_b'));
});

test('tables come from the catalog: every forced-RLS user_id table is scanned', async () => {
  const pg = await seed();
  const r = await deleteUser(pg, fakeVault([]), 'u_a', log());
  assert.equal(r.state, 'done');
  const cat = (await pg.query(`select c.relname from pg_class c join pg_attribute a on a.attrelid=c.oid and a.attname='user_id' and not a.attisdropped where c.relkind='r' and c.relforcerowsecurity and c.relnamespace='public'::regnamespace`)).rows.length;
  assert.ok(cat >= 37);
  assert.equal(Object.keys(r.scan).length, cat);
});

test('delete removes every token_ref secret, all rows, nothing of another user', async () => {
  const pg = await seed();
  const v = fakeVault(['sec/u_a/ebay', 'sec/u_a/depop', 'sec/u_b/ebay', 'sec/u_b/depop']);
  const r = await deleteUser(pg, v, 'u_a', log());
  assert.equal(r.state, 'done');
  assert.deepEqual([...v.s].sort(), ['sec/u_b/depop', 'sec/u_b/ebay']);
  assert.equal(r.counts.account, 2);
  assert.equal(r.counts.user, 1);
  assert.ok(Object.values(r.scan).every(n => n === 0));
  assert.equal((await pg.query(`select 1 from account where user_id='u_a'`)).rows.length, 0);
  assert.equal((await pg.query(`select 1 from account where user_id='u_b'`)).rows.length, 2);
  assert.ok(r.pending_stores.includes('volume:captures/u_a/'));
});

test('a failed secret delete leaves the rows and returns failed; retry completes', async () => {
  const pg = await seed();
  const v = fakeVault(['sec/u_a/ebay', 'sec/u_a/depop'], 'sec/u_a/depop');
  const r = await deleteUser(pg, v, 'u_a', log());
  assert.equal(r.state, 'failed');
  assert.deepEqual(r.failed_secrets, ['sec/u_a/depop']);
  assert.equal((await pg.query(`select 1 from account where user_id='u_a'`)).rows.length, 2);
  const retry = await deleteUser(pg, fakeVault(['sec/u_a/depop']), 'u_a', log());
  assert.equal(retry.state, 'done');
});

test('the log never holds a secret key or value', async () => {
  const pg = await seed();
  const sink = memorySink();
  await deleteUser(pg, fakeVault(['sec/u_a/ebay']), 'u_a', createLog({ src: 'test', build: 't', sink, seed: 1 }));
  assert.ok(sink.lines.length > 0);
  assert.ok(!sink.text().includes('sec/u_a'));
});
