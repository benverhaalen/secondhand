// node bench/reads.mjs --site ebay|depop --queries file.json --gap-ms 10500 --out logs/reads
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { createLog, observeLogs } from '../log/index.js';
import { fileSink } from '../log/node.js';
import { CHALLENGE, ebayPageAdapters } from '../app/src/edge/harness/sites/ebay/adapter.ts';
import { depopAdapters } from '../app/src/edge/harness/sites/depop/adapter.ts';

const classes = ['answered', 'empty', 'refused', 'challenged', 'shape_changed', 'timed_out', 'failed'];
const queryHash = query => createHash('sha256').update(query).digest('hex').slice(0, 12);
const percentile = (sorted, p) => sorted.length ? sorted[Math.ceil(sorted.length * p) - 1] : null;

function readClass(result, error, status) {
  if (status >= 400 && status <= 599) return 'refused';
  if (error?.name === 'TimeoutError' || error?.code === 'timeout') return 'timed_out';
  const code = error?.code ?? result?.error?.code;
  if (code === 'blocked') return 'challenged';
  if (code === 'rate_limited') return 'refused';
  if (code === 'page_changed') return 'shape_changed';
  if (error || !result?.ok || !Array.isArray(result.data)) return 'failed';
  return result.data.length ? 'answered' : 'empty';
}

export async function run({ client, adapters, queries, gapMs, sink, now = () => performance.now(), sleep = (ms, signal) => delay(ms, undefined, { signal }) }) {
  if (!Array.isArray(queries) || !queries.every(q => typeof q === 'string')) throw new Error('queries must be a JSON array of strings');
  if (!Number.isFinite(gapMs) || gapMs < 0) throw new Error('gap-ms must be a nonnegative finite number');
  const reads = [], counts_by_class = Object.fromEntries(classes.map(c => [c, 0]));
  const controller = new AbortController();
  let current, stopped = null, interrupted = false, closing, previousStart;
  const close = () => closing ??= Promise.resolve().then(() => client.close());
  const log = createLog({ src: 'bench.reads', build: 'SR7', sink, config: { queries_count: queries.length, gap_ms: gapMs } });
  const unobserve = observeLogs(line => {
    const entry = JSON.parse(line);
    if (!current || entry.event !== 'call.end' || typeof entry.status !== 'number') return;
    for (const key of ['status', 'nav_ms', 'waited_ms', 'parsed', 'fallback']) if (entry[key] !== undefined) current[key] = entry[key];
  });
  const interrupt = () => {
    interrupted = true; controller.abort();
    void close().catch(() => log.error('reads.close', new Error('anonymous clients failed to close')));
  };
  process.on('SIGINT', interrupt);
  try {
    // Stop before an adapter could try another host after an HTTP refusal or challenge.
    const observedClient = new Proxy(client, { get(target, key) {
      const method = Reflect.get(target, key);
      if (!['page', 'listings', 'doc', 'json'].includes(key) || typeof method !== 'function') return method;
      return async (...args) => {
        const reply = await method.apply(target, args);
        if (current) current.status = reply.status;
        if (reply.status >= 400 && reply.status <= 599) throw Object.assign(new Error('site refused the read'), { code: 'http_refused' });
        if (reply.challenge || (search.manifest.site === 'ebay' && typeof reply.html === 'string' && CHALLENGE.test(reply.html.slice(0, 20_000)))) {
          throw Object.assign(new Error('site showed a challenge'), { code: 'blocked' });
        }
        return reply;
      };
    } });
    const routes = typeof adapters === 'function' ? adapters(observedClient) : adapters;
    const search = routes.find(adapter => adapter.manifest.verb === 'search');
    if (!search) throw new Error('the site has no search page adapter');
    for (let i = 0; i < queries.length && !interrupted; i++) {
      if (previousStart !== undefined) {
        const remaining = Math.max(0, gapMs - (now() - previousStart));
        if (remaining > 0) {
          try { await sleep(remaining, controller.signal); }
          catch (error) { if (!interrupted) throw error; }
        }
      }
      if (interrupted) break;
      current = { status: 0, nav_ms: null, waited_ms: null, parsed: null, fallback: null };
      const query_hash = queryHash(queries[i]), started = now(); previousStart = started;
      log.note('read started', { i, query_hash, site: search.manifest.site });
      let result, error;
      try { result = await search.run({ q: queries[i] }, controller.signal); }
      catch (caught) { error = caught; }
      const classification = readClass(result, error, current.status);
      const record = { i, query_hash, class: classification, rows: classification === 'answered' ? result.data.length : 0,
        ms: now() - started, nav_ms: current.nav_ms, waited_ms: current.waited_ms, parsed: current.parsed, fallback: current.fallback };
      reads.push(record); counts_by_class[classification]++;
      log.note('read finished', record);
      if (classification === 'challenged' || classification === 'refused') {
        stopped = { i, query_hash, class: classification, reason: 'site_backoff', status: current.status };
        log.note('site backed off', stopped, 'info'); break;
      }
    }
    if (interrupted) stopped = { reason: 'sigint' };
    const times = reads.filter(r => r.class === 'answered').map(r => r.ms).sort((a, b) => a - b);
    return { reads, answered: counts_by_class.answered, total: queries.length, rows: reads.reduce((n, r) => n + r.rows, 0),
      p50_ms: percentile(times, 0.5), p95_ms: percentile(times, 0.95), counts_by_class, stopped };
  } finally {
    try { await close(); }
    finally { process.off('SIGINT', interrupt); unobserve(); log.end({ reads: reads.length, interrupted }); }
  }
}

