// Rests-on: spec/product.md §7; spec/features/watch.md.
import { createHash } from 'node:crypto';
import { ApiError, deps, type Ctx, type Handler } from './http.ts';
import { manifestFor, fromEngine, fields, text, version, money, oneOf, object, invalid, siteList, pagination, captureRows } from './captures.ts';
import { example } from './examples.ts';
import { store } from './store.ts';
import type { Store, Row } from '../events/ports.ts';
import { watchRun, type Want, type Match, type Listing } from '../watch/watch.ts';

const owner = 'usr_8f2k';
export type WantRow = Row & { state: Want['state']; text: string; sites: string[]; alert: Want['alert']; created_at: string; checked: Record<string, string>; behind: string[]; next_check_at?: string; schedule?: { every_min: number } };
const id = (v: unknown) => typeof v === 'string' && /^[a-z]+_[A-Za-z0-9]{1,64}$/.test(v);
const schedule = (v: unknown) => object(v) && typeof v.every_min === 'number' && Number.isFinite(v.every_min) && v.every_min > 0;
const missing = () => new ApiError('not_found', 'resource not found', 'read');
export function seedWants(st: Store) {
  const detail = example('wants.get').response as Record<string, unknown> & { id: string };
  if (!st.get('want', owner, detail.id)) {
    const { version: _version, ...row } = detail;
    st.put('want', { ...row, user_id: owner, created_at: '2026-11-15T05:00:00Z' });
  }
  for (const match of (example('wants.matches').response as { data: Row[] }).data) {
    if (!st.get('match', owner, match.id)) st.put('match', { ...match, user_id: owner });
  }
}
seedWants(store);
const publicRow = (row: Row) => Object.fromEntries(Object.entries(row).filter(([key]) => !['user_id', 'created_at', 'create_key', 'create_hash', 'not_same'].includes(key)));
function page(ctx: Ctx, rows: Record<string, unknown>[]) {
  const cursor = ctx.query.get('cursor');
  let offset = 0;
  if (cursor) {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      if (!object(parsed) || parsed.user !== ctx.user_id || parsed.id !== (ctx.params.id ?? '') || !Number.isSafeInteger(parsed.offset) || Number(parsed.offset) < 0 || Number(parsed.offset) > rows.length) throw invalid('cursor is not valid');
      offset = Number(parsed.offset);
    } catch { throw invalid('cursor is not valid'); }
  }
  const limit = Number(ctx.query.get('limit') ?? 100);
  return { data: rows.slice(offset, offset + limit), next_cursor: offset + limit < rows.length ? Buffer.from(JSON.stringify({ user: ctx.user_id, id: ctx.params.id ?? '', offset: offset + limit })).toString('base64url') : null };
}
export function wantsOn(st: Store): Record<string, Handler> {
  const want = (ctx: Ctx) => { const row = st.get<WantRow>('want', ctx.user_id!, ctx.params.id); if (!row) throw missing(); return row; };
  const wrap = (run: Handler): Handler => fromEngine((ctx, req) => {
    pagination(ctx);
    ctx.log.input('api', 'want', { fields: Object.keys(ctx.body), query_fields: [...ctx.query.keys()] });
    return run(ctx, req);
  });
  return {
    'POST /v1/wants': wrap(ctx => {
      fields(ctx.body, { text, max_total_cents: money, sites: siteList, alert: oneOf('available', 'under') }, { fit: object, product_id: id, capture_id: id });
      if (ctx.body.capture_id !== undefined && captureRows.get(ctx.body.capture_id as string)?.user_id !== ctx.user_id) throw new ApiError('not_found', 'capture not found', 'read');
      const key = ctx.headers.get('Idempotency-Key');
      const prior = key ? st.rows('want', { user_id: ctx.user_id!, create_key: key })[0] : undefined;
      const create_hash = createHash('sha256').update(JSON.stringify(ctx.body)).digest('hex');
      if (prior) {
        if (prior.create_hash !== create_hash) throw new ApiError('idempotency_mismatch', 'key was used with a different body', 'idempotency');
        return { status: 201, body: createView(prior) };
      }
      const row = st.put('want', { ...ctx.body, id: 'want_' + crypto.randomUUID().replaceAll('-', ''), user_id: ctx.user_id!, state: 'active', created_at: new Date().toISOString(), checked: {}, behind: ctx.body.sites, ...(key ? { create_key: key, create_hash } : {}) });
      ctx.log.event('state.change', { entity: 'want', id: row.id, to: 'active' });
      return { status: 201, body: createView(row) };
    }),
    'GET /v1/wants': wrap(ctx => {
      const rows = st.rows<WantRow>('want', { user_id: ctx.user_id! }).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      return { status: 200, body: page(ctx, rows.map(row => ({ id: row.id, state: row.state, text: row.text, new_matches: st.rows('match', { user_id: ctx.user_id!, want_id: row.id, state: 'alerted' }).length, checked: row.checked, behind: row.behind, version: row.version }))) };
    }),
    'GET /v1/wants/:id': wrap(ctx => ({ status: 200, body: publicRow(want(ctx)) })),
    'PATCH /v1/wants/:id': wrap(ctx => {
      const row = want(ctx);
      fields(ctx.body, { version }, { state: oneOf('active', 'paused', 'ended'), text, fit: object, max_total_cents: money, sites: siteList, schedule, alert: oneOf('available', 'under') });
      const edits = Object.fromEntries(Object.entries(ctx.body).filter(([key]) => ['state', 'text', 'fit', 'max_total_cents', 'sites', 'schedule', 'alert'].includes(key)));
      if (!Object.keys(edits).length) throw invalid('no want edits');
      if (ctx.body.version !== row.version) throw new ApiError('stale', 'want changed', 'version_check', { by: 'user' }, { current: { version: row.version } });
      const next = st.put('want', { ...row, ...edits });
      ctx.log.event('state.change', { entity: 'want', id: row.id, to: next.state });
      return { status: 200, body: { id: next.id, state: next.state, version: next.version } };
    }),
    'GET /v1/wants/:id/matches': wrap(ctx => {
      want(ctx);
      return { status: 200, body: page(ctx, st.rows('match', { user_id: ctx.user_id!, want_id: ctx.params.id }).map(row => { const { version: _version, ...view } = publicRow(row); return { ...view, price_cents: typeof view.price_cents === 'number' ? { amount_cents: view.price_cents, currency: 'USD' } : view.price_cents, delivered_cents: typeof view.delivered_cents === 'number' ? { amount_cents: view.delivered_cents, currency: 'USD' } : view.delivered_cents }; })) };
    }),
    'POST /v1/matches/:id/act': wrap(ctx => {
      const row = st.get('match', ctx.user_id!, ctx.params.id);
      if (!row || !st.get('want', ctx.user_id!, String(row.want_id))) throw missing();
      fields(ctx.body, { action: oneOf('dismiss', 'save', 'not_same', 'bought') }, { version });
      if (ctx.body.version !== undefined && ctx.body.version !== row.version) throw new ApiError('stale', 'match changed', 'version_check', { by: 'user' }, { current: { version: row.version } });
      const action = ctx.body.action as 'dismiss' | 'save' | 'not_same' | 'bought';
      const state = { dismiss: 'dismissed', save: 'saved', not_same: 'dismissed', bought: 'bought' }[action];
      const next = st.put('match', { ...row, state, ...(action === 'not_same' ? { not_same: true } : {}) });
      ctx.log.event('state.change', { entity: 'match', id: next.id, to: state });
      return { status: 200, body: { id: next.id, state } };
    }),
  };
}
function createView(row: Row) { const { checked: _checked, behind: _behind, ...view } = publicRow(row); return view; }

