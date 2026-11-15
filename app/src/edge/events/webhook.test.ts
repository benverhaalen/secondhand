import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { createLog, memorySink } from '../../../../log/index.js';
import { memoryStore } from './ports.ts';
import { handleEbayWebhook, actionFor } from './webhook.ts';

const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = pair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
const bare = pub.replace(/-----[A-Z ]+-----|\s/g, '');
const body = (topic: string, id = 'n1') => JSON.stringify({ metadata: { topic, schemaVersion: '1.0' }, notification: { notificationId: id, eventDate: '2026-11-14T00:00:00Z', data: { listingId: 'L9', username: 'someone' } } });
const sig = (b: string, key = pair.privateKey, kid = 'k1') =>
  Buffer.from(JSON.stringify({ alg: 'ecdsa', kid, signature: sign('sha1', Buffer.from(b), key).toString('base64'), digest: 'SHA1' })).toString('base64');
const mk = () => {
  const store = memoryStore(); const sink = memorySink(); const asked: string[] = [];
  const deps = { store, log: createLog({ src: 'test', build: 't', sink }), getKey: (kid: string) => { asked.push(kid); return bare; },
    verificationToken: 'tok-not-real', endpoint: 'https://x.test/hook', resolve: () => ({ user_id: 'u1', account_id: 'a1' }) };
  return { store, sink, asked, deps };
};
const post = (b: string, s?: string) => ({ method: 'POST', headers: s ? { 'X-EBAY-SIGNATURE': s } : {}, body: b, query: {} });

test('a signed order notification becomes one site_push event and one job, answered 200', async () => {
  const { store, deps } = mk(); const b = body('ORDER_CONFIRMATION');
  assert.equal((await handleEbayWebhook(post(b, sig(b)), deps)).status, 200);
  const [e] = store.events();
  assert.deepEqual([e.source, e.site, e.action, e.dedupe_key, e.account_id, e.listing_id], ['site_push', 'ebay', 'order.updated', 'ebay:push:n1', 'a1', 'L9']);
  assert.equal(store.jobs().length, 1);
});

test('bad signature: 401 and no event (body changed after signing, wrong key, missing header, garbage header)', async () => {
  const { store, deps } = mk(); const b = body('ORDER_CONFIRMATION');
  const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
  for (const r of [post(b + ' ', sig(b)), post(b, sig(b, other)), post(b), post(b, 'not-base64-json')])
    assert.equal((await handleEbayWebhook(r, deps)).status, 401);
  assert.equal(store.events().length + store.jobs().length, 0);
});

test('replayed webhook: 200 and still one event and one job', async () => {
  const { store, deps } = mk(); const b = body('OFFER_RECEIVED'); const r = post(b, sig(b));
  await handleEbayWebhook(r, deps); await handleEbayWebhook(r, deps);
  assert.equal(store.events().length, 1); assert.equal(store.jobs().length, 1);
});

test('topics map to actions; an unknown topic is 202, no event, logged', async () => {
  assert.deepEqual(['ORDER_CONFIRMATION', 'BEST_OFFER_RECEIVED', 'MESSAGE_RECEIVED', 'ITEM_ENDED', 'FEEDBACK'].map(actionFor),
    ['order.updated', 'offer.received', 'message.received', 'listing.ended', undefined]);
  const { store, deps, sink } = mk(); const b = body('FEEDBACK');
  assert.equal((await handleEbayWebhook(post(b, sig(b)), deps)).status, 202);
  assert.equal(store.events().length, 0);
  assert.ok(sink.lines.some(l => l.includes('unmapped topic')));
});

test('the public key is fetched once per kid, and a bare base64 key works', async () => {
  const { deps, asked } = mk();
  for (const id of ['a', 'b']) { const b = body('ORDER_CONFIRMATION', id); await handleEbayWebhook(post(b, sig(b)), deps); }
  assert.deepEqual(asked, ['k1']);
});

test('challenge: sha256 of code + token + endpoint; missing code is 400', async () => {
  const { deps } = mk();
  const r = await handleEbayWebhook({ method: 'GET', headers: {}, body: '', query: { challenge_code: 'abc' } }, deps);
  assert.deepEqual(r, { status: 200, body: { challengeResponse: createHash('sha256').update('abc' + 'tok-not-real' + 'https://x.test/hook').digest('hex') } });
  assert.equal((await handleEbayWebhook({ method: 'GET', headers: {}, body: '', query: {} }, deps)).status, 400);
});

test('an unlinked eBay user is 202 and no event', async () => {
  const { store, deps } = mk(); const b = body('ORDER_CONFIRMATION');
  assert.equal((await handleEbayWebhook(post(b, sig(b)), { ...deps, resolve: () => undefined })).status, 202);
  assert.equal(store.events().length, 0);
});
