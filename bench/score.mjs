// Rows 1, 2, 3, 8 and 10 of spec/benchmark.md.
// Prove: node --test --test-concurrency=1 bench/score.test.mjs
// Run: node bench/score.mjs <run_dir> [--manifest spec/items/manifest.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { MANIFEST, problems } from '../spec/items/score.mjs';
import { createLog } from '../log/index.js';

export const KINDS = Object.freeze([
  'sold_prices', 'live_listings', 'official_price', 'discounts',
  'product_reviews', 'seller_reviews', 'demand_trend', 'time_to_sell',
  'fees_per_site', 'you_keep', 'same_item_elsewhere', 'price_history',
]);
const refs = records => [...new Set(records.map(r => r.ref))];
const fail = (record, cause) => {
  throw new Error(`${record.ref ?? record.raw_ref ?? 'record'} (${record.tool ?? '?'} / ${record.item_id ?? '?'}): ${cause}`);
};
const text = value => typeof value === 'string' && value.trim().length > 0;
function time(record, field, value) {
  if (!text(value) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    fail(record, `${field} must be an ISO 8601 UTC timestamp`);
  }
  const parsed = Date.parse(value);
  if (new Date(parsed).toISOString().slice(0,19) !== value.slice(0,19)) fail(record, `${field} must be an ISO 8601 UTC timestamp`);
  return parsed;
}

// Row 7 uses only sales strictly after the answer was requested.
export function saleUsable(record, sale) {
  if (time(record, 'sold_at', sale.sold_at) <= time(record, 'asked_at', record.asked_at)) {
    fail(record, 'sold_at must be after asked_at');
  }
  return true;
}

function validate(record, hash, ids, runId) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('record must be an object');
  if (record.manifest_sha256 !== hash) fail(record, 'manifest_sha256 does not match the supplied manifest bytes');
  if (!ids.has(record.item_id)) fail(record, `item_id is not in the manifest: ${record.item_id}`);
  if (!text(record.run_id) || record.run_id !== runId) fail(record, 'run_id must match every record in the run');
  if (!text(record.tool)) fail(record, 'tool must be a nonempty string');
  if (!['search', 'product', 'value', 'delist'].includes(record.question)) fail(record, 'question is unknown');
  if (typeof record.ok !== 'boolean') fail(record, 'ok must be boolean');
  if (record.error !== null && !text(record.error)) fail(record, 'error must be a string or null');
  if (!record.ok && !text(record.error)) fail(record, 'ok false requires an error reason');
  const asked = time(record, 'asked_at', record.asked_at);
  for (const field of ['first_at', 'full_at']) {
    if (record[field] !== null && time(record, field, record[field]) < asked) fail(record, `${field} is before asked_at`);
  }
  if (record.first_at !== null && record.full_at !== null && Date.parse(record.full_at) < Date.parse(record.first_at)) {
    fail(record, 'full_at is before first_at');
  }
  if (!Array.isArray(record.sites) || !record.sites.every(text)) fail(record, 'sites must be an array of site strings');
  if (!Array.isArray(record.facts)) fail(record, 'facts must be an array');
  for (const fact of record.facts) {
    if (!fact || !KINDS.includes(fact.kind)) fail(record, 'facts kind is unknown');
    if (!Number.isSafeInteger(fact.count) || fact.count < 0) fail(record, 'facts count must be a nonnegative integer');
  }
  if (!Array.isArray(record.numbers)) fail(record, 'numbers must be an array');
  for (const number of record.numbers) {
    if (!number || !text(number.name)) fail(record, 'numbers name must be a string');
    if (number.value_cents !== null && !Number.isSafeInteger(number.value_cents)) fail(record, 'numbers value_cents must be an integer or null');
    if (number.citation_id !== null && !text(number.citation_id)) fail(record, 'numbers citation_id must be a string or null');
    if (!Array.isArray(number.evidence) || !number.evidence.every(text)) fail(record, 'numbers evidence must be an array of references');
  }
  if (record.range !== null) {
    if (!record.range || !Number.isSafeInteger(record.range.low_cents) || !Number.isSafeInteger(record.range.high_cents) || record.range.low_cents > record.range.high_cents) fail(record, 'range must have ordered integer cents');
    time(record, 'range.as_of', record.range.as_of);
  }
  if (record.delist !== null) {
    if (record.question !== 'delist' || !Array.isArray(record.delist)) fail(record, 'delist must be an array on a delist question or null');
    for (const sale of record.delist) {
      if (!sale || !text(sale.site)) fail(record, 'delist site must be a string');
      const sold = time(record, 'sold_at', sale.sold_at);
      if (sale.ended_at !== null && time(record, 'ended_at', sale.ended_at) < sold) fail(record, 'ended_at is before sold_at');
    }
  }
  if (!text(record.raw_ref) || !record.raw_ref.startsWith('raw/') || record.raw_ref.includes('\\') || record.raw_ref.split('/').some(part => part === '..' || part === '.')) fail(record, 'raw_ref must be a relative path under raw/');
}

