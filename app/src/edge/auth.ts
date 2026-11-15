import { emailSender } from './connect/email.ts';
// App sign-in on the edge (connect.md "Signing in to secondhand"). How it runs:
//   reads:   the bearer token (verifyAccess: one store read by SHA-256 of the token), a provider id token (one cached JWKS, one RS256 check), or an email code.
//   sign-in: identify (verify proof) -> find or create user and identity -> mint access (1 h) + refresh (30 d) in one parallel write. Two store reads, one write.
//   refresh: mark the old refresh used atomically; reuse revokes its whole family; mint a new pair in that family.
//   email:   start hashes a 6-digit code (10 min, 5 tries); verify counts the try before it compares, in constant time, so parallel guesses cannot beat the cap.
//   models:  none. Every decision here is a fixed rule; no language model reads anything. The only outside calls are the JWKS fetch (cached 1 h) and sendCode.
//   breaks:  bad signature, aud, exp, nonce, iss, alg; JWKS key rotation; refresh replay and race; code guess flood; one token reading another user; expired tokens.
import type { Log } from '../../../log/index.js';
import type { DatabaseSync } from 'node:sqlite';
import { db, migrate, tx } from './store/db.ts';
import { ApiError, deps } from './api/http.ts';

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
  takeSession(token_hash: string): Promise<Session | null>; // refresh only: mark used; reuse drops its family. Retain used rows until expiry; dropFamily/dropUserSessions remove them.
  dropFamily(family: string): Promise<void>;
  dropUserSessions(user_id: string): Promise<void>;
  putCode(email_hash: string, c: CodeRec): Promise<void>;
  peekCode(email_hash: string): Promise<CodeRec | null>; // read without spending a verify attempt
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
  const users = new Map<string, User>(), ids = new Map<string, Identity>(), sessions = new Map<string, Session & { used_at: number | null }>();
  const codes = new Map<string, CodeRec>(), styles = new Map<string, Style>();
  const c = <T>(v: T) => structuredClone(v); // callers never hold a live row, so a lost compare-and-set shows up as false
  const store: AuthStore & { dump(): unknown } = {
    dump: () => c({ users: [...users.values()], ids: [...ids.values()], sessions: [...sessions.entries()], codes: [...codes.entries()] }),
    async getUser(id) { const u = users.get(id); return u ? c(u) : null; },
    async createUser(u) { users.set(u.id, c(u)); styles.set(u.id, seedStyle(u.id)); },
    async putUser(u, v) { if (users.get(u.id)?.version !== v) return false; users.set(u.id, c(u)); return true; },
    async findIdentity(p, h) { const i = ids.get(`${p}:${h}`); return i ? c(i) : null; },
    async findByEmail(h) { const i = [...ids.values()].find((x) => x.email_hash === h); return i ? c(i) : null; },
    async addIdentity(i) { ids.set(`${i.provider}:${i.subject_hash}`, c(i)); },
    async identitiesOf(u) { return [...ids.values()].filter((i) => i.user_id === u).map(c); },
    async putSession(h, s) { sessions.set(h, { ...c(s), used_at: null }); },
    async getSession(h) { const s = sessions.get(h); if (!s) return null; const { used_at, ...session } = s; return c(session); },
    async takeSession(h) {
      const s = sessions.get(h);
      if (!s || s.kind !== 'refresh') return null;
      if (s.used_at !== null) { for (const [key, row] of sessions) if (row.family === s.family) sessions.delete(key); return null; }
      s.used_at = Date.now();
      const { used_at, ...session } = s; return c(session);
    },
    async dropUserSessions(u) {
      for (const [h, s] of sessions) if (s.user_id === u) sessions.delete(h);
      for (const i of ids.values()) if (i.user_id === u && i.email_hash) codes.delete(i.email_hash);
    },
    async dropFamily(f) { for (const [h, s] of sessions) if (s.family === f) sessions.delete(h); },
    async putCode(h, rec) { codes.set(h, c(rec)); },
    async peekCode(h) { const r = codes.get(h); return r ? c(r) : null; },
    async tryCode(h) { const r = codes.get(h); if (!r) return null; r.attempts++; return c(r); },
    async dropCode(h) { codes.delete(h); },
    async getStyle(u) { return c(styles.get(u) ?? seedStyle(u)); },
    async putStyle(u, s, v) { if ((styles.get(u) ?? seedStyle(u)).version !== v) return false; styles.set(u, c(s)); return true; },
  };
  return store;
}

