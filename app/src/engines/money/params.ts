import { memoryStore, type ParamStore, type Scope } from '../param/param.ts';
import { DEFAULT_ENDING, endings, type EndingRule } from './ending.ts';
export const DECLARED = [{ name: 'money_ending', family: 'model_ref', prior: DEFAULT_ENDING, scopes: ['kind', 'site', 'segment', 'person'], source: 'spec/engines/negotiation.md#3-the-calculation; spec/determinations/money.md#d13-listing-price' }] as const;
export function resolve(store: ParamStore = memoryStore(), scope: Scope = {}) {
  const d = DECLARED[0]; store.declare(d);
  const r = store.read(d.name, scope), value = r.value as EndingRule;
  if (!value || !Array.isArray(value.digits)) throw new RangeError('money_ending');
  endings(0, 0, value);
  return { values: { money_ending: value }, versions: { money_ending: r.version } };
}
