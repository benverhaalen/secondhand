// Rests-on: spec/features/list.md; money D12; platform-analytics §3.11 (add-only exploration).
import type { Log } from '../../../../log/index.js';
import type { GuardedNumber } from '../../engines/proof/proof.ts';
import type { ParamStore, Declared } from '../../engines/param/param.ts';
import { bestSites, P_DOUBLE, type SiteOdds } from '../../engines/valuation/path.ts';

export interface SiteData extends Omit<SiteOdds, 'E'> {
  connected: boolean; allowed: boolean; fit: boolean; health: 'ok' | 'expiring' | 'broken' | 'paused';
  expected_keep: GuardedNumber; days: GuardedNumber;
}
export interface SourceContext { user_id: string; item_id: string; category: string; exploration_share: number }
export interface SourcesPort {
  read(context: SourceContext): Promise<SiteData[]>;
  // pa-3 supplies one posterior draw's D12 set, not a replacement for the mean pick.
  explore(context: SourceContext): Promise<SiteData['site'][]>;
}
export const SOURCE_PARAMS: Declared[] = [
  { name: 'site_set.p_double', family: 'scalar', prior: P_DOUBLE, guard_lo: 0, guard_hi: 1 },
  { name: 'site_set.exploration_share', family: 'scalar', prior: 0.2, guard_lo: 0, guard_hi: 1 },
];
function readable(g: GuardedNumber): boolean {
  const values = typeof g.value === 'number' ? [g.value] : [g.value.lo, g.value.hi];
  return g.state === 'shown' && Boolean(g.citation_id) && Number.isFinite(Date.parse(g.as_of)) && values.every(Number.isFinite);
}
export async function rankSources(context: SourceContext, port: SourcesPort, params: Pick<ParamStore, 'read'>, log: Log) {
  try {
    if (!Number.isFinite(context.exploration_share) || context.exploration_share < 0 || context.exploration_share > 1) throw new Error('invalid exploration_share');
    const read = (name: string) => {
      const p = params.read(name, { kind: context.category, person: context.user_id });
      if (typeof p.value !== 'number' || !Number.isFinite(p.value) || p.value < 0 || p.value > 1) throw new Error(`invalid param ${name}`);
      return p;
    };
    const risk = read('site_set.p_double'), explorationCap = read('site_set.exploration_share');
    const rows = await log.call('tool', 'sources.read', { item_id: context.item_id }, () => port.read(context), r => ({ sites_count: r.length }));
    if (new Set(rows.map(r => r.site)).size !== rows.length) throw new Error('duplicate site');
    const skipped: { site: SiteData['site']; reason: string }[] = [], eligible: (SiteData & { E: number })[] = [];
    for (const row of rows) {
      if (!Number.isFinite(row.P) || row.P < 0 || row.P > 1) throw new Error('invalid probability');
      if (![row.keep, row.cancel_cost].every(v => Number.isFinite(v) && v >= 0)) throw new Error('invalid site money');
      const reason = !row.connected ? 'not_connected' : !row.allowed ? 'site_bars_category' : !row.fit ? 'fit_avoid' : row.health !== 'ok' ? 'site_down' :
        !readable(row.expected_keep) || !readable(row.days) || typeof row.expected_keep.value !== 'number' ? 'source_gap' : undefined;
      if (reason) { skipped.push({ site: row.site, reason }); continue; }
      eligible.push({ ...row, E: row.expected_keep.value as number });
    }
    const ranked = eligible.sort((a, b) => b.E - a.E || b.P - a.P);
    const chosen = bestSites(ranked, risk.value as number);
    const exploration: SiteData['site'][] = [];
    if (context.exploration_share < (explorationCap.value as number)) {
      const draw = await log.call('tool', 'sources.explore', { item_id: context.item_id }, () => port.explore(context), r => ({ sites_count: r.length }));
      for (const site of draw) if (!chosen.includes(site) && eligible.some(r => r.site === site)) { chosen.push(site); exploration.push(site); }
    }
    log.event('state.change', { entity: 'strategy', id: context.item_id, to: 'suggested', sites_count: chosen.length });
    return { ranked, chosen, exploration, skipped, param_versions: { 'site_set.p_double': risk.version, 'site_set.exploration_share': explorationCap.version } };
  } catch (e) { log.error('sources.rank', e); throw e; }
}
