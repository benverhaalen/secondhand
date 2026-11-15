import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog } from '../../../../log/index.js';
import { EBAY_TOKEN_URL, createEbayLink } from './ebay.ts';
import { memoryScope } from './password.ts';

const app = { client_id: 'cid', client_secret: 'CLIENT-SECRET', redirect_uri: 'ru-name', scopes: ['https://api.ebay.com/oauth/api_scope/sell.inventory'] };

function fakeEbay() {
  const calls: { grant: string; auth: string; body: string; url: string }[] = [];
  let revoked = false, n = 0;
  const fetchFn = (async (url: string, init: RequestInit) => {
    const body = String(init.body), form = new URLSearchParams(body), grant = form.get('grant_type') ?? '';
    calls.push({ grant, auth: (init.headers as Record<string, string>).authorization, body, url });
    if (grant === 'refresh_token' && revoked) return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
    n++;
    return new Response(JSON.stringify({ access_token: `ACCESS-${n}`, expires_in: 7200, ...(grant === 'authorization_code' ? { refresh_token: 'REFRESH-TOKEN-SECRET', refresh_token_expires_in: 47304000 } : {}) }), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchFn, revoke: () => { revoked = true; } };
}

test('link stores the refresh token only in the scope behind token_ref, and refreshes before expiry', async () => {
  const scope = memoryScope(), e = fakeEbay();
  let t = 0;
  const link = createEbayLink({ app, scope, fetchFn: e.fetchFn, now: () => t, onStale: () => {} });
  const r = await link.link('a1', 'AUTH-CODE');
  assert.ok(r.ok && r.token_ref === 'ebay/a1');
  assert.equal(await scope.get('ebay/a1'), 'REFRESH-TOKEN-SECRET');
  assert.equal(e.calls[0].url, EBAY_TOKEN_URL);
  assert.equal(e.calls[0].auth, `Basic ${Buffer.from('cid:CLIENT-SECRET').toString('base64')}`);
  assert.deepEqual(await link.accessToken('a1'), { ok: true, token: 'ACCESS-1' });
  t = 7200_000 - 4 * 60_000; // inside the early-refresh window
  assert.deepEqual(await link.accessToken('a1'), { ok: true, token: 'ACCESS-2' });
  assert.equal(e.calls[1].grant, 'refresh_token');
  assert.match(e.calls[1].body, /scope=/);
});

test('a revoked refresh token gives account_stale, once per failure, and no token', async () => {
  const scope = memoryScope(), e = fakeEbay(), stale: string[] = [];
  let t = 0;
  const link = createEbayLink({ app, scope, fetchFn: e.fetchFn, now: () => t, onStale: (id, why) => { stale.push(`${id}:${why}`); } });
  await link.link('a1', 'AUTH-CODE');
  e.revoke(); t = 10 * 3600_000;
  assert.deepEqual(await link.accessToken('a1'), { ok: false, code: 'auth_expired' });
  assert.deepEqual(stale, ['a1:invalid_grant']);
});

test('tokens, the code and the client secret are masked: no log line carries them', async () => {
  const scope = memoryScope(), e = fakeEbay(), lines: string[] = [];
  const log = createLog({ src: 'connect', build: 'test', sink: (l: string) => { lines.push(l); } });
  let t = 0;
  const link = createEbayLink({ app, scope, fetchFn: e.fetchFn, now: () => t, onStale: () => {}, log });
  await link.link('a1', 'AUTH-CODE');
  t = 8000_000;
  await link.accessToken('a1');
  const all = lines.join('\n');
  assert.ok(lines.length >= 2);
  for (const s of ['REFRESH-TOKEN-SECRET', 'ACCESS-', 'AUTH-CODE', 'CLIENT-SECRET', Buffer.from('cid:CLIENT-SECRET').toString('base64')]) assert.ok(!all.includes(s), s);
});

test('unlink deletes the refresh token; no token is answered after', async () => {
  const scope = memoryScope(), e = fakeEbay(), stale: string[] = [];
  const link = createEbayLink({ app, scope, fetchFn: e.fetchFn, onStale: id => { stale.push(id); } });
  await link.link('a1', 'AUTH-CODE');
  await link.unlink('a1');
  assert.deepEqual(scope.keys(), []);
  assert.deepEqual(await link.accessToken('a1'), { ok: false, code: 'auth_expired' });
});
