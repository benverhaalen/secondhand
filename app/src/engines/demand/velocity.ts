import { evidence, FORGET_DAYS, memoryStore, type Declared, type ParamStore, type Scope } from '../param/param.ts';
import type { Log } from '../../../../log/index.js';

export type EventLog = Pick<Log, 'note' | 'error' | 'timed'>;

export function recorded<T>(log: EventLog | undefined, name: string, input: Record<string, unknown>, fn: () => T): T {
  if (!log) return fn();
  return log.timed(name, () => {
    log.note(name + '.input', { input });
    try {
      const result = fn();
      log.note(name + '.result', { result });
      return result;
    } catch (error) {
      log.error(name, error);
      throw error;
    }
  });
}

type Entry = Declared & { scopes: (keyof Scope)[]; source: string };
export type Product = { kind: string; product_id: string };
export type Gamma = { shape: number; rate: number };
const source = 'spec/engines/demand-and-trend.md#3-the-calculation';
// Declarations stay here because this worker may create only the files in its brief.
export const DECLARED: Entry[] = [
  { name: 'demand_velocity', family: 'gamma', prior: { shape: 4, rate: 2 }, scopes: ['kind', 'segment'], source: source + '; #worked-example' },
  { name: 'demand_half_life_weeks', family: 'scalar', prior: 8, guard_lo: Number.MIN_VALUE, scopes: ['kind'], source },
  { name: 'demand_prior_weeks', family: 'scalar', prior: 2, guard_lo: Number.MIN_VALUE, scopes: ['kind'], source },
];

export function resolve(store: ParamStore = memoryStore(), scope: Scope = {}) {
  const values: Record<string, unknown> = {}, versions: Record<string, number> = {};
  for (const entry of DECLARED) {
    store.declare(entry);
    const scoped = Object.fromEntries(entry.scopes.filter(k => scope[k] !== undefined).map(k => [k, scope[k]]));
    const read = store.read(entry.name, scoped);
    if (read.value === undefined) throw new TypeError(`missing param ${entry.name}`);
    values[entry.name] = read.value; versions[entry.name] = read.version;
  }
  return { values, versions };
}

export function positive(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new RangeError(`${field} must be positive and finite`);
  return value;
}

export function gammaValue(value: unknown): Gamma {
  if (typeof value !== 'object' || value === null || !('shape' in value) || !('rate' in value)) throw new RangeError('Gamma needs shape and rate');
  return { shape: positive(value.shape, 'shape'), rate: positive(value.rate, 'rate') };
}

export function timestamp(at: string, field = 'at'): number {
  const time = Date.parse(at);
  if (!Number.isFinite(time)) throw new RangeError(`${field} must be a valid timestamp`);
  return time;
}

function scopeOf(product: Product): Scope {
  if (!product.kind.trim()) throw new RangeError('kind is required');
  if (!product.product_id.trim()) throw new RangeError('product_id is required');
  return { kind: product.kind, segment: product.product_id };
}

function advance(store: ParamStore, scope: Scope, at: string): void {
  const time = timestamp(at, 'as_of'), params = resolve(store, scope);
  const row = store.rows('demand_velocity', scope).find(r => r.status === 'champion');
  if (!row) return;
  const previous = timestamp(row.promoted_at!, 'promoted_at');
  if (time < previous) throw new RangeError('out-of-order demand observation');
  if (time === previous || row.frozen) return;
  const parent = store.readPooled('demand_velocity', { kind: scope.kind });
  const parentMean = 'mean' in parent ? parent.mean : gammaValue(parent.value).shape / gammaValue(parent.value).rate;
  const rate = positive(params.values.demand_prior_weeks, 'demand_prior_weeks');
  const baseline = evidence('gamma', { shape: parentMean * rate, rate }, row.prior) as Gamma;
  const halfLife = positive(params.values.demand_half_life_weeks, 'demand_half_life_weeks') * 7; // Fixed: days per week.
  store.apply('demand_velocity', scope, (value, keep) => {
    const v = value as Gamma;
    // Convert the registry's timestamp-derived decay to this engine's declared half-life.
    const retained = keep ** (FORGET_DAYS / halfLife);
    return { value: { shape: baseline.shape + (v.shape - baseline.shape) * retained,
      rate: baseline.rate + (v.rate - baseline.rate) * retained }, weight: row.n_eff * (retained - keep) };
  }, at);
}

function initialize(store: ParamStore, scope: Scope, at: string): void {
  resolve(store, scope);
  if (store.rows('demand_velocity', scope).some(r => r.status === 'champion')) return;
  const pooled = store.readPooled('demand_velocity', { kind: scope.kind });
  const mean = 'mean' in pooled ? pooled.mean : gammaValue(pooled.value).shape / gammaValue(pooled.value).rate;
  const rate = positive(resolve(store, scope).values.demand_prior_weeks, 'demand_prior_weeks');
  const inherited = store.read('demand_velocity', scope);
  const prior = store.rows('demand_velocity', inherited.scope).find(r => r.status === 'champion')?.value_or_hyperparams ?? inherited.value;
  store.apply('demand_velocity', scope, () => ({ value: evidence('gamma', { shape: mean * rate, rate }, prior), weight: 0 }), at);
}

