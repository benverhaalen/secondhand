import levers from '../../../../research/list/ben/levers/levers.json' with { type: 'json' };
import { buildListing, type ItemCard } from '../listing/build.ts';
import { weightedPercentile, HORIZON_DAYS, type Objective, type Curve } from '../valuation/path.ts';
import { answer, type BasisRow } from '../proof/proof.ts';
import type { ParamStore } from '../param/param.ts';
import { fact } from '../../../../spec/sites.mjs';

export type Site = keyof typeof levers.sites;
export type MoneyCandidate = {
  candidate_id: string; objective: Objective; horizon_days: 7 | 30 | 90;
  shipping_mode: 'buyer_pays' | 'free' | 'pickup';
  path: { price_cents: number; p_sale: number; net_cents: number; at_day: number }[];
  expected_days: number;
};
export type MarketingInput = {
  item: ItemCard; site: Site; connected: boolean; category_allowed: boolean; fit: 'good' | 'avoid'; category_id: string;
  rows: Parameters<typeof buildListing>[2]['rows']; objective: Objective; floor_cents: number; midpoint_cents: number;
  adjusted_cents: number[]; weights: number[]; sales_12m: number; sales_90d: number;
  curve: Curve; keep: (price: number, shipping_mode: MoneyCandidate['shipping_mode']) => number;
  shipping_modes: MoneyCandidate['shipping_mode'][]; ship_cents: number; candidates?: MoneyCandidate[];
  presentation?: { visibility: number; views: number; comp_views: number; cover_id: string; cover_style?: string; title_form: string }[];
  requested_levers?: string[]; comp_rows: BasisRow[]; as_of: string; params: ParamStore;
  person?: string; cover_style: string; position: [number, number]; shipping_discount_cents?: number; timing?: { n: number; peak_at: string; lift: number; noise: number };
  promotion?: { rate: number; lift_lb: number; approved: boolean };
  log: { timed: <T>(name: string, fn: () => T) => T };
};

export function sourcedLever(site: Site, id: string, rows: { id: string; source: string }[] = levers.sites[site].levers) {
  const row = rows.find(l => l.id === id);
  if (!row) throw new Error(`forbidden lever ${id} on ${site}`);
  if (!row.source.trim()) throw new Error(`lever ${id} missing source`);
  return row;
}

// Inputs are mutually exclusive step probabilities, not conditional hazards.
export function scoreCandidate(k: MoneyCandidate, visibility: number, holding_cost: number, curve?: Curve) {
  if (!k.path.length || k.expected_days < 0 || k.expected_days > k.horizon_days || !Number.isFinite(k.expected_days)) throw new RangeError('invalid candidate path');
  let survival = 1, adjusted_survival = 1, expected = 0;
  for (const step of k.path) {
    if (!Number.isFinite(step.p_sale) || step.p_sale < 0 || step.p_sale > survival + 1e-9 || !Number.isFinite(step.net_cents)) throw new RangeError('invalid sale probability or net');
    const conditional = survival > 0 ? Math.min(1, step.p_sale / survival) : 0;
    const adjusted = 1 - (1 - conditional) ** visibility;
    expected += adjusted_survival * adjusted * step.net_cents;
    survival -= step.p_sale; adjusted_survival *= 1 - adjusted;
  }
  if (!Number.isFinite(visibility) || visibility <= 0) throw new RangeError('invalid visibility');
  if (visibility !== 1 && !curve) throw new Error('visibility time requires a survival curve');
  let expected_days = k.expected_days;
  if (visibility !== 1 && curve) {
    expected_days = 0;
    for (let d = 0; d < k.horizon_days; d++) expected_days += survivalAt(k, curve, d) ** visibility;
  }
  return { e_net_cents: Math.round(expected), utility_cents: Math.round(expected - holding_cost * expected_days), p_sale: 1 - adjusted_survival, expected_days };
}

function survivalAt(k: MoneyCandidate, curve: Curve, day: number): number {
  let survival = 1;
  for (const [i, step] of k.path.entries()) {
    if (day <= step.at_day) break;
    const duration = Math.min(day, k.path[i + 1]?.at_day ?? day) - step.at_day;
    const p = curve.p(step.price_cents, duration);
    if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('invalid curve probability');
    survival *= 1 - p;
  }
  return survival;
}

function daysAt(k: MoneyCandidate, curve: Curve, q: number, visibility: number): number | null {
  if (1 - survivalAt(k, curve, 90) ** visibility < q) return null;
  let lo = 0, hi = 90;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (1 - survivalAt(k, curve, mid) ** visibility >= q) hi = mid; else lo = mid;
  }
  return hi;
}

