import { createLog, consoleSink } from '../../../../../../log/index.js';
const log = createLog({ src: 'app.src.edge.harness.sites.ebay.recon', build: process.env.BUILD_SHA ?? 'dev', sink: consoleSink });
// eBay page recon on one Browser Use Cloud browser, sequential: search, sold search, zero-result search, the first listing,
// the first sold listing (ended), a listing id that does not exist, and the first listing's seller storefront. Writes each
// document as <name>.html outside the repo (masked by hand before it becomes a fixture) and logs status, bytes and title only:
// no handle or URL. It never signs in; a challenge is recorded and it stops, never solved or clicked through.
//   node --no-warnings app/src/edge/harness/sites/ebay/recon.ts <out-dir> [query]
import { freemem } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { browserUseCloud, cdpLauncher, type CdpPw } from '../../../browser/cdp.ts';
import { CHALLENGE, URLS } from './adapter.ts';

type Route = { request(): { resourceType(): string }; abort(): Promise<void>; continue(): Promise<void> };
type Page = { goto(url: string, o: { waitUntil: string; timeout: number }): Promise<{ status(): number; text(): Promise<string> } | null>;
  content(): Promise<string>; title(): Promise<string>; route(p: string, h: (r: Route) => void): Promise<void> };

const [out, q = 'levis 501'] = process.argv.slice(2);
const apiKey = process.env.BROWSER_USE_API_KEY;
if (!out) { log.note('usage: recon.ts <out-dir> [query]'); process.exit(2); }
if (!apiKey) { log.note('BROWSER_USE_API_KEY is not in this process (it is read by presence only)'); process.exit(2); }
if (freemem() < 4 * 2 ** 30) { log.note(`only ${(freemem() / 2 ** 30).toFixed(1)} GB free: not starting`); process.exit(3); }
mkdirSync(out, { recursive: true });

const pw = createRequire(import.meta.url)('playwright-core') as CdpPw;
const t0 = performance.now(), at = () => Math.round(performance.now() - t0);
const ctx = await cdpLauncher(pw, browserUseCloud({ apiKey, timeoutMin: 2 })).anonymous({ headless: true });
log.note('recon.connected', { connected_ms: at() });
try {
  const candidate: unknown = await ctx.newPage();
  if (!candidate || typeof candidate !== 'object' || !['route', 'goto', 'title', 'content'].every(k => typeof Reflect.get(candidate, k) === 'function')) throw new Error('CDP returned an incomplete page');
  const page = candidate as Page;
  await page.route('**/*', r => { if (['image', 'media', 'font'].includes(r.request().resourceType())) void r.abort(); else void r.continue(); });
  const open = async (name: string, url: string) => {
    const a = at();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const html = (await res?.text().catch(() => '')) || await page.content();
    writeFileSync(join(out, `${name}.html`), html);
    const challenge = CHALLENGE.test(html.slice(0, 20_000));
    log.note('recon.page', { name, status: res?.status() ?? 0, bytes: html.length, ms: at() - a, title: (await page.title()).slice(0, 60), challenge });
    if (challenge) throw new Error(`eBay showed a check on ${name}: stopped`);
    return html;
  };
  const ids = (html: string) => [...new Set([...html.matchAll(/\/itm\/(\d{9,})/g)].map(m => m[1]!))];
  const search = await open('search', URLS.search(q, false));
  const sold = await open('sold', URLS.search(q, true));
  await open('empty', URLS.search('qqzxqqzxqqzx vvbnm', false));
  const live = ids(search)[0], ended = ids(sold)[0];
  const item = live ? await open('item', URLS.item(live)) : '';
  if (ended) await open('item-ended', URLS.item(ended));
  await open('item-404', URLS.item('100000000001'));
  const seller = /ebay\.com\/(?:str|usr)\/([\w.\-]+)/.exec(item)?.[1];
  if (seller) await open('store', URLS.store(seller)); // the handle stays in memory, never logged
} catch (e) {
  log.error('recon', e);
} finally {
  await ctx.close(); // stops the cloud browser and its billing
  log.note('recon.stopped', { stopped_ms: at() });
  log.end();
}
