// Rests-on: spec/product.md §3, §5, §6 Harnesses, §7; spec/examples/{items,sell,you}.json.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cdpLauncher, localChrome, type CdpPw } from '../browser/cdp.ts';
import { createPool, type Launcher } from '../browser/pool.ts';
import { linkedSearch, readSearchPage, type BrowserPage } from '../harness/sites/mercari/linked.ts';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createLog, consoleSink, type Log } from '../../../../log/index.js';
import { store } from './store.ts';
import { ports as searchPorts } from './search.ts';
import { createApify } from '../harness/sites/apify/adapter.ts';
import { example } from './examples.ts';
import { ApiError, type Ctx, type Handler } from './http.ts';
import { fromEngine, pagination, object, integer, invalid } from './captures.ts';
import { memoryVault, type Accounts, type LinkedAccount } from '../browser/auth.ts';
import { createHarness, fail, isWrite, type Adapter, type Harness } from '../harness/protocol.ts';
import { createSiteService } from '../harness/service.ts';
import { depopAdapters, API, type Client } from '../harness/sites/depop/adapter.ts';
import { ebayAdapters, ebayPageAdapters, type PageClient } from '../harness/sites/ebay/adapter.ts';
import { poshmarkAdapters } from '../harness/sites/poshmark/adapter.ts';
import { mercariAdapters } from '../harness/sites/mercari/adapter.ts';
import { memoryLeases, memoryParams, type Row, type Table, type Store, type JobRow } from '../events/ports.ts';
import { createPipeline } from '../events/pipeline.ts';
import { createWatcher, type WatchedListing } from '../events/watcher.ts';
import { SITES as WATCH_SITES, type Snapshot } from '../events/event.ts';
import { check } from '../events/policy.ts';
import { SITES } from '../harness/names.ts';

export const EXAMPLE_USER = 'usr_8f2k';
export const manifest = [];
const response = (name: string) => structuredClone(example(name).response) as Record<string, unknown>;

export function seedExamples(st: Store) {
  const seed = (table: Table, data: Record<string, unknown> & { id: string }) => {
    if (st.get(table, EXAMPLE_USER, data.id)) return;
    const { version, ...fields } = data;
    let row = st.put(table, { ...fields, user_id: EXAMPLE_USER, data: 'example' });
    while (row.version! < Number(version ?? 1)) row = st.put(table, row);
  };
  st.tx(() => {
    const card = response('items.get');
    if (typeof card.id !== 'string') throw new Error('example item has no id');
    const tiles = response('items.list').data as Row[];
    seed('item', { ...card, id: card.id, user_id: EXAMPLE_USER, tile: tiles.find(row => row.id === card.id), strategy_options: { fast: response('items.strategy').strategies } });
    for (const tile of (response('items.list').data as Row[])) seed('item', { attributes: [], photos: [], listings: [], ...tile, tile });
    for (const listing of card.listings as Row[]) seed('listing', { ...listing, item_id: card.id, account_id: listing.site === 'ebay' ? 'acc_eb1' : 'acc_dp1', required_fields: ['chest_width'] });
    const preview = response('accounts.import_preview');
    for (const listing of preview.listings as Record<string, unknown>[]) seed('listing', { ...listing, id: `ls_import_${listing.external_id}`, account_id: preview.account_id, site: preview.site, import_preview: true, read_at: preview.read_at });
    for (const account of response('accounts.list').data as Row[]) seed('account', account);
    const depop = response('accounts.connect.depop');
    if (typeof depop.id !== 'string') throw new Error('example account has no id');
    seed('account', { ...depop, id: depop.id, user_id: EXAMPLE_USER, pending: true, read_at: preview.read_at, purchases: preview.purchases });
    const limits = response('limits.get');
    const { items, ...userLimits } = limits;
    seed('limits', { ...userLimits, id: EXAMPLE_USER });
    for (const item of items as Record<string, unknown>[]) seed('limits', { ...item, id: String(item.item_id) });
    for (const rule of response('rules.list').data as Row[]) seed('rule', rule);
    if (!st.decisions({ user_id: EXAMPLE_USER }).some(row => row.id === 'dec_lb1')) {
      const d = (response('today.get').decisions as Record<string, unknown>[]).find(row => row.id === 'dec_lb1')!;
      const saved = st.raiseDecision({ user_id: EXAMPLE_USER, data: 'example', kind: String(d.kind), subject: String(d.item_id ?? 'dec_lb1'), item_id: typeof d.item_id === 'string' ? d.item_id : undefined, why: String(d.why), options: d.options as { id: string; label: string }[] }).row;
      st.updateDecision(saved.id, { id: 'dec_lb1' });
    }
  });
}

