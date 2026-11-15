// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text, oneOf, url, invalid, reference } from './captures.ts';

import { check, type CheckInput } from '../../engines/valuation/check.ts';
import { soldSources, type Call } from '../../engines/valuation/sold.ts';
import { example } from './examples.ts';
import { jobs, type ApiJobRow } from './jobs.ts';
import type { Ctx } from './http.ts';

export const ports: { read(ctx: Ctx): Promise<Omit<CheckInput, 'log'> | null> } = {
  async read(ctx) {
    if (ctx.body.url) return null;
    const item = example('items.get').response as { product_id: string; title: string; valuation: { range: { low: { amount_cents: number }; high: { amount_cents: number }; basis_count: number; as_of: string; citation_id: string } } };
    const range = item.valuation.range;
    // Live sold comps from the harness's public sold searches (spec/plans/backtest/how-we-price.md §3). A site the
    // runtime harness has no route for answers no_route and adds nothing, so offline this prices from the family band.
    const { runtime } = await import('./runtime.ts');
    const call: Call = (site, verb, args) => runtime.harness.call(site, verb, args);
    const sources = soldSources(call, ['mercari', 'poshmark'], { query: item.title.split(',')[0], condition: 'good', error: (where, e) => ctx.log.error(where, e) });
    return { product_id: item.product_id, condition: 'good', as_of: range.as_of,
      floor_cents: 0, objective: 'balanced', param_version: 1, warm_comps: [], sources, sites: [],
      fast: { low: range.low.amount_cents, high: range.high.amount_cents, n: range.basis_count, as_of: range.as_of, basis: 'family', state: 'rough' } };
  },
};
export const handlers: Record<string, Handler> = {
  'POST /v1/valuations': fromEngine(exampleHandler('POST /v1/valuations', c => { fields(c.body, {}, { item_id: text, capture_id: text, url, purpose: oneOf('sell', 'appraise', 'find') }); if (['item_id', 'capture_id', 'url'].filter(k => c.body[k] !== undefined).length !== 1) throw invalid('one of item_id, capture_id or url is required'); if (c.body.item_id) reference(c.body.item_id, ['it_7c2m']); if (c.body.capture_id) reference(c.body.capture_id, ['cap_3n9q']); }, c => c.body.url ? 'valuations.appraise_url' : 'valuations.create', async (ctx, seed) => {
    const input = await ports.read(ctx);
    const body = seed.body as { id: string; kind: 'valuate'; state: 'running' | 'queued'; stages: ApiJobRow['stages']; item_id?: string };
    const job = jobs.start({ ...body, args: { ...ctx.body } }, ctx.user_id!);
    if (input) {
      try {
        const result = await check({ ...input, log: { timed: (name, fn) => ctx.log.timed(name, fn), error: (where, error) => ctx.log.error(where, error) } });
        jobs.finish(job.id, result);
      } catch (error) {
        jobs.update(job.id, { state: 'failed', error: { code: 'site_failed', message: error instanceof Error ? error.message : 'valuation failed' } });
        jobs.append(job.id, 'job.state', { job_id: job.id, state: 'failed' });
        ctx.log.event('state.change', { entity: 'job', id: job.id, to: 'failed' });
        throw error;
      }
    }
    ctx.log.event('state.change', { entity: 'job', id: job.id, to: input ? 'done' : 'queued' });
    return { ...seed, body: { ...body, id: job.id } };
  })),
};
export const manifest = manifestFor(handlers);
