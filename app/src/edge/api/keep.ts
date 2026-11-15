// Rests-on: spec/engines/market-index.md §1, MI1; spec/plans/finalization.md SV2.
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function copy(value: unknown, now: number) {
  let removed = 0;
  const allowed = (row: unknown, searched: boolean): boolean => {
    // searched[] describes source outcomes, not listing rows (spec/product.md answer).
    if (searched || !object(row) || !(typeof row.site === 'string' || Object.hasOwn(row, 'may_store') || Object.hasOwn(row, 'keep_until'))) return true;
    const keep = Object.hasOwn(row, 'may_store') && row.may_store === true && (row.keep_until === undefined || row.keep_until === null ||
      typeof row.keep_until === 'string' && Date.parse(row.keep_until) > now);
    if (!keep) removed++;
    return keep;
  };
  const visit = (value: unknown, field?: string, checked = false): unknown => {
    if (Array.isArray(value)) {
      return (value as unknown[]).filter(row => allowed(row, field === 'searched')).map(row => visit(row, undefined, true));
    }
    if (!checked && !allowed(value, false)) return null;
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, visit(nested, key)]));
    }
    return value;
  };
  const saved = visit(value);
  return { saved, removed };
}

export function storable<T>(value: T, now: number): T {
  return copy(value, now).saved as T;
}

export function dropped(value: unknown, now: number): number {
  return copy(value, now).removed;
}
