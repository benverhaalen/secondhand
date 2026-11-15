// The pool's browser-use launcher (Nate, product/words.md 2026-11-14 "use browser-use", "store auth through browser-use"). Server only.
// Every browser is reached over CDP, as browser-use reaches it: a local Chrome on a kept profile directory, or a Browser Use Cloud
// browser (POST /api/v4/browsers, then connect to its cdpUrl; https://github.com/browser-use/browser-use/blob/main/CLOUD.md).
// The sign-in travels as storage state ({cookies, origins[].localStorage}, the shape browser-use's export_storage_state writes),
// loaded when a lease starts and exported when it ends, behind account.token_ref (auth.ts). No captcha_solver: a challenge pauses.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Launcher, LaunchOptions, PoolContext } from './pool.ts';
import type { StorageState } from './auth.ts';

export type CdpEndpoint = { cdpUrl: string; live_url?: string; stop(): Promise<void> };
// Where a browser comes from. profileDir is undefined for an anonymous public browser.
export type BrowserSource = { kind: 'local' | 'cloud'; open(profileDir: string | undefined, opts: LaunchOptions): Promise<CdpEndpoint> };

type CdpPage = { close(): Promise<void> };
type CdpContext = { pages(): CdpPage[]; newPage(): Promise<CdpPage>; addCookies(c: StorageState['cookies']): Promise<void>;
  addInitScript(s: { content: string }): Promise<void>; storageState(): Promise<StorageState>; close(): Promise<void> };
type CdpBrowser = { contexts(): CdpContext[]; newContext(): Promise<CdpContext>; close(): Promise<void>; on(ev: 'disconnected', fn: () => void): void;
  newBrowserCDPSession?(): Promise<{ send(method: 'Browser.close'): Promise<unknown> }> };
export type CdpPw = { chromium: { connectOverCDP(url: string, o?: { timeout?: number }): Promise<CdpBrowser> } };

export type AuthedContext<P> = PoolContext<P & CdpPage> & { loadState(s: StorageState): Promise<void>; exportState(): Promise<StorageState> };

export function cdpLauncher(pw: CdpPw, source: BrowserSource): Launcher<CdpPage> {
  async function connect(profileDir: string | undefined, opts: LaunchOptions): Promise<AuthedContext<CdpPage>> {
    const ep = await source.open(profileDir, opts);
    let browser: CdpBrowser;
    try { browser = await pw.chromium.connectOverCDP(ep.cdpUrl, { timeout: 30_000 }); }
    catch (e) { await ep.stop(); throw new Error(`could not connect to the ${source.kind} browser: ${(e as Error).message.replace(/(wss?|https?):\/\/\S+/g, '[cdp]')}`); }
    const ctx = browser.contexts()[0] ?? await browser.newContext();
    let closed = false;
    const closers: (() => void)[] = [];
    browser.on('disconnected', () => { if (!closed) { closed = true; closers.forEach(f => f()); } });
    return {
      newPage: () => ctx.newPage(),
      onClose: fn => { closers.push(fn); },
      // Closing CDP does not stop a cloud browser (or its billing), so stop() always runs.
      async close() {
        closed = true;
        // Browser.close lets Chrome flush its cookie store to the profile; a bare kill loses the last sign-in.
        await browser.newBrowserCDPSession?.().then(c => c.send('Browser.close')).catch(() => undefined);
        await browser.close().catch(() => undefined);
        await ep.stop();
        closers.forEach(f => f());
      },
      async loadState(s) {
        if (s.cookies.length) await ctx.addCookies(s.cookies);
        for (const o of s.origins ?? []) if (o.localStorage.length) await ctx.addInitScript({ content:
          `if (location.origin === ${JSON.stringify(o.origin)}) { for (const [k, v] of ${JSON.stringify(o.localStorage.map(i => [i.name, i.value]))}) localStorage.setItem(k, v); }` });
      },
      exportState: () => ctx.storageState(),
    };
  }
  return { persistent: (dir, opts) => connect(dir, opts), anonymous: opts => connect(undefined, opts) };
}

