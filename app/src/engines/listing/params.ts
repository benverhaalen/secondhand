import { memoryStore, type ParamStore, type Scope, type Declared } from '../param/param.ts';
export type Entry = Declared & { scopes: (keyof Scope)[]; source: string };
export const DECLARED: Entry[] = [{ name: 'listing_home_markup', family: 'scalar', prior: .1, guard_lo: 0, scopes: ['site', 'person'], source: 'spec/engines/audit.md#marketing (listing/spreads.ts:21 existing guessed start value; agent proposal)' }];

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