function readRecords(runDir, hash, ids) {
  const lines = fs.readFileSync(path.join(runDir, 'records.jsonl'), 'utf8').split('\n');
  const records = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const ref = `records.jsonl:${index + 1}`;
    let record;
    try { record = JSON.parse(line); }
    catch (error) { throw new Error(`${ref}: invalid JSON: ${error.message}`); }
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`${ref}: record must be an object`);
    record = { ...record, ref };
    validate(record, hash, ids, records[0]?.run_id ?? record.run_id);
    records.push(record);
  }
  if (!records.length) throw new Error('records.jsonl: no records to score');
  return records;
}

function share(n, of, records) {
  if (!of) return { n, of, share: null, ci95: null, records };
  const p = n / of;
  const z = 1.959963984540054;
  const denominator = 1 + z * z / of;
  const center = (p + z * z / (2 * of)) / denominator;
  const radius = z * Math.sqrt(p * (1 - p) / of + z * z / (4 * of * of)) / denominator;
  return { n, of, share: p, ci95: [Math.max(0, center - radius), Math.min(1, center + radius)], records };
}
const metric = (value, n, of, records) => ({ value, n, of, records });
const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
};
// Speed and delist percentiles use nearest rank: sorted[ceil(p * n) - 1].
const percentile = (values, p) => values.length ? [...values].sort((a,b) => a-b)[Math.ceil(p * values.length)-1] : null;

function timings(records, field) {
  const samples = records.filter(r => r[field] !== null).map(r => ({ record: r, value: (Date.parse(r[field])-Date.parse(r.asked_at))/1000 }));
  const missing = records.filter(r => r[field] === null);
  const basis = refs(samples.map(s => s.record));
  const all = refs(records);
  return {
    p50: metric(percentile(samples.map(s=>s.value), .5), samples.length, records.length, basis.length ? basis : all),
    p95: metric(percentile(samples.map(s=>s.value), .95), samples.length, records.length, basis.length ? basis : all),
    samples: samples.map(s=>({ seconds: metric(s.value, 1, 1, [s.record.ref]) })),
    missing: metric(missing.length, missing.length, records.length, missing.length ? refs(missing) : all),
  };
}

function delists(records) {
  const entries = records.flatMap(record => (record.delist ?? []).map(sale => ({ record, sale })));
  const sites = [...new Set(entries.map(e=>e.sale.site))].sort();
  return { sites: sites.map(site => {
    const matching = entries.filter(e=>e.sale.site === site);
    const ended = matching.filter(e=>e.sale.ended_at !== null);
    const pending = matching.filter(e=>e.sale.ended_at === null);
    const values = ended.map(e=>(Date.parse(e.sale.ended_at)-Date.parse(e.sale.sold_at))/1000);
    const basis = refs(ended.map(e=>e.record));
    const all = refs(matching.map(e=>e.record));
    return {
      site,
      p50: metric(percentile(values,.5), ended.length, matching.length, basis.length ? basis : all),
      p95: metric(percentile(values,.95), ended.length, matching.length, basis.length ? basis : all),
      samples: ended.map((e,i)=>({ item_id: e.record.item_id, seconds: metric(values[i],1,1,[e.record.ref]) })),
      not_ended: { ...metric(pending.length,pending.length,matching.length,pending.length ? refs(pending.map(e=>e.record)) : all),
        items: pending.map(e=>({ item_id:e.record.item_id, sold_at:e.sale.sold_at, records:[e.record.ref] })) },
    };
  }) };
}

