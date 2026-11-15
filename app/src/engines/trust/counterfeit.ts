// Counterfeit hints (spec/engines/trust.md §2 Counterfeit). A route and both numbers, never a verdict. q50 is a plain input (va-6 not built).
export type CfIn = {
  brand?: string; proofPhoto: boolean; site: 'poshmark' | 'ebay' | 'other'; shoes: boolean; priceUsd: number; q50: number;
  stockPhoto: boolean; sellerAgeDays?: number; buy?: boolean;
};
export type Cf = { action: 'none' | 'warn' | 'ask'; reasons: string[] };
type Pf = (name: string) => unknown;
export function counterfeit(i: CfIn, p: Pf): Cf {
  const brands = p('trust_cf_brands') as string[];
  const prone = !!i.brand && brands.includes(i.brand.toLowerCase());
  const reasons: string[] = [];
  let action: Cf['action'] = 'none';
  const up = (a: Cf['action']) => { if (a === 'ask' || action === 'none') action = a; };
  if (prone && !i.proofPhoto) { up('ask'); reasons.push('Add a photo of the tag or serial number.'); }
  if (i.site === 'poshmark' && i.priceUsd >= (p('trust_cf_posh_floor_usd') as number)) { up('warn'); reasons.push('This site authenticates items at this price: use its route.'); }
  if (i.site === 'ebay' && i.shoes && i.priceUsd >= (p('trust_cf_ebay_shoes_usd') as number)) { up('warn'); reasons.push('This site authenticates these shoes: use its route.'); }
  const cheap = prone && i.q50 > 0 && i.priceUsd < (p('trust_cf_price_ratio') as number) * i.q50;
  if (cheap) { up('warn'); reasons.push(`Priced at $${i.priceUsd}. This model usually sells for $${i.q50}.`); }
  if (i.stockPhoto) { up('warn'); reasons.push('The photo matches a stock image.'); }
  if (i.buy && cheap && i.stockPhoto && (i.sellerAgeDays ?? Infinity) < (p('trust_cf_young_days') as number)) { up('ask'); reasons.push('Cheap, stock photo and a new seller account.'); }
  return { action, reasons };
}
