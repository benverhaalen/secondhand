// A live run of both Apify lanes: one eBay search and one Facebook Marketplace search, rows and ms printed, each error caught
// on its own. Spends at most 2 x MAX_CHARGE_USD. The only file here that reads the environment. Not reachable from app/src/app/v1/.
// Run (PowerShell, the token stays in this one process and is never printed):
//   $env:APIFY_TOKEN=[Environment]::GetEnvironmentVariable('APIFY_TOKEN','User'); node app/src/edge/harness/sites/apify/live.ts
import { createLog } from '../../../../../../log/index.js';
import { fileSink } from '../../../../../../log/node.js';
import { createApify, type Lane } from './adapter.ts';

// The log goes to logs/ (git-ignored); stdout carries the summary.
const log = createLog({ src: 'app.src.edge.harness.sites.apify.live', build: 'dev', sink: fileSink(`logs/apify-live-${Date.now()}.jsonl`) });
const apify = createApify({ token: process.env.APIFY_TOKEN, log });
const QUERIES: [Lane, { q: string; city?: string }][] = [['ebay', { q: 'Levi 501 jeans' }], ['facebook', { q: 'office chair', city: 'chicago' }]];

for (const [lane, a] of QUERIES) {
  const t = Date.now();
  try {
    const r = await apify.search(lane, a, AbortSignal.timeout(90_000));
    const ms = Date.now() - t;
    if (!r.ok) { console.log(`${lane} ${a.q}: ${r.error.code} ${r.error.message} ${JSON.stringify(r.error.hint)} (${ms} ms)`); continue; }
    console.log(`${lane} ${a.q}: ${r.data.rows.length} rows, ${r.data.dropped} dropped in ${ms} ms`);
    for (const x of r.data.rows.slice(0, 3)) console.log(`  ${x.currency ?? '?'} ${x.price_cents} ${x.condition ?? ''} ${(x.title ?? '').slice(0, 60)}`);
  } catch (e) { console.log(`${lane} ${a.q}: threw ${e instanceof Error ? e.message : String(e)} (${Date.now() - t} ms)`); }
}
log.end();
