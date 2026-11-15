// Rests-on: spec/product.md §7 Resources; spec/examples/.
import { ApiError, type Handler } from './http.ts';
import { exampleHandler as contractExample, manifestFor, oneOf, invalid, reference } from './captures.ts';

import { examplesServed } from './examples.ts';

function exampleHandler(...args: Parameters<typeof contractExample>): Handler {
  const handler = contractExample(...args);
  return (ctx, req) => {
    if (ctx.user_id !== 'usr_8f2k' || !examplesServed()) throw new ApiError('unavailable', 'Records are not available yet', 'read');
    return handler(ctx, req);
  };
}

export const handlers: Record<string, Handler> = {
  'GET /v1/records': exampleHandler('GET /v1/records', c => { if (!/^\d{4}$/.test(c.query.get('tax_year') ?? '')) throw invalid('tax_year must be a year'); if (!oneOf('csv', 'pdf')(c.query.get('format'))) throw invalid('format must be csv or pdf'); reference(c.query.get('tax_year'), ['2026']); }, c => c.query.get('format') === 'pdf' ? 'records.pdf' : 'records.csv'),
};
export const manifest = manifestFor(handlers);
