// A linked account's sign-in, held as browser-use storage state behind account.token_ref (spec/product.md#secrets-and-marketplace-sessions).
// The state is a secret: it lives only in the secret scope (the vault port), never in a repo file, a log, a trace or a table.
import type { Site } from '../harness/protocol.ts';

export type Cookie = { name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: 'Strict' | 'Lax' | 'None' };
export type StorageState = { cookies: Cookie[]; origins: { origin: string; localStorage: { name: string; value: string }[] }[] };

export type AuthVault = {
  get(token_ref: string): Promise<StorageState | undefined>;
  put(token_ref: string, state: StorageState): Promise<void>;
  snapshot(token_ref: string): Promise<{ state: StorageState | undefined; version: number }>;
  compareAndPut(token_ref: string, version: number, state: StorageState): Promise<number | undefined>;
  delete(token_ref: string): Promise<void>;
};

// The person's account rows that carry stored sign-in state. Only these are launched, warmed, swept or scheduled.
export type LinkedAccount = { account_id: string; person_id: string; site: Site; token_ref: string };
export type Accounts = { linked(person_id?: string): Promise<LinkedAccount[]>; byId(account_id: string): Promise<LinkedAccount | undefined> };

export function memoryVault(): AuthVault & { size(): number } {
  const m = new Map<string, string>(); // serialised, so a caller mutating its copy never mutates the stored secret
  const versions = new Map<string, number>();
  const put = (ref: string, state: StorageState) => { const version = (versions.get(ref) ?? 0) + 1; versions.set(ref, version); m.set(ref, JSON.stringify(state)); return version; };
  return {
    async snapshot(ref) { const s = m.get(ref); return { state: s ? JSON.parse(s) as StorageState : undefined, version: versions.get(ref) ?? 0 }; },
    async compareAndPut(ref, version, state) { if ((versions.get(ref) ?? 0) !== version) return undefined; return put(ref, state); },
    async get(ref) { const s = m.get(ref); return s ? JSON.parse(s) as StorageState : undefined; },
    async put(ref, state) { put(ref, state); },
    async delete(ref) { versions.set(ref, (versions.get(ref) ?? 0) + 1); m.delete(ref); },
    size: () => m.size,
  };
}

// An account counts as linked only when its row has a token_ref and the vault holds state for it.
export function memoryAccounts(rows: (LinkedAccount | Omit<LinkedAccount, 'token_ref'>)[], vault: AuthVault): Accounts {
  const withState = async () => (await Promise.all(rows.map(async r => ('token_ref' in r && await vault.get(r.token_ref)) ? r : undefined)))
    .filter((r): r is LinkedAccount => !!r);
  return {
    async linked(person_id) { return (await withState()).filter(r => !person_id || r.person_id === person_id); },
    async byId(id) { return (await withState()).find(r => r.account_id === id); },
  };
}

export { linkedList } from '../harness/linked.ts';
