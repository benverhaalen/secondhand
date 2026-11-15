// The buy side's shared market: products, what is for sale across the five sites and official stores, and one search.
// Every world reads the same market, so a product page looks the same whoever opens it.
import { inDays, inHours, inMinutes } from './format.ts';
import type { Match, Product, RetailOffer, SearchResult } from './types.ts';

export const PRODUCTS: Product[] = [
  {
    id: 'pr_dunk', brand: 'Nike', model: 'Dunk Low', variant: 'Grey Fog, men’s 10', category: 'shoes', key: 'nike-dunks',
    used_price: { range: { low: 6500, high: 9500 }, basis_count: 58, as_of: inHours(-2), citation_id: 'ci_dunk', state: 'shown' },
    retail_price_cents: 11500, trend: 'falling',
    by_site: [
      { site: 'ebay', sold: { low: 6800, high: 9200 }, asking: { low: 7500, high: 12000 }, for_sale: 41, median_days: 6, basis_count: 31 },
      { site: 'depop', sold: { low: 7000, high: 9500 }, asking: { low: 8000, high: 11000 }, for_sale: 18, median_days: 9, basis_count: 14 },
      { site: 'mercari', sold: { low: 6500, high: 8800 }, asking: { low: 7000, high: 10500 }, for_sale: 22, median_days: 7, basis_count: 11 },
      { site: 'poshmark', sold: null, asking: { low: 8500, high: 13000 }, for_sale: 9, median_days: null, basis_count: 2 },
      { site: 'facebook', sold: null, asking: { low: 5000, high: 9000 }, for_sale: 6, median_days: null, basis_count: 0 },
    ],
    history: [
      { month: '2026-06', new_cents: 11500, used_cents: 9800 }, { month: '2026-07', new_cents: 11500, used_cents: 9400 },
      { month: '2026-08', new_cents: 11500, used_cents: 9000 }, { month: '2026-09', new_cents: 10500, used_cents: 8600 },
      { month: '2026-10', new_cents: 11500, used_cents: 8200 }, { month: '2026-11', new_cents: 11500, used_cents: 7900 },
    ],
    cheaper: [{ title: 'Nike Court Vision Low, grey', price_cents: 4200 }, { title: 'Adidas Campus 00s, grey', price_cents: 5900 }],
  },
  {
    id: 'pr_switch', brand: 'Nintendo', model: 'Switch OLED', variant: 'white, with dock', category: 'electronics', key: 'switch-oled',
    used_price: { range: { low: 21000, high: 26000 }, basis_count: 112, as_of: inHours(-1), citation_id: 'ci_sw', state: 'shown' },
    retail_price_cents: 34999, trend: 'rising',
    by_site: [
      { site: 'ebay', sold: { low: 21500, high: 26500 }, asking: { low: 23000, high: 30000 }, for_sale: 210, median_days: 4, basis_count: 74 },
      { site: 'mercari', sold: { low: 20000, high: 25000 }, asking: { low: 22000, high: 28000 }, for_sale: 66, median_days: 5, basis_count: 30 },
      { site: 'facebook', sold: null, asking: { low: 18000, high: 27500 }, for_sale: 31, median_days: null, basis_count: 0 },
    ],
    history: [
      { month: '2026-08', new_cents: 34999, used_cents: 21000 }, { month: '2026-09', new_cents: 34999, used_cents: 21500 },
      { month: '2026-10', new_cents: 34999, used_cents: 22500 }, { month: '2026-11', new_cents: 34999, used_cents: 23500 },
    ],
    cheaper: [{ title: 'Switch Lite, used', price_cents: 11000 }],
  },
  {
    id: 'pr_j97', brand: 'Carhartt', model: 'Detroit Jacket J97', variant: 'brown duck, blanket lined', category: 'apparel', key: 'carhartt-jacket',
    used_price: { range: { low: 8500, high: 11500 }, basis_count: 41, as_of: inHours(-3), citation_id: 'ci_j97', state: 'shown' },
    retail_price_cents: 15999, trend: 'rising',
    by_site: [
      { site: 'ebay', sold: { low: 8200, high: 11900 }, asking: { low: 9000, high: 16000 }, for_sale: 14, median_days: 8, basis_count: 23 },
      { site: 'depop', sold: { low: 8800, high: 12500 }, asking: { low: 9500, high: 15000 }, for_sale: 9, median_days: 5, basis_count: 12 },
      { site: 'mercari', sold: null, asking: { low: 8000, high: 12000 }, for_sale: 4, median_days: null, basis_count: 2 },
    ],
    history: [{ month: '2026-09', new_cents: 15999, used_cents: 9200 }, { month: '2026-10', new_cents: 15999, used_cents: 9700 }, { month: '2026-11', new_cents: 15999, used_cents: 10100 }],
    cheaper: [],
  },
];

