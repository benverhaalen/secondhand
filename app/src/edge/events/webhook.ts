// wh-1 eBay webhook receiver. Operating notes (eBay Notification API):
// X-EBAY-SIGNATURE is base64 JSON {alg, kid, signature, digest}. The public key comes from GET /commerce/notification/v1/public_key/{kid}
//   (injected as getKey(kid), PEM or the bare base64 body); signature is base64 DER ECDSA over the raw request body with the digest (SHA1 today).
// Endpoint challenge: GET ?challenge_code=X -> {challengeResponse: sha256hex(X + verificationToken + endpoint)}; the token is injected, never in a file.
// Steps for a POST: verify signature on the raw body (401, no event, if missing/bad) -> parse -> map topic to an action
//   (unknown topic: 202, logged, no event) -> resolve eBay user to our user/account (injected) -> ingest (source site_push, site ebay,
//   dedupe_key from notificationId, so a replay collapses) -> 200. A webhook is a trigger only: the harness confirms with a signed-in read.
// Speed: no harness or network call here except getKey, which is cached per kid after the first fetch; no model.
// Likely to break: a body changed after signing (401), no header (401), a replay (deduped, still 200), a topic we do not map (202).
import { createHash, verify } from 'node:crypto';
import type { EventKind } from './event.ts';
import { ingest } from './intake.ts';
import type { LogLike } from './intake.ts';
import type { Store } from './ports.ts';

export interface WebhookDeps {
  store: Store; log: LogLike;
  getKey(kid: string): string | Promise<string>;
  verificationToken: string; endpoint: string;
  resolve(notification: Record<string, any>): { user_id: string; account_id?: string } | undefined;
  now?: () => string;
}
export type Req = { method: string; headers: Record<string, string | undefined>; body: string; query: Record<string, string | undefined> };
export type Res = { status: number; body: unknown };

const keyCache = new WeakMap<object, Map<string, string>>();
const DIGESTS: Record<string, string> = { sha1: 'sha1', sha256: 'sha256' };

// the topic names eBay uses contain these words; order matters (a message about an order is a message)
export function actionFor(topic: string): EventKind | undefined {
  const t = topic.toUpperCase();
  if (/MESSAGE/.test(t)) return 'message.received';
  if (/OFFER/.test(t)) return 'offer.received';
  if (/ORDER/.test(t)) return 'order.updated';
  if (/(ITEM|LISTING).*(END|CLOSE)/.test(t)) return 'listing.ended';
  return undefined;
}

async function signatureOk(req: Req, deps: WebhookDeps): Promise<boolean> {
  try {
    const raw = Object.entries(req.headers).find(([k]) => k.toLowerCase() === 'x-ebay-signature')?.[1];
    if (!raw) return false;
    const h = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    const digest = DIGESTS[String(h.digest ?? 'sha1').toLowerCase()];
    if (!digest || typeof h.kid !== 'string' || typeof h.signature !== 'string') return false;
    const cache = keyCache.get(deps.getKey) ?? keyCache.set(deps.getKey, new Map()).get(deps.getKey)!;
    let key = cache.get(h.kid);
    if (!key) { key = await deps.getKey(h.kid); cache.set(h.kid, key); }
    const pem = key.includes('BEGIN') ? key : `-----BEGIN PUBLIC KEY-----\n${key.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----\n`;
    return verify(digest, Buffer.from(req.body), pem, Buffer.from(h.signature, 'base64'));
  } catch { return false; }
}

export async function handleEbayWebhook(req: Req, deps: WebhookDeps): Promise<Res> {
  const { log, store } = deps;
  if (req.method === 'GET') {
    const code = req.query.challenge_code;
    if (!code) return { status: 400, body: { error: 'challenge_code' } };
    return { status: 200, body: { challengeResponse: createHash('sha256').update(code + deps.verificationToken + deps.endpoint).digest('hex') } };
  }
  if (req.method !== 'POST') return { status: 405, body: {} };
  if (!(await signatureOk(req, deps))) { log.event('note', { msg: 'ebay webhook refused: bad or missing signature', source: 'site_push' }, 'warn'); return { status: 401, body: {} }; }
  let msg: any;
  try { msg = JSON.parse(req.body); } catch { return { status: 400, body: {} }; }
  const topic = String(msg?.metadata?.topic ?? ''), n = msg?.notification ?? {};
  const action = actionFor(topic);
  if (!action || !n.notificationId) { log.event('note', { msg: 'ebay webhook ignored: unmapped topic', topic, source: 'site_push' }); return { status: 202, body: {} }; }
  const who = deps.resolve(n);
  if (!who) { log.event('note', { msg: 'ebay webhook ignored: no linked account', topic, source: 'site_push' }); return { status: 202, body: {} }; }
  const at = deps.now?.() ?? new Date().toISOString();
  const listing = n.data?.listingId ?? n.data?.itemId;
  const r = ingest(store, log, {
    user_id: who.user_id, source: 'site_push', site: 'ebay', account_id: who.account_id, action,
    listing_id: typeof listing === 'string' ? listing : undefined,
    payload_ref: `ebay:notification:${n.notificationId}`, payload: { topic, notification_id: String(n.notificationId) },
    dedupe_key: `ebay:push:${n.notificationId}`, actor: 'site', observed_at: n.eventDate ?? at, effective_at: n.eventDate ?? at,
    trace_id: `ebay-${n.notificationId}`,
  }, deps.now);
  return 'refused' in r ? { status: 202, body: {} } : { status: 200, body: {} };
}
