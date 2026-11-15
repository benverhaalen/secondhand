import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { scoreRun, saleUsable } from './score.mjs';
import { run } from './run.mjs';

const fixture = fileURLToPath(new URL('./fixtures/score/', import.meta.url));
const scorer = fileURLToPath(new URL('./score.mjs', import.meta.url));
const rows = () => fs.readFileSync(path.join(fixture, 'records.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
function planted(t, records = rows(), manifest = fs.readFileSync(path.join(fixture, 'manifest.json'))) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-score-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = path.join(root, 'planted');
  fs.mkdirSync(run);
  const manifestPath = path.join(root, 'manifest.json');
  fs.writeFileSync(manifestPath, manifest);
  fs.writeFileSync(path.join(run, 'records.jsonl'), records.map(JSON.stringify).join('\n') + '\n');
  return { run, manifestPath };
}
const refs = (...lines) => lines.map(line => `records.jsonl:${line}`);
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);

test('coverage requires content in an ok record and counts empty ok records', t => {
  const [base] = rows();
  const record = (item_id, facts, numbers, extra = {}) => ({...base, item_id, facts, numbers, ...extra});
  const zero = [{kind:'sold_prices',count:0}];
  const records = [
    record('clothes-1',zero,[]),
    record('clothes-2',[{kind:'sold_prices',count:1}],[]),
    record('clothes-2',zero,[]),
    record('shoes-1',zero,[{name:'price',value_cents:null,citation_id:null,evidence:[]}]),
    record('shoes-2',[{kind:'sold_prices',count:1}],[],{ok:false,error:'failed'}),
  ];
  const {run,manifestPath} = planted(t,records);
  const row = scoreRun(run,manifestPath,'owned').tools[0].rows['1'];
  assert.equal(row.coverage.n,2);
  assert.equal(row.coverage.of,4);
  assert.deepEqual(row.sites.items.map(item=>item.item_id),['clothes-2','shoes-1']);
  assert.equal(row.empty.n,2);
  assert.equal(row.empty.of,5);
  assert.deepEqual(row.empty.records,refs(1,3));
});

test('planted rows 1, 2, 3, 8 and 10 have hand-computed scores', t => {
  const {run,manifestPath} = planted(t);
  const result = scoreRun(run, manifestPath, 'owned');
  const {rows: scored} = result.tools[0];
  assert.equal(result.tools[0].tool, 'alpha');
  assert.deepEqual(Object.keys(scored), ['1','2','3','8','10']);
  assert.equal(scored['1'].coverage.n, 3);
  assert.equal(scored['1'].coverage.of, 4);
  assert.equal(scored['1'].coverage.share, .75);
  close(scored['1'].coverage.ci95[0], .300641842582402);
  close(scored['1'].coverage.ci95[1], .9544127391902995);
  assert.equal(scored['1'].sites.median.value, 2);
  assert.deepEqual(scored['1'].sites.items.map(x=>x.sites.value), [3,1,2]);
  assert.deepEqual(scored['1'].sites.items[0].sites.records, refs(1,2));
  const breadth = scored['2'];
  assert.deepEqual(breadth.items.map(x=>x.kinds.value), [3,1,2,0]);
  assert.equal(breadth.median.value, 1.5);
  assert.equal(breadth.max.value, 3);
  assert.equal(Object.keys(breadth.items[0].facts).length, 12);
  assert.equal(breadth.items[0].facts.sold_prices.value, 3);
  assert.deepEqual(breadth.items[0].facts.sold_prices.records, refs(1,2));
  assert.equal(breadth.items[0].facts.live_listings.value, 3);
  assert.equal(breadth.items[0].facts.official_price.value, 1);
  assert.equal(breadth.items[1].facts.discounts.value, 0);
  assert.equal(scored['3'].n, 2);
  assert.equal(scored['3'].of, 4);
  assert.equal(scored['3'].share, .5);
  close(scored['3'].ci95[0], .15003898915214947);
  close(scored['3'].ci95[1], .8499610108478506);
  assert.deepEqual(scored['3'].records, refs(1,2,3));
  assert.equal(scored['8'].first.p50.value, 3);
  assert.equal(scored['8'].first.p95.value, 20);
  assert.equal(scored['8'].full.p50.value, 30);
  assert.equal(scored['8'].full.p95.value, 60);
  assert.equal(scored['8'].first.p50.n, 6);
  assert.equal(scored['8'].first.p50.of, 7);
  assert.deepEqual(scored['8'].first.missing.records, refs(6));
  const delist = scored['10'].sites;
  assert.deepEqual(delist.map(x=>x.site), ['depop','mercari','poshmark']);
  assert.equal(delist[1].p50.value, 10);
  assert.equal(delist[1].p95.value, 30);
  assert.deepEqual(delist[1].samples.map(x=>x.seconds.value), [10,30]);
  assert.equal(delist[0].not_ended.value, 1);
  assert.deepEqual(delist[0].not_ended.records, refs(7));
  assert.equal(delist[2].not_ended.value, 1);
  assert.equal(delist[2].p50.value, null);
  assert.deepEqual(delist[2].not_ended.items[0].records, refs(5));
});

