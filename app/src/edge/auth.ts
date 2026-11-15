// App sign-in on the edge (connect.md "Signing in to secondhand"). How it runs:
//   reads:   the bearer token (verifyAccess: one store read by SHA-256 of the token), a provider id token (one cached JWKS, one RS256 check), or an email code.
//   sign-in: identify (verify proof) -> find or create user and identity -> mint access (1 h) + refresh (30 d) in one parallel write. Two store reads, one write.
//   refresh: one atomic take of the old refresh session (second use finds nothing, so 401) -> mint a new pair in the same family.
//   email:   start hashes a 6-digit code (10 min, 5 tries); verify counts the try before it compares, in constant time, so parallel guesses cannot beat the cap.
//   models:  none. Every decision here is a fixed rule; no language model reads anything. The only outside calls are the JWKS fetch (cached 1 h) and sendCode.
//   breaks:  bad signature, aud, exp, nonce, iss, alg; JWKS key rotation; refresh replay and race; code guess flood; one token reading another user; expired tokens.
import type { Log } from '../../../log/index.js';
import { ApiError, deps } from './api/http.ts';

// Lakebase plus Better Auth replace memoryStore behind AuthStore later.
export type Provider = 'apple' | 'google' | 'email';
export type Notify = { event_kind: string; channel: string; on: boolean };
export type User = {
  id: string; locale: string; currency: string; timezone: string; disclosure_pref: string; target_profit_cents: { amount_cents: number; currency: string };
  notification_pref: Notify[]; experiments_consent: boolean; tutorial_seen: boolean; last_open_at: string | null;
  onboarding: { done_steps: string[]; finished_at: string | null }; push_token_ref: string | null; created_at: string; updated_at: string; version: number;
};
export type Identity = { provider: Provider; subject_hash: string; user_id: string; linked_at: string; email_hash?: string };
export type Session = { user_id: string; kind: 'access' | 'refresh'; expires_at: number; family: string };
export type CodeRec = { hash: string; expires_at: number; sent_at: number; attempts: number };
export type Facet = { name: string; value: string; weight: number; from: string; pinned: boolean; removed_at: string | null };
export type Style = { id: string; facets: Facet[]; edited_at: string | null; version: number };

export interface AuthStore {
  getUser(id: string): Promise<User | null>;
  createUser(u: User): Promise<void>;
  putUser(u: User, expectedVersion: number): Promise<boolean>; // false when the stored version moved
  findIdentity(provider: Provider, subject_hash: string): Promise<Identity | null>;
  findByEmail(email_hash: string): Promise<Identity | null>;
  addIdentity(i: Identity): Promise<void>;
  identitiesOf(user_id: string): Promise<Identity[]>;
  putSession(token_hash: string, s: Session): Promise<void>;
  getSession(token_hash: string): Promise<Session | null>;
  takeSession(token_hash: string): Promise<Session | null>; // get and delete in one step
  dropFamily(family: string): Promise<void>;
  dropUserSessions(user_id: string): Promise<void>;
  putCode(email_hash: string, c: CodeRec): Promise<void>;
  tryCode(email_hash: string): Promise<CodeRec | null>; // counts one attempt, returns the record as counted
  dropCode(email_hash: string): Promise<void>;
  getStyle(user_id: string): Promise<Style>;
  putStyle(user_id: string, s: Style, expectedVersion: number): Promise<boolean>;
}

export const seedStyle = (user_id: string): Style => ({
  id: user_id.replace(/^usr_/, 'sp_'), edited_at: null, version: 1,
  facets: [['brand', 'Carhartt', 0.82, 'sold', false], ['size', 'L', 0.74, 'kept', true], ['era', '1990s', 0.41, 'saved', false], ['price_band', '50-120', 0.36, 'bought', false]]
    .map(([name, value, weight, from, pinned]) => ({ name, value, weight, from, pinned, removed_at: null }) as Facet),
});