// A local Chrome on a kept profile, the debugging port bound to 127.0.0.1 and chosen by Chrome (port 0), read from DevToolsActivePort.
// The port has no authentication (browser-use README), so it never binds beyond loopback.
export function localChrome({ executablePath, scratch, headless, spawnFn = spawn, readyMs = 15_000 }: {
  executablePath: string; scratch: string; headless?: boolean; spawnFn?: typeof spawn; readyMs?: number;
}): BrowserSource {
  let n = 0;
  return {
    kind: 'local',
    async open(profileDir, opts) {
      const dir = profileDir ?? join(scratch, `anon-${process.pid}-${n++}`);
      mkdirSync(dir, { recursive: true });
      rmSync(join(dir, 'DevToolsActivePort'), { force: true });
      const args = [`--user-data-dir=${dir}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--no-first-run',
        '--no-default-browser-check', ...((headless ?? opts.headless) ? ['--headless=new'] : []), ...(opts.proxy ? [`--proxy-server=${opts.proxy.server}`] : []), 'about:blank'];
      const child = spawnFn(executablePath, args, { stdio: 'ignore' });
      const exited = new Promise<void>(r => { if (child.exitCode !== null) r(); else child.once('exit', () => r()); });
      // Wait for Chrome to exit so its profile lock and cookie store are released before anyone reopens or removes the directory.
      const stop = async () => {
        const wait = (ms: number) => Promise.race([exited.then(() => true), new Promise<boolean>(r => setTimeout(() => r(false), ms))]);
        if (!(await wait(3000))) { child.kill(); await wait(5000); }
        if (!profileDir) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      };
      const t0 = Date.now();
      while (Date.now() - t0 < readyMs) {
        try {
          const [port, path] = readFileSync(join(dir, 'DevToolsActivePort'), 'utf8').split(/\r?\n/);
          if (port && path) return { cdpUrl: `ws://127.0.0.1:${port}${path}`, stop };
        } catch { /* not written yet */ }
        if (child.exitCode !== null) break;
        await new Promise(r => setTimeout(r, 50));
      }
      await stop();
      throw new Error(`local Chrome did not open a debugging port within ${readyMs} ms`);
    },
  };
}

// A Browser Use Cloud browser. The key is read by presence from the caller and sent only in the X-Browser-Use-API-Key header,
// never in a URL; profileFor maps a profile directory to a cloud profile id when one was made (cloud_profile_id in browser-use 1.0).
export function browserUseCloud({ apiKey, fetchFn = fetch, base = 'https://api.browser-use.com/api/v4', country = 'us', timeoutMin = 60,
  profileFor = () => undefined }: {
  apiKey: string; fetchFn?: typeof fetch; base?: string; country?: string; timeoutMin?: number; profileFor?: (dir: string) => string | undefined;
}): BrowserSource {
  const headers = { 'X-Browser-Use-API-Key': apiKey, 'content-type': 'application/json' };
  return {
    kind: 'cloud',
    async open(profileDir) {
      const profileId = profileDir ? profileFor(profileDir) : undefined;
      const res = await fetchFn(`${base}/browsers`, { method: 'POST', headers,
        body: JSON.stringify({ proxyCountryCode: country, timeout: timeoutMin, ...(profileId ? { profileId } : {}) }) });
      if (!res.ok) throw new Error(`browser-use cloud create answered ${res.status}`);
      const body: unknown = await res.json();
      const o = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
      const id = o.id, cdpUrl = o.cdpUrl ?? o.cdp_url;
      if (typeof id !== 'string' || typeof cdpUrl !== 'string') throw new Error('browser-use cloud create returned no id or cdpUrl');
      const live_url = typeof (o.liveUrl ?? o.live_url) === 'string' ? String(o.liveUrl ?? o.live_url) : undefined;
      return { cdpUrl, live_url, stop: async () => { await fetchFn(`${base}/browsers/${encodeURIComponent(id)}`, { method: 'PATCH', headers, body: JSON.stringify({ action: 'stop' }) }).catch(() => undefined); } };
    },
  };
}
