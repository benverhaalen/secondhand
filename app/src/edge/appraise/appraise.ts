// Rests-on: spec/features/appraise.md Just value it; spec/engines/valuation.md §3;
// money D22a. va-6's Check plugs into this port; the edge never manufactures comps or a range.
import type { Log } from '../../../../log/index.js';
import type { Answer, HideReason } from '../../engines/proof/proof.ts';
export interface HeldItem { id: string; user_id: string; state: string }
export interface SiteBand {
  site: string; band: Answer<{ lo: number; hi: number }>; level: 1 | 2 | 3;
  comps: string[]; state: 'checked' | 'rough' | 'hidden'; hide_reason?: HideReason;
}
export interface ValuationCheck { item_id: string; per_site: SiteBand[]; recall: 'clear' | 'matched' | 'unavailable' }
export interface AppraisePort {
  items(user_id: string): Promise<HeldItem[]>;
  check(item: HeldItem): Promise<ValuationCheck>;
}
export async function appraiseOwned(user_id: string, port: AppraisePort, log: Log) {
  try {
    const rows = await log.call('db', 'appraise.items', { user_id }, () => port.items(user_id), r => ({ items_count: r.length }));
    if (rows.some(r => r.user_id !== user_id)) throw new Error('tenant mismatch');
    if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('duplicate item');
    const items: { item_id: string; recall: ValuationCheck['recall']; per_site: (Omit<SiteBand, 'state'> & { state: 'checked' | 'wide' | 'hidden' })[] }[] = [];
    for (const item of rows.filter(r => ['owned', 'live', 'stale'].includes(r.state))) {
      const result = await log.call('tool', 'valuation.check', { item_id: item.id }, () => port.check(item), r => ({ sites_count: r.per_site.length, recall: r.recall }));
      if (result.item_id !== item.id) throw new Error('valuation item mismatch');
      if (new Set(result.per_site.map(s => s.site)).size !== result.per_site.length) throw new Error('duplicate valuation site');
      const per_site = result.per_site.map(row => {
        if (!row.band.ok) return { ...row, state: 'hidden' as const, hide_reason: 'source_gap' as const };
        const { value, basis, citation } = row.band;
        if (![value.lo, value.hi].every(v => Number.isSafeInteger(v) && v >= 0) || value.lo > value.hi) throw new Error('invalid valuation band');
        if (!basis.count || !basis.ids.length || !citation.id || !citation.basis_ids.length) throw new Error('valuation basis required');
        if (row.state === 'hidden') return { ...row, state: 'hidden' as const, hide_reason: row.hide_reason ?? 'too_few' as const };
        if (!row.comps.length && (row.state !== 'rough' || row.level !== 3)) return { ...row, state: 'hidden' as const, hide_reason: 'too_few' as const };
        return { ...row, state: row.state === 'rough' ? 'wide' as const : 'checked' as const };
      });
      items.push({ item_id: item.id, recall: result.recall, per_site });
      log.event('state.change', { entity: 'valuation', id: item.id, to: 'arrived', sites_count: per_site.length });
    }
    return { items };
  } catch (e) { log.error('appraise', e); throw e; }
}