export function memoryStore() {
  const users = new Map<string, User>(), ids = new Map<string, Identity>(), sessions = new Map<string, Session>();
  const codes = new Map<string, CodeRec>(), styles = new Map<string, Style>();
  const c = <T>(v: T) => structuredClone(v); // callers never hold a live row, so a lost compare-and-set shows up as false
  const store: AuthStore & { dump(): unknown } = {
    dump: () => ({ users: [...users.values()], ids: [...ids.values()], sessions: [...sessions.entries()], codes: [...codes.entries()] }),
    async getUser(id) { const u = users.get(id); return u ? c(u) : null; },
    async createUser(u) { users.set(u.id, c(u)); styles.set(u.id, seedStyle(u.id)); },
    async putUser(u, v) { if (users.get(u.id)?.version !== v) return false; users.set(u.id, c(u)); return true; },
    async findIdentity(p, h) { const i = ids.get(`${p}:${h}`); return i ? c(i) : null; },
    async findByEmail(h) { const i = [...ids.values()].find((x) => x.email_hash === h); return i ? c(i) : null; },
    async addIdentity(i) { ids.set(`${i.provider}:${i.subject_hash}`, c(i)); },
    async identitiesOf(u) { return [...ids.values()].filter((i) => i.user_id === u).map(c); },
    async putSession(h, s) { sessions.set(h, c(s)); },
    async getSession(h) { const s = sessions.get(h); return s ? c(s) : null; },
    async takeSession(h) { const s = sessions.get(h); sessions.delete(h); return s ? c(s) : null; },
    async dropUserSessions(u) { for (const [h, s] of sessions) if (s.user_id === u) sessions.delete(h); },
    async dropFamily(f) { for (const [h, s] of sessions) if (s.family === f) sessions.delete(h); },
    async putCode(h, rec) { codes.set(h, c(rec)); },
    async tryCode(h) { const r = codes.get(h); if (!r) return null; r.attempts++; return c(r); },
    async dropCode(h) { codes.delete(h); },
    async getStyle(u) { return c(styles.get(u) ?? seedStyle(u)); },
    async putStyle(u, s, v) { if ((styles.get(u) ?? seedStyle(u)).version !== v) return false; styles.set(u, c(s)); return true; },
  };
  return store;
}

const enc = new TextEncoder();
const HOUR = 3600_000, ACCESS_MS = HOUR, REFRESH_MS = 30 * 24 * HOUR, CODE_MS = 10 * 60_000, RESEND_MS = 30_000, MAX_TRIES = 5;
export const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
export const sha = async (s: string) => Buffer.from(await crypto.subtle.digest('SHA-256', enc.encode(s))).toString('hex');
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const token = () => Buffer.from(rand(32)).toString('base64url');
const eq = (a: string, b: string) => { // constant time on equal-length hex digests
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
const code6 = () => { let n: number; do n = new DataView(rand(4).buffer).getUint32(0); while (n >= 4_294_000_000); return String(n % 1_000_000).padStart(6, '0'); };
const emailHash = (email: string) => sha(`email:${email.trim().toLowerCase()}`);
const unauth = (message: string, step: string) => new ApiError('unauthenticated', message, step, { by: 'user' });

// ---- Apple and Google id tokens: RS256 checked with WebCrypto against the provider's JWKS ----
export type Claims = { subject: string; email?: string; email_verified?: boolean };
type Jwk = JsonWebKey & { kid?: string };
type VerifierOpts = { fetch?: typeof globalThis.fetch; now?: () => number; audiences?: () => string[]; log?: () => Log };
const ids = (name: string) => () => (process.env[name] ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
const dec = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

function idTokenVerifier(o: VerifierOpts & { name: string; jwks: string; issuers: string[]; audiences: () => string[] }) {
  const f = o.fetch ?? globalThis.fetch, now = o.now ?? Date.now;
  let cache: { keys: Jwk[]; at: number } | null = null;
  const load = async () => {
    const log = (o.log ?? (() => deps.log))();
    const keys = await log.call('http', `jwks.${o.name}`, { url: o.jwks }, async () => {
      const r = await f(o.jwks); if (!r.ok) throw new Error(`jwks ${r.status}`);
      return ((await r.json()) as { keys: Jwk[] }).keys;
    }, (k) => ({ keys: k.length }));
    cache = { keys, at: now() }; return keys;
  };
  return async (idToken: string, nonce?: string): Promise<Claims | null> => {
    const parts = idToken.split('.'); if (parts.length !== 3) return null;
    let head: { alg?: string; kid?: string }, c: Record<string, unknown>;
    try { head = JSON.parse(dec(parts[0])); c = JSON.parse(dec(parts[1])); } catch { return null; }
    if (head?.alg !== 'RS256' || typeof head.kid !== 'string' || !c || typeof c !== 'object') return null;
    const find = (ks: Jwk[]) => ks.find((k) => k.kid === head.kid);
    let jwk = find(cache && now() - cache.at < HOUR ? cache.keys : await load());
    if (!jwk && cache && now() - cache.at > 60_000) jwk = find(await load()); // key rotation, but never a fetch per junk kid
    if (!jwk) return null;
    try {
      const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, Buffer.from(parts[2], 'base64url'), enc.encode(`${parts[0]}.${parts[1]}`)))) return null;
    } catch { return null; }
    const aud = ([] as unknown[]).concat(c.aud), want = o.audiences();
    if (!o.issuers.includes(c.iss as string) || !aud.some((a) => typeof a === 'string' && want.includes(a))) return null;
    if (typeof c.exp !== 'number' || c.exp * 1000 <= now() || typeof c.sub !== 'string' || !c.sub) return null;
    if (nonce !== undefined && !(typeof c.nonce === 'string' && eq(c.nonce, await sha(nonce)))) return null;
    return { subject: c.sub, email: typeof c.email === 'string' ? c.email : undefined, email_verified: c.email_verified === true || c.email_verified === 'true' };
  };
}

