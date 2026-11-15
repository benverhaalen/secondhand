// Rests-on: spec/engines/market-index.md §1, MI1; spec/plans/finalization.md SV2.
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function copy(value: unknown, now: number) {
  let removed = 0;
  const visit = (value: unknown, field?: string): unknown => {
    if (Array.isArray(value)) {
      return (value as unknown[]).filter(row => {
        // searched[] describes source outcomes, not listing rows (spec/product.md answer).
        if (field === 'searched' || !object(row) || typeof row.site !== 'string') return true;
        const allowed = Object.hasOwn(row, 'may_store') && row.may_store === true && (row.keep_until === undefined || row.keep_until === null ||
          typeof row.keep_until === 'string' && Date.parse(row.keep_until) > now);
        if (!allowed) removed++;
        return allowed;
      }).map(row => visit(row));
    }
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
