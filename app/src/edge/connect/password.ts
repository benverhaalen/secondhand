// pw-1 Saved passwords, by choice (spec/product.md#secrets-and-marketplace-sessions; Nate, product/words.md
// "passwords are kept opt-in as encrypted secrets we cannot see"). Server only. Off by default; never for eBay
// (its licence bans storing user IDs and passwords). The value goes straight into the secret scope behind account.token_ref
// (one key per account), is readable only by the sign-in job's identity and only while the session has expired,
// and every read is audited with ids only. A second-factor code always goes to the person.
import type { Site } from '../harness/protocol.ts';

export type SecretScope = { put(key: string, value: string): Promise<void>; get(key: string): Promise<string | undefined>; delete(key: string): Promise<void> };
export type Audit = (line: { at: string; account_id: string; identity: string; action: 'store' | 'read' | 'refused' | 'delete'; reason?: string }) => void;
export type Prompt = (p: { account_id: string; kind: 'second_factor' }) => Promise<string | undefined>;

export const SIGN_IN_IDENTITY = 'job:sign_in';
const key = (account_id: string) => `password/${account_id}`;

export function createPasswords({ scope, audit, prompt, now = () => new Date() }: { scope: SecretScope; audit: Audit; prompt: Prompt; now?: () => Date }) {
  const line = (account_id: string, identity: string, action: Parameters<Audit>[0]['action'], reason?: string) =>
    audit({ at: now().toISOString(), account_id, identity, action, ...(reason ? { reason } : {}) });

  return {
    // The person turns it on; nothing is kept before this.
    async optIn(account_id: string, site: Site, password: string): Promise<{ ok: true; token_ref: string } | { ok: false; reason: string }> {
      if (site === 'ebay') return { ok: false, reason: 'eBay links by OAuth; its licence bans storing passwords' };
      if (!password) return { ok: false, reason: 'empty password' };
      await scope.put(key(account_id), password);
      line(account_id, 'person', 'store');
      return { ok: true, token_ref: key(account_id) };
    },
    // Only the sign-in job, only while the session has expired, only after opt-in. The value is handed to `use` and never returned.
    async withPassword<T>(account_id: string, identity: string, session: 'ok' | 'expired', use: (password: string) => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; reason: string }> {
      const refuse = (reason: string) => { line(account_id, identity, 'refused', reason); return { ok: false as const, reason }; };
      if (identity !== SIGN_IN_IDENTITY) return refuse('only the sign-in job may read it');
      if (session !== 'expired') return refuse('the session has not expired');
      // Opted in means the key exists: the scope is the one record, so a restart forgets nothing.
      const pw = await scope.get(key(account_id));
      if (pw === undefined) return refuse('not opted in');
      line(account_id, identity, 'read');
      try { return { ok: true, value: await use(pw) }; }
      catch { return { ok: false, reason: 'the sign-in step failed' }; } // the thrown message may echo the value, so it is dropped
    },
    // A second-factor code is the person's to give: one prompt, never answered by us.
    secondFactor: (account_id: string) => prompt({ account_id, kind: 'second_factor' }),
    // One tap deletes it; unlinking the account calls this too.
    async remove(account_id: string, identity = 'person') {
      await scope.delete(key(account_id));
      line(account_id, identity, 'delete');
    },
    isOptedIn: async (account_id: string) => (await scope.get(key(account_id))) !== undefined,
  };
}

export function memoryScope(): SecretScope & { keys(): string[] } {
  const m = new Map<string, string>();
  return { put: async (k, v) => { m.set(k, v); }, get: async k => m.get(k), delete: async k => { m.delete(k); }, keys: () => [...m.keys()] };
}
