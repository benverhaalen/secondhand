import { comparables, type Comp, type Params } from './comps.ts';
import { pricePath, ladder, bestSites, type Curve, type Objective } from './path.ts';
import { keep, type FeeSite, type Sale } from './keep.ts';
import { answer } from '../proof/proof.ts';
import type { FamilyBand } from './fast.ts';

export type CheckInput = {
  product_id: string; variant?: string; condition: string; as_of: string;
  floor_cents: number; objective: Objective; param_version: number; params?: Params;
  fast?: FamilyBand | null; warm_comps: Comp[];
  sources: ((signal: AbortSignal) => Promise<Comp[]>)[];
  sites: { site: FeeSite; curve: Curve; sale?: Sale }[];
  calibration?: { Q_g: number; group: string; coverage: number; passes: boolean };
  recalled?: boolean; budget_ms?: number;
  log: { timed: <T>(name: string, fn: () => T) => T; error: (where: string, error: unknown) => void };
};

// Sources receive the same deadline signal; a warm cited estimate is already available when they time out.
export async function check(x: CheckInput) {
  return x.log.timed('valuation.check', async () => {
    if (!Number.isSafeInteger(x.floor_cents) || x.floor_cents < 0) throw new RangeError('invalid floor');
    const sites = x.sites.map(s => {
      const site = s.site;
      if (site !== 'ebay' && site !== 'facebook' && site !== 'depop' && site !== 'poshmark' && site !== 'mercari') throw new RangeError(`unsupported valuation site: ${site}`);
      return { ...s, site };
    });
    const controller = new AbortController();
    const rows = [...x.warm_comps];
    let partial = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const budget = Math.min(10_000, x.budget_ms ?? 10_000);
    const deadline = new Promise<void>(resolve => { timer = setTimeout(() => { partial = true; controller.abort(); resolve(); }, budget); });
    try {
      await Promise.race([Promise.all(x.sources.map(async source => { rows.push(...await source(controller.signal)); })), deadline]);
    } catch (error) {
      x.log.error('valuation.check.source', error); throw error;
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
    const unique = [...new Map(rows.map(row => [row.comp_id, row])).values()];
    const found = comparables({ condition: x.condition }, unique, x.as_of, x.params);
    const proof = answer(found.range, found.comps.map(c => ({ id: c.comp_id, source: c.citation, at: c.sold_at, price_cents: c.adjusted_cents, weight: c.w })), {
      metric: 'valuation', filters: { product_id: x.product_id }, table_versions: [], definition_version: 'valuation.D1-D15', code_version: 'va-6', param_versions: { valuation: x.param_version }, model_version: null,
    }, x.as_of);
    if (found.comps.length && !proof.ok) throw new Error('valuation missing basis');
    const calibrated = x.calibration?.passes && x.calibration.coverage >= .75 && x.calibration.coverage <= .85;
    const q = x.calibration?.Q_g ?? 0;
    const warm = x.fast;
    const range = found.range.q50 !== null ? {
      q10: Math.max(0, Math.floor((found.range.q10 ?? 0) - q)), q50: found.range.q50, q90: Math.ceil((found.range.q90 ?? 0) + q),
      state: calibrated && found.state === 'ok' ? 'checked' : 'not_checked_yet', group: x.calibration?.group ?? null,
      share_shown: calibrated ? Math.floor(x.calibration!.coverage * 10) / 10 : null,
    } : { q10: warm?.low ?? null, q50: null, q90: warm?.high ?? null, state: warm ? 'not_checked_yet' : 'hidden', group: null, share_shown: null };
    const per_site = sites.map(s => {
      const local = comparables({ condition: x.condition, site: s.site }, unique, x.as_of, x.params);
      const p = local.range.q50;
      return { site: s.site, ...local.range, translated: local.comps.some(c => c.site !== s.site),
        keep_q10: local.range.q10 === null ? null : keep(s.site, local.range.q10, s.sale).keep_cents,
        keep_q50: p === null ? null : keep(s.site, p, s.sale).keep_cents,
        keep_q90: local.range.q90 === null ? null : keep(s.site, local.range.q90, s.sale).keep_cents,
        p_sale: p === null ? null : { d7: s.curve.p(p, 7), d30: s.curve.p(p, 30), d90: s.curve.p(p, 90) },
        days: p === null ? null : { t25: s.curve.t(p, .25), t50: s.curve.t(p, .5), t75: s.curve.t(p, .75) },
        path: x.recalled || local.state !== 'ok' ? null : pricePath({ site: s.site,
          rungs: ladder(local.comps.map(c => c.adjusted_cents), local.comps.map(c => c.w)).filter(p => p >= x.floor_cents).concat(x.floor_cents).filter((p, i, all) => p > 0 && all.indexOf(p) === i).sort((a, b) => b - a),
          curve: s.curve, objective: x.objective, sale: s.sale, person_floor_cents: x.floor_cents, q90_cents: local.range.q90 ?? x.floor_cents }),
      };
    });
    const chosen = bestSites(per_site.filter(s => s.path !== null).map(s => ({ site: s.site, E: s.path!.expected_keep, P: s.p_sale?.d30 ?? 0, keep: s.keep_q50 ?? 0, cancel_cost: 0 })));
    const path = per_site.find(s => s.site === chosen[0])?.path ?? null;
    // pricePath's ladder includes diagnostic rungs; only executable rungs at or above its computed floor leave the Check.
    const price_path = path && { ...path, ladder: path.ladder.filter(r => r.price >= path.floor) };
    return { product_id: x.product_id, variant: x.variant, condition: x.condition, as_of: x.as_of,
      fast: warm ?? null, comps: found.comps, n_eff: found.n_eff, range, per_site: per_site.map(({ path: _path, ...s }) => s),
      best_sites: chosen, price_path, param_version: x.param_version, partial,
      basis: proof.ok ? proof.basis : { count: warm?.n ?? 0, oldest: warm?.as_of ?? null, newest: warm?.as_of ?? null, sources: warm ? [warm.basis] : [] },
      citation: proof.ok ? proof.citation : null };
  });
}
