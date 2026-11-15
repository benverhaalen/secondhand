// Rests-on: spec/product.md §3, §5, §6 Harnesses, §7; spec/examples/{items,sell,you}.json.
import { AsyncLocalStorage } from 'node:async_hooks';
import { createLog, consoleSink, type Log } from '../../../../log/index.js';
import { store } from './store.ts';
import { example } from './examples.ts';
import { ApiError, type Ctx, type Handler } from './http.ts';
import { fromEngine, pagination, object, integer, invalid } from './captures.ts';
import { memoryVault, type Accounts, type LinkedAccount } from '../browser/auth.ts';
import { createHarness, fail, isWrite } from '../harness/protocol.ts';
import { depopAdapters, API, type Client } from '../harness/sites/depop/adapter.ts';
import { memoryLeases, memoryParams, type Row, type Table, type Store, type JobRow } from '../events/ports.ts';
import { createPipeline } from '../events/pipeline.ts';
import { check } from '../events/policy.ts';
import { SITES } from '../harness/names.ts';

export const EXAMPLE_USER = 'usr_8f2k';
export const manifest = [];
const response = (name: string) => structuredClone(example(name).response) as Record<string, unknown>;

export function seedExamples(st: Store) {
  const seed = (table: Table, data: Record<string, unknown> & { id: string }) => {
    if (st.get(table, EXAMPLE_USER, data.id)) return;
    const { version, ...fields } = data;
    let row = st.put(table, { ...fields, user_id: EXAMPLE_USER });
    while (row.version! < Number(version ?? 1)) row = st.put(table, row);
  };
  st.tx(() => {
    const card = response('items.get');
    const tiles = response('items.list').data as Row[];
    seed('item', { ...card, tile: tiles.find(row => row.id === card.id), strategy_options: { fast: response('items.strategy').strategies } } as Row);
    for (const tile of (response('items.list').data as Row[])) seed('item', { attributes: [], photos: [], listings: [], ...tile, tile });
    for (const listing of card.listings as Row[]) seed('listing', { ...listing, item_id: card.id, account_id: listing.site === 'ebay' ? 'acc_eb1' : 'acc_dp1', required_fields: ['chest_width'] });
    const preview = response('accounts.import_preview');
    for (const listing of preview.listings as Record<string, unknown>[]) seed('listing', { ...listing, id: `ls_import_${listing.external_id}`, account_id: preview.account_id, site: preview.site, import_preview: true, read_at: preview.read_at });
    for (const account of response('accounts.list').data as Row[]) seed('account', account);
    const depop = response('accounts.connect.depop');
    seed('account', { ...depop, pending: true, read_at: preview.read_at, purchases: preview.purchases });
    const limits = response('limits.get');
    const { items, ...userLimits } = limits;
    seed('limits', { ...userLimits, id: EXAMPLE_USER });
    for (const item of items as Record<string, unknown>[]) seed('limits', { ...item, id: String(item.item_id) });
    for (const rule of response('rules.list').data as Row[]) seed('rule', rule);
    if (!st.decisions({ user_id: EXAMPLE_USER }).some(row => row.id === 'dec_lb1')) {
      const d = (response('today.get').decisions as Record<string, unknown>[]).find(row => row.id === 'dec_lb1')!;
      const saved = st.raiseDecision({ user_id: EXAMPLE_USER, kind: String(d.kind), subject: String(d.item_id ?? 'dec_lb1'), item_id: typeof d.item_id === 'string' ? d.item_id : undefined, why: String(d.why), options: d.options as { id: string; label: string }[] }).row;
      st.updateDecision(saved.id, { id: 'dec_lb1' });
    }
  });
}

