// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, invalid, sites } from './captures.ts';
import { ApiError } from './http.ts';
import { createRouter, ROUTE_PARAMS } from '../harness/health.ts';
import { memoryStore } from '../../engines/param/param.ts';
import { example } from './examples.ts';
import { readLedger } from '../harness/read-ledger.ts';
type HealthRow = { route_id: string; site: 'ebay'; need: string; success: number; checked_at: string };
const initial = (example('sources.health').response as { routes: HealthRow[] }).routes;
const params = memoryStore();
const router = createRouter({ store: params, now: Date.now });
for (const route of initial) {
  const scope = { site: route.site, segment: `search.${route.route_id}` };
  const row = params.propose({ name: ROUTE_PARAMS.success, scope, family: 'beta', value_or_hyperparams: { alpha: route.success * 100, beta: (1 - route.success) * 100 }, prior: { alpha: 9, beta: 1 }, fitted_on_ids_hash: null, n_eff: 0, metric: null, held_out_score: 0, guard_lo: null, guard_hi: null }, 0);
  params.promote(ROUTE_PARAMS.success, scope, row.version, 0, route.checked_at);
}
export const ports: Pick<typeof router, 'health'> = { health: router.health };
export const handlers: Record<string, Handler> = {
  'GET /v1/sources/health': fromEngine(exampleHandler('GET /v1/sources/health', c => { const site = c.query.get('site'), need = c.query.get('need'); if (site && !sites(site)) throw invalid('unknown site'); if (site && site !== 'ebay' || need && need !== 'sold') throw new ApiError('not_found', 'no example health for this route', 'read'); }, undefined, async (ctx, seed) => {
    const body = seed.body as { routes: HealthRow[] };
    const routes = body.routes.map(row => ({ ...row, success: ports.health(row.site, 'search', row.route_id).success }));
    const reads = readLedger.counts().map(row => {
      const pause = readLedger.paused(row.site);
      return { ...row, paused_until: pause ? new Date(pause.until_ms).toISOString() : null };
    });
    return { ...seed, body: { routes, reads } };
  })),
};
export const manifest = manifestFor(handlers);
