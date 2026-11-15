// Rests-on: spec/product.md §7 Resources; spec/examples/.
import { ApiError, type Handler } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, integer, money, invalid } from './captures.ts';

import { insights, type AnalyticsPort, type AnalyticsData } from '../insights/insights.ts';
import { example, examplesServed } from './examples.ts';

type InsightsView = Record<string, unknown> & { by_site: { site: string; sold: number; earned_cents: { amount_cents: number; currency: string } }[]; funnel: { stage: string; count: number }[] };
const initial = example('insights.get').response as InsightsView;
const as_of = '2026-11-15T00:00:00Z';
// Synthetic aggregate snapshot from the contract, not individual sales or per-site funnel observations.
const snapshot: AnalyticsData = { snapshot: { id: 'ci_in1', source: 'spec/examples/you.json', at: as_of },
  listings: [{ id: 'ls_insights', item_id: 'it_insights', site: 'aggregate' }], sales: [],
  stats: [{ id: 'stat_insights', listing_id: 'ls_insights', day: '2026-11-15', stages: Object.fromEntries(initial.funnel.map(f => [f.stage, f.count])), definitions: Object.fromEntries(initial.funnel.map(f => [f.stage, `contract.${f.stage}`])), source: 'spec/examples/you.json', at: as_of }] };
export const ports: AnalyticsPort = { async read(user) { if (user !== 'usr_8f2k') throw new Error('not_found'); return structuredClone(snapshot); } };

const insightsExample = exampleHandler('GET /v1/insights', c => { const window = c.query.get('window'); if (window && !/^\d+d$/.test(window)) throw invalid('window must be days'); }, undefined, async (ctx, seed) => {
    const result = await insights(ctx.user_id!, ports, as_of, ctx.log);
    const body = seed.body as InsightsView;
    const funnel = body.funnel.map(row => {
      const stages = result.funnel.map(f => f.stages[row.stage]);
      if (stages.some(s => !s || s.state !== 'shown' || typeof s.value !== 'number')) throw new Error(`insights ${row.stage}: source gap`);
      return { stage: row.stage, count: stages.reduce((n, s) => n + Number(s.value), 0) };
    });
    return { ...seed, body: { ...body, funnel } };
  });

export const handlers: Record<string, Handler> = {
  'GET /v1/insights': fromEngine((ctx, req) => {
    if (ctx.user_id !== 'usr_8f2k' || !examplesServed()) throw new ApiError('unavailable', 'Insights are not available yet', 'read');
    return insightsExample(ctx, req);
  }),
  'PUT /v1/goals/:month': exampleHandler('PUT /v1/goals/:month', c => fields(c.body, { target_cents: money, target_sales: integer })),
};
export const manifest = manifestFor(handlers);