export function onSoldComp(store: ParamStore, product: Product, at: string, log?: EventLog) {
  return recorded(log, 'demand.onSoldComp', { product, at }, () => {
    const scope = scopeOf(product);
    timestamp(at); initialize(store, scope, at); advance(store, scope, at);
    return store.observe('demand_velocity', scope, { count: 1, exposure: 0, weight: 1 }, at);
  });
}

export function onExposure(store: ParamStore, product: Product, listing_weeks: number, at: string, log?: EventLog) {
  return recorded(log, 'demand.onExposure', { product, listing_weeks, at }, () => {
    if (!Number.isFinite(listing_weeks) || listing_weeks < 0) throw new RangeError('listing_weeks must be finite and nonnegative');
    const scope = scopeOf(product);
    timestamp(at); initialize(store, scope, at); advance(store, scope, at);
    if (listing_weeks === 0) return;
    const updated = store.observe('demand_velocity', scope, { count: 0, exposure: listing_weeks, weight: 1 }, at);
    if (!updated.applied) return updated;
    // Exposure information is listing-weeks; polling frequency must not set the pooling weight.
    return store.apply('demand_velocity', scope, value => ({ value, weight: listing_weeks - 1 }), at);
  });
}

export function velocity(store: ParamStore, product: Product, as_of: string) {
  const scope = scopeOf(product);
  advance(store, scope, as_of);
  const params = resolve(store, scope), local = store.read('demand_velocity', scope), pooled = store.readPooled('demand_velocity', scope);
  const rate = local.from === 'row' ? gammaValue(local.value).rate : positive(params.values.demand_prior_weeks, 'demand_prior_weeks');
  const mean = 'mean' in pooled ? pooled.mean : gammaValue(pooled.value).shape / gammaValue(pooled.value).rate;
  const posterior = gammaPosterior(mean * rate, rate);
  const kappa = store.read('param_pool_kappa', {});
  return { ...posterior, basis_level: local.from === 'row' ? 'product' as const : local.from === 'parent' ? 'kind' as const : 'prior' as const,
    param_versions: { ...params.versions, demand_velocity: local.version, param_pool_kappa: kappa.version },
    pooled_versions: 'versions' in pooled ? pooled.versions : [pooled.version], as_of };
}

// Lanczos coefficients and convergence limits are fixed numerical constants, not fitted weights.
const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406,
  12.507343278686905, -.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
function logGamma(z: number): number {
  if (z < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  const x = z - 1;
  let sum = .9999999999998099;
  for (let i = 0; i < LANCZOS.length; i++) sum += LANCZOS[i] / (x + i + 1);
  const t = x + 7.5;
  return .5 * Math.log(2 * Math.PI) + (x + .5) * Math.log(t) - t + Math.log(sum);
}

function regularizedGamma(shape: number, x: number): number {
  if (x === 0) return 0;
  const scale = Math.exp(shape * Math.log(x) - x - logGamma(shape));
  if (x < shape + 1) {
    let term = 1 / shape, sum = term;
    for (let n = 1; n <= 100_000; n++) {
      term *= x / (shape + n); sum += term;
      if (Math.abs(term) <= Math.abs(sum) * 1e-15) return Math.min(1, scale * sum);
    }
  } else {
    const tiny = 1e-300;
    let b = x + 1 - shape, c = 1 / tiny, d = 1 / b, fraction = d;
    for (let n = 1; n <= 100_000; n++) {
      const a = -n * (n - shape); b += 2;
      d = a * d + b; if (Math.abs(d) < tiny) d = tiny;
      c = b + a / c; if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const step = d * c; fraction *= step;
      if (Math.abs(step - 1) <= 1e-15) return Math.max(0, 1 - scale * fraction);
    }
  }
  throw new RangeError('regularized incomplete gamma did not converge');
}

function quantile(shape: number, rate: number, p: number): number {
  let lo = 0, hi = Math.max(1, shape) / rate;
  while (regularizedGamma(shape, hi * rate) < p) {
    hi *= 2;
    if (!Number.isFinite(hi)) throw new RangeError('Gamma quantile overflow');
  }
  for (let n = 0; n < 2048; n++) {
    const mid = lo + (hi - lo) / 2;
    if (mid === lo || mid === hi || hi - lo <= Math.min(1e-10, hi * 1e-12)) return mid;
    if (regularizedGamma(shape, mid * rate) < p) lo = mid; else hi = mid;
  }
  throw new RangeError('Gamma quantile bisection did not converge');
}

export function gammaPosterior(shape: number, rate: number) {
  positive(shape, 'shape'); positive(rate, 'rate'); positive(shape / rate, 'Gamma mean');
  // Fixed: p10 and p90 define the interval in demand-and-trend §3 step 2.
  return { mean: shape / rate, p10: quantile(shape, rate, .1), p90: quantile(shape, rate, .9) };
}
