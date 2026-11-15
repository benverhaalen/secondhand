// What secondhand costs to run, what it earns, and where it breaks even, per active user and at scale.
// Every input names its source and one mark: observed (read on the source page), asserted (a source says so, not
// checked at the original), inferred (our arithmetic on sourced numbers), assumption (our guess, to be replaced by a
// measurement). Change one input and re-run: `node scripts/bench/roi.mjs`. The write-up is product/roi.md.
import { fileURLToPath } from 'node:url';
import { keep } from '../../app/src/engines/valuation/keep.ts';

const R = 'research/watch/nate/buyer-side-actions-and-affiliate.md';
const ROI = 'product/roi.md#sources';

export const INPUTS = {
  // what one referred purchase is worth
  aov_resale: { value: 33, unit: '$', mark: 'observed', source: 'Poshmark S-1 (2020-12-17): "The average order value on our marketplace in 2019 was $33."' },
  ebay_fashion: { value: 0.04, unit: 'share', mark: 'observed', source: 'eBay Partner Network rate card PDF: Fashion 4.0%, cap $550 (read 2026-11-15)' },
  ebay_home: { value: 0.03, unit: 'share', mark: 'observed', source: 'eBay Partner Network rate card PDF: Home & Garden and Collectibles 3.0%' },
  ebay_electronics: { value: 0.02, unit: 'share', mark: 'observed', source: 'eBay Partner Network rate card PDF: TV/audio, cameras, phones, games 2.0%; computers 1.5%' },
  amazon_apparel: { value: 0.04, unit: 'share', mark: 'asserted', source: 'getlasso.co reading Amazon Associates (2026-10-14): apparel 4%, home 3%' },
  etsy: { value: 0.032, unit: 'share', mark: 'asserted', source: 'Etsy terms say "case-by-case" via Rakuten (observed); 3.2% per getlasso.co (asserted)' },
  network_merchant_rate: { value: 0.03, unit: 'share', mark: 'assumption', source: `Depop 0-7% and Poshmark 1-5% on aggregators only (${R} §5); 3% taken as the middle` },
  network_keep: { value: 0.7, unit: 'share', mark: 'observed', source: 'Skimlinks support: "you receive 70% of the total commission paid by the merchant"' },
  facebook: { value: 0, unit: 'share', mark: 'observed', source: `no Facebook Marketplace affiliate programme found (${R} §5)` },
  // where referred purchases land; the order of results never depends on this (app/src/edge/buy/buy.ts)
  mix: { value: { ebay: 0.45, network_resale: 0.25, amazon_retail: 0.15, etsy: 0.05, facebook: 0.10 }, unit: 'share', mark: 'assumption', source: 'eBay holds most used-goods listings with a public programme; Facebook is local cash' },
  // anchors for how often people buy
  poshmark_orders_per_buyer_year: { value: 6.3, unit: 'orders', mark: 'asserted', source: 'Value Investors Club on the Poshmark S-1: "an average of 6.3 orders from active buyers in 2019"' },
  honey_rev_per_mau_month: { value: 100e6 / 17e6 / 12, unit: '$', mark: 'inferred', source: 'Honey ~$100M revenue in 2018 (PayPal CEO, via productmint, asserted) over 17M monthly users (Honey, asserted)' },
  // what an item costs us to list
  identify: { value: 0.035, unit: '$/item', mark: 'inferred', source: 'product/numbers.md "What it costs us": $0.015 to $0.06, midpoint' },
  post_and_delist: { value: 0.015, unit: '$/item', mark: 'inferred', source: 'product/numbers.md: post $0.003-0.012 plus delist $0.003-0.012, midpoints' },
  seedream_image: { value: 0.02, unit: '$/image', mark: 'observed', source: 'openrouter.ai/bytedance-seed/seedream-5-5: from $0.02 an image, $0.008 per input image (2026-11-15)' },
  seedream_input: { value: 0.008, unit: '$/image', mark: 'observed', source: 'same page; Runware lists the same $0.008 per reference image' },
  nano_banana_candidate: { value: 0.037, unit: '$/image', mark: 'observed', source: 'research/studio/ben/slides.md: Nano Banana 2.1 rendered for $0.037 in the smoke run' },
  judge_read: { value: 0.005, unit: '$/read', mark: 'assumption', source: 'one vision read per candidate (jobs/studio/slides_run.py VISION); not billed yet' },
  // what watching for sales costs
  depop_live_day: { value: 0.10, unit: '$/account-day', mark: 'inferred', source: 'product/numbers.md: a signed-in Depop sweep every 15 min while live, about $0.10 a day' },
  search: { value: 0.01, unit: '$/search', mark: 'inferred', source: 'product/numbers.md: one web search $0.01, Lens via Serper $0.003; public site reads ~$0' },
  // the platform
  platform_fixed: { value: 1500, unit: '$/month', mark: 'assumption', source: 'Databricks serverless jobs, Lakebase, app hosting and logs at small scale; replace with the first bill' },
  platform_per_mau: { value: 0.02, unit: '$/MAU-month', mark: 'assumption', source: 'storage, rows and logs per active person; replace with the first bill' },
  // paid extras (business.md: everything else stays free)
  studio_price: { value: 0.99, unit: '$/item', mark: 'assumption', source: 'product/business.md: studio photos are the one paid feature; price not set' },
  plan_price: { value: 9.99, unit: '$/month', mark: 'assumption', source: 'product/business.md: a reseller plan under the crosslisters (one listed at $39.99, asserted)' },
  consignment_keeps: { value: 0.85, unit: 'share', mark: 'observed', source: 'product/business.md: ThredUp keeps 85% of a $20 sale' },
};
const v = k => INPUTS[k].value;

