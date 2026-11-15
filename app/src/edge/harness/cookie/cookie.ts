// The cookie runner (spec/engines/protocol-and-adapters.md §3.6): one account's own cookies, in memory, on a plain request, paced
// by the account's bucket. A 401 or a login redirect is auth_expired: the account goes account_stale and the hint relinks.
// A CookieJar hands a header value for one request and never stores or returns it anywhere else.
import { fail, type Adapter, type AdapterResult, type CallArgs, type Manifest, type Site } from '../protocol.ts';
import type { Bucket, Sessions } from '../session.ts';
import type { Log } from '../../../../../log/index.js';

export type CookieJar = { header(account_id: string, site: Site): Promise<string | null> };
export type Reply = { status: number; location: string | null; json(): Promise<unknown> };
export type Fetch = (url: string, init: { method: string; headers: { cookie: string | undefined } & Record<string, string | undefined>; body?: string }) => Promise<Reply>;
export type Req = { url: string; method?: string; body?: unknown };

const LOGIN = /\/(log-?in|sign-?in|signin|auth)\b/i;

export function cookieRunner({ account_id, manifest, jar, bucket, sessions, fetch, request, parse, wait = ms => new Promise<void>(r => setTimeout(r, ms)), log }: {
  account_id: string; manifest: Manifest; jar: CookieJar; bucket: Bucket; sessions: Sessions; fetch: Fetch;
  request: (args: CallArgs) => Req; parse: (json: unknown) => unknown; wait?: (ms: number) => Promise<void>; log?: Log;
}): Adapter {
  const { site } = manifest;
  const stale = (): AdapterResult => sessions.expire(account_id, site);

  async function once(args: CallArgs): Promise<AdapterResult> {
    const cookie = await jar.header(account_id, site);
    if (!cookie) return stale();
    await wait(bucket.take());
    const q = request(args);
    const r = await fetch(q.url, { method: q.method ?? 'GET', headers: { cookie, 'content-type': q.body === undefined ? undefined : 'application/json' }, body: q.body === undefined ? undefined : JSON.stringify(q.body) });
    if (r.status === 401 || (r.status >= 300 && r.status < 400 && r.location !== null && LOGIN.test(r.location))) return stale();
    if (r.status === 429) { bucket.onOutcome('rate_limited'); return fail('rate_limited', 'the site asked to slow down', { do: 'retry_after', after_s: 60 }); }
    if (r.status === 404) return fail('not_found', 'not found', { do: 'reconcile', searched: [q.url] });
    if (r.status < 200 || r.status >= 300) return fail('page_changed', `unexpected status ${r.status}`, { do: 'author', missing: [] });
    bucket.onOutcome('ok');
    return { ok: true, data: parse(await r.json()) };
  }

  return {
    route_id: `cookie.${site}.${manifest.verb}`, manifest,
    run: args => log
      ? log.call('cookie', `${site}.${manifest.verb}`, { account_id, operation_id: args.operation_id }, () => once(args), o => ({ status: o.ok ? 'ok' : o.error.code }))
      : once(args),
  };
}
