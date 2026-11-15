// The one migration runner. Only db-1 writes db/migrations. Idempotent: applied files are skipped; an applied file whose bytes changed is an error.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const DIR = fileURLToPath(new URL('./migrations/', import.meta.url));
const LOCK = 7240001;

// client: { query(sql, params), exec(sql) }. Returns the filenames applied by this call.
export async function migrate(client, dir = DIR) {
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const bad = files.find(f => !/^\d{4}_[a-z0-9_]+\.sql$/.test(f));
  if (bad) throw new Error(`migration name must be NNNN_name.sql: ${bad}`);
  await client.query('select pg_advisory_lock($1)', [LOCK]);
  try {
    await client.exec('create table if not exists schema_migrations (filename text primary key, sha256 text not null, applied_at timestamptz not null default now())');
    const done = new Map((await client.query('select filename, sha256 from schema_migrations')).rows.map(r => [r.filename, r.sha256]));
    const applied = [];
    for (const f of files) {
      const sql = readFileSync(join(dir, f), 'utf8');
      const sha = createHash('sha256').update(sql).digest('hex');
      if (done.has(f)) {
        if (done.get(f) !== sha) throw new Error(`applied migration changed: ${f}`);
        continue;
      }
      await client.exec('begin');
      try {
        await client.exec(sql);
        await client.query('insert into schema_migrations (filename, sha256) values ($1, $2)', [f, sha]);
        await client.exec('commit');
      } catch (e) {
        await client.exec('rollback');
        throw new Error(`migration ${f} failed: ${e.message}`);
      }
      applied.push(f);
    }
    return applied;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK]);
  }
}

if (process.argv[1]?.endsWith('migrate.mjs')) {
  const url = process.argv[process.argv.indexOf('--url') + 1];
  if (!url || !process.argv.includes('--url')) { console.error('usage: node db/migrate.mjs --url <postgres url>'); process.exit(2); }
  const { default: pg } = await import('pg'); // lazy: only the CLI needs a driver
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const applied = await migrate({ query: (s, p) => c.query(s, p), exec: s => c.query(s) });
    console.log(applied.length ? `applied: ${applied.join(', ')}` : 'up to date');
  } finally { await c.end(); }
}
