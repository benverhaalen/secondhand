// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, oneOf, invalid, reference } from './captures.ts';

export const handlers: Record<string, Handler> = {
  'GET /v1/records': exampleHandler('GET /v1/records', c => { if (!/^\d{4}$/.test(c.query.get('tax_year') ?? '')) throw invalid('tax_year must be a year'); if (!oneOf('csv', 'pdf')(c.query.get('format'))) throw invalid('format must be csv or pdf'); reference(c.query.get('tax_year'), ['2026']); }, c => c.query.get('format') === 'pdf' ? 'records.pdf' : 'records.csv'),
};
export const manifest = manifestFor(handlers);
