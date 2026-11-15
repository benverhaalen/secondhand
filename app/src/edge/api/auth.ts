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
  const signedIn = async (i: Awaited<ReturnType<Auth['verifyEmail']>>) => ({
    status: 200, body: { access_token: i.access_token, refresh_token: i.refresh_token, expires_at: i.expires_at, created: i.created, user: await userOf(i.user_id) },
  });
  const str = (c: Ctx, ...n: string[]) => { requireFields(c.body, ...n); return c.body as Record<string, string>; };
  const linked = (provider: 'apple' | 'google' | 'email', need: string[]): Handler => async (c) => ({ status: 200, body: { auth_methods: await auth.link(c.user_id!, provider, str(c, ...need)) } });

  return {
    apple: (async (c) => signedIn(await auth.signInApple(str(c, 'identity_token', 'nonce') as { identity_token: string; nonce: string }))) as Handler,
    google: (async (c) => signedIn(await auth.signInGoogle(str(c, 'id_token') as { id_token: string }))) as Handler,
    emailStart: (async (c, req) => {
      const { email } = str(c, 'email');
      if (typeof email !== 'string' || !email.trim()) throw new ApiError('invalid', 'email must be a string', 'validate', { by: 'user' });
      const address = email.trim().toLowerCase();
      const email_hash = createHash('sha256').update(address).digest('hex');
      c.log.input('api', 'email_start', { email_hash: email_hash.slice(0, 12) });
      limitEmail(email_hash, deps.connectingAddress(req));
      return { status: 202, body: await auth.startEmail({ email: address }) };
    }) as Handler,
    emailVerify: (async (c) => signedIn(await auth.verifyEmail(str(c, 'email', 'code') as { email: string; code: string }))) as Handler,
    async refresh(c) { return { status: 200, body: await auth.refresh(str(c, 'refresh_token') as { refresh_token: string }) }; },
    async signout(c) { await auth.signOut(str(c, 'refresh_token') as { refresh_token: string }); return { status: 204 }; },
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
