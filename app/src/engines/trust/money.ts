export function cents(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new RangeError(field);
  return value;
}
export function dollarsToCents(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new RangeError(field);
  // Fixed USD conversion: round the input's decimal representation half up, avoiding binary product ties.
  const [significand, exponent = '0'] = value.toString().split('e');
  const [whole, fraction = ''] = significand.split('.');
  const digits = BigInt(whole + fraction);
  const power = Number(exponent) + 2 - fraction.length; // Fixed conversion: 100 cents per USD.
  if (power >= 0) return cents(Number(digits * 10n ** BigInt(power)), field);
  const divisor = 10n ** BigInt(-power);
  return cents(Number((digits + divisor / 2n) / divisor), field);
}