function candidates(x: MarketingInput): MoneyCandidate[] {
  const out: MoneyCandidate[] = [];
  const rungs = Array.from({ length: 17 }, (_, i) => Math.round(weightedPercentile(x.adjusted_cents, x.weights, .1 + i * .05)));
  for (const objective of Object.keys(HORIZON_DAYS) as Objective[]) {
    const horizon_days = HORIZON_DAYS[objective] as 7 | 30 | 90;
    for (const mode of x.shipping_modes) for (const start of [...new Set(rungs)]) {
      const path: MoneyCandidate['path'] = [];
      let survival = 1, day = 0, expected_days = 0;
      const prices = [...new Set(rungs.filter(p => p <= start && p >= x.floor_cents))].sort((a, b) => b - a);
      for (const [index, price] of prices.entries()) {
        if (day >= horizon_days) break;
        const hold = index === prices.length - 1 ? horizon_days - day : Math.min(horizon_days - day, x.curve.t(price, .5) ?? horizon_days);
        if (hold <= 0 || !Number.isFinite(hold)) throw new RangeError('invalid curve duration');
        const p = x.curve.p(price, hold);
        if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('invalid curve probability');
        // Integrate restricted mean survival at daily resolution; a final fractional day stays on the same rung.
        for (let t = 0; t < hold; t += 1) expected_days += survival * (1 - x.curve.p(price, t)) * Math.min(1, hold - t);
        path.push({ price_cents: price, p_sale: survival * p, net_cents: x.keep(price, mode), at_day: day });
        survival *= 1 - p; day += hold;
      }
      expected_days += survival * (horizon_days - day);
      if (path.length) out.push({ candidate_id: `${objective}:${mode}:${start}`, objective, horizon_days, shipping_mode: mode, path, expected_days });
    }
  }
  return out;
}

