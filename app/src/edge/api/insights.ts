// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, integer, money, invalid } from './captures.ts';

export const handlers: Record<string, Handler> = {
  'GET /v1/insights': exampleHandler('GET /v1/insights', c => { const window = c.query.get('window'); if (window && !/^\d+d$/.test(window)) throw invalid('window must be days'); }),
  'PUT /v1/goals/:month': exampleHandler('PUT /v1/goals/:month', c => fields(c.body, { target_cents: money, target_sales: integer })),
};
export const manifest = manifestFor(handlers);
