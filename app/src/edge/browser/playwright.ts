// The pool's real launcher: Playwright Chromium on this host. Server only.
// Playwright is found at SECONDHAND_PLAYWRIGHT (a path to the package) or from the app's own node_modules;
// shortcut: no package.json entry yet (not this stream's file), add playwright to app devDependencies when the host image is built.
import { createRequire } from 'node:module';
import type { Launcher, PoolContext } from './pool.ts';

type PwPage = { close(): Promise<void>; goto(url: string, o?: { timeout?: number }): Promise<unknown>; setContent(html: string): Promise<void> };
type PwContext = { newPage(): Promise<PwPage>; close(): Promise<void>; on(ev: 'close', fn: () => void): void };
type PwBrowser = { newContext(o?: object): Promise<PwContext>; close(): Promise<void>; on(ev: 'disconnected', fn: () => void): void };
type Pw = { chromium: { launch(o: object): Promise<PwBrowser>; launchPersistentContext(dir: string, o: object): Promise<PwContext> } };

export function loadPlaywright(): Pw | null {
  const from = process.env.SECONDHAND_PLAYWRIGHT;
  try { return (from ? createRequire(import.meta.url)(from) : createRequire(import.meta.url)('playwright')) as Pw; } catch { return null; }
}

const wrap = (c: PwContext): PoolContext<PwPage> => ({ newPage: () => c.newPage(), close: () => c.close(), onClose: fn => c.on('close', fn) });

export function playwrightLauncher(pw: Pw): Launcher<PwPage> & { close(): Promise<void> } {
  let shared: Promise<PwBrowser> | undefined;
  return {
    // Only headless and a proxy are passed: no user agent override, no stealth flag, no challenge solver.
    persistent: async (dir, opts) => wrap(await pw.chromium.launchPersistentContext(dir, { ...opts })),
    async anonymous(opts) {
      shared ??= pw.chromium.launch({ headless: true }).then(b => { b.on('disconnected', () => { shared = undefined; }); return b; });
      return wrap(await (await shared).newContext(opts.proxy ? { proxy: opts.proxy } : {}));
    },
    async close() { if (shared) await (await shared).close(); },
  };
}

export type { PwPage };
