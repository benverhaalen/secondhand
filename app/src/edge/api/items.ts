// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Ctx, Handler } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text, bool, version, money, oneOf, object, invalid, sites, siteList } from './captures.ts';
import { ApiError } from './http.ts';
import { assembleCard, mergeAttribute, type CardPort, type CardRecord, type Attribute } from '../card/card.ts';
import { planOf, HORIZON_DAYS, type PlanChoice, type Objective } from '../../engines/valuation/path.ts';
import { example, examplesServed } from './examples.ts';
import { runtime, createRuntime, seedExamples, engine, owned, checkVersion, publicRow, list, readable, EXAMPLE_USER } from './runtime.ts';
import { memoryStore, type Row } from '../events/ports.ts';
import { itemLimits, validateLimits, limitsView } from './rules.ts';
import { write, logReceived } from '../events/intake.ts';
import { deps } from './http.ts';

type ItemView = Record<string, unknown> & { id: string; title: string; state: string; quantity: number; product_id?: string; updated_at: string; version: number; attributes: (Omit<Attribute, 'confidence' | 'method' | 'at'> & { id: string })[]; photos: (CardRecord['photos'][number] & Record<string, unknown>)[]; listings: (CardRecord['listings'][number] & Record<string, unknown>)[] };
const view = example('items.get').response as ItemView;
const tileExamples = (example('items.list').response as { data: Record<string, unknown>[] }).data;
const selectFields = (row: object, shapes: object[]) => {
  const keys = new Set(shapes.flatMap(shape => Object.keys(shape)));
  return Object.fromEntries(Object.entries(row).filter(([key]) => keys.has(key)));
};
export const ports: CardPort & { write(user: string, row: CardRecord, expectedVersion: number): Promise<number> } = {
  async read(user, id) {
    const row = runtime.store.get('item', user, id);
    if (!row || row.deleted) return undefined;
    const attributes = (Array.isArray(row.attributes) ? row.attributes : []) as ItemView['attributes'];
    const photos = (Array.isArray(row.photos) ? row.photos : []) as ItemView['photos'];
    return {
      item: { id, user_id: user, state: String(row.state), title: String(row.title), quantity: Number(row.quantity), ...(row.product_id ? { product_id: String(row.product_id) } : {}) },
      attributes: attributes.map(a => ({ ...a, confidence: 0, method: a.evidence?.[0]?.extractor_version ?? 'not_visible', at: a.evidence?.[0]?.captured_at ?? String(row.updated_at) })),
      photos: photos.map(p => ({ ...p, file_ref: p.id })),
      listings: runtime.store.rows('listing', { user_id: user, item_id: id }).filter(l => !l.import_preview).map(l => ({ id: l.id, site: String(l.site), state: String(l.state), required_fields: l.required_fields as string[] ?? [] })),
    };
  },
  async write(user, row, expectedVersion) {
    if (row.item.user_id !== user) throw new Error('item tenant mismatch');
    const current = runtime.store.get('item', user, row.item.id);
    if (!current) throw new ApiError('not_found', 'item not found', 'read');
    checkVersion(current, expectedVersion);
    return runtime.store.put('item', { ...current, ...row.item, attributes: row.attributes, photos: row.photos }).version!;
  },
};
export function resetItems(version = view.version) {
  const st = memoryStore();
  seedExamples(st);
  const initial = st.dump();
  initial.rows.item!.find(row => row.id === view.id)!.version = version;
  Object.assign(runtime, createRuntime(memoryStore(initial), deps.log));
}
async function versionOf(ctx: Ctx) { return owned('item', ctx, ctx.params.id).version!; }
type PlanChoicesView = Record<string, unknown> & { item_id: string; choices: (Record<string, unknown> & { plan_choice: PlanChoice; objective: Objective })[] };
const choices = example('items.plan_choices').response as PlanChoicesView;
export const planPorts = { async read(id: string): Promise<PlanChoicesView> { if (id !== choices.item_id) throw new Error('not_found'); return structuredClone(choices); } };
export const handlers: Record<string, Handler> = {
  'GET /v1/items': engine(async ctx => {
    const rows = runtime.store.rows('item', { user_id: ctx.user_id! }).filter(row => readable(row, ctx.user_id!));
    const data = [];
    for (const row of rows) {
      const card = await assembleCard(ctx.user_id!, row.id, ports, ctx.log);
      const tile = selectFields((row.tile as Record<string, unknown> | undefined) ?? row, tileExamples);
      data.push({ ...tile, id: row.id, ...(row.price_cents ? { price_cents: row.price_cents } : {}), title: card.item.title, state: card.item.state, quantity: card.item.quantity, version: row.version });
    }
    const sample = example('items.list').response as { data: { id: string }[]; next_cursor: string | null };
    const exampleOnly = ctx.user_id === EXAMPLE_USER && examplesServed() && rows.every(row => row.data === 'example') && sample.data.every(tile => rows.some(row => row.id === tile.id));
    if (exampleOnly && sample.next_cursor && ctx.query.get('cursor') === sample.next_cursor) {
      const query = new URLSearchParams(ctx.query);
      query.delete('cursor');
      const offset = data.findIndex(row => row.id === sample.data.at(-1)?.id) + 1;
      return { status: 200, body: list({ ...ctx, query }, data.slice(offset)) };
    }
    const body = list(ctx, data);
    if (exampleOnly && !ctx.query.has('cursor') && body.next_cursor === null) body.next_cursor = sample.next_cursor;
    return { status: 200, body };
  }),
  'GET /v1/items/:id': engine(async (ctx) => {
    const row = owned('item', ctx, ctx.params.id);
    const card = await assembleCard(ctx.user_id!, row.id, ports, ctx.log);
    const body = selectFields(row, [view]);
    const limits = runtime.store.get('limits', ctx.user_id!, row.id);
    return { status: 200, body: { ...body, title: card.item.title, state: card.item.state, quantity: card.item.quantity,
      attributes: card.attributes.map(a => selectFields(a, view.attributes)),
      missing_fields: [...new Set(card.listings.flatMap(l => l.missing_fields))],
      photos: card.photos.map(p => { const { file_ref, ...photo } = p; return photo; }),
      listings: runtime.store.rows('listing', { user_id: ctx.user_id!, item_id: row.id }).filter(l => !l.import_preview).map(l => publicRow(l)),
      ...(limits ? { limits: limitsView(limits) } : {}) } };
  }),
  'PATCH /v1/items/:id': engine(ctx => {
    const row = owned('item', ctx, ctx.params.id);
    fields(ctx.body, { version }, { title: text, location: v => object(v) && text(v.label), cost: money, price_cents: money });
    if (ctx.body.quantity !== undefined && !version(ctx.body.quantity)) throw invalid('quantity must be a whole number of at least 1', ['quantity']);
    if (!['title', 'location', 'cost', 'quantity', 'price_cents'].some(k => ctx.body[k] !== undefined)) throw invalid('no item edits');
    checkVersion(row, ctx.body.version);
    const edits = Object.fromEntries(['title', 'location', 'quantity', 'cost', 'price_cents'].filter(key => ctx.body[key] !== undefined).map(key => [key, ctx.body[key]]));
    if (object(edits.cost)) edits.cost = { ...(object(row.cost) ? row.cost : {}), ...edits.cost, source: 'you_said' };
    const price = ctx.body.price_cents as { amount_cents: number; currency: string } | undefined;
    const oldPrice = (row.price_cents ?? (row.tile as Record<string, unknown> | undefined)?.price_cents) as typeof price;
    const changedPrice = price && (price.amount_cents !== oldPrice?.amount_cents || price.currency !== oldPrice?.currency);
    const events: ReturnType<typeof write>[] = [];
    const next = runtime.store.tx(st => {
      const saved = st.put('item', { ...row, ...edits });
      if (changedPrice) for (const listing of st.rows('listing', { user_id: ctx.user_id!, item_id: row.id }).filter(l => l.state === 'live' && !l.import_preview)) {
        const at = new Date().toISOString();
        events.push(write(st, { user_id: ctx.user_id!, source: 'app', action: 'app.reprice', actor: 'user', site: listing.site as 'ebay' | 'depop', account_id: String(listing.account_id), item_id: row.id, listing_id: listing.id, dedupe_key: `edit:${row.id}:${row.version}:${listing.id}`, observed_at: at, effective_at: at, trace_id: ctx.request_id,
          payload: { price_cents: price!.amount_cents, slug: String(listing.url).split('/').filter(Boolean).at(-1), listing: { price_amount: price!.amount_cents / 100 } } }));
      }
      return saved;
    });
    for (const event of events) logReceived(ctx.log, event);
    ctx.log.event('state.change', { entity: 'item', id: row.id, to: 'edited' });
    return { status: 200, body: { id: row.id, ...edits, ...(events.length ? { push_my_edit: { listing_ids: events.map(e => e.job.listing_id), job_id: events[0].job.id } } : {}), version: next.version } };
  }),
  'PATCH /v1/items/:id/attributes/:name': fromEngine(exampleHandler('PATCH /v1/items/:id/attributes/:name', c => { fields(c.body, { version }, { confirmed: bool }); if (c.body.value === undefined && c.body.confirmed !== false) throw invalid('value or confirmed false is required'); }, c => c.body.confirmed === false ? 'items.attribute.unpin' : 'items.attribute.correct', async (ctx, seed) => {
    const row = await ports.read(ctx.user_id!, ctx.params.id);
    if (!row) throw new ApiError('not_found', 'item not found', 'read');
    const current = row.attributes.find(a => a.name === ctx.params.name);
    if (!current) throw new ApiError('not_found', 'attribute not found', 'read');
    const body = seed.body as { evidence?: Attribute['evidence']; id: string; item_version: number };
    const next = ctx.body.confirmed === false ? { ...current, confirmed: false } : mergeAttribute(current, { ...current, value: ctx.body.value, source: 'you_said', confirmed: true, evidence: body.evidence ?? [], method: 'owner' }, 'user');
    row.attributes = row.attributes.map(a => a.name === next.name ? next : a);
    const item_version = await ports.write(ctx.user_id!, row, Number(ctx.body.version));
    ctx.log.event('state.change', { entity: 'attribute', id: body.id, to: next.confirmed ? 'confirmed' : 'unpinned' });
    return { ...seed, body: { ...body, item_version, name: next.name, value: next.value, source: next.source, confirmed: next.confirmed, ...(body.evidence ? { evidence: next.evidence } : {}) } };
  }, versionOf)),
  'POST /v1/items/:id/sell': exampleHandler('POST /v1/items/:id/sell'),
  'POST /v1/items/:id/strategy': engine(ctx => {
    const row = owned('item', ctx, ctx.params.id);
    fields(ctx.body, { version, plan_choice: oneOf('sell', 'fast', 'best', 'reserve', 'check'), floor_cents: money }, { always_accept_cents: money, fallback: oneOf('ask', 'donate', 'keep', 'trade_in', 'relist'), markdown_on: bool, accept_mode: oneOf('auto', 'ask_all'), gone_by: v => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) });
    validateLimits(ctx.body, runtime.store.get('limits', ctx.user_id!, row.id));
    checkVersion(row, ctx.body.version);
    const plan = planOf(ctx.body.plan_choice as PlanChoice);
    const result = runtime.store.tx(st => {
      const limits = itemLimits(ctx, row.id, ctx.body);
      const userLimits = owned('limits', ctx, ctx.user_id!);
      st.put('limits', userLimits);
      const next = st.put('item', { ...row });
      return { limits: limitsView(limits), item_version: next.version };
    });
    ctx.log.event('state.change', { entity: 'limits', id: row.id, to: 'updated' });
    const options = row.strategy_options as Record<string, Record<string, unknown>[]> | undefined;
    const strategies = (options?.[String(ctx.body.plan_choice)] ?? []).map(strategy => strategy.verdict === 'skip' ? strategy : { ...strategy, objective: plan.objective, horizon_days: HORIZON_DAYS[plan.objective], floor_cents: ctx.body.floor_cents, ...(!plan.path ? { price_path: [] } : {}) });
    return { status: 200, body: { strategies, ...result } };
  }),
  'POST /v1/items/:id/listings': exampleHandler('POST /v1/items/:id/listings', c => fields(c.body, { version, sites: siteList }, { dry_run: bool })),
  'GET /v1/items/:id/plan-choices': fromEngine(exampleHandler('GET /v1/items/:id/plan-choices', undefined, undefined, async (ctx, seed) => {
    const body = await planPorts.read(ctx.params.id);
    return { ...seed, body: { ...body, choices: body.choices.map(choice => ({ ...choice, objective: planOf(choice.plan_choice).objective })) } };
  })),
};
export const manifest = manifestFor(handlers);
