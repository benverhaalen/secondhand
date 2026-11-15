// Proves the Depop public reads live on one Browser Use Cloud browser: search, one listing, still up, the shop's storefront,
// its listings (active and sold) and its reviews. Prints one JSON line per read with its count and time; no handle or name is
// printed (the shop is reached from the first search result). It never signs in, and stops at a challenge.
//   node --no-warnings app/src/edge/harness/sites/depop/live.ts [query]
import { freemem } from 'node:os';
import { createRequire } from 'node:module';
import { createLog, consoleSink } from '../../../../../../log/index.js';
import { browserUseCloud, cdpLauncher, isCdpPw, type CdpPw } from '../../../browser/cdp.ts';
import { API, depopAdapters, PATHS, readListing, readReviews, stillUp, type Client } from './adapter.ts';

type Route = { request(): { resourceType(): string }; abort(): Promise<void>; continue(): Promise<void> };
type Page = { close(): Promise<void>; goto(url: string, o: { waitUntil: string; timeout: number }): Promise<{ status(): number } | null>; content(): Promise<string>;
  evaluate<R, A>(fn: (a: A) => Promise<R>, a: A): Promise<R>; route(p: string, h: (r: Route) => void): Promise<void> };

const log = createLog({ src: 'app.src.edge.harness.sites.depop.live', build: process.env.BUILD_SHA ?? 'dev', sink: consoleSink });

const q = process.argv[2] ?? 'carhartt hoodie';
const apiKey = process.env.BROWSER_USE_API_KEY;
if (!apiKey) { console.error('BROWSER_USE_API_KEY is not in this process (it is read by presence only)'); process.exit(2); }
if (freemem() < 4 * 2 ** 30) { console.error(`only ${(freemem() / 2 ** 30).toFixed(1)} GB free: not starting`); process.exit(3); }

const loadedPw: unknown = createRequire(import.meta.url)('playwright-core');
if (!isCdpPw<Page>(loadedPw)) throw new Error('Playwright CDP interface unavailable');
const pw: CdpPw<Page> = loadedPw;
const t0 = performance.now(), ms = () => Math.round(performance.now() - t0);
const ctx = await cdpLauncher(pw, browserUseCloud({ apiKey, timeoutMin: 2 })).anonymous({ headless: true });
console.log(JSON.stringify({ connected_ms: ms() }));
const s = AbortSignal.timeout(110_000);
try {
  const page = await ctx.newPage();
  await page.route('**/*', r => { if (['image', 'media', 'font'].includes(r.request().resourceType())) void r.abort(); else void r.continue(); });
  const client: Client = {
    signed_in: false,
    async doc(url) {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const html = await page.content();
      return { status: res?.status() ?? 0, html, challenge: /just a moment|captcha|are you a robot/i.test(html.slice(0, 20_000)) };
    },
    // The page's own origin calls webapi with credentials omitted (credentials include fails CORS, observed 2026-11-15).
    async json(path) {
      return page.evaluate(async (u: string) => { const r = await fetch(u, { credentials: 'omit' }); return { status: r.status, body: r.ok ? await r.json() : null }; }, API + path);
    },
  };
  const ads = Object.fromEntries(depopAdapters(client).map(a => [a.manifest.verb, a]));
  const timed = async (read: string, f: () => Promise<{ ok: boolean; data?: unknown; error?: unknown }>) => {
    const a = ms(); const r = await f();
    const count = Array.isArray(r.data) ? r.data.length : r.ok ? 1 : 0;
    console.log(JSON.stringify({ read, ok: r.ok, count, ms: ms() - a, ...(r.ok ? {} : { error: r.error }) }));
    return r;
  };
  const found = await timed('search', () => ads.search.run({ q }, s));
  const first = found.ok ? (found.data as { slug: string }[])[0] : undefined;
  if (first) {
    await timed('read_listing', () => readListing(client, first.slug, s));
    await timed('still_up', () => stillUp(client, first.slug, s));
    const raw = await client.json(PATHS.bySlug(first.slug), s); // the seller's handle stays in memory, never printed
    const seller = (raw.body as { seller?: { id?: number; username?: string } } | null)?.seller;
    if (seller?.username && seller.id) {
      const sf = await timed('read_storefront', () => ads.read_storefront.run({ username: seller.username }, s));
      if (sf.ok) console.log(JSON.stringify({ storefront_fields: Object.keys(sf.data as object) }));
      await timed('read_listings', () => ads.read_listings.run({ shop_id: String(seller.id) }, s));
      await timed('read_reviews', () => readReviews(client, String(seller.id), s));
    }
  }
  await timed('search_empty', () => ads.search.run({ q: 'qqzxqqzxqqzx vvbnm' }, s));
} catch (e) {
  log.error('live', e);
} finally {
  await ctx.close(); // stops the cloud browser and its billing
  console.log(JSON.stringify({ stopped_ms: ms() }));
}