export function createRuntime(st: Store, log: Log = createLog({ src: 'edge.runtime', build: process.env.npm_package_version ?? 'dev', sink: consoleSink }), options: {
  adapters?: Adapter[]; ebayPageClient?: PageClient; now?: () => number;
  publicClients?: { ebay: PageClient; depop: Client; close(): Promise<void> }; apifyToken?: string;
} = {}) {
  const now = options.now ?? Date.now;
  seedExamples(st);
  // shortcut: session state is process-local until the Databricks secret-scope AuthVault joins.
  const vault = memoryVault();
  const accounts: Accounts & { byId(id: string, person_id?: string): Promise<LinkedAccount | undefined> } = {
    async linked(person_id) {
      const rows = person_id ? st.rows('account', { user_id: person_id }) : st.systemRows('account');
      const linked = await Promise.all(rows.map(async row => {
        if (row.deleted || typeof row.token_ref !== 'string' || !(SITES as readonly unknown[]).includes(row.site) || !await vault.get(row.token_ref)) return undefined;
        return { account_id: row.id, person_id: row.user_id, site: row.site, token_ref: row.token_ref } as LinkedAccount;
      }));
      return linked.filter((row): row is LinkedAccount => row !== undefined);
    },
    async byId(id: string, person_id?: string) { return person_id ? (await accounts.linked(person_id)).find(row => row.account_id === id) : undefined; },
  };
  const personScope = new AsyncLocalStorage<string>();
  const scopedAccounts: Accounts = { ...accounts, byId: id => accounts.byId(id, personScope.getStore()) };
  // A route never receives system accounts.
  const systemAccounts: Accounts = { linked: () => accounts.linked(), byId: async id => (await accounts.linked()).find(row => row.account_id === id) };
  const liveSites = new Set((process.env.SECONDHAND_LIVE_SITES ?? '').split(/[ ,]+/));
  const live = liveSites.has('depop');
  const client: Client = options.publicClients?.depop ?? {
    signed_in: false,
    async doc(url, signal) {
      if (!live) throw new Error('offline Depop client cannot fetch');
      const res = await fetch(url, { signal });
      const html = await res.text();
      return { status: res.status, html, challenge: /captcha|just a moment|are you a robot/i.test(html.slice(0, 20000)) };
    },
    async json(path, signal) {
      if (!live) throw new Error('offline Depop client cannot fetch');
      const res = await fetch(API + path, { signal });
      return { status: res.status, body: res.ok ? await res.json() : null };
    },
  };
  const unavailable = async (): Promise<never> => { throw new Error('site session transport is not composed'); };
  const ebayLive = liveSites.has('ebay');
  const ebayPageClient: PageClient = options.publicClients?.ebay ?? (ebayLive ? options.ebayPageClient ?? {
    signed_in: false,
    async page(url, signal) {
      const res = await fetch(url, { signal });
      return { status: res.status, html: await res.text() };
    },
  } : { signed_in: false, page: unavailable });
  // shortcut: waiting.md "The harness wired to itself": browser profiles and eBay credentials
  // have no runtime transport yet. Keep their real dry-write adapters and explicit offline reads.
  const offlineClient: Client = { signed_in: false, doc: unavailable, json: unavailable };
  const adapters = options.adapters ?? [
    ...depopAdapters(client),
    ...poshmarkAdapters(offlineClient),
    ...mercariAdapters({ signed_in: false, page: unavailable }),
    ...ebayAdapters({ env: 'production', app_token: async () => undefined, user_token: async () => ({ ok: false }), send: unavailable }),
    ...ebayPageAdapters(ebayPageClient),
  ].map(adapter => (adapter.manifest.site === 'depop' && (live || !!options.publicClients)) || (adapter.manifest.site === 'ebay' && (ebayLive || !!options.publicClients)) || isWrite(adapter.manifest.verb) ? adapter : {
    ...adapter, async run() { return fail('no_route', `${adapter.manifest.site} live reads are unavailable`, { do: 'handoff', url: '' }); },
  });
  const liveMercari = (process.env.SECONDHAND_LIVE_SITES ?? '').split(/[ ,]+/).includes('mercari');
  let mercariPool: ReturnType<typeof createPool<BrowserPage>> | undefined;
  const mercari = linkedSearch({ accounts: scopedAccounts, async read(account_id, url, signal) {
    if (!liveMercari) throw new Error('Mercari live reads are disabled');
    if (!mercariPool) {
      const executablePath = process.env.SECONDHAND_CHROME_PATH;
      if (!executablePath) throw new Error('Mercari needs SECONDHAND_CHROME_PATH for its linked browser');
      const profileRoot = join(process.env.SECONDHAND_DATA_DIR ?? tmpdir(), 'secondhand-linked-browsers');
      const pw = createRequire(join(process.cwd(), 'app/package.json'))('playwright-core') as CdpPw;
      const launcher = cdpLauncher(pw, localChrome({ executablePath, scratch: join(profileRoot, 'anonymous') })) as Launcher<BrowserPage>;
      mercariPool = createPool({ launcher, profileRoot, accounts: scopedAccounts, vault, leases: memoryLeases(), log });
    }
    const result = await mercariPool.dispatch({ account_id, user_id: personScope.getStore(), job_id: crypto.randomUUID(), run: page => readSearchPage(page, url, signal, log) });
    if (!result.ok) throw new Error(result.message);
    return result.value;
  } });
  adapters.push(mercari);
  const harnessLog: Log = { ...log, call(kind, name, input, fn, describe) { return log.call(kind === 'harness' ? 'tool' : kind, name, input, fn, describe); } };
  const services = new Map(SITES.map(site => [site, createSiteService(site, adapters.filter(a => a.manifest.site === site), {
    concurrency: 1, store: st, data: liveSites.has(site) ? `live:${site}` : 'synthetic', log: harnessLog, now,
  })]));
  // Run the protocol's account/operation gate before entering a service, then preserve
  // the service's envelope (including fallback route, observations and stored write result).
  const gate = createHarness({ accounts: scopedAccounts, now, adapters: adapters.map(adapter => ({
    ...adapter, async run() { return { ok: true as const, data: null }; },
  })) });
  const harness: Harness = { async call(site, verb, args = {}) {
    return personScope.run(typeof args.person_id === 'string' ? args.person_id : '', async () => {
    const admitted = await gate.call(site, verb, args);
    if (!admitted.ok) return admitted;
    const account = typeof args.account_id === 'string' ? await accounts.byId(args.account_id, typeof args.person_id === 'string' ? args.person_id : undefined) : undefined;
    if (account && args.user_id !== undefined && args.user_id !== account.person_id)
      return { ...fail('policy_refused', 'account belongs to another person', { do: 'raise_decision', kind: 'link_account' }), meta: admitted.meta };
    if (isWrite(verb) && !liveSites.has(site)) {
      args = { ...args, dry: true };
      log.note('marketplace write forced dry', { site, verb, operation_id: args.operation_id });
    }
    return services.get(site)!.call(verb, { ...args,
      ...(isWrite(verb) && account && { user_id: account.person_id }),
    });
    });
  } };
  const routed: typeof searchPorts.routed = site => site === 'depop' || site === 'ebay'
    ? liveSites.has(site) || !!options.publicClients
    : site === 'mercari' && liveMercari;
  Object.assign(searchPorts, { harness, accounts, routed, apify: options.apifyToken ? createApify({ token: options.apifyToken, log }) : undefined });
  let closing: Promise<void> | undefined;
  const close = () => closing ??= Promise.resolve().then(() => options.publicClients?.close());
  const leases = memoryLeases(now);
  const cadence: Record<string, number> = {};
  for (const site of SITES) for (const [state, seconds] of Object.entries({ hot: 90, live: 900, quiet: 3600 })) cadence[`watch_cadence_s@${site}/${state}`] = seconds;
  const params = memoryParams({ watch_cadence_s: 900, job_lease_ttl_ms: 120000, delist_max_attempts: 3 }, cadence);
  const listings = (user_id: string): WatchedListing[] => st.systemRows('listing').flatMap(row => {
    if (row.user_id !== user_id || row.deleted || row.import_preview || typeof row.item_id !== 'string'
      || typeof row.account_id !== 'string' || typeof row.external_id !== 'string' || typeof row.state !== 'string'
      || !(WATCH_SITES as readonly unknown[]).includes(row.site)) return [];
    return [{ listing_id: row.id, item_id: row.item_id, account_id: row.account_id, external_id: row.external_id,
      site: row.site as WatchedListing['site'], state: row.state }];
  });
  class AccountSnapshots extends Map<string, Snapshot> {
    constructor() {
      super();
      for (const account of st.systemRows('account')) if (account.watch_snapshot && !account.deleted)
        super.set(account.id, account.watch_snapshot as Snapshot);
    }
    override set(account_id: string, snapshot: Snapshot) {
      const account = st.get('account', snapshot.user_id, account_id);
      if (!account) throw new Error(`snapshot account missing: ${account_id}`);
      st.put('account', { ...account, watch_snapshot: snapshot });
      return super.set(account_id, snapshot);
    }
  }
  const snapshots = new AccountSnapshots();
  const cents = (value: unknown) => integer(value) ? value : object(value) && integer(value.amount_cents) ? value.amount_cents : undefined;
  const watcherKinds = new Set(['poll_orders', 'poll_inbox', 'answer_offer', 'delist', 'reconcile', 'relink']);
  const watcherOwns = (job: JobRow) => {
    const event = st.events({ user_id: job.user_id }).find(event => event.id === job.event_id);
    const saleDelist = job.kind === 'delist' && event?.actor === 'auto' && typeof event.payload?.sold_listing_id === 'string';
    return watcherKinds.has(job.kind) && !!event && (event.source !== 'app' || saleDelist);
  };
  // shortcut: Store.claimJobs has no predicate port. Claim and release synchronously so
  // each worker executes only its own jobs, without a head-of-queue job starving the other.
  function claimJobs(limit: number, worker: string, watching: boolean) {
    let kept = 0;
    return st.claimJobs(st.jobs().length, worker).filter(job => {
      if (watcherOwns(job) === watching && kept < limit) { kept++; return true; }
      st.release(job.id);
      return false;
    });
  }
  const watcherStore: Store = { ...st, claimJobs: (limit, worker) => claimJobs(limit, worker, true),
    raiseDecision(decision) {
      const job = decision.job_id ? st.getJob(decision.job_id) : undefined;
      const midpoint = job?.kind === 'answer_offer' && job.args.decided_by === 'negotiation' && job.args.response === 'counter'
        && (decision.kind === 'counter_offer' || decision.kind === 'price_below_floor');
      return st.raiseDecision({ ...decision, ...(midpoint && {
        why: 'No acceptance model weighed this; the counter is the midpoint inside your limits.',
      }) });
    },
  };
  const watcher = createWatcher({ store: watcherStore, harness, accounts: systemAccounts, leases, params, log, now, snapshots,
    listings: {
      byExternal: (user_id, site, external_id) => listings(user_id).find(row => row.site === site && row.external_id === external_id),
      ofItem: (user_id, item_id) => listings(user_id).filter(row => row.item_id === item_id),
    },
    limits: { of(user_id, item_id) {
      const limits = st.get('limits', user_id, item_id);
      if (st.get('limits', user_id, user_id)?.ask_every_time === true || limits?.accept_mode === 'ask_all') return undefined;
      const item = st.get('item', user_id, item_id);
      const ask_cents = cents(limits?.ask_cents) ?? cents(item?.price_cents);
      let floor_cents = cents(limits?.floor_cents), always_accept_cents = cents(limits?.always_accept_cents);
      const conditions = st.rows('rule', { user_id }).filter(row => !row.deleted && row.state === 'auto'
        && row.kind === 'accept_offer' && (row.scope === 'all' || row.scope === item_id) && object(row.limits));
      for (const rule of conditions) {
        const condition = rule.limits as Record<string, unknown>;
        const floor = cents(condition.floor_cents), threshold = cents(condition.always_accept_cents);
        if (floor !== undefined && floor_cents !== undefined) floor_cents = Math.max(floor_cents, floor);
        if (threshold !== undefined && always_accept_cents !== undefined) always_accept_cents = Math.max(always_accept_cents, threshold);
      }
      return ask_cents !== undefined && floor_cents !== undefined && always_accept_cents !== undefined
        ? { ask_cents, floor_cents, always_accept_cents } : undefined;
    } },
    // shortcut: replace NaN with pAccept({site, kind, ask_cents, offer_cents, days_listed, buyer_tier, round?}, store) -> {p, basis_level, param_versions} from the engines lead.
    pAccept: () => NaN,
    // Hazard omitted until the engines lead supplies its port; the watcher's tier cadence applies.
    readArgs(account) {
      const row = st.get('account', account.user_id, account.account_id)!;
      // shortcut: spec/plans/waiting.md "A site handle on the account row" is still open.
      // Pass stored handles only; a secondhand account id is never a marketplace handle.
      return { person_id: account.user_id, ...Object.fromEntries(['shop_id', 'username', 'seller_id'].flatMap(key =>
        typeof row[key] === 'string' || typeof row[key] === 'number' ? [[key, row[key]]] : [])) };
    },
  });
  // Pipeline's policy port carries prices but no tenant/item; keep the claimed job in its async scope.
  const running = new AsyncLocalStorage<JobRow>();
  const worker = 'edge.runtime';
  const pipelineStore: Store = { ...st, claimJobs() { const job = running.getStore(); return job ? [job] : []; } };
  const pipeline = createPipeline({
    store: pipelineStore, harness: { call: (site, verb, args) => harness.call(site, verb as Parameters<Harness['call']>[1], { ...args, person_id: running.getStore()?.user_id }) }, leases, params, log, worker, now,
    engines: {
      async unlink() { return { unlinked: true }; },
      async import(job) {
        return st.tx(() => {
          const item_ids: string[] = [], listing_ids: string[] = [];
          for (const id of job.args.listing_ids as string[]) {
            const source = st.get('listing', job.user_id, id);
            if (!source || source.account_id !== job.account_id) throw new Error('import listing is outside this account');
            const item_id = typeof source.matches_item_id === 'string' ? source.matches_item_id : `it_${crypto.randomUUID().replaceAll('-', '')}`;
            if (!st.get('item', job.user_id, item_id)) st.put('item', { id: item_id, user_id: job.user_id, title: source.title ?? '', state: 'live', origin: 'import', data: source.data, quantity: 1, attributes: [], photos: [], created_at: source.read_at, updated_at: source.read_at });
            const prior = st.rows('listing', { user_id: job.user_id, account_id: job.account_id, external_id: source.external_id }).find(row => !row.import_preview);
            const listing_id = prior?.id ?? `ls_${crypto.randomUUID().replaceAll('-', '')}`;
            if (!prior) st.put('listing', { ...source, version: undefined, id: listing_id, item_id, import_preview: false });
            st.put('listing', { ...source, matches_item_id: item_id });
            item_ids.push(item_id); listing_ids.push(listing_id);
            log.event('state.change', { entity: 'listing', id: listing_id, to: 'imported', item_id, job: job.id });
          }
          return { item_ids, listing_ids, ...(job.args.purchases ? { purchases: { state: 'no_route' } } : {}) };
        });
      },
    },
    policy(input) {
      const job = running.getStore()!;
      const limits = job.item_id ? st.get('limits', job.user_id, job.item_id) : undefined;
      const rules = st.rows('rule', { user_id: job.user_id }).filter(row => !row.deleted && row.state === 'auto' && (row.scope === 'all' || row.scope === job.item_id));
      const conditions = rules.filter(row => row.kind === input.decision_kind && object(row.limits)).map(row => row.limits as Record<string, unknown>);
      const cents = (value: unknown, fallback?: number) => object(value) && integer(value.amount_cents) ? value.amount_cents : fallback;
      const floor = Math.max(cents(limits?.floor_cents, input.floor_cents) ?? 0, ...conditions.map(row => cents(row.floor_cents) ?? 0));
      const thresholds = [cents(limits?.always_accept_cents, limits ? undefined : input.always_accept_cents), ...conditions.map(row => cents(row.always_accept_cents))].filter((n): n is number => n !== undefined);
      const result = check({ ...input, floor_cents: floor, always_accept_cents: thresholds.length ? Math.max(...thresholds) : undefined, promoted: new Set(rules.filter(row => row.kind !== 'accept_offer').map(row => String(row.kind))) });
      if (!result.allow) return result;
      if (input.actor !== 'user' && (st.get('limits', job.user_id, job.user_id)?.ask_every_time === true || input.decision_kind === 'markdown' && limits?.markdown_on === false || ['answer_offer', 'make_offer'].includes(input.action) && limits?.accept_mode === 'ask_all')) return { allow: false, mode: 'ask', decision_kind: input.decision_kind, hint: { do: 'raise_decision', kind: input.decision_kind } };
      return result;
    },
  });
  return { store: st, vault, accounts, harness, close, leases, params, watcher, pipeline: {
    async runOnce(limit: number) {
      const claimed = claimJobs(limit, worker, false);
      await Promise.all(claimed.map(job => running.run(job, () => pipeline.runOnce(1))));
      return claimed.length;
    },
  } };
}

