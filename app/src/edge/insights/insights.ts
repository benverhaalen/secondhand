// Rests-on: spec/features/insights.md analytics suite; spec/engines/platform-analytics.md §3.1–4,13.
import type { Log } from '../../../../log/index.js';
import { createHash } from 'node:crypto';
import { answer, type BasisRow, type Citation, type GuardedNumber } from '../../engines/proof/proof.ts';

export interface ListingStat {
  id: string; listing_id: string; day: string; stages: Record<string, number>;
  definitions: Record<string, string>; source: string; at: string;
}
export interface AnalyticsData {
  snapshot?: BasisRow;
  listings: { id: string; item_id: string; site: string }[];
  stats: ListingStat[];
  sales: { id: string; item_id: string; listing_id: string; site: string; state: 'paid' | 'released' | 'handed_over' | 'refunded'; payout_cents: number; at: string }[];
  site_figures?: { id: string; site: string; name: string; value: number; definition: string; at: string }[];
}
// read is a tenant-scoped snapshot. stats are daily deltas from pa-2, not cumulative counters.
export interface AnalyticsPort { read(user_id: string): Promise<AnalyticsData> }
type Figure = GuardedNumber | { state: 'hidden'; hide_reason: 'source_gap'; basis_count: number; value?: never; citation_id?: never };
type Quality = 'reported' | 'not_reported' | 'partial';
interface Funnel { listing_id: string; site: string; stages: Record<string, Figure>; definitions: Record<string, string>; quality: Quality }

export async function insights(user_id: string, port: AnalyticsPort, as_of: string, log: Log) {
  try {
    const data = await log.call('db', 'insights.read', { user_id }, () => port.read(user_id), d => ({ listings_count: d.listings.length }));
    const citations: Citation[] = [];
    const figure = (metric: string, value: number, rows: BasisRow[], complete = true): Figure => {
      if (!complete) return { state: 'hidden', hide_reason: 'source_gap', basis_count: rows.length };
      const proof = answer(value, rows, { metric, filters: { user_id }, table_versions: [], definition_version: 'platform-analytics.3', code_version: 'ins-1', model_version: null, param_versions: {} }, as_of);
      if (!proof.ok) return { state: 'hidden', hide_reason: 'source_gap', basis_count: 0 };
      proof.citation.id += `_${createHash('sha256').update(JSON.stringify([metric, value, as_of])).digest('hex').slice(0, 12)}`;
      citations.push(proof.citation);
      return { value, basis_count: rows.length, as_of, citation_id: proof.citation.id, state: 'shown' };
    };
    const unique = new Map<string, ListingStat>();
    for (const stat of data.stats) {
      if (!data.listings.some(l => l.id === stat.listing_id)) throw new Error('stats listing attribution');
      for (const [name, count] of Object.entries(stat.stages)) {
        if (!Number.isSafeInteger(count) || count < 0) throw new Error('invalid stage count');
        if (!stat.definitions[name]) throw new Error('missing stage definition');
      }
      const key = `${stat.listing_id}:${stat.day}`;
      const previous = unique.get(key);
      if (!previous || Date.parse(stat.at) > Date.parse(previous.at)) unique.set(key, stat);
    }
    const stats = [...unique.values()];
    const funnel: Funnel[] = data.listings.map(listing => {
      const rows = stats.filter(s => s.listing_id === listing.id);
      const stages: Record<string, Figure> = {}, definitions: Record<string, string> = {};
      for (const name of new Set(rows.flatMap(s => Object.keys(s.stages)))) {
        const present = rows.filter(s => s.stages[name] !== undefined);
        const names = new Set(present.map(s => s.definitions[name]));
        definitions[name] = [...names].join('; ');
        stages[name] = figure(name, present.reduce((sum, s) => sum + s.stages[name], 0), present.map(s => ({ id: s.id, source: s.source, at: s.at })), present.length === rows.length && names.size === 1);
      }
      return { listing_id: listing.id, site: listing.site, stages, definitions, quality: !rows.length ? 'not_reported' : Object.values(stages).some(s => s.state === 'hidden') ? 'partial' : 'reported' };
    });
    const sales = [...new Map(data.sales.map(s => [s.id, s])).values()].filter(s => s.state !== 'refunded');
    for (const sale of sales) {
      if (!data.listings.some(l => l.id === sale.listing_id && l.item_id === sale.item_id && l.site === sale.site)) throw new Error('sale attribution mismatch');
    }
    const saleBasis = (rows: AnalyticsData['sales']): BasisRow[] => rows.length ? rows.map(s => ({ id: s.id, source: 'order', at: s.at })) : data.snapshot ? [data.snapshot] : [];
    const by_site = [...new Set(data.listings.map(l => l.site))].map(site => {
      const fs = funnel.filter(f => f.site === site), siteSales = sales.filter(s => s.site === site);
      const stages: Record<string, Figure> = {};
      for (const name of new Set(fs.flatMap(f => Object.keys(f.stages)))) {
        const values = fs.map(f => f.stages[name]);
        const observations = stats.filter(s => fs.some(f => f.listing_id === s.listing_id) && s.stages[name] !== undefined);
        stages[name] = figure(name, values.reduce((sum, v) => sum + (typeof v?.value === 'number' ? v.value : 0), 0), observations.map(s => ({ id: s.id, source: s.source, at: s.at })), values.every(v => v?.state === 'shown') && new Set(fs.map(f => f.definitions[name])).size === 1);
      }
      return { site, stages, quality: fs.every(f => f.quality === 'reported') ? 'reported' : fs.every(f => f.quality === 'not_reported') ? 'not_reported' : 'partial',
        sold_count: figure('sold_count', siteSales.length, saleBasis(siteSales)),
        reported: (data.site_figures ?? []).filter(f => f.site === site).map(f => ({ name: f.name, definition: f.definition, value: figure(f.name, f.value, [{ id: f.id, source: 'site_report', at: f.at }]), quality: 'site_report' })) };
    });
    log.event('state.change', { entity: 'insights', id: user_id, to: 'computed', listings_count: funnel.length });
    return { funnel, by_site, sold_count: figure('sold_count', sales.length, saleBasis(sales)), citations };
  } catch (e) { log.error('insights', e); throw e; }
}
