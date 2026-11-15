// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text, oneOf, url, invalid, reference } from './captures.ts';

export const handlers: Record<string, Handler> = {
  'POST /v1/valuations': exampleHandler('POST /v1/valuations', c => { fields(c.body, {}, { item_id: text, capture_id: text, url, purpose: oneOf('sell', 'appraise', 'find') }); if (['item_id', 'capture_id', 'url'].filter(k => c.body[k] !== undefined).length !== 1) throw invalid('one of item_id, capture_id or url is required'); if (c.body.item_id) reference(c.body.item_id, ['it_7c2m']); if (c.body.capture_id) reference(c.body.capture_id, ['cap_3n9q']); }, c => c.body.url ? 'valuations.appraise_url' : 'valuations.create'),
};
export const manifest = manifestFor(handlers);