function scoreTool(tool, records, manifest) {
  const all = refs(records);
  const answered = manifest.items.map(item => {
    const matches = records.filter(r=>r.item_id===item.id);
    return { item_id:item.id, matches, ok:matches.filter(r=>r.ok) };
  });
  const covered = answered.filter(item=>item.ok.length);
  const sites = covered.map(item=>({
    item_id:item.item_id,
    sites:metric(new Set(item.ok.flatMap(r=>r.sites)).size,item.ok.length,item.matches.length,refs(item.ok)),
  }));
  const items = answered.map(item => {
    // Empty cells cite the item's attempts; an unasked item cites the run that lacks it.
    const basis = item.matches.length ? refs(item.matches) : all;
    const facts = Object.fromEntries(KINDS.map(kind => {
      const matches = item.matches.filter(r=>r.facts.some(f=>f.kind===kind));
      const value = matches.reduce((sum,r)=>sum+r.facts.filter(f=>f.kind===kind).reduce((n,f)=>n+f.count,0),0);
      return [kind, metric(value,matches.length,item.matches.length,matches.length ? refs(matches) : basis)];
    }));
    return { item_id:item.item_id, kinds:metric(Object.values(facts).filter(f=>f.value>=1).length,item.matches.length,item.matches.length,basis), facts };
  });
  const numbers = records.flatMap(record=>record.numbers.map(number=>({record,number})));
  return { tool, rows: {
    '1': {
      coverage:share(covered.length,manifest.items.length,all),
      sites:{ median:metric(median(sites.map(s=>s.sites.value)),sites.length,manifest.items.length,covered.length ? refs(covered.flatMap(i=>i.ok)) : all), items:sites },
    },
    '2': { items, median:metric(median(items.map(i=>i.kinds.value)),items.length,manifest.items.length,all), max:metric(Math.max(...items.map(i=>i.kinds.value)),items.length,manifest.items.length,all) },
    '3':share(numbers.filter(n=>text(n.number.citation_id) || n.number.evidence.length>0).length,numbers.length,numbers.length ? refs(numbers.map(n=>n.record)) : all),
    '8':{ first:timings(records,'first_at'), full:timings(records,'full_at') },
    '10':delists(records),
  } };
}

export function scoreRun(runDir, manifestPath = MANIFEST) {
  const bytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(bytes);
  const bad = problems(manifest);
  if (bad.length) throw new Error(`manifest rejected: ${bad.join('; ')}`);
  if (!Array.isArray(manifest.items) || !manifest.items.length || manifest.items.some(i=>!text(i.id)) || new Set(manifest.items.map(i=>i.id)).size !== manifest.items.length) throw new Error('manifest rejected: items need unique nonempty ids');
  const hash = createHash('sha256').update(bytes).digest('hex');
  const records = readRecords(runDir,hash,new Set(manifest.items.map(i=>i.id)));
  return {
    run_id:records[0].run_id,
    manifest_sha256:hash,
    tools:[...new Set(records.map(r=>r.tool))].sort().map(tool=>scoreTool(tool,records.filter(r=>r.tool===tool),manifest)),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const log = createLog({ src:'bench.score', build:'benchmark-rows-1-2-3-8-10', sink:line=>process.stderr.write(line+'\n') });
  try {
    const [runDir, flag, manifestPath, ...extra] = process.argv.slice(2);
    if (!runDir || (flag !== undefined && (flag !== '--manifest' || !manifestPath)) || extra.length) throw new Error('usage: node bench/score.mjs <run_dir> [--manifest spec/items/manifest.json]');
    log.note('score input', { run_dir:runDir, manifest:manifestPath ?? MANIFEST });
    const result = log.timed('bench.score',()=>scoreRun(runDir,manifestPath));
    const output = path.join(runDir,'results.json');
    fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
    log.note('results written', { run_id:result.run_id, output });
  } catch (error) {
    log.error('bench.score',error);
    process.exitCode=1;
  } finally {
    log.end();
  }
}
