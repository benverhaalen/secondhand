// Rests-on: spec/features/market.md; spec/determinations/market-insight.md M3, M14, M19, M22;
// spec/determinations/money.md D1; spec/product.md guarded number, index_point, follow.
import type { Evidence, Fact, Guarded, HideReason } from '../intel/answer.ts';
import { movedEnough } from '../watch/watch.ts';

const DAY = 86_400_000;
export interface SoldComp {
  id: string; product_id: string; kind: string; price_cents: number; sold_at: string; site: string;
  // D1's type x match x extraction weight, supplied by the caller if not a plain exact, label-read sale.
  weight?: number; evidence?: Evidence;
}
export interface Context { now: Date; citation_id: string; half_life_days?: number }
export interface ProductTrend {
  product_id: string; p50_recent: Fact; p50_prior: Fact; change: Fact; direction: Fact;
  changes: { days: number; p50: Fact; p50_prior: Fact; change: Fact; direction: Fact }[];
}

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive`);
}
function date(value: string | Date): number {
  const at = value instanceof Date ? +value : Date.parse(value);
  if (!Number.isFinite(at)) throw new RangeError('Invalid date');
  return at;
}
function numberFact(name: string, value: unknown, basis_count: number, context: Context, sources: Evidence[], hide_reason?: HideReason): Fact {
  const guarded: Guarded = { state: hide_reason ? 'hidden' : 'shown', basis_count, as_of: context.now.toISOString(), citation_id: context.citation_id, ...(hide_reason ? { hide_reason } : {}) };
  return { name, guarded, sources, ...(hide_reason ? {} : { value }) };
}
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
function numeric(fact: Fact): number | undefined {
  return fact.guarded.state === 'shown' && typeof fact.value === 'number' && Number.isFinite(fact.value) ? fact.value : undefined;
}

// M3 weighted inverse-step p50. Input rows are sold, deduplicated physical sales in one condition band;
// rejected identity/lot/parts/replica rows and accepted-offer adjustments belong to the injected comp set.
export function productSnapshot(product_id: string, rows: readonly SoldComp[], context: Context, window_days = 90): Fact {
  const end = date(context.now);
  positive(window_days, 'window_days');
  if (context.half_life_days !== undefined) positive(context.half_life_days, 'half_life_days');
  const seen = new Set<string>();
  const selected = rows.filter(row => {
    if (row.product_id !== product_id) return false;
    positive(row.price_cents, 'price_cents');
    positive(row.weight ?? 1, 'weight');
    const at = date(row.sold_at);
    if (at > end || at <= end - window_days * DAY || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  if (!selected.length) return numberFact('p50', undefined, 0, context, [], 'too_few');
  const logs = selected.map(r => Math.log(r.price_cents));
  const center = median(logs), mad = median(logs.map(x => Math.abs(x - center)));
  const kept = selected.filter((r, i) => Math.abs(logs[i]! - center) <= 3 * 1.4826 * mad);
  const weighted = kept.map(row => {
    // D1 names these fast kinds; callers with taxonomy IDs inject the matching half-life.
    const halfLife = context.half_life_days ?? (['sneakers', 'trading cards', 'consumer electronics'].includes(row.kind) ? 30 : 90);
    return { row, weight: (row.weight ?? 1) * 0.5 ** ((end - date(row.sold_at)) / DAY / halfLife) };
  }).sort((a, b) => a.row.price_cents - b.row.price_cents);
  const sum = weighted.reduce((s, x) => s + x.weight, 0);
  const n_eff = sum ** 2 / weighted.reduce((s, x) => s + x.weight ** 2, 0);
  const sources = kept.flatMap(r => r.evidence ? [r.evidence] : []);
  const n = kept.length;
  if (n < 2 || n_eff < 6 - 1e-12) return numberFact('p50', undefined, n, context, sources, 'too_few');
  if (end - Math.max(...kept.map(r => date(r.sold_at))) > 14 * DAY) return numberFact('p50', undefined, n, context, sources, 'stale');
  if (sources.length !== n || !context.citation_id) return numberFact('p50', undefined, n, context, sources, 'source_gap');
  const quantile = (share: number): number => {
    let cumulative = 0;
    for (const x of weighted) { cumulative += x.weight; if (cumulative >= share * sum) return x.row.price_cents; }
    return weighted[weighted.length - 1]!.row.price_cents;
  };
  const p50 = quantile(0.5), spread = (quantile(0.75) - quantile(0.25)) / p50;
  // M3's starting publish gate, itself marked agent proposal in the card.
  const reason = spread > 1 ? 'too_wide' : n_eff / (n_eff + 6) * (1 - Math.min(1, spread)) < 0.5 ? 'noise' : undefined;
  return numberFact('p50', p50, n, context, sources, reason);
}

// M19 windows: last 14 days versus the non-overlapping prior 28 days. This is price movement,
// not M15's category-adjusted sales trend; a price rise must never be labelled "trending".
export function productTrend(product_id: string, rows: readonly SoldComp[], context: Context & { band90?: number; bands90?: Readonly<Record<number, number>> }): ProductTrend {
  const end = date(context.now);
  if (context.band90 !== undefined && (!Number.isFinite(context.band90) || context.band90 < 0)) throw new RangeError('Invalid band90');
  const p50_recent = productSnapshot(product_id, rows, context, 14);
  const p50_prior = productSnapshot(product_id, rows, { ...context, now: new Date(end - 14 * DAY) }, 28);
  const recent = numeric(p50_recent), prior = numeric(p50_prior);
  const reason = p50_recent.guarded.hide_reason ?? p50_prior.guarded.hide_reason;
  const sources = [...p50_recent.sources, ...p50_prior.sources];
  const n = p50_recent.guarded.basis_count + p50_prior.guarded.basis_count;
  const change = recent !== undefined && prior !== undefined ? recent / prior - 1 : undefined;
  const direction = change === undefined ? undefined : context.band90 === undefined ? undefined : Math.abs(change) <= context.band90 ? 'held' : change > 0 ? 'up' : 'down';
  return { product_id, p50_recent, p50_prior,
    change: numberFact('change', change, n, context, sources, reason),
    direction: numberFact('direction', direction, n, context, sources, reason ?? (context.band90 === undefined ? 'noise' : undefined)),
    changes: [30, 90, 365].map(days => ({ days, ...priceChange(product_id, rows, { ...context, days, band90: context.bands90?.[days] }) })) };
}

// M22 compares two M3 90-day snapshots at endpoints, separately from M19's adjacent windows.
export function priceChange(product_id: string, rows: readonly SoldComp[], context: Context & { days: number; band90?: number }): Omit<ProductTrend, 'product_id' | 'changes' | 'p50_recent'> & { p50: Fact } {
  positive(context.days, 'days');
  if (context.band90 !== undefined && (!Number.isFinite(context.band90) || context.band90 < 0)) throw new RangeError('Invalid band90');
  const p50 = productSnapshot(product_id, rows, context);
  const p50_prior = productSnapshot(product_id, rows, { ...context, now: new Date(date(context.now) - context.days * DAY) });
  const current = numeric(p50), prior = numeric(p50_prior);
  const reason = p50.guarded.hide_reason ?? p50_prior.guarded.hide_reason;
  const sources = [...p50.sources, ...p50_prior.sources];
  const n = p50.guarded.basis_count + p50_prior.guarded.basis_count;
  const change = current !== undefined && prior !== undefined ? current / prior - 1 : undefined;
  const direction = change === undefined || context.band90 === undefined ? undefined : Math.abs(change) <= context.band90 ? 'held' : change > 0 ? 'up' : 'down';
  return { p50, p50_prior, change: numberFact('change', change, n, context, sources, reason),
    direction: numberFact('direction', direction, n, context, sources, reason ?? (context.band90 === undefined ? 'noise' : undefined)) };
}

// M14 basket is frozen by basket_version: supplied weights are prior-12-month sold value shares.
// current/prior are M3 weekly product p50 facts, e.g. productSnapshot at successive week ends.
// Upstream comp selection also owns M14 eligibility/review; this function never invents a basket.
export interface IndexProduct {
  product_id: string; weight: number; sales_quarter: number; current: Fact; prior: Fact;
}
export interface IndexPoint {
  index_id: string; kind: string; basket_version: string; day: string; era: string;
  value: Fact; flagged: boolean;
  weights: { product_id: string; weight: number; effective_weight: number; basis_count: number }[];
}
export function marketIndex(kind: string, products: readonly IndexProduct[], context: Context & {
  index_id: string; basket_version: string; era: string; previous_value: number;
}): IndexPoint {
  date(context.now); positive(context.previous_value, 'previous_value');
  const ids = new Set<string>();
  for (const product of products) {
    positive(product.weight, 'weight');
    if (!Number.isFinite(product.sales_quarter) || product.sales_quarter < 0) throw new RangeError('Invalid sales_quarter');
    if (ids.has(product.product_id)) throw new Error('Duplicate basket product');
    ids.add(product.product_id);
  }
  const total = products.reduce((s, p) => s + p.weight, 0);
  const eligible = products.filter(p => p.sales_quarter >= 6);
  const present = eligible.filter(p => {
    const current = numeric(p.current), prior = numeric(p.prior);
    return current !== undefined && prior !== undefined && current > 0 && prior > 0 &&
      p.current.guarded.basis_count >= 6 && p.prior.guarded.basis_count >= 6;
  });
  const presentIds = new Set(present.map(p => p.product_id));
  const presentWeight = present.reduce((s, p) => s + p.weight, 0);
  const weights = products.map(p => ({ product_id: p.product_id, weight: p.weight,
    effective_weight: presentIds.has(p.product_id) ? p.weight / presentWeight : 0,
    basis_count: presentIds.has(p.product_id) ? p.current.guarded.basis_count + p.prior.guarded.basis_count : 0 }));
  const tooFew = eligible.length < 10 || presentWeight / total < 0.6 || !present.length;
  const sources = present.flatMap(p => [...p.current.sources, ...p.prior.sources]);
  const sourceGap = !context.citation_id || present.some(p => !p.current.guarded.citation_id || !p.prior.guarded.citation_id || !p.current.sources.length || !p.prior.sources.length);
  const reason = tooFew ? 'too_few' : sourceGap ? 'source_gap' : undefined;
  const link = present.reduce((s, p) => s + p.weight / presentWeight * Math.log(numeric(p.current)! / numeric(p.prior)!), 0);
  const value = numberFact('index_point', context.previous_value * Math.exp(link), weights.reduce((s, p) => s + p.basis_count, 0), context, sources, reason);
  return { index_id: context.index_id, kind, basket_version: context.basket_version, day: context.now.toISOString(), era: context.era, value, flagged: !!reason, weights };
}

export interface Follow {
  id: string; user_id: string; product_id: string; state: 'active' | 'muted' | 'removed';
  last_notified_at?: string; muted_at?: string;
}
export interface FollowEvent {
  product_id: string;
  movement?: { p50_recent: Fact; p50_prior: Fact; band90: Fact };
  // Injected M2 rank/date check and M15 category-adjusted, BH-tested, consecutive weekly riser reads.
  release?: Fact; riser?: Fact;
}
export interface Mention { user_id: string; product_id: string; last_notified_at: string }
export interface DigestItem { product_id: string; reasons: ('price' | 'release' | 'restock' | 'riser')[]; facts: Fact[] }
export function followedProducts(user_id: string, follows: readonly Follow[]): string[] {
  return [...new Set(follows.filter(f => f.user_id === user_id && f.state === 'active' && !f.muted_at).map(f => f.product_id))];
}
function record(fact: Fact | undefined): Record<string, unknown> | undefined {
  if (!fact || fact.guarded.state !== 'shown' || !fact.guarded.citation_id || !fact.sources.length || !fact.value || typeof fact.value !== 'object' || Array.isArray(fact.value)) return undefined;
  return fact.value as Record<string, unknown>;
}
export function weeklyDigest(user_id: string, follows: readonly Follow[], events: readonly FollowEvent[], mentions: readonly Mention[], now: Date): { digest: DigestItem[]; mentions: Mention[] } {
  const end = date(now);
  const digest: DigestItem[] = [];
  const next = [...mentions];
  for (const product_id of followedProducts(user_id, follows)) {
    // Agent proposal: a rolling seven-day cap (stricter than calendar-week boundaries).
    const sent = [...mentions.filter(m => m.user_id === user_id && m.product_id === product_id).map(m => m.last_notified_at),
      ...follows.filter(f => f.user_id === user_id && f.product_id === product_id && f.last_notified_at).map(f => f.last_notified_at!)];
    if (sent.some(at => end - date(at) < 7 * DAY)) continue;
    const reasons = new Set<DigestItem['reasons'][number]>(), facts: Fact[] = [];
    for (const event of events.filter(e => e.product_id === product_id)) {
      const m = event.movement;
      if (m) {
        const recent = numeric(m.p50_recent), prior = numeric(m.p50_prior), band = numeric(m.band90);
        const cited = [m.p50_recent, m.p50_prior, m.band90].every(f => f.guarded.citation_id && f.sources.length);
        if (cited && recent !== undefined && recent > 0 && prior !== undefined && band !== undefined && band >= 0 && movedEnough({ p50_recent: recent, p50_prior: prior, sales_recent: m.p50_recent.guarded.basis_count, band90: band })) {
          reasons.add('price'); facts.push(m.p50_recent, m.p50_prior, m.band90);
        }
      }
      const release = record(event.release);
      if (release && (release.rank === 1 || release.rank === 2) && (release.kind === 'release' || release.kind === 'restock')) { reasons.add(release.kind); facts.push(event.release!); }
      const riser = record(event.riser);
      if (riser && typeof riser.rank === 'number' && Number.isInteger(riser.rank) && riser.rank >= 1 && riser.rank <= 10 && typeof riser.weekly_reads === 'number' && riser.weekly_reads >= 2) { reasons.add('riser'); facts.push(event.riser!); }
    }
    if (!reasons.size) continue;
    digest.push({ product_id, reasons: [...reasons], facts });
    next.push({ user_id, product_id, last_notified_at: now.toISOString() });
  }
  return { digest, mentions: next };
}
