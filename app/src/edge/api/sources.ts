// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, invalid, sites } from './captures.ts';
import { ApiError } from './http.ts';
export const handlers: Record<string, Handler> = {
  'GET /v1/sources/health': exampleHandler('GET /v1/sources/health', c => { const site = c.query.get('site'), need = c.query.get('need'); if (site && !sites(site)) throw invalid('unknown site'); if (site && site !== 'ebay' || need && need !== 'sold') throw new ApiError('not_found', 'no example health for this route', 'read'); }),
};
export const manifest = manifestFor(handlers);
