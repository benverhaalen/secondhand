import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
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
test('429 retries once after the stated delay then records error', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bench-')); const path=join(dir,'manifest.json'); await writeFile(path, JSON.stringify({items:[{id:'one',query:'coat'}]})); let calls=0; const waits=[];
  const records=await run({set:'owned',manifestPath:path,outRoot:dir,sleep:async ms=>waits.push(ms),ask:async endpoint=>{if(endpoint==='/v1/search'){calls++;return reply({code:'rate_limited',retry:{after_s:3}},429)} return reply({code:'unauthenticated'},401)}});
  assert.equal(calls,2); assert.deepEqual(waits,[3000]); assert.equal(records[0].error,'rate_limited');
});
test('in-process and HTTP use the same contract for a canned answer', async () => {
  const { route }=await import('../app/src/edge/api/http.ts'); const handler=route('POST /v1/search',()=>({status:200,body:{results:[]}}),{auth:'visitor'});
  const server=createServer(async (req,res)=>{const chunks=[]; for await(const c of req) chunks.push(c); const response=await handler(new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,body:Buffer.concat(chunks)})); res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text())});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try { const a=makeAsk({dispatch:handler}); const b=makeAsk({base:`http://127.0.0.1:${server.address().port}`}); const init={method:'POST',body:JSON.stringify({text:'coat'})}; assert.deepEqual(await (await a('/v1/search',init)).json(),await (await b('/v1/search',init)).json()); } finally { await new Promise(resolve=>server.close(resolve)); }
});

test('default transport invokes the public search and job routes', async () => {
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