export const appleVerifier = (o: VerifierOpts = {}) => idTokenVerifier({ ...o, name: 'apple', jwks: 'https://appleid.apple.com/auth/keys', issuers: ['https://appleid.apple.com'], audiences: o.audiences ?? ids('APPLE_CLIENT_IDS') });
export const googleVerifier = (o: VerifierOpts = {}) => {
  const v = idTokenVerifier({ ...o, name: 'google', jwks: 'https://www.googleapis.com/oauth2/v3/certs', issuers: ['accounts.google.com', 'https://accounts.google.com'], audiences: o.audiences ?? ids('GOOGLE_CLIENT_IDS') });
  return (idToken: string) => v(idToken);
};

// ---- The auth service ----
export type Proof = { identity_token?: string; nonce?: string; id_token?: string; email?: string; code?: string };
export type Issued = { access_token: string; refresh_token: string; expires_at: string; created: boolean; user_id: string };
export type Method = { provider: Provider; linked_at: string };
export type AuthOpts = {
  store: AuthStore; now: () => number;
  verifyApple: (identity_token: string, nonce: string) => Promise<Claims | null>;
  verifyGoogle: (id_token: string) => Promise<Claims | null>;
  sendCode: (email: string, code: string) => Promise<void> | void;
  log?: () => Log;
};

