// T0-1 probe app on Databricks Apps: the front door (auth, an unauthenticated hook, SSE) and our real browser pool
// (app/src/edge/browser/pool.ts and playwright.ts, copied into lib/ at deploy) on the app's own compute.
// Public reads only, a polite few; no login, no account, nothing forged.
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
const PORT = Number(process.env.DATABRICKS_APP_PORT ?? 8000);
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

let install; // one Chromium install per app start, measured
function ensureChromium() {
  install ??= (async () => {
    const t = performance.now();
    try {
      await run('npx', ['playwright', 'install', 'chromium'], { timeout: 300_000, env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(tmpdir(), 'pw') } });
      return { ok: true, ms: Math.round(performance.now() - t) };
    } catch (e) { return { ok: false, ms: Math.round(performance.now() - t), error: String(e.stderr ?? e.message).slice(-600) }; }
  })();
  return install;
}

async function egress() {
  const urls = { ebay: 'https://www.ebay.com', ebay_api: 'https://api.ebay.com', depop: 'https://www.depop.com', mercari: 'https://www.mercari.com',
    poshmark: 'https://poshmark.com', openrouter_jev: 'https://openrouter.ai/api/v1/models', anthropic: 'https://api.anthropic.com', firecrawl: 'https://api.firecrawl.dev' };
  const out = {};
  await Promise.all(Object.entries(urls).map(async ([k, u]) => {
    const t = performance.now();
    try { const r = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(8000) }); out[k] = `HTTP ${r.status} ${Math.round(performance.now() - t)} ms`; }
    catch (e) { out[k] = `blocked: ${e.cause?.code ?? e.name}`; }
  }));
  return out;
}

async function browser(n) {
  const inst = await ensureChromium();
  if (!inst.ok) return { install: inst };
  process.env.PLAYWRIGHT_BROWSERS_PATH = join(tmpdir(), 'pw');
  const { createPool } = await import('./lib/pool.ts');
  const { loadPlaywright, playwrightLauncher } = await import('./lib/playwright.ts');
  const pw = loadPlaywright();
  if (!pw) return { install: inst, error: 'playwright package not loadable' };
  const launcher = playwrightLauncher(pw);
  const pool = createPool({ launcher, profileRoot: mkdtempSync(join(tmpdir(), 'profiles-')), publicConcurrency: n });
  const m0 = process.memoryUsage().rss;
  const t = performance.now();
  await pool.warm(['acct_probe'], Math.min(2, n));
  const warm_ms = Math.round(performance.now() - t);
  const read = (url) => async (page) => { await page.goto(url, { timeout: 20_000 }); return true; };
  const first = await pool.dispatch({ account_id: 'acct_probe', job_id: 'job_1', run: read('https://example.com') });
  const second = await pool.dispatch({ account_id: 'acct_probe', job_id: 'job_2', run: read('https://example.com') });
  const tp = performance.now();
  const parallel = await pool.dispatchAll(Array.from({ length: n }, (_, i) => ({ job_id: `job_p${i}`, run: read('https://example.com') })));
  const parallel_ms = Math.round(performance.now() - tp);
  const market = await pool.dispatch({ job_id: 'job_m', run: read('https://www.ebay.com/sch/i.html?_nkw=levis+501') });
  const rss_mb = Math.round((process.memoryUsage().rss - m0) / 1e6);
  await pool.close(); await launcher.close();
  return {
    install: inst, warm_ms, persistent_first: first, persistent_second: second,
    parallel: { n, wall_ms: parallel_ms, ok: parallel.filter((p) => p.ok).length, ms: parallel.map((p) => Math.round(p.ms)) },
    public_marketplace_read: { ok: market.ok, ms: Math.round(market.ms), error: market.ok ? undefined : market.message?.slice(0, 200) },
    node_rss_delta_mb: rss_mb,
  };
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (u.pathname === '/api/ping') return json(res, 200, { ok: true, node: process.version, user: req.headers['x-forwarded-email'] ? 'forwarded' : 'none' });
    if (u.pathname === '/hook') return json(res, 200, { ok: true, reached: 'hook' });
    if (u.pathname === '/api/egress') return json(res, 200, await egress());
    if (u.pathname === '/api/browser') return json(res, 200, await browser(Math.min(Number(u.searchParams.get('n') ?? 8), 16)));
    if (u.pathname === '/api/sse') {
      const secs = Math.min(Number(u.searchParams.get('s') ?? 60), 900);
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      let i = 0;
      const tick = setInterval(() => { res.write(`data: ${++i}\n\n`); if (i * 15 >= secs) { clearInterval(tick); res.end(); } }, 15_000);
      req.on('close', () => clearInterval(tick));
      return res.write(': open\n\n');
    }
    json(res, 404, { error: 'not_found' });
  } catch (e) { json(res, 500, { error: String(e?.message ?? e).slice(0, 400) }); }
}).listen(PORT, () => { console.log(`probe app on ${PORT}`); ensureChromium(); });
