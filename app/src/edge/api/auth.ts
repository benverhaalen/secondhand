// Handlers for /v1/auth/* (connect.md "Signing in"). Thin: validate fields, call the auth service, shape the example response.
import { auth as defaultAuth, store as defaultStore, type Auth, type AuthStore } from '../auth.ts';
import { requireFields, type Ctx, type Handler } from './http.ts';

export function makeAuthHandlers(auth: Auth, store: AuthStore) {
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
    emailStart: (async (c) => ({ status: 202, body: await auth.startEmail(str(c, 'email') as { email: string }) })) as Handler,
    emailVerify: (async (c) => signedIn(await auth.verifyEmail(str(c, 'email', 'code') as { email: string; code: string }))) as Handler,
    async refresh(c) { return { status: 200, body: await auth.refresh(str(c, 'refresh_token') as { refresh_token: string }) }; },
    async signout(c) { await auth.signOut(str(c, 'refresh_token') as { refresh_token: string }); return { status: 204 }; },
    linkApple: linked('apple', ['identity_token', 'nonce']),
    linkGoogle: linked('google', ['id_token']),
    linkEmail: linked('email', ['email', 'code']),
  } satisfies Record<string, Handler>;
}

export const handlers = makeAuthHandlers(defaultAuth, defaultStore);
