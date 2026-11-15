// listing_swarm and available_now (spec/engines/intelligence-api.md §1 "Three protocols in full").
// The swarm's eight specialists start at once; the merge is a join by site in code, never a model.
import { dedupe, type Result } from './reconcile.ts';

export const SWARM_SPECIALISTS = ['identity', 'comps', 'winners', 'terms', 'photo_rules', 'rules_fees', 'demand', 'risk'] as const;
export type Specialist = typeof SWARM_SPECIALISTS[number];
export const SWARM_DEADLINE_MS: Record<Specialist, number> = { identity: 3000, comps: 10000, winners: 10000, terms: 10000, photo_rules: 1000, rules_fees: 1000, demand: 20000, risk: 5000 };

export interface SitePart { winners?: unknown[]; terms?: unknown[]; photo_rules?: unknown; rules?: unknown; fees?: unknown }
export interface Risk { blocks: Record<string, string>; flags: string[] } // blocks: site -> reason
export interface SwarmParts {
  identity?: { product_id: string; [k: string]: unknown }; comps?: unknown; demand?: unknown; risk?: Risk;
  per_site?: Partial<Record<Specialist, Record<string, unknown>>>; // specialist -> site -> its value
}
export interface SwarmResult {
  product_id: string | null; identity: unknown; comps: unknown; demand: unknown; risk: Risk | null;
  per_site: Record<string, SitePart & { blocked?: string }>;
  pending: Specialist[];
}

const SITE_FIELD: Partial<Record<Specialist, keyof SitePart>> = { winners: 'winners', terms: 'terms', photo_rules: 'photo_rules', rules_fees: 'rules' };

export function mergeSwarm(sites: readonly string[], parts: SwarmParts, pending: Specialist[] = []): SwarmResult {
  const per_site: SwarmResult['per_site'] = Object.fromEntries(sites.map(s => [s, {}]));
  for (const [spec, bySite] of Object.entries(parts.per_site ?? {}) as [Specialist, Record<string, unknown>][]) {
    for (const [site, v] of Object.entries(bySite ?? {})) {
      if (!per_site[site]) continue; // a site outside the plan is not invented
      if (spec === 'rules_fees' && typeof v === 'object' && v) { const o = v as { rules?: unknown; fees?: unknown }; per_site[site]!.rules = o.rules; per_site[site]!.fees = o.fees; }
      else if (SITE_FIELD[spec]) (per_site[site] as Record<string, unknown>)[SITE_FIELD[spec]!] = v;
    }
  }
  // A risk that blocks a site marks it before the marketing engine reads the result; it never plans a blocked site.
  for (const [site, why] of Object.entries(parts.risk?.blocks ?? {})) if (per_site[site]) per_site[site]!.blocked = why;
  return { product_id: parts.identity?.product_id ?? null, identity: parts.identity ?? null, comps: parts.comps ?? null,
    demand: parts.demand ?? null, risk: parts.risk ?? null, per_site, pending };
}

// The sites the marketing engine may plan: every planned site that is not blocked.
export const plannable = (r: SwarmResult) => Object.entries(r.per_site).filter(([, p]) => !p.blocked).map(([s]) => s);

export type Runner = (item: unknown, signal: AbortSignal) => Promise<unknown>;

// Starts every specialist at once, each with its own deadline; re-merges and calls onPartial on each arrival.
export async function listingSwarm(item: unknown, sites: readonly string[], run: Partial<Record<Specialist, Runner>>,
  onPartial?: (r: SwarmResult) => void, deadlines = SWARM_DEADLINE_MS): Promise<SwarmResult> {
  const parts: SwarmParts = { per_site: {} };
  const pending = new Set<Specialist>(SWARM_SPECIALISTS.filter(s => run[s]));
  await Promise.all([...pending].map(async spec => {
    const ac = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<undefined>(res => { timer = setTimeout(() => { ac.abort(); res(undefined); }, deadlines[spec]); });
    const v = await Promise.race([run[spec]!(item, ac.signal).catch(() => undefined), late]);
    clearTimeout(timer);
    pending.delete(spec);
    if (v !== undefined) {
      if (spec === 'identity') parts.identity = v as SwarmParts['identity'];
      else if (spec === 'comps') parts.comps = v;
      else if (spec === 'demand') parts.demand = v;
      else if (spec === 'risk') parts.risk = v as Risk;
      else parts.per_site![spec] = v as Record<string, unknown>;
    }
    onPartial?.(mergeSwarm(sites, parts, [...pending]));
  }));
  return mergeSwarm(sites, parts, []);
}

// --- available_now: every source's offers in one merged answer, delivered price first (M26) ---

export interface Offer extends Result {
  condition: string; relation: 'same_product' | 'successor' | 'functional_equivalent';
  shipping_cents: number | null; tax_rate: number; ships_to?: string[]; sold?: boolean; stock?: number | null;
}
export interface OfferRow extends Offer { delivered_cents: number; shipping_estimated: boolean; also_on: string[] }

// shortcut: tax applies to price + shipping everywhere; per-state shipping taxability is a param row once dt rows exist.
export function delivered(o: Offer, medianShipping: number): { cents: number; estimated: boolean } {
  const ship = o.shipping_cents ?? medianShipping;
  return { cents: Math.round((o.price_cents + ship) * (1 + o.tax_rate)), estimated: o.shipping_cents === null };
}

export function availableNow(offers: Offer[], opts: { shipTo?: string; soldIds?: Set<string>; medianShipping: number; retailPhashes?: string[] }): OfferRow[] {
  // A listing sold or out of stock between reads is dropped: a sold listing never shows as available.
  const live = offers.filter(o => !o.sold && o.stock !== 0 && !opts.soldIds?.has(o.id) && (!opts.shipTo || !o.ships_to || o.ships_to.includes(opts.shipTo)));
  const rows: OfferRow[] = dedupe(live, { retailPhashes: opts.retailPhashes }).map(c => {
    const ms = c.members as Offer[];
    const priced = ms.map(o => ({ o, d: delivered(o, opts.medianShipping) })).sort((a, b) => a.d.cents - b.d.cents);
    const best = priced[0]!;
    return { ...best.o, delivered_cents: best.d.cents, shipping_estimated: best.d.estimated, also_on: ms.filter(o => o !== best.o).map(o => o.site) };
  });
  return rows.sort((a, b) => a.delivered_cents - b.delivered_cents);
}

// One offer per relation and condition, best first (market-insight.md M26 step 4); the rest sit behind "other stores".
export function bestByRelation(rows: OfferRow[]): OfferRow[] {
  const seen = new Set<string>();
  return rows.filter(r => { const k = `${r.relation}|${r.condition}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
