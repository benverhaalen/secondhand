import { createLog, consoleSink } from '../../../../../../log/index.js';
const log = createLog({ src: 'app.src.edge.harness.sites.ebay.recon', build: process.env.BUILD_SHA ?? 'dev', sink: consoleSink });
// eBay page recon on one Browser Use Cloud browser, sequential: search by its URL, sold search, zero-result search, the first
// listing, the first sold listing (ended), a listing id that does not exist, the first listing's seller storefront, and last the
// same search typed into the site's own box from the home page. Writes each document as <name>.html outside the repo (masked
// before it becomes a fixture) and logs status, bytes, time and title only: no handle or URL. Nothing is intercepted: blocking
// images and fonts with page.route is what drew eBay's 403 (README.md, Public pages). It never signs in; a challenge is
// recorded and it stops, never solved or clicked through.
//   node --no-warnings app/src/edge/harness/sites/ebay/recon.ts <out-dir> [query]
import { freemem } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { browserUseCloud, cdpLauncher, type CdpPw } from '../../../browser/cdp.ts';
import { CHALLENGE, URLS } from './adapter.ts';

type Page = { goto(url: string, o: { waitUntil: string; timeout: number }): Promise<{ status(): number } | null>;
  content(): Promise<string>; title(): Promise<string>; waitForTimeout(ms: number): Promise<void>;
  fill(sel: string, v: string): Promise<void>; press(sel: string, key: string): Promise<void>;
  waitForURL(u: RegExp, o: { waitUntil: string; timeout: number }): Promise<void> };

const [out, q = 'levis 501 jeans'] = process.argv.slice(2);
const apiKey = process.env.BROWSER_USE_API_KEY;
if (!out) { log.note('usage: recon.ts <out-dir> [query]'); process.exit(2); }
if (!apiKey) { log.note('BROWSER_USE_API_KEY is not in this process (it is read by presence only)'); process.exit(2); }
if (freemem() < 4 * 2 ** 30) { log.note(`only ${(freemem() / 2 ** 30).toFixed(1)} GB free: not starting`); process.exit(3); }
mkdirSync(out, { recursive: true });

const pw = createRequire(import.meta.url)('playwright-core') as CdpPw;
const t0 = performance.now(), at = () => Math.round(performance.now() - t0);
const ctx = await cdpLauncher(pw, browserUseCloud({ apiKey, timeoutMin: 3 })).anonymous({ headless: true });
log.note('recon.connected', { connected_ms: at() });
try {
  const candidate: unknown = await ctx.newPage();
  if (!candidate || typeof candidate !== 'object' || !['goto', 'title', 'content', 'waitForTimeout', 'fill', 'press', 'waitForURL'].every(k => typeof Reflect.get(candidate, k) === 'function')) throw new Error('CDP returned an incomplete page');
  const page = candidate as Page;
  const save = async (name: string, status: number, a: number) => {
    await page.waitForTimeout(1500);
    const html = await page.content(), title = await page.title();
    writeFileSync(join(out, `${name}.html`), html);
    const challenge = CHALLENGE.test(title) || CHALLENGE.test(html.slice(0, 20_000));
    log.note('recon.page', { name, status, bytes: html.length, ms: at() - a, title: title.slice(0, 60), items: new Set(html.match(/\/itm\/\d{9,}/g)).size, challenge });
    if (challenge) throw new Error(`eBay showed a check on ${name}: stopped`);
    return html;
  };
  const open = async (name: string, url: string) => {
    const a = at();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    return save(name, res?.status() ?? 0, a);
  };
  const ids = (html: string) => [...new Set([...html.matchAll(/\/itm\/(\d{9,})/g)].map(m => m[1]!))];
  const search = await open('search', URLS.search(q, false));
  await open('sold', URLS.search(q, true));
  await open('empty', URLS.search('qqzxqqzxqqzx vvbnm', false));
  const live = ids(search)[0];
  const item = live ? await open('item', URLS.item(live)) : '';
  await open('item-404', URLS.item('100000000001'));
  const seller = /ebay\.com\/sch\/([\w.\-]+)\/m\.html/.exec(item)?.[1];
  if (seller) await open('store', URLS.store(seller)); // the handle stays in memory, never logged
  // the second way in: the home page, a pause, then the search typed into the site's box
  await open('home', 'https://www.ebay.com/');
  await page.waitForTimeout(4000);
  const a = at();
  await page.fill('input#gh-ac, input[name="_nkw"]', q);
  await page.press('input#gh-ac, input[name="_nkw"]', 'Enter');
  await page.waitForURL(/\/sch\//, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await save('search-box', 0, a);
} catch (e) {
  log.error('recon', e);
} finally {
  await ctx.close(); // stops the cloud browser and its billing
  log.note('recon.stopped', { stopped_ms: at() });
  log.end();
}
