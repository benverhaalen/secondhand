import levers from '../../../../research/list/ben/levers/levers.json' with { type: 'json' };
import { buildListing, type ItemCard } from '../listing/build.ts';
import { BASIS_LEVELS, basisLevel, type BasisLevel } from '../listing/basis.ts';
import { ladder, HORIZON_DAYS, type Objective, type Curve } from '../valuation/path.ts';
import { answer, guard, basisHash, basisOf, PROOF_PARAMS, type BasisRow } from '../proof/proof.ts';
import { memoryStore, type ParamStore } from '../param/param.ts';
import { fact, FACTS, UNKNOWN } from '../../../../spec/sites.mjs';

import { resolve, scalar } from './params.ts';
import { money, rounded } from './money.ts';
import type { EndingRule } from '../money/ending.ts';
import { roundToEnding } from '../money/ending.ts';

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
  basis_level?: BasisLevel; kind_rung_cents?: number;
  curve: Curve; keep: (price: number, shipping_mode: MoneyCandidate['shipping_mode']) => number;
  shipping_modes: MoneyCandidate['shipping_mode'][]; ship_cents: number; candidates?: MoneyCandidate[];
  presentation?: { visibility: number; views: number; comp_views: number; cover_id: string; cover_style?: string; title_form: string }[];
  metric_basis?: Partial<Record<'position' | 'shipping' | 'sale_curve' | 'time' | 'alternatives', BasisRow[]>>;
  requested_levers?: string[]; comp_rows: BasisRow[]; as_of: string; params?: ParamStore; ending?: EndingRule; drift?: number;
  resolved?: ReturnType<typeof resolve>; person?: string; cover_style: string; position: [number, number]; shipping_discount_cents?: number; timing?: { n: number; peak_at: string; lift: number; noise: number };
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
  if (!Number.isFinite(holding_cost) || holding_cost < 0) throw new RangeError('holding_cost must be finite and nonnegative');
  if (!k.path.length || k.expected_days < 0 || k.expected_days > k.horizon_days || !Number.isFinite(k.expected_days)) throw new RangeError('invalid candidate path');
  let previous = -1;
  for (const step of k.path) {
    money(step.price_cents, 'price_cents'); money(step.net_cents, 'net_cents');
    if (!Number.isFinite(step.at_day) || step.at_day < 0 || step.at_day <= previous || step.at_day >= k.horizon_days) throw new RangeError('at_day must increase inside horizon');
    previous = step.at_day;
  }
  if (k.path[0].at_day !== 0) throw new RangeError('at_day must start at zero');
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
  return { e_net_cents: rounded(expected, 'e_net_cents'), utility_cents: rounded(expected - holding_cost * expected_days, 'utility_cents'), p_sale: 1 - adjusted_survival, expected_days };
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
  let lo = 0, hi = 90; // Fixed: D11 defines time-to-sale only through 90 days.
  for (let i = 0; i < 40; i++) { // Fixed: bisection precision, not a learned strategy weight.
    const mid = (lo + hi) / 2;
    if (1 - survivalAt(k, curve, mid) ** visibility >= q) hi = mid; else lo = mid;
  }
  return hi;
}

