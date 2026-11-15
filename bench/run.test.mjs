import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { mapSearch, mapProduct, mapValue, run, makeAsk } from './run.mjs';
const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/run/${name}.json`, import.meta.url)));
const reply = (body, status = 200) => Response.json(body, { status });
test('recorded endpoint responses map only carried facts', async () => {
  const s = mapSearch(await fixture('search')); assert.equal(s.facts.find(x => x.kind === 'live_listings').count, 0);
  const p = mapProduct(await fixture('product')); assert.equal(p.facts.find(x => x.kind === 'sold_prices').count, 41); assert.equal(p.range.low_cents, 8500); assert.deepEqual(p.sites, ['ebay']);
  const v = mapValue(await fixture('value')); assert.equal(v.range, null);
});
test('missing query, hash, 404 and visitor authentication are recorded', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bench-')); const path = join(dir, 'manifest.json'); const bytes = JSON.stringify({items:[{id:'missing'},{id:'one',query:'coat'}]}); await writeFile(path, bytes);
  const ask = async (endpoint) => endpoint === '/v1/search' ? reply({product_id:'pr_missing',results:[]}) : endpoint.startsWith('/v1/products/') ? reply({code:'not_found'},404) : reply({code:'unauthenticated'},401);
  const records = await run({set:'owned',manifestPath:path, outRoot:dir, ask});
  assert.equal(records.find(r=>r.item_id==='missing').error,'no_query'); assert.equal(records.find(r=>r.question==='product').error,'not_found'); assert.equal(records.find(r=>r.question==='value').error,'needs_user');
  assert.ok(records.every(r=>r.manifest_sha256===createHash('sha256').update(bytes).digest('hex')));
});
test('unfinished job times out with no full time', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-')); const path=join(dir,'manifest.json'); await writeFile(path, JSON.stringify({items:[{id:'one',query:'coat'}]}));
  const records=await run({set:'owned',manifestPath:path,outRoot:dir,timeoutS:0,ask:async endpoint=>endpoint==='/v1/search'?reply({id:'job_1',kind:'search',state:'running',stages:[]} ,202):reply({code:'unauthenticated'},401)});
  assert.equal(records[0].error,'timeout'); assert.equal(records[0].full_at,null);
});
test('job stage clocks give first and full times independent of polling', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-clock-')); const path=join(dir,'manifest.json'); await writeFile(path,JSON.stringify({market_items:[{id:'one',query:'coat'}]}));
  let start; const waits=[];
  const records=await run({manifestPath:path,outRoot:dir,sleep:async ms=>waits.push(ms),ask:async endpoint=>{
    if(endpoint==='/v1/search') { start=Date.now(); return reply({id:'job',kind:'search',state:'running',stages:[]}); }
    if(endpoint==='/v1/jobs/job') return reply({id:'job',kind:'search',state:'done',stages:[{ended_at:new Date(start+1200).toISOString(),found:{results_used:0}},{ended_at:new Date(start+600).toISOString(),found:{results_used:1}}],result:{results:[{site:'poshmark'}]}});
    return reply({code:'unauthenticated'},401);
  }});
  assert.equal(records[0].first_at,new Date(start+600).toISOString());
  assert.equal(records[0].full_at,new Date(start+1200).toISOString());
  assert.equal(records[0].time_source,'job'); assert.deepEqual(waits,[2000]);
});
test('job without stage times records poll times', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-poll-')); const path=join(dir,'manifest.json'); await writeFile(path,JSON.stringify({market_items:[{id:'one',query:'coat'}]}));
  const records=await run({manifestPath:path,outRoot:dir,sleep:async()=>{},ask:async endpoint=>endpoint==='/v1/search'?reply({id:'job',kind:'search',state:'running'}):endpoint==='/v1/jobs/job'?reply({id:'job',kind:'search',state:'done',result:{results:[{site:'poshmark'}]}}):reply({code:'unauthenticated'},401)});
  assert.ok(records[0].first_at); assert.ok(records[0].full_at); assert.equal(records[0].time_source,'poll');
});
test('in-process transport follows the event stream before reading the completed job', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-stream-')); const path=join(dir,'manifest.json'); await writeFile(path,JSON.stringify({market_items:[{id:'one',query:'coat'}]})); const calls=[];
  const ask=makeAsk({dispatch:async req=>{const path=new URL(req.url).pathname; calls.push(path);
    if(path==='/v1/search') return reply({id:'job',kind:'search',state:'running'});
    if(path==='/v1/jobs/job/events') return new Response('event: job.state\ndata: {"state":"done"}\n\n',{headers:{'Content-Type':'text/event-stream'}});
    if(path==='/v1/jobs/job') return reply({id:'job',kind:'search',state:'done',stages:[],result:{results:[]}});
    return reply({code:'unauthenticated'},401);
  }});
  const records=await run({manifestPath:path,outRoot:dir,ask,sleep:async()=>assert.fail('stream must not poll')});
  assert.equal(records[0].error,null); assert.deepEqual(calls.slice(0,3),['/v1/search','/v1/jobs/job/events','/v1/jobs/job']);
});
test('429 retries once after the stated delay then records error', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-')); const path=join(dir,'manifest.json'); await writeFile(path, JSON.stringify({items:[{id:'one',query:'coat'}]})); let calls=0; const waits=[];
  const records=await run({set:'owned',manifestPath:path,outRoot:dir,sleep:async ms=>waits.push(ms),ask:async endpoint=>{if(endpoint==='/v1/search'){calls++;return reply({code:'rate_limited',retry:{after_s:3}},429)} return reply({code:'unauthenticated'},401)}});
  assert.equal(calls,2); assert.deepEqual(waits,[3000]); assert.equal(records[0].error,'rate_limited');
});
test('transport invokes the public contract without starting a server', async () => {
  const { route }=await import('../app/src/edge/api/http.ts');
  const handler=route('POST /v1/search',()=>({status:200,body:{results:[]}}),{auth:'visitor'});
  const ask=makeAsk({dispatch:handler});
  assert.deepEqual(await (await ask('/v1/search',{method:'POST',body:JSON.stringify({text:'coat'})})).json(),{results:[]});
});

test('default transport invokes public search and job routes without outside reads', async t => {
  const { ports }=await import('../app/src/edge/api/search.ts');
  const sources=ports.sources; ports.sources=[]; t.after(()=>{ports.sources=sources;});
  const dir=await mkdtemp(join(tmpdir(),'bench-')); const path=join(dir,'manifest.json'); await writeFile(path,JSON.stringify({items:[{id:'one',query:'carhartt j97 xl'}]}));
  const records=await run({set:'owned',manifestPath:path,outRoot:dir,timeoutS:5});
  assert.equal(records[0].error,null); assert.equal(records.find(r=>r.question==='value').error,'needs_user');
});

test('runner selects owned items and rejects an unknown set', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-set-')); const path=join(dir,'manifest.json');
  await writeFile(path,JSON.stringify({items:[{id:'owned',query:'owned query'}],market_items:[{id:'market',query:'market query'}]}));
  const asked=[]; const ask=async (endpoint,init)=>{if(endpoint==='/v1/search') asked.push(JSON.parse(init.body).text); return reply({results:[]});};
  const records=await run({manifestPath:path,outRoot:dir,set:'owned',ask});
  assert.deepEqual(asked,['owned query']); assert.ok(records.every(r=>r.item_id==='owned'));
  await assert.rejects(run({manifestPath:path,outRoot:dir,set:'other',ask}),/invalid set/);
});

test('search reads retain lanes, count citations and go cold then warm without counting polls twice', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-reads-')); const path=join(dir,'manifest.json');
  await writeFile(path,JSON.stringify({market_items:[{id:'one',query:'coat'},{id:'two',query:'shoes'}]}));
  const result={searched:[{site:'poshmark',kind:'search',url:'https://poshmark.com/search',outcome:'hit',ms:120,count:2},{site:'mercari',kind:'search',url:null,outcome:'blocked',ms:60,count:0}],results:[{site:'poshmark',price_cents:100,url:'https://poshmark.com/listing/example'},{site:'poshmark',price_cents:200}]};
  const records=await run({manifestPath:path,outRoot:dir,sleep:async()=>{},ask:async endpoint=>endpoint==='/v1/search'?reply({id:'job',kind:'search',state:'running',result}):endpoint.startsWith('/v1/jobs/')?reply({id:'job',kind:'search',state:'done',result}):reply({code:'unauthenticated'},401)});
  const searches=records.filter(r=>r.question==='search');
  assert.deepEqual(searches[0].reads,[{site:'poshmark',lane:'plain',ms:120,outcome:'hit',rows:2,warm:false},{site:'mercari',lane:'cloud_browser',ms:60,outcome:'blocked',rows:0,warm:false}]);
  assert.ok(searches[1].reads.every(r=>r.warm));
  assert.equal(searches[0].cited_facts,1);
  assert.equal(searches[0].cost.browser_s,.06);
  assert.equal(searches[0].cost.model_calls,null);
  assert.equal(searches[0].cost.cents,null,'missing rates and usage must not become free');
});

test('baseline makes exactly one plain GET per item and only counts recorded cards', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-baseline-')); const path=join(dir,'manifest.json');
  await writeFile(path,JSON.stringify({market_items:[{id:'one',query:'coat'},{id:'two',query:'shoes'}]}));
  const html=await readFile(new URL('./fixtures/run/poshmark.html',import.meta.url),'utf8'); const calls=[];
  const records=await run({tool:'baseline',manifestPath:path,outRoot:dir,ask:()=>assert.fail('baseline must not call harness'),fetch:async(url,init)=>{calls.push({url,init});return new Response(html);}});
  assert.equal(calls.length,2); assert.equal(calls[0].url,'https://poshmark.com/search?query=coat');
  assert.equal(calls[0].init.method,'GET');
  assert.ok(records.every(r=>r.tool==='baseline' && r.question==='search' && r.lane==='plain'));
  assert.equal(records[0].facts.find(f=>f.kind==='live_listings').count,12);
  assert.deepEqual(records[0].numbers,[]);
  assert.equal(records[0].reads[0].warm,false); assert.equal(records[1].reads[0].warm,true);
  assert.equal(records[0].cost.cents,null);
});

test('baseline does not retry a refusal', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-baseline-error-')); const path=join(dir,'manifest.json');
  await writeFile(path,JSON.stringify({market_items:[{id:'one',query:'coat'}]})); let calls=0;
  const records=await run({tool:'baseline',manifestPath:path,outRoot:dir,ask:()=>assert.fail('baseline must not call harness'),fetch:async()=>{calls++; return new Response('blocked',{status:429});}});
  assert.equal(calls,1); assert.equal(records[0].ok,false); assert.equal(records[0].error,'http_429');
});

test('job metadata without marketplace results is not a first answer', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-first-')); const path=join(dir,'manifest.json');
  await writeFile(path,JSON.stringify({market_items:[{id:'one',query:'coat'}]}));
  const records=await run({manifestPath:path,outRoot:dir,timeoutS:0,ask:async endpoint=>endpoint==='/v1/search'?reply({id:'job',kind:'search',state:'running',result:{results:[],sites_pending:['poshmark']}}):reply({code:'unauthenticated'},401)});
  assert.equal(records[0].first_at,null,'metadata is not marketplace results');
});

test('costs never substitute an unknown rate with zero and cloud minutes round up', async () => {
  const { answerCost, RATES }=await import('./costs.mjs');
  assert.equal(RATES.plain,null); assert.equal(RATES.proxy_bytes,null); assert.equal(RATES.model_calls,null);
  const read={lane:'cloud_browser',ms:61000};
  assert.equal(answerCost([read],{proxy_bytes:0,model_calls:0}).cents,.2);
  assert.equal(answerCost([read],{proxy_bytes:1,model_calls:0}).cents,null);
  assert.equal(answerCost([read],{proxy_bytes:0,model_calls:1}).cents,null);
  assert.equal(answerCost([{lane:'plain',ms:1}],{browser_s:0,proxy_bytes:0,model_calls:0}).cents,null);
});

test('an empty page completes without claiming first marketplace results', async () => {
  for(const tool of ['baseline','secondhand']) {
    const dir=await mkdtemp(join(tmpdir(),'bench-empty-')); const path=join(dir,'manifest.json');
    await writeFile(path,JSON.stringify({market_items:[{id:'one',query:'coat'}]}));
    const records=await run({tool,manifestPath:path,outRoot:dir,fetch:async()=>new Response('<html></html>'),ask:async()=>reply({results:[]})});
    assert.equal(records[0].first_at,null,`${tool}: no marketplace results`);
    assert.ok(records[0].full_at);
  }
});

test('served evidence captures the first miss per site, excludes sensitive headers, and leaves answers intact', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-served-')); const path=join(dir,'manifest.json');
  await writeFile(path,JSON.stringify({market_items:[{id:'one',query:'one'},{id:'two',query:'two'},{id:'three',query:'three'}]}));
  const calls=[], waits=[]; let search=0;
  const rows=[
    [{site:'poshmark',url:'https://example.test/one',outcome:'page_changed',ms:1,count:0},{site:'depop',url:'https://example.test/hit',outcome:'hit',ms:1,count:1}],
    [{site:'poshmark',url:'https://example.test/two',outcome:'unknown',reason:'no listing card',ms:1,count:0}],
    [{site:'depop',url:'https://example.test/three',outcome:'unknown',reason:'no listing card',ms:1,count:0}],
  ];
  const records=await run({manifestPath:path,outRoot:dir,sleep:async ms=>waits.push(ms),fetch:async(url,init)=>{calls.push({url,init}); return new Response('<html>served</html>',{status:201,headers:{'set-cookie':'secret','x-cookie-token':'secret','authorization':'secret','content-type':'text/html'}});},ask:async endpoint=>endpoint==='/v1/search'?reply({searched:rows[search++],results:[]}):reply({code:'unauthenticated'},401)});
  const searches=records.filter(r=>r.question==='search');
  assert.deepEqual(calls.map(c=>c.url),['https://example.test/one','https://example.test/three']);
  assert.ok(calls.every(c=>c.init.method==='GET')); assert.deepEqual(waits,[1000,1000]);
  assert.equal(searches[0].served_ref[0],'raw/one-poshmark-served.json'); assert.equal(searches[1].served_ref,undefined);
  const served=JSON.parse(await readFile(join(dir,searches[0].run_id,searches[0].served_ref[0]),'utf8'));
  assert.equal(served.status,201); assert.equal(served.final_url,'https://example.test/one'); assert.equal(served.body,'<html>served</html>'); assert.ok(!Number.isNaN(Date.parse(served.fetched_at)));
  assert.deepEqual(served.headers,{'content-type':'text/html'}); assert.ok(searches.every(r=>r.ok && r.numbers.length===0 && r.facts.every(f=>f.count===0)));
});

test('a failed evidence fetch is logged without changing the answer or retrying the site', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-served-error-')); const path=join(dir,'manifest.json');
  await writeFile(path,JSON.stringify({market_items:[{id:'one',query:'one'},{id:'two',query:'two'}]})); let calls=0;
  const records=await run({manifestPath:path,outRoot:dir,sleep:async()=>{},fetch:async()=>{calls++; throw new Error('capture unavailable');},ask:async endpoint=>endpoint==='/v1/search'?reply({searched:[{site:'poshmark',url:'https://example.test/',outcome:'page_changed',ms:1,count:0}],results:[]}):reply({code:'unauthenticated'},401)});
  assert.equal(calls,1); assert.ok(records.filter(r=>r.question==='search').every(r=>r.ok && !r.served_ref));
  assert.match(await readFile(join(dir,records[0].run_id,'run.jsonl'),'utf8'),/capture unavailable/);
});
