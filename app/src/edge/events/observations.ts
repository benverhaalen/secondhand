// Rests-on: spec/product.md §2 observation and §3 comp evidence; spec/engines/market-index.md §1, MI1, MI3; spec/plans/finalization.md SV7; spec/plans/server-store.md.
import { createHash } from 'node:crypto';
import { createLog, consoleSink, type Log } from '../../../../log/index.js';
import type { Rights, CompEvidence } from '../../engines/proof/proof.ts';
import type { Row, Store } from './ports.ts';

export const PUBLIC = 'sys_public';

export type ObservationInput = {
  via?: string; actor?: string; query?: string;
  may_store: boolean; may_model: boolean; use_scope: string; keep_until: string | null;
  channel: 'official_retail' | 'secondhand';
  kind: 'listing' | 'price'; site: string; product_id?: string; subject_ref: string; observed_at: string;
  payload: Record<string, unknown>; source_url: string; extractor_version: string; rights: Rights;
  source_route: string; retention_class: string; rights_mode: string;
  data: `live:${string}` | `dataset:${string}` | 'example' | 'synthetic';
};
export type ObservationRow = Row & Omit<ObservationInput, 'source_url' | 'extractor_version' | 'rights'> & {
  evidence: Omit<CompEvidence, 'snapshot_ref'> & { snapshot_ref: null };
};
export type ObservationFilter = Partial<Pick<ObservationInput, 'kind' | 'site' | 'product_id' | 'subject_ref' | 'query'>> & { purpose?: 'show' | 'model' };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
const shared = globalThis as typeof globalThis & { __secondhandObservationLog?: Log };
const log = shared.__secondhandObservationLog ??= createLog({ src: 'edge.observations', build: process.env.npm_package_version ?? 'dev', sink: consoleSink });
type Refuse = (field: string, reason: string) => never;

