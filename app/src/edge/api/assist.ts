// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text, oneOf, reference } from './captures.ts';

import { assist, type AssistOpts } from '../assist/assist.ts';
import { emptyFound } from '../intel/answer.ts';
import { jobs, type ApiJobRow } from './jobs.ts';

export const ports: Pick<AssistOpts, 'intel' | 'llm'> = {
  intel: { async ask(q) { return { id: 'rq_assist', kind: q.kind ?? 'general', slots: {}, protocol_version: 1, facts: [], found: emptyFound(), searched: [{ route_id: 'memory', query: q.text ?? '', outcome: 'empty', ms: 0 }], stage: 'settled', ms: { first: 0, settled: 0 } }; } },
  llm: async () => { throw new Error('no stored writer answer'); },
};
export const handlers: Record<string, Handler> = {
  'POST /v1/assist': fromEngine(exampleHandler('POST /v1/assist', c => { fields(c.body, { surface: oneOf('buy', 'sell', 'capture', 'market', 'item', 'want'), text }, { item_id: text, want_id: text, capture_id: text, context_ref: text }); if (c.body.item_id) reference(c.body.item_id, ['it_7c2m']); if (c.body.want_id) reference(c.body.want_id, ['want_3ss']); if (c.body.capture_id) reference(c.body.capture_id, ['cap_3n9q']); }, undefined, async (ctx, seed) => {
    const result = await assist({ ...ports, text: String(ctx.body.text) });
    const body = seed.body as { id: string; kind: 'assist'; state: 'running'; stages: ApiJobRow['stages'] };
    const job = jobs.start(body, ctx.user_id!);
    jobs.finish(job.id, result);
    ctx.log.event('state.change', { entity: 'job', id: job.id, to: 'done' });
    return { ...seed, body: { ...body, id: job.id } };
  })),
};
export const manifest = manifestFor(handlers);
