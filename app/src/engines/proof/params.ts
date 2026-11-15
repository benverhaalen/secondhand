import type { Declared, ParamStore, Scope } from '../param/param.ts';

export const DECLARED = [
  { name: 'proof_min_n_eff', family: 'scalar', prior: 6, scopes: ['kind', 'site', 'segment', 'person'], source: 'spec/product.md#the-proof-layer-agent-proposal' },
  { name: 'proof_max_age_days', family: 'scalar', prior: 14, scopes: ['kind', 'site', 'segment', 'person'], source: 'spec/product.md#the-proof-layer-agent-proposal' },
] as const satisfies readonly (Declared & { scopes: readonly (keyof Scope)[]; source: string })[];

export function resolve(store: ParamStore | undefined, scope: Scope) {
  const values = {} as Record<typeof DECLARED[number]['name'], number>;
  const scopes = {} as Record<typeof DECLARED[number]['name'], Scope>;
  const versions = {} as Record<typeof DECLARED[number]['name'], number>;
  for (const entry of DECLARED) {
    store?.declare(entry);
    const scoped: Scope = {};
    for (const key of entry.scopes) if (scope[key] !== undefined) scoped[key] = scope[key];
    const read = store ? store.read(entry.name, scoped) : { value: entry.prior, version: 0, scope: {} };
    if (typeof read.value !== 'number' || !Number.isFinite(read.value) || read.value <= 0)
      throw new RangeError(`${entry.name} must be finite and positive`);
    values[entry.name] = read.value;
    versions[entry.name] = read.version;
    scopes[entry.name] = { ...read.scope };
  }
  return { values, versions, scopes };
}
