// A linked account's sign-in, held as browser-use storage state behind account.token_ref (spec/product.md#secrets-and-marketplace-sessions).
// The state is a secret: it lives only in the secret scope (the vault port), never in a repo file, a log, a trace or a table.
import { SITES, type Site } from '../harness/protocol.ts';
import { memoryStore, type Store, type Row } from '../events/ports.ts';
import { PROFILES as PLATFORM_PROFILES } from '../harness/platform.ts';

// Orchestrator's plain-browser observations, signed out, 2026-11-15: eBay /mys/home
// redirected to signin.ebay.com/ws/eBayISAPI.dll (password input); Poshmark
// /user/account-info to /login (password input); Depop /settings/ to /login/.
// Confirm these account routes signed in on the first real link. Mercari /mypage/
// returned HTTP 403, title "Just a moment...", before any redirect: its behavior
// is unobserved. Its login marker is asserted from the existing login URL.
// A bot check never proves either signed-in or signed-out state.
function linkProfile(site: 'ebay' | 'poshmark' | 'depop' | 'mercari', account_url: string,
  login_url = PLATFORM_PROFILES[site].login!) {
  return { ...PLATFORM_PROFILES[site], login: login_url, login_url, account_url, sign_in_markers: [login_url] };
}

// Cloud-link profiles extend the shared platform data without changing adapter routes.
export const PROFILES = {
  ebay: linkProfile('ebay', 'https://www.ebay.com/mys/home', 'https://signin.ebay.com/'),
  poshmark: linkProfile('poshmark', 'https://poshmark.com/user/account-info'),
  depop: linkProfile('depop', 'https://www.depop.com/settings/'),
  mercari: linkProfile('mercari', 'https://www.mercari.com/mypage/'),
};

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
export type Accounts = { linked(person_id?: string): Promise<LinkedAccount[]>; byId(account_id: string, person_id?: string): Promise<LinkedAccount | undefined> };

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
    async byId(id, person_id) { return person_id ? (await withState()).find(r => r.account_id === id && r.person_id === person_id) : undefined; },
  };
}

export { linkedList } from '../harness/linked.ts';

// Cloud profiles contain the credentials at the vendor; these rows contain only references.
export type ProfileRow = {
  account_id: string; user_id: string; site: Site; profile_id: string;
  state: 'linked' | 'needs_signin' | 'paused'; linked_at: string | null; last_ok_at: string | null;
  data: 'synthetic' | 'example' | 'captured';
};
export type ProfileRegistry = {
  get(user_id: string, account_id: string): Promise<ProfileRow | undefined>;
  put(user_id: string, row: ProfileRow): Promise<void>;
  hasProfile(profile_id: string): Promise<boolean>;
};


export function profileRow(row: ProfileRow): ProfileRow {
  const id = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(v);
  const date = (v: unknown) => v === null || (typeof v === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) && Number.isFinite(Date.parse(v)));
  if (![row.account_id, row.user_id, row.profile_id].every(id) || !SITES.includes(row.site) ||
      !['linked', 'needs_signin', 'paused'].includes(row.state) || !['synthetic', 'example', 'captured'].includes(row.data) ||
      !date(row.linked_at) || !date(row.last_ok_at)) throw new Error('invalid profile row');
  return { account_id: row.account_id, user_id: row.user_id, site: row.site, profile_id: row.profile_id, state: row.state,
    linked_at: row.linked_at, last_ok_at: row.last_ok_at, data: row.data };
}

export function storeProfileRegistry(store: Store): ProfileRegistry {
  function owned(t: Store, user_id: string, account_id: string) {
    if (!user_id || !account_id || t.systemRows('account', { id: account_id }).some(r => r.user_id !== user_id))
      throw new Error('account owner mismatch');
    return t.get<Row & Partial<ProfileRow>>('account', user_id, account_id);
  }
  return {
    async hasProfile(profile_id) { return store.systemRows('account', { profile_id }).length > 0; },
    async get(user_id, account_id) {
      const r = owned(store, user_id, account_id);
      if (r && !r.profile_id) throw new Error('account needs profile migration');
      return r?.profile_id ? profileRow(r as Row & ProfileRow) : undefined;
    },
    async put(user_id, input) {
      if (input.user_id !== user_id) throw new Error('account owner mismatch');
      const row = profileRow(input);
      store.tx(t => {
        const prior = owned(t, user_id, row.account_id);
        if (prior?.site && prior.site !== row.site) throw new Error('account site mismatch');
        if (t.systemRows('account', { profile_id: row.profile_id }).some(r => r.id !== row.account_id || r.user_id !== user_id))
          throw new Error('profile already belongs to an account');
        // Legacy token-backed accounts need an explicit migration; never discard their configuration here.
        if (prior && !prior.profile_id) throw new Error('account needs profile migration');
        t.put('account', { id: row.account_id, ...row, ...(prior ? { version: prior.version } : {}) });
      });
    },
  };
}

export const memoryProfileRegistry = (): ProfileRegistry => storeProfileRegistry(memoryStore());
