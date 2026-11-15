// Proves the Mercari public reads live on one Browser Use Cloud browser: search (active, sold, empty), one listing, still up,
// the seller's storefront, their listings and their reviews. Prints one JSON line per read with its count and time; no id or
// name is printed (the seller is reached from the first search result). It never signs in, and stops at a challenge.
// Last, it prints the lines of the terms page that speak to automated access, for the README's terms table.
//   node --no-warnings app/src/edge/harness/sites/mercari/live.ts [query]
import { freemem } from 'node:os';
import { createRequire } from 'node:module';
import { browserUseCloud, cdpLauncher, type CdpPw } from '../../../browser/cdp.ts';
import { mercariAdapters, nextData, readListing, readReviews, stillUp, type Client, type Page } from './adapter.ts';

type Res = { url(): string; json(): Promise<unknown>; request(): { url(): string; postData(): string | null } };
type Route = { request(): { resourceType(): string }; abort(): Promise<void>; continue(): Promise<void> };
type PwPage = { goto(url: string, o: { waitUntil: string; timeout: number }): Promise<{ status(): number } | null>; content(): Promise<string>;
  waitForTimeout(ms: number): Promise<void>; evaluate<R>(fn: () => R): Promise<R>; on(e: 'response', h: (r: Res) => void): void;
  route(p: string, h: (r: Route) => void): Promise<void> };

const q = process.argv[2] ?? 'carhartt hoodie';
const apiKey = process.env.BROWSER_USE_API_KEY;
if (!apiKey) { console.error('BROWSER_USE_API_KEY is not in this process (it is read by presence only)'); process.exit(2); }
if (freemem() < 4 * 2 ** 30) { console.error(`only ${(freemem() / 2 ** 30).toFixed(1)} GB free: not starting`); process.exit(3); }

const pw = createRequire(import.meta.url)('playwright-core') as CdpPw;
const t0 = performance.now(), ms = () => Math.round(performance.now() - t0);
const ctx = await cdpLauncher(pw, browserUseCloud({ apiKey, timeoutMin: 2 })).anonymous({ headless: true });
console.log(JSON.stringify({ connected_ms: ms() }));
const s = AbortSignal.timeout(110_000);
try {
  const page = await ctx.newPage() as unknown as PwPage;
  await page.route('**/*', r => { if (['image', 'media', 'font'].includes(r.request().resourceType())) void r.abort(); else void r.continue(); });
  // The page's own GraphQL answers, named by operationName (a url param on GET, a body field on POST).
  let api: Page['api'] = [];
  page.on('response', r => {
    const u = new URL(r.url()); if (u.pathname !== '/v1/api') return;
    let name = u.searchParams.get('operationName') ?? undefined;
    if (!name) { try { name = (JSON.parse(r.request().postData() ?? '{}') as { operationName?: string }).operationName; } catch { /* not json */ } }
    // An answer whose request names no operation falls back to its first data key.
    r.json().then(body => {
      const data = (body as { data?: Record<string, unknown> } | null)?.data;
      api.push({ op: name ?? (data ? Object.keys(data)[0] : undefined), body });
    }, () => {});
  });
  let last: Page | undefined;
  const client: Client = {
    signed_in: false,
    async page(url) {
      api = [];
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(4000); // the client-side queries land after the document
      const html = await page.content();
      last = { status: res?.status() ?? 0, html, api, challenge: /px-captcha|press (&amp;|&) hold|are you a robot|just a moment/i.test(html.slice(0, 50_000)) };
      return last;
    },
  };
  const ads = Object.fromEntries(mercariAdapters(client).map(a => [a.manifest.verb, a]));
  const timed = async (read: string, f: () => Promise<{ ok: boolean; data?: unknown; error?: unknown }>) => {
    const a = ms();
    // one read's own failure (a timeout, a closed page) is printed and the run goes on
    const r: { ok: boolean; data?: unknown; error?: unknown } = await f().catch((e: Error) => ({ ok: false, error: e.message.replace(/(wss?|https?):\/\/\S+/g, '[url]').slice(0, 200) }));
    const count = Array.isArray(r.data) ? r.data.length : r.ok ? 1 : 0;
    // on a failure, the status and the op names the page answered with (names only), to see what moved
    console.log(JSON.stringify({ read, ok: r.ok, count, ms: ms() - a, ...(r.ok ? {} : { error: r.error, status: last?.status, ops: last?.api.map(x => x.op) }) }));
    return r;
  };
  const found = await timed('search', () => ads.search.run({ q }, s));
  await timed('search_sold', () => ads.search.run({ q, status: 'sold' }, s));
  const first = found.ok ? (found.data as { external_id: string; state: string }[]).find(x => x.state === 'live') : undefined;
  if (first) {
    await timed('read_listing', () => readListing(client, first.external_id, s));
    // the seller's id and username stay in memory, never printed
    const st = nextData(last?.html ?? '')?.serverState as Record<string, { id?: unknown; username?: unknown; seller?: { __ref?: string } }> | undefined;
    const seller = st?.[st?.[`ItemDetail:${first.external_id}`]?.seller?.__ref ?? ''];
    await timed('still_up', () => stillUp(client, first.external_id, s));
    if (seller?.id) {
      const sf = await timed('read_storefront', () => ads.read_storefront.run({ user_id: String(seller.id) }, s));
      if (sf.ok) console.log(JSON.stringify({ storefront_fields: Object.keys(sf.data as object) }));
      await timed('read_listings', () => ads.read_listings.run({ seller_id: String(seller.id) }, s));
      if (typeof seller.username === 'string') await timed('read_reviews', () => readReviews(client, seller.username as string, s));
    }
  }
  await timed('search_empty', () => ads.search.run({ q: 'zqxjvbnmwk plorpt' }, s));
  const a = ms();
  // /us/tos/ answers a 404 page (observed); the terms are wherever the footer's Terms of Service link points.
  await client.page('https://www.mercari.com/', s);
  const tos = await page.evaluate(() => [...document.querySelectorAll('a')].find(e => /^terms of service$/i.test(e.textContent?.trim() ?? ''))?.href ?? '');
  if (tos) await client.page(tos, s);
  const text = await page.evaluate(() => document.body.innerText);
  const hits = text.split('\n').filter(l => /robot|spider|scrap|crawl|automated (means|system|software|tool)/i.test(l)).map(l => l.trim().slice(0, 400));
  console.log(JSON.stringify({ read: 'terms', url: tos, ms: ms() - a, chars: text.length, automation_lines: hits.slice(0, 6) }));
} catch (e) {
  console.log(JSON.stringify({ error: (e as Error).message.replace(/(wss?|https?):\/\/\S+/g, '[url]').slice(0, 200) }));
} finally {
  await ctx.close(); // stops the cloud browser and its billing
  console.log(JSON.stringify({ stopped_ms: ms() }));
}
