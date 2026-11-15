// One observed run of rung 3 on a real public page, signed out: fetch, read, decide, logged through log/.
//   node app/src/edge/sold/run.ts <public listing url> [logfile]
// then: node scripts/runs.mjs record sd-1 --log <logfile>
// One request, no session, no cookies, a plain User-Agent; a bot wall is reported, never routed around.
import { createLog } from '../../../../log/index.js';
import { fileSink } from '../../../../log/node.js';
import { readPublicPage } from './sold.ts';

const [url, file = 'logs/sd-1-run.jsonl'] = process.argv.slice(2);
if (!url) { console.error('usage: node app/src/edge/sold/run.ts <public listing url> [logfile]'); process.exit(2); }
const log = createLog({ src: 'sold.run', build: 'local', sink: fileSink(file) });
const page = await log.call('http', 'public.listing', { host: new URL(url).host }, async () => {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; secondhand-check/1.0)' }, redirect: 'follow' });
  return { status: r.status, text: await r.text() };
}, o => ({ result: { status: o.status, bytes: o.text.length } }));
const t0 = performance.now();
const read = readPublicPage(page.text, page.status);
log.event('note', { msg: `public read: ${read.state}`, state: read.state, why: read.why, ms: Math.round(performance.now() - t0) }, 'info');
log.end?.();
console.log(JSON.stringify({ status: page.status, ...read }));