// The studio as slides_run.py runs it: cover and back, each four Seedream 5.5 seeds with four inputs (photo, outline,
// two print close-ups) plus one Nano Banana fallback, and one judge read per candidate.
export const studioCostPerItem = () => 2 * (4 * (v('seedream_image') + 4 * v('seedream_input')) + v('nano_banana_candidate')) + 10 * v('judge_read');

const RATE = {
  ebay_fashion: () => v('ebay_fashion'), ebay_home: () => v('ebay_home'), ebay_electronics: () => v('ebay_electronics'),
  amazon_retail: () => v('amazon_apparel'), etsy: () => v('etsy'), facebook: () => v('facebook'),
  network_resale: () => v('network_merchant_rate') * v('network_keep'),
};
export const commission = (aov, dest) => Math.round(aov * RATE[dest]() * 1e6) / 1e6;

// Blended commission per referred purchase. eBay is split fashion-heavy like the first person we build for (clothes).
export function perPurchase(aov = v('aov_resale')) {
  const m = v('mix');
  const ebay = 0.6 * commission(aov, 'ebay_fashion') + 0.25 * commission(aov, 'ebay_home') + 0.15 * commission(aov, 'ebay_electronics');
  return m.ebay * ebay + m.network_resale * commission(aov, 'network_resale') + m.amazon_retail * commission(aov, 'amazon_retail')
    + m.etsy * commission(aov, 'etsy') + m.facebook * commission(aov, 'facebook');
}

// Chance a second buyer pays before the other listings are down, if each other listing sells as a Poisson process with
// mean time to sell T: P = 1 - exp(-k * w / T). A first-order model, not a measurement: buyers are not independent.
export function doubleSaleRate({ windowMin, otherListings, meanDaysToSell }) {
  return 1 - Math.exp(-otherListings * windowMin / (meanDaysToSell * 1440));
}

// Scenario knobs per monthly active person (MAU). Each is an assumption the first 100 users replace.
export const SCENARIOS = {
  conservative: { purchases_per_mau: 0.05, items_per_mau: 1.0, studio_attach: 0.05, plan_share: 0.01, searches_per_mau: 3, depop_account_days_per_mau: 0.3 * 20, depop_partner_api: false },
  base: { purchases_per_mau: 0.2, items_per_mau: 1.5, studio_attach: 0.10, plan_share: 0.02, searches_per_mau: 5, depop_account_days_per_mau: 0.3 * 15, depop_partner_api: false },
  flattering: { purchases_per_mau: 0.5, items_per_mau: 2.0, studio_attach: 0.15, plan_share: 0.03, searches_per_mau: 8, depop_account_days_per_mau: 0.3 * 15, depop_partner_api: true },
};

