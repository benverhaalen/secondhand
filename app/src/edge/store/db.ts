// Rests-on: spec/plans/server-store.md (SV0).
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isPromise } from 'node:util/types';
import { createLog, consoleSink, type Log } from '../../../../log/index.js';

const shared = globalThis as typeof globalThis & {
  __secondhandDb?: Map<string, DatabaseSync>;
  __secondhandTxDepth?: WeakMap<DatabaseSync, number>;
  __secondhandDbLog?: Log;
};
const handles = shared.__secondhandDb ??= new Map<string, DatabaseSync>();
const depths = shared.__secondhandTxDepth ??= new WeakMap<DatabaseSync, number>();
const log = shared.__secondhandDbLog ??= createLog({ src: 'edge.store', build: process.env.npm_package_version ?? 'dev', sink: consoleSink });

export function dataPath(env: Record<string, string | undefined> = process.env): string {
  if (env.SECONDHAND_DATA_DIR) return join(env.SECONDHAND_DATA_DIR, 'secondhand.db');
  if (env.NODE_TEST_CONTEXT !== undefined) return ':memory:';
  if (env.NODE_ENV === 'production') throw new Error('SECONDHAND_DATA_DIR is required in production');
  return join(tmpdir(), 'secondhand-dev', 'secondhand.db');
}

export function openDb(path: string): DatabaseSync {
  const cached = handles.get(path);
  if (cached) return cached;
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const handle = new DatabaseSync(path);
  try {
    handle.exec('PRAGMA busy_timeout=5000');
    if (path !== ':memory:') handle.exec('PRAGMA journal_mode=WAL');
    handle.exec('PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON');
  } catch (error) {
    handle.close();
    log.error('sqlite.open', error);
    throw error;
  }
  handles.set(path, handle);
  log.note('SQLite opened', { path });
  return handle;
}

export function tx<T>(handle: DatabaseSync, fn: () => T): T {
  const depth = depths.get(handle) ?? 0;
  const savepoint = `s${depth}`;
  handle.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
  depths.set(handle, depth + 1);
  try {
    return log.timed('sqlite.tx', () => {
      const result = fn();
      if (isPromise(result)) {
        void result.catch(error => log.error('sqlite.tx.async', error));
        throw new Error('SQLite transaction must be synchronous; fn returned a Promise');
      }
      handle.exec(depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
      return result;
    }, { depth });
  } catch (error) {
    handle.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
    log.error('sqlite.tx', error);
    throw error;
  } finally {
    if (depth === 0) depths.delete(handle); else depths.set(handle, depth);
  }
}

export function migrate(handle: DatabaseSync, name: string, sql: string): void {
  tx(handle, () => {
    handle.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, at TEXT)');
    if (handle.prepare('SELECT name FROM migrations WHERE name = ?').get(name)) return;
    handle.exec(sql);
    handle.prepare('INSERT INTO migrations (name, at) VALUES (?, ?)').run(name, new Date().toISOString());
    log.note('SQLite migration applied', { name });
  });
}

export const db = (): DatabaseSync => openDb(dataPath());
