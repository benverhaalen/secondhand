// Handlers for /v1/auth/* (connect.md "Signing in"). Thin: validate fields, call the auth service, shape the example response.
import { auth as defaultAuth, store as defaultStore, type Auth, type AuthStore } from '../auth.ts';
import { ApiError, deps, requireFields, type Ctx, type Handler } from './http.ts';
import { createHash } from 'node:crypto';
import { db } from '../store/db.ts';
import { kv } from '../store/kv.ts';

// J2 priors: 5 codes per address per hour; 20 codes per connecting IP per hour.
export const EMAIL_CODES_PER_ADDRESS_HOUR = 5;
export const EMAIL_CODES_PER_IP_HOUR = 20;
const HOUR_MS = 3600000;
const REFRESH_COOKIE = 'secondhand_refresh';
const COOKIE_TOKEN = '__cookie__';
const REFRESH_SECONDS = 30 * 24 * 60 * 60;

function browserRequest(req: Request): boolean {
  const origin = req.headers.get('Origin');
  if (!origin) return false;
  const allowed = [new URL(req.url).origin, ...(process.env.SECONDHAND_WEB_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean)];
  if (!allowed.includes(origin)) throw new ApiError('locked', 'This sign-in request came from another site', 'origin');
  return true;
}

function cookie(req: Request, token: string | null): string {
  const secure = process.env.NODE_ENV === 'production' || new URL(req.url).protocol === 'https:';
  return `${REFRESH_COOKIE}=${token === null ? '' : encodeURIComponent(token)}; Path=/v1/auth; HttpOnly; SameSite=Strict; Max-Age=${token === null ? 0 : REFRESH_SECONDS}${secure ? '; Secure' : ''}`;
}

function refreshProof(c: Ctx, req: Request) {
  if (typeof c.body.refresh_token === 'string' && c.body.refresh_token !== COOKIE_TOKEN) return { refresh_token: c.body.refresh_token };
  if (!browserRequest(req)) {
    requireFields(c.body, 'refresh_token');
    throw new ApiError('invalid', 'refresh_token must be a token', 'refresh');
  }
  const pair = (req.headers.get('Cookie') ?? '').split(';').map(value => value.trim()).find(value => value.startsWith(`${REFRESH_COOKIE}=`));
  if (!pair) throw new ApiError('unauthenticated', 'Sign in to continue', 'refresh');
  try { return { refresh_token: decodeURIComponent(pair.slice(REFRESH_COOKIE.length + 1)) }; }
  catch { throw new ApiError('unauthenticated', 'Sign in to continue', 'refresh'); }
}

function tokenReply<T extends { access_token: string; refresh_token: string; expires_at: string }>(tokens: T, req: Request) {
  const browser = browserRequest(req);
  return { status: 200, body: browser ? { ...tokens, refresh_token: COOKIE_TOKEN } : tokens,
    headers: { 'Cache-Control': 'no-store', ...(browser ? { 'Set-Cookie': cookie(req, tokens.refresh_token) } : {}) } };
}