test('every output number has nonempty, resolvable record references', t => {
  const {run,manifestPath} = planted(t);
  function walk(value, records, at='$') {
    if (typeof value === 'number') {
      assert.ok(records?.length, `${at} has no records`);
      for (const ref of records) {
        const match = /^records.jsonl:(\d+)$/.exec(ref);
        assert.ok(match, ref);
        assert.ok(rows()[Number(match[1])-1], ref);
      }
    }
    if (!value || typeof value !== 'object') return;
    for (const [key,child] of Object.entries(value)) {
      if (key !== 'records') walk(child, value.records ?? records, `${at}.${key}`);
    }
  }
  walk(scoreRun(run,manifestPath,'owned'));
});

test('manifest bytes changed after the run are refused with record identity', t => {
  const {run,manifestPath} = planted(t);
  fs.appendFileSync(manifestPath, ' ');
  assert.throws(()=>scoreRun(run,manifestPath,'owned'), /records.jsonl:1.*alpha.*clothes-1.*manifest_sha256/);
});
test('unknown item is refused with its record identity', t => {
  const records=rows(); records[2].item_id='unknown-item';
  const {run,manifestPath}=planted(t,records);
  assert.throws(()=>scoreRun(run,manifestPath,'owned'), /records.jsonl:3.*unknown-item.*item_id/);
});
test('existing manifest problems reject unsafe manifests', t => {
  const manifest=JSON.parse(fs.readFileSync(path.join(fixture,'manifest.json')));
  manifest.items[0].photos=['../outside.jpg'];
  const bytes=JSON.stringify(manifest);
  const records=rows().map(r=>({...r,manifest_sha256:createHash('sha256').update(bytes).digest('hex')}));
  const {run,manifestPath}=planted(t,records,bytes);
  assert.throws(()=>scoreRun(run,manifestPath,'owned'), /manifest rejected.*photo is not a relative volume path/);
});
test('saleUsable refuses dates before asked_at and accepts only later sales', () => {
  const record={...rows()[0],ref:'records.jsonl:1'};
  assert.throws(()=>saleUsable(record,{sold_at:'2026-11-14T23:59:59Z'}), /records.jsonl:1.*sold_at.*asked_at/);
  assert.throws(()=>saleUsable(record,{sold_at:record.asked_at}), /sold_at.*asked_at/);
  assert.equal(saleUsable(record,{sold_at:'2026-11-16T00:00:00Z'}),true);
});
test('one scoring rule for all tools, sorted alphabetically', t => {
  const records=rows().flatMap(r=>[{...r,tool:'zeta'},{...r,tool:'alpha'}]);
  const {run,manifestPath}=planted(t,records);
  const result=scoreRun(run,manifestPath,'owned');
  assert.deepEqual(result.tools.map(x=>x.tool),['alpha','zeta']);
  const withoutRefs=value=>Array.isArray(value)?value.map(withoutRefs):value && typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>k!=='records').map(([k,v])=>[k,withoutRefs(v)])):value;
  assert.deepEqual(withoutRefs(result.tools[0].rows),withoutRefs(result.tools[1].rows));
});
test('CLI writes results.json inside the supplied run directory', t => {
  const {run,manifestPath}=planted(t);
  const child=spawnSync(process.execPath,[scorer,run,'--manifest',manifestPath,'--set','owned'],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(run,'results.json'))),scoreRun(run,manifestPath,'owned'));
});

for (const [name, change, message] of [
  ['negative latency', r=>{r.first_at='2026-11-14T00:00:00Z';}, /first_at.*asked_at/],
  ['invalid time', r=>{r.full_at='yesterday';}, /full_at/],
  ['impossible calendar date', r=>{r.full_at='2026-02-31T00:00:00Z';}, /full_at.*ISO/],
  ['unknown fact kind', r=>{r.facts[0].kind='invented';}, /facts.*kind/],
  ['negative fact count', r=>{r.facts[0].count=-1;}, /facts.*count/],
  ['end before sale', r=>{r.delist=[{site:'ebay',sold_at:'2026-11-16T00:00:00Z',ended_at:r.asked_at}];r.question='delist';}, /ended_at.*sold_at/],
  ['missing numbers', r=>{delete r.numbers;}, /numbers/],
]) test(`${name} fails loudly at its record`, t=>{
  const records=rows(); change(records[0]);
  const {run,manifestPath}=planted(t,records);
  assert.throws(()=>scoreRun(run,manifestPath,'owned'), error=>/records.jsonl:1/.test(error.message) && message.test(error.message));
});
test('empty and all-failed runs do not invent measured timings or shares', t=>{
  const {run,manifestPath}=planted(t,[rows()[5]]);
  const scored=scoreRun(run,manifestPath,'owned').tools[0].rows;
  assert.equal(scored['1'].coverage.n,0);
  assert.equal(scored['3'].share,null);
  assert.equal(scored['3'].ci95,null);
  assert.equal(scored['8'].first.p50.value,null);
  assert.deepEqual(scored['10'].sites,[]);
  fs.writeFileSync(path.join(run,'records.jsonl'),'');
  assert.throws(()=>scoreRun(run,manifestPath,'owned'),/no records/);
});
test('malformed JSON names the physical line, including blank lines', t=>{
  const {run,manifestPath}=planted(t);
  fs.writeFileSync(path.join(run,'records.jsonl'),JSON.stringify(rows()[0])+'\n\nnot json\n');
  assert.throws(()=>scoreRun(run,manifestPath,'owned'),/records.jsonl:3.*JSON/);
});