async function cli() {
  const usage = 'Usage: node bench/reads.mjs --site ebay|depop --queries <file.json> --gap-ms <n> --out <dir>';
  let values;
  try {
    ({ values } = parseArgs({ options: { site: { type: 'string' }, queries: { type: 'string' }, 'gap-ms': { type: 'string' }, out: { type: 'string' } } }));
  } catch { throw new Error(usage); }
  const gapMs = Number(values['gap-ms']);
  if (!['ebay', 'depop'].includes(values.site) || !values.queries || !values.out || values['gap-ms']?.trim() === '' || !Number.isFinite(gapMs) || gapMs < 0) throw new Error(usage);
  let queries;
  try { queries = JSON.parse(readFileSync(values.queries, 'utf8')); }
  catch { throw new Error('Could not read the queries file as JSON. Expected an array of strings.'); }
  if (!Array.isArray(queries) || !queries.every(q => typeof q === 'string')) throw new Error('The queries file must be a JSON array of strings.');
  let compose;
  try { compose = await import('../app/src/edge/harness/compose.ts'); }
  catch { throw new Error('Could not load app/src/edge/harness/compose.ts. This script needs its searchClients(process.env, log) export and dependencies.'); }
  if (typeof compose.searchClients !== 'function') throw new Error('app/src/edge/harness/compose.ts must export searchClients(process.env, log).');
  const dir = resolve(values.out); mkdirSync(dir, { recursive: true });
  const append = fileSink(join(dir, 'log.jsonl'));
  let sinkError;
  const sink = line => { try { append(line); } catch (error) { sinkError ??= error; } };
  const log = createLog({ src: 'bench.reads.clients', build: 'SR7', sink });
  let clients, closing;
  const close = () => closing ??= Promise.resolve().then(() => clients.close());
  try {
    clients = await compose.searchClients(process.env, log);
    const publicClients = clients.publicClients ?? clients;
    if (!publicClients[values.site] || typeof clients.close !== 'function') throw new Error('searchClients must supply the anonymous site client and close().');
    const client = { ...publicClients[values.site], close };
    const summary = await run({ client, adapters: values.site === 'ebay' ? ebayPageAdapters : depopAdapters, queries, gapMs, sink });
    writeFileSync(join(dir, 'summary.json'), JSON.stringify({ site: values.site, ...summary }, null, 2) + '\n');
  } finally {
    try { if (clients) await close(); }
    finally { log.end(); }
  }
  if (sinkError) throw new Error('Could not retain every log line in log.jsonl.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  cli().catch(error => {
    // Only our own fixed CLI messages are printed; browser and filesystem errors can contain private values.
    const message = error instanceof Error && /^(Usage:|Could not|The queries file|app\/src\/edge\/harness\/compose.ts must|searchClients must)/.test(error.message)
      ? error.message : 'Read run failed. Inspect log.jsonl for the bounded outcome.';
    process.stderr.write(message + '\n'); process.exitCode = 1;
  });
}
