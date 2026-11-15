import { createLog, consoleSink } from '../../../../log/index.js';
const log = createLog({ src: 'app.src.edge.browser.cloud-read', build: process.env.BUILD_SHA ?? 'dev', sink: consoleSink });
// Milestone M1 as one command: a Browser Use Cloud browser is created, reached over CDP, reads one public search page
// with no model in the loop, and is stopped. Prints one JSON line of counts and timings; never prints the key or a URL that carries it.
//   node app/src/edge/browser/cloud-read.ts [site] [query]
import { freemem } from 'node:os';
import { createRequire } from 'node:module';
import { browserUseCloud, cdpLauncher, type CdpPw } from './cdp.ts';
import { readPage, searchUrl } from '../intel/public/readers.ts';
import type { Site } from '../harness/names.ts';

type Route = { request(): { resourceType(): string }; abort(): Promise<void>; continue(): Promise<void> };
type Resp = { headers(): Record<string, string> };
type Page = { close(): Promise<void>; route(p: string, h: (r: Route) => void): Promise<void>; on(ev: 'response', fn: (r: Resp) => void): void;
  goto(u: string, o: object): Promise<{ status(): number } | null>; waitForSelector(s: string, o: object): Promise<unknown>; content(): Promise<string>; title(): Promise<string> };

const [site = 'depop', query = 'carhartt jacket'] = process.argv.slice(2) as [Site?, string?];
const apiKey = process.env.BROWSER_USE_API_KEY;
if (!apiKey) { log.note('BROWSER_USE_API_KEY is not in this process (it is read by presence only)'); process.exit(2); }
// This machine has crashed under memory load: refuse to start with little free, even though the browser itself runs in the cloud.
if (freemem() < 4 * 2 ** 30) { log.note(`only ${(freemem() / 2 ** 30).toFixed(1)} GB free: not starting`); process.exit(3); }
const url = searchUrl(site, query, 'search');
if (!url) { log.note(`${site} has no public search url`); process.exit(2); }

const pw = createRequire(import.meta.url)('playwright-core') as CdpPw;
const t0 = performance.now(), at = () => Math.round(performance.now() - t0);
const out: Record<string, unknown> = { site, query, route: 'cloud', timeout_min: 2 };
const ctx = await cdpLauncher(pw, browserUseCloud({ apiKey, timeoutMin: 2 })).anonymous({ headless: true });
out.connected_ms = at();
try {
  const candidate: unknown = await ctx.newPage();
  if (!candidate || typeof candidate !== 'object' || !["route", "on", "goto", "waitForSelector", "content", "title"].every(k => typeof Reflect.get(candidate, k) === 'function')) throw new Error('CDP returned an incomplete page');
  const page = candidate as Page;
  let bytes = 0, blocked = 0;
  await page.route('**/*', r => { if (['image', 'media', 'font'].includes(r.request().resourceType())) { blocked++; void r.abort(); } else void r.continue(); });
  page.on('response', r => { bytes += Number(r.headers()['content-length'] ?? 0); });
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  out.status = res?.status() ?? null; out.loaded_ms = at();
  await page.waitForSelector('a[href*="/products/"], a[href*="/listing/"], a[href*="/itm/"], a[href*="/item/"]', { timeout: 15_000 }).catch(e => { log.error('cloud.read.wait', e); });
  const html = await page.content();
  if (process.env.CLOUD_READ_DUMP) (await import('node:fs')).writeFileSync(process.env.CLOUD_READ_DUMP, html); // a debugging aid: the page as read, to a path outside the repo
  const read = readPage(site, html, 'search');
  const rows = read.ok ? read.data : [];
  Object.assign(out, { read_ms: at(), title: (await page.title()).slice(0, 60), outcome: (out.status as number) >= 400 ? 'blocked' : read.ok ? 'ok' : read.error.code, reason: (out.status as number) >= 400 ? `the site answered ${out.status}` : read.ok ? undefined : read.error.message, count: rows.length,
    first: rows.slice(0, 3).map(r => ({ title: String(r.title ?? '').slice(0, 50), price_cents: r.price_cents })), bytes_declared: bytes, blocked_requests: blocked });
} catch (e) {
  out.error = (e as Error).message.replace(/(wss?|https?):\/\/\S+/g, '[url]').slice(0, 200);
} finally {
  await ctx.close(); // stops the cloud browser, which ends its billing
  out.stopped_ms = at();
  log.note('cloud.read', out);
  log.end();
}