export function createRuntime(st: Store, log: Log = createLog({ src: 'edge.runtime', build: process.env.npm_package_version ?? 'dev', sink: consoleSink })) {
  seedExamples(st);
  // shortcut: session state is process-local until the Databricks secret-scope AuthVault joins.
  const vault = memoryVault();
  // Store reads require a tenant. The demo tenant is known at startup; tenant-scoped enumeration registers other owners.
  const owners = new Set([EXAMPLE_USER]);
  const accounts: Accounts = {
    async linked(person_id) {
      if (person_id) owners.add(person_id);
      const rows = [...(person_id ? [person_id] : owners)].flatMap(user_id => st.rows('account', { user_id }));
      const linked = await Promise.all(rows.map(async row => {
        if (row.deleted || typeof row.token_ref !== 'string' || !(SITES as readonly unknown[]).includes(row.site) || !await vault.get(row.token_ref)) return undefined;
        return { account_id: row.id, person_id: row.user_id, site: row.site, token_ref: row.token_ref } as LinkedAccount;
      }));
      return linked.filter((row): row is LinkedAccount => row !== undefined);
    },
    async byId(id) { return (await accounts.linked()).find(row => row.account_id === id); },
  };
  const live = (process.env.SECONDHAND_LIVE_SITES ?? '').split(/[ ,]+/).includes('depop');
  const client: Client = {
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
  const adapters = depopAdapters(client).map(adapter => live || isWrite(adapter.manifest.verb) ? adapter : {
    ...adapter, async run() { return fail('no_route', 'Depop live reads are disabled', { do: 'handoff', url: 'https://www.depop.com/' }); },
  });
  const harnessLog: Log = { ...log, call(kind, name, input, fn, describe) { return log.call(kind === 'harness' ? 'tool' : kind, name, input, fn, describe); } };
  const harness = createHarness({ adapters, accounts, log: harnessLog });
  const leases = memoryLeases();
  const cadence: Record<string, number> = {};
  for (const site of SITES) for (const [state, seconds] of Object.entries({ hot: 90, live: 900, quiet: 3600 })) cadence[`watch_cadence_s@${site}/${state}`] = seconds;
  const params = memoryParams({ watch_cadence_s: 900, job_lease_ttl_ms: 120000, delist_max_attempts: 3 }, cadence);
  // Pipeline's policy port carries prices but no tenant/item; keep the claimed job in its async scope.
  const running = new AsyncLocalStorage<JobRow>();
  const worker = 'edge.runtime';
  const pipelineStore: Store = { ...st, claimJobs() { const job = running.getStore(); return job ? [job] : []; } };
  const pipeline = createPipeline({
    store: pipelineStore, harness, leases, params, log, worker, now: Date.now,
    engines: {
      async unlink() { return { unlinked: true }; },
      async import(job) {
        return st.tx(() => {
          const item_ids: string[] = [], listing_ids: string[] = [];
          for (const id of job.args.listing_ids as string[]) {
            const source = st.get('listing', job.user_id, id);
            if (!source || source.account_id !== job.account_id) throw new Error('import listing is outside this account');
            const item_id = typeof source.matches_item_id === 'string' ? source.matches_item_id : `it_${crypto.randomUUID().replaceAll('-', '')}`;
            if (!st.get('item', job.user_id, item_id)) st.put('item', { id: item_id, user_id: job.user_id, title: source.title ?? '', state: 'live', origin: 'import', quantity: 1, attributes: [], photos: [], created_at: source.read_at, updated_at: source.read_at });
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
  return { store: st, vault, accounts, harness, leases, params, pipeline: {
    async runOnce(limit: number) {
      const claimed = st.claimJobs(limit, worker);
      await Promise.all(claimed.map(job => running.run(job, () => pipeline.runOnce(1))));
      return claimed.length;
    },
  } };
}

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
  const { user_id, version, deleted, pending, token_ref, read_at, purchases, import_preview, account_id, item_id, required_fields, ...view } = row;
  return { ...view, ...(includeVersion ? { version } : {}) };
}
export function engine(handler: Handler): Handler {
  return fromEngine((ctx, req) => {
    owned('limits', ctx, ctx.user_id!);
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
