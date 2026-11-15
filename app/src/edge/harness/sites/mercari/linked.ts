import type { Accounts } from '../../../browser/auth.ts';
import { fail, type Adapter } from '../../protocol.ts';
import { mercariAdapters, type Page } from './adapter.ts';

export function linkedSearch({ accounts, read }: { accounts: Accounts; read(account_id: string, url: string, signal: AbortSignal): Promise<Page> }): Adapter {
  const search = mercariAdapters({ signed_in: true, page: async () => { throw new Error('account context required'); } }).find(a => a.manifest.verb === 'search')!;
  return { ...search, manifest: { ...search.manifest, session: 'signed_in' }, async run(args, signal) {
    const account = typeof args.account_id === 'string' ? await accounts.byId(args.account_id) : undefined;
    if (!account || account.site !== 'mercari' || account.person_id !== args.person_id) {
      return fail('policy_refused', 'Mercari requires the asking person linked account', { do: 'raise_decision', kind: 'link_account' });
    }
    return mercariAdapters({ signed_in: true, page: (url, s) => read(account.account_id, url, s) }).find(a => a.manifest.verb === 'search')!.run(args, signal);
  } };
}

export type BrowserPage = {
  close(): Promise<void>;
  goto(url: string, opts: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<{ status(): number } | null>;
  content(): Promise<string>;
  waitForResponse(predicate: (r: BrowserResponse) => boolean, opts: { timeout: number }): Promise<BrowserResponse>;
};
type BrowserResponse = { url(): string; json(): Promise<unknown>; request(): { postData(): string | null } };

export async function readSearchPage(page: BrowserPage, url: string, signal: AbortSignal, log: { error(where: string, e: unknown): void }): Promise<Page> {
  signal.throwIfAborted();
  const close = () => { void page.close().catch(e => log.error('mercari.search.close', e)); };
  signal.addEventListener('abort', close, { once: true });
  const answer = page.waitForResponse(r => {
    const u = new URL(r.url());
    if (u.pathname !== '/v1/api') return false;
    if (u.searchParams.get('operationName') === 'searchFacetQuery') return true;
    try { return JSON.parse(r.request().postData() ?? '{}').operationName === 'searchFacetQuery'; } catch (e) { log.error('mercari.search.operation', e); return false; }
  }, { timeout: 10_000 });
  try {
    const [response, search] = await Promise.all([page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10_000 }), answer]);
    const html = await page.content();
    return { status: response?.status() ?? 0, html, api: [{ op: 'searchFacetQuery', body: await search.json() }],
      challenge: /px-captcha|press (&amp;|&) hold|are you a robot|just a moment/i.test(html.slice(0, 50_000)) };
  } finally { signal.removeEventListener('abort', close); }
}
