// du-1: the export_user and delete_user jobs (spec/product.md §4 Job kinds, §6 Secrets and marketplace sessions).
// db: { query(sql, params) } inside a transaction with SET LOCAL app.user_id. vault: a secret scope keyed by account.token_ref.
// Reads: the catalog (person tables), account.token_ref, vault.list. Never reads a secret value.
// Steps (delete): 1 tables + token_refs in parallel; 2 delete secrets in parallel; any failure stops here and rows stay (retry is safe);
// 3 delete rows child-first (FK order from the catalog); 4 zero-row scan by user id on every person table. No model is used.
export interface Vault { delete(key: string): Promise<void>; list(prefix: string): Promise<string[]> }
export interface Db { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }
type Log = { job(job: string, kind: string, state: string, f?: object): void; call: Function; error(where: string, e: unknown, f?: object): void };

// Delta observation/citation and the Volume captures/<user_id>/ live outside Lakebase: the deploy job purges them from this list.
const pendingStores = (u: string) => ['delta.observation', 'delta.citation', `volume:captures/${u}/`];

const identifier = (v: unknown): string => { if (typeof v !== 'string') throw new Error('database returned an invalid identifier'); return v; };
const q = (t: string) => `"${t.replace(/"/g, '""')}"`;

async function personTables(db: Db): Promise<string[]> {
  const r = await db.query(`select c.relname from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
    where c.relkind = 'r' and c.relforcerowsecurity and c.relnamespace = 'public'::regnamespace order by 1`);
  return r.rows.map(x => identifier(x.relname));
}

// Child tables first: a table that references another is deleted before it.
async function childFirst(db: Db, tables: string[]): Promise<string[]> {
  const fk = (await db.query(`select conrelid::regclass::text as child, confrelid::regclass::text as parent from pg_constraint where contype = 'f'`)).rows;
  const unq = (s: unknown) => identifier(s).replace(/^"|"$/g, '');
  const kids = new Map(tables.map(t => [t, new Set<string>()]));
  for (const { child, parent } of fk) if (kids.has(unq(child)) && kids.has(unq(parent)) && child !== parent) kids.get(unq(parent))!.add(unq(child));
  const out: string[] = []; const seen = new Set<string>();
  const visit = (t: string) => { if (seen.has(t)) return; seen.add(t); for (const c of kids.get(t)!) visit(c); out.push(t); };
  tables.forEach(visit);
  return out;
}

async function tokenRefs(db: Db, user_id: string): Promise<string[]> {
  const r = await db.query(`select distinct token_ref from account where user_id = $1 and token_ref is not null`, [user_id]);
  return r.rows.map(x => identifier(x.token_ref));
}

async function existingKeys(vault: Vault, refs: string[]): Promise<string[]> {
  const found = await Promise.all(refs.map(async r => (await vault.list(r)).filter(k => k === r)));
  return found.flat();
}

export async function exportUser(db: Db, vault: Vault, user_id: string, log: Log) {
  log.job(user_id, 'export_user', 'running');
  const [tables, refs] = await Promise.all([personTables(db), tokenRefs(db, user_id)]);
  const [rows, secrets] = await Promise.all([
    Promise.all(tables.map(async t => [t, (await db.query(`select * from ${q(t)} where user_id = $1`, [user_id])).rows] as const)),
    existingKeys(vault, refs),
  ]);
  const out = { user_id, tables: Object.fromEntries(rows.filter(([, r]) => r.length)), secrets, pending_stores: pendingStores(user_id) };
  log.job(user_id, 'export_user', 'done', { tables: Object.keys(out.tables).length, secrets: secrets.length });
  return out;
}

export async function deleteUser(db: Db, vault: Vault, user_id: string, log: Log) {
  log.job(user_id, 'delete_user', 'running');
  const [tables, refs] = await Promise.all([personTables(db), tokenRefs(db, user_id)]);
  const results = await Promise.all(refs.map(async k => {
    try { await vault.delete(k); return null; } catch (e) { log.error('vault.delete', e); return k; }
  }));
  const failed_secrets = results.filter((k): k is string => k !== null);
  const base = { user_id, pending_stores: pendingStores(user_id), failed_secrets };
  log.job(user_id, 'delete_user', 'running', { secrets_deleted: refs.length - failed_secrets.length });
  if (failed_secrets.length) { // rows stay so the job can retry
    log.job(user_id, 'delete_user', 'failed', { failed_secrets: failed_secrets.length });
    return { ...base, state: 'failed' as const, counts: {} as Record<string, number>, scan: {} as Record<string, number> };
  }
  const counts: Record<string, number> = {};
  for (const t of await childFirst(db, tables)) {
    const r = await db.query(`delete from ${q(t)} where user_id = $1 returning 1`, [user_id]);
    counts[t] = r.rows.length;
  }
  log.job(user_id, 'delete_user', 'running', { rows_deleted: Object.values(counts).reduce((a, b) => a + b, 0) });
  const scan: Record<string, number> = {};
  await Promise.all(tables.map(async t => { scan[t] = Number((await db.query(`select count(*) as n from ${q(t)} where user_id = $1`, [user_id])).rows[0].n); }));
  const state = Object.values(scan).every(n => n === 0) ? 'done' as const : 'failed' as const;
  log.job(user_id, 'delete_user', state, { rows_left: Object.values(scan).reduce((a, b) => a + b, 0) });
  return { ...base, state, counts, scan };
}
