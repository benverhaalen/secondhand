// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text, version, strings, money, oneOf, invalid, reference, sites } from './captures.ts';

import { orderBook, type OrderRead } from '../orders/orders.ts';
import { example } from './examples.ts';
type OrderView = Record<string, unknown> & Omit<OrderRead, 'user_id' | 'price_cents' | 'fees_cents' | 'shipping_cents' | 'payout_cents'> & { id: string; created_at: string; price_cents: { amount_cents: number; currency: string }; fees_cents: { amount_cents: number; currency: string } | null; shipping_cents: { amount_cents: number; currency: string }; payout_cents: { amount_cents: number; currency: string } | null };
const initialOrders = (example('orders.list').response as { data: OrderView[] }).data;
const book = orderBook(() => initialOrders[0].created_at);
for (const row of initialOrders) book.apply({ kind: row.kind, site: row.site, external_order_id: row.external_order_id, user_id: 'usr_8f2k', item_id: row.item_id, listing_id: row.listing_id, state: row.state, price_cents: row.price_cents.amount_cents, fees_cents: row.fees_cents?.amount_cents ?? null, shipping_cents: row.shipping_cents.amount_cents, ...(row.payout_cents ? { payout_cents: row.payout_cents.amount_cents } : {}) });
export const ports: Pick<typeof book, 'all'> = { all: book.all };
export const handlers: Record<string, Handler> = {
  'GET /v1/orders': fromEngine(exampleHandler('GET /v1/orders', c => { const kind = c.query.get('kind'); if (kind && !oneOf('sale', 'purchase')(kind)) throw invalid('unknown order kind'); }, undefined, async (ctx, seed) => {
    const rows = ports.all().filter(row => row.user_id === ctx.user_id && (!ctx.query.get('kind') || row.kind === ctx.query.get('kind')));
    const data = rows.map(row => {
      const meta = initialOrders.find(old => old.site === row.site && old.external_order_id === row.external_order_id);
      const money = (amount_cents: number) => ({ amount_cents, currency: meta?.price_cents.currency ?? 'USD' });
      return { ...meta, id: meta?.id ?? row.id, kind: row.kind, item_id: row.item_id, listing_id: row.listing_id, site: row.site, state: row.state,
        price_cents: money(row.price_cents), fees_cents: row.fees_cents === null ? null : money(row.fees_cents), shipping_cents: money(row.shipping_cents), payout_cents: row.payout_cents === undefined ? null : money(row.payout_cents) };
    });
    return { ...seed, body: { data, next_cursor: null } };
  })),
  'POST /v1/orders': exampleHandler('POST /v1/orders', c => { fields(c.body, { kind: oneOf('purchase'), match_id: text, price_cents: money, site: sites }); reference(c.body.match_id, ['mt_77']); }),
  'GET /v1/appointments': exampleHandler('GET /v1/appointments'),
  'POST /v1/orders/:id/handed-over': exampleHandler('POST /v1/orders/:id/handed-over', c => fields(c.body, { version })),
  'POST /v1/orders/:id/ship': exampleHandler('POST /v1/orders/:id/ship', c => fields(c.body, {}, { insure_cents: money })),
  'POST /v1/orders/labels': exampleHandler('POST /v1/orders/labels', c => { fields(c.body, { order_ids: strings, layout: oneOf('letter_2up') }); for (const id of c.body.order_ids as string[]) reference(id, ['ord_2w8', 'ord_m19']); }),
  'GET /v1/orders/pick-list': exampleHandler('GET /v1/orders/pick-list'),
};
export const manifest = manifestFor(handlers);
