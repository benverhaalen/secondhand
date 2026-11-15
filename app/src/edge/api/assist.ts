// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text, oneOf, reference } from './captures.ts';

export const handlers: Record<string, Handler> = {
  'POST /v1/assist': exampleHandler('POST /v1/assist', c => { fields(c.body, { surface: oneOf('buy', 'sell', 'capture', 'market', 'item', 'want'), text }, { item_id: text, want_id: text, capture_id: text, context_ref: text }); if (c.body.item_id) reference(c.body.item_id, ['it_7c2m']); if (c.body.want_id) reference(c.body.want_id, ['want_3ss']); if (c.body.capture_id) reference(c.body.capture_id, ['cap_3n9q']); }),
};
export const manifest = manifestFor(handlers);
