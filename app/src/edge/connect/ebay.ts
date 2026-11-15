// cn-1 eBay OAuth link and refresh (spec/features/connect.md; spec/product.md#secrets-and-marketplace-sessions). Server only.
// eBay is the one site linked by OAuth; no other site is assumed to have it. The authorization-code grant gives an access token
// (about 2 h) and a refresh token (about 18 months); the refresh token lives only in the secret scope behind account.token_ref,
// and the access token is refreshed before it expires. Endpoint and grant shapes: eBay's "Using a refresh token to update a
// User access token" and "Exchanging the authorization code" (developer.ebay.com/api-docs/static/oauth-refresh-token-request.html), asserted.
import type { Log } from '../../../../log/index.js';
import type { SecretScope } from './password.ts';

export const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const REFRESH_EARLY_MS = 5 * 60_000; // refresh this long before expiry, so a sweep never starts on a token about to lapse

export type EbayApp = { client_id: string; client_secret: string; redirect_uri: string; scopes: string[] }; // from the host's secrets, never a file
export type Stale = (account_id: string, reason: string) => Promise<void> | void;                        // raises account_stale, one relink decision

type TokenReply = { access_token: string; expires_in: number; refresh_token?: string; refresh_token_expires_in?: number };

export function createEbayLink({ app, scope, fetchFn = fetch, now = () => Date.now(), onStale, log }: {
  app: EbayApp; scope: SecretScope; fetchFn?: typeof fetch; now?: () => number; onStale: Stale; log?: Log;
}) {
  const access = new Map<string, { token: string; until: number }>(); // in memory only; never written anywhere
  const ref = (account_id: string) => `ebay/${account_id}`;
  const basic = `Basic ${Buffer.from(`${app.client_id}:${app.client_secret}`).toString('base64')}`;

  async function post(form: Record<string, string>): Promise<{ ok: true; t: TokenReply } | { ok: false; status: number; error?: string }> {
    const run = async () => {
      const res = await fetchFn(EBAY_TOKEN_URL, { method: 'POST', headers: { authorization: basic, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() });
      const body: unknown = await res.json().catch(() => ({}));
      const o = (typeof body === 'object' && body ? body : {}) as Record<string, unknown>;
      if (!res.ok || typeof o.access_token !== 'string' || typeof o.expires_in !== 'number')
        return { ok: false as const, status: res.status, error: typeof o.error === 'string' ? o.error : undefined };
      return { ok: true as const, t: o as unknown as TokenReply };
    };
    // Only the grant and the outcome are logged; tokens, codes and the client secret never are.
    return log ? log.call('http', 'ebay.oauth.token', { grant_type: form.grant_type }, run, r => ({ result: { ok: r.ok, ...(r.ok ? {} : { status: r.status, error: r.error }) } })) : run();
  }

  return {
    // The person consented on eBay's page; we trade the code for tokens and keep the refresh token behind token_ref.
    async link(account_id: string, code: string): Promise<{ ok: true; token_ref: string } | { ok: false; reason: string }> {
      const r = await post({ grant_type: 'authorization_code', code, redirect_uri: app.redirect_uri });
      if (!r.ok || !r.t.refresh_token) return { ok: false, reason: `eBay refused the code (${r.ok ? 'no refresh token' : r.status})` };
      await scope.put(ref(account_id), r.t.refresh_token);
      access.set(account_id, { token: r.t.access_token, until: now() + r.t.expires_in * 1000 });
      return { ok: true, token_ref: ref(account_id) };
    },
    // A valid access token, refreshed early; a revoked or expired refresh token raises account_stale once and returns nothing.
    async accessToken(account_id: string): Promise<{ ok: true; token: string } | { ok: false; code: 'auth_expired' }> {
      const have = access.get(account_id);
      if (have && have.until - REFRESH_EARLY_MS > now()) return { ok: true, token: have.token };
      const refresh = await scope.get(ref(account_id));
      if (!refresh) { await onStale(account_id, 'no refresh token'); return { ok: false, code: 'auth_expired' }; }
      const r = await post({ grant_type: 'refresh_token', refresh_token: refresh, scope: app.scopes.join(' ') });
      if (!r.ok) {
        access.delete(account_id);
        if (r.status === 400 || r.status === 401) await onStale(account_id, r.error ?? 'refresh refused');
        return { ok: false, code: 'auth_expired' };
      }
      access.set(account_id, { token: r.t.access_token, until: now() + r.t.expires_in * 1000 });
      return { ok: true, token: r.t.access_token };
    },
    async unlink(account_id: string) { access.delete(account_id); await scope.delete(ref(account_id)); },
  };
}
