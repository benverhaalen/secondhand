import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Log } from '../../../../log/index.js';
import { browserUseCloud, cdpLauncher, localChrome, type CdpPw } from '../browser/cdp.ts';
import type { Launcher, PoolContext, PoolPage } from '../browser/pool.ts';
import { publicClients, type PublicPage } from './public-client.ts';
import type { Client } from './sites/depop/adapter.ts';
import type { PageClient } from './sites/ebay/adapter.ts';

export function searchClients(env: Record<string, string | undefined> = process.env, log: Log, deps: {
  launcher?: Launcher<PublicPage>;
  exists?: (path: string) => boolean;
  pw?: CdpPw;
  scratch?: string;
} = {}): {
  depop: Client; ebay: PageClient; mercariChrome?: string;
  browser: 'cloud' | 'local' | 'none'; routed(site: string): boolean; close(): Promise<void>;
} {
  const exists = deps.exists ?? existsSync;
  const windowsChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const mercariChrome = env.SECONDHAND_CHROME && exists(env.SECONDHAND_CHROME)
    ? env.SECONDHAND_CHROME : exists(windowsChrome) ? windowsChrome : undefined;
  let launcher = deps.launcher;
  let browser: 'cloud' | 'local' | 'none' = launcher ? 'local' : 'none';
  if (!launcher && env.NODE_TEST_CONTEXT === undefined) {
    const source = env.BROWSER_USE_API_KEY
      ? browserUseCloud({ apiKey: env.BROWSER_USE_API_KEY })
      : mercariChrome ? localChrome({ executablePath: mercariChrome,
        scratch: deps.scratch ?? join(env.SECONDHAND_DATA_DIR ?? tmpdir(), 'secondhand-public-browser') }) : undefined;
    if (source) {
      browser = source.kind;
      const pw = deps.pw ?? createRequire(join(process.cwd(), 'app/package.json'))('playwright-core') as CdpPw;
      const cdp = cdpLauncher(pw, source);
      launcher = {
        anonymous: async options => publicContext(await cdp.anonymous(options)),
        persistent: async (path, options) => publicContext(await cdp.persistent(path, options)),
      };
    }
  }
  const unavailable = async (): Promise<never> => { throw new Error('no browser is composed for search'); };
  const clients = launcher ? publicClients({ launcher, log }) : {
    depop: { signed_in: false, doc: unavailable, json: unavailable },
    ebay: { signed_in: false, page: unavailable },
    async close() {},
  };
  log.note('search clients composed', { browser });
  let closing: Promise<void> | undefined;
  return {
    depop: clients.depop, ebay: clients.ebay, mercariChrome, browser,
    routed: site => browser !== 'none' && (site === 'depop' || site === 'ebay'),
    close: () => closing ??= clients.close(),
  };
}

// CdpPw's default page type promises only close(); public reads require the browser page methods too.
function publicContext(context: PoolContext): PoolContext<PublicPage> {
  return { ...context, async newPage() {
    const page = await context.newPage();
    if (!isPublicPage(page)) throw new Error('CDP page does not support public reads');
    return page;
  } };
}

function isPublicPage(page: PoolPage): page is PublicPage {
  return 'goto' in page && typeof page.goto === 'function'
    && 'content' in page && typeof page.content === 'function'
    && 'waitForTimeout' in page && typeof page.waitForTimeout === 'function'
    && 'waitForSelector' in page && typeof page.waitForSelector === 'function'
    && 'evaluate' in page && typeof page.evaluate === 'function'
    && 'on' in page && typeof page.on === 'function'
    && 'off' in page && typeof page.off === 'function';
}

// The one call the runtime makes (agreed with the server lead): createRuntime's search options, plus close.
// apifyToken stays undefined until Apify runs only as a background fill after the answer settles (finalization SR3).
export function composeSources({ env, log }: { env: Record<string, string | undefined>; log: Log; now?: () => number; store?: unknown }): {
  publicClients?: { ebay: PageClient; depop: Client; close(): Promise<void> }; apifyToken?: string; close(): Promise<void>;
} {
  const clients = searchClients(env, log);
  return { ...(clients.browser === 'none' ? {} : { publicClients: { ebay: clients.ebay, depop: clients.depop, close: clients.close } }), close: clients.close };
}
