import fs from 'node:fs/promises';
import type { Param, Scope } from './param.ts';
import type { EventLog } from '../demand/velocity.ts';

type Fit = { fitted_on: unknown; use_scope: string };
export type CalibrationFit = Fit & { Q_g: number; n: number; hits: number; nominal: .8 };
export type SaleCurveFit = Fit & { reference: 'median_adjusted_sold'; days: [7, 30, 90];
  bins: { ratio: number; p: [number, number, number] }[]; t: [number | null, number | null, number | null] | null;
  n_events: number; calibration_error: number };
export type BrandPremiumFit = Fit & { ratio: number; lo: number; hi: number; n_cells: number; as_of: string };
type Values = { valuation_calibration: CalibrationFit; valuation_sale_curve: SaleCurveFit; brand_premium: BrandPremiumFit };
export type FittedParam<N extends keyof Values> = Omit<Param, 'name' | 'value_or_hyperparams'> & {
  name: N; value_or_hyperparams: Values[N]; citation: string;
};
type Row = { [N in keyof Values]: FittedParam<N> }[keyof Values];
type Snapshot = { run_id: string; exported_at: string; rows: Row[] };

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('expected an object');
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} must be a nonempty string`);
}
function number(value: unknown, field: string, lo = -Infinity, hi = Infinity): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < lo || value > hi) throw new RangeError(`${field} outside bounds`);
}
function count(value: unknown, field: string) {
  number(value, field, 0);
  if (!Number.isSafeInteger(value)) throw new RangeError(`${field} must be a nonnegative safe integer`);
}
function date(value: unknown, field: string) {
  text(value, field);
  if (!Number.isFinite(Date.parse(value))) throw new RangeError(`${field} must be a date`);
}
function finiteJSON(value: unknown): void {
  if (typeof value === 'number') number(value, 'JSON number');
  else if (Array.isArray(value)) value.forEach(finiteJSON);
  else if (value !== null && typeof value === 'object') Object.values(value).forEach(finiteJSON);
  else if (value !== null && typeof value !== 'string' && typeof value !== 'boolean') throw new TypeError('expected JSON');
}
function triple(value: unknown, field: string, hi = Infinity): asserts value is [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) throw new RangeError(`${field} needs three values`);
  value.forEach(v => number(v, field, 0, hi));
  if (value[0] > value[1] || value[1] > value[2]) throw new RangeError(`${field} must be nondecreasing`);
}

function validate(value: unknown): Row {
  const row = object(value); finiteJSON(row);
  if (!['valuation_calibration', 'valuation_sale_curve', 'brand_premium'].includes(String(row.name))) throw new TypeError('unknown fitted param name');
  if (row.family !== 'model_ref' || row.origin !== 'fit' || row.status !== 'champion') throw new TypeError('expected fitted model_ref champion');
  const scope = object(row.scope); text(scope.kind, 'scope.kind');
  if (Object.keys(scope).some(k => k !== 'kind' && k !== 'site')) throw new TypeError('fitted scope needs kind and optional site only');
  if (scope.site !== undefined) text(scope.site, 'scope.site');
  text(row.fitted_on_ids_hash, 'fitted_on_ids_hash'); text(row.citation, 'citation');
  count(row.version, 'version'); number(row.n_eff, 'n_eff', 0);
  if (row.version === 0) throw new RangeError('version must be positive');
  if (!Object.hasOwn(row, 'prior') || typeof row.frozen !== 'boolean') throw new TypeError('missing prior or frozen');
  for (const key of ['metric'] as const) if (row[key] !== null) text(row[key], key);
  for (const key of ['held_out_score', 'guard_lo', 'guard_hi', 'keep', 'days_since_last'] as const) {
    if (row[key] !== null) number(row[key], key);
  }
  if (row.previous_version !== null) count(row.previous_version, 'previous_version');
  if (row.promoted_at !== null) date(row.promoted_at, 'promoted_at');
  const v = object(row.value_or_hyperparams);
  text(v.use_scope, 'use_scope');
  if (v.fitted_on === undefined || v.fitted_on === null || v.fitted_on === '') throw new TypeError('missing fitted_on');
  if (row.name === 'valuation_calibration') {
    number(v.Q_g, 'Q_g', 0); count(v.n, 'n'); count(v.hits, 'hits');
    if ((v.hits as number) > (v.n as number)) throw new RangeError('hits exceeds n');
    if (v.nominal !== .8) throw new RangeError('nominal must be 0.8');
  } else if (row.name === 'valuation_sale_curve') {
    text(scope.site, 'scope.site');
    if (v.reference !== 'median_adjusted_sold' || JSON.stringify(v.days) !== '[7,30,90]') throw new TypeError('unsupported curve reference or days');
    if (!Array.isArray(v.bins) || !v.bins.length) throw new RangeError('curve needs bins');
    let previous = 0;
    for (const entry of v.bins) {
      const bin = object(entry); number(bin.ratio, 'ratio', Number.MIN_VALUE); triple(bin.p, 'p', 1);
      if (bin.ratio <= previous) throw new RangeError('bins must be sorted by ratio without duplicates');
      previous = bin.ratio;
    }
    if (v.bins.length === 1 && object(v.bins[0]).ratio !== 1) throw new RangeError('price-blind bin must have ratio 1');
    if (v.t !== null) {
      if (!Array.isArray(v.t) || v.t.length !== 3) throw new RangeError('t needs three values');
      let previous = 0;
      for (const day of v.t) {
        if (day === null) continue;
        number(day, 't', 0);
        if (day < previous) throw new RangeError('t must be nondecreasing');
        previous = day;
      }
    }
    count(v.n_events, 'n_events'); number(v.calibration_error, 'calibration_error', 0, 1);
  } else {
    if (scope.site !== undefined) throw new TypeError('brand_premium is kind-scoped');
    number(v.ratio, 'ratio', Number.MIN_VALUE); number(v.lo, 'lo', Number.MIN_VALUE); number(v.hi, 'hi', Number.MIN_VALUE);
    if ((v.lo as number) > (v.ratio as number) || (v.ratio as number) > (v.hi as number)) throw new RangeError('brand premium interval');
    count(v.n_cells, 'n_cells'); date(v.as_of, 'as_of');
  }
  return row as Row;
}

export function fittedReader({ path = process.env.SECONDHAND_PARAMS_EXPORT ?? '/Volumes/secondhand/raw/export/params/latest.json',
  scopes = (process.env.SECONDHAND_USE_SCOPES ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
  now = Date.now, log, every_ms = 600000,
}: { path?: string; scopes?: readonly string[]; now?: () => number; log: EventLog; every_ms?: number }) {
  number(every_ms, 'every_ms', 0);
  let snapshot: Snapshot | null = null, lastRead = -Infinity, inFlight: Promise<void> | null = null;
  const allowed = new Set(scopes);
  function refresh() {
    if (inFlight || now() - lastRead <= every_ms) return;
    lastRead = now();
    inFlight = log.timed('param.export.read', async () => {
      try {
        const envelope = object(JSON.parse(await fs.readFile(path, 'utf8')));
        if (envelope.version !== 1) throw new RangeError('unsupported export version');
        date(envelope.exported_at, 'exported_at'); text(envelope.run_id, 'run_id'); text(envelope.code_version, 'code_version');
        if (!Array.isArray(envelope.params)) throw new TypeError('export needs params');
        const rows: Row[] = []; let dropped = 0;
        for (const [index, value] of envelope.params.entries()) {
          try {
            const row = validate(value);
            if (row.value_or_hyperparams.use_scope === 'hackathon_demo' && !allowed.has('hackathon_demo')) { dropped++; continue; }
            rows.push(row);
          } catch (error) { log.error('param.export.row', { index, reason: error instanceof Error ? error.message : String(error) }); }
        }
        if (dropped) log.note('param.export.scope_dropped', { run_id: envelope.run_id, use_scope: 'hackathon_demo', count: dropped });
        snapshot = { run_id: envelope.run_id, exported_at: envelope.exported_at as string, rows };
        log.note('param.export.loaded', { run_id: snapshot.run_id, exported_at: snapshot.exported_at, count: rows.length });
      } catch (error) { log.error('param.export.read', error); }
    }, { path, use_scopes: [...allowed] });
    void inFlight.finally(() => { inFlight = null; });
  }
  function lookup<N extends keyof Values>(name: N, scope: Scope): FittedParam<N> | null {
    refresh();
    if (!scope.kind) return null;
    const rows = snapshot?.rows.filter(r => r.name === name && r.scope.kind === scope.kind) ?? [];
    const exact = scope.site === undefined ? undefined : rows.find(r => r.scope.site === scope.site);
    const row = exact ?? rows.find(r => r.scope.site === undefined);
    return row ? structuredClone(row) as FittedParam<N> : null;
  }
  return {
    calibration: (scope: Scope) => lookup('valuation_calibration', scope),
    curve: (scope: Scope) => lookup('valuation_sale_curve', scope),
    brandPremium: (scope: Scope) => lookup('brand_premium', scope),
    loaded() { refresh(); return snapshot ? { run_id: snapshot.run_id, exported_at: snapshot.exported_at } : null; },
  };
}