test('mixed run ids name the first record that differs from the run', t=>{
  const records=rows(); records[1].run_id='different';
  const {run,manifestPath}=planted(t,records);
  assert.throws(()=>scoreRun(run,manifestPath,'owned'), /records.jsonl:2.*run_id/);
});

test('CLI refuses a bad record without publishing partial results', t=>{
  const records=rows(); records[1].manifest_sha256='0'.repeat(64);
  const {run,manifestPath}=planted(t,records);
  const child=spawnSync(process.execPath,[scorer,run,'--manifest',manifestPath,'--set','owned'],{encoding:'utf8'});
  assert.equal(child.status,1);
  assert.match(child.stderr,/records.jsonl:2.*manifest_sha256/);
  assert.equal(fs.existsSync(path.join(run,'results.json')),false);
});
test('CLI defaults to the existing real-item manifest without modifying it', t=>{
  const manifest=fs.readFileSync(new URL('../spec/items/manifest.json',import.meta.url));
  const record={...rows()[0],manifest_sha256:createHash('sha256').update(manifest).digest('hex')};
  const {run}=planted(t,[record]);
  const child=spawnSync(process.execPath,[scorer,run,'--set','owned'],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  const coverage=JSON.parse(fs.readFileSync(path.join(run,'results.json'))).tools[0].rows['1'].coverage;
  assert.equal(coverage.n,1);
  assert.equal(coverage.of,JSON.parse(manifest).items.length);
  assert.deepEqual(fs.readFileSync(new URL('../spec/items/manifest.json',import.meta.url)),manifest);
});

 test('runner and scorer use the same market set and trace every number', async t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bench-pair-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const manifestPath=path.join(root,'manifest.json');
  const manifest={items:[],market_items:[{id:'market-1',query:'coat'},{id:'market-2',query:'shoes'}]};
  fs.writeFileSync(manifestPath,JSON.stringify(manifest));
  const asked=[];
  const records=await run({manifestPath,outRoot:root,ask:async (endpoint,init)=>{
    if(endpoint==='/v1/search') { asked.push(JSON.parse(init.body).text); return Response.json({results:[{site:'ebay',price_cents:100,url:'https://example.com/item'}]}); }
    return Response.json({code:'unauthenticated'},{status:401});
  }});
  assert.deepEqual(asked,['coat','shoes']);
  const result=scoreRun(path.join(root,records[0].run_id),manifestPath);
  assert.equal(result.tools[0].rows['1'].coverage.n,2);
  assert.equal(result.tools[0].rows['1'].coverage.of,2);
  function walk(value, references, at='$') {
    if(typeof value==='number') {
      assert.ok(references?.length,`${at} has no records`);
      for(const ref of references) {
        const match=/^records\.jsonl:(\d+)$/.exec(ref);
        assert.ok(match && records[Number(match[1])-1],`${at}: ${ref}`);
      }
    }
    if(value && typeof value==='object') for(const [key,child] of Object.entries(value)) if(key!=='records') walk(child,value.records ?? references,`${at}.${key}`);
  }
  walk(result);
});

test('selected set rejects records belonging to the other set', t => {
  const manifest=JSON.parse(fs.readFileSync(path.join(fixture,'manifest.json')));
  manifest.market_items=[{id:'market-1'}];
  const bytes=JSON.stringify(manifest);
  const records=rows().map(r=>({...r,manifest_sha256:createHash('sha256').update(bytes).digest('hex')}));
  const {run,manifestPath}=planted(t,records,bytes);
  assert.throws(()=>scoreRun(run,manifestPath),/item_id is not in the manifest/);
  assert.equal(scoreRun(run,manifestPath,'owned').tools[0].rows['1'].coverage.of,manifest.items.length);
});

test('CLI defaults to market and accepts either option order', t => {
  const manifest=JSON.parse(fs.readFileSync(path.join(fixture,'manifest.json')));
  manifest.market_items=[{id:'market-1'},{id:'market-2'}];
  const bytes=JSON.stringify(manifest);
  const record={...rows()[0],item_id:'market-1',manifest_sha256:createHash('sha256').update(bytes).digest('hex')};
  const {run,manifestPath}=planted(t,[record],bytes);
  for (const args of [['--manifest',manifestPath],['--set','market','--manifest',manifestPath]]) {
    const child=spawnSync(process.execPath,[scorer,run,...args],{encoding:'utf8'});
    assert.equal(child.status,0,child.stderr);
    const coverage=JSON.parse(fs.readFileSync(path.join(run,'results.json'))).tools[0].rows['1'].coverage;
    assert.equal(coverage.n,1); assert.equal(coverage.of,2);
  }
});
