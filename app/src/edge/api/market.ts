// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text, bool, version, oneOf, object, invalid, reference } from './captures.ts';

export const handlers: Record<string, Handler> = {
  'GET /v1/products/:id': exampleHandler('GET /v1/products/:id'),
  'GET /v1/products/:id/history': exampleHandler('GET /v1/products/:id/history', c => { const range = c.query.get('range'); if (range && !/^\d+d$/.test(range)) throw invalid('range must be days'); }),
  'GET /v1/trends': exampleHandler('GET /v1/trends', c => { const window = c.query.get('window'); if (window && !oneOf('7d', '30d')(window)) throw invalid('unknown window'); }),
  'GET /v1/index/:id': exampleHandler('GET /v1/index/:id'),
  'POST /v1/follows': exampleHandler('POST /v1/follows', c => { fields(c.body, { target: v => object(v) && text(v.product_id), channel: oneOf('push', 'email', 'in_app') }); reference((c.body.target as Record<string, unknown>).product_id, ['pr_4hd1']); }),
  'GET /v1/follows': exampleHandler('GET /v1/follows'),
  'PATCH /v1/follows/:id': exampleHandler('PATCH /v1/follows/:id', c => fields(c.body, { version, muted: bool })),
  'DELETE /v1/follows/:id': exampleHandler('DELETE /v1/follows/:id'),
};
export const manifest = manifestFor(handlers);
