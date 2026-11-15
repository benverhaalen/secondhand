// Runs every eBay public read once against production with the application keyset: search, sold search (expects no_route
// unless Marketplace Insights is approved), one item (the first search result) and a storefront (the seller named in argv[3],
// skipped without one). Prints one JSON line per read with its count and time; no name, URL or token is printed.
// Keys are read by presence only. It never signs in and sends no write.
//   node --no-warnings app/src/edge/harness/sites/ebay/live.ts [query] [seller]
import type { AdapterResult } from '../../protocol.ts';
import { appTokenSource, ebayAdapters, readItem, type Client, type Reply } from './adapter.ts';

const q = process.argv[2] ?? 'levis 501', seller = process.argv[3];
const id = process.env.EBAY_CLIENT_ID, secret = process.env.EBAY_CLIENT_SECRET;
if (!id || !secret) { console.error('EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are not both in this process (read by presence only)'); process.exit(2); }

const tokens = appTokenSource({ client_id: id, client_secret: secret });
const client: Client = {
  env: 'production',
  app_token: tokens,
  user_token: async () => ({ ok: false }),
  async send(req, s): Promise<Reply> {
    const r = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body, signal: s });
    const text = await r.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch (error) { if (!(error instanceof SyntaxError)) throw error; /* XML or empty stays a string */ }
    return { status: r.status, headers: Object.fromEntries(r.headers), body };
  },
};
const s = AbortSignal.timeout(60_000);
const ads = Object.fromEntries(ebayAdapters(client).map(a => [a.manifest.verb, a]));
const timed = async (read: string, f: () => Promise<AdapterResult>) => {
  const t0 = performance.now();
  const r = await f();
  const count = r.ok ? (Array.isArray(r.data) ? r.data.length : 1) : 0;
  console.log(JSON.stringify({ read, ok: r.ok, count, ms: Math.round(performance.now() - t0), ...(r.ok ? {} : { error: r.error.code }) }));
  return r;
};
const found = await timed('search', () => ads.search!.run({ q, limit: 5 }, s));
await timed('search_sold', () => ads.search!.run({ q, status: 'sold' }, s));
const first = found.ok && Array.isArray(found.data) ? (found.data[0] as { external_id?: string } | undefined) : undefined;
if (first?.external_id) await timed('read_item', () => readItem(client, first.external_id!, s));
if (seller) await timed('read_storefront', () => ads.read_storefront!.run({ username: seller }, s));
