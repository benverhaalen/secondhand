import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLog } from '../log/index.js';
import { fileSink } from '../log/node.js';
import { SOURCES } from '../app/src/edge/intel/public/sources.ts';
import { readPage, searchUrl } from '../app/src/edge/intel/public/readers.ts';
import { answerCost } from './costs.mjs';
import { DEFAULT_PARAMS } from '../app/src/edge/intel/fetch.ts';

const kinds = ['sold_prices','live_listings','official_price','discounts','product_reviews','seller_reviews','demand_trend','time_to_sell','fees_per_site','you_keep','same_item_elsewhere','price_history'];
const amount = x => Number.isInteger(x?.amount_cents) ? x.amount_cents : Number.isInteger(x) ? x : null;
const number = (name, value, citation_id = null, evidence = []) => ({name,value_cents:amount(value),citation_id,evidence});
function mapped(counts = {}, sites = [], numbers = [], range = null) {
  return {sites:[...new Set(sites.filter(x => typeof x === 'string'))],facts:kinds.map(kind=>({kind,count:counts[kind] ?? 0})),numbers,range};
}
const evidence = row => [row.url, ...(Array.isArray(row.evidence) ? row.evidence.filter(x=>typeof x==='string') : [])].filter(Boolean);
function offersMap(body, key) {
  const offers = Array.isArray(body[key]) ? body[key].filter(row => !('dupe_count' in row)) : [];
  const official = Array.isArray(body.official) ? body.official : [];
  return {offers,official, sites:offers.map(x=>x.site), numbers:offers.filter(x=>amount(x.delivered_cents ?? x.price_cents)!==null).map(x=>number('delivered_cents',x.delivered_cents ?? x.price_cents,x.citation_id ?? null,evidence(x)))};
}
export function mapSearch(body) {
  const {offers,official,sites,numbers}=offersMap(body,'results');
  return mapped({live_listings:offers.length,official_price:official.length},sites,numbers);
}
export function mapProduct(body) {
  const {offers,sites,numbers}=offersMap(body,'offers'); const used=body.used_price; const retail=body.retail_price;
  if (amount(retail?.value)!==null) numbers.push(number('retail_price',retail.value,retail.citation_id ?? null,evidence(retail)));
  const low=amount(used?.range?.low), high=amount(used?.range?.high);
  const range=low!==null && high!==null && typeof used.as_of==='string' ? {low_cents:low,high_cents:high,as_of:used.as_of} : null;
  if(range) {numbers.push(number('range_low',low,used.citation_id ?? null,evidence(used)),number('range_high',high,used.citation_id ?? null,evidence(used)));}
  return mapped({sold_prices:Number.isInteger(used?.basis_count)?used.basis_count:0,live_listings:offers.length,official_price:amount(retail?.value)!==null?1:0},sites,numbers,range);
}
export function mapValue(body) {
  const r=body.range; const low=amount(r?.low), high=amount(r?.high); const range=low!==null && high!==null && typeof r.as_of==='string'?{low_cents:low,high_cents:high,as_of:r.as_of}:null;
  return mapped({},[],range?[number('range_low',low,r.citation_id ?? null,evidence(r)),number('range_high',high,r.citation_id ?? null,evidence(r))]:[],range);
}
export function makeAsk({base,dispatch} = {}) {
  let visitor = `vis_${randomUUID().replaceAll('-','').slice(0,16)}`;
  const ask = async (endpoint,init={}) => {
    const headers=new Headers(init.headers); headers.set('X-Visitor-Id',visitor); headers.set('X-Request-Id',`rq_${randomUUID().replaceAll('-','').slice(0,16)}`); if(init.body) headers.set('Content-Type','application/json');
    const req=new Request(new URL(endpoint,base ?? 'http://localhost'),{...init,headers});
    const response=dispatch ? await dispatch(req) : await fetch(req); visitor=response.headers.get('X-Visitor-Id') ?? visitor; return response;
  };
  ask.stream = Boolean(dispatch);
  return ask;
}
async function inProcess() {
  const [{route,paramsOf},search,market,valuations,jobs]=await Promise.all([import('../app/src/edge/api/http.ts'),import('../app/src/edge/api/search.ts'),import('../app/src/edge/api/market.ts'),import('../app/src/edge/api/valuations.ts'),import('../app/src/edge/api/jobs.ts')]);
  const handlers={...search.handlers,...market.handlers,...valuations.handlers,...jobs.routeHandlers};
  const manifest=[...search.manifest,...market.manifest,...valuations.manifest,...jobs.manifest].map(row=>({...row,method:row.endpoint.split(' ')[0]}));
  const wrapped=new Map();
  return makeAsk({dispatch: req=>{const pathname=new URL(req.url).pathname; const row=manifest.find(x=>x.method===req.method && paramsOf(x.endpoint.split(' ')[1],pathname)!==null); if(!row) return Promise.resolve(Response.json({code:'not_found'},{status:404})); if(!wrapped.has(row.endpoint)) wrapped.set(row.endpoint,route(row.endpoint,handlers[row.endpoint],{auth:row.auth})); return wrapped.get(row.endpoint)(req);}});
}
// Dupe permits aggregate observations only; remove its content at the response boundary.
function scrub(body) {
  const host = value => typeof value === 'string' && /mcp\.dupe\.com/i.test(value);
  const source = value => value && typeof value === 'object' && !Array.isArray(value) &&
    (value.site === 'dupe' || value.route_id === 'dupe.search.api' || value.via === 'dupe' || value.via === 'dupe.search.api' ||
     'commercial_link' in value || 'attribution' in value || Object.values(value).some(host));
  function clean(value, key = '') {
    if (typeof value === 'string') {
      // Only an event stream is split by line; a served marketplace page is kept whole, as it was read.
      if (key === 'stream') {
        return value.split('\n').map(line => {
          if (!line.startsWith('data:')) return /(?:dupe|commercial_link|attribution)/i.test(line) ? '' : line;
          try { return 'data: ' + JSON.stringify(clean(JSON.parse(line.slice(5)))); }
          catch { return ''; }
        }).join('\n');
      }
      return host(value) ? undefined : value;
    }
    if (Array.isArray(value)) {
      let removed = 0;
      const rows = value.flatMap(row => {
        if (source(row) && key !== 'searched') { removed++; return []; }
        const cleaned = clean(row, key); return cleaned === undefined ? [] : [cleaned];
      });
      if (removed) rows.push({dupe_count:removed});
      return rows;
    }
    if (!value || typeof value !== 'object') return value;
    if (source(value) && key === 'searched') {
      return Object.fromEntries(Object.entries(value).filter(([k]) => ['site','route_id','kind','outcome','ms','count','pace','dropped','error_code','cached'].includes(k)));
    }
    if (source(value)) return {dupe_count:1};
    return Object.fromEntries(Object.entries(value).flatMap(([k,v]) => {
      if (k === 'commercial_link' || k === 'attribution') return [];
      const cleaned = clean(v,k); return cleaned === undefined ? [] : [[k,cleaned]];
    }));
  }
  return clean(body);
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function run({manifestPath='spec/items/manifest.json',outRoot='bench/out',set='market',tool='secondhand',ask,fetch:fetchPlain=globalThis.fetch,timeoutS=20,sleep=delay,sources=SOURCES}={}) {
  if (!['market','owned'].includes(set)) throw new Error('invalid set: '+set);
  if (!['secondhand','baseline'].includes(tool)) throw new Error('invalid tool: '+tool);
  const bytes=await readFile(manifestPath); const manifest=JSON.parse(bytes); const hash=createHash('sha256').update(bytes).digest('hex');
  const started=new Date(); const runId=started.toISOString().replace(/[:.]/g,'-')+'-'+(tool==='baseline'?'baseline':'ours'); const dir=join(outRoot,runId); await mkdir(join(dir,'raw'),{recursive:true}); const records=[]; let missing=0; const log=createLog({src:'bench.run',build:'dev',sink:fileSink(join(dir,'run.jsonl'))});
  const seenSites=new Set(), capturedSites=new Set(), servedPaths=[];
  if(tool!=='baseline') ask ??= await inProcess();
  log.note('benchmark input',{manifest:manifestPath,set,tool,manifest_sha256:hash});
  function readsOf(searched) {
    return searched.map(read=>{
      const source=sources.find(s=>s.site===read.site);
      const lane=tool==='baseline'?'plain':({public_page:'plain',harness:'cloud_browser',treg:'api',apify:'api'}[source?.lane] ?? source?.lane);
      if(!['plain','cloud_browser','own_browser','official','mcp','api'].includes(lane)) throw new Error(`unknown source lane: ${read.site}`);
      const warm=seenSites.has(read.site); seenSites.add(read.site);
      return {site:read.site,lane,ms:read.ms,outcome:read.outcome,rows:read.count,warm};
    });
  }
  async function question(item,question,endpoint,init,mapper,errorBefore) {
    const asked=new Date(); let first=null, full=null, timeSource='poll', error=errorBefore ?? null, responseBody=null; const raw=[]; const searched=new Map(); let usage;
    function observe(body) {
      const result=body.result ?? body;
      for(const read of result.searched ?? []) searched.set(JSON.stringify([read.site,read.kind,read.url]),read);
      if(result.cost) usage=result.cost;
    }
    async function request(path, options) {
      let res=await log.call('http',path,{method:options?.method ?? 'GET'},()=>ask(path,options),r=>({result:{status:r.status}})); let body=scrub(await res.json()); raw.push({endpoint:path,status:res.status,body});
      if(res.status===429) { await sleep(Math.max(0,Number(body.retry?.after_s ?? 0))*1000); res=await log.call('http',path,{method:options?.method ?? 'GET'},()=>ask(path,options),r=>({result:{status:r.status}})); body=scrub(await res.json()); raw.push({endpoint:path,status:res.status,body}); }
      observe(body); return {res,body};
    }
    async function follow(path, remaining) {
      const res=await log.call('http',path,{method:'GET'},()=>ask(path,{}),r=>({result:{status:r.status}}));
      if(!res.ok) throw new Error(`http_${res.status}`);
      const reader=res.body.getReader(); const decoder=new TextDecoder(); let text='', timer;
      try {
        const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(false),remaining);});
        const consume=(async()=>{while(true) {const part=await reader.read(); if(part.done) return true; text+=decoder.decode(part.value,{stream:true});}})();
        const finished=await Promise.race([consume,timeout]);
        raw.push({endpoint:path,status:res.status,body:scrub({stream:text}).stream});
        return finished;
      } finally {clearTimeout(timer); await reader.cancel();}
    }
    if(!error) {
      try {
        if(tool==='baseline') {
          const url=searchUrl('poshmark',item.query,'search'), t0=performance.now();
          let outcome='timeout', count=0;
          try {
            const res=await log.call('http',url,{method:'GET'},()=>fetchPlain(url,{method:'GET',redirect:'manual'}),r=>({result:{status:r.status}}));
            const html=await res.text(); raw.push({endpoint:url,status:res.status,body:scrub({body:html}).body});
            if(!res.ok) {error=`http_${res.status}`; outcome='blocked';}
            else {
              const read=readPage('poshmark',html);
              if(!read.ok) {error=read.error.code; outcome=read.error.code;}
              else {count=read.data.length; outcome=count?'hit':'empty'; full=new Date().toISOString(); if(count) first=full;}
            }
          } finally {
            searched.set('poshmark',{site:'poshmark',ms:performance.now()-t0,outcome,count});
          }
          responseBody={baseline_count:count};
        } else {
          let {res,body}=await request(endpoint,init); responseBody=body;
          if(!res.ok) error=question==='value' && res.status===401?'needs_user':body.code ?? `http_${res.status}`;
          else if(body.kind && body.id && body.state) {
            const deadline=asked.getTime()+timeoutS*1000;
            while(true) {
              const stages=(body.stages ?? []).filter(s=>s.ended_at);
              const firstStage=stages.filter(s=>s.found?.results_used>0).sort((a,b)=>Date.parse(a.ended_at)-Date.parse(b.ended_at))[0];
              if(firstStage) {first=firstStage.ended_at; timeSource='job';}
              else if(stages.length) first=null;
              else if(!first && (body.result?.results?.length>0 || body.result?.found?.results_used>0 || body.stages?.some(s=>s.found?.results_used>0))) first=new Date().toISOString();
              if(body.state==='done') {full=stages.length?stages.reduce((last,s)=>Date.parse(s.ended_at)>Date.parse(last)?s.ended_at:last,stages[0].ended_at):new Date().toISOString(); if(stages.length) timeSource='job'; responseBody=body.result ?? {}; break;}
              if(['failed','cancelled'].includes(body.state)) {error=body.error?.code ?? body.state; break;}
              const remaining=deadline-Date.now(); if(remaining<=0) {error='timeout'; break;}
              if(ask.stream) {if(!await follow(`/v1/jobs/${encodeURIComponent(body.id)}/events`,remaining)) {error='timeout'; break;}}
              else {await sleep(Math.min(2000,remaining)); if(Date.now()>=deadline) {error='timeout'; break;}}
              ({res,body}=await request(`/v1/jobs/${encodeURIComponent(body.id)}`,{})); responseBody=body;
              if(!res.ok) {error=body.code ?? `http_${res.status}`; break;}
            }
          } else {
            full=new Date().toISOString();
            const answer=mapper(body);
            if(answer.facts.some(f=>f.count>0) || answer.numbers.length) first=full;
          }
        }
      } catch(e) {log.error('bench.request',e); error=`request_failed: ${e.message}`; raw.push({error:String(e)});}
    }
    const rawRef=`raw/${item.id}-${question}.json`; await writeFile(join(dir,rawRef),JSON.stringify(raw,null,2)+'\n');
    const mappedAnswer=tool==='baseline'?mapped({live_listings:responseBody?.baseline_count ?? 0},responseBody?.baseline_count?['poshmark']:[]):mapper(error ? {} : responseBody ?? {});
    const reads=readsOf([...searched.values()]);
    const servedRefs=[];
    if(question==='search' && tool!=='baseline') for(const read of searched.values()) {
      if(!read.url || capturedSites.has(read.site) || !(read.outcome==='page_changed' || (read.outcome==='unknown' && read.reason==='no listing card'))) continue;
      capturedSites.add(read.site);
      try {
        const source=sources.find(s=>s.site===read.site);
        await sleep(source?.min_gap_ms ?? DEFAULT_PARAMS.base_delay_ms[0]);
        const res=await log.call('http',read.url,{method:'GET'},()=>fetchPlain(read.url,{method:'GET',redirect:'manual'}),r=>({result:{status:r.status}}));
        const headers=Object.fromEntries([...res.headers].filter(([name])=>!/cookie|authorization/i.test(name)));
        const served={status:res.status,final_url:res.url || read.url,headers,body:await res.text(),fetched_at:new Date().toISOString()};
        const ref=`raw/${item.id}-${read.site}-served.json`;
        await writeFile(join(dir,ref),JSON.stringify(scrub(served),null,2)+'\n'); servedRefs.push(ref); servedPaths.push(join(dir,ref));
      } catch(e) {log.error('bench.served',e);}
    }
    const cost=tool==='baseline'?answerCost(reads,{browser_s:0,proxy_bytes:0,model_calls:0}):answerCost(reads,usage);
    const cited_facts=mappedAnswer.numbers.filter(n=>n.citation_id || n.evidence.length).length;
    const record={run_id:runId,tool,item_id:item.id,manifest_sha256:hash,question,asked_at:asked.toISOString(),first_at:first,full_at:full,time_source:timeSource,ok:!error,error, ...mappedAnswer,reads,cost,cited_facts,...(tool==='baseline'?{lane:'plain'}:{}),delist:null,raw_ref:rawRef,...(servedRefs.length?{served_ref:servedRefs}:{})};
    log.change('benchmark_answer',`${item.id}:${question}`,error ?? 'done'); records.push(record); await appendFile(join(dir,'records.jsonl'),JSON.stringify(record)+'\n'); return {record,body:responseBody};
  }
  for(const item of manifest[set === 'market' ? 'market_items' : 'items']) {
    if(!item.query) {missing++; await question(item,'search',null,null,mapSearch,'no_query'); continue;}
    if(tool==='baseline') {await question(item,'search',null,null,mapSearch); continue;}
    const search=await question(item,'search','/v1/search',{method:'POST',body:JSON.stringify({text:item.query})},mapSearch);
    const id=search.record.ok && (search.body?.product_id ?? search.body?.product?.id);
    if(id) await question(item,'product',`/v1/products/${encodeURIComponent(id)}`,{},mapProduct);
    await question(item,'value','/v1/valuations',{method:'POST',body:JSON.stringify({item_id:item.id})},mapValue);
  }
  log.end(); process.stdout.write(`${missing} items had no query\n`); for(const path of servedPaths) process.stdout.write(`${path}\n`); return records;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const args=process.argv.slice(2); let base,timeoutS=20,set='market',tool='secondhand';
  for(let i=0;i<args.length;i++) {if(args[i]==='--tool') {if(!args[i+1] || args[i+1].startsWith('--')) throw new Error('missing tool'); tool=args[++i];} else if(args[i]==='--base') base=args[++i]; else if(args[i]==='--set') { if(!args[i+1] || args[i+1].startsWith('--')) throw new Error('missing set'); set=args[++i]; } else if(args[i]==='--timeout-s') timeoutS=Number(args[++i]); else if(args[i]!=='--in-process') throw new Error(`unknown argument: ${args[i]}`);}
  if(!Number.isFinite(timeoutS) || timeoutS<0) throw new Error('invalid timeout');
  await run({timeoutS,set,tool,ask:base?makeAsk({base}):undefined});
}