// Apify is never in the path an answer waits on (Nate, product/words.md 2026-11-15 08:25): it is composed again only as a background fill.
export const runtime = createRuntime(store);

export function owned(table: Table, ctx: Ctx, id: string): Row {
  const row = runtime.store.get(table, ctx.user_id!, id);
  if (!row || row.deleted) throw new ApiError('not_found', `no ${table} ${id} for this user`, 'read');
  return row;
}
export function checkVersion(row: Row, expected: unknown) {
  if (expected !== row.version) throw new ApiError('stale', 'the resource changed', 'version_check', { by: 'user' }, { current: { version: row.version } });
}
export function publicRow(row: Row, includeVersion = false) {
  const { user_id, version, data, deleted, pending, token_ref, read_at, purchases, import_preview, account_id, item_id, required_fields, watch_snapshot, ...view } = row;
  return { ...view, ...(includeVersion ? { version } : {}) };
}
export function engine(handler: Handler): Handler {
  return fromEngine((ctx, req) => {
    pagination(ctx);
    ctx.log.input('api', req.method, { fields: Object.keys(ctx.body), query_fields: [...ctx.query.keys()] });
    return handler(ctx, req);
  });
}
export function list(ctx: Ctx, rows: unknown[]) {
  const scope = JSON.stringify([ctx.params, [...ctx.query.entries()].filter(([k]) => !['cursor', 'limit'].includes(k)).sort()]);
  const cursor = ctx.query.get('cursor');
  let offset = 0;
  if (cursor) {
    let parsed: unknown;
    try { parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()); } catch { throw invalid('cursor is not valid'); }
    if (!object(parsed) || parsed.scope !== scope || !integer(parsed.offset) || parsed.offset > rows.length) throw invalid('cursor is not valid for this list');
    offset = parsed.offset;
  }
  const limit = Number(ctx.query.get('limit') ?? 100);
  return { data: rows.slice(offset, offset + limit), next_cursor: offset + limit < rows.length ? Buffer.from(JSON.stringify({ scope, offset: offset + limit })).toString('base64url') : null };
}
