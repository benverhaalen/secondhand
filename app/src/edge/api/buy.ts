// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text, url, invalid, reference } from './captures.ts';

export const handlers: Record<string, Handler> = {
  'POST /v1/compare': exampleHandler('POST /v1/compare', c => { fields(c.body, {}, { url, match_id: text }); if (Number(c.body.url !== undefined) + Number(c.body.match_id !== undefined) !== 1) throw invalid('url or match_id is required'); if (c.body.match_id) reference(c.body.match_id, ['mt_77']); }),
  'GET /v1/out': exampleHandler('GET /v1/out', c => { if (!text(c.query.get('listing'))) throw invalid('listing is required'); reference(c.query.get('listing'), ['mt_77']); }),
};
export const manifest = manifestFor(handlers);
