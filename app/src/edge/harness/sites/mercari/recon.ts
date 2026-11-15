import { createLog, consoleSink } from '../../../../../../log/index.js';
const log = createLog({ src: 'app.src.edge.harness.sites.mercari.recon', build: process.env.BUILD_SHA ?? 'dev', sink: consoleSink });
// Mercari recon on a Browser Use Cloud browser: open each url, keep the document and the JSON the page's own web client fetched
// (redacted by the kernel's recordVerb), and write them outside the repo. Prints one JSON line per page: status, embedded state,
// each call's path, method, status and response shape, and the names (never values) of the request headers the client added.
// It never signs in; a challenge or login wall is recorded and it stops.
//   node --no-warnings app/src/edge/harness/sites/mercari/recon.ts <out-dir> <url> [url...]
import { freemem } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { browserUseCloud, cdpLauncher, type CdpPw } from '../../../browser/cdp.ts';
import { recordVerb, type ReconPage } from '../../recon/recon.ts';

type Route = { request(): { resourceType(): string }; abort(): Promise<void>; continue(): Promise<void> };
type Req = { url(): string; method(): string; resourceType(): string; headers(): Record<string, string> };
type Page = ReconPage & { route(p: string, h: (r: Route) => void): Promise<void>; content(): Promise<string>; close(): Promise<void>;
  on(ev: 'request', fn: (r: Req) => void): void };

// A value's shape: types in place of values, an array as its length and its first element's shape.
export function shape(v: unknown, d = 0): unknown {
  if (Array.isArray(v)) return v.length ? [`len ${v.length}`, d > 6 ? '…' : shape(v[0], d + 1)] : [];
  if (v && typeof v === 'object') return d > 6 ? '{…}' : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x, d + 1)]));
  return v === null ? 'null' : typeof v;
}

const [out, ...urls] = process.argv.slice(2);
const apiKey = process.env.BROWSER_USE_API_KEY;
if (!out || !urls.length) { log.note('usage: recon.ts <out-dir> <url> [url...]'); process.exit(2); }
if (!apiKey) { log.note('BROWSER_USE_API_KEY is not in this process (it is read by presence only)'); process.exit(2); }
// the browser runs in the cloud; this process needs a few hundred MB, so 2 GB free is the floor
if (freemem() < 2 * 2 ** 30) { log.note(`only ${(freemem() / 2 ** 30).toFixed(1)} GB free: not starting`); process.exit(3); }
mkdirSync(out, { recursive: true });

const pw = createRequire(import.meta.url)('playwright-core') as CdpPw;
const t0 = performance.now(), at = () => Math.round(performance.now() - t0);
const ctx = await cdpLauncher(pw, browserUseCloud({ apiKey, timeoutMin: 2 })).anonymous({ headless: true });
log.note('recon.connected', { connected_ms: at() });
try {
  for (const [i, url] of urls.entries()) {
    const candidate: unknown = await ctx.newPage();
    if (!candidate || typeof candidate !== 'object' || !['route', 'on', 'goto', 'waitForTimeout', 'title', 'evaluate', 'content'].every(k => typeof Reflect.get(candidate, k) === 'function')) throw new Error('CDP returned an incomplete page');
    const page = candidate as Page;
    await page.route('**/*', r => { if (['image', 'media', 'font'].includes(r.request().resourceType())) void r.abort(); else void r.continue(); });
    // First-party API requests: path, query keys and header names only, so no token or cookie value is ever kept.
    const reqs: { path: string; method: string; query: string[]; headers: string[] }[] = [];
    page.on('request', r => {
      if (!['xhr', 'fetch'].includes(r.resourceType()) || reqs.length >= 40) return;
      const u = new URL(r.url());
      if (!u.hostname.endsWith('mercari.com')) return;
      reqs.push({ path: u.pathname, method: r.method(), query: [...u.searchParams.keys()].concat(u.searchParams.get('operationName') ?? []), headers: Object.keys(r.headers()).sort() });
    });
    const res = await recordVerb({ page, site: 'mercari', verb: 'search', url, account: 'public', settleMs: 5000 });
    const html = await page.content();
    writeFileSync(join(out, `${i}.html`), html);
    writeFileSync(join(out, `${i}.json`), JSON.stringify({ res, reqs }, null, 1));
    const line: Record<string, unknown> = { i, path: new URL(url).pathname, at_ms: at(), html_bytes: html.length };
    if (!res.ok) Object.assign(line, res);
    else Object.assign(line, { status: res.bundle.status, title: res.bundle.title.slice(0, 70), ms: res.bundle.ms,
      embedded: res.bundle.embedded.map(e => e.source),
      calls: res.bundle.network.map(c => ({ host: new URL(c.url).host, path: new URL(c.url).pathname, method: c.method, status: c.status, shape: JSON.stringify(shape(c.response)).slice(0, 300) })) });
    log.note('recon.page', line);
    await page.close();
    if (!res.ok) break; // a challenge or wall: stop and record, never route around it
  }
} catch (e) {
  log.error('recon', e);
} finally {
  await ctx.close(); // stops the cloud browser and its billing
  log.note('recon.stopped', { stopped_ms: at() });
  log.end();
}
