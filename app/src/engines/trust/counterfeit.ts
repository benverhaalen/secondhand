import { numeric, priors, priorVersions, type ParamInput } from './params.ts';
import { cents } from './money.ts';
import { publish, type Proof, type Published } from './publication.ts';
import { known, fact } from '../../../../spec/sites.mjs';
export type CfIn = {
  brand?: string; proofPhoto: boolean; site: 'poshmark' | 'ebay' | 'other'; shoes: boolean;
  price_cents?: number; q50_cents?: number;
  stockPhoto: boolean; sellerAgeDays?: number; buy?: boolean; proof?: { price: Proof; q50: Proof };
};
export type Cf = { action: 'none' | 'warn' | 'ask'; reasons: string[]; price: Published | null; typical: Published | null };
export function counterfeit(i: CfIn, input?: ParamInput, versions?: Record<string, number>): Cf {
  const values = input ?? priors();
  const paramVersions = versions ?? (input === undefined ? priorVersions() : {});
  const p = numeric(values), read = (name: string) => typeof values === 'function' ? values(name) : values[name];
  const price_cents = cents(i.price_cents, 'price_cents');
  const q50_cents = cents(i.q50_cents, 'q50_cents');
  const brands = read('trust_cf_brands');
  if (!Array.isArray(brands)) throw new RangeError('trust_cf_brands');
  const prone = !!i.brand && brands.includes(i.brand.toLowerCase());
  const reasons: string[] = [];
  let action: Cf['action'] = 'none';
  const up = (a: Cf['action']) => { if (a === 'ask' || action === 'none') action = a; };
  if (prone && !i.proofPhoto) { up('ask'); reasons.push('Add a photo of the tag or serial number.'); }
  const key = i.site === 'poshmark' ? 'authentication.floor_cents' : i.site === 'ebay' && i.shoes ? 'authentication.shoes.floor_cents' : null;
  if (key && known(key, i.site) && price_cents >= cents(fact(key, i.site), key)) { up('warn'); reasons.push('This site offers authentication at this price: check its route.'); }
  const cheap = prone && q50_cents > 0 && price_cents < p('trust_cf_price_ratio') * q50_cents;
  const v = typeof values === 'function' ? priors() : values;
  const price = publish(price_cents, 'trust_listing_price_cents', i.proof?.price, paramVersions, v);
  const typical = publish(q50_cents, 'trust_typical_price_cents', i.proof?.q50, paramVersions, v);
  if (cheap) {
    up('warn');
    if (price && typical) reasons.push(`Priced at $${(price_cents / 100).toFixed(2)}. This model usually sells for $${(q50_cents / 100).toFixed(2)}.`); // Fixed USD display conversion.
    else reasons.push('Priced below comparable sales.');
  }
  if (i.stockPhoto) { up('warn'); reasons.push('The photo matches a stock image.'); }
  if (i.buy && cheap && i.stockPhoto && (i.sellerAgeDays ?? Infinity) < p('trust_cf_young_days')) { up('ask'); reasons.push('Low price, stock photo and a new seller account.'); }
  return { action, reasons, price, typical };
}
