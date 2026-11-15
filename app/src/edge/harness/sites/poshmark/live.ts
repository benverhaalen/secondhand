import { createLog, consoleSink } from '../../../../../../log/index.js';
const log = createLog({ src: 'app.src.edge.harness.sites.poshmark.live', build: process.env.BUILD_SHA ?? 'dev', sink: consoleSink });
// Proves the Poshmark public reads live on one Browser Use Cloud browser: search (active, sold, empty), one listing, still up,
// its comments, the seller's closet figures and listings (active and sold), and love notes. Logs one line per read with its
// count and time; no handle or name is logged (the closet is reached from the first search result). It never signs in, and
// a challenge stops the read that met it.
//   node --no-warnings app/src/edge/harness/sites/poshmark/live.ts [query]
import { freemem } from 'node:os';
import { createRequire } from 'node:module';
import { browserUseCloud, cdpLauncher, isCdpPw, type CdpPw } from '../../../browser/cdp.ts';
import { poshmarkAdapters, readComments, readListing, readReviews, state, stillUp, URLS, type Client } from './adapter.ts';

type Route = { request(): { resourceType(): string }; abort(): Promise<void>; continue(): Promise<void> };
type Page = { close(): Promise<void>; goto(url: string, o: { waitUntil: string; timeout: number }): Promise<{ status(): number; text(): Promise<string> } | null>; content(): Promise<string>;
  route(p: string, h: (r: Route) => void): Promise<void> };

const q = process.argv[2] ?? 'levis 501';
const apiKey = process.env.BROWSER_USE_API_KEY;
if (!apiKey) { log.note('BROWSER_USE_API_KEY is not in this process (it is read by presence only)'); process.exit(2); }
if (freemem() < 4 * 2 ** 30) { log.note(`only ${(freemem() / 2 ** 30).toFixed(1)} GB free: not starting`); process.exit(3); }

const loadedPw: unknown = createRequire(import.meta.url)('playwright-core');
if (!isCdpPw<Page>(loadedPw)) throw new Error('Playwright CDP interface unavailable');
const pw: CdpPw<Page> = loadedPw;
const t0 = performance.now(), ms = () => Math.round(performance.now() - t0);
// shortcut: since 2026-11-15 the create reply's cdpUrl is https and cdp.ts parseBrowser takes ws/wss only; this resolves it to its
// websocket (the CDP /json/version endpoint) until the kernel accepts https, then delete this and pass no fetchFn
const fetchFn: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (init?.method !== 'POST' || !res.ok) return res;
  const b = await res.json() as Record<string, unknown>;
  try {
    if (typeof b.cdpUrl === 'string' && b.cdpUrl.startsWith('https:')) {
      const v = await (await fetch(`${b.cdpUrl.replace(/\/$/, '')}/json/version`)).json() as { webSocketDebuggerUrl?: unknown };
      b.cdpUrl = v.webSocketDebuggerUrl;
    }
  } catch (e) { // the browser exists: stop it before failing
    if (typeof b.id === 'string') {
      try { await fetch(`${String(input).replace(/\/$/, '')}/${encodeURIComponent(b.id)}`, { method: 'PATCH', headers: init.headers, body: JSON.stringify({ action: 'stop' }) }); }
      catch (cleanupError) { log.error('live.browser.stop', cleanupError); }
    }
    throw e;
  }
  return new Response(JSON.stringify(b), { status: res.status });
};
const ctx = await cdpLauncher(pw, browserUseCloud({ apiKey, timeoutMin: 2, fetchFn })).anonymous({ headless: true });
log.note('live.connected', { connected_ms: ms() });
const s = AbortSignal.timeout(110_000);
try {
  const page = await ctx.newPage();
  await page.route('**/*', r => { if (['image', 'media', 'font'].includes(r.request().resourceType())) void r.abort(); else void r.continue(); });
  const client: Client = {
    signed_in: false,
    async doc(url) {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      // the server's own HTML: after hydration the DOM may no longer carry the state script
      const html = (await res?.text().catch(() => '')) || await page.content();
      log.note('live.page', { status: res?.status() ?? 0, bytes: html.length, state: html.includes('__INITIAL_STATE__') });
      return { status: res?.status() ?? 0, html, challenge: /just a moment|captcha|are you a robot|access denied/i.test(html.slice(0, 20_000)) };
    },
    async json() { return { status: 401, body: null }; }, // public run: the signed-in calls are not made
  };
  const ads = Object.fromEntries(poshmarkAdapters(client).map(a => [a.manifest.verb, a]));
  const timed = async (read: string, f: () => Promise<{ ok: boolean; data?: unknown; error?: unknown }>) => {
    const a = ms();
    const r: { ok: boolean; data?: unknown; error?: unknown } = await f().catch((e: Error) => {
      log.error('live.read', e);
      return { ok: false, error: e.message.replace(/(wss?|https?):\/\/\S+/g, '[url]').slice(0, 120) };
    });
    const count = Array.isArray(r.data) ? r.data.length : r.ok ? 1 : 0;
    log.note('live.read', { read, ok: r.ok, count, ms: ms() - a, ...(r.ok ? {} : { error: (r.error as { code?: string })?.code ?? r.error }) }); // the code only: a hint can carry a handle
    return r;
  };
  const found = await timed('search', () => ads.search.run({ q }, s));
  await timed('search_sold', () => ads.search.run({ q, status: 'sold' }, s));
  await timed('search_sorted', () => ads.search.run({ q, sort: 'added_desc' }, s));
  const first = found.ok ? (found.data as { external_id: string }[])[0] : undefined;
  if (first) {
    await timed('read_listing', () => readListing(client, first.external_id, s));
    await timed('still_up', () => stillUp(client, first.external_id, s));
    await timed('read_comments', () => readComments(client, first.external_id, s));
    // the seller's handle stays in memory, never logged
    const u = (state((await client.doc(URLS.listing(first.external_id), s)).html)?.$_listing_details as { listingDetails?: { creator_username?: string } } | undefined)?.listingDetails?.creator_username;
    if (u) {
      const sf = await timed('read_storefront', () => ads.read_storefront.run({ username: u }, s));
      if (sf.ok) log.note('live.storefront_fields', { fields: Object.keys(sf.data as object) });
      await timed('read_listings', () => ads.read_listings.run({ username: u }, s));
      await timed('read_reviews', () => readReviews(client, u));
    }
  }
  await timed('search_empty', () => ads.search.run({ q: 'qqzxqqzxqqzx vvbnm' }, s));
} catch (e) {
  log.error('live', e);
} finally {
  await ctx.close(); // stops the cloud browser and its billing
  log.note('live.stopped', { stopped_ms: ms() });
  log.end();
}
