// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, bool, strings, oneOf, invalid, sites } from './captures.ts';

export const handlers: Record<string, Handler> = {
  'POST /v1/accounts': exampleHandler('POST /v1/accounts', c => { fields(c.body, { site: sites }); if (!oneOf('ebay', 'depop')(c.body.site)) throw invalid('no connection example for this site'); }, c => c.body.site === 'depop' ? 'accounts.connect.depop' : 'accounts.connect.ebay'),
  'GET /v1/accounts': exampleHandler('GET /v1/accounts'),
  'POST /v1/accounts/:id/import': exampleHandler('POST /v1/accounts/:id/import', c => fields(c.body, { listings: bool, purchases: bool }, { external_ids: strings })),
  'GET /v1/accounts/:id/import-preview': exampleHandler('GET /v1/accounts/:id/import-preview'),
  'DELETE /v1/accounts/:id': exampleHandler('DELETE /v1/accounts/:id'),
};
export const manifest = manifestFor(handlers);
