// A live run against Dupe's published MCP server: three searches at the adapter's pace, rows and ms printed, each search's
// error caught on its own. Not reachable from app/src/app/v1/. Run: node app/src/edge/harness/sites/dupe/live.ts
import { createLog } from '../../../../../../log/index.js';
import { fileSink } from '../../../../../../log/node.js';
import { createDupe } from './adapter.ts';

// The log goes to logs/ (git-ignored); stdout carries the summary.
const log = createLog({ src: 'app.src.edge.harness.sites.dupe.live', build: 'dev', sink: fileSink(`logs/dupe-live-${Date.now()}.jsonl`) });
const dupe = createDupe({ log });
const QUERIES = [{ q: 'patagonia better sweater', category: 'Fashion' }, { q: 'herman miller sayl', category: 'Furniture' }, { q: 'nintendo switch oled', category: 'all' }];

for (const a of QUERIES) {
  const t = Date.now();
  try {
    const r = await dupe.search(a, AbortSignal.timeout(30_000));
    const ms = Date.now() - t;
    if (!r.ok) { console.log(`${a.q}: ${r.error.code} ${r.error.message} ${JSON.stringify(r.error.hint)} (${ms} ms)`); continue; }
    const used = r.data.rows.filter(x => x.secondhand);
    const by = Object.entries(Object.groupBy(used, x => x.source_site)).map(([k, v]) => `${k} ${v?.length}`).join(', ');
    console.log(`${a.q}: ${r.data.rows.length} rows, ${r.data.dropped} dropped, ${used.length} secondhand (${by}) in ${ms} ms`);
    for (const x of r.data.rows.slice(0, 3)) console.log(`  ${x.source_site} ${x.currency} ${x.price_cents} ${x.secondhand ? 'used' : 'new'} ${x.title.slice(0, 60)}`);
  } catch (e) { console.log(`${a.q}: threw ${e instanceof Error ? e.message : String(e)} (${Date.now() - t} ms)`); }
}
log.end();
