// Rows 1, 2, 3, 8 and 10 of spec/benchmark.md.
// Prove: node --test --test-concurrency=1 bench/score.test.mjs
// Run: node bench/score.mjs <run_dir> [--manifest spec/items/manifest.json] [--set market|owned] [--baseline <run_dir>] [--upload]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
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
  if (record.cited_facts !== undefined) {
    if (!Number.isSafeInteger(record.cited_facts) || record.cited_facts < 0) fail(record,'cited_facts must be a nonnegative integer');
    if (record.cited_facts !== record.numbers.filter(n=>text(n.citation_id) || n.evidence.length>0).length) fail(record,'cited_facts must match cited numbers');
  }
  if (record.reads !== undefined) {
    if (!Array.isArray(record.reads)) fail(record,'reads must be an array');
    for (const read of record.reads) {
      if (!read || !text(read.site) || !['plain','cloud_browser','own_browser','official','mcp'].includes(read.lane) ||
          !Number.isFinite(read.ms) || read.ms < 0 || !text(read.outcome) || !Number.isSafeInteger(read.rows) || read.rows < 0 || typeof read.warm !== 'boolean') fail(record,'reads must carry site, lane, nonnegative ms and rows, outcome and warm');
    }
  }
  if (record.cost !== undefined) {
    if (!record.cost || typeof record.cost !== 'object' || Array.isArray(record.cost)) fail(record,'cost must be an object');
    for (const field of ['browser_s','proxy_bytes','model_calls','cents']) {
      const value=record.cost[field];
      if (value !== null && (!Number.isFinite(value) || value < 0)) fail(record,`cost.${field} must be nonnegative or null`);
      if (['proxy_bytes','model_calls'].includes(field) && value !== null && !Number.isSafeInteger(value)) fail(record,`cost.${field} must be an integer or null`);
    }
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

function readRecords(runDir, hash, ids, recordsFile = 'records.jsonl') {
  const lines = fs.readFileSync(path.join(runDir, 'records.jsonl'), 'utf8').split('\n');
  const records = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const ref = `${recordsFile}:${index + 1}`;
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

function distribution(samples, records, unit) {
  const basis=refs(samples.map(s=>s.record)), all=refs(records);
  return {
    p50:metric(percentile(samples.map(s=>s.value),.5),samples.length,records.length,basis.length?basis:all),
    p95:metric(percentile(samples.map(s=>s.value),.95),samples.length,records.length,basis.length?basis:all),
    samples:samples.map(s=>({item_id:s.record.item_id,[unit]:metric(s.value,1,1,[s.record.ref])})),
  };
}
function listed(matching, records) {
  return {...metric(matching.length,matching.length,records.length,matching.length?refs(matching):refs(records)),
    items:matching.map(r=>({item_id:r.item_id,question:r.question,records:[r.ref]}))};
}
function speed(records) {
  const cited=records.filter(r=>r.cited_facts>0 && r.full_at!==null);
  const missing=records.filter(r=>r.cited_facts===undefined || (r.cited_facts>0 && r.full_at===null));
  const knownCost=records.filter(r=>r.cost?.cents!==undefined && r.cost.cents!==null);
  const reads=records.flatMap(record=>(record.reads??[]).map(read=>({record,read,value:read.ms/1000})));
  const sites=[...new Set(reads.map(s=>s.read.site))].sort();
  return {
    first:timings(records,'first_at'), full:timings(records,'full_at'),
    seconds_per_cited_fact:{
      ...distribution(cited.map(record=>({record,value:(Date.parse(record.full_at)-Date.parse(record.asked_at))/1000/record.cited_facts})),records,'seconds'),
      zero_cited_facts:listed(records.filter(r=>r.cited_facts===0),records),missing:listed(missing,records),
    },
    reads_by_lane:sites.flatMap(site=>[...new Set(reads.filter(s=>s.read.site===site).map(s=>s.read.lane))].sort().map(lane=>{
      const matching=reads.filter(s=>s.read.site===site && s.read.lane===lane);
      return {site,lane,...distribution(matching,matching.map(s=>s.record),'seconds')};
    })),
    cold_warm:sites.map(site=>{
      const matching=reads.filter(s=>s.read.site===site);
      return {site,...Object.fromEntries([['cold',false],['warm',true]].map(([name,warm])=>[name,distribution(matching.filter(s=>s.read.warm===warm),matching.map(s=>s.record),'seconds')]))};
    }),
    cost:{...distribution(knownCost.map(record=>({record,value:record.cost.cents})),records,'cents'),unknown:listed(records.filter(r=>r.cost?.cents===undefined || r.cost.cents===null),records)},
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

function scoreTool(tool, records, itemsToScore) {
  const all = refs(records);
  const carriesAnswer = record => record.facts.some(fact=>fact.count>=1) || record.numbers.length>0;
  const empty = records.filter(record=>record.ok && !carriesAnswer(record));
  const answered = itemsToScore.map(item => {
    const matches = records.filter(r=>r.item_id===item.id);
    return { item_id:item.id, matches, ok:matches.filter(r=>r.ok) };
  });
  const covered = answered.filter(item=>item.ok.some(carriesAnswer));
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
      coverage:share(covered.length,itemsToScore.length,all),
      empty:{ n:empty.length, of:records.length, records:empty.length ? refs(empty) : all },
      sites:{ median:metric(median(sites.map(s=>s.sites.value)),sites.length,itemsToScore.length,covered.length ? refs(covered.flatMap(i=>i.ok)) : all), items:sites },
    },
    '2': { items, median:metric(median(items.map(i=>i.kinds.value)),items.length,itemsToScore.length,all), max:metric(Math.max(...items.map(i=>i.kinds.value)),items.length,itemsToScore.length,all) },
    '3':share(numbers.filter(n=>text(n.number.citation_id) || n.number.evidence.length>0).length,numbers.length,numbers.length ? refs(numbers.map(n=>n.record)) : all),
    '8':speed(records),
    '10':delists(records),
  } };
}

export function scoreRun(runDir, manifestPath = MANIFEST, set = 'market', baselineRunDir) {
  if (!['market','owned'].includes(set)) throw new Error('invalid set: '+set);
  const bytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(bytes);
  const bad = problems(manifest);
  if (bad.length) throw new Error(`manifest rejected: ${bad.join('; ')}`);
  const itemsToScore = manifest[set === 'market' ? 'market_items' : 'items'];
  if (!Array.isArray(itemsToScore) || !itemsToScore.length || itemsToScore.some(i=>!text(i?.id)) || new Set(itemsToScore.map(i=>i.id)).size !== itemsToScore.length) throw new Error('manifest rejected: items need unique nonempty ids');
  const hash = createHash('sha256').update(bytes).digest('hex');
  const ids=new Set(itemsToScore.map(i=>i.id));
  const records = readRecords(runDir,hash,ids);
  if (baselineRunDir) records.push(...readRecords(baselineRunDir,hash,ids,path.relative(runDir,path.join(baselineRunDir,'records.jsonl'))));
  return {
    run_id:records[0].run_id,
    manifest_sha256:hash,
    tools:[...new Set(records.map(r=>r.tool))].sort().map(tool=>scoreTool(tool,records.filter(r=>r.tool===tool),itemsToScore)),
  };
}

export async function scoreCli({ args = process.argv.slice(2), execFileSync: execute = execFileSync, writeStdout = line => process.stdout.write(line+'\n') } = {}) {
  const log = createLog({ src:'bench.score', build:'benchmark-rows-1-2-3-8-10', sink:line=>process.stderr.write(line+'\n') });
  let exitCode=0;
  try {
    const [runDir, ...options] = args;
    let manifestPath, baselineRunDir, set='market', upload=false;
    if (!runDir || runDir.startsWith('--')) throw new Error('usage: node bench/score.mjs <run_dir> [--manifest spec/items/manifest.json] [--set market|owned] [--baseline <run_dir>] [--upload]');
    for (let i=0; i<options.length; i++) {
      if (options[i]==='--manifest' && options[i+1] && !options[i+1].startsWith('--')) manifestPath=options[++i];
      else if (options[i]==='--baseline' && options[i+1] && !options[i+1].startsWith('--')) baselineRunDir=options[++i];
      else if (options[i]==='--set' && options[i+1] && !options[i+1].startsWith('--')) set=options[++i];
      else if (options[i]==='--upload') upload=true;
      else throw new Error(`unknown or incomplete argument: ${options[i]}`);
    }
    log.note('score input', { run_dir:runDir, manifest:manifestPath ?? MANIFEST, set, baseline:baselineRunDir });
    const result = log.timed('bench.score',()=>scoreRun(runDir,manifestPath,set,baselineRunDir));
    const output = path.join(runDir,'results.json');
    fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
    log.note('results written', { run_id:result.run_id, output });
    if (upload) {
      const landing=`dbfs:/Volumes/secondhand/raw/landing/bench/${result.run_id}`;
      try {
        await log.call('databricks','fs mkdir',{target:landing,profile:'Nate'},()=>execute('databricks',['fs','mkdir',landing,'--profile','Nate']),()=>({result:'completed'}));
        for (const file of ['records.jsonl','results.json']) {
          const source=path.join(runDir,file), target=`${landing}/${file}`;
          await log.call('databricks','fs cp',{source,target,overwrite:true,profile:'Nate'},()=>execute('databricks',['fs','cp',source,target,'--overwrite','--profile','Nate']),()=>({result:'completed'}));
        }
      } catch (error) {
        const reason=(error instanceof Error ? error.message : String(error)).split(/\r?\n/,1)[0];
        writeStdout(`upload skipped: ${reason}`);
      }
    }
  } catch (error) {
    log.error('bench.score',error);
    exitCode=1;
  } finally {
    log.end();
  }
  return exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode=await scoreCli();
