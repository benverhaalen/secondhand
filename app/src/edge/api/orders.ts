// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text, version, strings, money, oneOf, invalid, reference, sites } from './captures.ts';

import { runtime, engine, list, publicRow, readable } from './runtime.ts';
import type { OrderRow } from '../orders/orders.ts';
import type { Row } from '../events/ports.ts';
export const ports = { all: (user_id = '') => runtime.store.rows<Row & OrderRow>('order', { user_id }) };
export const handlers: Record<string, Handler> = {
  'GET /v1/orders': engine(ctx => {
    const kind = ctx.query.get('kind');
    if (kind && !oneOf('sale', 'purchase')(kind)) throw invalid('unknown order kind');
    const rows = ports.all(ctx.user_id!).filter(row => readable(row, ctx.user_id!));
    const orders = rows.filter(row => !kind || row.kind === kind);
    const data = orders.map(row => {
      const body: Record<string, unknown> = { ...publicRow(row, true), item_id: row.item_id };
      delete body.history;
      delete body.payout_recorded_at;
      for (const key of ['price_cents', 'fees_cents', 'shipping_cents', 'payout_cents']) {
        const value = row[key];
        body[key] = typeof value === 'number' ? { amount_cents: value, currency: typeof row.currency === 'string' ? row.currency : 'USD' } : value ?? null;
      }
      return body;
    });
    return { status: 200, body: list(ctx, data) };
  }),
  'POST /v1/orders': exampleHandler('POST /v1/orders', c => { fields(c.body, { kind: oneOf('purchase'), match_id: text, price_cents: money, site: sites }); reference(c.body.match_id, ['mt_77']); }),
  'GET /v1/appointments': exampleHandler('GET /v1/appointments'),
  'POST /v1/orders/:id/handed-over': exampleHandler('POST /v1/orders/:id/handed-over', c => fields(c.body, { version })),
  'POST /v1/orders/:id/ship': exampleHandler('POST /v1/orders/:id/ship', c => fields(c.body, {}, { insure_cents: money })),
  'POST /v1/orders/labels': exampleHandler('POST /v1/orders/labels', c => { fields(c.body, { order_ids: strings, layout: oneOf('letter_2up') }); for (const id of c.body.order_ids as string[]) reference(id, ['ord_2w8', 'ord_m19']); }),
  'GET /v1/orders/pick-list': exampleHandler('GET /v1/orders/pick-list'),
};
export const manifest = manifestFor(handlers);