export const RETAIL: RetailOffer[] = [
  { id: 'ro_dunk_nike', product_id: 'pr_dunk', relation: 'same_product', store: 'Nike', condition: 'new', price_cents: 11500, delivered_cents: 12305, delivery_min_days: 3, delivery_max_days: 5, warranty_months: 0, returns_days: 60 },
  { id: 'ro_sw_refurb', product_id: 'pr_switch', relation: 'same_product', store: 'Nintendo', condition: 'refurbished', price_cents: 29999, delivered_cents: 32099, delivery_min_days: 4, delivery_max_days: 7, warranty_months: 12, returns_days: 30 },
];

const dunk = (id: string, site: Match['site'], price: number, delivered: number, extra: Partial<Match>): Match => ({
  id, state: 'found', want_id: null, source: 'search', label: 'exact', site, title: 'Nike Dunk Low Grey Fog, men’s 10', key: 'nike-dunks',
  url: `https://example.invalid/${site}/${id}`, price_cents: price, delivered_cents: delivered, condition: 'Used, good', seller: 'a person',
  verdict: 'fair', seen_at: inMinutes(-12), product_id: 'pr_dunk', size: '10', ...extra,
});

// "nike dunk low grey 10": three sites answered, one is still searching, ranked by delivered price against the fair range.
export const SEARCH_DUNKS: SearchResult = {
  id: 'sr_dunk', query: 'nike dunk low grey 10', product_id: 'pr_dunk', sites_answered: ['ebay', 'mercari', 'depop', 'facebook'], sites_waiting: ['poshmark'],
  counts: { ebay: 41, mercari: 22, depop: 18, facebook: 6 }, fair: { low: 6500, high: 9500 },
  rows: [
    dunk('mt_d1', 'mercari', 6400, 7250, { verdict: 'good', condition: 'Used, like new' }),
    dunk('mt_d2', 'ebay', 7000, 7650, {}),
    dunk('mt_d3', 'facebook', 6000, 6000, { verdict: 'good', condition: 'Used, fair', seller: 'pickup, 4 mi away' }),
    dunk('mt_d4', 'depop', 8500, 9300, { label: 'likely_same_model', condition: 'Used, good' }),
    dunk('mt_d5', 'ebay', 11200, 11900, { verdict: 'high', condition: 'New without box' }),
    dunk('mt_d6', 'mercari', 7800, 8600, { label: 'same_family_other_variant', title: 'Nike Dunk Low Grey Fog, women’s 11.5' }),
  ],
  retail: RETAIL.filter(r => r.product_id === 'pr_dunk'),
};

export const SEARCH_EMPTY: SearchResult = {
  id: 'sr_none', query: 'left-handed 1970s banjo case, green velvet', product_id: null, sites_answered: ['ebay', 'mercari', 'depop', 'facebook', 'poshmark'], sites_waiting: [],
  counts: {}, fair: null, rows: [], retail: [],
};

export const SEARCH_SLOW: SearchResult = { ...SEARCH_DUNKS, id: 'sr_slow', sites_answered: ['ebay'], sites_waiting: ['mercari', 'depop', 'facebook', 'poshmark'], counts: { ebay: 41 }, rows: SEARCH_DUNKS.rows.filter(r => r.site === 'ebay') };

export const product = (id: string) => PRODUCTS.find(p => p.id === id) ?? null;
export const lastWeek = inDays(-7);
