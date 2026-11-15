// Rests-on: spec/product.md §6 Genie (user-scoped space), §7 Resources; spec/features/assist.md.
import { ApiError, type Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text, pagination } from './captures.ts';
import { genie, type GenieDeps, type GenieResult } from '../genie/genie.ts';
import { answer, memoryProof, type BasisRow, type CitationInput } from '../../engines/proof/proof.ts';

export type GeniePorts = {
  // The host must resolve a space with this user's row filters, never one shared unfiltered space.
  forUser(user_id: string): Promise<GenieDeps | null>;
  proof: ReturnType<typeof memoryProof>;
  snapshot?(user_id: string, result: Extract<GenieResult, { status: 'answered' }>): Promise<{ rows: BasisRow[]; cite: CitationInput } | null>;
};
export const ports: GeniePorts = { forUser: async () => null, proof: memoryProof() };
export const citationOwners = new Map<string, string>();

export function makeGenieHandler(ports: GeniePorts): Handler {
  const fallback = exampleHandler('POST /v1/genie', c => fields(c.body, { question: text }));
  return async (ctx, req) => {
    fields(ctx.body, { question: text });
    pagination(ctx);
    const connection = await ports.forUser(ctx.user_id!);
    if (!connection) return fallback(ctx, req);
    const result = await genie(ctx.body.question as string, { ...connection, log: ctx.log });
    if (result.status !== 'answered') {
      ctx.log.error('genie', new Error(result.reason));
      throw new ApiError('site_failed', result.reason, 'genie', { by: 'user' });
    }
    const snapshot = await ports.snapshot?.(ctx.user_id!, result);
    if (!snapshot || !result.citation.tables.every(table => snapshot.cite.table_versions.some(v => v.table === table))) {
      throw new ApiError('waking', 'query snapshot is not available', 'citation', { by: 'auto', after_s: 2 });
    }
    const proof = answer(result.rows, snapshot.rows, {
      ...snapshot.cite, filters: { sql: result.citation.sql, scope: snapshot.cite.filters },
    }, result.citation.as_of);
    if (!proof.ok) throw new ApiError('site_failed', 'Genie returned no table basis', 'citation');
    const citation = { ...proof.citation, id: `ci_${crypto.randomUUID().replace(/-/g, '')}` };
    ports.proof.cite(citation);
    citationOwners.set(citation.id, ctx.user_id!);
    return { status: 200, body: { answer: result.text, sql: result.citation.sql, rows: result.rows, citation_id: citation.id } };
  };
}
export const handlers: Record<string, Handler> = { 'POST /v1/genie': makeGenieHandler(ports) };
export const manifest = manifestFor(handlers);
