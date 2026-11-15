import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSignin } from './signin.ts';
import { memoryAccounts, memoryVault, type LinkedAccount } from '../browser/auth.ts';
import { memoryStore, memoryLeases } from '../events/ports.ts';
import { createLog } from '../../../../log/index.js';

function setup() {
  const vault = memoryVault(), rows: LinkedAccount[] = [], store = memoryStore(), lines: string[] = [];
  const accounts = memoryAccounts(rows, vault); let status: 'ok' | 'signed_out' | 'second_factor' | 'blocked' = 'signed_out';
  let launches = 0, closes = 0, links = 0, failExport = false, time = 0, refreshed = 0;
  const visits: string[] = [];
  const log = createLog({ src: 'test', build: 'test', sink: line => { lines.push(line); } });
  const signin = createSignin({ vault, accounts, store, log, profileRoot: '/tmp/signin-test', leases: memoryLeases(() => time), ttlMs: 1000, now: () => time,
    invalidatePool: async () => { refreshed++; },
    link: async a => { links++; rows.push(a); },
    launcher: { persistent: async () => { launches++; return { live_url: 'https://example.invalid/private-view', newPage: async () => ({ close: async () => {}, goto: async (url: string) => { visits.push(url); } }),
      onClose() {}, close: async () => { closes++; }, loadState: async () => {},
      exportState: async () => { if (failExport) throw new Error('https://example.invalid/private-view'); return { cookies: [], origins: [] }; } }; },
      anonymous: async () => { throw new Error('wrong launcher'); } }, probe: async () => status });
  return { visits, refreshed: () => refreshed, signin, vault, accounts, store, lines, status: (s: typeof status) => { status = s; }, fail: () => { failExport = true; },
    advance: () => { time = 1001; }, counts: () => ({ launches, closes, links }) };
}
test('dry sign-in returns steps and starts no cloud browser', async () => {
  const s = setup(), r = await s.signin.start({ person_id: 'usr_1', site: 'depop' });
  assert.equal(r.state, 'dry'); assert.ok(r.steps?.includes('person signs in through live view'));
  assert.deepEqual(s.counts(), { launches: 0, closes: 0, links: 0 });
});
test('hosted sign-in: opaque owner-bound live view, verified state makes the account linked', async () => {
  const s = setup(), r = await s.signin.start({ person_id: 'usr_1', site: 'depop', go: ['depop'] });
  assert.deepEqual(s.visits, ['https://www.depop.com/login/']);
  assert.equal(r.state, 'waiting'); assert.ok(r.session_id); assert.ok(r.signin_session_url);
  assert.equal(JSON.stringify(r).includes('private-view'), false);
  assert.equal(await s.signin.liveView('other', r.session_id!), undefined);
  assert.equal(await s.signin.liveView('usr_1', r.session_id!), 'https://example.invalid/private-view');
  assert.equal((await s.signin.complete('usr_1', r.session_id!)).state, 'waiting');
  assert.equal((await s.accounts.linked()).length, 0);
  s.status('ok'); assert.equal((await s.signin.complete('usr_1', r.session_id!)).state, 'ok');
  assert.equal((await s.accounts.linked()).length, 1); assert.equal(s.vault.size(), 1); assert.equal(s.refreshed(), 1);
  await s.signin.complete('usr_1', r.session_id!); assert.equal(s.counts().links, 1);
  assert.equal(s.lines.join('').includes('private-view'), false);
});
for (const challenge of ['second_factor', 'blocked'] as const) test(`${challenge}: pauses and asks once; person clears it`, async () => {
  const s = setup(), r = await s.signin.start({ person_id: 'usr_1', site: 'depop', go: ['depop'] }); s.status(challenge);
  assert.equal((await s.signin.complete('usr_1', r.session_id!)).state, 'paused');
  await s.signin.complete('usr_1', r.session_id!);
  assert.equal(s.store.tx(t => t.decisions({ user_id: 'usr_1' })).length, 1);
  assert.equal(s.vault.size(), 0); assert.equal(s.counts().closes, 0);
  s.status('ok'); assert.equal((await s.signin.complete('usr_1', r.session_id!)).state, 'ok');
  assert.equal(s.counts().closes, 1);
});
test('storage export failure never links, closes browser and redacts the vendor error', async () => {
  const s = setup(), r = await s.signin.start({ person_id: 'usr_1', site: 'depop', go: ['depop'] }); s.status('ok'); s.fail();
  assert.equal((await s.signin.complete('usr_1', r.session_id!)).state, 'failed');
  assert.equal((await s.accounts.linked()).length, 0); assert.equal(s.counts().closes, 1);
  assert.equal(s.lines.join('').includes('private-view'), false);
});
test('abandoned or expired sign-in stays unlinked; another person cannot complete or cancel', async () => {
  const s = setup(), r = await s.signin.start({ person_id: 'usr_1', site: 'depop', go: ['depop'] });
  assert.equal((await s.signin.complete('other', r.session_id!)).state, 'not_found');
  await s.signin.cancel('other', r.session_id!); assert.equal(s.counts().closes, 0);
  s.advance(); assert.equal((await s.signin.complete('usr_1', r.session_id!)).state, 'failed');
  assert.equal(s.counts().closes, 1); assert.equal(s.vault.size(), 0);
});
