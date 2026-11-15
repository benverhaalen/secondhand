// Rests-on: spec/plans/server-store.md (SV0); process state is separate from product rows.
import type { DatabaseSync } from 'node:sqlite';
import { migrate, tx } from './db.ts';

export function kv(db: DatabaseSync, now: () => number = Date.now) {
  migrate(db, 'kv-1', `CREATE TABLE kv (
    ns TEXT, key TEXT, value TEXT, expires_at INTEGER NULL, PRIMARY KEY(ns, key)
  )`);
  const read = db.prepare('SELECT value FROM kv WHERE ns = ? AND key = ? AND (expires_at IS NULL OR expires_at > ?)');
  const write = db.prepare(`INSERT INTO kv (ns, key, value, expires_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(ns, key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`);
  const remove = db.prepare('DELETE FROM kv WHERE ns = ? AND key = ?');
  const encode = (value: unknown): string => {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('KV value must be JSON serializable');
    return encoded;
  };
  const get = <T>(ns: string, key: string): T | undefined => {
    const row = read.get(ns, key, now());
    return row ? JSON.parse(row.value as string) as T : undefined;
  };
  return {
    get,
    set(ns: string, key: string, value: unknown, ttl_ms?: number): void {
      write.run(ns, key, encode(value), ttl_ms === undefined ? null : now() + ttl_ms);
    },
    delete(ns: string, key: string): void { remove.run(ns, key); },
    take<T>(ns: string, key: string): T | undefined {
      return tx(db, () => { const value = get<T>(ns, key); remove.run(ns, key); return value; });
    },
    add(ns: string, key: string, value: unknown, ttl_ms?: number): boolean {
      const at = now(), until = ttl_ms === undefined ? null : at + ttl_ms;
      const result = db.prepare(`INSERT INTO kv (ns, key, value, expires_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(ns, key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
        WHERE kv.expires_at IS NOT NULL AND kv.expires_at <= ?`).run(ns, key, encode(value), until, at);
      return result.changes === 1;
    },
    incr(ns: string, key: string, window_ms: number): number {
      return tx(db, () => {
        const at = now();
        db.prepare(`INSERT INTO kv (ns, key, value, expires_at) VALUES (?, ?, '1', ?)
          ON CONFLICT(ns, key) DO UPDATE SET
            value = CASE WHEN kv.expires_at <= ? THEN '1' ELSE CAST(CAST(kv.value AS INTEGER) + 1 AS TEXT) END,
            expires_at = CASE WHEN kv.expires_at <= ? THEN excluded.expires_at ELSE kv.expires_at END`
        ).run(ns, key, at + window_ms, at, at);
        return JSON.parse(db.prepare('SELECT value FROM kv WHERE ns = ? AND key = ?').get(ns, key)!.value as string) as number;
      });
    },
    sweep(at = now()): number {
      return Number(db.prepare('DELETE FROM kv WHERE expires_at <= ?').run(at).changes);
    },
  };
}
