import { createLog, consoleSink } from '../../../../../../log/index.js';
const log = createLog({ src: 'app.src.edge.harness.sites.ebay.live-page', build: process.env.BUILD_SHA ?? 'dev', sink: consoleSink });
// The eBay page lane, live, on one Browser Use Cloud browser, sequential and paced, about six loads: search on ebay.com, sold
// search with no session (relink, no load), one listing, the still-listed check, the seller's storefront, the search on
// ebay.co.uk with the US location filter (ebay.com answered as its error page here, so the fallback runs; nothing is loaded for
// it), and one ebay.co.uk item page to see whether eBay shows the original US amount. Nothing is intercepted. Logs verb, result,
// count, ms and host only: no URL or handle. A bot check stops the run; it is never solved or clicked through.
//   node --no-warnings app/src/edge/harness/sites/ebay/live-page.ts [query]
import { freemem } from 'node:os';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { browserUseCloud, cdpLauncher, type CdpPw } from '../../../browser/cdp.ts';
import { ebayPageAdapters, readItemPage, stillUpPage, PAGE_HOSTS, type EbayPage, type PageClient } from './adapter.ts';
import type { AdapterResult } from '../../protocol.ts';

type Page = { goto(url: string, o: { waitUntil: string; timeout: number }): Promise<{ status(): number } | null>;
  content(): Promise<string>; waitForTimeout(ms: number): Promise<void> };

const [q = 'levis 501 jeans'] = process.argv.slice(2);
const apiKey = process.env.BROWSER_USE_API_KEY;
if (!apiKey) { log.note('BROWSER_USE_API_KEY is not in this process (it is read by presence only)'); process.exit(2); }
if (freemem() < 4 * 2 ** 30) { log.note(`only ${(freemem() / 2 ** 30).toFixed(1)} GB free: not starting`); process.exit(3); }

const pw = createRequire(import.meta.url)('playwright-core') as CdpPw;
const t0 = performance.now(), at = () => Math.round(performance.now() - t0);
const ctx = await cdpLauncher(pw, browserUseCloud({ apiKey, timeoutMin: 3 })).anonymous({ headless: true });
log.note('live.connected', { connected_ms: at() });
let loads = 0;
try {
  const candidate: unknown = await ctx.newPage();
  if (!candidate || typeof candidate !== 'object' || !['goto', 'content', 'waitForTimeout'].every(k => typeof Reflect.get(candidate, k) === 'function')) throw new Error('CDP returned an incomplete page');
  const page = candidate as Page;
  let last = '';
  const load = async (url: string): Promise<EbayPage> => {
    if (loads) await delay(5000); // polite pace between every load
    loads++;
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1500);
    last = await page.content();
    return { status: res?.status() ?? 0, html: last };
  };
  const c: PageClient = { signed_in: false, page: load };
  const signal = new AbortController().signal;
  const report = async (read: string, f: () => Promise<AdapterResult>) => {
    const a = at(), r = await f();
    const rows = r.ok && Array.isArray(r.data) ? (r.data as Record<string, unknown>[]) : [];
    log.note('live.read', { read, ok: r.ok, code: r.ok ? undefined : r.error.code, count: r.ok ? (Array.isArray(r.data) ? rows.length : 1) : 0, ms: at() - a, host: rows[0]?.host, currency: rows[0]?.currency, converted: rows[0]?.converted, loads });
    if (!r.ok && r.error.code === 'blocked') throw new Error(`eBay refused or checked on ${read}: stopped`);
    return rows;
  };
  const search = ebayPageAdapters(c).find(a => a.route_id === 'ebay.search.page')!, store = ebayPageAdapters(c).find(a => a.route_id === 'ebay.read_storefront.page')!;

  const rows = await report('search', () => search.run({ q }, signal));
  await report('search.sold', () => search.run({ q, status: 'sold' }, signal));
  const id = String(rows[0]?.item_id ?? '');
  await report('read_item', () => readItemPage(c, id, signal));
  const seller = /ebay\.com\/sch\/([\w.\-]+)\/m\.html/.exec(last)?.[1]; // stays in memory, never logged
  await report('still_up', () => stillUpPage(c, id, signal));
  if (seller) await report('read_storefront', () => store.run({ username: seller }, signal));

  // ebay.com answers as its error page for this read only, so the fallback to ebay.co.uk runs without a wasted load
  const uk: PageClient = { signed_in: false, page: async url => url.startsWith(PAGE_HOSTS[0].www) ? { status: 403, html: '<title>Error Page | eBay</title>' } : load(url) };
  const ukSearch = ebayPageAdapters(uk).find(a => a.route_id === 'ebay.search.page')!;
  const ukRows = await report('search.uk', () => ukSearch.run({ q }, signal));
  const ukId = String(ukRows[0]?.item_id ?? '');
  if (/^\d+$/.test(ukId)) {
    const a = at(), p = await load(`${PAGE_HOSTS[1].www}/itm/${ukId}`);
    const ld = [...p.html.matchAll(/"priceCurrency"\s*:\s*"([A-Z]{3})"/g)].map(m => m[1]);
    log.note('live.uk_item', { status: p.status, ms: at() - a, ld_currency: [...new Set(ld)], us_amount_shown: /US \$\s?[\d,]+\.\d{2}/.test(p.html), gbp_shown: /£\s?[\d,]+\.\d{2}/.test(p.html), loads });
  }
} catch (e) {
  log.error('live', e);
} finally {
  await ctx.close(); // stops the cloud browser and its billing
  log.note('live.stopped', { stopped_ms: at(), loads });
  log.end();
}
