import { check, type CheckInput } from './check.ts';
import { canonical, comparables, fromResolved, nEff, type BasisLevel, type Comp, type Params, type WeightedComp } from './comps.ts';
import { resolve } from './params.ts';
import { scopeKey, type ParamStore, type Scope } from '../param/param.ts';
import type { fittedReader, SaleCurveFit } from '../param/export.ts';
import { qg, resolve as resolveACI } from './aci.ts';
import type { Curve, Objective } from './path.ts';

export type CompSource = (signal: AbortSignal) => Promise<Comp[]>;
export type ObservationPort = {
  read(q: { product_id: string; family_id?: string; kind?: string; as_of: string }): Promise<Comp[]>;
  write(rows: Comp[], meta: { item_id: string; as_of: string; request_id?: string }): Promise<void>;
};
export type ValuateCtx = { params: ParamStore; sources: CompSource[]; observations: ObservationPort; as_of: string; person?: string;
  budget_ms?: number; request_id?: string; log: CheckInput['log']; fitted?: ReturnType<typeof fittedReader> };
export type ValuationItem = { item_id: string; product_id: string; variant?: string; size?: string; family_id?: string; kind?: string;
  condition: string; completeness?: string[]; works?: string; retail_cents?: number; retail_citation?: string;
  floor_cents: number; objective: Objective; sites: CheckInput['sites'] };
export type GatherNeed = { product_id: string; claim: 'valuation'; basis_level: BasisLevel; reason: 'too_few' | 'stale' | 'source_gap'; n_eff: number; want_n_eff: number };

/** The export reader validates ordered bins and nondecreasing probabilities before this mapping. */
export function saleCurve(fit: SaleCurveFit, q50: number): Curve {
  function points(price: number): [number, number][] {
    const ratio = price / q50, bins = fit.bins;
    const upper = bins.findIndex(bin => bin.ratio >= ratio);
    const hi = upper < 0 ? bins.length - 1 : upper;
    const lo = upper <= 0 ? hi : hi - 1;
    const weight = lo === hi ? 0 : (ratio - bins[lo].ratio) / (bins[hi].ratio - bins[lo].ratio);
    return [[0, 0], ...fit.days.map((day, i): [number, number] =>
      [day, bins[lo].p[i] + weight * (bins[hi].p[i] - bins[lo].p[i])])];
  }
  return {
    p(price, days) {
      if (days <= 0) return 0;
      const knots = points(price);
      for (let i = 1; i < knots.length; i++) {
        const [end, p1] = knots[i], [start, p0] = knots[i - 1];
        if (days <= end) return p0 + (days - start) / (end - start) * (p1 - p0);
      }
      return knots.at(-1)![1];
    },
    t(price, q) {
      if (fit.bins.length === 1 && fit.t) {
        const index = [.25, .5, .75].indexOf(q);
        if (index !== -1) return fit.t[index];
      }
      if (q <= 0) return 0;
      const knots = points(price);
      for (let i = 1; i < knots.length; i++) {
        const [end, p1] = knots[i], [start, p0] = knots[i - 1];
        if (q <= p1) return start + (q - p0) / (p1 - p0) * (end - start);
      }
      return null;
    },
  };
}

function fittedCalibration(ctx: ValuateCtx, scope: Scope, checkedMin: number): (CheckInput['calibration'] & { citation?: string }) | undefined {
  if (!ctx.fitted) return undefined;
  const local = ctx.params.rows('valuation_conformal_scores', scope).find(row => row.status === 'champion');
  if (local) {
    // qg validates the stored score history before its counts are read here.
    const Q_g = qg(ctx.params, scope);
    const history = (local.value_or_hyperparams as { scores: { err: 0 | 1 }[] }).scores;
    const minimum = resolveACI(ctx.params, scope).values.valuation_conformal_parent_min;
    if (typeof minimum !== 'number' || !Number.isFinite(minimum)) throw new RangeError('valuation_conformal_parent_min');
    if (history.length >= minimum) {
      const n = history.length, hits = history.filter(s => s.err === 0).length;
      return { Q_g, n, hits, coverage: hits / n, passes: n >= checkedMin, group: scopeKey(scope) };
    }
  }
  if (!scope.kind) return undefined;
  const row = ctx.fitted.calibration({ kind: scope.kind });
  if (!row) return undefined;
  const { Q_g, n, hits } = row.value_or_hyperparams;
  return { Q_g, n, hits, coverage: n ? hits / n : 0, passes: n >= checkedMin,
    group: `export:${ctx.fitted.loaded()!.run_id}:${scope.kind}`, citation: row.citation };
}

/** Pass check.comps to retain target adjustments; raw comps are measured at their first canonical comp's condition. */
export function basisOf(comps: readonly Comp[], as_of: string, params: Params): { n_eff: number; sold_90d: number; basis_level: BasisLevel } {
  const weighted = (c: Comp): c is WeightedComp => 'w' in c && typeof c.w === 'number';
  const snapshot = canonical(comps, as_of, params);
  const final = snapshot.filter(weighted), ids = new Set(final.map(c => c.comp_id));
  const candidates = snapshot.filter(c => !weighted(c) && !ids.has(c.comp_id));
  const found = candidates.length ? comparables({ condition: candidates[0].condition }, candidates, as_of, params) : null;
  const rows = [...final, ...found?.comps ?? []];
  const mostSpecific = (['variant', 'product', 'family', 'category'] as const).find(level => rows.some(c => c.level === level));
  return { n_eff: nEff(rows.map(c => c.w)),
    sold_90d: rows.filter(c => { const age = (Date.parse(as_of) - Date.parse(c.sold_at)) / 86400000; return age >= 0 && age <= 90; }).length,
    basis_level: mostSpecific === 'category' ? 'kind' : mostSpecific ?? 'prior' };
}

