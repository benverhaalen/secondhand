// Profile-backed transports. The runtime supplies ports; this module never reads credentials or opens a browser by itself.
import { randomUUID } from 'node:crypto';
import type { Log } from '../../../../log/index.js';
import type { ProfileRegistry, ProfileRow } from '../browser/auth.ts';
import { profileDirFor, type Pool, type Launcher, type PoolContext } from '../browser/pool.ts';
import type { Leases } from '../events/ports.ts';
import { PROFILES } from './platform.ts';
import { fail, type AdapterResult, type CallError } from './protocol.ts';
import { poshmarkAdapters, type Client as PoshmarkClient } from './sites/poshmark/adapter.ts';
import { mercariAdapters, type Client as MercariClient } from './sites/mercari/adapter.ts';
import { depopAdapters, API as DEPOP_API, type Client as DepopClient } from './sites/depop/adapter.ts';
import { PAGE_HOSTS, CHALLENGE, type PageClient as EbayClient } from './sites/ebay/adapter.ts';

export type SessionSite = 'poshmark' | 'mercari' | 'depop' | 'ebay';
type Owner = { user_id: string; account_id: string };
type Clients = { poshmark: PoshmarkClient; mercari: MercariClient; depop: DepopClient; ebay: EbayClient };
type Route = { request(): { resourceType(): string }; abort(): Promise<void>; continue(): Promise<void> };
export type SessionResponse = { url(): string; status(): number; text(): Promise<string>; request(): { postData(): string | null } };
export type SessionPage = {
  close(): Promise<void>; goto(url: string, opts?: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<{ status(): number; text(): Promise<string> } | null>;
  url(): string; content(): Promise<string>;
  evaluate<T, A>(fn: (arg: A) => T | Promise<T>, arg: A): Promise<T>;
  route(pattern: string, fn: (route: Route) => Promise<void>): Promise<void>;
  on(event: 'response', fn: (response: SessionResponse) => void): void;
  off(event: 'response', fn: (response: SessionResponse) => void): void;
  waitForLoadState(state: 'networkidle', opts: { timeout: number }): Promise<void>;
};
type PageResult = { status: number; html: string; challenge?: boolean; api: { op?: string; body: unknown }[] };
type Reply = { status: number; body: unknown };
type Transport = PoshmarkClient & MercariClient;
export class SessionClientError extends Error {
  readonly error: CallError;
  constructor(error: CallError) { super(error.message); this.error = error; }
}
const stale = (site: SessionSite) => fail('auth_expired', 'link this account again', { do: 'relink', site });
const paused = (site: SessionSite) => fail('blocked', 'this account needs your attention', { do: 'pause_session', site });
const failurePage = (state: ProfileRow['state']): PageResult => ({ status: state === 'paused' ? 403 : 401, html: state === 'needs_signin' ? '<title>Sign in or Register</title>' : '', challenge: state === 'paused', api: [] });

async function abortable<T>(signal: AbortSignal, run: () => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  let abort!: () => void;
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => reject(new Error('session read cancelled'));
    signal.addEventListener('abort', abort, { once: true });
  });
  try { return await Promise.race([run(), interrupted]); }
  finally { signal.removeEventListener('abort', abort); }
}