export function perMau(s) {
  const buy = s.purchases_per_mau * perPurchase();
  const studio = s.items_per_mau * s.studio_attach * v('studio_price');
  const plan = s.plan_share * v('plan_price');
  const listing = s.items_per_mau * (v('identify') + v('post_and_delist'));
  const studioCost = s.items_per_mau * s.studio_attach * studioCostPerItem();
  const watching = s.depop_partner_api ? 0 : s.depop_account_days_per_mau * v('depop_live_day');
  const search = s.searches_per_mau * v('search');
  const platform = v('platform_per_mau');
  const revenue = buy + studio + plan, cost = listing + studioCost + watching + search + platform;
  return { buy, studio, plan, revenue, listing, studioCost, watching, search, platform, cost, margin: revenue - cost };
}

// Referred purchases per person per month at which the variable margin is zero.
export function breakEvenPurchases(s) {
  const r = perMau({ ...s, purchases_per_mau: 0 });
  return Math.max(0, -r.margin / perPurchase());
}

export function atScale(s, mau) {
  const r = perMau(s);
  const margin = r.margin * mau - v('platform_fixed');
  return { mau, revenue: r.revenue * mau, cost: r.cost * mau + v('platform_fixed'), margin, margin_per_mau: margin / mau };
}

// What a seller gains per item: the best site against the worst, and against consignment. Same sale as bench.mjs fees():
// the buyer pays $6 shipping, no sales tax, no boost.
export function sellerValue(price = 20) {
  const cents = Math.round(price * 100);
  const sites = ['ebay', 'depop', 'poshmark', 'mercari', 'facebook'].map(s => [s, keep(s, cents, { buyer_shipping_cents: 600, tax_rate: 0 }).keep_cents / 100]);
  sites.sort((a, b) => b[1] - a[1]);
  const consign = Math.round(price * (1 - v('consignment_keeps')) * 100) / 100;
  return { price, best: sites[0], worst: sites[sites.length - 1], site_choice: Math.round((sites[0][1] - sites[sites.length - 1][1]) * 100) / 100, vs_consignment: Math.round((sites[0][1] - consign) * 100) / 100 };
}

const money = x => (Math.abs(x) >= 1000 ? `$${Math.round(x).toLocaleString('en-US')}` : `$${x.toFixed(x < 1 && x > -1 ? 3 : 2)}`);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`One referred purchase at the $${v('aov_resale')} resale order value earns ${money(perPurchase())} blended.`);
  console.log(`Studio costs ${money(studioCostPerItem())} an item as the run is built (2 slides x 5 candidates).`);
  console.log(`Honey's anchor: ${money(v('honey_rev_per_mau_month'))} per monthly user per month (2018).\n`);
  console.log('| per MAU per month | ' + Object.keys(SCENARIOS).join(' | ') + ' |');
  console.log('|---|' + Object.keys(SCENARIOS).map(() => '---').join('|') + '|');
  const rows = Object.fromEntries(Object.entries(SCENARIOS).map(([k, s]) => [k, perMau(s)]));
  for (const f of ['buy', 'studio', 'plan', 'revenue', 'listing', 'studioCost', 'watching', 'search', 'platform', 'cost', 'margin'])
    console.log(`| ${f} | ` + Object.values(rows).map(r => money(r[f])).join(' | ') + ' |');
  console.log('| break-even purchases | ' + Object.values(SCENARIOS).map(s => breakEvenPurchases(s).toFixed(2)).join(' | ') + ' |\n');
  for (const mau of [10_000, 100_000, 1_000_000]) {
    console.log(`${mau.toLocaleString('en-US')} MAU: ` + Object.entries(SCENARIOS).map(([k, s]) => `${k} ${money(atScale(s, mau).margin * 12)}/yr`).join(', '));
  }
  console.log('\nDouble sales per 1,000 sales, 3 other listings:');
  for (const T of [7, 14, 30]) {
    const r = w => (1000 * doubleSaleRate({ windowMin: w, otherListings: 3, meanDaysToSell: T })).toFixed(2);
    console.log(`  mean ${T} days to sell: ours (4 min) ${r(4)}, 10-min poller (12 min) ${r(12)}, once a day (24 h) ${r(1440)}`);
  }
  for (const p of [20, 33, 100]) console.log('Seller value', JSON.stringify(sellerValue(p)));
}
