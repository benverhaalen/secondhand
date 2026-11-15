// Rests-on: spec/product.md §7 Resources; spec/examples/.
import { ApiError, type Handler } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text, url, invalid, reference } from './captures.ts';

import { searchAll, buyList, type BuyOffer, type BuyRow } from '../buy/buy.ts';
import { example } from './examples.ts';

type OfferView = { site: string; condition: string; seller_kind: string; delivered_cents: { amount_cents: number; currency: string }; delivery_min_days: number; delivery_max_days: number; stock: number; ships_from: string; ships_to: string };
type CompareView = { product_id: string; this: OfferView; others: OfferView[]; verdict: string; citation_id: string };
const initial = example('compare').response as CompareView;
const outUrl = example('out').headers!.Location;
const offers: BuyOffer[] = [initial.this, ...initial.others].map((row, i) => ({ ...row, id: i === 0 ? 'mt_77' : `offer_${i}`, listing_id: i === 0 ? 'mt_77' : `offer_${i}`, title: 'Carhartt Detroit Jacket J97', route_id: 'memory', url: i === 0 ? outUrl : 'https://www.ebay.com/itm/000000000001',
  // The example records a delivered total, with no fee decomposition.
  price_cents: row.delivered_cents.amount_cents, shipping_cents: 0, tax_rate: 0, relation: 'same_product', source_kind: 'marketplace', stock: 'in_stock', ships_to: [row.ships_to], ...(i === 0 ? { referral: { programme: 'example', url: outUrl } } : {}) }));
const fingerprint = (rows: BuyRow[]) => JSON.stringify(rows.map(({ id, site, condition, delivered_cents, stock, delivery_min_days, delivery_max_days, ships_from, ships_to }) => ({ id, site, condition, delivered_cents, stock, delivery_min_days, delivery_max_days, ships_from, ships_to })));
const verdicts = new Map([[JSON.stringify(['mt_77', fingerprint(buyList(searchAll(offers, { medianShipping: 0 })))]), { verdict: initial.verdict, citation_id: initial.citation_id }]]);
export const ports: { read(): Promise<BuyOffer[]>; verdict(rows: BuyRow[], target_id: string): Promise<{ verdict: string; citation_id: string } | undefined>; click(row: { listing_id: string; actor: string; url: string }): Promise<void> } = {
  read: async () => structuredClone(offers),
  verdict: async (rows, target_id) => verdicts.get(JSON.stringify([target_id, fingerprint(rows)])),
  click: async row => { clicks.push(row); },
};
const clicks: { listing_id: string; actor: string; url: string }[] = [];
const project = (row: BuyRow): OfferView => ({ site: row.site, condition: row.condition, seller_kind: row.seller_kind ?? 'unknown', delivered_cents: { amount_cents: row.delivered_cents, currency: 'USD' }, delivery_min_days: row.delivery_min_days!, delivery_max_days: row.delivery_max_days!, stock: row.stock === 'in_stock' ? 1 : 0, ships_from: row.ships_from!, ships_to: row.ships_to?.[0] ?? '' });
export const handlers: Record<string, Handler> = {
  'POST /v1/compare': fromEngine(exampleHandler('POST /v1/compare', c => { fields(c.body, {}, { url, match_id: text }); if (Number(c.body.url !== undefined) + Number(c.body.match_id !== undefined) !== 1) throw invalid('url or match_id is required'); if (c.body.match_id) reference(c.body.match_id, ['mt_77']); }, undefined, async (ctx, seed) => {
    const rows = buyList(searchAll(await ports.read(), { medianShipping: 0 }));
    const target = rows.find(r => ctx.body.match_id ? r.id === ctx.body.match_id : r.url.split('?')[0] === String(ctx.body.url).split('?')[0]);
    if (!target) throw invalid('listing not available');
    const body = seed.body as CompareView;
    const verdict = await ports.verdict(rows, target.id);
    if (!verdict) throw new ApiError('waking', 'comparison verdict needs a fresh basis', 'compare', { by: 'auto', after_s: 2 });
    return { ...seed, body: { ...body, ...verdict, this: project(target), others: rows.filter(r => r.id !== target.id).map(project) } };
  })),
  'GET /v1/out': fromEngine(exampleHandler('GET /v1/out', c => { if (!text(c.query.get('listing'))) throw invalid('listing is required'); reference(c.query.get('listing'), ['mt_77']); }, undefined, async (ctx, seed) => {
    const row = searchAll(await ports.read(), { medianShipping: 0 }).find(r => r.id === ctx.query.get('listing'));
    if (!row) throw invalid('listing not available');
    const url = row.referral?.url ?? row.url;
    await ports.click({ listing_id: row.id, actor: ctx.user_id ?? ctx.visitor_id!, url });
    ctx.log.event('state.change', { entity: 'referral_click', id: row.id, to: 'recorded' });
    return { ...seed, headers: { Location: url } };
  })),
};
export const manifest = manifestFor(handlers);