function candidates(x: MarketingInput, blend_weight: number, kind_rung_cents: number): MoneyCandidate[] {
  const out: MoneyCandidate[] = [];
  const local = ladder(x.adjusted_cents, x.weights, x.ending, x.drift);
  const rungs = [...new Set((local.length ? local : [kind_rung_cents]).map(price =>
    Math.max(x.floor_cents, roundToEnding(rounded(blend_weight * price + (1 - blend_weight) * kind_rung_cents, 'price_cents'), x.ending) ?? kind_rung_cents)))].sort((a,b) => b-a);
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

function pooledCandidate(x: MarketingInput, k: MoneyCandidate, blend_weight: number, kind_rung_cents: number): MoneyCandidate {
  scoreCandidate(k, 1, 0);
  let survival = 1, expected_days = 0;
  const path = k.path.map((step, i) => {
    const price_cents = Math.max(x.floor_cents, roundToEnding(rounded(blend_weight * step.price_cents + (1 - blend_weight) * kind_rung_cents, 'price_cents'), x.ending) ?? kind_rung_cents);
    const hold = (k.path[i + 1]?.at_day ?? k.horizon_days) - step.at_day;
    for (let t = 0; t < hold; t += 1) expected_days += survival * (1 - x.curve.p(price_cents, t)) * Math.min(1, hold - t);
    const p = x.curve.p(price_cents, hold);
    if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('invalid curve probability');
    const p_sale = survival * p;
    survival *= 1 - p;
    return {...step, price_cents, net_cents:x.keep(price_cents,k.shipping_mode), p_sale};
  });
  return {...k, path, expected_days};
}

export function calculate(x: MarketingInput) {
  return x.log.timed('marketing.calculate', () => {
    if (!Number.isFinite(Date.parse(x.as_of))) throw new RangeError('invalid as_of');
    for (const name of ['ship_cents', 'shipping_discount_cents'] as const) {
      const value = x[name];
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new RangeError(`${name} must be whole cents, zero or more`);
    }
    money(x.floor_cents, 'floor_cents'); money(x.midpoint_cents, 'midpoint_cents');
    const basis_level = basisLevel(x.basis_level);
    const kind_rung_cents = x.kind_rung_cents ?? x.midpoint_cents;
    money(kind_rung_cents, 'kind_rung_cents');
    x.adjusted_cents.forEach(value => money(value, 'adjusted_cents'));
    if (x.drift !== undefined && !Number.isFinite(x.drift)) throw new RangeError('invalid drift');
    if (!x.cover_style?.trim() || x.position.length !== 2 || !x.position.every(p => Number.isFinite(p) && p > 0) || x.position[0] > x.position[1]) throw new Error('presentation missing basis');
    for (const id of x.requested_levers ?? []) if (!(x.site === 'poshmark' && ['share', 'like', 'repost', 'save', 'relist'].includes(id))) sourcedLever(x.site, id);
    const skip = (skip_reason: string) => ({ item_id: x.item.item_id, site: x.site, verdict: 'skip' as const, skip_reason, price: null, standing: null });
    if (!x.connected) return skip('not_connected');
    if (x.item.recall_flag) return skip('recall_or_legal_flag');
    if (!x.category_allowed) return skip('site_bars_category');
    if (x.fit === 'avoid') return skip('fit_avoid');
    if (x.adjusted_cents.length !== x.weights.length || x.weights.some(w => !Number.isFinite(w) || w <= 0)) throw new RangeError('invalid comps');
    const store = x.params ?? memoryStore();
    const {values, versions} = x.resolved ?? resolve(store, { site: x.site, segment: x.category_id, person: x.person });
    const read = (name: string) => scalar(values, `marketing_${name}`);
    const n_eff = x.weights.length ? basisOf(x.weights.map((weight, i) => ({id:String(i),source:'adjusted_comp',at:x.as_of,weight})), x.as_of, []).n_eff : 0;
    const blend_weight = n_eff / (n_eff + read('blend_k'));
    const exponent = read('vis_exponent');
    const costs = { quick: read('holding_cost_quick') * x.midpoint_cents, balanced: read('holding_cost_balanced') * x.midpoint_cents, max_return: read('holding_cost_max_return') * x.midpoint_cents };
    const minimum = { quick: read('p_min_quick'), balanced: read('p_min_balanced'), max_return: read('p_min_max_return') };
    const presentation = x.presentation?.slice().sort((a, b) => b.visibility - a.visibility || a.cover_id.localeCompare(b.cover_id) || a.title_form.localeCompare(b.title_form) || (a.cover_style ?? '').localeCompare(b.cover_style ?? '') || a.views - b.views || a.comp_views - b.comp_views)[0];
    if (presentation && (!Number.isFinite(presentation.comp_views) || presentation.comp_views <= 0 || !Number.isFinite(presentation.views) || presentation.views < 0 || !Number.isFinite(presentation.visibility))) throw new RangeError('invalid views or comp_views basis');
    const lo = read('visibility_lo'), hi = read('visibility_hi');
    if (lo <= 0 || lo > hi) throw new RangeError('invalid visibility guard band');
    const multiplier = presentation ? Math.max(lo, Math.min(hi, (presentation.views / presentation.comp_views) ** exponent)) : 1;
    const rules: Record<string, number> = {};
    for (const entry of PROOF_PARAMS) {
      store.declare(entry);
      const r = store.read(entry.name, {site: x.site});
      if (typeof r.value !== 'number' || !Number.isFinite(r.value) || r.value < 0) throw new RangeError(`invalid ${entry.name}`);
      rules[entry.name] = r.value; versions[entry.name] = r.version;
    }
    const guardRules = {min_n_eff: rules.proof_min_n_eff, max_age_days: rules.proof_max_age_days};
    const options = x.candidates ?? candidates(x, blend_weight, kind_rung_cents);
    for (const candidate of options) for (const step of candidate.path) { money(step.price_cents, 'price_cents'); money(step.net_cents, 'net_cents'); }
    const scored = options.filter(k => k.path.length && k.path.every(r => Number.isSafeInteger(r.price_cents) && r.price_cents >= x.floor_cents) && x.shipping_modes.includes(k.shipping_mode))
      .map(k => x.candidates ? pooledCandidate(x,k,blend_weight,kind_rung_cents) : k)
      .map(k => ({ ...k, ...scoreCandidate(k, multiplier, costs[k.objective], x.curve) }));
    const sorted = (objective: Objective) => {
      const positive = scored.filter(k => k.objective === objective && k.utility_cents > 0);
      const preferred = positive.filter(k => k.p_sale >= minimum[objective]);
      return (preferred.length ? preferred : positive).sort((a, b) => b.utility_cents - a.utility_cents || b.p_sale - a.p_sale || a.path[0].price_cents - b.path[0].price_cents || a.candidate_id.localeCompare(b.candidate_id));
    };
    const winner = sorted(x.objective)[0];
    if (!winner || winner.utility_cents <= 0) return skip('negative_value');
    const inputs = x.metric_basis;
    const groupsFor = (name: string): BasisRow[][] => {
      const groups = name === 'position' ? [inputs?.position ?? []]
        : name === 'shipping' ? [inputs?.shipping ?? []]
        : name.includes('tts') ? [inputs?.sale_curve ?? [], inputs?.time ?? []]
        : name.includes('p_sale') ? [inputs?.sale_curve ?? []]
        : [x.comp_rows, inputs?.sale_curve ?? [], inputs?.shipping ?? [], inputs?.time ?? []];
      return name.startsWith('alternative.') ? [...groups, inputs?.alternatives ?? []] : groups;
    };
    const proofRows = groupsFor('utility').flat();
    const citationInput = { metric: 'marketing.utility', filters: { item_id: x.item.item_id, site: x.site, basis_level, kind_rung_cents, blend_weight }, table_versions: [], definition_version: 'marketing.4', code_version: 'mk-1', param_versions: versions, model_version: null };
    const proof = answer(winner.utility_cents, proofRows, citationInput, x.as_of);
    if (!proof.ok && proofRows.length) throw new Error('marketing plan missing basis');
    const metric = (name: string, value: number | {lo:number; hi:number}) => {
      if (typeof value === 'number' ? !Number.isFinite(value) : !Number.isFinite(value.lo) || !Number.isFinite(value.hi)) throw new RangeError(`invalid metric ${name}`);
      const groups = groupsFor(name);
      const result = answer(value, groups.flat(), {...citationInput, metric: `marketing.${name}`}, x.as_of);
      if (result.ok) result.citation.id += `:${name}`;
      const checked = guard(result,guardRules);
      const failed = groups.map(rows => guard(answer(0,rows,{...citationInput,metric:`marketing.${name}.input`},x.as_of),guardRules)).find(g => g.state === 'hidden');
      return { ...checked,...(failed ? {state:'hidden' as const,hide_reason:failed.hide_reason} : {}), citation: result.ok ? result.citation : null };
    };
    const positionProof = metric('position', {lo:x.position[0],hi:x.position[1]});
    const start = winner.path[0].price_cents;
    const prices = x.adjusted_cents.length ? x.adjusted_cents : [kind_rung_cents];
    const low = prices.reduce((a,b) => Math.min(a,b)), high = prices.reduce((a,b) => Math.max(a,b));
    // Agent proposal: broaden the observed span by the unpooled share and each fallback step.
    const margin = rounded(Math.max(high - low, kind_rung_cents) * (1 - blend_weight + BASIS_LEVELS.indexOf(basis_level)), 'spread_cents');
    const spread_cents = {lo: Math.max(x.floor_cents, Math.min(start, low) - margin), hi: rounded(Math.max(start, high) + margin, 'spread_cents')};
    const draft = buildListing(x.item, x.site, { rows: x.rows, price_cents: start, floor_cents: x.floor_cents, posted_before: false, promoted: false });
    const minDiscount = fact('offer.seller.min_off_pct', x.site);
    const offer = minDiscount === null ? null : Math.min(winner.path[1]?.price_cents ?? start, Math.floor(start * (1 - Number(minDiscount) / 100)));
    const likersRule = levers.sites[x.site].rules.likers_offer as { min_discount: number; shipping_discount_required?: boolean } | null;
    const shippingReady = !likersRule?.shipping_discount_required || (Number.isSafeInteger(x.shipping_discount_cents) && x.shipping_discount_cents! > 0 && x.shipping_discount_cents! <= x.ship_cents);
    const repeat = FACTS['offer.seller.repeat_h'][x.site].v;
    const cooldown_days = repeat === UNKNOWN ? 'unknown' as const : repeat === null ? null : Math.ceil(Number(fact('offer.seller.repeat_h', x.site)) / 24); // Fixed: 24 hours per day; unknown is not no wait.
    const offerOn = repeat !== UNKNOWN && offer !== null && offer >= x.floor_cents && shippingReady && money(x.keep(offer, winner.shipping_mode), 'offer_keep_cents') - (x.shipping_discount_cents ?? 0) >= money(x.keep(x.floor_cents, winner.shipping_mode), 'floor_keep_cents');
    const promotion = x.promotion;
    const net = winner.path[0].net_cents;
    const promoOn = !!promotion?.approved && net > 0 && promotion.lift_lb > 1 / (1 - promotion.rate * start / net) && promotion.rate * start < net;
    const list_at = x.timing && x.timing.n >= read('timing_min_n') && x.timing.lift > x.timing.noise && Date.parse(x.timing.peak_at) - Date.parse(x.as_of) <= read('timing_horizon_h') * 3600e3 && Date.parse(x.timing.peak_at) >= Date.parse(x.as_of) ? x.timing.peak_at : x.as_of;
    const attributes = x.rows.flatMap(row => {
      const name = row.site_names[x.site]?.name, attr = x.item.attrs[row.field];
      if (!name || !attr || draft.fields[name] === undefined) return [];
      const source = attr.source === 'you_said' ? 'asked' : attr.source === 'label' || attr.source === 'measured' ? 'evidence' : 'fact';
      return [{ name, value: draft.fields[name], source }];
    });
    const suggestions = x.site === 'poshmark' ? [...new Set((x.requested_levers ?? []).map(id => id === 'save' ? 'like' : id === 'relist' ? 'repost' : id))].filter(id => ['share', 'like', 'repost'].includes(id)).sort().map(kind => ({kind, site: 'poshmark' as const, reason: kind === 'share' ? 'Show this listing to your followers.' : kind === 'like' ? 'Save this listing to revisit it.' : 'Offer this item again with a new listing.', handoff: true as const})) : [];
    return { suggestions, item_id: x.item.item_id, site: x.site, verdict: 'list' as const, skip_reason: undefined, objective: x.objective, basis_level, blend_weight,
      price: { start_cents: start, floor_cents: x.floor_cents, horizon_days: winner.horizon_days, spread_cents, path: winner.path.map(r => ({ at: new Date(Date.parse(x.as_of) + r.at_day * 86400e3).toISOString(), price_cents: r.price_cents })) },
      title: { text: draft.title, form: presentation?.title_form ?? 'site_template', slots: [] }, attributes, category_id: x.category_id,
      photos: { order: draft.photo_ids, cover_id: presentation?.cover_id ?? draft.photo_ids[0] ?? null, cover_style: presentation?.cover_style ?? x.cover_style },
      shipping: { mode: winner.shipping_mode, ship_cents: x.ship_cents, price_includes_ship: winner.shipping_mode === 'free' }, list_at,
      promotion: { on: promoOn, ...(promotion && { rate: promotion.rate, lift_lb: promotion.lift_lb }), ask: !!promotion && !promotion.approved },
      standing: { offers_to_likers: { on: offerOn, amount_cents: offerOn ? offer : null, shipping_discount_cents: offerOn ? x.shipping_discount_cents ?? 0 : 0, discount: minDiscount === null ? 0 : Number(minDiscount) / 100, cooldown_days }, price_steps: 'path' as const, refresh: { on: false }, relist: { allowed: x.site !== 'poshmark' && !fact('relist.penalized', x.site) }, bundle: { on: levers.sites[x.site].levers.some(l => l.id === 'bundle'), max_discount: 1 - x.floor_cents / start } },
      scores: { position: positionProof.state === 'shown' ? x.position : null, e_net_cents: winner.e_net_cents, utility_cents: winner.utility_cents, p_sale: { d7: winner.horizon_days === 7 ? winner.p_sale : 1 - survivalAt(winner, x.curve, 7) ** multiplier, d30: winner.horizon_days === 30 ? winner.p_sale : 1 - survivalAt(winner, x.curve, 30) ** multiplier, d90: winner.horizon_days === 90 ? winner.p_sale : 1 - survivalAt(winner, x.curve, 90) ** multiplier }, tts_days: [daysAt(winner, x.curve, .25, multiplier), daysAt(winner, x.curve, .75, multiplier)] },
      alternatives: (Object.keys(costs) as Objective[]).filter(o => o !== x.objective).flatMap(o => sorted(o).slice(0, 1)).filter(k => metric(`alternative.${k.candidate_id}.expected_keep`,k.e_net_cents).state === 'shown').map(k => ({ candidate_id: k.candidate_id, objective: k.objective, e_net_cents: k.e_net_cents, p_sale_d30: k.horizon_days === 30 ? k.p_sale : 1 - survivalAt(k, x.curve, 30) ** multiplier, tts_days: [daysAt(k, x.curve, .25, multiplier), daysAt(k, x.curve, .75, multiplier)] })),
      metrics: { utility_cents: metric('utility', winner.utility_cents), e_net_cents: metric('expected_keep', winner.e_net_cents), position: positionProof, ship_cents: metric('shipping', x.ship_cents),
        p_sale: Object.fromEntries([7,30,90].map(day => [day, metric(`p_sale.d${day}`, 1 - survivalAt(winner, x.curve, day) ** multiplier)])),
        tts_days: [daysAt(winner,x.curve,.25,multiplier),daysAt(winner,x.curve,.75,multiplier)].map((day,i) => day === null ? null : metric(`tts.${i}`,day)),
        alternatives: (Object.keys(costs) as Objective[]).filter(o => o !== x.objective).flatMap(o => sorted(o).slice(0,1)).map(k => ({candidate_id:k.candidate_id, e_net_cents:metric(`alternative.${k.candidate_id}.expected_keep`,k.e_net_cents), p_sale:metric(`alternative.${k.candidate_id}.p_sale`,1-survivalAt(k,x.curve,30)**multiplier), tts_days:[daysAt(k,x.curve,.25,multiplier),daysAt(k,x.curve,.75,multiplier)].map((day,i) => day === null ? null : metric(`alternative.${k.candidate_id}.tts.${i}`,day))})) },
      comp_set: { ids: x.comp_rows.map(row => row.id), as_of: x.as_of, fingerprint: basisHash(x.comp_rows) }, citation_id: proof.ok ? proof.citation.id : null, citation: proof.ok ? proof.citation : null, param_versions: versions, preselected: true };
  });
}