export function createAuth(o: AuthOpts) {
  const { store, now } = o, log = () => (o.log ?? (() => deps.log))();
  const changed = (entity: string, id: string, to: string) => log().event('state.change', { entity, id, to });

  async function mint(user_id: string, family: string, created: boolean): Promise<Issued> {
    const [a, r] = [token(), token()], t = now();
    await Promise.all([
      sha(a).then((h) => store.putSession(h, { user_id, kind: 'access', expires_at: t + ACCESS_MS, family })),
      sha(r).then((h) => store.putSession(h, { user_id, kind: 'refresh', expires_at: t + REFRESH_MS, family })),
    ]);
    changed('session', family, 'issued');
    return { access_token: a, refresh_token: r, expires_at: iso(t + ACCESS_MS), created, user_id };
  }

  // Turns a provider proof into a stable subject, or 401. An email proof consumes its code.
  async function identify(provider: Provider, p: Proof): Promise<{ subject_hash: string; email_hash?: string }> {
    if (provider === 'email') {
      const h = await emailHash(p.email ?? ''), rec = await store.tryCode(h);
      if (!rec || rec.expires_at <= now()) throw unauth('code does not match or expired', 'verify_code');
      if (rec.attempts > MAX_TRIES) throw new ApiError('rate_limited', 'too many tries on this code', 'verify_code', { by: 'user' });
      const ok = eq(await sha(`${h}:${p.code ?? ''}`), rec.hash);
      if (!ok) { if (rec.attempts === MAX_TRIES) changed('email_code', h.slice(0, 8), 'locked'); throw unauth('code does not match or expired', 'verify_code'); }
      await store.dropCode(h);
      return { subject_hash: h, email_hash: h };
    }
    const c = provider === 'apple' ? await o.verifyApple(p.identity_token ?? '', p.nonce ?? '') : await o.verifyGoogle(p.id_token ?? '');
    if (!c) throw unauth(`${provider} token rejected`, 'verify_token');
    // Apple's private relay address never merges on its own; Google merges only a verified address.
    return { subject_hash: await sha(`${provider}:${c.subject}`), email_hash: provider === 'google' && c.email && c.email_verified ? await emailHash(c.email) : undefined };
  }

  const attach = async (provider: Provider, who: { subject_hash: string; email_hash?: string }, user_id: string) => {
    await store.addIdentity({ provider, subject_hash: who.subject_hash, user_id, linked_at: iso(now()), email_hash: who.email_hash });
    changed('identity', `${provider}:${who.subject_hash.slice(0, 8)}`, 'linked');
  };

  async function signIn(provider: Provider, p: Proof): Promise<Issued> {
    const who = await identify(provider, p);
    const have = (await store.findIdentity(provider, who.subject_hash)) ?? (who.email_hash ? await store.findByEmail(who.email_hash) : null);
    if (have) {
      if (have.provider !== provider || have.subject_hash !== who.subject_hash) await attach(provider, who, have.user_id);
      return mint(have.user_id, token(), false);
    }
    const t = iso(now()), id = `usr_${Buffer.from(rand(6)).toString('hex')}`;
    await store.createUser({
      id, locale: 'en-US', currency: 'USD', timezone: 'America/Chicago', disclosure_pref: 'plain', target_profit_cents: { amount_cents: 0, currency: 'USD' },
      notification_pref: [{ event_kind: 'sale', channel: 'push', on: true }, { event_kind: 'offer', channel: 'push', on: true }, { event_kind: 'digest', channel: 'email', on: false }],
      experiments_consent: false, tutorial_seen: false, last_open_at: t, onboarding: { done_steps: [], finished_at: null }, push_token_ref: null,
      created_at: t, updated_at: t, version: 1,
    });
    changed('user', id, 'created');
    await attach(provider, who, id);
    return mint(id, token(), true);
  }

  const methods = async (user_id: string): Promise<Method[]> =>
    (await store.identitiesOf(user_id)).sort((a, b) => a.linked_at.localeCompare(b.linked_at)).map((i) => ({ provider: i.provider, linked_at: i.linked_at }));

  return {
    signInApple: (p: { identity_token: string; nonce: string }) => signIn('apple', p),
    signInGoogle: (p: { id_token: string }) => signIn('google', p),
    verifyEmail: (p: { email: string; code: string }) => signIn('email', p),
    async startEmail(p: { email: string }) {
      const h = await emailHash(p.email), prev = await store.tryCode(h), t = now();
      if (prev && t - prev.sent_at < RESEND_MS) throw new ApiError('rate_limited', 'a code was just sent', 'send_code', { by: 'auto', after_s: Math.ceil((RESEND_MS - (t - prev.sent_at)) / 1000) });
      const code = code6();
      await store.putCode(h, { hash: await sha(`${h}:${code}`), expires_at: t + CODE_MS, sent_at: t, attempts: 0 });
      changed('email_code', h.slice(0, 8), 'sent');
      await log().call('tool', 'send_code', { email: p.email }, () => o.sendCode(p.email, code));
      return { sent: true as const, expires_at: iso(t + CODE_MS), resend_after_s: RESEND_MS / 1000 };
    },
    async refresh(p: { refresh_token: string }) {
      const s = await store.takeSession(await sha(p.refresh_token));
      if (!s || s.kind !== 'refresh' || s.expires_at <= now()) throw unauth('refresh token expired or already used', 'refresh');
      const { access_token, refresh_token, expires_at } = await mint(s.user_id, s.family, false);
      return { access_token, refresh_token, expires_at };
    },
    async signOut(p: { refresh_token: string }) {
      const s = await store.getSession(await sha(p.refresh_token));
      if (s?.kind === 'refresh') { await store.dropFamily(s.family); changed('session', s.family, 'revoked'); }
    },
    async link(user_id: string, provider: Provider, p: Proof): Promise<Method[]> {
      const who = await identify(provider, p), have = await store.findIdentity(provider, who.subject_hash);
      if (have && have.user_id !== user_id) throw new ApiError('stale', 'already linked to another account', 'link', { by: 'user' });
      if (!have) await attach(provider, who, user_id);
      return methods(user_id);
    },
    methods,
    async verifyAccess(t: string): Promise<string | null> {
      const s = await store.getSession(await sha(t));
      return s && s.kind === 'access' && s.expires_at > now() ? s.user_id : null;
    },
  };
}

export type Auth = ReturnType<typeof createAuth>;

const logSend = async () => { /* the call is already logged by log.call; a real sender replaces this and never logs the code */ };

export const store = memoryStore();
export const auth = createAuth({ store, now: () => Date.now(), verifyApple: appleVerifier(), verifyGoogle: googleVerifier(), sendCode: logSend });
deps.verify = auth.verifyAccess; // every route now verifies bearer tokens
