// Rests-on: spec/product.md §7 Resources; spec/examples/.
import { ApiError, type Handler } from './http.ts';
import { ports as geniePorts, citationOwners } from './genie.ts';
import { exampleHandler, manifestFor, fields, text, bool, oneOf, invalid, reference, sites } from './captures.ts';

const exampleCitation = exampleHandler('GET /v1/citations/:id');
const citation: Handler = (ctx, req) => {
  const found = geniePorts.proof.citation(ctx.params.id);
  if (!found) return exampleCitation(ctx, req);
  if (citationOwners.get(found.id) !== ctx.user_id) throw new ApiError('not_found', 'no citation for this user', 'read');
  const { definition_version, ...rest } = found;
  return { status: 200, body: { ...rest, definition_version: Number(definition_version), basis_count: found.basis_ids.length } };
};

export const handlers: Record<string, Handler> = {
  'GET /v1/scores': exampleHandler('GET /v1/scores', c => { if (!oneOf('listing', 'item', 'product', 'match')(c.query.get('subject_type')) || !text(c.query.get('subject_id'))) throw invalid('subject_type and subject_id are required'); reference(c.query.get('subject_id'), ['ls_e81']); }),
  'GET /v1/scores/:id/basis': exampleHandler('GET /v1/scores/:id/basis'),
  'GET /v1/sites/:site/ranker': exampleHandler('GET /v1/sites/:site/ranker'),
  'GET /v1/citations/:id': citation,
  'GET /v1/experiments': exampleHandler('GET /v1/experiments'),
  'POST /v1/experiments/consent': exampleHandler('POST /v1/experiments/consent', c => fields(c.body, { on: bool })),
};
export const manifest = manifestFor(handlers);
