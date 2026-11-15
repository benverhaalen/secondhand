// Rests-on: spec/product.md §7 Resources; spec/examples/.
import { ApiError, type Handler } from './http.ts';
import { ports as geniePorts, citationOwners } from './genie.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text, bool, oneOf, invalid, reference, sites } from './captures.ts';

import { successScore, type ScoreInput } from '../../engines/score/score.ts';
import { memoryStore } from '../../engines/param/param.ts';
import { example } from './examples.ts';
const params = memoryStore();
// Prior from spec/features/score.md, success score bands; reads stay in the shared registry.
params.declare({ name: 'score_bands', family: 'model_ref', prior: { cuts: [35, 60, 85] } });
type ScoreRow = ScoreInput['axes'][number] & { id: string; subject_type: string; subject_id: string; site: string; range: unknown; hide_reason?: string; model_version: string | null };
const initial = (example('scores.list').response as { data: ScoreRow[] }).data;
export const ports: { read(user: string, subject: string): Promise<Omit<ScoreInput, 'log'>> } = { async read(user, subject) {
  if (user !== 'usr_8f2k' || subject !== 'ls_e81') throw new Error('not_found');
  return { listing_id: subject, site: 'ebay', as_of: '2026-11-15T00:00:00Z', floor_cents: 7000, objective: 'balanced', plan_choice: 'sell',
    now: { expected_keep_cents: 0, expected_days: 0, holding_cost_cents: 0 }, best: { expected_keep_cents: 0, expected_days: 0, holding_cost_cents: 0 },
    axes: structuredClone(initial), basis: [], params };
} };
const exampleCitation = exampleHandler('GET /v1/citations/:id');
const citation: Handler = (ctx, req) => {
  const found = geniePorts.proof.citation(ctx.params.id);
  if (!found) return exampleCitation(ctx, req);
  if (citationOwners.get(found.id) !== ctx.user_id) throw new ApiError('not_found', 'no citation for this user', 'read');
  const { definition_version, ...rest } = found;
  return { status: 200, body: { ...rest, definition_version: Number(definition_version), basis_count: found.basis_ids.length } };
};

export const handlers: Record<string, Handler> = {
  'GET /v1/scores': fromEngine(exampleHandler('GET /v1/scores', c => { if (!oneOf('listing', 'item', 'product', 'match')(c.query.get('subject_type')) || !text(c.query.get('subject_id'))) throw invalid('subject_type and subject_id are required'); reference(c.query.get('subject_id'), ['ls_e81']); }, undefined, async (ctx, seed) => {
    const result = successScore({ ...await ports.read(ctx.user_id!, ctx.query.get('subject_id')!), log: { timed: (name, fn) => ctx.log.timed(name, fn) } });
    if (result.citation) { geniePorts.proof.cite(result.citation); citationOwners.set(result.citation.id, ctx.user_id!); }
    const data = (seed.body as { data: ScoreRow[] }).data;
    const axes = result.parts.axes.map(axis => {
      const old = data.find(row => row.axis === axis.axis);
      const same = old?.value === axis.value && old?.state === axis.state;
      const { hide_reason, ...meta } = old ?? { id: `sc_${axis.axis}_${result.subject_id}`, subject_type: result.subject_type, subject_id: result.subject_id, site: result.site, range: null, model_version: null, hide_reason: undefined };
      return { ...meta, ...axis, range: same ? meta.range : null, ...(axis.state === 'hidden' ? { hide_reason: same ? hide_reason : 'source_gap' } : {}) };
    });
    return { ...seed, body: { data: [...axes, { id: `sc_success_${result.subject_id}`, subject_type: result.subject_type, subject_id: result.subject_id, site: result.site, axis: result.axis, value: result.value, range: null, citation_id: result.citation_id, state: result.state, ...(result.hide_reason ? { hide_reason: result.hide_reason } : {}), model_version: result.model_version }] } };
  })),
  'GET /v1/scores/:id/basis': exampleHandler('GET /v1/scores/:id/basis'),
  'GET /v1/sites/:site/ranker': exampleHandler('GET /v1/sites/:site/ranker'),
  'GET /v1/citations/:id': citation,
  'GET /v1/experiments': exampleHandler('GET /v1/experiments'),
  'POST /v1/experiments/consent': exampleHandler('POST /v1/experiments/consent', c => fields(c.body, { on: bool })),
};
export const manifest = manifestFor(handlers);
