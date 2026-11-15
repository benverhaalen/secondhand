import { comparables, canonical, fromResolved, money, type Comp, type Params, type Target } from './comps.ts';
import { resolve, type Resolved } from './params.ts';
import type { ParamStore, Scope } from '../param/param.ts';
import { pricePath, ladder, planOf, type Curve, type Objective } from './path.ts';
import { keep, type FeeSite, type Sale } from './keep.ts';
import { answer, type BasisRow } from '../proof/proof.ts';
import type { FamilyBand } from './fast.ts';
import { ceiling, MARKS, pointOnSite, type Point } from './posture.ts';

type Mode = Point & { per_site: Point[] };
type Modes = Record<'fast' | 'sell' | 'best', Mode>;
class CitationError extends Error {}

type Calibration = { Q_g: number; parent_Q_g?: number; group: string; coverage: number; passes: boolean; n?: number; hits?: number };
export type CheckInput = {
  product_id: string; variant?: string; condition: string; as_of: string;
  kind_band?: Target['kind_band'];
  size?: string; family_id?: string; kind?: string; retail_cents?: number; depreciation?: number;
  completeness?: string[]; works?: string; retail_citation?: string;
  retail_cap_cents?: number; live_ask_cap_cents?: number;
  floor_cents: number; objective: Objective; param_version: number; params?: Params; resolved?: Resolved; store?: ParamStore; scope?: Scope;
  fast?: FamilyBand | null; warm_comps: Comp[];
  sources: ((signal: AbortSignal) => Promise<Comp[]>)[];
  sites: { site: FeeSite; curve?: Curve; sale?: Sale; cancel_cost_cents?: number; delist_minutes?: number;
    curve_evidence?: { n: number; calibration_error: number; citation: string }; calibration?: Calibration }[];
  calibration?: Calibration;
  recalled?: boolean; budget_ms?: number;
  log: { note?: (name: string, fields: Record<string, unknown>) => void; timed: <T>(name: string, fn: () => T) => T; error: (where: string, error: unknown) => void };
};

function wilsonLower(hits: number, n: number): number {
  const z = 1.959963984540054; // Fixed standard-normal quantile for a 95% two-sided interval.
  const p = hits / n;
  return (p + z * z / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n);
}

