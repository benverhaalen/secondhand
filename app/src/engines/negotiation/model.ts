import { resolve, validate, type Resolved } from './params.ts';
export type Logistic = { terms: Record<string, number>; weights: number[] };
export type Features = { site: string; category: string; features: number[] };
// negotiation.md §3 step 3: same hierarchical linear predictor and clipping as fit.py.
export function predict(model: Logistic, row: Features, params: Resolved = resolve()): number {
  validate(params);
  if (row.features.length !== model.weights.length || [...row.features, ...model.weights, ...Object.values(model.terms)].some(v => !Number.isFinite(v))) throw new RangeError('features and weights must be finite and match model');
  const keys = ['global', `site:${row.site}`, `category:${row.category}`, `cell:${row.site}:${row.category}`];
  const z = keys.reduce((sum, k) => sum + (model.terms[k] ?? 0), 0) + model.weights.reduce((sum, w, i) => sum + w * row.features[i], 0);
  const p = z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
  return Math.min(params.values.negotiation_p_hi, Math.max(params.values.negotiation_p_lo, p));
}
export function halfLife(days: number, params: Resolved = resolve()): number {
  validate(params);
  if (!Number.isFinite(days) || days < 0) throw new RangeError('days');
  return Math.exp(-Math.LN2 * days / params.values.negotiation_half_life_days); // Fixed mathematical ln(2).
}