function pageState(url: string, html: string, status: number): 'needs_signin' | 'paused' | undefined {
  if (CHALLENGE.test(html.slice(0, 50_000))) return 'paused';
  if (status === 401 || /<title[^>]*>\s*sign in or register\b/i.test(html) || /\/(?:login|signin|sign-in)(?:\/|\?|$)/i.test(url) || /<input\b[^>]*type\s*=\s*["']password["']/i.test(html)) return 'needs_signin';
  if (status === 403) return 'paused';
}

export function sessionClient(o: {
  pool: Pick<Pool<SessionPage>, 'dispatch' | 'invalidate'>; registry: ProfileRegistry; launcher: Launcher<SessionPage>;
  profileRoot: string; leases: Leases; createProfile(owner: Owner & { site: SessionSite }): Promise<string>;
  ttlMs: number; log: Log; now?: () => number;
}) {
  if (!(o.ttlMs > 0 && o.ttlMs <= 240 * 60_000)) throw new Error('link lifetime must be within 240 minutes');
  const now = o.now ?? Date.now;
  const iso = () => new Date(now()).toISOString();
  const call = <T>(name: string, site: SessionSite, run: () => Promise<T>) => o.log.call('browser', name, { site }, async () => {
    try { return await run(); }
    catch (e) { if (e instanceof SessionClientError) throw e; throw new Error(`${name} failed`); }
  }, () => ({ ok: true }));
  async function owned(site: SessionSite, who: Owner) {
    const row = await o.registry.get(who.user_id, who.account_id);
    if (row && row.site !== site) throw new Error('account site mismatch');
    return row;
  }
  async function change(row: ProfileRow, state: ProfileRow['state'], signal: AbortSignal) {
    const current = await o.registry.get(row.user_id, row.account_id);
    signal.throwIfAborted();
    if (current?.profile_id !== row.profile_id || current.state !== row.state) throw new Error('session changed');
    await o.registry.put(row.user_id, { ...row, state, ...(state === 'linked' ? { last_ok_at: iso() } : {}) });
    o.log.event('state.change', { entity: 'account', id: row.account_id, to: state, was: row.state });
  }
  function transport(site: SessionSite, isLinked: () => boolean,
    run: <T>(signal: AbortSignal, task: (page: SessionPage) => Promise<T>, denied: (state: ProfileRow['state']) => T) => Promise<T>,
    mark: (state: 'needs_signin' | 'paused', signal: AbortSignal) => Promise<void>): Transport {
    const allowed = (url: string, api = false) => {
      const target = new URL(url, api && site === 'depop' ? DEPOP_API : PROFILES[site].home);
      const base = new URL(api && site === 'depop' ? DEPOP_API : PROFILES[site].home);
      const origins = site === 'ebay' ? PAGE_HOSTS.map(h => h.www) : [base.origin];
      if (!origins.includes(target.origin) || target.username || target.password) throw new Error('site URL required');
      return target.href;
    };
    async function doc(page: SessionPage, url: string, signal: AbortSignal): Promise<PageResult> {
      // eBay refuses browsers that intercept requests (protocol-and-adapters.md §8). The pool itself never routes requests.
      if (site !== 'ebay') await page.route('**/*', r => ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue());
      const api: PageResult['api'] = [], pending: Promise<void>[] = [];
      let responseState: 'needs_signin' | 'paused' | undefined, responseFailed = false;
      const onResponse = (r: SessionResponse) => {
        const u = new URL(r.url());
        if (u.origin !== new URL(PROFILES[site].home).origin || u.pathname !== '/v1/api') return;
        pending.push((async () => {
          const text = await r.text();
          const state = pageState(r.url(), text, r.status());
          if (state) { responseState = state; return; }
          let body: unknown;
          try { body = JSON.parse(text); } catch { throw new Error('marketplace response was not JSON'); }
          if (body && typeof body === 'object' && 'errors' in body && Array.isArray(body.errors)) {
            for (const error of body.errors) if (error && typeof error === 'object' && 'status' in error) {
              const state = pageState('', '', Number(error.status));
              if (state) responseState = state;
            }
          }
          let op = u.searchParams.get('operationName') ?? undefined;
          if (!op && r.request().postData()) {
            const request: unknown = JSON.parse(r.request().postData()!);
            if (request && typeof request === 'object' && 'operationName' in request && typeof request.operationName === 'string') op = request.operationName;
          }
          api.push({ op, body });
        })().catch(() => { responseFailed = true; }));
      };
      if (site === 'mercari') page.on('response', onResponse);
      try {
        const response = await page.goto(allowed(url), { waitUntil: 'domcontentloaded', timeout: 30_000 });
        let html = (await response?.text()) || await page.content();
        let state = pageState(page.url(), html, response?.status() ?? 0);
        if (!state && site === 'mercari') {
          await page.waitForLoadState('networkidle', { timeout: 30_000 });
          html = await page.content(); state = pageState(page.url(), html, response?.status() ?? 0);
        }
        await Promise.all(pending);
        if (responseFailed) throw new Error('marketplace response could not be read');
        state = state ?? responseState;
        if (state) { signal.throwIfAborted(); await mark(state, signal); return failurePage(state); }
        return { status: response?.status() ?? 0, html, api };
      } finally { if (site === 'mercari') page.off('response', onResponse); }
    }
    return {
      get signed_in() { return isLinked(); },
      doc: (url, signal) => run(signal, p => doc(p, url, signal), failurePage),
      page: (url, signal) => run(signal, p => doc(p, url, signal), failurePage),
      json: (path, signal) => run<Reply>(signal, async p => {
        const home = await doc(p, PROFILES[site].home, signal);
        if (home.status === 401 || home.challenge) return { status: home.status, body: null };
        const reply = await p.evaluate(async (url: string) => {
          const response = await fetch(url, { credentials: 'include' });
          const text = await response.text();
          let body: unknown = null;
          if (response.headers.get('content-type')?.includes('json')) body = JSON.parse(text);
          return { status: response.status, body, url: response.url, html: body === null ? text : '' };
        }, allowed(path, true));
        const state = pageState(reply.url, reply.html, reply.status);
        if (state) { signal.throwIfAborted(); await mark(state, signal); return { status: state === 'paused' ? 403 : 401, body: null }; }
        return { status: reply.status, body: reply.body };
      }, state => ({ status: state === 'paused' ? 403 : 401, body: null })),
    };
  }
  async function clientFor<S extends SessionSite>(site: S, who: Owner): Promise<Clients[S]> {
    let row = await owned(site, who);
    return transport(site, () => row?.state === 'linked', async (signal, task, denied) => {
      signal.throwIfAborted(); row = await owned(site, who);
      if (row?.state !== 'linked') return denied(row?.state ?? 'needs_signin');
      const result = await call('session.read', site, () => o.pool.dispatch({ ...who, site, job_id: `session:${randomUUID()}`, run: async page => {
        row = await owned(site, who);
        if (row?.state !== 'linked') return denied(row?.state ?? 'needs_signin');
        signal.throwIfAborted();
        const value = await abortable(signal, () => task(page));
        signal.throwIfAborted();
        if (row.state === 'linked') await change(row, 'linked', signal);
        return value;
      } }));
      if (result.ok) return result.value;
      if (result.status === 'not_linked') return denied('needs_signin');
      throw new SessionClientError(paused(site).error);
    }, async (state, signal) => { if (row) { await change(row, state, signal); row = { ...row, state }; } }) as Clients[S];
  }

  type Link = { row: ProfileRow; site: SessionSite; ctx: PoolContext<SessionPage>; page: SessionPage; viewer?: string;
    expires: number; job: string; closed: boolean; stopping?: Promise<void>; timer?: ReturnType<typeof setTimeout> };
  const links = new Map<string, Link>();
  function stop(link: Link): Promise<void> {
    if (link.stopping) return link.stopping;
    link.closed = true; link.viewer = undefined; clearTimeout(link.timer);
    return link.stopping = call('session.stop', link.site, () => link.ctx.close());
  }
  async function close(link: Link) {
    try { await stop(link); } finally { o.leases.give(link.row.account_id, link.job); }
  }
  async function find(user_id: string, handle: string) {
    const link = links.get(handle);
    if (!link || link.row.user_id !== user_id) return;
    const current = await owned(link.site, { user_id, account_id: link.row.account_id });
    if (link.closed || now() >= link.expires || current?.profile_id !== link.row.profile_id ||
        !o.leases.take(link.row.account_id, link.job, link.expires - now()).ok) { links.delete(handle); await close(link); return; }
    return link;
  }
  return {
    clientFor,
    async startLink(site: SessionSite, who: Owner): Promise<string> {
      await owned(site, who);
      // eBay's signed-in Client requires OAuth. Its PageClient has no signed-in verification read yet.
      if (site === 'ebay') throw new SessionClientError(fail('no_route', 'eBay needs a signed-in page adapter', { do: 'handoff', url: PROFILES.ebay.home }).error);
      const handle = randomUUID(), job = `link:${handle}`, expires = now() + o.ttlMs;
      if (!o.leases.take(who.account_id, job, o.ttlMs).ok) throw new SessionClientError(paused(site).error);
      const assertLease = () => {
        if (now() >= expires || !o.leases.take(who.account_id, job, expires - now()).ok) throw new Error('link lease expired');
      };
      let ctx: PoolContext<SessionPage> | undefined;
      try {
        await o.pool.invalidate(who.account_id);
        const profile_id = await call('session.create_profile', site, () => o.createProfile({ ...who, site }));
        assertLease();
        const row: ProfileRow = { ...who, site, profile_id, state: 'needs_signin', linked_at: null, last_ok_at: null, data: 'captured' };
        await o.registry.put(who.user_id, row);
        o.log.event('state.change', { entity: 'account', id: row.account_id, to: 'needs_signin' });
        assertLease();
        ctx = await call('session.open', site, () => o.launcher.persistent(profileDirFor(o.profileRoot, who.account_id), {
          ...who, headless: !PROFILES[site].headed, timeoutMin: Math.ceil((expires - now()) / 60_000),
        }));
        assertLease();
        const viewer = (ctx as PoolContext<SessionPage> & { live_url?: string }).live_url;
        if (!viewer || !ctx.profileSaved || ctx.exportState || ctx.loadState) throw new Error('linking requires a cloud profile context');
        const page = await ctx.newPage();
        await call('session.signin', site, () => page.goto(PROFILES[site].login!));
        assertLease();
        const link: Link = { row, site, ctx, page, viewer, expires, job, closed: false };
        links.set(handle, link);
        link.timer = setTimeout(() => {
          links.delete(handle);
          void close(link).catch(() => o.log.error('session.expire', new Error('expired browser stop failed')));
        }, Math.max(0, expires - now())); link.timer.unref();
        return handle;
      } catch {
        o.log.error('session.link', new Error('link could not start'));
        try { if (ctx) await call('session.stop', site, () => ctx!.close()); }
        finally { o.leases.give(who.account_id, job); }
        throw new Error('link could not start');
      }
    },
    // Server-side viewer route only; never log or cache this return value. Redeeming it burns the viewer capability.
    async liveView(user_id: string, handle: string): Promise<string | undefined> {
      const link = await find(user_id, handle);
      if (!link) return;
      const viewer = link.viewer; link.viewer = undefined; return viewer;
    },
    async finishLink(user_id: string, handle: string): Promise<AdapterResult | undefined> {
      const link = await find(user_id, handle); if (!link || !links.delete(handle)) return;
      let state: ProfileRow['state'] = 'linked';
      try {
        // This provisional client stays inside verification; it is never handed to a caller as a linked client.
        const client = transport(link.site, () => state === 'linked', async (signal, run) => {
          return abortable(signal, () => run(link.page));
        }, async (next, signal) => {
          signal.throwIfAborted();
          if (link.closed || now() >= link.expires || !o.leases.take(link.row.account_id, link.job, link.expires - now()).ok) throw new Error('link lease expired');
          await change(link.row, next, signal); state = next;
        });
        const adapters = link.site === 'poshmark' ? poshmarkAdapters(client) : link.site === 'mercari' ? mercariAdapters(client) : depopAdapters(client);
        const result = await call('session.verify', link.site, () => adapters.find(a => a.manifest.verb === 'read_inbox')!.run({}, AbortSignal.timeout(Math.max(1, link.expires - now()))));
        if (link.closed || now() >= link.expires || !o.leases.take(link.row.account_id, link.job, link.expires - now()).ok) return stale(link.site);
        await stop(link); // Keep the lease through vendor persistence and publication.
        if (!link.ctx.profileSaved?.()) throw new Error('profile was not saved');
        if (now() >= link.expires || !o.leases.take(link.row.account_id, link.job, link.expires - now()).ok) return stale(link.site);
        if (result.ok) await o.registry.put(user_id, { ...link.row, state: 'linked', linked_at: iso(), last_ok_at: iso() });
        o.log.event('state.change', { entity: 'account', id: link.row.account_id, to: result.ok ? 'linked' : state === 'linked' ? 'needs_signin' : state });
        return result;
      } finally { await close(link); }
    },
    async cancelLink(user_id: string, handle: string) {
      const link = await find(user_id, handle); if (!link || !links.delete(handle)) return;
      await close(link);
    },
  };
}