function canonical(value: unknown, refuse: Refuse, publicScope: boolean, path = 'payload', parents = new Set<object>()): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value !== 'object' || parents.has(value)) refuse(path, 'must be finite JSON');
  parents.add(value);
  try {
    if (Array.isArray(value)) return `[${Array.from(value, (v, i) => canonical(v, refuse, publicScope, `${path}[${i}]`, parents)).join(',')}]`;
    if (object(value)) {
      const keys = Object.keys(value).sort();
      for (const key of keys) {
        if (/seller|handle|username|address|street|zip|postal|lat|lng|lon/i.test(key)) refuse(`${path}.${key}`, 'contains a private field');
        if (publicScope && /user_id|person|visitor|session|asker/i.test(key)) refuse(`${path}.${key}`, 'names who asked');
      }
      return `{${keys.filter(k => value[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical(value[k], refuse, publicScope, `${path}.${k}`, parents)}`).join(',')}}`;
    }
    return refuse(path, 'must be finite JSON');
  } finally { parents.delete(value); }
}

function validate(row: ObservationInput, user_id: string, now: number): string {
  const subject_ref = object(row) && text(row.subject_ref) ? row.subject_ref : '(missing subject_ref)';
  const refuse: Refuse = (field, reason) => { throw new Error(`observation ${subject_ref}: ${field} ${reason}`); };
  if (!object(row)) refuse('row', 'must be an object');
  if (row.may_store !== true) refuse('may_store', 'must be true');
  if (row.site === 'dupe') refuse('site', 'dupe observations are never stored');
  for (const field of ['site', 'subject_ref', 'source_url', 'extractor_version', 'source_route'] as const) {
    if (!text(row[field])) refuse(field, 'is required');
  }
  if (!['listing', 'price'].includes(row.kind)) refuse('kind', 'must be listing or price');
  if (row.product_id !== undefined && !text(row.product_id)) refuse('product_id', 'must be text');
  if (!text(row.observed_at) || !Number.isFinite(Date.parse(row.observed_at))) refuse('observed_at', 'must be a date');
  if (row.data !== `live:${row.site}` && row.data !== 'example' && row.data !== 'synthetic' && !(typeof row.data === 'string' && /^dataset:\S.*$/.test(row.data))) refuse('data', 'must name its provenance');
  if (!['device', 'transient', 'thread', 'order', 'item_audit', 'source_ttl', 'history'].includes(row.retention_class)) refuse('retention_class', 'is invalid');
  if (!['own_scope', 'opt_in_shared', 'aggregate_only', 'public', 'internal', 'never_kept'].includes(row.rights_mode)) refuse('rights_mode', 'is invalid');
  if (!object(row.rights) || !(['may_store', 'may_model', 'may_show', 'may_share'] as const).every(k => typeof row.rights[k] === 'boolean') || !(row.rights.ttl === null || text(row.rights.ttl))) refuse('rights', 'are invalid');
  if (row.may_store !== row.rights.may_store) refuse('may_store', 'must agree with rights.may_store');
  if (typeof row.may_model !== 'boolean' || row.may_model !== row.rights.may_model) refuse('may_model', 'must agree with rights.may_model');
  if (!text(row.use_scope)) refuse('use_scope', 'must be non-empty text');
  if (!['official_retail', 'secondhand'].includes(row.channel)) refuse('channel', 'must be official_retail or secondhand');
  if (row.keep_until !== null) {
    if (typeof row.keep_until !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(row.keep_until) || !Number.isFinite(Date.parse(row.keep_until))) refuse('keep_until', 'must be an ISO time or null');
    const date = row.keep_until.slice(0, 10);
    if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) refuse('keep_until', 'must name a valid calendar date');
    if (Date.parse(row.keep_until) <= now) refuse('keep_until', 'has passed');
  }
  if (!object(row.payload)) refuse('payload', 'must be a JSON object');
  return canonical(row.payload, refuse, user_id === PUBLIC);
}

export function writeObservations(store: Store, user_id: string, rows: readonly ObservationInput[], now: () => number = Date.now): { written: number; skipped: number } {
  if (!text(user_id)) throw new Error('observation user_id is required');
  log.note('observation batch received', { row_count: rows.length });
  try {
    const result = store.tx(tx => {
      const current = now();
      const prepared: ObservationRow[] = rows.map(row => {
        const payload = validate(row, user_id, current), fingerprint = hash(payload);
        const { source_url, extractor_version, rights, ...fields } = row;
        const scope = row.product_id !== undefined || row.query !== undefined ? [row.product_id ?? null, row.query ?? null] : [];
        return { ...fields, payload: JSON.parse(payload) as Record<string, unknown>, user_id,
          id: 'obs_' + hash(JSON.stringify([user_id, row.site, row.kind, row.subject_ref, fingerprint, ...scope])).slice(0, 16),
          evidence: { source_url, read_at: row.observed_at, snapshot_ref: null, fingerprint, extractor_version, rights: structuredClone(rights) } };
      });
      let written = 0, skipped = 0;
      for (const row of prepared) {
        if (tx.get('observation', user_id, row.id)) { skipped++; continue; }
        tx.put('observation', row); written++;
      }
      return { written, skipped };
    });
    log.note('observation batch stored', result);
    return result;
  } catch (error) {
    log.error('observations.write', error);
    throw error;
  }
}

export function readObservations(store: Store, user_id: string, filter: ObservationFilter, now: () => number = Date.now): ObservationRow[] {
  const { purpose = 'show', ...scope } = filter;
  const selected = Object.fromEntries(Object.entries(scope).filter(([, value]) => value !== undefined));
  const current = now();
  const rows = store.rows<ObservationRow>('observation', { ...selected, user_id })
    .filter(row => row.keep_until == null || Date.parse(row.keep_until) > current)
    .filter(row => purpose === 'model'
      ? row.may_model === true && row.evidence.rights.may_model === true
      : row.evidence.rights.may_show === true)
    .sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at));
  log.note('observations read', { purpose, row_count: rows.length });
  return rows;
}
