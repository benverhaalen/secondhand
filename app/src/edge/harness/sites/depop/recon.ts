// Depop recon on a Browser Use Cloud browser: open each url, keep the document and the JSON the page's own client fetched
// (redacted by the kernel's recordVerb), and write them outside the repo. Prints one JSON line per page: status, timings and
// each call's path, method, status and response shape. It never signs in; a challenge or login wall is recorded and it stops.
//   node --no-warnings app/src/edge/harness/sites/depop/recon.ts <out-dir> <url> [url...]
import { freemem } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { browserUseCloud, cdpLauncher, type CdpPw } from '../../../browser/cdp.ts';
import { recordVerb, type ReconPage } from '../../recon/recon.ts';

type Route = { request(): { resourceType(): string }; abort(): Promise<void>; continue(): Promise<void> };
type Page = ReconPage & { route(p: string, h: (r: Route) => void): Promise<void>; content(): Promise<string>; close(): Promise<void> };

// A value's shape: types in place of values, an array as its length and its first element's shape.
export function shape(v: unknown, d = 0): unknown {
  if (Array.isArray(v)) return v.length ? [`len ${v.length}`, d > 6 ? '…' : shape(v[0], d + 1)] : [];
  if (v && typeof v === 'object') return d > 6 ? '{…}' : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x, d + 1)]));
  return v === null ? 'null' : typeof v;
}

const [out, ...urls] = process.argv.slice(2);
const apiKey = process.env.BROWSER_USE_API_KEY;
if (!out || !urls.length) { console.error('usage: recon.ts <out-dir> <url> [url...]'); process.exit(2); }
if (!apiKey) { console.error('BROWSER_USE_API_KEY is not in this process (it is read by presence only)'); process.exit(2); }
if (freemem() < 4 * 2 ** 30) { console.error(`only ${(freemem() / 2 ** 30).toFixed(1)} GB free: not starting`); process.exit(3); }
mkdirSync(out, { recursive: true });

const pw = createRequire(import.meta.url)('playwright-core') as CdpPw;
const t0 = performance.now(), at = () => Math.round(performance.now() - t0);
const ctx = await cdpLauncher(pw, browserUseCloud({ apiKey, timeoutMin: 2 })).anonymous({ headless: true });
console.log(JSON.stringify({ connected_ms: at() }));
try {
  for (const [i, url] of urls.entries()) {
    const page = await ctx.newPage() as unknown as Page;
    await page.route('**/*', r => { if (['image', 'media', 'font'].includes(r.request().resourceType())) void r.abort(); else void r.continue(); });
    const res = await recordVerb({ page, site: 'depop', verb: 'search', url, account: 'public', settleMs: 4000 });
    const html = await page.content().catch(() => '');
    writeFileSync(join(out, `${i}.html`), html);
    writeFileSync(join(out, `${i}.json`), JSON.stringify(res, null, 1));
    const line: Record<string, unknown> = { i, path: new URL(url).pathname, at_ms: at(), html_bytes: html.length };
    if (!res.ok) Object.assign(line, res);
    else Object.assign(line, { status: res.bundle.status, title: res.bundle.title.slice(0, 70), ms: res.bundle.ms,
      embedded: res.bundle.embedded.map(e => e.source),
      calls: res.bundle.network.map(c => ({ host: new URL(c.url).host, path: new URL(c.url).pathname, method: c.method, status: c.status, shape: JSON.stringify(shape(c.response)).slice(0, 400) })) });
    console.log(JSON.stringify(line));
    await page.close();
    if (!res.ok) break; // a challenge or wall: stop and record, never route around it
  }
} catch (e) {
  console.log(JSON.stringify({ error: (e as Error).message.replace(/(wss?|https?):\/\/\S+/g, '[url]').slice(0, 200) }));
} finally {
  await ctx.close(); // stops the cloud browser and its billing
  console.log(JSON.stringify({ stopped_ms: at() }));
}
