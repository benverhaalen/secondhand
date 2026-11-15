// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text } from './captures.ts';

export const handlers: Record<string, Handler> = {
  'GET /v1/conversations': exampleHandler('GET /v1/conversations'),
  'GET /v1/conversations/:id/messages': exampleHandler('GET /v1/conversations/:id/messages'),
  'POST /v1/conversations/:id/messages': exampleHandler('POST /v1/conversations/:id/messages', c => fields(c.body, { text })),
};
export const manifest = manifestFor(handlers);
