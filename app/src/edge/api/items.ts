// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Ctx, Handler } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text, bool, version, money, oneOf, object, invalid, sites, siteList } from './captures.ts';
import { ApiError } from './http.ts';
import { assembleCard, mergeAttribute, type CardPort, type CardRecord, type Attribute } from '../card/card.ts';
import { planOf, type PlanChoice, type Objective } from '../../engines/valuation/path.ts';
import { example } from './examples.ts';

type ItemView = Record<string, unknown> & { id: string; title: string; state: string; quantity: number; product_id?: string; updated_at: string; version: number; attributes: (Omit<Attribute, 'confidence' | 'method' | 'at'> & { id: string })[]; photos: (CardRecord['photos'][number] & Record<string, unknown>)[]; listings: (CardRecord['listings'][number] & Record<string, unknown>)[] };
const view = example('items.get').response as ItemView;
const rows = new Map<string, CardRecord>();
rows.set(view.id, {
  item: { id: view.id, user_id: 'usr_8f2k', state: view.state, title: view.title, quantity: view.quantity, product_id: view.product_id },
  attributes: view.attributes.map(a => ({ ...a, confidence: 0, method: a.evidence[0]?.extractor_version ?? 'not_visible', at: a.evidence[0]?.captured_at ?? view.updated_at })),
  photos: view.photos.map(p => ({ ...p, file_ref: p.id })),
  listings: view.listings.map(l => ({ ...l, required_fields: ['chest_width'] })),
});
const tiles = (example('items.list').response as { data: ItemView[] }).data;
for (const tile of tiles) if (!rows.has(tile.id)) rows.set(tile.id, { item: { id: tile.id, user_id: 'usr_8f2k', state: tile.state, title: tile.title, quantity: tile.quantity }, attributes: [], photos: [], listings: [] });
export const ports: CardPort & { write(user: string, row: CardRecord, expectedVersion: number): Promise<number> } = { async read(user, id) { const row = rows.get(id); return row?.item.user_id === user ? structuredClone(row) : undefined; }, async write(user, row, expectedVersion) { if (row.item.user_id !== user) throw new Error('item tenant mismatch'); const current = itemVersions.get(row.item.id); if (current !== expectedVersion) throw new ApiError('stale', 'item changed', 'version_check', { by: 'user' }, { current: { version: current } }); rows.set(row.item.id, structuredClone(row)); const next = current + 1; itemVersions.set(row.item.id, next); return next; } };

const initialRows = structuredClone([...rows.entries()]);
const itemVersions = new Map([[view.id, view.version]]);
export function resetItems(version = view.version) { rows.clear(); for (const [id, row] of structuredClone(initialRows)) rows.set(id, row); itemVersions.set(view.id, version); }
async function versionOf(ctx: Ctx) { const row = await ports.read(ctx.user_id!, ctx.params.id); if (!row) throw new ApiError('not_found', 'item not found', 'read'); return itemVersions.get(ctx.params.id) ?? view.version; }
type PlanChoicesView = Record<string, unknown> & { item_id: string; choices: (Record<string, unknown> & { plan_choice: PlanChoice; objective: Objective })[] };
const choices = example('items.plan_choices').response as PlanChoicesView;
export const planPorts = { async read(id: string): Promise<PlanChoicesView> { if (id !== choices.item_id) throw new Error('not_found'); return structuredClone(choices); } };
export const handlers: Record<string, Handler> = {
  'GET /v1/items': fromEngine(exampleHandler('GET /v1/items', undefined, undefined, async (ctx, seed) => {
    const body = seed.body as { data: ItemView[]; next_cursor: string | null };
    const data = [];
    for (const tile of body.data) {
      const card = await assembleCard(ctx.user_id!, tile.id, ports, ctx.log);
      data.push({ ...tile, title: card.item.title, state: card.item.state, quantity: card.item.quantity });
    }
    return { ...seed, body: { ...body, data } };
  })),
  'GET /v1/items/:id': fromEngine(exampleHandler('GET /v1/items/:id', undefined, undefined, async (ctx, seed) => {
    const card = await assembleCard(ctx.user_id!, ctx.params.id, ports, ctx.log);
    const body = seed.body as ItemView;
    return { ...seed, body: { ...body, title: card.item.title, state: card.item.state, quantity: card.item.quantity, version: await versionOf(ctx),
      attributes: card.attributes.map(a => { const meta = body.attributes.find(old => old.name === a.name); if (!meta) throw new Error('attribute projection missing'); return { ...meta, value: a.value, source: a.source, confirmed: a.confirmed, evidence: a.evidence }; }),
      missing_fields: [...new Set(card.listings.flatMap(l => l.missing_fields))],
      photos: card.photos.map(p => body.photos.find(old => old.id === p.id)), listings: card.listings.map(l => body.listings.find(old => old.id === l.id)) } };
  })),
  'PATCH /v1/items/:id': exampleHandler('PATCH /v1/items/:id', c => { fields(c.body, { version }, { title: text, location: v => object(v) && text(v.label), cost: money }); if (c.body.quantity !== undefined && !version(c.body.quantity)) throw invalid('quantity must be a whole number of at least 1', ['quantity']); if (!['title', 'location', 'cost', 'quantity'].some(k => c.body[k] !== undefined)) throw invalid('no item edits'); }),
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
  'POST /v1/items/:id/strategy': exampleHandler('POST /v1/items/:id/strategy', c => { fields(c.body, { version, plan_choice: oneOf('sell', 'fast', 'best', 'reserve', 'check'), floor_cents: money }, { always_accept_cents: money, fallback: oneOf('ask', 'donate', 'keep', 'trade_in', 'relist'), markdown_on: bool, accept_mode: oneOf('auto', 'ask_all'), gone_by: v => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) }); const floor = c.body.floor_cents as { amount_cents: number }, accept = c.body.always_accept_cents as { amount_cents: number } | undefined; if (accept && accept.amount_cents < floor.amount_cents) throw new ApiError('outside_limits', 'always_accept below floor', 'policy_check', { by: 'user' }); }),
  'POST /v1/items/:id/listings': exampleHandler('POST /v1/items/:id/listings', c => fields(c.body, { version, sites: siteList }, { dry_run: bool })),
  'GET /v1/items/:id/plan-choices': fromEngine(exampleHandler('GET /v1/items/:id/plan-choices', undefined, undefined, async (ctx, seed) => {
    const body = await planPorts.read(ctx.params.id);
    return { ...seed, body: { ...body, choices: body.choices.map(choice => ({ ...choice, objective: planOf(choice.plan_choice).objective })) } };
  })),
};
export const manifest = manifestFor(handlers);
