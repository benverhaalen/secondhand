export function money(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${field} must be finite nonnegative safe integer cents`);
  return value;
}
export function rounded(value: number, field: string): number {
  const cents = Math.round(value); // Fixed: JavaScript half-up rounding is the money protocol.
  if (!Number.isSafeInteger(cents)) throw new RangeError(`${field} exceeds safe integer cents`);
  return cents;
}