export function runWant(st: Store, want_id: string, listings: Listing[], prior: Match[], opts: Parameters<typeof watchRun>[3] & { user_id: string; log?: Ctx['log']; checked?: Record<string, string>; behind?: string[]; next_check_at?: string }) {
  const log = opts.log ?? deps.log;
  log.input('watch', 'run', { want_id, listings_count: listings.length, prior_count: prior.length });
  return st.tx(t => {
    const row = t.get<WantRow>('want', opts.user_id, want_id);
    if (!row) throw missing();
    if (row.deleted || row.state !== 'active') return { matches: [], push: [], digest: [], gone: [] };
    const stored = t.rows('match', { user_id: opts.user_id, want_id });
    const notSame = new Set([...opts.notSame ?? [], ...stored.filter(m => m.not_same).map(m => String(m.url))]);
    const amount = row.max_total_cents as { amount_cents: number } | number | undefined;
    const fit = row.fit as (Want['fit'] & { attributes?: { size?: string } }) | undefined;
    const toCents = (amount: unknown) => typeof amount === 'number' ? amount : Number((amount as { amount_cents: number }).amount_cents);
    const history = new Map(prior.map(match => [match.id, match]));
    for (const match of stored) history.set(match.id, { ...match, price_cents: toCents(match.price_cents), delivered_cents: toCents(match.delivered_cents) } as unknown as Match);
    const behind = new Set(opts.behind ?? []);
    const result = watchRun({ ...row, fit: fit ? { ...fit, size: fit.size ?? fit.attributes?.size } : undefined, max_total_cents: typeof amount === 'number' ? amount : amount?.amount_cents }, listings.filter(listing => !behind.has(listing.site)), [...history.values()].filter(match => !behind.has(match.site)), { ...opts, notSame });
    for (const match of result.matches) {
      const old = stored.find(m => m.id === match.id);
      t.put('match', { ...old, ...match, user_id: row.user_id });
      log.event('state.change', { entity: 'match', id: match.id, to: match.state });
    }
    result.matches.push(...[...history.values()].filter(match => behind.has(match.site)));
    t.put('want', { ...row, checked: { ...row.checked, ...opts.checked }, behind: opts.behind ?? row.behind, ...(opts.next_check_at ? { next_check_at: opts.next_check_at } : {}) });
    log.event('state.change', { entity: 'want', id: row.id, to: row.state, matches_count: result.matches.length });
    return result;
  });
}
export const handlers = wantsOn(store);
export const manifest = manifestFor(handlers);