/** The completed observation snapshot is explicit and immutable after the deadline. */
export async function check(x: CheckInput) {
  return x.log.timed('valuation.check', async () => {
    money(x.floor_cents, 'floor_cents');
    for (const key of ['retail_cents', 'retail_cap_cents', 'live_ask_cap_cents'] as const) if (x[key] !== undefined) money(x[key]!, key);
    const resolved = x.resolved ?? resolve(x.store, x.scope ?? { kind: x.kind, segment: x.family_id });
    const values = resolved.values;
    const params = x.params ?? fromResolved(resolved);
    const sites = x.sites.map(s => {
      const site = s.site;
      if (site !== 'ebay' && site !== 'facebook' && site !== 'depop' && site !== 'poshmark' && site !== 'mercari') throw new RangeError(`unsupported valuation site: ${site}`);
      if (s.cancel_cost_cents !== undefined) money(s.cancel_cost_cents, 'cancel_cost_cents');
      if (s.delist_minutes !== undefined && (!Number.isFinite(s.delist_minutes) || s.delist_minutes < 0)) throw new RangeError('delist_minutes');
      return { ...s, site, sale: { ...s.sale, tax_rate: s.sale?.tax_rate ?? values.valuation_sales_tax_rate, as_of: s.sale?.as_of ?? x.as_of } };
    }).sort((a, b) => a.site.localeCompare(b.site));
    const controller = new AbortController();
    const completed: Comp[][] = [[...x.warm_comps]];
    let partial = false, closed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const budget = Math.min(values.valuation_budget_ms, x.budget_ms ?? values.valuation_budget_ms);
    if (!Number.isFinite(budget) || budget < 0) throw new RangeError('budget_ms');
    const deadline = new Promise<void>(done => { timer = setTimeout(() => { partial = true; closed = true; controller.abort(); done(); }, budget); });
    try {
      await Promise.race([Promise.all(x.sources.map(async source => {
        const observations = await source(controller.signal);
        if (!closed) completed.push(observations);
      })), deadline]);
    } catch (error) {
      x.log.error('valuation.check.source', error); throw error;
    } finally {
      closed = true; clearTimeout(timer); controller.abort();
    }
    const uncitableSites = new Set<Comp['site']>();
    const now = Date.parse(x.as_of);
    const snapshot = canonical(completed.flatMap((batch, index) => {
      let uncitable = 0;
      const rows = batch.filter(c => {
        const dates = [c.sold_at, ...(c.observed_at === undefined ? [] : [c.observed_at]), ...('at' in c ? [c.at] : [])];
        const invalid = !c.comp_id || !c.citation || dates.some(at => typeof at !== 'string' || !Number.isFinite(Date.parse(at)) || Date.parse(at) > now);
        if (invalid) { uncitable++; uncitableSites.add(c.site); }
        return !invalid;
      });
      if (uncitable) x.log.error('valuation.check.uncitable', { batch: index, count: uncitable });
      return rows;
    }), x.as_of, params);
    if (!x.retail_citation && params.blend_enabled && x.kind && x.retail_cents && x.depreciation) {
      const name = 'valuation.check.retail_uncited', fields = { product_id: x.product_id };
      if (x.log.note) x.log.note(name, fields); else x.log.error(name, fields);
    }
    const target: Target = { condition: x.condition, size: x.size, family_id: x.family_id, product_id: x.product_id,
      kind: x.kind, kind_band: x.kind_band, retail_cents: x.retail_citation ? x.retail_cents : undefined, depreciation: x.retail_citation ? x.depreciation : undefined, completeness: x.completeness, works: x.works };
    const found = comparables(target, snapshot, x.as_of, params);
    const warm = x.fast;
    const cap = x.condition === 'new_with_tags' ? Math.min(x.retail_cap_cents ?? Infinity, x.live_ask_cap_cents ?? Infinity) : Infinity;
    const finalRange = (local: typeof found, calibration?: Calibration) => {
      const q = calibration?.Q_g ?? 0, parent = calibration?.parent_Q_g ?? 0;
      if (![q, parent].every(v => Number.isFinite(v) && v >= 0)) throw new CitationError('Q_g must be nonnegative finite log units');
      const n = calibration?.n ?? 0, hits = calibration?.hits ?? 0;
      if (!Number.isSafeInteger(n) || !Number.isSafeInteger(hits) || n < 0 || hits < 0 || hits > n) throw new CitationError('calibration counts');
      if (calibration && (!Number.isFinite(calibration.coverage) || calibration.coverage < 0 || calibration.coverage > 1)) throw new CitationError('coverage');
      const coverage = n ? hits / n : null;
      const checked = local.state !== 'too_few' && calibration?.passes && coverage !== null && n >= values.valuation_checked_min_n &&
        coverage >= values.valuation_coverage_min && coverage <= values.valuation_coverage_max && wilsonLower(hits, n) >= values.valuation_checked_wilson_min;
      let range = { ...local.range };
      let basis_level = local.basis_level;
      if (range.q50 === null && warm) {
        money(warm.low, 'fast.low'); money(warm.high, 'fast.high');
        if (warm.low > warm.high) throw new RangeError('fast range conflict');
        range = { q10: warm.low, q50: null, q90: warm.high };
        basis_level = warm.basis === 'family' ? 'family' : 'kind';
      }
      if (range.q50 !== null) {
        const q10 = Math.round(range.q10! / Math.exp(q + (local.extrapolated === 'down' ? parent : 0)));
        const q90 = Math.round(range.q90! * Math.exp(q + (local.extrapolated === 'up' ? parent : 0)));
        if (![q10, q90].every(v => Number.isSafeInteger(v) && v >= 0))
          throw new CitationError('calibrated range must be nonnegative safe integer cents');
        range = { q10, q50: range.q50, q90 };
        if (Number.isFinite(cap)) range = { q10: Math.min(range.q10!, cap), q50: Math.min(range.q50!, cap), q90: Math.min(range.q90!, cap) };
        if (!(range.q10! <= range.q50! && range.q50! <= range.q90!)) throw new RangeError('range conflict');
      }
      const notes: ('too_few' | 'stale' | 'warm_unavailable')[] = [];
      if (local.state === 'too_few') notes.push('too_few');
      if (local.comps.length && !local.comps.some(c => c.age_days <= params.recent_days)) notes.push('stale');
      return { ...range, basis_level, notes, state: range.q10 === null || range.q90 === null ? 'hidden' : checked ? 'checked' : 'not_checked_yet',
        hide_reason: undefined,
        group: calibration?.group ?? null, share_shown: checked ? Math.floor(coverage! * 10) / 10 : null };
    };
    const range = finalRange(found, x.calibration);
    const cite = (local: typeof found, value: ReturnType<typeof finalRange>, site?: string) => {
      const rows: (BasisRow & { sold_at?: string; listed_at?: string; dated_by?: 'sold' | 'listed' })[] = value.state === 'hidden' ? [] : local.comps.map(c => ({
        id: c.comp_id, source: c.citation, at: c.sold_at, price_cents: c.adjusted_cents, weight: c.w,
        ...(c.dated_by === 'listed' ? { listed_at: c.listed_at ?? c.sold_at, dated_by: 'listed' as const }
          : { sold_at: c.sold_at, dated_by: 'sold' as const }),
      }));
      const weight = local.retail_weight;
      if (value.state !== 'hidden' && weight > 0 && x.retail_cents && x.retail_citation) {
        let id = `retail:${x.product_id}`;
        while (rows.some(row => row.id === id)) id += ':retail';
        rows.push({ id, source: x.retail_citation, at: x.as_of, price_cents: x.retail_cents, weight });
      }
      const bandUsed = value.q50 === null && value.q10 !== null && value.q90 !== null && warm;
      if (bandUsed) rows.push({ id: `band:${x.product_id}`, source: `family_band:${warm.basis}`, at: warm.as_of, price_cents: warm.low, weight: 1 });
      const proof = answer(value, rows, { metric: 'valuation', filters: { product_id: x.product_id, target, site, comps: rows, caps: { retail_cents: x.retail_cap_cents, live_ask_cents: x.live_ask_cap_cents }, warm: bandUsed ? warm : undefined, basis_level: value.basis_level, calibration: site ? sites.find(s => s.site === site)?.calibration ?? x.calibration : x.calibration },
        table_versions: [], definition_version: 'valuation.D1-D15', code_version: 'va-ablation-1',
        param_versions: { ...resolved.versions, ...params.param_versions }, model_version: null }, x.as_of);
      if (value.state !== 'hidden' && local.comps.length && !proof.ok) throw new CitationError('valuation missing basis');
      if (value.q10 !== null && value.q90 !== null && !proof.ok) throw new CitationError('valuation prior missing basis citation');
      return proof;
    };
    const proof = cite(found, range);
    const sold = snapshot.filter(c => c.dated_by !== 'listed' && Object.hasOwn(params.w_type, c.kind) && c.price_cents > 0 && (c.level === 'variant' || c.level === 'product'))
      .sort((a, b) => Number(b.level === 'variant') - Number(a.level === 'variant') || Date.parse(b.sold_at) - Date.parse(a.sold_at) || a.comp_id.localeCompare(b.comp_id));
    const last_sale = sold.map(latest => {
      const lastProof = answer(latest.price_cents, [{ id: latest.comp_id, source: latest.citation, at: latest.sold_at, price_cents: latest.price_cents }], {
        metric: 'last_sale', filters: { product_id: x.product_id, variant: x.variant, basis_level: latest.level }, table_versions: [],
        definition_version: 'credibility.C1', code_version: 'valuation.last_sale.1', param_versions: { ...resolved.versions, ...params.param_versions }, model_version: null,
      }, x.as_of, [], { basis_level: latest.level });
      return lastProof.ok ? { price_cents: latest.price_cents, sold_at: latest.sold_at,
        citation: lastProof.citation, basis_level: latest.level } : null;
    }).find(sale => sale !== null) ?? null;
    const modeCap = ceiling([], [], x.as_of);
    const modeSites = sites.map(s => {
      const local = comparables({ ...target, site: s.site }, snapshot, x.as_of, params);
      try {
        const band = finalRange(local, s.calibration ?? x.calibration);
        if (uncitableSites.has(s.site) && !snapshot.some(c => c.site === s.site)) {
          return { ...s, local, band: { ...band, q10: null, q50: null, q90: null, state: 'hidden', share_shown: null, hide_reason: 'no_citation' }, citation: null };
        }
        const proof = cite(local, band, s.site);
        return { ...s, local, band, citation: proof.ok ? proof.citation : null };
      } catch (error) {
        if (!(error instanceof CitationError)) throw error;
        x.log.error('valuation.check.site_citation', error);
        return { ...s, local, band: { q10: null, q50: null, q90: null, state: 'hidden', share_shown: null,
          basis_level: local.basis_level, notes: range.notes, group: s.calibration?.group ?? x.calibration?.group ?? null, hide_reason: 'no_citation' }, citation: null };
      }
    });
    const mode = (choice: keyof Modes): Mode | null => {
      const per_site = modeSites.flatMap(({ local, band, ...s }) => {
        if (local.state !== 'ok' || band.q50 === null) return [];
        const point = pointOnSite({ ...s, top: [], offer_discount: 0,
          sold: local.comps.map(c => ({ price_cents: c.adjusted_cents, w: c.w, sold_at: c.sold_at })) },
        MARKS[planOf(choice).objective], x.floor_cents, modeCap);
        return point ? [point] : [];
      });
      const best = per_site.reduce<Point | null>((best, point) => !best || point.keep_cents > best.keep_cents ? point : best, null);
      return best ? { ...best, per_site } : null;
    };
    const fast = mode('fast'), sell = mode('sell'), best = mode('best');
    const modes: Modes | null = !x.recalled && found.state === 'ok' && fast && sell && best ? { fast, sell, best } : null;
    const per_site = modeSites.map(({ local, band, citation, ...s }) => {
      const p = band.q50;
      const kept = keep(s.site, p ?? band.q10 ?? 0, s.sale);
      const evidence = s.curve_evidence;
      const curve = s.curve;
      const curveOK = !!curve && !!evidence && Number.isSafeInteger(evidence.n) && evidence.n >= values.valuation_curve_min_events &&
        Number.isFinite(evidence.calibration_error) && evidence.calibration_error >= 0 && evidence.calibration_error <= values.valuation_curve_max_error && !!evidence.citation;
      const checkedCurve: Curve | null = curve ? {
        p: (price, days) => { const v = curve.p(price, days); if (!Number.isFinite(v) || v < 0 || v > 1) throw new RangeError('curve probability'); return v; },
        t: (price, q) => { const v = curve.t(price, q); if (v !== null && (!Number.isFinite(v) || v < 0)) throw new RangeError('curve days'); return v; },
      } : null;
      return { site: s.site, ...band, translated: local.comps.some(c => c.site !== s.site),
        citation, curve_checked: curveOK,
        fees_may_have_changed: kept.fees_may_have_changed,
        keep_q10: band.q10 === null ? null : keep(s.site, band.q10, s.sale).keep_cents,
        keep_q50: p === null ? null : kept.keep_cents,
        keep_q90: band.q90 === null ? null : keep(s.site, band.q90, s.sale).keep_cents,
        p_sale: p === null || !checkedCurve ? null : { d7: checkedCurve.p(p, 7), d30: checkedCurve.p(p, 30), d90: checkedCurve.p(p, 90) },
        days: p === null || !checkedCurve ? null : { t25: checkedCurve.t(p, .25), t50: checkedCurve.t(p, .5), t75: checkedCurve.t(p, .75) },
        path: p === null || x.recalled || !checkedCurve || local.state !== 'ok' || cap < x.floor_cents ? null : pricePath({ site: s.site,
          rungs: ladder(local.comps.map(c => c.adjusted_cents), local.comps.map(c => c.w)).filter(p => p >= x.floor_cents && p <= cap).concat(x.floor_cents).filter((p, i, all) => p > 0 && all.indexOf(p) === i).sort((a, b) => b - a),
          curve: checkedCurve, objective: x.objective, sale: s.sale, person_floor_cents: x.floor_cents, q90_cents: Math.min(cap, band.q90 ?? x.floor_cents) }),
      };
    });
    const ranked = per_site.filter(s => s.path && s.path.expected_keep > 0).sort((a, b) => b.path!.expected_keep - a.path!.expected_keep || (b.p_sale?.d30 ?? 0) - (a.p_sale?.d30 ?? 0) || a.site.localeCompare(b.site));
    const chosen: typeof ranked = [];
    let unsold = 1;
    for (const s of ranked) {
      if (chosen.length && (chosen[0].days?.t50 ?? Infinity) < values.valuation_hot_days) break;
      const config = sites.find(c => c.site === s.site)!;
      const windowChance = (site: typeof s) => {
        const c = sites.find(c => c.site === site.site)!;
        const minutes = (site.days?.t50 ?? 0) * 1440; // Fixed minutes per day.
        return c.delist_minutes === undefined || minutes <= 0 ? null : 1 - Math.exp(-c.delist_minutes / minutes);
      };
      const risk = windowChance(s), others = chosen.map(windowChance);
      if (chosen.length && (config.cancel_cost_cents === undefined || risk === null || others.includes(null))) continue;
      const P = s.p_sale!.d30;
      const double = chosen.length ? (1 - unsold) * risk! + P * others.reduce<number>((a, b) => a + b!, 0) : 0;
      const gain = unsold * P * s.keep_q50! - double * (config.cancel_cost_cents ?? 0);
      if (gain > 0) { chosen.push(s); unsold *= 1 - P; }
    }
    const path = chosen[0]?.path ?? null;
    const price_path = path && { ...path, curve_checked: chosen[0].curve_checked, start: Math.min(path.start, cap), list: Math.min(path.list, cap), always_accept: Math.min(path.always_accept, cap), ladder: path.ladder.filter(r => r.price >= path.floor && r.price <= cap) };
    return { product_id: x.product_id, variant: x.variant, condition: x.condition, as_of: x.as_of,
      basis_level: range.basis_level, notes: range.notes, last_sale,
      fast: warm ?? null, comps: found.comps, n_eff: found.n_eff, range, per_site: per_site.map(({ path: _path, ...s }) => s),
      best_sites: chosen.map(s => s.site), curve_checked: chosen.length > 0 && chosen.every(s => s.curve_checked), price_path, modes, param_version: x.param_version, param_versions: resolved.versions, partial,
      observation_snapshot: snapshot,
      basis: range.q50 === null && range.q10 !== null && warm ? { count: warm.n, oldest: warm.as_of, newest: warm.as_of, sources: [warm.basis] } : proof.ok ? proof.basis : { count: 0, oldest: null, newest: null, sources: [] },
      citation: proof.ok ? proof.citation : null };
  });
}
