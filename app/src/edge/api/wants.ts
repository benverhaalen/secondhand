// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text, version, money, oneOf, object, invalid, sites, siteList } from './captures.ts';

export const handlers: Record<string, Handler> = {
  'POST /v1/wants': exampleHandler('POST /v1/wants', c => fields(c.body, { text, max_total_cents: money, sites: siteList, alert: oneOf('available', 'under') }, { fit: object })),
  'GET /v1/wants': exampleHandler('GET /v1/wants'),
  'GET /v1/wants/:id': exampleHandler('GET /v1/wants/:id'),
  'PATCH /v1/wants/:id': exampleHandler('PATCH /v1/wants/:id', c => { fields(c.body, { version }, { state: oneOf('active', 'paused', 'ended'), text, fit: object, max_total_cents: money, sites: siteList, schedule: object, alert: oneOf('available', 'under') }); if (Object.keys(c.body).filter(k => k !== 'version').length === 0) throw invalid('no want edits'); }),
  'GET /v1/wants/:id/matches': exampleHandler('GET /v1/wants/:id/matches'),
  'POST /v1/matches/:id/act': exampleHandler('POST /v1/matches/:id/act', c => fields(c.body, { action: oneOf('dismiss', 'save', 'not_same', 'bought') })),
};
export const manifest = manifestFor(handlers);