export function makeAuthHandlers(auth: Auth, store: AuthStore, limits = kv(db())) {
  const limitEmail = (email: string, ip: string | null) => {
    const now = deps.now();
    // Without a host-bound client address, only the per-address limit applies.
    const buckets: [string, string, number][] = [['email_code_address', email, EMAIL_CODES_PER_ADDRESS_HOUR]];
    if (ip !== null) buckets.push(['email_code_ip', ip, EMAIL_CODES_PER_IP_HOUR]);
    const reached = (ns: string, key: string) => new ApiError('rate_limited', 'email code limit reached', 'send_code', {
      by: 'auto', after_s: Math.max(1, Math.ceil(((limits.get<number>(ns, `${key}:reset_at`) ?? now + HOUR_MS) - now) / 1000)),
    });
    for (const [ns, key, maximum] of buckets) {
      if ((limits.get<number>(ns, key) ?? 0) >= maximum) throw reached(ns, key);
    }
    for (const [ns, key, maximum] of buckets) {
      const count = limits.incr(ns, key, HOUR_MS);
      if (count === 1) limits.set(ns, `${key}:reset_at`, now + HOUR_MS, HOUR_MS);
      if (count > maximum) throw reached(ns, key);
    }
  };
  const userOf = async (user_id: string) => {
    const u = await store.getUser(user_id);
    return { id: user_id, auth_methods: await auth.methods(user_id), onboarding: { done_steps: u?.onboarding.done_steps ?? [], finished_at: u?.onboarding.finished_at ?? null } };
  };
  const signedIn = async (i: Awaited<ReturnType<Auth['verifyEmail']>>, req: Request) => tokenReply({
    access_token: i.access_token, refresh_token: i.refresh_token, expires_at: i.expires_at, created: i.created, user: await userOf(i.user_id),
  }, req);
  const str = (c: Ctx, ...n: string[]) => { requireFields(c.body, ...n); return c.body as Record<string, string>; };
  const linked = (provider: 'apple' | 'google' | 'email', need: string[]): Handler => async (c) => ({ status: 200, body: { auth_methods: await auth.link(c.user_id!, provider, str(c, ...need)) } });

  return {
    apple: (async (c, req) => { browserRequest(req); return signedIn(await auth.signInApple(str(c, 'identity_token', 'nonce') as { identity_token: string; nonce: string }), req); }) as Handler,
    google: (async (c, req) => { browserRequest(req); return signedIn(await auth.signInGoogle(str(c, 'id_token') as { id_token: string }), req); }) as Handler,
    emailStart: (async (c, req) => {
      browserRequest(req);
      const { email } = str(c, 'email');
      if (typeof email !== 'string' || !email.trim()) throw new ApiError('invalid', 'email must be a string', 'validate', { by: 'user' });
      const address = email.trim().toLowerCase();
      const email_hash = createHash('sha256').update(address).digest('hex');
      c.log.input('api', 'email_start', { email_hash: email_hash.slice(0, 12) });
      if (!auth.senderReady()) throw new ApiError('unavailable', 'no email sender is configured', 'send_code', { by: 'none' });
      limitEmail(email_hash, deps.connectingAddress(req));
      return { status: 202, body: await auth.startEmail({ email: address }) };
    }) as Handler,
    emailVerify: (async (c, req) => { browserRequest(req); return signedIn(await auth.verifyEmail(str(c, 'email', 'code') as { email: string; code: string }), req); }) as Handler,
    async refresh(c, req) {
      const browser = browserRequest(req);
      try { return tokenReply(await auth.refresh(refreshProof(c, req)), req); }
      catch (error) {
        if (browser && error instanceof ApiError && error.status === 401) return { status: error.status, body: error.toJSON(), headers: { 'Set-Cookie': cookie(req, null), 'Cache-Control': 'no-store' } };
        throw error;
      }
    },
    async signout(c, req) {
      const browser = browserRequest(req);
      try { await auth.signOut(refreshProof(c, req)); }
      catch (error) { if (!(browser && error instanceof ApiError && error.status === 401)) throw error; }
      return { status: 204, headers: { 'Cache-Control': 'no-store', ...(browser ? { 'Set-Cookie': cookie(req, null) } : {}) } };
    },
    linkApple: linked('apple', ['identity_token', 'nonce']),
    linkGoogle: linked('google', ['id_token']),
    linkEmail: linked('email', ['email', 'code']),
  } satisfies Record<string, Handler>;
}

export const handlers = makeAuthHandlers(defaultAuth, defaultStore);

export const routeHandlers = {
  'POST /v1/auth/apple': handlers.apple,
  'POST /v1/auth/google': handlers.google,
  'POST /v1/auth/email/start': handlers.emailStart,
  'POST /v1/auth/email/verify': handlers.emailVerify,
  'POST /v1/auth/refresh': handlers.refresh,
  'POST /v1/auth/signout': handlers.signout,
  'POST /v1/auth/link/apple': handlers.linkApple,
  'POST /v1/auth/link/google': handlers.linkGoogle,
  'POST /v1/auth/link/email': handlers.linkEmail,
};
const routeAuth: Record<string, 'user' | 'visitor' | 'none'> = {
  'POST /v1/auth/apple': 'none',
  'POST /v1/auth/google': 'none',
  'POST /v1/auth/email/start': 'none',
  'POST /v1/auth/email/verify': 'none',
  'POST /v1/auth/refresh': 'none',
  'POST /v1/auth/signout': 'none',
};
export const manifest = Object.keys(routeHandlers).map(endpoint => ({ endpoint, source: 'engine' as const, auth: routeAuth[endpoint] ?? 'user' as const }));
