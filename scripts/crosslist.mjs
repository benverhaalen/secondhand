#!/usr/bin/env node
// Import a Depop shop, price each listing against its market, and plan the cross-listing to every other linked site.
//   node scripts/crosslist.mjs [products.json] [comps.json] [--json]
// products.json: Depop products (Partner API shape), default spec/fixtures/depop/shop.json (made up).
// --market prices every site to keep the market median instead of the person's own price.
// comps.json: market rows for jobs/valuation/market.py; default a synthetic market (jobs/valuation/synthetic.py), and the
// output says "synthetic" whenever it is. Nothing is posted: this prints the drafts the first_post decision would show.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importDepop } from '../app/src/edge/connect/depop-import.ts';
import { planCrosslist, marketItem } from '../app/src/engines/listing/crosslist.ts';
import { keep } from '../app/src/engines/valuation/keep.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const asJson = process.argv.includes('--json');
const productsFile = args[0] ?? join(root, 'spec/fixtures/depop/shop.json');
const raw = JSON.parse(readFileSync(productsFile, 'utf8'));
const { listings, refused } = importDepop(Array.isArray(raw) ? raw : raw.products);
const { rows } = JSON.parse(readFileSync(join(root, 'spec/fixtures/requirement/requirement.json'), 'utf8'));

const dir = mkdtempSync(join(tmpdir(), 'crosslist-'));
let compsFile = args[1], synthetic = false;
if (!compsFile) {
  synthetic = true;
  compsFile = join(dir, 'comps.json');
  execFileSync('python3', ['-c', `import sys,json;sys.path.insert(0,${JSON.stringify(join(root, 'jobs'))});from valuation import synthetic;json.dump(synthetic.market(),open(${JSON.stringify(compsFile)},'w'))`]);
}
const active = listings.filter(l => l.state === 'active');
writeFileSync(join(dir, 'items.json'), JSON.stringify(active.map(marketItem)));
execFileSync('python3', [join(root, 'jobs/valuation/fit.py'), '--comps', compsFile, '--items', join(dir, 'items.json'), '--out', join(dir, 'priced.json')]);
const priced = JSON.parse(readFileSync(join(dir, 'priced.json'), 'utf8'));
const estimate = new Map(active.map((l, i) => [l.external_id, priced.estimates[i]]));

// The person's own Depop price sets the payout every site keeps (their price is their call); with --market the market's
// median sale does instead. Either way the range is shown beside it.
const atMarket = process.argv.includes('--market');
const { plans, skipped } = planCrosslist(listings, {
  rows, linked: ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'],
  target_keep_cents: l => { const e = estimate.get(l.external_id); return atMarket && e?.shown ? keep('depop', e.median_cents).keep_cents : undefined; },
});
const verdict = (price, e) => (!e.shown ? `no range shown (${e.hidden})` : price < e.low_cents ? 'under the market' : price > e.high_cents ? 'over the market' : 'in the market range');

const usd = c => (c === undefined ? '-' : `$${(c / 100).toFixed(2)}`);
if (asJson) {
  console.log(JSON.stringify({ synthetic_market: synthetic, backtest: priced.backtest, refused, skipped, plans, estimates: Object.fromEntries(estimate) }, null, 1));
} else {
  console.log(`market: ${synthetic ? 'SYNTHETIC (jobs/valuation/synthetic.py), not real sales' : compsFile}; ${priced.n_sold} sold rows`);
  const bt = priced.backtest;
  console.log(`backtest on the newest ${bt.n_test} sales: 80% range held ${(bt.coverage * 100).toFixed(0)}%; median error ${(bt.median_ape * 100).toFixed(0)}% vs ${(bt.median_ape_category_median * 100).toFixed(0)}% for the category median`);
  console.log(`imported ${listings.length} (${active.length} active, ${listings.length - active.length} sold kept as comps), refused ${refused.length}, skipped ${skipped.length}\n`);
  for (const p of plans) {
    const e = estimate.get(p.source.external_id);
    console.log(`${p.source.title}  [${p.product_type}]`);
    console.log(`  yours ${usd(p.source.price_cents)} on depop, ${verdict(p.source.price_cents, e)} · 80% range ${usd(e.low_cents)}–${usd(e.high_cents)}, median ${usd(e.median_cents)} · level ${e.level} · ${e.similar_12m} similar sales in 12 months · sell-through ${e.liquidity.sell_through ?? '-'} · keep ${usd(p.target_keep_cents)} on every site`);
    for (const d of e.drivers) console.log(`    ${d.term} ${d.premium >= 0 ? '+' : ''}${(d.premium * 100).toFixed(0)}% ${d.relative_to}`);
    for (const c of e.comps.slice(0, 3)) console.log(`    comp ${c.site} ${c.sold_at} sold ${usd(c.price_cents)} → ${usd(c.adjusted_cents)} for this item today`);
    for (const d of p.sites) console.log(`  ${d.site.padEnd(9)} ${d.action.padEnd(5)} ${usd(d.price_cents).padStart(8)} floor ${usd(d.floor_cents).padStart(8)}  ${d.listing ? (d.listing.ready ? 'ready' : `needs ${d.listing.missing.join(', ')}`) : d.reason}  ${d.listing?.title ?? ''}`);
    console.log('');
  }
}
