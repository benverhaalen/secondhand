// Rests-on: spec/product.md#secrets-and-marketplace-sessions; spec/plans/server-store.md; review-server.md B12, B13.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import type { AuthVault, StorageState } from '../browser/auth.ts';
import { db, migrate, tx } from './db.ts';
import { secret } from './secrets.ts';

export function sqliteVault(handle: DatabaseSync, key: Buffer): AuthVault {
  if (key.length !== 32) throw new Error('Vault key must be 32 bytes');
  const encryptionKey = Buffer.from(key);
  migrate(handle, 'vault-1', `CREATE TABLE vault (
    ref TEXT PRIMARY KEY, version INTEGER NOT NULL, iv BLOB, tag BLOB, data BLOB
  )`);
  const read = handle.prepare('SELECT version, iv, tag, data FROM vault WHERE ref = ?');
  const write = handle.prepare(`INSERT INTO vault (ref, version, iv, tag, data) VALUES (?, 1, ?, ?, ?)
    ON CONFLICT(ref) DO UPDATE SET version = vault.version + 1, iv = excluded.iv, tag = excluded.tag, data = excluded.data
    RETURNING version`);
  const remove = handle.prepare(`INSERT INTO vault (ref, version, iv, tag, data) VALUES (?, 1, NULL, NULL, NULL)
    ON CONFLICT(ref) DO UPDATE SET version = vault.version + 1, iv = NULL, tag = NULL, data = NULL`);
  const decode = (ref: string, row: Record<string, SQLOutputValue> | undefined): StorageState | undefined => {
    if (!row || row.data === null) return undefined;
    let plaintext: Buffer;
    try {
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey, row.iv as Uint8Array);
      decipher.setAAD(Buffer.from(ref));
      decipher.setAuthTag(row.tag as Uint8Array);
      plaintext = Buffer.concat([decipher.update(row.data as Uint8Array), decipher.final()]);
    } catch {
      throw new Error(`Vault authentication failed for ${ref}`);
    }
    return JSON.parse(plaintext.toString('utf8')) as StorageState;
  };
  const put = (ref: string, state: StorageState): number => {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
    cipher.setAAD(Buffer.from(ref));
    const data = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
    return Number(write.get(ref, iv, cipher.getAuthTag(), data)!.version);
  };
  return {
    async get(ref) { return decode(ref, read.get(ref)); },
    async snapshot(ref) {
      const row = read.get(ref);
      return { state: decode(ref, row), version: Number(row?.version ?? 0) };
    },
    async put(ref, state) { put(ref, state); },
    async compareAndPut(ref, version, state) {
      return tx(handle, () => Number(read.get(ref)?.version ?? 0) === version ? put(ref, state) : undefined);
    },
    async delete(ref) { remove.run(ref); },
  };
}

export const vault = (): AuthVault => sqliteVault(db(), Buffer.from(secret('vault'), 'hex'));
