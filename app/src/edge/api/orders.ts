// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text, version, strings, money, oneOf, invalid, reference, sites } from './captures.ts';

export const handlers: Record<string, Handler> = {
  'GET /v1/orders': exampleHandler('GET /v1/orders', c => { const kind = c.query.get('kind'); if (kind && !oneOf('sale', 'purchase')(kind)) throw invalid('unknown order kind'); }),
  'POST /v1/orders': exampleHandler('POST /v1/orders', c => { fields(c.body, { kind: oneOf('purchase'), match_id: text, price_cents: money, site: sites }); reference(c.body.match_id, ['mt_77']); }),
  'GET /v1/appointments': exampleHandler('GET /v1/appointments'),
  'POST /v1/orders/:id/handed-over': exampleHandler('POST /v1/orders/:id/handed-over', c => fields(c.body, { version })),
  'POST /v1/orders/:id/ship': exampleHandler('POST /v1/orders/:id/ship', c => fields(c.body, {}, { insure_cents: money })),
  'POST /v1/orders/labels': exampleHandler('POST /v1/orders/labels', c => { fields(c.body, { order_ids: strings, layout: oneOf('letter_2up') }); for (const id of c.body.order_ids as string[]) reference(id, ['ord_2w8', 'ord_m19']); }),
  'GET /v1/orders/pick-list': exampleHandler('GET /v1/orders/pick-list'),
};
export const manifest = manifestFor(handlers);
