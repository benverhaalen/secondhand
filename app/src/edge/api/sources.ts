// Rests-on: spec/product.md §7 Resources; spec/plans/finalization.md SR8, SR11, SR12.
import type { Handler } from './http.ts';
import { manifestFor, fromEngine, invalid, pagination } from './captures.ts';
import { readLedger } from '../harness/read-ledger.ts';
import { SITES } from '../harness/protocol.ts';
import type { Site } from '../harness/protocol.ts';
import { SOURCES, sourcesFor, routeId, type SourceSite } from '../intel/public/sources.ts';
import { sourceComposed } from '../intel/public/search.ts';

const ledgerSite = (site: SourceSite): site is Site => SITES.some(value => value === site);

export const handlers: Record<string, Handler> = {
  'GET /v1/sources/health': fromEngine(ctx => {
    pagination(ctx);
    ctx.log.input('api', 'GET /v1/sources/health', { query_fields: [...ctx.query.keys()] });
    const site = ctx.query.get('site');
    if (site !== null && !SOURCES.some(source => source.site === site)) throw invalid('unknown site');
    const routes = sourcesFor('person').filter(source => site === null || source.site === site).map(source => {
      const route_id = routeId(source);
      const pause = ledgerSite(source.site) ? readLedger.paused(source.site) : undefined;
      return {
        source_id: source.id, route_id, site: source.site, group: source.group, lane: source.lane,
        // public_page and mcp sources need no composed port, so they read true.
        composed: sourceComposed(source),
        paused_until: pause ? new Date(pause.until_ms).toISOString() : null,
      };
    });
    const reads = readLedger.counts().filter(row => site === null || row.site === site).map(row => {
      const pause = readLedger.paused(row.site);
      return { ...row, paused_until: pause ? new Date(pause.until_ms).toISOString() : null };
    });
    return { status: 200, body: { routes, reads } };
  }),
};
export const manifest = manifestFor(handlers);
