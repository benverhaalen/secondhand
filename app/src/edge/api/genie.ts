// Rests-on: spec/product.md §6 Genie (user-scoped space), §7 Resources; spec/features/assist.md.
import { ApiError, type Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text, pagination, fromEngine } from './captures.ts';
import { genie, type GenieDeps, type GenieResult } from '../genie/genie.ts';
import { example } from './examples.ts';
import { deps } from './http.ts';
import { answer, memoryProof, type BasisRow, type CitationInput } from '../../engines/proof/proof.ts';

export type GeniePorts = {
  // The host must resolve a space with this user's row filters, never one shared unfiltered space.
  forUser(user_id: string): Promise<GenieDeps | null>;
  proof: ReturnType<typeof memoryProof>;
  snapshot?(user_id: string, result: Extract<GenieResult, { status: 'answered' }>): Promise<{ rows: BasisRow[]; cite: CitationInput; citation_id?: string } | null>;
};
const seed = example('genie').response as { answer: string; sql: string; rows: unknown[][]; citation_id: string };
const question = (example('genie').request!.body as { question: string }).question;
const as_of = '2026-11-15T05:00:00Z';
const snapshots = new Map([[question, seed]]);
export const ports: GeniePorts = {
  proof: memoryProof(),
  async forUser(user) {
    if (user !== 'usr_8f2k') return null;
    let selected: typeof seed | undefined;
    return { host: 'https://genie.memory', space_id: user, token: async () => '', log: deps.log, now: () => Date.parse(as_of),
      fetch: async (input, init) => {
        const path = String(input);
        if (path.endsWith('start-conversation')) {
          const body = JSON.parse(String(init?.body)) as { content: string };
          selected = snapshots.get(body.content);
          return Response.json({ conversation_id: 'stored', message_id: 'stored' });
        }
        if (path.endsWith('query-result')) {
          if (!selected) throw new Error('no stored query');
          return Response.json({ statement_response: { manifest: { schema: { columns: [{ name: 'site' }, { name: 'avg(days_to_sell)' }] }, total_row_count: selected.rows.length }, result: { data_array: selected.rows } } });
        }
        return Response.json({ status: 'COMPLETED', last_updated_timestamp: Date.parse(as_of), attachments: selected ? [{ attachment_id: 'stored', query: { query: selected.sql } }, { text: { content: selected.answer } }] : [] });
      } };
  },
  async snapshot(user, result) {
    if (user !== 'usr_8f2k' || result.citation.sql !== seed.sql) return null;
    return { citation_id: seed.citation_id, rows: seed.rows.map((_, i) => ({ id: `sales_${i}`, source: 'spec/examples/buy.json', at: as_of })), cite: { metric: 'genie', filters: { user_id: user }, table_versions: [{ table: 'sales', version: 1 }], definition_version: '1', code_version: 'rt-genie', model_version: null, param_versions: {} } };
  },
};
export const citationOwners = new Map<string, string>();

export function makeGenieHandler(ports: GeniePorts): Handler {
  const fallback = exampleHandler('POST /v1/genie', c => fields(c.body, { question: text }));
  return async (ctx, req) => {
    fields(ctx.body, { question: text });
    pagination(ctx);
    const connection = await ports.forUser(ctx.user_id!);
    if (!connection) { await fallback(ctx, req); throw new ApiError('waking', 'no user-scoped Genie connection', 'genie', { by: 'auto', after_s: 2 }); }
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
    const citation = { ...proof.citation, id: snapshot.citation_id ?? `ci_${crypto.randomUUID().replace(/-/g, '')}` };
    ports.proof.cite(citation);
    citationOwners.set(citation.id, ctx.user_id!);
    return { status: 200, body: { answer: result.text, sql: result.citation.sql, rows: result.rows, citation_id: citation.id } };
  };
}
export const handlers: Record<string, Handler> = { 'POST /v1/genie': fromEngine(makeGenieHandler(ports)) };
export const manifest = manifestFor(handlers);
