// Rests-on: spec/product.md §7 Resources; spec/examples/.
import { ApiError, type Ctx, type Handler } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text, bool, version, oneOf, object, invalid, reference } from './captures.ts';

import { followedProducts, type Follow } from '../market/market.ts';
import { example } from './examples.ts';

type StoredFollow = Follow & { channel: string; version: number };
const seedFollow = (example('follows.list').response as { data: { id: string; target: { product_id: string }; channel: string; state: 'active'; version: number }[] }).data[0];
const followRows = new Map<string, StoredFollow>([[seedFollow.id, { id: seedFollow.id, product_id: seedFollow.target.product_id, user_id: 'usr_8f2k', state: 'active', channel: seedFollow.channel, version: seedFollow.version }]]);
export const ports: { read(user: string): Promise<StoredFollow[]>; write(row: StoredFollow, expectedVersion?: number): Promise<void> } = {
  read: async user => structuredClone([...followRows.values()].filter(row => row.user_id === user)),
  write: async (row, expectedVersion) => { const old = followRows.get(row.id); if (expectedVersion !== undefined && old?.version !== expectedVersion) throw new ApiError('stale', 'follow changed', 'version_check', { by: 'user' }, { current: { version: old?.version } }); followRows.set(row.id, structuredClone(row)); },
};
const initialFollows = structuredClone([...followRows.entries()]);
export function resetFollows() { followRows.clear(); for (const [id, row] of structuredClone(initialFollows)) followRows.set(id, row); }
async function followVersion(ctx: Ctx) { const row = (await ports.read(ctx.user_id!)).find(row => row.id === ctx.params.id && row.user_id === ctx.user_id); if (!row) throw new ApiError('not_found', 'follow not found', 'read'); return row.version; }
export const handlers: Record<string, Handler> = {
  'GET /v1/products/:id': exampleHandler('GET /v1/products/:id'),
  'GET /v1/products/:id/history': exampleHandler('GET /v1/products/:id/history', c => { const range = c.query.get('range'); if (range && !/^\d+d$/.test(range)) throw invalid('range must be days'); }),
  'GET /v1/trends': exampleHandler('GET /v1/trends', c => { const window = c.query.get('window'); if (window && !oneOf('7d', '30d')(window)) throw invalid('unknown window'); }),
  'GET /v1/index/:id': exampleHandler('GET /v1/index/:id'),
  'POST /v1/follows': fromEngine(exampleHandler('POST /v1/follows', c => { fields(c.body, { target: v => object(v) && text(v.product_id), channel: oneOf('push', 'email', 'in_app') }); reference((c.body.target as Record<string, unknown>).product_id, ['pr_4hd1']); }, undefined, async (ctx, seed) => {
    const body = seed.body as { id: string; target: { product_id: string }; version: number };
    const row: StoredFollow = { id: body.id, user_id: ctx.user_id!, product_id: String((ctx.body.target as { product_id: string }).product_id), state: 'active', channel: String(ctx.body.channel), version: body.version };
    await ports.write(row);
    const active = followedProducts(ctx.user_id!, [row]);
    ctx.log.event('state.change', { entity: 'follow', id: row.id, to: row.state });
    return { ...seed, body: { ...body, target: { product_id: active[0] }, channel: row.channel, state: row.state } };
  })),
  // A person's own follows, read from the store: a new person gets an empty list, not the example gate's 404.
  'GET /v1/follows': fromEngine(async ctx => {
    const rows = (await ports.read(ctx.user_id!)).filter(row => row.user_id === ctx.user_id && row.state !== 'removed');
    const active = new Set(followedProducts(ctx.user_id!, rows));
    return { status: 200, body: { data: rows.map(row => ({ id: row.id, target: { product_id: row.product_id }, channel: row.channel, state: active.has(row.product_id) ? 'active' : 'muted', muted_at: row.muted_at ?? null, version: row.version })), next_cursor: null } };
  }),
  'PATCH /v1/follows/:id': fromEngine(exampleHandler('PATCH /v1/follows/:id', c => fields(c.body, { version, muted: bool }), undefined, async (ctx, seed) => {
    const rows = await ports.read(ctx.user_id!), row = rows.find(row => row.id === ctx.params.id && row.user_id === ctx.user_id);
    if (!row) throw invalid('follow not available');
    const body = seed.body as { muted_at: string; version: number };
    const next: StoredFollow = { ...row, state: ctx.body.muted ? 'muted' : 'active', muted_at: ctx.body.muted ? body.muted_at : undefined, version: Number(ctx.body.version) + 1 };
    await ports.write(next, Number(ctx.body.version));
    const active = followedProducts(ctx.user_id!, [next]).includes(next.product_id);
    ctx.log.event('state.change', { entity: 'follow', id: next.id, to: next.state });
    return { ...seed, body: { ...body, version: next.version, state: active ? 'active' : 'muted', muted_at: next.muted_at ?? null } };
  }, followVersion)),
  'DELETE /v1/follows/:id': fromEngine(exampleHandler('DELETE /v1/follows/:id', undefined, undefined, async (ctx, seed) => {
    const row = (await ports.read(ctx.user_id!)).find(row => row.id === ctx.params.id && row.user_id === ctx.user_id);
    if (!row) throw invalid('follow not available');
    await ports.write({ ...row, state: 'removed', version: row.version + 1 }, row.version);
    ctx.log.event('state.change', { entity: 'follow', id: row.id, to: 'removed' });
    return seed;
  })),
};
export const manifest = manifestFor(handlers);
