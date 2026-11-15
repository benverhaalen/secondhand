// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text, bool, strings, money, object, url, invalid } from './captures.ts';

export const handlers: Record<string, Handler> = {
  'POST /v1/search': exampleHandler('POST /v1/search', c => { fields(c.body, {}, { text, photo_id: text, url, filters: object, like: text, assist_job_id: text, answers: v => Array.isArray(v) && v.every(a => object(a) && text(a.span_id) && text(a.option_id) && text(a.signature)) }); if (!['text', 'photo_id', 'url', 'like', 'assist_job_id'].some(k => c.body[k] !== undefined)) throw invalid('a search input is required'); if (object(c.body.filters)) fields(c.body.filters, {}, { condition: strings, seller_kind: strings, ships_to: text, ships_from: text, max_delivered_cents: money, in_stock_only: bool }); }),
};
export const manifest = manifestFor(handlers);