// Rests-on: spec/plans/server-store.md; review-server.md B1, B8, B9.
export function sqliteAuthStore(handle: DatabaseSync): AuthStore {
  migrate(handle, 'auth-1', `
    CREATE TABLE users (id TEXT PRIMARY KEY, version INTEGER NOT NULL, body TEXT NOT NULL);
    CREATE TABLE identities (provider TEXT, subject_hash TEXT, user_id TEXT NOT NULL, email_hash TEXT, linked_at TEXT NOT NULL, PRIMARY KEY(provider, subject_hash));
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, expires_at INTEGER NOT NULL, family TEXT NOT NULL, used_at INTEGER NULL);
    CREATE INDEX sessions_family ON sessions(family);
    CREATE INDEX sessions_user ON sessions(user_id);
    CREATE TABLE codes (email_hash TEXT PRIMARY KEY, hash TEXT NOT NULL, expires_at INTEGER NOT NULL, sent_at INTEGER NOT NULL, attempts INTEGER NOT NULL);
    CREATE TABLE styles (user_id TEXT PRIMARY KEY, version INTEGER NOT NULL, body TEXT NOT NULL);
  `);
  const body = <T>(row: Record<string, unknown> | undefined): T | null => row ? JSON.parse(row.body as string) as T : null;
  const identity = (row: Record<string, unknown> | undefined): Identity | null => row ? {
    provider: row.provider as Provider, subject_hash: row.subject_hash as string, user_id: row.user_id as string,
    linked_at: row.linked_at as string, ...(row.email_hash === null ? {} : { email_hash: row.email_hash as string }),
  } : null;
  const session = (row: Record<string, unknown> | undefined): Session | null => row ? {
    user_id: row.user_id as string, kind: row.kind as Session['kind'], expires_at: row.expires_at as number, family: row.family as string,
  } : null;
  const code = (row: Record<string, unknown> | undefined): CodeRec | null => row ? {
    hash: row.hash as string, expires_at: row.expires_at as number, sent_at: row.sent_at as number, attempts: row.attempts as number,
  } : null;
  const readSession = handle.prepare('SELECT * FROM sessions WHERE token_hash = ?');
  const readCode = handle.prepare('SELECT * FROM codes WHERE email_hash = ?');
  const dropFamily = handle.prepare('DELETE FROM sessions WHERE family = ?');
  return {
    async getUser(id) { return body<User>(handle.prepare('SELECT body FROM users WHERE id = ?').get(id)); },
    async createUser(u) {
      tx(handle, () => {
        handle.prepare('INSERT INTO users (id, version, body) VALUES (?, ?, ?)').run(u.id, u.version, JSON.stringify(u));
        const style = seedStyle(u.id);
        handle.prepare('INSERT INTO styles (user_id, version, body) VALUES (?, ?, ?)').run(u.id, style.version, JSON.stringify(style));
      });
    },
    async putUser(u, v) {
      return handle.prepare('UPDATE users SET version = ?, body = ? WHERE id = ? AND version = ?').run(u.version, JSON.stringify(u), u.id, v).changes === 1;
    },
    async findIdentity(p, h) { return identity(handle.prepare('SELECT * FROM identities WHERE provider = ? AND subject_hash = ?').get(p, h)); },
    async findByEmail(h) { return identity(handle.prepare('SELECT * FROM identities WHERE email_hash = ? LIMIT 1').get(h)); },
    async addIdentity(i) {
      handle.prepare(`INSERT INTO identities (provider, subject_hash, user_id, email_hash, linked_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(provider, subject_hash) DO UPDATE SET user_id = excluded.user_id, email_hash = excluded.email_hash, linked_at = excluded.linked_at`
      ).run(i.provider, i.subject_hash, i.user_id, i.email_hash ?? null, i.linked_at);
    },
    async identitiesOf(u) { return handle.prepare('SELECT * FROM identities WHERE user_id = ?').all(u).map(row => identity(row)!); },
    async putSession(h, s) {
      handle.prepare(`INSERT INTO sessions (token_hash, user_id, kind, expires_at, family, used_at) VALUES (?, ?, ?, ?, ?, NULL)
        ON CONFLICT(token_hash) DO UPDATE SET user_id = excluded.user_id, kind = excluded.kind, expires_at = excluded.expires_at, family = excluded.family, used_at = NULL`
      ).run(h, s.user_id, s.kind, s.expires_at, s.family);
    },
    async getSession(h) { return session(readSession.get(h)); },
    async takeSession(h) {
      return tx(handle, () => {
        const row = readSession.get(h);
        if (!row || row.kind !== 'refresh') return null;
        if (row.used_at !== null) { dropFamily.run(row.family); return null; }
        handle.prepare('UPDATE sessions SET used_at = ? WHERE token_hash = ?').run(Date.now(), h);
        return session(row);
      });
    },
    async dropFamily(f) { dropFamily.run(f); },
    async dropUserSessions(u) {
      tx(handle, () => {
        handle.prepare('DELETE FROM sessions WHERE user_id = ?').run(u);
        handle.prepare('DELETE FROM codes WHERE email_hash IN (SELECT email_hash FROM identities WHERE user_id = ?)').run(u);
      });
    },
    async putCode(h, c) {
      handle.prepare(`INSERT INTO codes (email_hash, hash, expires_at, sent_at, attempts) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(email_hash) DO UPDATE SET hash = excluded.hash, expires_at = excluded.expires_at, sent_at = excluded.sent_at, attempts = excluded.attempts`
      ).run(h, c.hash, c.expires_at, c.sent_at, c.attempts);
    },
    async peekCode(h) { return code(readCode.get(h)); },
    async tryCode(h) {
      return tx(handle, () => {
        handle.prepare('UPDATE codes SET attempts = attempts + 1 WHERE email_hash = ?').run(h);
        return code(readCode.get(h));
      });
    },
    async dropCode(h) { handle.prepare('DELETE FROM codes WHERE email_hash = ?').run(h); },
    async getStyle(u) { return body<Style>(handle.prepare('SELECT body FROM styles WHERE user_id = ?').get(u)) ?? seedStyle(u); },
    async putStyle(u, s, v) {
      return tx(handle, () => {
        const existing = handle.prepare('SELECT version FROM styles WHERE user_id = ?').get(u);
        if ((existing?.version ?? seedStyle(u).version) !== v) return false;
        handle.prepare(`INSERT INTO styles (user_id, version, body) VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET version = excluded.version, body = excluded.body`).run(u, s.version, JSON.stringify(s));
        return true;
      });
    },
  };
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
    try { head = JSON.parse(dec(parts[0])); c = JSON.parse(dec(parts[1])); } catch (e) { (o.log ?? (() => deps.log))().error('auth.verify', e); return null; }
    if (head?.alg !== 'RS256' || typeof head.kid !== 'string' || !c || typeof c !== 'object') return null;
    const find = (ks: Jwk[]) => ks.find((k) => k.kid === head.kid);
    let jwk = find(cache && now() - cache.at < HOUR ? cache.keys : await load());
    if (!jwk && cache && now() - cache.at > 60_000) jwk = find(await load()); // key rotation, but never a fetch per junk kid
    if (!jwk) return null;
    try {
      const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, Buffer.from(parts[2], 'base64url'), enc.encode(`${parts[0]}.${parts[1]}`)))) return null;
    } catch (e) { (o.log ?? (() => deps.log))().error('auth.verify', e); return null; }
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
  sendCode?: (email: string, code: string) => Promise<void> | void;
  generateCode?: () => string;
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
      const sendCode = o.sendCode;
      if (!sendCode) throw new ApiError('unavailable', 'no email sender is configured', 'send_code', { by: 'none' });
      const h = await emailHash(p.email), prev = await store.peekCode(h), t = now();
      if (prev && t - prev.sent_at < RESEND_MS) throw new ApiError('rate_limited', 'a code was just sent', 'send_code', { by: 'auto', after_s: Math.ceil((RESEND_MS - (t - prev.sent_at)) / 1000) });
      const code = (o.generateCode ?? code6)();
      await store.putCode(h, { hash: await sha(`${h}:${code}`), expires_at: t + CODE_MS, sent_at: t, attempts: 0 });
      changed('email_code', h.slice(0, 8), 'sent');
      await log().call('tool', 'send_code', { email_hash: h.slice(0, 8) }, () => sendCode(p.email, code));
      return { sent: true as const, expires_at: iso(t + CODE_MS), resend_after_s: RESEND_MS / 1000 };
    },
    async refresh(p: { refresh_token: string }) {
      const h = await sha(p.refresh_token), s = await store.takeSession(h);
      if (!s || s.kind !== 'refresh' || s.expires_at <= now()) throw unauth('refresh token expired or already used', 'refresh');
      const { access_token, refresh_token, expires_at } = await mint(s.user_id, s.family, false);
      // A replay can drop the family while mint awaits its hashes and writes. Its retained used row is the revocation witness.
      if (!(await store.getSession(h))) await store.dropFamily(s.family);
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

const developmentCode = process.env.SECONDHAND_DEV_CODE;
if (developmentCode !== undefined && (process.env.NODE_ENV === 'production' || !/^[0-9]{6}$/.test(developmentCode))) {
  throw new Error('SECONDHAND_DEV_CODE must be exactly six digits and cannot be set in production');
}
let sender: AuthOpts['sendCode'] = developmentCode === undefined ? emailSender() : async (email) => {
  deps.log.note('auth.dev_code', { email_hash: (await emailHash(email)).slice(0, 8) });
};
export function configureSender(fn: NonNullable<AuthOpts['sendCode']>): void { sender = fn; }

export const store = sqliteAuthStore(db());
export const auth = createAuth({
  store, now: () => Date.now(), verifyApple: appleVerifier(), verifyGoogle: googleVerifier(),
  get sendCode() { return sender; }, generateCode: developmentCode === undefined ? code6 : () => developmentCode,
});
deps.verify = auth.verifyAccess; // every route now verifies bearer tokens