export function calculate(x: MarketingInput) {
  return x.log.timed('marketing.calculate', () => {
    if (!Number.isSafeInteger(x.floor_cents) || x.floor_cents < 0) throw new RangeError('invalid floor');
    if (!x.cover_style?.trim() || x.position.length !== 2 || !x.position.every(p => Number.isFinite(p) && p > 0) || x.position[0] > x.position[1]) throw new Error('presentation missing basis');
    for (const id of x.requested_levers ?? []) sourcedLever(x.site, id);
    const skip = (skip_reason: string) => ({ item_id: x.item.item_id, site: x.site, verdict: 'skip' as const, skip_reason, price: null, standing: null });
    if (!x.connected) return skip('not_connected');
    if (x.item.recall_flag) return skip('recall_or_legal_flag');
    if (!x.category_allowed) return skip('site_bars_category');
    if (x.fit === 'avoid') return skip('fit_avoid');
    if (x.sales_12m < 6 && x.sales_90d < 2) return skip('too_few');
    if (!x.adjusted_cents.length || x.adjusted_cents.length !== x.weights.length || x.weights.some(w => !Number.isFinite(w) || w <= 0)) throw new RangeError('invalid comps');
    const scope = { site: x.site, ...(x.person && { person: x.person }) };
    const priors = { vis_exponent: .5, holding_cost_balanced: .002, holding_cost_quick: .01, p_min_quick: .6, p_min_balanced: .4 };
    const versions: Record<string, number> = {};
    const read = (name: keyof typeof priors) => {
      x.params.declare({ name, family: 'scalar', prior: priors[name] });
      const r = x.params.read(name, scope); versions[name] = r.version;
      if (typeof r.value !== 'number' || !Number.isFinite(r.value)) throw new TypeError(`invalid param ${name}`);
      return r.value;
    };
    const exponent = read('vis_exponent');
    const costs = { quick: read('holding_cost_quick') * x.midpoint_cents, balanced: read('holding_cost_balanced') * x.midpoint_cents, max_return: 0 };
    const minimum = { quick: read('p_min_quick'), balanced: read('p_min_balanced'), max_return: 0 };
    const presentation = x.presentation?.slice().sort((a, b) => b.visibility - a.visibility)[0];
    const multiplier = presentation ? Math.max(.5, Math.min(2, (presentation.views / presentation.comp_views) ** exponent)) : 1;
    if (!Number.isFinite(multiplier)) throw new RangeError('invalid visibility basis');
    const scored = (x.candidates ?? candidates(x)).filter(k => k.path.length && k.path.every(r => Number.isSafeInteger(r.price_cents) && r.price_cents >= x.floor_cents) && x.shipping_modes.includes(k.shipping_mode))
      .map(k => ({ ...k, ...scoreCandidate(k, multiplier, costs[k.objective], x.curve) })).filter(k => k.p_sale >= minimum[k.objective]);
    const sorted = (objective: Objective) => scored.filter(k => k.objective === objective).sort((a, b) => b.utility_cents - a.utility_cents || b.p_sale - a.p_sale || a.path[0].price_cents - b.path[0].price_cents);
    const winner = sorted(x.objective)[0];
    if (!winner || winner.utility_cents <= 0) return skip('negative_value');
    const proof = answer(winner.utility_cents, x.comp_rows, { metric: 'marketing.utility', filters: { item_id: x.item.item_id, site: x.site }, table_versions: [], definition_version: 'marketing.3', code_version: 'mk-1', param_versions: versions, model_version: null }, x.as_of);
    if (!proof.ok) throw new Error('marketing plan missing basis');
    const start = winner.path[0].price_cents;
    const draft = buildListing(x.item, x.site, { rows: x.rows, price_cents: start, floor_cents: x.floor_cents, posted_before: false, promoted: false });
    const minDiscount = fact('offer.seller.min_off_pct', x.site);
    const offer = minDiscount === null ? null : Math.min(winner.path[1]?.price_cents ?? start, Math.floor(start * (1 - Number(minDiscount) / 100)));
    const likersRule = levers.sites[x.site].rules.likers_offer as { min_discount: number; shipping_discount_required?: boolean } | null;
    const shippingReady = !likersRule?.shipping_discount_required || (Number.isSafeInteger(x.shipping_discount_cents) && x.shipping_discount_cents! > 0 && x.shipping_discount_cents! <= x.ship_cents);
    const offerOn = offer !== null && offer >= x.floor_cents && shippingReady;
    const promotion = x.promotion;
    const net = winner.path[0].net_cents;
    const promoOn = !!promotion?.approved && net > 0 && promotion.lift_lb > 1 / (1 - promotion.rate * start / net) && promotion.rate * start < net;
    const list_at = x.timing && x.timing.n >= 200 && x.timing.lift > x.timing.noise && Date.parse(x.timing.peak_at) - Date.parse(x.as_of) <= 72 * 3600e3 && Date.parse(x.timing.peak_at) >= Date.parse(x.as_of) ? x.timing.peak_at : x.as_of;
    const attributes = x.rows.flatMap(row => {
      const name = row.site_names[x.site]?.name, attr = x.item.attrs[row.field];
      if (!name || !attr || draft.fields[name] === undefined) return [];
      const source = attr.source === 'you_said' ? 'asked' : attr.source === 'label' || attr.source === 'measured' ? 'evidence' : 'fact';
      return [{ name, value: draft.fields[name], source }];
    });
    return { item_id: x.item.item_id, site: x.site, verdict: 'list' as const, skip_reason: undefined, objective: x.objective,
      price: { start_cents: start, floor_cents: x.floor_cents, horizon_days: winner.horizon_days, path: winner.path.map(r => ({ at: new Date(Date.parse(x.as_of) + r.at_day * 86400e3).toISOString(), price_cents: r.price_cents })) },
      title: { text: draft.title, form: presentation?.title_form ?? 'site_template', slots: [] }, attributes, category_id: x.category_id,
      photos: { order: draft.photo_ids, cover_id: presentation?.cover_id ?? draft.photo_ids[0] ?? null, cover_style: presentation?.cover_style ?? x.cover_style },
      shipping: { mode: winner.shipping_mode, ship_cents: x.ship_cents, price_includes_ship: winner.shipping_mode === 'free' }, list_at,
      promotion: { on: promoOn, ...(promotion && { rate: promotion.rate, lift_lb: promotion.lift_lb }), ask: !!promotion && !promotion.approved },
      standing: { offers_to_likers: { on: offerOn, amount_cents: offerOn ? offer : null, shipping_discount_cents: offerOn ? x.shipping_discount_cents ?? 0 : 0, discount: minDiscount === null ? 0 : Number(minDiscount) / 100, cooldown_days: 7 }, price_steps: 'path' as const, refresh: { on: false }, relist: { allowed: !fact('relist.penalized', x.site) }, bundle: { on: true, max_discount: 1 - x.floor_cents / start } },
      scores: { position: x.position, e_net_cents: winner.e_net_cents, utility_cents: winner.utility_cents, p_sale: { d7: winner.horizon_days === 7 ? winner.p_sale : 1 - survivalAt(winner, x.curve, 7) ** multiplier, d30: winner.horizon_days === 30 ? winner.p_sale : 1 - survivalAt(winner, x.curve, 30) ** multiplier, d90: winner.horizon_days === 90 ? winner.p_sale : 1 - survivalAt(winner, x.curve, 90) ** multiplier }, tts_days: [daysAt(winner, x.curve, .25, multiplier), daysAt(winner, x.curve, .75, multiplier)] },
      alternatives: (Object.keys(costs) as Objective[]).filter(o => o !== x.objective).flatMap(o => sorted(o).slice(0, 1)).map(k => ({ candidate_id: k.candidate_id, objective: k.objective, e_net_cents: k.e_net_cents, p_sale_d30: k.horizon_days === 30 ? k.p_sale : 1 - survivalAt(k, x.curve, 30) ** multiplier, tts_days: [daysAt(k, x.curve, .25, multiplier), daysAt(k, x.curve, .75, multiplier)] })),
      comp_set: { ids: proof.basis.ids, as_of: x.as_of, fingerprint: proof.citation.basis_hash }, citation_id: proof.citation.id, citation: proof.citation, param_versions: versions, preselected: true };
  });
}
