import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// client.ts imports ./origin, ./fetch and ./vault without an extension, for Metro; Node needs it.
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (/\/api\/client\.ts$/.test(context.parentURL ?? '') && ['./origin', './fetch', './vault'].includes(specifier)) return next(`${specifier}.ts`, context);
  if (specifier === '../api/client') return next('../api/client.ts', context);
  return next(specifier, context);
} });
const { ApiFailure, createClient } = await import('../api/client.ts');
const { memoryVault } = await import('../api/vault.ts');
const { emailSignIn, why } = await import('./sign-in-wire.ts');
hooks.deregister();

const issued = { access_token: 'a1', refresh_token: 'r1', expires_at: '2026-11-15T13:00:00Z', created: true, user: { id: 'usr_1', auth_methods: ['email'] } };

test('the code is traded for the token pair, which the device keeps and sends from then on', async () => {
  const seen: { path: string; auth: string | null; body: unknown }[] = [];
  const vault = memoryVault();
  const client = createClient({ graceMs: 0, origin: '', vault, fetch: async (url, init = {}) => {
    seen.push({ path: url, auth: new Headers(init.headers).get('Authorization'), body: init.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith('/email/start')) return new Response(JSON.stringify({ sent: true }), { status: 202 });
    if (url.endsWith('/email/verify')) return new Response(JSON.stringify(issued));
    return new Response(JSON.stringify({ id: 'usr_1' }));
  } });
  const flow = emailSignIn(client);
  await flow.start(' Nate@Example.test ');
  const out = await flow.verify('Nate@Example.test', '123456');
  assert.equal(out.user.id, 'usr_1');
  assert.deepEqual(seen[0].body, { email: 'Nate@Example.test' });
  assert.deepEqual(seen[1].body, { email: 'Nate@Example.test', code: '123456' });
  assert.equal((await vault.get())?.access_token, 'a1');
  await client.call('GET /v1/me');
  assert.equal(seen[2].auth, 'Bearer a1');
});

test('a wrong code, too many tries and no server each name their own reason, and nothing is kept', async () => {
  const vault = memoryVault();
  const answer = (status: number, code: string) => createClient({ graceMs: 0, origin: '', vault, fetch: async () => new Response(JSON.stringify({ code, message: code }), { status }) });
  for (const [status, code, want] of [[401, 'unauthenticated', 'wrong_code'], [429, 'rate_limited', 'rate_limited'], [500, 'internal', 'failed']] as const) {
    await assert.rejects(emailSignIn(answer(status, code)).verify('a@b.test', '000000'), (e: unknown) => why(e) === want);
  }
  assert.equal(why(new ApiFailure(0, 'unreachable', 'down')), 'unreachable');
  assert.equal(await vault.get(), null);
});