export async function valuate(item: ValuationItem, ctx: ValuateCtx): Promise<{ valuation: Awaited<ReturnType<typeof check>>; gather: GatherNeed | null; persisted: boolean }> {
  return ctx.log.timed('valuation.valuate', async () => {
    const scope: Scope = { ...(ctx.person !== undefined ? { person: ctx.person } : {}), ...(item.kind !== undefined ? { kind: item.kind } : {}) };
    const resolved = resolve(ctx.params, scope), params = fromResolved(resolved);
    const calibration = fittedCalibration(ctx, scope, resolved.values.valuation_checked_min_n);
    const curves = item.sites.map(s => item.kind ? ctx.fitted?.curve({ kind: item.kind, site: s.site }) : undefined);
    let warm: Comp[] = [], warmUnavailable = false;
    try {
      warm = await ctx.log.timed('valuation.observations.read', () => ctx.observations.read({ product_id: item.product_id,
        ...(item.family_id !== undefined ? { family_id: item.family_id } : {}), ...(item.kind !== undefined ? { kind: item.kind } : {}), as_of: ctx.as_of }));
    } catch (error) { ctx.log.error('valuation.observations.read', error); warmUnavailable = true; }
    const returned: Comp[] = [];
    const sources: CompSource[] = ctx.sources.map(source => async signal => {
      const rows = await source(signal);
      if (!signal.aborted) returned.push(...rows);
      return rows;
    });
    const input: CheckInput = { ...item, ...(calibration ? { calibration } : {}), as_of: ctx.as_of, params, resolved, store: ctx.params, scope,
      param_version: 0, warm_comps: warm, sources, budget_ms: ctx.budget_ms, log: ctx.log };
    let valuation = await check(input);
    const reference = valuation.range.q50;
    if (reference !== null && curves.some(Boolean)) {
      const sites = item.sites.map((s, i) => {
        const row = curves[i];
        if (!row) return s;
        const { n_events, calibration_error } = row.value_or_hyperparams;
        return { ...s, curve: saleCurve(row.value_or_hyperparams, reference),
          curve_evidence: { n: n_events, calibration_error, citation: row.citation } };
      });
      // Bind to check's item median, then reuse only the batches completed before its deadline.
      const partial = valuation.partial;
      const replayLog: CheckInput['log'] = { timed: (name, fn) => ctx.log.timed(name, fn), error: (where, error) => {
        // These validations already logged the same rows/calibrations with their original batch provenance.
        if (where !== 'valuation.check.uncitable' && where !== 'valuation.check.site_citation') ctx.log.error(where, error);
      } };
      valuation = await check({ ...input, sites, warm_comps: [...warm, ...returned], sources: [], log: replayLog });
      valuation.partial = partial;
    }
    if (warmUnavailable) valuation.notes.push('warm_unavailable');
    let persisted = true;
    const warmIds = new Set(warm.map(c => c.comp_id));
    // Persistence deduplicates ids only; the pricing snapshot may additionally deduplicate listing clusters.
    const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
    const stable = (c: Comp) => JSON.stringify(Object.entries(c).sort(([a], [b]) => compare(a, b)));
    const ordered = returned.slice().sort((a, b) => compare(a.comp_id, b.comp_id) ||
      Date.parse(b.observed_at ?? b.sold_at) - Date.parse(a.observed_at ?? a.sold_at) ||
      a.price_cents - b.price_cents || compare(a.site, b.site) || compare(stable(a), stable(b)));
    const rows = ordered.filter(c => {
      if (warmIds.has(c.comp_id)) return false;
      warmIds.add(c.comp_id); return true;
    });
    if (rows.length) {
      try {
        await ctx.log.timed('valuation.observations.write', () => ctx.observations.write(rows, {
          item_id: item.item_id, as_of: ctx.as_of, ...(ctx.request_id !== undefined ? { request_id: ctx.request_id } : {}),
        }));
      } catch (error) { ctx.log.error('valuation.observations.write', error); persisted = false; }
    }
    const basis = basisOf(valuation.comps, ctx.as_of, params);
    const needs = valuation.basis_level !== 'variant' || valuation.notes.some(note => note === 'too_few' || note === 'stale');
    const stale = !valuation.comps.some(c => c.age_days <= params.recent_days);
    const gather: GatherNeed | null = needs ? { product_id: item.product_id, claim: 'valuation', basis_level: valuation.basis_level,
      n_eff: basis.n_eff, want_n_eff: params.min_n_eff,
      reason: basis.n_eff < params.min_n_eff ? 'too_few' : stale ? 'stale' : 'source_gap' } : null;
    return { valuation, gather, persisted };
  });
}
