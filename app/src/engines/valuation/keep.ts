import { required, resolve } from './params.ts';

// What the seller keeps per site, in integer cents (money.md D9). The formula sets the price (J10 default);
// Ben's fixed multipliers are only the check on it (D9 step 7).
// Operation: base = price + shipping and tax where the site charges on them; fee = max(min, pct x base) + fixed,
// rounded once to the cent; keep = price - fee - what the seller pays to ship - boost. No float survives a return.
// The five sites of spec/sites.mjs, with Facebook split into shipped and local because local pays no fee.
export type FeeSite = 'ebay' | 'facebook' | 'depop' | 'poshmark' | 'mercari' | 'facebook_local';

export type FeeRow = {
  site: FeeSite;
  fee_pct: number;
  // eBay charges a lower rate past a cap; Poshmark a flat fee under a line.
  over?: { from_cents: number; pct: number };
  flat_under?: { under_cents: number; fee_cents: number };
  fixed_cents: (base_cents: number) => number;
  min_cents: number;
  base: { shipping: boolean; tax: boolean };
  valid_from: string;
  source_note: string;
};

const NOTE = 'research/price/nate/fees-and-taxes.md';
const none = () => 0;

// The money fee table, D9. Fees are fixed facts, never learned (product.md, real-time weights).
export const FEES: Record<FeeSite, FeeRow> = {
  ebay: { site: 'ebay', fee_pct: 0.136, over: { from_cents: 750000, pct: 0.0235 }, fixed_cents: b => (b <= 1000 ? 30 : 40), min_cents: 0, base: { shipping: true, tax: true }, valid_from: '2026-11-14', source_note: NOTE },
  depop: { site: 'depop', fee_pct: 0.033, fixed_cents: () => 45, min_cents: 0, base: { shipping: true, tax: true }, valid_from: '2026-11-14', source_note: NOTE },
  poshmark: { site: 'poshmark', fee_pct: 0.2, flat_under: { under_cents: 1500, fee_cents: 295 }, fixed_cents: none, min_cents: 0, base: { shipping: false, tax: false }, valid_from: '2026-11-14', source_note: NOTE },
  mercari: { site: 'mercari', fee_pct: 0.1, fixed_cents: none, min_cents: 0, base: { shipping: true, tax: false }, valid_from: '2026-11-14', source_note: NOTE },
  facebook: { site: 'facebook', fee_pct: 0.1, fixed_cents: none, min_cents: 80, base: { shipping: true, tax: true }, valid_from: '2026-11-14', source_note: `${NOTE} (asserted)` },
  facebook_local: { site: 'facebook_local', fee_pct: 0, fixed_cents: none, min_cents: 0, base: { shipping: false, tax: false }, valid_from: '2026-11-14', source_note: NOTE },
};

export type Sale = {
  buyer_shipping_cents?: number; // paid by the buyer, in the fee base on some sites, never in the keep
  seller_shipping_cents?: number; // D8: what the seller pays to ship
  boost_cents?: number;
  tax_rate?: number;
  as_of?: string;
};
export const TAX_RATE = required(resolve(undefined), 'sales_tax_rate');
const STALE_DAYS = 30;
const DAY = 86400e3;

export type Keep = { keep_cents: number; fee_cents: number; base_cents: number; fee_row: FeeRow; fees_may_have_changed: boolean };

export function fee(row: FeeRow, price_cents: number, sale: Sale = {}): { fee_cents: number; base_cents: number } {
  for (const name of ['buyer_shipping_cents', 'seller_shipping_cents', 'boost_cents'] as const) {
    const value = sale[name];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new RangeError(`${name} must be whole cents, zero or more`);
  }
  const tax = row.base.tax ? price_cents * (sale.tax_rate ?? TAX_RATE) : 0;
  const ship = row.base.shipping ? (sale.buyer_shipping_cents ?? 0) : 0;
  const base = price_cents + ship + tax;
  if (row.flat_under && price_cents < row.flat_under.under_cents) return { fee_cents: row.flat_under.fee_cents, base_cents: Math.round(base) };
  const pct = row.over && base > row.over.from_cents
    ? row.fee_pct * row.over.from_cents + row.over.pct * (base - row.over.from_cents)
    : row.fee_pct * base;
  return { fee_cents: Math.round(Math.max(row.min_cents, pct) + row.fixed_cents(base)), base_cents: Math.round(base) };
}

export function keep(site: FeeSite, price_cents: number, sale: Sale = {}): Keep {
  const row = FEES[site];
  if (!Number.isInteger(price_cents) || price_cents < 0) throw new Error(`price must be whole cents, got ${price_cents}`);
  const { fee_cents, base_cents } = fee(row, price_cents, sale);
  const keep_cents = price_cents - fee_cents - (sale.seller_shipping_cents ?? 0) - (sale.boost_cents ?? 0);
  const age = sale.as_of ? (Date.parse(sale.as_of) - Date.parse(row.valid_from)) / DAY : 0;
  return { keep_cents, fee_cents, base_cents, fee_row: row, fees_may_have_changed: age > STALE_DAYS };
}

// D9 step 7: the least whole-cent price whose keep reaches the target. Keep mostly rises with price, so bisect, then look under the fee steps.
export function priceForKeep(site: FeeSite, target_cents: number, sale: Sale = {}): number {
  let lo = 0, hi = Math.max(100, target_cents * 4);
  while (keep(site, hi, sale).keep_cents < target_cents) hi *= 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (keep(site, mid, sale).keep_cents >= target_cents) hi = mid; else lo = mid + 1;
  }
  // A fixed-fee step (eBay at $10, Poshmark at $15) can make keep fall, so a lower price may reach the target too.
  for (let p = Math.max(0, lo - 2000); p < lo; p++) if (keep(site, p, sale).keep_cents >= target_cents) return p;
  return lo;
}
