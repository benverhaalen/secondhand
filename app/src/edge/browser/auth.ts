// A linked account's sign-in, held as browser-use storage state behind account.token_ref (spec/product.md#secrets-and-marketplace-sessions).
// The state is a secret: it lives only in the secret scope (the vault port), never in a repo file, a log, a trace or a table.
import type { Site } from '../harness/protocol.ts';

export type Cookie = { name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: 'Strict' | 'Lax' | 'None' };
export type StorageState = { cookies: Cookie[]; origins: { origin: string; localStorage: { name: string; value: string }[] }[] };

export type AuthVault = {
  get(token_ref: string): Promise<StorageState | undefined>;
  put(token_ref: string, state: StorageState): Promise<void>;
  delete(token_ref: string): Promise<void>;
};

// The person's account rows that carry stored sign-in state. Only these are launched, warmed, swept or scheduled.
export type LinkedAccount = { account_id: string; person_id: string; site: Site; token_ref: string };
export type Accounts = { linked(person_id?: string): Promise<LinkedAccount[]>; byId(account_id: string): Promise<LinkedAccount | undefined> };

export function memoryVault(): AuthVault & { size(): number } {
  const m = new Map<string, string>(); // serialised, so a caller mutating its copy never mutates the stored secret
  return {
    async get(ref) { const s = m.get(ref); return s ? JSON.parse(s) as StorageState : undefined; },
    async put(ref, state) { m.set(ref, JSON.stringify(state)); },
    async delete(ref) { m.delete(ref); },
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
