import { evidence, memoryStore, type Declared, type ParamStore, type Scope } from '../param/param.ts';
import { gammaPosterior, gammaValue, timestamp, recorded, type EventLog, type Gamma } from '../demand/velocity.ts';

export type Listing = { kind: string; site?: string; listing_id?: string };
type Entry = Declared & { scopes: (keyof Scope)[]; source: string };
// Agent proposal: unit Gamma is a proper neutral prior until a site/kind band has observations.
// The spec names a_v/b_v but supplies no numeric cold-start prior.
export const DECLARED: Entry[] = [
  { name: 'view_rate', family: 'gamma', prior: { shape: 1, rate: 1 }, scopes: ['kind', 'site', 'segment'], source: 'spec/marketing-engine.md#35-update-rules (unit prior: agent proposal)' },
];

export function resolve(store: ParamStore = memoryStore(), scope: Scope = {}) {
  const values: Record<string, unknown> = {}, versions: Record<string, number> = {};
  for (const entry of DECLARED) {
    store.declare(entry);
    const read = store.read(entry.name, scope);
    values[entry.name] = gammaValue(read.value); versions[entry.name] = read.version;
  }
  return { values, versions };
}

function scopeOf(listing: Listing): Scope {
  if (!listing.kind.trim()) throw new RangeError('kind is required');
  if (listing.site !== undefined && !listing.site.trim()) throw new RangeError('site is required');
  if (listing.listing_id !== undefined && !listing.listing_id.trim()) throw new RangeError('listing_id is required');
  return { kind: listing.kind, ...(listing.site === undefined ? {} : { site: listing.site }),
    ...(listing.listing_id === undefined ? {} : { segment: listing.listing_id }) };
}

function advance(store: ParamStore, scope: Scope, at: string): void {
  const time = timestamp(at, 'as_of');
  const row = store.rows('view_rate', scope).find(r => r.status === 'champion');
  if (!row) return;
  const previous = timestamp(row.promoted_at!, 'promoted_at');
  if (time < previous) throw new RangeError('out-of-order stats observation');
  if (time === previous || row.frozen) return;
  store.apply('view_rate', scope, (value, keep) => {
    const v = value as Gamma;
    return { value: { shape: v.shape * keep, rate: v.rate * keep }, weight: 0 };
  }, at);
}

export function onStats(store: ParamStore, listing: Listing, views: number, hours: number, at: string, log?: EventLog) {
  return recorded(log, 'marketing.onStats', { listing, views, hours, at }, () => stats(store, listing, views, hours, at));
}

function stats(store: ParamStore, listing: Listing, views: number, hours: number, at: string) {
  if (!Number.isSafeInteger(views) || views < 0) throw new RangeError('views must be a nonnegative safe integer');
  if (!Number.isFinite(hours) || hours < 0 || (views > 0 && hours === 0)) throw new RangeError('hours must be finite and positive when views are recorded');
  const scope = scopeOf(listing);
  timestamp(at); resolve(store, scope);
  if (views === 0 && hours === 0) return;
  // observe uses the registry timestamp to decay once before adding counts.
  const row = store.rows('view_rate', scope).find(r => r.status === 'champion');
  if (row?.promoted_at && timestamp(at) < timestamp(row.promoted_at)) throw new RangeError('out-of-order stats observation');
  if (!row && scope.segment !== undefined) {
    const { segment: _segment, ...parent } = scope;
    const pooled = store.readPooled('view_rate', parent);
    const inherited = store.read('view_rate', parent), gamma = gammaValue(inherited.value);
    const prior = store.rows('view_rate', inherited.scope).find(r => r.status === 'champion')?.value_or_hyperparams ?? inherited.value;
    const mean = 'mean' in pooled ? pooled.mean : gamma.shape / gamma.rate;
    const rate = gammaValue(store.read('view_rate', {}).value).rate;
    store.apply('view_rate', scope, () => ({ value: evidence('gamma', { shape: mean * rate, rate }, prior), weight: 0 }), at);
  }
  const updated = store.observe('view_rate', scope, { count: views, exposure: hours, weight: 1 }, at);
  if (!updated.applied) return updated;
  // Gamma rate information is observed hours, independent of how a poll is split.
  // observe already added one unit of n_eff; retain its exact counts and correct that metadata.
  return store.apply('view_rate', scope, value => ({ value, weight: hours - 1 }), at);
}

function posterior(store: ParamStore, scope: Scope) {
  const raw = store.read('view_rate', scope), pooled = store.readPooled('view_rate', scope);
  const gamma = gammaValue(raw.value);
  const mean = 'mean' in pooled ? pooled.mean : gammaValue(pooled.value).shape / gammaValue(pooled.value).rate;
  return { ...gammaPosterior(mean * gamma.rate, gamma.rate), version: raw.version,
    pooled_versions: 'versions' in pooled ? pooled.versions : [pooled.version] };
}

export function interest(store: ParamStore, listing: Listing, as_of: string) {
  const scope = scopeOf(listing), { segment: _segment, ...parent } = scope;
  resolve(store, scope);
  // Age the entire supplied lineage, never a sibling listing.
  for (const shared of [{ kind: scope.kind }, parent, scope].filter((s, i, all) => all.findIndex(other => JSON.stringify(other) === JSON.stringify(s)) === i))
    advance(store, shared, as_of);
  const local = posterior(store, scope), band = posterior(store, parent);
  const standing = local.mean < band.p10 ? 'behind' as const : local.mean > band.p90 ? 'ahead' as const : 'on_plan' as const;
  return { mean: local.mean, p10: local.p10, p90: local.p90, interest_median: band.mean,
    standing, band: { p10: band.p10, p90: band.p90 }, as_of,
    param_versions: { ...resolve(store, scope).versions, param_pool_kappa: store.read('param_pool_kappa', {}).version },
    pooled_versions: local.pooled_versions, band_versions: band.pooled_versions };
}
