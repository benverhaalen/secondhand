// Rests-on: spec/plans/server-store.md (SV0); events/ports.ts Store and memoryStore.
import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { migrate, tx } from '../store/db.ts';
import { EVENT_KINDS, SOURCES, type EventRow } from './event.ts';
import { TABLES, type DecisionRow, type JobRow, type Row, type Store, type Table } from './ports.ts';

const uid = (prefix: string) => `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (row: Record<string, unknown>, keys: string[]) => keys.every(key => typeof row[key] === 'string');
const oneOf = (value: unknown, values: readonly string[]) => typeof value === 'string' && values.includes(value);
const arrayOf = (value: unknown, valid: (row: Record<string, unknown>) => boolean) =>
  Array.isArray(value) && value.every(row => record(row) && valid(row));

function validRow(table: string, row: unknown): boolean {
  if (!record(row) || !strings(row, ['id', 'user_id'])) return false;
  if (table === 'events') return strings(row, ['dedupe_key', 'observed_at', 'effective_at', 'trace_id'])
    && oneOf(row.action, EVENT_KINDS) && oneOf(row.source, SOURCES) && oneOf(row.actor, ['user', 'auto', 'site']);
  if (table === 'jobs') return strings(row, ['event_id', 'idempotency_key', 'trace_id', 'created_at'])
    && typeof row.kind === 'string' && row.kind.length > 0 && oneOf(row.state, ['queued', 'running', 'done', 'failed'])
    && record(row.args) && Number.isInteger(row.attempts) && (row.attempts as number) >= 0
    && arrayOf(row.stages, stage => strings(stage, ['name']) && oneOf(stage.state, ['started', 'running', 'arrived', 'planned', 'failed']));
  if (table === 'decisions') return strings(row, ['kind', 'subject', 'why'])
    && oneOf(row.state, ['open', 'acting', 'answered', 'failed', 'expired', 'superseded'])
    && arrayOf(row.options, option => strings(option, ['id', 'label']));
  return Number.isInteger(row.version) && (row.version as number) >= 1;
}

function decode<T>(table: string, stored: Record<string, unknown>): T {
  try {
    const row: unknown = JSON.parse(stored.body as string);
    if (!validRow(table, row)) throw new Error('invalid Store row');
    return row as T;
  } catch (cause) {
    throw new Error(`Cannot load Store ${table} ${stored.id}`, { cause });
  }
}

// Copied from ports.ts: the Store boundary must reject the same operation envelope keys.
function checkOperationEnvelope(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (/cookie|token|authorization|password|set-cookie|buyer_name|address/i.test(key)) {
      throw new Error('operation envelope contains a forbidden key');
    }
    checkOperationEnvelope(nested, seen);
  }
}

export function sqliteStore(db: DatabaseSync): Store & { recover(): number } {
  migrate(db, 'store-1', `
    CREATE TABLE rows (tbl TEXT, user_id TEXT, id TEXT, version INTEGER, body TEXT, PRIMARY KEY(tbl, user_id, id));
    CREATE TABLE events (id TEXT PRIMARY KEY, user_id TEXT, dedupe_key TEXT, item_id TEXT, account_id TEXT,
      seq INTEGER, body TEXT, UNIQUE(user_id, dedupe_key));
    CREATE TABLE jobs (id TEXT PRIMARY KEY, user_id TEXT, idempotency_key TEXT, kind TEXT, state TEXT,
      account_id TEXT, item_id TEXT, site TEXT, paused TEXT, seq INTEGER, body TEXT, UNIQUE(user_id, idempotency_key));
    CREATE TABLE decisions (id TEXT PRIMARY KEY, user_id TEXT, kind TEXT, subject TEXT, state TEXT, seq INTEGER, body TEXT);
    CREATE TABLE claims (job_id TEXT PRIMARY KEY, worker TEXT);
  `);
  const one = <T>(table: string, sql: string, ...params: SQLInputValue[]): T | undefined => {
    const row = db.prepare(sql).get(...params);
    return row ? decode<T>(table, row) : undefined;
  };
  const all = <T>(table: string, sql: string, ...params: SQLInputValue[]): T[] =>
    db.prepare(sql).all(...params).map(row => decode<T>(table, row));
  const match = <T extends object>(filter: Partial<T> | undefined) => (row: T) =>
    !filter || Object.entries(filter).every(([key, value]) => value === undefined || (row as Record<string, unknown>)[key] === value);
  const exact = (filter: Record<string, unknown>) => (row: Row) =>
    Object.entries(filter).every(([key, value]) => row[key] === value);
  const writeRow = (table: Table, row: Row) => {
    db.prepare(`INSERT INTO rows (tbl, user_id, id, version, body) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(tbl, user_id, id) DO UPDATE SET version = excluded.version, body = excluded.body`
    ).run(table, row.user_id, row.id, row.version!, JSON.stringify(row));
  };
  const jobValues = (row: JobRow): SQLInputValue[] => [row.id, row.user_id, row.idempotency_key, row.kind, row.state,
    row.account_id ?? null, row.item_id ?? null, row.site ?? null, row.paused ?? null, JSON.stringify(row)];
  const decisionValues = (row: DecisionRow): SQLInputValue[] => [row.id, row.user_id, row.kind, row.subject, row.state, JSON.stringify(row)];

  const s: Store & { recover(): number } = {
    put(table, row) {
      return tx(db, () => {
        const old = s.get(table, row.user_id, row.id);
        if (row.version !== undefined && row.version !== old?.version) {
          throw Object.assign(new Error(`stale ${table} ${row.id}`), { code: 'stale' });
        }
        const stored = { ...row, version: (old?.version ?? 0) + 1 };
        writeRow(table, stored);
        return stored;
      });
    },
    get: <T extends Row>(table: Table, user_id: string, id: string) =>
      one<T>(table, 'SELECT id, body FROM rows WHERE tbl = ? AND user_id = ? AND id = ?', table, user_id, id),
    rows: <T extends Row>(table: Table, filter: { user_id: string } & Record<string, unknown>) =>
      all<T>(table, 'SELECT id, body FROM rows WHERE tbl = ? AND user_id = ? ORDER BY rowid', table, filter.user_id).filter(exact(filter)),
    systemRows: <T extends Row>(table: Table, filter: Record<string, unknown> = {}) =>
      all<T>(table, 'SELECT id, body FROM rows WHERE tbl = ? ORDER BY rowid', table).filter(exact(filter)),
    beginOperation(op) {
      return tx(db, () => {
        const old = s.get('operation', op.user_id, op.id);
        if (old) return { row: old, duplicate: true };
        const row = { ...op, state: 'started', attempts: 1, version: 1 };
        writeRow('operation', row);
        return { row, duplicate: false };
      });
    },
    settleOperation(user_id, id, patch) {
      return tx(db, () => {
        const old = s.get('operation', user_id, id);
        if (!old) throw new Error(`no operation ${id}`);
        checkOperationEnvelope(patch.envelope);
        if (old.state === 'done') return old;
        const row = { ...old, ...patch, version: (old.version ?? 0) + 1 };
        writeRow('operation', row);
        return row;
      });
    },
    insertEvent(event) {
      return tx(db, () => {
        const old = one<EventRow>('events', 'SELECT id, body FROM events WHERE user_id = ? AND dedupe_key = ?', event.user_id, event.dedupe_key);
        if (old) return { row: old, duplicate: true };
        const row = { ...event, id: uid('ev') };
        db.prepare(`INSERT INTO events (id, user_id, dedupe_key, item_id, account_id, body, seq)
          VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM events))`
        ).run(row.id, row.user_id, row.dedupe_key, row.item_id ?? null, row.account_id ?? null, JSON.stringify(row));
        return { row, duplicate: false };
      });
    },
    insertJob(job) {
      return tx(db, () => {
        const old = one<JobRow>('jobs', 'SELECT id, body FROM jobs WHERE user_id = ? AND idempotency_key = ?', job.user_id, job.idempotency_key);
        if (old) return { row: old, duplicate: true };
        const row = { ...job, id: uid('job') };
        db.prepare(`INSERT INTO jobs (id, user_id, idempotency_key, kind, state, account_id, item_id, site, paused, body, seq)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM jobs))`).run(...jobValues(row));
        return { row, duplicate: false };
      });
    },
    getJob: id => one<JobRow>('jobs', 'SELECT id, body FROM jobs WHERE id = ?', id),
    updateJob(id, patch) {
      return tx(db, () => {
        const old = s.getJob(id);
        if (!old) throw new Error(`no job ${id}`);
        const row = { ...old, ...patch };
        db.prepare(`UPDATE jobs SET id = ?, user_id = ?, idempotency_key = ?, kind = ?, state = ?,
          account_id = ?, item_id = ?, site = ?, paused = ?, body = ? WHERE id = ?`).run(...jobValues(row), id);
        if (row.id !== id) db.prepare('UPDATE claims SET job_id = ? WHERE job_id = ?').run(row.id, id);
        return row;
      });
    },
    jobs: filter => all<JobRow>('jobs', 'SELECT id, body FROM jobs ORDER BY seq').filter(match(filter)),
    events: filter => all<EventRow>('events', 'SELECT id, body FROM events ORDER BY seq').filter(match(filter)),
    raiseDecision(decision) {
      return tx(db, () => {
        const old = one<DecisionRow>('decisions', `SELECT id, body FROM decisions
          WHERE user_id = ? AND kind = ? AND subject = ? AND state = 'open' ORDER BY seq LIMIT 1`, decision.user_id, decision.kind, decision.subject);
        if (old) return { row: old, duplicate: true };
        const row: DecisionRow = { ...decision, id: uid('dec'), state: 'open' };
        db.prepare(`INSERT INTO decisions (id, user_id, kind, subject, state, body, seq)
          VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM decisions))`).run(...decisionValues(row));
        return { row, duplicate: false };
      });
    },
    decisions: filter => all<DecisionRow>('decisions', 'SELECT id, body FROM decisions ORDER BY seq').filter(match(filter)),
    updateDecision(id, patch) {
      return tx(db, () => {
        const old = one<DecisionRow>('decisions', 'SELECT id, body FROM decisions WHERE id = ?', id);
        if (!old) throw new Error(`no decision ${id}`);
        const row = { ...old, ...patch };
        db.prepare('UPDATE decisions SET id = ?, user_id = ?, kind = ?, subject = ?, state = ?, body = ? WHERE id = ?').run(...decisionValues(row), id);
        return row;
      });
    },
    claimJobs(limit, worker) {
      return tx(db, () => {
        const rows = all<JobRow>('jobs', `SELECT id, body FROM jobs WHERE state = 'queued' AND (paused IS NULL OR paused = '')
          AND NOT EXISTS (SELECT 1 FROM claims WHERE job_id = jobs.id) ORDER BY seq`).slice(0, limit);
        for (const row of rows) db.prepare('INSERT INTO claims (job_id, worker) VALUES (?, ?)').run(row.id, worker);
        return rows;
      });
    },
    release(id) { db.prepare('DELETE FROM claims WHERE job_id = ?').run(id); },
    recover() {
      return tx(db, () => {
        const running = s.jobs({ state: 'running' });
        for (const job of running) s.updateJob(job.id, { state: 'queued' });
        db.exec('DELETE FROM claims');
        return running.length;
      });
    },
    exportUser(user_id) {
      return {
        events: s.events({ user_id }), jobs: s.jobs({ user_id }), decisions: s.decisions({ user_id }),
        rows: Object.fromEntries(TABLES.map(table => [table, s.rows(table, { user_id })])),
      };
    },
    deleteUser(user_id) {
      return tx(db, () => {
        db.prepare('DELETE FROM claims WHERE job_id IN (SELECT id FROM jobs WHERE user_id = ?)').run(user_id);
        const counts = { events: 0, jobs: 0, decisions: 0, rows: {} as Record<Table, number> };
        for (const table of ['events', 'jobs', 'decisions'] as const) {
          counts[table] = Number(db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(user_id).changes);
        }
        for (const table of TABLES) counts.rows[table] = Number(db.prepare('DELETE FROM rows WHERE tbl = ? AND user_id = ?').run(table, user_id).changes);
        return counts;
      });
    },
    tx: fn => tx(db, () => fn(s)),
  };
  return s;
}
