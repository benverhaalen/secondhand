// Rests-on: spec/product.md §6 Secrets and marketplace sessions, §7; spec/examples/you.json.
import { ApiError, type Ctx, type Handler } from './http.ts';
import { manifestFor, fields, bool, strings, oneOf, invalid, sites, object } from './captures.ts';
import { runtime, engine, owned, publicRow, list, checkVersion } from './runtime.ts';
import { example } from './examples.ts';
import type { Row, JobRow } from '../events/ports.ts';
import type { Site } from '../harness/protocol.ts';

function accountJob(ctx: Ctx, account: Row, kind: 'import' | 'unlink', args: Record<string, unknown>) {
  const seed = example(kind === 'import' ? 'accounts.import' : 'accounts.unlink').response as { id: string };
  const { row } = runtime.store.insertJob({ kind: kind as JobRow['kind'], user_id: ctx.user_id!, account_id: account.id, site: account.site as JobRow['site'], event_id: ctx.request_id, idempotency_key: `${kind}:${ctx.request_id}`, args, state: 'queued', stages: [], attempts: 0, trace_id: ctx.request_id, created_at: new Date().toISOString() });
  const job = !runtime.store.getJob(seed.id) ? runtime.store.updateJob(row.id, { id: seed.id }) : row;
  ctx.log.job(job.id, kind, job.state);
  return { id: job.id, kind, state: job.state, stages: job.stages };
}

async function readListings(ctx: Ctx, account: Row) {
  const result = await runtime.harness.call<Record<string, unknown>[]>(account.site as Site, 'read_listings', { account_id: account.id, shop_id: account.shop_id ?? account.id });
  if (!result.ok && !['no_route', 'policy_refused'].includes(result.error.code)) throw new ApiError('site_failed', result.error.message, 'read_listings', { by: 'user' });
  if (result.ok) {
    if (!Array.isArray(result.data) || !result.data.every(row => object(row) && typeof row.external_id === 'string' && typeof row.price_cents === 'number')) throw new ApiError('site_failed', 'listing response is not valid', 'read_listings', { by: 'user' });
    const at = new Date().toISOString();
    runtime.store.tx(() => {
      const cached = runtime.store.rows('listing', { user_id: ctx.user_id!, account_id: account.id, import_preview: true });
      for (const row of cached) if (row.data !== `live:${account.site}` || !result.data.some(current => current.external_id === row.external_id)) runtime.store.put('listing', { ...row, preview_current: false });
      for (const row of result.data) {
        const prior = cached.find(current => current.external_id === row.external_id && current.data === `live:${account.site}`);
        const id = prior?.id ?? `ls_${crypto.randomUUID().replaceAll('-', '')}`;
        runtime.store.put('listing', { ...prior, ...row, id, user_id: ctx.user_id!, data: `live:${account.site}`, site: account.site, account_id: account.id, import_preview: true, preview_current: true, price_cents: { amount_cents: row.price_cents, currency: row.currency ?? 'USD' }, read_at: at, matches_item_id: prior?.matches_item_id ?? null });
      }
      runtime.store.put('account', { ...account, read_at: at });
    });
  }
  const rows = runtime.store.rows('listing', { user_id: ctx.user_id!, account_id: account.id, import_preview: true }).filter(row => row.preview_current !== false);
  return { rows, source: result.ok ? 'live' : 'stored', read_at: result.ok ? new Date().toISOString() : account.read_at, reason: result.ok ? undefined : result.error.code };
}

export const handlers: Record<string, Handler> = {
  'POST /v1/accounts': engine(async ctx => {
    fields(ctx.body, { site: sites });
    if (!oneOf('ebay', 'depop')(ctx.body.site)) throw invalid('no connection route for this site');
    const seed = structuredClone(example(ctx.body.site === 'depop' ? 'accounts.connect.depop' : 'accounts.connect.ebay').response) as Row;
    const prior = runtime.store.rows('account', { user_id: ctx.user_id!, site: ctx.body.site })[0];
    const { token_ref, ...current } = prior ?? {};
    const id = prior?.id ?? `acc_${crypto.randomUUID().replaceAll('-', '')}`;
    const connected = { ...seed, id };
    if (seed.site === 'ebay' && object(seed.next)) connected.next = { ...seed.next, url: String(seed.next.url).replace(seed.id, id) };
    runtime.store.put('account', { ...current, ...connected, user_id: ctx.user_id!, pending: false, deleted: false });
    if (typeof token_ref === 'string') await runtime.vault.delete(token_ref);
    ctx.log.event('state.change', { entity: 'account', id, to: 'paused' });
    return { status: 201, body: connected };
  }),
  'GET /v1/accounts': engine(ctx => ({ status: 200, body: list(ctx, runtime.store.rows('account', { user_id: ctx.user_id! }).filter(row => !row.deleted && !row.pending).map(row => publicRow(row))) })),
  'GET /v1/accounts/:id/import-preview': engine(async ctx => {
    const account = owned('account', ctx, ctx.params.id);
    const read = await readListings(ctx, account);
    const listings = read.rows.map(row => {
      const { external_id, title, price_cents, photo_url, state, matches_item_id } = row;
      return { external_id, title, price_cents, photo_url, state, matches_item_id: matches_item_id ?? null };
    });
    return { status: 200, headers: { 'X-Secondhand-Source': read.source, ...(read.reason ? { 'X-Secondhand-Reason': read.reason } : {}) }, body: { account_id: account.id, site: account.site, read_at: read.read_at, listings, purchases: account.purchases ?? 0 } };
  }),
  'POST /v1/accounts/:id/import': engine(async ctx => {
    const account = owned('account', ctx, ctx.params.id);
    fields(ctx.body, { listings: bool, purchases: bool }, { external_ids: strings });
    const read = await readListings(ctx, account);
    const selected = ctx.body.external_ids as string[] | undefined;
    const rows = ctx.body.listings ? read.rows.filter(row => !selected || selected.includes(String(row.external_id))) : [];
    if (selected?.some(id => !read.rows.some(row => row.external_id === id))) throw invalid('external_ids includes a listing outside this account', ['external_ids']);
    const body = accountJob(ctx, account, 'import', { listing_ids: rows.map(row => row.id), purchases: ctx.body.purchases });
    return { status: 202, headers: { 'X-Secondhand-Source': read.source }, body };
  }),
  'DELETE /v1/accounts/:id': engine(async ctx => {
    const row = owned('account', ctx, ctx.params.id);
    const expected = ctx.headers.get('If-Match') ?? ctx.query.get('version');
    if (expected !== null) checkVersion(row, Number(expected.replaceAll('"', '')));
    const token_ref = row.token_ref;
    const body = runtime.store.tx(() => {
      runtime.store.put('account', { ...row, token_ref: undefined, deleted: true, health: 'paused' });
      return accountJob(ctx, row, 'unlink', {});
    });
    if (typeof token_ref === 'string') await runtime.vault.delete(token_ref);
    ctx.log.event('state.change', { entity: 'account', id: row.id, to: 'unlinked' });
    return { status: 202, body };
  }),
};
export const manifest = manifestFor(handlers);
