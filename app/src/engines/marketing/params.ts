import { memoryStore, type ParamStore, type Scope, type Declared } from '../param/param.ts';
export type Entry = Declared & { scopes: (keyof Scope)[]; source: string };
export const DECLARED: Entry[] = [
  { name: 'marketing_vis_exponent', family: 'scalar', prior: 0.5, guard_lo: 0, scopes: ['site', 'segment'], source: 'spec/marketing-engine.md#3.4-weights-are-params' },
  { name: 'marketing_holding_cost_balanced', family: 'scalar', prior: 0.002, guard_lo: 0, scopes: ['person'], source: 'spec/marketing-engine.md#3.3-the-objective' },
  { name: 'marketing_holding_cost_quick', family: 'scalar', prior: 0.01, guard_lo: 0, scopes: ['person'], source: 'spec/marketing-engine.md#3.3-the-objective' },
  { name: 'marketing_holding_cost_max_return', family: 'scalar', prior: 0, guard_lo: 0, scopes: ['person'], source: 'spec/marketing-engine.md#3.3-the-objective' },
  { name: 'marketing_p_min_quick', family: 'scalar', prior: 0.6, guard_lo: 0, guard_hi: 1, scopes: ['person'], source: 'spec/marketing-engine.md#3.3-the-objective' },
  { name: 'marketing_p_min_balanced', family: 'scalar', prior: 0.4, guard_lo: 0, guard_hi: 1, scopes: ['person'], source: 'spec/marketing-engine.md#3.3-the-objective' },
  { name: 'marketing_p_min_max_return', family: 'scalar', prior: 0, guard_lo: 0, guard_hi: 1, scopes: ['person'], source: 'spec/marketing-engine.md#3.3-the-objective' },
  { name: 'marketing_visibility_lo', family: 'scalar', prior: 0.5, guard_lo: 0, scopes: ['site', 'segment'], source: 'spec/marketing-engine.md#3.2-scoring-each-candidate' },
  { name: 'marketing_visibility_hi', family: 'scalar', prior: 2, guard_lo: 0, scopes: ['site', 'segment'], source: 'spec/marketing-engine.md#3.2-scoring-each-candidate' },
  { name: 'marketing_timing_min_n', family: 'scalar', prior: 200, guard_lo: 1, scopes: ['site', 'segment'], source: 'spec/determinations/listing-and-marketing.md#d14-when-to-post' },
  { name: 'marketing_timing_horizon_h', family: 'scalar', prior: 72, guard_lo: 0, scopes: ['site', 'segment'], source: 'spec/marketing-engine.md#3.4-weights-are-params' },
];

export function resolve(store: ParamStore = memoryStore(), scope: Scope = {}) {
  const values: Record<string, unknown> = {}, versions: Record<string, number> = {};
  for (const entry of DECLARED) {
    store.declare(entry);
    const scoped = Object.fromEntries(entry.scopes.filter(key => scope[key] !== undefined).map(key => [key, scope[key]]));
    const read = store.read(entry.name, scoped);
    if (read.value === undefined) throw new TypeError(`missing param ${entry.name}`);
    values[entry.name] = read.value; versions[entry.name] = read.version;
  }
  return { values, versions };
}
export function scalar(values: Record<string, unknown>, name: string): number {
  const value = values[name];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`invalid or missing param ${name}`);
  const entry = DECLARED.find(entry => entry.name === name);
  if (entry && ((entry.guard_lo !== undefined && value < entry.guard_lo) || (entry.guard_hi !== undefined && value > entry.guard_hi))) throw new RangeError(`param ${name} outside guard`);
  return value;
}
