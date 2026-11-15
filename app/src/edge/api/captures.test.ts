import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { ApiError, deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import * as capturesApi from './captures.ts';
import { handlers, manifest, resetCaptures } from './captures.ts';
import type { Attribute } from '../card/card.ts';
import { table } from '../../engines/capture/table.ts';
import type { Store } from '../events/ports.ts';

// Finish refuses a kept photo whose bytes never arrived (d1006a17). Tests about something else stand on a store
// whose read finds every kept photo; tests about photos install a real one with captureBlobs(t).
const { DatabaseSync: KeptDatabase } = await import('node:sqlite');
const { kv: keptKv } = await import('../store/kv.ts');
const { createBlobs: keptBlobs } = await import('../store/blobs.ts');
const { setBlobs: keptSetBlobs } = await import('./uploads.ts');
const { mkdtempSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const keptReal = keptBlobs({ kv: keptKv(new KeptDatabase(':memory:')), dir: mkdtempSync(join(tmpdir(), 'capture-kept-')), origin: 'http://capture.test', log: createLog({ src: 'test', build: 'test', sink: memorySink() }) });
const keptStore: typeof keptReal = { ...keptReal,
  read: async (user_id, photo_id) => await keptReal.read(user_id, photo_id) ?? { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), content_type: 'image/jpeg', capture_id: photo_id.split('-')[0] } };
const keptShared = globalThis as typeof globalThis & { __secondhandPhotos?: typeof keptReal };

const prefixes = ["captures"];
const examples = EXAMPLES.filter(e => prefixes.includes(e.endpoint.split(' ')[1].split('/')[2]));
const exampleCreatedAt = (examples.find(e => e.name === 'captures.open')!.response as {created_at:string}).created_at;
beforeEach(async t => {
  resetCaptures();
  keptShared.__secondhandPhotos = keptStore; keptSetBlobs(keptStore);
  deps.verify = async token => token === 'good' ? 'usr_8f2k' : token === 'other' ? 'usr_other' : null;
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.idem.clear(); deps.visits.clear(); deps.now = () => Date.parse(exampleCreatedAt);
  const { resetItems } = await import('./items.ts');
  resetItems();
  const e = examples.find(e => t.name.startsWith(e.name + ':'));
  const name = e?.name ?? (t.name.startsWith('capture reconnect:') ? 'captures.finish' : '');
  if (['captures.set_type','captures.finish','captures.answer','captures.refuse','captures.generate'].includes(name)) {
    await call(examples.find(e => e.name === 'captures.photos')!);
  }
  if (['captures.finish','captures.answer','captures.refuse','captures.generate'].includes(name)) {
    await call(examples.find(e => e.name === 'captures.set_type')!);
  }
  if (['captures.answer','captures.refuse'].includes(name)) {
    await requestCapture(photosEndpoint,{photos:[photo('back')]});
  }
});
const call = (e: Example, options: { body?: unknown; raw?: string; path?: string; token?: string | null; headers?: Record<string, string> } = {}) => {
  const token = options.token === undefined ? (e.auth === 'visitor' ? null : 'good') : options.token;
  const entry = manifest.find(m => m.endpoint === e.endpoint)!;
  return route(e.endpoint, handlers[e.endpoint], { auth: entry.auth })(new Request('http://edge.test' + (options.path ?? e.path), {
    method: e.endpoint.split(' ')[0],
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...e.request?.headers, ...options.headers },
    body: options.raw ?? (options.body !== undefined ? JSON.stringify(options.body) : e.request?.body === undefined ? undefined : JSON.stringify(e.request.body)),
  }));
};
test('one capture end to end', async t => {
  const blobs=await captureBlobs(t);
  let c=await openedIntent('sell');
  const ids:string[]=[];
  for(const role of ['front','back','tag']) {
    const response=await at(photosEndpoint,c.id,{photos:[{...photo(role),bytes:jpeg.byteLength,...(role==='tag'?{text:[{line:'Carhartt RN 14806',confidence:0}]}:{})}]});
    assert.equal(response.status,201);
    const body=await response.json();c=body.capture;
    const p=body.photos[0];ids.push(`${c.id}-${p.id}`);
    assert.match(p.upload.url,/^http:\/\/capture.test\/v1\/uploads\/[a-f0-9]{64}$/);
    assert.equal(p.upload.method,'PUT');
    const {handlers:uploads}=await import('./uploads.ts');
    const put=await route('PUT /v1/uploads/:id',uploads['PUT /v1/uploads/:id'],{auth:'none',body:'raw',max_bytes:jpeg.byteLength})(new Request(p.upload.url,{method:'PUT',body:jpeg}));
    assert.equal(put.status,204);
  }
  await capturesApi.pendingIdentify('usr_8f2k',c.id);
  c=await joinedCapture(c.id);
  const q=c.plan.questions.find(q=>q.field==='brand')!;assert.ok(q);
  const option=q.options.find(o=>o.value==='Carhartt')!;
  assert.equal(option.proposed,true);assert.ok(option.rests_on?.some(s=>s.includes('RN 14806')));
  const jobId=capturesApi.captureRows.get(c.id)!.identify_job_id!;
  const {getJob}=await import('./jobs.ts');
  const job=await route('GET /v1/jobs/:id',getJob())(new Request(`http://edge.test/v1/jobs/${jobId}`,{headers:{Authorization:'Bearer good'}}));
  const result=await job.json();assert.equal(result.state,'done');assert.deepEqual(result.stages.map((s:{name:string})=>s.name),['code','tag','visual','model']);
  c=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,answer:{ask_id:q.id,field:'brand',value:'Carhartt'}}));
  const finish=await at(finishEndpoint,c.id,{version:c.version});assert.equal(finish.status,202);
  assert.ok((await finish.json()).jobs.some((j:{id:string})=>j.id===jobId));
  assert.equal((await at('GET /v1/captures/:id',c.id,undefined,'other')).status,404);
  assert.equal((await route('GET /v1/jobs/:id',getJob())(new Request(`http://edge.test/v1/jobs/${jobId}`,{headers:{Authorization:'Bearer other'}}))).status,404);
  for(const id of ids) {assert.ok(await blobs.read('usr_8f2k',id));assert.equal(await blobs.read('usr_other',id),undefined);}
});

test('with TREG_TOKEN and a public address, a capture sent as the app sends it (no tag text) gets its brand from Lens once the front photo lands', async t => {
  await captureBlobs(t);
  const saved={token:process.env.TREG_TOKEN,origin:process.env.SECONDHAND_PUBLIC_ORIGIN};
  process.env.TREG_TOKEN='test-token';process.env.SECONDHAND_PUBLIC_ORIGIN='https://api.test';
  t.after(()=>{for(const [name,value] of [['TREG_TOKEN',saved.token],['SECONDHAND_PUBLIC_ORIGIN',saved.origin]] as const)
    if(value===undefined) delete process.env[name]; else process.env[name]=value;});
  const replay=readFileSync(new URL('../identify/fixtures/lens-carhartt.json',import.meta.url),'utf8');
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(replay,{status:200,headers:{'X-Treg-Cost-Micro':'3000'}});});
  let c=await openedIntent('sell');
  const {handlers:uploads}=await import('./uploads.ts');
  for(const role of ['front','back','tag']) {
    const body=await (await at(photosEndpoint,c.id,{photos:[{...photo(role),bytes:jpeg.byteLength}]})).json();c=body.capture;
    const put=await route('PUT /v1/uploads/:id',uploads['PUT /v1/uploads/:id'],{auth:'none',body:'raw',max_bytes:jpeg.byteLength})(new Request(body.photos[0].upload.url,{method:'PUT',body:jpeg}));
    assert.equal(put.status,204);
  }
  await capturesApi.pendingIdentify('usr_8f2k',c.id);
  c=await joinedCapture(c.id);
  assert.equal(calls,1,'one Lens call for the capture');
  const brand=c.plan.questions.find(q=>q.field==='brand');
  assert.ok(brand?.options.some(o=>o.value==='Carhartt'),'Lens offers Carhartt as the brand');
});

test('captures: every specified endpoint is registered and declares its answer source', () => {
  assert.deepEqual(Object.keys(handlers).sort(), [...new Set(examples.filter(e => e.status < 400).map(e => e.endpoint))].sort());
  assert.deepEqual(manifest.map(m => m.endpoint).sort(), Object.keys(handlers).sort());
  for (const m of manifest) assert.ok(['example', 'engine'].includes(m.source));
});
for (const e of examples.filter(e => e.status < 400)) test(e.name + ': response equals its contract example', async () => {
  const r = await call(e);
  assert.equal(r.status, e.status);
  assert.ok(r.headers.get('X-Request-Id'));
  for (const [key, value] of Object.entries(e.headers ?? {})) assert.equal(r.headers.get(key), value);
  if (e.response === null) assert.equal(await r.text(), '');
  else assert.deepEqual(await r.json(), e.response);
});
for (const e of examples.filter(e => e.status < 400 && e.auth !== 'visitor' && e.endpoint !== 'POST /v1/captures')) test(e.name + ': wrong user cannot read or act on example data', async () => {
  const r = await call(e, { token: 'other' });
  assert.equal(r.status, 404); assert.equal((await r.json()).code, 'not_found');
});
for (const e of examples.filter(e => e.status < 400 && e.endpoint.includes(':id'))) test(e.name + ': unknown resource is 404', async () => {
  const pattern = e.endpoint.split(' ')[1].split('/'), parts = e.path.split('?')[0].split('/');
  parts[pattern.indexOf(':id')] = 'not_mine';
  const r = await call(e, { path: parts.join('/') });
  assert.equal(r.status, 404); assert.equal((await r.json()).code, 'not_found');
});
for (const e of examples.filter(e => e.status < 400 && ['POST', 'PATCH', 'PUT'].includes(e.endpoint.split(' ')[0]))) test(e.name + ': malformed body is 400 with code', async () => {
  for (const raw of ['{', '[]', 'null']) {
    const r = await call(e, { raw }); assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
  }
  if (e.request?.body && Object.keys(e.request.body).length) {
    const r = await call(e, { body: {} }); assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
  }
});
for (const e of examples.filter(e => e.status < 400 && e.endpoint.startsWith('POST '))) test(e.name + ': reconnect replays same action and rejects changed body', async () => {
  const headers = { 'Idempotency-Key': 'test_reconnect', ...(e.auth === 'visitor' ? { 'X-Visitor-Id': 'vis_worker01' } : {}) };
  const first = await call(e, { headers }), again = await call(e, { headers });
  assert.equal(again.status, first.status); assert.equal(await again.text(), await first.text());
  assert.equal(again.headers.get('Idempotent-Replayed'), 'true');
  const changed = await call(e, { headers, body: { ...((e.request?.body ?? {}) as object), changed: true } });
  assert.equal(changed.status, 409); assert.equal((await changed.json()).code, 'idempotency_mismatch');
});

for (const e of examples.filter(e => e.status < 400 && e.auth !== 'visitor')) test(e.name + ': no bearer is 401', async () => {
  assert.equal((await call(e, { token: null })).status, 401);
});
for (const e of examples.filter(e => e.status < 400 && e.request?.body && typeof e.request.body === 'object' && 'version' in e.request.body)) test(e.name + ': stale version cannot act', async () => {
  const body = e.request!.body as Record<string, unknown>;
  const r = await call(e, { body: { ...body, version: Number(body.version) + 100 } });
  assert.equal(r.status, 409); const error = await r.json(); assert.equal(error.code, 'stale'); assert.equal(error.current.version, body.version);
});
test('captures: limit over 100 is refused', async () => {
  const e = examples.find(e => e.status < 400)!;
  const r = await call(e, { path: e.path + (e.path.includes('?') ? '&' : '?') + 'limit=101' });
  assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
});

test('captures: malformed field values name the validation failure', async () => {
  const cases: [string, unknown][] = [["captures.photos",{"photos":[{"role":"front","step":"front","content_type":"image/jpeg","bytes":-1}]}],["captures.set_type",{"version":2,"type":"unknown"}]];
  for (const [name, body] of cases) {
    const e = examples.find(e => e.name === name)!;
    const r = await call(e, { body }); assert.equal(r.status, 400, name);
    const error = await r.json(); assert.equal(error.code, 'invalid'); assert.equal(error.failed_step, 'validate');
  }
});

test('capture reconnect: finish jobs resume after the last frame through the existing job stream', async () => {
  const { jobEvents, memoryJobs, seedExamples } = await import('./jobs.ts');
  const s = memoryJobs(); seedExamples(s);
  const finished = await call(examples.find(e => e.name === 'captures.finish')!);
  const body = await finished.json(); const job = body.jobs.find((j: { id: string }) => j.id === 'job_9a');
  assert.ok(job);
  const frames = s.framesAfter(job.id, 0); assert.ok(frames.length > 1);
  const last = frames[0].id;
  const response = await route('GET /v1/jobs/:id/events', jobEvents(s))(new Request('http://edge.test/v1/jobs/' + job.id + '/events', { headers: { Authorization: 'Bearer good', 'Last-Event-ID': String(last) } }));
  assert.equal(response.status, 200);
  const reader = response.body!.getReader(); const chunk = await reader.read(); await reader.cancel();
  const ids = [...new TextDecoder().decode(chunk.value).matchAll(/^id: (\d+)$/gm)].map(m => Number(m[1]));
  assert.ok(ids.length); assert.ok(ids.every(id => id > last));
});

test('captures: owned Expo files bind auth and export the contract method', async () => {
  const { readFileSync } = await import('node:fs');
  for (const entry of manifest) {
    const [method, pattern] = entry.endpoint.split(' '), parts = pattern.split('/').slice(2);
    if (parts[0] !== 'captures') continue;
    const relative = parts.map(p => p.startsWith(':') ? '[' + p.slice(1) + ']' : p).join('/') + (parts.length === 1 || parts.at(-1)!.startsWith(':') ? '/index+api.ts' : '+api.ts');
    const source = readFileSync(new URL('../../app/v1/' + relative, import.meta.url), 'utf8');
    assert.ok(source.includes("import '@/edge/auth'"), relative);
    assert.ok(source.includes("export const " + method + " = route('" + entry.endpoint + "'"), relative);
    if (entry.auth === 'visitor') assert.ok(source.includes("auth: 'visitor'"), relative);
  }
});

test('capture routes expose the exact engine plan and finish while shooting', async () => {
  const opened = await call(examples.find(e => e.name === 'captures.open')!);
  const body = await opened.json();
  assert.ok(body.plan, 'open must return the capture engine plan');
  const finished = await call(examples.find(e => e.name === 'captures.finish')!, { body: {version: body.version} });
  assert.equal(finished.status, 202);
  assert.equal((await finished.json()).capture.plan.status, 'shooting');
});

import { plan, type State } from '../../engines/capture/plan.ts';
import { memoryStore } from '../../engines/param/param.ts';
import { walks } from '../../engines/capture/walks.ts';

test('capture plan speed', t => {
  const times: number[] = [];
  let states = 0;
  for (const walk of walks) {
    const state = structuredClone(walk.initial), params = memoryStore();
    let asked = 0;
    for (const event of walk.events) {
      const previous = plan(state, params);
      asked += previous.questions.filter(q => q.kind === 'shot'
        ? event.patch.retakes?.[q.field] !== undefined
        : q.field === 'type' ? event.patch.type !== undefined
        : event.patch.facts?.[q.field]?.source === 'you_said' || event.patch.refused?.includes(q.field)).length;
      const oldFacts = state.facts;
      Object.assign(state, structuredClone(event.patch));
      state.facts = {...oldFacts, ...event.patch.facts};
      const expected = plan(state, params);
      assert.deepEqual(expected.questions.map(q => [q.field, q.kind, q.options.find(o => o.proposed)?.value ?? null]), event.questions);
      for (let i = 0; i < 20; i++) plan(state, params);
      for (let i = 0; i < 200; i++) {
        const start = performance.now();
        const result = plan(state, params);
        times.push(performance.now() - start);
        assert.equal(result.status, expected.status);
      }
      states++;
    }
    assert.equal(plan(state, params).status, 'done');
    t.diagnostic(`capture.questions ${walk.name}=${asked}`);
  }
  times.sort((a,b) => a-b);
  const p50 = times[Math.floor(times.length * .5)], p95 = times[Math.floor(times.length * .95)];
  t.diagnostic(`capture.plan p50_ms=${p50.toFixed(3)} p95_ms=${p95.toFixed(3)} states=${states}`);
  assert.ok(p95 < 100, `capture next view p95 ${p95} ms must be under 100 ms`);
});

test('capture route dependencies support Metro web export', async () => {
  const { readFileSync } = await import('node:fs');
  const visited = new Set<string>();
  function check(file: URL) {
    if (visited.has(file.href)) return;
    visited.add(file.href);
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /import\.meta|\breadFileSync\b/, file.pathname);
    // Strip comments and strings, then track braces: await at module scope cannot be bundled.
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, '');
    let depth = 0;
    for (const token of code.matchAll(/\{|\}|\bawait\b/g)) {
      if (token[0] === '{') depth++;
      else if (token[0] === '}') depth--;
      else assert.ok(depth > 0, `${file.pathname}: top-level await`);
    }
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      const next = new URL(match[1], file);
      if (next.pathname.includes('/engines/capture/') && next.pathname.endsWith('.ts')) check(next);
    }
  }
  check(new URL('./captures.ts', import.meta.url));
});

const requestCapture = async (endpoint: string, body?: unknown, token = 'good') => route(endpoint, handlers[endpoint])(new Request('http://edge.test' + endpoint.split(' ')[1].replace(':id', 'cap_3n9q'), {
  method: endpoint.split(' ')[0], headers: {Authorization: `Bearer ${token}`, 'Idempotency-Key': `walk_${++requestNumber}`},
  ...(body === undefined ? {} : {body: JSON.stringify(body)}),
}));
let requestNumber = 0;
const photo = (step: string, reads: unknown[] = []) => ({role: step, step, content_type: 'image/jpeg', bytes: 1000, reads});
// One kept front photo, for tests about finish that are not about photos (finish refuses a capture with none, d1006a17).
function keepFront(id: string, rows: typeof capturesApi.captureRows = capturesApi.captureRows) {
  const row = rows.get(id)!;
  row.photo_rows = [...(row.photo_rows ?? []), {id: `${id}-ph_kept`, key: 'front', role: 'front'}];
  if (!row.state.kept.includes('front')) row.state.kept.push('front');
}
const patchEndpoint = 'PATCH /v1/captures/:id';
const photosEndpoint = 'POST /v1/captures/:id/photos';
const openInput = {mode:'shots',purpose:'sell',suggestion:{family:'apparel',p:.86,second_p:.05},device:{has_lidar:true,object_capture:true}};
async function routeWalk() {
  const bodies: unknown[] = [];
  let questions = 0;
  const state: State = {capture_id:'cap_3n9q',item_id:'it_7c2m',purpose:'sell',confirm_mode:'tap',has_lidar:true,object_capture:true,sites:['ebay','poshmark'],type:null,suggestion:{family:'apparel',p:.86,second_p:.05},kept:[],retakes:{},facts:{},lookups:'none',refused:[]};
  const params = memoryStore();
  async function step(endpoint: string, input?: unknown) {
    const response = await requestCapture(endpoint, input);
    assert.ok(response.status < 300, JSON.stringify(await response.clone().json()));
    const body = await response.json();
    // An upload target is a fresh single-use token each time; the walk compares everything else.
    bodies.push(JSON.parse(JSON.stringify(body, (k, v) => k === 'upload' ? { method: v.method } : v)));
    const capture = body.capture ?? body;
    assert.deepEqual(capture.plan, plan(state,params), 'route question order and entire plan match engine for the same state');
    return capture;
  }
  let capture = await step('POST /v1/captures',openInput);
  state.kept=['front']; state.lookups='running';
  state.facts.colour={value:['black'],source:'seen',confidence:.9,step:'front'};
  capture = await step(photosEndpoint,{photos:[photo('front',[{field:'colour',value:['black'],source:'seen',confidence:.9}])]});
  state.type='apparel';
  capture = await step(patchEndpoint,{version:capture.version,type:'apparel'});
  state.kept.push('back');
  capture = await step(photosEndpoint,{photos:[photo('back')]});
  state.kept.push('tag');
  state.facts.size_label={value:'M',source:'label',confidence:.97,step:'tag'};
  state.facts.brand={value:'Gildan',source:'label',confidence:.96,step:'tag'};
  capture = await step(photosEndpoint,{photos:[photo('tag',[{field:'size_label',value:'M',source:'label',confidence:.97},{field:'brand',value:'Gildan',source:'label',confidence:.96}])]});
  const answers: Record<string,unknown> = {condition:'good',size_label:'M',dimensions:{pit_to_pit:52,length:71},department:'unisex',fabric:'cotton',brand:'Gildan'};
  for(let i=0;capture.plan.status!=='done' && i<20;i++) {
    const q = capture.plan.questions[0]; assert.ok(q,'a route-only walk must have a next question');
    const value=answers[q.field] ?? q.options[0]?.value;
    assert.notEqual(value,undefined,`fixture answer for ${q.field}`);
    state.facts[q.field]={value,source:'you_said',confidence:1,confirmed:true};
    questions++;
    capture = await step(patchEndpoint,{version:capture.version,answer:{field:q.field,value}});
  }
  assert.equal(capture.plan.status,'done');
  for(const site of state.sites) assert.equal(capture.plan.complete[site].ready,true,site);
  return {bodies, questions};
}
test('T-shirt walks through routes twice with deterministic bodies', async t => {
  const {resetCaptures}=await import('./captures.ts');
  resetCaptures(); const first=await routeWalk();
  resetCaptures(); deps.idem.clear(); assert.deepEqual(await routeWalk(),first);
  t.diagnostic(`capture.route.questions T-shirt=${first.questions}`);
});

async function askingCapture(): Promise<CaptureBody> {
  let response=await requestCapture('POST /v1/captures',openInput);
  let capture=await response.json();
  response=await requestCapture(patchEndpoint,{version:capture.version,type:'apparel'}); capture=await response.json();
  response=await requestCapture(photosEndpoint,{photos:[photo('front'),photo('back'),photo('tag',[{field:'size_label',value:'M',source:'label',confidence:.97}])]});
  return (await response.json()).capture;
}
test('answers validate current questions, enums and versions without writing', async () => {
  const c=await askingCapture();
  for(const [body,status,field] of [
    [{version:c.version-1,answer:{field:'condition',value:'good'}},409,undefined],
    [{version:c.version,answer:{field:'unasked',value:'x'}},422,'unasked'],
    [{version:c.version,answer:{field:'condition',value:'impossible'}},422,'condition'],
  ] as const) {
    const r=await requestCapture(patchEndpoint,body); assert.equal(r.status,status);
    const error=await r.json();
    if(field) {assert.equal(error.code,'invalid');assert.deepEqual(error.fields,[field]);}
    else assert.equal(error.current.version,c.version);
  }
  assert.equal((await requestCapture('GET /v1/captures/:id',undefined,'other')).status,404);
});
test('refused questions never return after later photos', async () => {
  let c=await askingCapture();
  let r=await requestCapture(patchEndpoint,{version:c.version,refuse:'condition'}); assert.equal(r.status,200);c=await r.json();
  assert.ok(!c.plan.questions.some((q:{field:string})=>q.field==='condition'));
  r=await requestCapture(photosEndpoint,{photos:[photo('front',[{field:'condition',value:'good',source:'seen',confidence:.99}])]});
  c=(await r.json()).capture;assert.ok(!c.plan.questions.some((q:{field:string})=>q.field==='condition'));
});
test('not_read tag allows two retakes then asks size without a proposal', async () => {
  await requestCapture('POST /v1/captures',openInput);
  const reads=[{field:'size_label',value:null,unknown_reason:'not_read'}];
  for(let i=0;i<3;i++) {
    const r=await requestCapture(photosEndpoint,{photos:i===0?[photo('front'),photo('back'),photo('tag',reads)]:[photo('tag',reads)]});
    const c=(await r.json()).capture;
    assert.equal(c.plan.questions.some((q:{shot?:{step:string}})=>q.shot?.step==='tag'),i<2);
    if(i===2) { const q=c.plan.questions.find((q:{field:string})=>q.field==='size_label');assert.ok(q);assert.ok(q.options.every((o:{proposed:boolean})=>!o.proposed)); }
  }
});

type CaptureBody = {id:string;item_id:string;version:number;state:string;created_at:string;plan:ReturnType<typeof plan>};
async function bodyOf(response: Response): Promise<CaptureBody> {
  assert.ok(response.status < 300, JSON.stringify(await response.clone().json()));
  const body = await response.json();
  return body.capture ?? body;
}
const getCapture = () => requestCapture('GET /v1/captures/:id').then(bodyOf);
function job(result: unknown, user = 'usr_8f2k', id = 'cap_3n9q'): CaptureBody {
  assert.ok('applyJobResult' in capturesApi, 'capture route exports applyJobResult');
  return (capturesApi.applyJobResult as (user:string,id:string,result:unknown)=>CaptureBody)(user,id,result);
}
const fieldOf = (capture:CaptureBody, field:string) => capture.plan.fields.find(f=>f.field===field)!;

function throughCopy(copy:typeof capturesApi,endpoint:string,id='',body?:unknown,token='other') {
  return route(endpoint,copy.handlers[endpoint])(new Request('http://edge.test'+endpoint.split(' ')[1].replace(':id',id),{
    method:endpoint.split(' ')[0],headers:{Authorization:`Bearer ${token}`},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  }));
}

test('separate capture modules preserve an open capture through read, PATCH, finish and reset',async()=>{
  const a:typeof capturesApi=await import(new URL('./captures.ts?copy=a',import.meta.url).href);
  a.resetCaptures();
  const opened=await bodyOf(await throughCopy(a,'POST /v1/captures','',openInput));
  const b:typeof capturesApi=await import(new URL('./captures.ts?copy=b',import.meta.url).href);
  let c=await bodyOf(await throughCopy(b,'GET /v1/captures/:id',opened.id));
  assert.equal(c.id,opened.id,'importing another route module must preserve the open capture');
  c=await bodyOf(await throughCopy(b,patchEndpoint,c.id,{version:c.version,type:'apparel'}));
  assert.equal(c.version,opened.version+1,'another route module must update the same capture');
  keepFront(c.id,b.captureRows);
  const finished=await throughCopy(b,finishEndpoint,c.id,{version:c.version});
  assert.equal(finished.status,202,'another route module must finish the open capture');
  await a.pendingIdentify('usr_other',c.id);
  assert.equal((await bodyOf(await throughCopy(a,'GET /v1/captures/:id',c.id))).state,'judged');
  const next=await bodyOf(await throughCopy(b,'POST /v1/captures','',openInput));
  assert.notEqual(next.id,opened.id,'two captures never share an id');
  assert.notEqual(next.item_id,opened.item_id,'two captures never share an item id');
  assert.equal(a.captureRows,b.captureRows,'the exported capture map must be shared');
  b.resetCaptures();
  assert.equal((await throughCopy(a,'GET /v1/captures/:id',next.id)).status,404,'reset must clear every route module');
  assert.notEqual((await bodyOf(await throughCopy(a,'POST /v1/captures','',openInput))).id,opened.id,'a reset must not restart the ids');
});

test('two people opening through separate capture modules have distinct ids and private captures',async()=>{
  const a:typeof capturesApi=await import(new URL('./captures.ts?copy=a',import.meta.url).href);
  const b:typeof capturesApi=await import(new URL('./captures.ts?copy=b',import.meta.url).href);
  a.resetCaptures();
  deps.verify=async token=>token==='other'?'usr_other':token==='third'?'usr_third':null;
  const first=await bodyOf(await throughCopy(a,'POST /v1/captures','',openInput,'other'));
  const second=await bodyOf(await throughCopy(b,'POST /v1/captures','',openInput,'third'));
  assert.notEqual(first.id,second.id,'two people must never receive the same capture id');
  assert.notEqual(first.item_id,second.item_id,'two people must never receive the same item id');
  for(const copy of [a,b]) {
    for(const [own,foreign,token] of [[first,second,'other'],[second,first,'third']] as const) {
      assert.equal((await bodyOf(await throughCopy(copy,'GET /v1/captures/:id',own.id,undefined,token))).id,own.id);
      assert.equal((await throughCopy(copy,'GET /v1/captures/:id',foreign.id,undefined,token)).status,404,'a route module must reject another person\'s capture');
    }
  }
});

async function lookupCapture(token='good') {
  let c=await bodyOf(await requestCapture('POST /v1/captures',{mode:'shots',purpose:'sell',rigid:true,extent_cm:30},token));
  assert.equal(capturesApi.captureRows.get(c.id)!.state.lookups,'none');
  c=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,type:'other'},token));
  return bodyOf(await at(photosEndpoint,c.id,{photos:c.plan.process.map(step=>photo(step.key))},token));
}
test('F18: no job result holds brand and dimensions before 15 seconds and asks them after the wait', async () => {
  let now=Date.parse(exampleCreatedAt);deps.now=()=>now;
  const c=await lookupCapture();
  assert.ok(c.plan.process.every(step=>step.state==='kept'));
  const version=c.version;
  now+=14_999;
  const before=await bodyOf(await at('GET /v1/captures/:id',c.id));
  for(const field of ['brand','dimensions']) {
    assert.equal(fieldOf(before,field).state,'waiting',`${field} must wait before the deadline`);
    assert.ok(!before.plan.questions.some(q=>q.field===field),`${field} must not be asked before the deadline`);
  }
  assert.notEqual(before.plan.status,'done');
  now+=2;
  const after=await bodyOf(await at('GET /v1/captures/:id',c.id));
  for(const field of ['brand','dimensions']) assert.ok(after.plan.questions.some(q=>q.field===field),`${field} must be asked after the deadline without a job result`);
  assert.equal(after.version,version,'GET timeout must not write a version');
});
test('F18: lookup start is ISO deps.now and later photos and timeout plans keep the stored lookup running', async () => {
  let now=Date.parse(exampleCreatedAt);deps.now=()=>now;
  const c=await lookupCapture();
  const started=new Date(now).toISOString();
  assert.equal(capturesApi.captureRows.get(c.id)!.state.lookups_at,started);
  now+=15_000;
  const after=await bodyOf(await at(photosEndpoint,c.id,{photos:[photo(c.plan.process[0].key)]}));
  assert.ok(after.plan.questions.some(q=>q.field==='brand'),'photo response must use the elapsed deadline at exactly 15 seconds');
  const row=capturesApi.captureRows.get(c.id)!;
  assert.equal(row.state.lookups_at,started,'later photos must not restart the wait');
  assert.equal(row.state.lookups,'running','only the effective planning state can become done');
});
test('F18: PATCH accepts a lookup answer after the deadline using the same effective plan', async () => {
  let now=Date.parse(exampleCreatedAt);deps.now=()=>now;
  const c=await lookupCapture();
  assert.equal((await at(patchEndpoint,c.id,{version:c.version,answer:{field:'brand',value:'Acme'}})).status,422);
  now+=15_000;
  const after=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,answer:{field:'brand',value:'Acme'}}));
  assert.equal(fieldOf(after,'brand').state,'known');
  assert.ok(after.plan.questions.some(q=>q.field==='dimensions'),'PATCH response must use the elapsed plan');
  assert.equal(capturesApi.captureRows.get(c.id)!.state.lookups,'running');
});
test('F18: finish returns the elapsed plan while stored lookups remain running', async () => {
  let now=Date.parse(exampleCreatedAt);deps.now=()=>now;
  const c=await lookupCapture();now+=15_000;
  const after=await bodyOf(await at('POST /v1/captures/:id/finish',c.id,{version:c.version}));
  for(const field of ['brand','dimensions']) assert.ok(after.plan.questions.some(q=>q.field===field),`finish must use elapsed ${field}`);
  // Finish now waits for a running identify before it writes the item (d1006a17), so the lookups have ended.
  assert.equal(capturesApi.captureRows.get(c.id)!.state.lookups,'done');
});
test('F18: identify inside the wait settles brand and dimensions without a question', async () => {
  let now=Date.parse(exampleCreatedAt);deps.now=()=>now;
  const c=await lookupCapture();now+=5_000;
  const after=job(identify([{...product,family:'other'}]),'usr_8f2k',c.id);
  assert.equal(capturesApi.captureRows.get(c.id)!.state.lookups,'done');
  for(const field of ['brand','dimensions']) {
    assert.equal(fieldOf(after,field).state,'known',`identify must settle ${field} inside the wait`);
    assert.ok(!after.plan.questions.some(q=>q.field===field),`identify must avoid a ${field} question`);
  }
});
test('F18: identify brand keeps lookup confidence and never replaces an owner answer', async () => {
  let now=Date.parse(exampleCreatedAt);deps.now=()=>now;
  const c=await lookupCapture();now+=5_000;
  let after=job(identify([{...product,family:'other',c:.8}]),'usr_8f2k',c.id);
  assert.equal(fieldOf(after,'brand').state,'proposed','a weak identify result must not silently settle brand');
  assert.ok(after.plan.questions.some(q=>q.field==='brand'));
  assert.deepEqual(capturesApi.captureRows.get(c.id)!.state.facts.brand,{value:product.brand,source:'lookup',confidence:.8});
  after=await bodyOf(await at(patchEndpoint,c.id,{version:after.version,answer:{field:'brand',value:'Owner brand'}}));
  const owner=structuredClone(capturesApi.captureRows.get(c.id)!.state.facts.brand);
  job(identify([{...product,family:'other'}]),'usr_8f2k',c.id);
  assert.deepEqual(capturesApi.captureRows.get(c.id)!.state.facts.brand,owner);
});
test('F18: one persons elapsed capture never finishes another persons lookup wait', async () => {
  let now=Date.parse(exampleCreatedAt);deps.now=()=>now;
  const a=await lookupCapture();now+=10_000;
  const b=await lookupCapture('other');now+=5_000;
  const before=structuredClone(capturesApi.captureRows.get(b.id));
  const elapsed=await bodyOf(await at('GET /v1/captures/:id',a.id));
  const waiting=await bodyOf(await at('GET /v1/captures/:id',b.id,undefined,'other'));
  for(const field of ['brand','dimensions']) {
    assert.ok(elapsed.plan.questions.some(q=>q.field===field),`first persons ${field} wait must end`);
    assert.equal(fieldOf(waiting,field).state,'waiting',`second persons ${field} must still wait`);
    assert.ok(!waiting.plan.questions.some(q=>q.field===field));
  }
  assert.deepEqual(capturesApi.captureRows.get(b.id),before);
  assert.equal((await at('GET /v1/captures/:id',a.id,undefined,'other')).status,404);
});

test('new capture rows are captured, use deterministic timestamps, and updates preserve creation time', async () => {
  resetCaptures();
  let now = Date.parse('2026-11-15T12:00:00.000Z');
  deps.now = () => now;
  const opened = await bodyOf(await requestCapture('POST /v1/captures',{mode:'shots',purpose:'sell'}));
  const row = capturesApi.captureRows.get(opened.id);
  assert.ok(row);
  assert.equal(row.data,'captured');
  assert.equal(row.created_at,'2026-11-15T12:00:00.000Z');
  assert.equal(row.updated_at,row.created_at);
  const createdAt = row.created_at;
  now = Date.parse('2026-11-15T12:01:00.000Z');
  await requestCapture(patchEndpoint,{version:opened.version,type:'apparel'});
  const updated = capturesApi.captureRows.get(opened.id);
  assert.ok(updated);
  assert.equal(updated.created_at,createdAt);
  assert.equal(updated.updated_at,'2026-11-15T12:01:00.000Z');
});

test('seeded capture row is marked as example data', () => {
  const seeded = capturesApi.captureRows.get('cap_3n9q');
  assert.ok(seeded);
  assert.equal(seeded.data,'example');
});
const identify = (set:unknown[], action = 'confirm') => ({kind:'identify',action,set});
const product = {product_id:'pr_table',family:'furniture',brand:'IKEA',model:'LACK',c:.98,dimensions:{width:55,depth:55,height:45}};
const studioResult = {kind:'studio_plan',plan:{kind:'tee',asks:[{type:'flaw',text:'Show the mark.',zone:'hem',kind:'stain'}]}};
const scoreResult = (sharpness = .3, role = 'tag') => ({kind:'photo_score',photos:[{key:'tag',role,score:50,parts:{sharpness,exposure:.9,clipping:.9}}]});

test('F23: identify confirm at 0.8 preserves a known label brand read at 0.96 without asking brand', async () => {
  await askingCapture();
  const c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',[{field:'brand',value:'Gildan',source:'label',confidence:.96}])]}));
  assert.equal(fieldOf(c,'brand').state,'known');
  const held=structuredClone(capturesApi.captureRows.get(c.id)!.state.facts.brand);
  const after=job(identify([{...product,family:'apparel',c:.8}]));
  assert.deepEqual(capturesApi.captureRows.get(c.id)!.state.facts.brand,held);
  assert.equal(fieldOf(after,'brand').value,'Gildan');
  assert.equal(fieldOf(after,'brand').state,'known');
  assert.ok(!after.plan.questions.some(q=>q.field==='brand'));
});
test('F23: identify confirm at 0.9 replaces a label brand read at 0.5', async () => {
  await askingCapture();
  const c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',[{field:'brand',value:'Gildan',source:'label',confidence:.5}])]}));
  assert.equal(fieldOf(c,'brand').value,'Gildan');
  const after=job(identify([{...product,family:'apparel',c:.9}]));
  assert.equal(fieldOf(after,'brand').value,product.brand);
  assert.deepEqual(capturesApi.captureRows.get(c.id)!.state.facts.brand,{value:product.brand,source:'lookup',confidence:.9});
});
test('F23: identify confirm replaces a not_read brand', async () => {
  await askingCapture();
  const c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',[{field:'brand',value:null,unknown_reason:'not_read'}])]}));
  assert.equal(capturesApi.captureRows.get(c.id)!.state.facts.brand.unknown_reason,'not_read');
  const after=job(identify([{...product,family:'apparel'}]));
  assert.equal(fieldOf(after,'brand').value,product.brand);
  assert.deepEqual(capturesApi.captureRows.get(c.id)!.state.facts.brand,{value:product.brand,source:'lookup',confidence:product.c});
});
test('F23: running lookups without lookups_at ask brand on GET without changing the stored row', async () => {
  const c=await lookupCapture();
  const row=capturesApi.captureRows.get(c.id)!;
  row.state.lookups='running';
  delete row.state.lookups_at;
  const before=structuredClone(row);
  const after=await bodyOf(await at('GET /v1/captures/:id',c.id));
  assert.ok(after.plan.questions.some(q=>q.field==='brand'));
  assert.equal(capturesApi.captureRows.get(c.id)!.state.lookups,'running');
  assert.deepEqual(capturesApi.captureRows.get(c.id),before);
});

test('read precedence: not_read preserves M, seen fills a placeholder, and owner facts survive', async () => {
  let c=await askingCapture();
  c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',[{field:'size_label',value:null,unknown_reason:'not_read'}])]}));
  assert.equal(fieldOf(c,'size_label').value,'M','not_read cannot erase label M');
  c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',[{field:'brand',value:null,unknown_reason:'not_read'}])]}));
  assert.equal(fieldOf(c,'brand').value,null);
  c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',[{field:'brand',value:'Acme',source:'seen',confidence:.9}])]}));
  assert.equal(fieldOf(c,'brand').value,'Acme','seen fills not_read placeholder');
  c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',[{field:'size_label',value:'S',source:'seen',confidence:1}])]}));
  assert.equal(fieldOf(c,'size_label').value,'M','seen cannot replace label');
  c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',[{field:'size_label',value:'L',source:'label',confidence:.98}])]}));
  assert.equal(fieldOf(c,'size_label').value,'L','same source replaces');
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,answer:{field:'size_label',value:'XL'}}));
  c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',[{field:'size_label',value:'S',source:'measured',confidence:1}])]}));
  assert.equal(fieldOf(c,'size_label').value,'XL','you_said is never replaced');
});

test('not_read has no source or confidence and malformed photo batches never half apply', async () => {
  const before=await getCapture();
  for(const read of [
    {field:'brand',value:null,unknown_reason:'not_read',source:'label'},
    {field:'brand',value:null,unknown_reason:'not_read',confidence:.5},
    {field:'brand',value:'Acme',source:'seen',confidence:.9,unknown_reason:'not_read'},
  ]) {
    const r=await requestCapture(photosEndpoint,{photos:[photo('front'),photo('tag',[read])]});
    assert.equal(r.status,400);
    assert.deepEqual(await getCapture(),before);
  }
});

async function questionCapture(family:string, extra:Record<string,unknown> = {}) {
  let c=await bodyOf(await requestCapture('POST /v1/captures',{mode:'shots',purpose:'sell',...extra}));
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,type:family}));
  c=await bodyOf(await requestCapture(photosEndpoint,{photos:c.plan.process.map(s=>photo(s.key,[{field:'colour',value:['black'],source:'seen',confidence:.99}]))}));
  return job(identify([],'ask'));
}
async function invalidAnswers(c:CaptureBody, field:string, values:unknown[]) {
  assert.ok(c.plan.questions.some(q=>q.field===field),`${field} is an open question`);
  const before=await getCapture();
  for(const value of values) {
    const r=await requestCapture(patchEndpoint,{version:c.version,answer:{field,value}});
    assert.equal(r.status,422,`${field}: ${JSON.stringify(value)}`);
    assert.deepEqual((await r.json()).fields,[field]);
    assert.deepEqual(await getCapture(),before,'failed answer leaves the capture unchanged');
  }
}
test('number answers obey lot_count values', async () => {
  const c=await questionCapture('apparel',{pieces:3});
  await invalidAnswers(c,'lot_count',[0,2.5,99]);
});
test('list answers require values, uniqueness, nonempty and colour maximum two', async () => {
  let c=await questionCapture('apparel');
  c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('front',[{field:'colour',value:['black'],source:'seen',confidence:0}])]}));
  // Required fields come first; refuse them until colour is inside the optional question cap.
  while(!c.plan.questions.some(q=>q.field==='colour')) {
    const q=c.plan.questions[0]; assert.ok(q);
    c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,refuse:q.field}));
  }
  await invalidAnswers(c,'colour',[[],['black','black'],['impossible'],['black','white','red']]);
});
test('dimensions answers require exactly positive finite row parts', async () => {
  let c=await questionCapture('apparel');
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,generate:true}));
  await invalidAnswers(c,'dimensions',[{}, {pit_to_pit:52}, {pit_to_pit:52,length:71,extra:3}, {pit_to_pit:0,length:71}, {pit_to_pit:-1,length:71}, {pit_to_pit:null,length:71}, {pit_to_pit:'52',length:71}]);
});
test('free length numbers reject negatives and nonfinite values', async () => {
  const c=await questionCapture('bikes_sports');
  await invalidAnswers(c,'frame_size',[-1,null,'50']);
  assert.equal((await requestCapture(patchEndpoint,{version:c.version,answer:{field:'frame_size',value:0}})).status,200);
});
test('yes_no requires boolean', async () => {
  const c=await questionCapture('cards_collectibles');
  await invalidAnswers(c,'graded',[0,'yes',null]);
  assert.equal((await requestCapture(patchEndpoint,{version:c.version,answer:{field:'graded',value:true}})).status,200);
});
test('text answers reject whitespace', async () => {
  let c=await questionCapture('apparel');
  while(!c.plan.questions.some(q=>q.field==='brand')) {
    const q=c.plan.questions[0]; assert.ok(q);
    c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,refuse:q.field}));
  }
  await invalidAnswers(c,'brand',['','   ',42]);
});

test('device flags default false independently and impossible object capture is 422', async () => {
  for(const device of [undefined,{}, {has_lidar:false}, {has_lidar:true}]) {
    resetCaptures();
    const c=await bodyOf(await requestCapture('POST /v1/captures',{mode:'shots',purpose:'sell',...(device?{device}:{})}));
    const next=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,type:'furniture'}));
    assert.ok(next.plan.process.every(s=>s.kind!=='scan'),'omitted object_capture means no scan');
  }
  const r=await requestCapture('POST /v1/captures',{mode:'shots',purpose:'sell',device:{object_capture:true}});
  assert.equal(r.status,422);assert.deepEqual((await r.json()).fields,['device.object_capture']);
});
async function at(endpoint:string,id:string,body?:unknown,token='good') {
  return call(examples.find(e=>e.endpoint===endpoint)!,{path:endpoint.split(' ')[1].replace(':id',id),body,token,headers:{'Idempotency-Key':`tenant_${++requestNumber}`}});
}
test('opening without item_id gives the other user a new item owned by that caller', async () => {
  const c=await bodyOf(await requestCapture('POST /v1/captures',openInput,'other'));
  assert.notEqual(c.item_id,'it_7c2m','new capture must not reuse the seeded user item');
  assert.match(c.item_id,/^it_[0-9a-f]{32}$/);
  const row=capturesApi.captureRows.get(c.id)!;
  assert.equal(row.user_id,'usr_other');assert.equal(row.item_id,c.item_id);
});
test('capture and item ids are not minted from a counter, so a restart never reuses one', async () => {
  const seen=new Set<string>();
  for(let restart=0;restart<3;restart++) {
    resetCaptures(); deps.idem.clear();
    const c=await bodyOf(await requestCapture('POST /v1/captures',openInput,'other'));
    for(const id of [c.id,c.item_id]) { assert.ok(!seen.has(id),id+' was minted twice'); seen.add(id); }
  }
});
test('PATCH returns the other user capture own item id', async () => {
  const c=await bodyOf(await requestCapture('POST /v1/captures',openInput,'other'));
  const response=await at(patchEndpoint,c.id,{version:c.version,type:'apparel'},'other');
  assert.equal(response.status,200);
  const changed=await response.json();
  assert.notEqual(changed.item.id,'it_7c2m','PATCH must not return the seeded user item');
  assert.equal(changed.item.id,c.item_id);assert.equal(changed.item_id,c.item_id);
});
test('finish returns the other user capture own item id', async () => {
  const c=await bodyOf(await requestCapture('POST /v1/captures',openInput,'other'));
  keepFront(c.id);
  const response=await at('POST /v1/captures/:id/finish',c.id,{version:c.version},'other');
  assert.equal(response.status,202);
  const finished=await response.json();
  assert.notEqual(finished.item.id,'it_7c2m','finish must not return the seeded user item');
  assert.equal(finished.item.id,c.item_id);assert.equal(finished.capture.item_id,c.item_id);
});
for(const token of ['good','other']) test(`two opens without item_id give ${token} distinct items`, async () => {
  const first=await bodyOf(await requestCapture('POST /v1/captures',openInput,token));
  const second=await bodyOf(await requestCapture('POST /v1/captures',openInput,token));
  assert.notEqual(first.item_id,second.item_id,'separate captures must not share an allocated item');
  assert.notEqual(second.item_id,'it_7c2m','only the seeded first open keeps the example item');
});
test('seeded user first open keeps the contract example after another user opens', async () => {
  const other=await bodyOf(await requestCapture('POST /v1/captures',openInput,'other'));
  const e=examples.find(e=>e.name==='captures.open')!;
  const response=await call(e);
  assert.equal(response.status,201);assert.deepEqual(await response.json(),e.response);
  assert.notEqual(other.item_id,(e.response as {item_id:string}).item_id,'another user must not claim the example item');
});
test('two users open distinct captures and only owners read or write every capture route', async () => {
  const first=await bodyOf(await requestCapture('POST /v1/captures',openInput));
  const second=await bodyOf(await requestCapture('POST /v1/captures',openInput));
  const other=await bodyOf(await requestCapture('POST /v1/captures',openInput,'other'));
  assert.equal(first.id,'cap_3n9q');assert.match(second.id,/^cap_[0-9a-f]{32}$/);assert.notEqual(other.id,second.id);
  for(const [c,owner,foreign] of [[first,'good','other'],[second,'good','other'],[other,'other','good']] as const) {
    assert.deepEqual(await bodyOf(await at('GET /v1/captures/:id',c.id,undefined,owner)),c);
    for(const endpoint of ['GET /v1/captures/:id',photosEndpoint,patchEndpoint,'POST /v1/captures/:id/finish']) {
      const r=await at(endpoint,c.id,endpoint.startsWith('GET')?undefined:{},foreign);
      assert.equal(r.status,404,endpoint);assert.equal((await r.json()).code,'not_found');
    }
    const changed=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,type:'apparel'},owner));
    assert.equal(changed.version,2);
    assert.equal((await at(photosEndpoint,c.id,{photos:[photo('front')]},owner)).status,201);
    assert.equal((await at('POST /v1/captures/:id/finish',c.id,{version:3},owner)).status,202);
  }
});
test('open validates caller item through items port', async () => {
  assert.equal((await requestCapture('POST /v1/captures',{...openInput,item_id:'it_missing'})).status,404);
  assert.equal((await requestCapture('POST /v1/captures',{...openInput,item_id:'it_7c2m'},'other')).status,404);
  assert.equal((await requestCapture('POST /v1/captures',{...openInput,item_id:'it_7c2m'})).status,201);
});
test('judged captures refuse photos, answers, Generate and finish without version movement', async () => {
  const c=await askingCapture();
  const finished=await bodyOf(await requestCapture('POST /v1/captures/:id/finish',{version:c.version}));
  for(const [endpoint,body] of [
    [photosEndpoint,{photos:[photo('front')]}],
    [patchEndpoint,{version:finished.version,answer:{field:'condition',value:'good'}}],
    [patchEndpoint,{version:finished.version,generate:true}],
    ['POST /v1/captures/:id/finish',{version:finished.version}],
  ] as const) {
    const r=await requestCapture(endpoint,body);assert.equal(r.status,409);assert.equal((await r.json()).code,'stale');
    assert.deepEqual(await getCapture(),finished);
  }
});
test('PATCH preserves status after shooting and logs only answered or refused field names', async () => {
  const sink=memorySink();deps.log=createLog({src:'test',build:'test',sink});
  let c=await askingCapture(); assert.equal(c.state,'uploading');
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,answer:{field:'condition',value:'good'}}));
  assert.equal(c.state,'uploading');
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,refuse:'size_label'}));
  const changes=sink.lines.map(s=>JSON.parse(s)).filter(e=>e.event==='state.change');
  assert.ok(!changes.some(e=>e.field==='condition' || e.field==='size_label'));
  const fields=sink.lines.map(s=>JSON.parse(s)).filter(e=>e.event==='note' && e.msg==='capture field updated');
  assert.deepEqual(fields.map(e=>e.field),['condition','size_label']);
  assert.ok(![...changes,...fields].some(e=>'value' in e));
});

test('identify confirm publishes lookup dimensions without a question and preserves candidate order', async () => {
  await questionCapture('furniture');
  const c=job(identify([product]));
  assert.equal(fieldOf(c,'dimensions').state,'known');assert.equal(fieldOf(c,'dimensions').source,'lookup');
  assert.deepEqual(fieldOf(c,'dimensions').value,product.dimensions);
  assert.ok(!c.plan.questions.some(q=>q.field==='dimensions'));
  const withoutPhone=job(identify([product]));
  assert.equal(withoutPhone.plan.family,'furniture');
});
test('identify pick yields exactly one dimensions pick_one with variant labels', async () => {
  await questionCapture('furniture');
  const c=job(identify([{...product,c:.7,label:'Small'},{...product,product_id:'pr_large',c:.6,dimensions:{width:90,depth:55,height:45}}],'pick'));
  const qs=c.plan.questions.filter(q=>q.field==='dimensions');assert.equal(qs.length,1);assert.equal(qs[0].kind,'pick_one');
  assert.deepEqual(qs[0].options.map(o=>o.label),['Small','pr_large']);
});
test('identify empty set completes lookups and leaves phone suggestion alone', async () => {
  await askingCapture();
  const c=job(identify([],'ask'));assert.equal(c.plan.family,'apparel');
  assert.equal(fieldOf(c,'brand').state,'missing','lookups are done so brand is no longer waiting');
  resetCaptures();await requestCapture('POST /v1/captures',{mode:'shots',purpose:'sell'});
  assert.equal(job(identify([product])).plan.family,'furniture','job supplies missing suggestion');
});
test('studio plan waits for Generate then exposes flaw shot and kind measurements', async () => {
  let c=await askingCapture();const before=c.plan;
  c=job(studioResult);assert.deepEqual(c.plan,before);
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,generate:true}));
  const flaw=c.plan.questions.find(q=>q.shot?.step==='flaw:hem');assert.ok(flaw);assert.equal(flaw.kind,'shot');assert.equal(flaw.words,'Show the mark.');
  assert.deepEqual(c.plan.questions.find(q=>q.field==='dimensions')?.parts,['pit_to_pit','length']);
  c=job({kind:'studio_plan',plan:{kind:'pants',asks:[]}});
  assert.ok(c.plan.questions.find(q=>q.field==='dimensions')?.parts?.includes('inseam'));
  c=job({kind:'studio_plan',plan:{kind:'unrecognised',asks:[]}});
  assert.deepEqual(c.plan.questions.find(q=>q.field==='dimensions')?.parts,['pit_to_pit','length']);
});
test('Generate is exactly one PATCH action and must be true', async () => {
  const c=await askingCapture();
  for(const body of [{generate:false},{generate:true,type:'apparel'},{generate:true,refuse:'condition'},{generate:true,answer:{field:'condition',value:'good'}}]) {
    assert.equal((await requestCapture(patchEndpoint,{version:c.version,...body})).status,400);
    assert.deepEqual(await getCapture(),c);
  }
});
test('photo score blurry tag yields retake, threshold passes and existing facts survive', async () => {
  await questionCapture('apparel');
  let c=job(scoreResult());assert.ok(c.plan.questions.some(q=>q.shot?.step==='tag' && q.shot.reason==='retake'));
  resetCaptures();await questionCapture('apparel');
  c=job(scoreResult(.5));assert.ok(!c.plan.questions.some(q=>q.shot?.step==='tag'));
  c=job(scoreResult(.3,'front'));assert.ok(!c.plan.questions.some(q=>q.shot?.step==='tag'));
  resetCaptures();c=await askingCapture();c=job(scoreResult());assert.equal(fieldOf(c,'size_label').value,'M');
});
test('job results validate all fields before applying, bump once, log input and enforce ownership', async () => {
  await askingCapture();
  const invalidResults:[unknown,string][]=[
    [{kind:'unknown'},'kind'],
    [identify([product],'unknown'),'action'],
    [identify([{...product,c:2}]),'c'],
    [identify([{...product,family:'unknown'}]),'family'],
    [identify([{...product,brand:1}]),'brand'],
    [identify([{...product,model:1}]),'model'],
    [identify([{...product,label:1}]),'label'],
    [identify([{...product,product_id:''}]),'product_id'],
    [identify([{...product,dimensions:{width:0}}]),'dimensions'],
    [identify([{...product,c:.5},{...product,c:.8}],'pick'),'c'],
    [{kind:'studio_plan',plan:{kind:'tee',asks:[{type:'unknown',text:'x'}]}},'type'],
    [{kind:'studio_plan',plan:{kind:'tee',asks:[{type:'flaw',text:'',zone:'hem'}]}},'text'],
    [{kind:'studio_plan',plan:{kind:'tee',asks:[{type:'flaw',text:'x',zone:3}]}},'zone'],
    [{kind:'photo_score',photos:[scoreResult().photos[0],{key:'tag',role:'tag',score:50,parts:{sharpness:NaN,exposure:.9,clipping:.9}}]},'sharpness'],
    [{kind:'photo_score',photos:[{key:'tag',role:'tag',score:101,parts:{sharpness:.3,exposure:.9,clipping:.9}}]},'score'],
    [{kind:'photo_score',photos:[{key:'tag',role:'tag',score:50,parts:{sharpness:.3,exposure:.9}}]},'clipping'],
  ];
  for(const [result,field] of invalidResults) {
    const before=await getCapture();assert.throws(()=>job(result),new RegExp(field));assert.deepEqual(await getCapture(),before);
  }
  for(const [user,id] of [['usr_other','cap_3n9q'],['usr_8f2k','cap_unknown']]) {
    assert.throws(()=>job(identify([],'ask'),user,id),e=>e instanceof Error && 'code' in e && e.code==='not_found');
  }
  const sink=memorySink();deps.log=createLog({src:'test',build:'test',sink});
  for(const result of [identify([],'ask'),studioResult,scoreResult()]) {
    const before=await getCapture();const c=job(result);assert.equal(c.version,before.version+1);
  }
  assert.equal(sink.lines.map(s=>JSON.parse(s)).filter(e=>e.event==='state.change').length,0);
  assert.equal(sink.lines.map(s=>JSON.parse(s)).filter(e=>e.event==='user.input' && e.control==='capture.job_result').length,3);
});

test('identify refreshes its own suggestion but never the phone suggestion', async () => {
  await requestCapture('POST /v1/captures',{mode:'shots',purpose:'sell'});
  assert.equal(job(identify([product])).plan.family,'furniture');
  const c=job(identify([{...product,family:'apparel'}]));
  assert.equal(c.plan.family,'apparel');
  resetCaptures();await requestCapture('POST /v1/captures',openInput);
  assert.equal(job(identify([product])).plan.family,'apparel');
});

test('identify brand and model choices are distinct and retain set order', async () => {
  await questionCapture('electronics');
  const c=job(identify([
    {...product,family:'electronics',brand:'Apple',model:'First',c:.8},
    {...product,product_id:'pr_second',family:'electronics',brand:'Other',model:'Second',c:.7},
    {...product,product_id:'pr_third',family:'electronics',brand:'Apple',model:'First',c:.6},
  ],'pick'));
  for(const [field,values] of [['brand',['Apple','Other']],['model',['First','Second']]] as const) {
    const q=c.plan.questions.find(q=>q.field===field);
    assert.ok(q,`${field} candidate question appears`);
    assert.deepEqual(q.options.map(o=>o.value),values);
  }
});

test('photo scoring permits two replacement retakes and never double-counts phone not_read', async () => {
  for(const phoneReads of [false,true]) {
    resetCaptures();await questionCapture('apparel');
    let c=job(scoreResult());
    assert.ok(c.plan.questions.some(q=>q.shot?.step==='tag'));
    for(let replacement=1;replacement<=2;replacement++) {
      await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',phoneReads?[{field:'size_label',value:null,unknown_reason:'not_read'}]:[])]}));
      c=job(scoreResult());
      assert.equal(c.plan.questions.some(q=>q.shot?.step==='tag'),replacement<2,`replacement ${replacement}, phone not_read=${phoneReads}`);
      const again=job(scoreResult());
      assert.deepEqual(again.plan,c.plan,'repeated scoring does not spend another retake');
    }
  }
});

test('capture handlers and job results log through the event contract without answer values', async () => {
  const {checkLog}=await import('../../../../spec/log.mjs');
  const sink=memorySink();deps.log=createLog({src:'test',build:'test',sink});
  async function dispatch(endpoint:string, body:Record<string,unknown>):Promise<CaptureBody> {
    const reply=await handlers[endpoint]({user_id:'usr_8f2k',visitor_id:null,request_id:'rq_capture_log',params:{id:'cap_3n9q'},query:new URLSearchParams(),body,headers:new Headers(),log:deps.log},new Request('http://edge.test'));
    assert.ok(!(reply instanceof Response));
    const result=reply.body as CaptureBody & {capture?:CaptureBody};
    return result.capture ?? result;
  }
  let c=await dispatch('POST /v1/captures',openInput);
  c=await dispatch(patchEndpoint,{version:c.version,type:'apparel'});
  c=await dispatch(photosEndpoint,{photos:[photo('front'),photo('back'),photo('tag')]});
  c=await dispatch(patchEndpoint,{version:c.version,answer:{field:'condition',value:'good'}});
  c=job(studioResult);
  await dispatch(patchEndpoint,{version:c.version,generate:true});
  assert.throws(()=>job({kind:'identify',action:'confirm',set:[{...product,c:2}]}),/c/);
  deps.log.end();
  const checked=checkLog(sink.text());
  assert.deepEqual(checked.problems,[]);
  assert.deepEqual(checked.warnings,[]);
  const changes=checked.events.filter((e:{event:string})=>e.event==='state.change');
  assert.ok(changes.every((e:Record<string,unknown>)=>!('value' in e)));
});

const finishEndpoint = 'POST /v1/captures/:id/finish';
async function storedAttributes(user:string, id:string):Promise<Attribute[]> {
  const {runtime}=await import('./runtime.ts');
  const row=runtime.store.get('item',user,id);
  assert.ok(row,`finished capture creates item ${id} for ${user}`);
  return row.attributes as Attribute[];
}
async function itemCard(id:string, token='good') {
  const {handlers}=await import('./items.ts');
  const endpoint='GET /v1/items/:id';
  const response=await route(endpoint,handlers[endpoint])(new Request(`http://edge.test/v1/items/${id}`,{headers:{Authorization:`Bearer ${token}`}}));
  assert.equal(response.status,200);
  return response.json();
}
test('F4: facts land on the wrong person\'s item', async () => {
  const {runtime}=await import('./runtime.ts');
  const a=await askingCapture();
  const b=await bodyOf(await requestCapture('POST /v1/captures',openInput,'other'));
  await at(photosEndpoint,b.id,{photos:[photo('front',[{field:'colour',value:['white'],source:'seen',confidence:.99}])]},'other');
  const bBefore=structuredClone(runtime.store.rows('item',{user_id:'usr_other'}));
  assert.equal((await at(finishEndpoint,a.id,{version:a.version})).status,202);
  assert.deepEqual(runtime.store.rows('item',{user_id:'usr_other'}),bBefore,'A finishing never changes B items');
  const aItems=structuredClone(runtime.store.rows('item',{user_id:'usr_8f2k'}));
  const forbidden=await at(finishEndpoint,a.id,{version:a.version},'other');
  assert.equal(forbidden.status,404);assert.equal((await forbidden.json()).code,'not_found');
  assert.equal((await at(finishEndpoint,b.id,{version:b.version+1},'other')).status,202);
  assert.deepEqual(runtime.store.rows('item',{user_id:'usr_8f2k'}),aItems,'B finishing never writes A item');
  assert.deepEqual((await storedAttributes('usr_other',b.item_id)).find(a=>a.name==='colour')?.value,['white']);
  assert.equal((await itemCard(b.item_id,'other')).attributes.find((a:Attribute)=>a.name==='colour').source,'inferred');
});

test('F4: a proposal (not known) is written', async () => {
  const c=await askingCapture();
  assert.equal(fieldOf(c,'size_label').state,'proposed');
  assert.equal((await requestCapture(finishEndpoint,{version:c.version})).status,202);
  const attributes=await storedAttributes('usr_8f2k',c.item_id);
  assert.ok(attributes.some(a=>a.name==='package_weight'),'known facts are written');
  assert.ok(!attributes.some(a=>a.name==='size_label'));
});

test('finish writes brand, kind, condition and a title onto the item from known facts, never a proposal', async () => {
  // A fresh person's capture, so the item starts without the seeded example's title.
  let c=await bodyOf(await at('POST /v1/captures','',openInput,'other'));
  c=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,type:'apparel'},'other'));
  c=await bodyOf(await at(photosEndpoint,c.id,{photos:[photo('front'),photo('back'),photo('tag',[{field:'size_label',value:'M',source:'label',confidence:.97}])]},'other'));
  assert.equal(fieldOf(c,'size_label').state,'proposed');
  const state=capturesApi.captureRows.get(c.id)!.state;
  state.facts.brand={value:'Carhartt',source:'label',confidence:.99,step:'tag'};
  state.facts.condition={value:'good',source:'you_said',confidence:1};
  assert.equal((await at(finishEndpoint,c.id,{version:c.version},'other')).status,202);
  const {runtime}=await import('./runtime.ts');
  const item=runtime.store.get('item','usr_other',c.item_id)!;
  assert.equal(item.brand,'Carhartt');assert.equal(item.kind,'apparel');assert.equal(item.condition,'good');
  assert.equal(item.title,'Carhartt apparel','a proposed size stays out of the title');
  assert.equal(item.size,undefined,'a proposed size is not written');
});

async function valuationCapture(t:import('node:test').TestContext, purpose:'sell'|'appraise', brand?:string) {
  const valuations=await import('./valuations.ts'), search=await import('./search.ts');
  const defaults={...valuations.ports}, searchDefaults={...search.ports};
  valuations.ports.sources=()=>[]; valuations.ports.observations={read:async()=>[],write:async()=>{}}; search.ports.sources=[];
  t.after(async()=>{await Promise.all(valuations.pendingValuations.values());Object.assign(valuations.ports,defaults);Object.assign(search.ports,searchDefaults);});
  const c=await bodyOf(await requestCapture('POST /v1/captures',{...openInput,purpose},'other'));
  const row=capturesApi.captureRows.get(c.id)!;
  row.state.type='apparel';
  if (brand) row.state.facts.brand={value:brand,source:'lookup',confidence:.94};
  keepFront(c.id);
  row.identify_job_id='job_applied_above';
  const response=await at(finishEndpoint,c.id,{version:c.version},'other');
  assert.equal(response.status,202);
  return response.json() as Promise<{item:{id:string};jobs:{id:string;kind:string;stream:string}[];valuation?:{range_state:string;needs:string[]}}>;
}
test('an appraise capture\'s finish starts a valuation; a sell capture\'s does not', async t => {
  const appraised=await valuationCapture(t,'appraise','Carhartt');
  const valuation=appraised.jobs.find(j=>j.kind==='valuate');
  assert.ok(valuation,'finish returns the valuation job');
  assert.equal(valuation.stream,`/v1/jobs/${valuation.id}/events`);
  assert.ok(appraised.jobs.some(j=>j.kind==='identify'),'identify stays beside it');
  const {getJob}=await import('./jobs.ts');
  const job=await (await route('GET /v1/jobs/:id',getJob())(new Request(`http://edge.test/v1/jobs/${valuation.id}`,{headers:{Authorization:'Bearer other'}}))).json();
  assert.equal(job.kind,'valuate');assert.equal(job.item_id,appraised.item.id);
  const sold=await valuationCapture(t,'sell','Carhartt');
  assert.ok(!sold.jobs.some(j=>j.kind==='valuate'));
  assert.equal(sold.valuation,undefined);
});
test('an appraise capture with no identity starts no valuation and says what would identify it', async t => {
  const result=await valuationCapture(t,'appraise');
  assert.ok(!result.jobs.some(j=>j.kind==='valuate'));
  assert.deepEqual(result.valuation,{range_state:'needs_identity',needs:['brand','model','title']});
});

test('F4: a you_said value on the item is overwritten by a capture\'s seen value', async () => {
  const {runtime}=await import('./runtime.ts');
  const current=runtime.store.get('item','usr_8f2k','it_7c2m')!;
  const owner:Attribute={name:'colour',value:['red'],source:'you_said',confidence:1,confirmed:false,method:'owner',at:exampleCreatedAt,
    evidence:[{kind:'owner',ref:'owner/colour',captured_at:exampleCreatedAt,extractor_version:'owner.v1'}]};
  const pinned:Attribute={...owner,name:'brand',value:'Owner brand',source:'label',confirmed:true};
  runtime.store.put('item',{...current,attributes:[...(current.attributes as Attribute[]).filter(a=>!['colour','brand'].includes(a.name)),owner,pinned]});
  const c=await bodyOf(await requestCapture('POST /v1/captures',{...openInput,confirm_mode:'auto'}));
  await requestCapture(photosEndpoint,{photos:[photo('front',[{field:'colour',value:['black'],source:'seen',confidence:.99},{field:'brand',value:'Label brand',source:'label',confidence:1}])]});
  assert.equal((await requestCapture(finishEndpoint,{version:c.version+1})).status,202);
  const attributes=await storedAttributes('usr_8f2k',c.item_id);
  assert.deepEqual(attributes.find(a=>a.name==='colour'),owner);
  assert.deepEqual(attributes.find(a=>a.name==='brand'),pinned);
});

test('F4: a failed item write leaves the capture judged', async t => {
  let c=await askingCapture();
  // Finish waits for identify first, so the snapshot is taken once identify has settled.
  await capturesApi.pendingIdentify('usr_8f2k',c.id);c=await joinedCapture(c.id);
  const before=structuredClone(capturesApi.captureRows.get(c.id));
  const {runtime}=await import('./runtime.ts');
  const itemBefore=structuredClone(runtime.store.get('item','usr_8f2k',c.item_id));
  const tx=t.mock.method(runtime.store,'tx');
  const put=t.mock.method(runtime.store,'put',()=>{throw new Error('item write failed');});
  const response=await requestCapture(finishEndpoint,{version:c.version});
  assert.equal(response.status,503);assert.equal((await response.json()).code,'unavailable');
  assert.equal(tx.mock.callCount(),1,'item write runs inside the store transaction');
  assert.equal(put.mock.callCount(),1);
  assert.deepEqual(capturesApi.captureRows.get(c.id),before,'failed item write preserves capture status and version');
  assert.deepEqual(runtime.store.get('item','usr_8f2k',c.item_id),itemBefore);
});

test('F4/F13: a job arriving after the item commit cannot replace the finished capture', async t => {
  const c=await askingCapture();
  const {runtime}=await import('./runtime.ts');
  const tx=runtime.store.tx.bind(runtime.store);
  let result:unknown;
  t.mock.method(runtime.store,'tx',function<T>(fn:(st:Store)=>T):T {
    const saved=tx(fn);
    queueMicrotask(()=>{try {result=job(studioResult);} catch(error) {result=error;}});
    return saved;
  });
  const finished=await bodyOf(await requestCapture(finishEndpoint,{version:c.version}));
  assert.ok(result instanceof ApiError,'a job after the item commit must see a finished capture');
  assert.equal(result.code,'stale');
  assert.deepEqual(await getCapture(),finished);
});

test('F4: finish publishes known facts and evidence through the item route, preserving seeded attributes', async () => {
  const {runtime}=await import('./runtime.ts');
  const before=structuredClone(runtime.store.get('item','usr_8f2k','it_7c2m')!.attributes as Attribute[]);
  let c=await bodyOf(await requestCapture('POST /v1/captures',{...openInput,confirm_mode:'auto'}));
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,type:'apparel'}));
  c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('front',[
    {field:'colour',value:['black'],source:'seen',confidence:.99},
    {field:'dimensions',value:{pit_to_pit:52,length:71},source:'measured',confidence:.98},
  ]),photo('back'),photo('tag',[
    {field:'size_label',value:'M',source:'label',confidence:.99},
    {field:'brand',value:'Capture brand',source:'label',confidence:.99},
  ])]}));
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,answer:{field:'condition',value:'good'}}));
  const finishAt='2026-11-15T14:00:00.000Z';deps.now=()=>Date.parse(finishAt);
  assert.equal((await requestCapture(finishEndpoint,{version:c.version})).status,202);
  const attributes=await storedAttributes('usr_8f2k',c.item_id);
  const card=await itemCard(c.item_id);
  for(const [name,source,kind,step,confidence,confirmed] of [
    ['colour','inferred','image_region','front',.99,false],['dimensions','measured','depth','front',.98,false],
    ['size_label','label','label_text','tag',.99,false],
    ['condition','you_said','owner','condition',1,true],['package_weight','inferred','image_region','package_weight',.8,false],
  ] as const) {
    const attribute=attributes.find(a=>a.name===name);assert.ok(attribute,name);
    assert.equal(attribute.source,source,name);assert.equal(attribute.confidence,confidence,name);assert.equal(attribute.confirmed,confirmed,name);
    assert.equal(attribute.at,finishAt);assert.equal(attribute.method,name==='package_weight'?'derived':name==='colour'?'seen':source);
    assert.deepEqual(attribute.evidence,[{kind,ref:`${c.id}/${step}`,captured_at:finishAt,extractor_version:`capture.v${table.version}`}]);
    const shown=card.attributes.find((a:Attribute)=>a.name===name);assert.ok(shown,name);
    assert.equal(shown.source,source);assert.deepEqual(shown.value,attribute.value);assert.deepEqual(shown.evidence,attribute.evidence);
  }
  for(const old of before) if(!['colour','dimensions','size_label','condition','package_weight'].includes(old.name))
    assert.deepEqual(attributes.find(a=>a.name===old.name),old,'untouched seeded attributes survive');
  assert.ok(!attributes.some(a=>['type','lot_count'].includes(a.name)));
});

test('F4: new bundle item keeps per-piece names and lookup and derived resolutions', async () => {
  const c=await bodyOf(await requestCapture('POST /v1/captures',{...openInput,pieces:2,confirm_mode:'auto'},'other'));
  const state=capturesApi.captureRows.get(c.id)!.state;
  state.type='apparel';
  state.facts['size_label.1']={value:'M',source:'label',confidence:.99,step:'tag.1'};
  state.facts['size_label.2']={value:'L',source:'you_said',confidence:1};
  state.facts['brand.1']={value:'Lookup brand',source:'lookup',confidence:.94,confirmed:true};
  state.facts.lot_count={value:2,source:'you_said',confidence:1};
  keepFront(c.id);
  assert.equal((await at(finishEndpoint,c.id,{version:c.version},'other')).status,202);
  const {runtime}=await import('./runtime.ts');
  const row=runtime.store.get('item','usr_other',c.item_id)!;
  assert.equal(row.origin,'capture');assert.equal(row.data,'captured');assert.equal(row.quantity,2);
  assert.equal(typeof row.title,'string');assert.equal(row.state,'review','a captured item opens for review (d1006a17)');
  assert.deepEqual((row.photos as {id:string}[]).map(p=>p.id),[`${c.id}-ph_kept`],'the item keeps the uploaded photo');
  assert.equal(row.created_at,exampleCreatedAt);assert.equal(row.updated_at,exampleCreatedAt);
  const attrs=await storedAttributes('usr_other',c.item_id);
  assert.equal(attrs.find(a=>a.name==='size_label.1')?.value,'M');assert.equal(attrs.find(a=>a.name==='size_label.2')?.value,'L');
  const brand=attrs.find(a=>a.name==='brand.1');assert.ok(brand);
  assert.equal(brand.source,'spec');assert.equal(brand.method,'lookup');assert.equal(brand.confidence,.94);assert.equal(brand.confirmed,true);
  assert.deepEqual(brand.evidence,[{kind:'lookup',ref:`${c.id}/brand.1`,captured_at:exampleCreatedAt,extractor_version:`capture.v${table.version}`}]);
  assert.equal(attrs.find(a=>a.name==='package_weight')?.method,'derived');
  assert.deepEqual(attrs.map(a=>a.name).sort(),['brand.1','package_weight','size_label.1','size_label.2']);
  assert.ok(!attrs.some(a=>['type','lot_count'].includes(a.name)));
  const card=await itemCard(c.item_id,'other');assert.equal(card.attributes.length,attrs.length);
});

test('F13: a job result changes a finished capture', async () => {
  const c=await askingCapture();
  const finished=await bodyOf(await requestCapture(finishEndpoint,{version:c.version}));
  const before=structuredClone(capturesApi.captureRows.get(c.id));
  const patch=await requestCapture(patchEndpoint,{version:finished.version,generate:true});
  const expected=await patch.json();
  for(const result of [identify([product]),studioResult,scoreResult()]) {
    assert.throws(()=>job(result),error=>{
      assert.ok(error instanceof ApiError);
      assert.deepEqual(error.toJSON(),expected);
      return true;
    });
    assert.deepEqual(capturesApi.captureRows.get(c.id),before);
  }
});

test('F4: an owner answer replaces an existing confirmed item value', async () => {
  const {runtime}=await import('./runtime.ts');
  const current=runtime.store.get('item','usr_8f2k','it_7c2m')!;
  const old:Attribute={name:'condition',value:'fair',source:'you_said',confidence:1,confirmed:true,method:'owner',at:exampleCreatedAt,
    evidence:[{kind:'owner',ref:'owner/condition',captured_at:exampleCreatedAt,extractor_version:'owner.v1'}]};
  runtime.store.put('item',{...current,attributes:[...(current.attributes as Attribute[]).filter(a=>a.name!=='condition'),old]});
  let c=await askingCapture();
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,answer:{field:'condition',value:'good'}}));
  assert.equal((await requestCapture(finishEndpoint,{version:c.version})).status,202);
  const next=(await storedAttributes('usr_8f2k',c.item_id)).find(a=>a.name==='condition')!;
  assert.equal(next.value,'good');assert.equal(next.source,'you_said');assert.equal(next.confirmed,true);
  assert.equal(next.evidence[0].ref,`${c.id}/condition`);
});

test('F4: finish uses resolved variant and profile facts rather than only stored facts', async () => {
  let c=await bodyOf(await requestCapture('POST /v1/captures',{mode:'shots',purpose:'sell'}));
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,type:'furniture'}));
  c=job(identify([{...product,c:.98},{...product,product_id:'pr_other',c:.4,dimensions:{width:90,depth:55,height:45}}],'pick'));
  const state=capturesApi.captureRows.get(c.id)!.state;state.profile={handover:'pickup'};
  assert.equal(state.facts.dimensions,undefined);
  keepFront(c.id);
  // The identify result above came in directly, so mark identify as run: finish starts one only when none has.
  capturesApi.captureRows.get(c.id)!.identify_job_id='job_applied_above';
  assert.equal((await requestCapture(finishEndpoint,{version:c.version})).status,202);
  const attributes=await storedAttributes('usr_8f2k',c.item_id);
  const dimensions=attributes.find(a=>a.name==='dimensions')!;
  assert.deepEqual(dimensions.value,product.dimensions);assert.equal(dimensions.source,'spec');assert.equal(dimensions.confidence,.98);
  const handover=attributes.find(a=>a.name==='handover')!;
  assert.equal(handover.value,'pickup');assert.equal(handover.method,'derived');assert.equal(handover.confidence,.9);
});

test('F13: a photo_score for an unkept key is applied', async () => {
  await questionCapture('apparel');
  for(const role of ['tag','front']) {
    const before=structuredClone(capturesApi.captureRows.get('cap_3n9q'));
    assert.throws(()=>job({kind:'photo_score',photos:[...scoreResult().photos,{...scoreResult().photos[0],key:'tag.99',role}]}),error=>{
      assert.ok(error instanceof ApiError);
      assert.equal(error.code,'invalid');assert.deepEqual(error.extra.fields,['tag.99']);return true;
    });
    assert.deepEqual(capturesApi.captureRows.get('cap_3n9q'),before,'whole result is rejected');
  }
});

test('F15: a state.change without was', async () => {
  const sink=memorySink();deps.log=createLog({src:'test',build:'test',sink});
  async function dispatch(endpoint:string,body:Record<string,unknown>) {
    const reply=await handlers[endpoint]({user_id:'usr_8f2k',visitor_id:null,request_id:'rq_capture_log',params:{id:'cap_3n9q'},query:new URLSearchParams(),body,headers:new Headers(),log:deps.log},new Request('http://edge.test'));
    assert.ok(!(reply instanceof Response));return reply.body as CaptureBody;
  }
  let c=await dispatch('POST /v1/captures',openInput);
  c=await dispatch(patchEndpoint,{version:c.version,type:'apparel'});
  await dispatch(photosEndpoint,{photos:[photo('front'),photo('back'),photo('tag')]});
  c=job(studioResult);
  c=await dispatch(patchEndpoint,{version:c.version,answer:{field:'condition',value:'good'}});
  c=await dispatch(patchEndpoint,{version:c.version,generate:true});
  await dispatch(finishEndpoint,{version:c.version});
  const {checkLog}=await import('../../../../spec/log.mjs');
  deps.log.end();const checked=checkLog(sink.text());assert.deepEqual(checked.problems,[]);assert.deepEqual(checked.warnings,[]);
  const changes=checked.events.filter((e:Record<string,unknown>)=>e.event==='state.change' && e.entity==='capture');
  assert.deepEqual(changes.map((e:Record<string,unknown>)=>[e.was,e.to]),[[null,'framing'],['framing','shooting'],['shooting','uploading'],['uploading','judged']]);
  for(const change of changes) for(const key of ['entity','id','to','was']) assert.ok(Object.hasOwn(change,key),key);
});

test('F15: a repeated state.change', async () => {
  const sink=memorySink();deps.log=createLog({src:'test',build:'test',sink});
  let c=await askingCapture();const previous=c.version;
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,answer:{field:'condition',value:'good'}}));
  c=job(studioResult);assert.equal(c.version,previous+2,'versions advance without state moves');
  await requestCapture(finishEndpoint,{version:c.version});
  const last=new Map<string,string>();
  for(const event of sink.lines.map(line=>JSON.parse(line)).filter(e=>e.event==='state.change' && e.entity==='capture')) {
    assert.notEqual(event.to,last.get(event.id),`capture ${event.id} repeated ${event.to}`);last.set(event.id,event.to);
  }
});


test('F10: a colour read of 42 is stored', async () => {
  await requestCapture('POST /v1/captures',openInput);
  const c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('front',[{field:'colour',value:42,source:'seen',confidence:1}])]}));
  assert.equal(capturesApi.captureRows.get(c.id)!.state.facts.colour,undefined);
  assert.ok(c.plan.process.find(s=>s.key==='front')?.state==='kept','the photo is kept');
});

test('F10: a read for an unknown field is stored', async () => {
  await requestCapture('POST /v1/captures',openInput);
  for(const read of [{field:'unknown_field',value:'unlisted',source:'seen',confidence:1},{field:'unknown_field',value:null,unknown_reason:'not_read'}]) {
    await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',[read])]}));
    assert.equal(capturesApi.captureRows.get('cap_3n9q')!.state.facts.unknown_field,undefined);
  }
});

test('F10: a rejected read changes the plan', async () => {
  await requestCapture('POST /v1/captures',openInput);
  await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',[{field:'size_label',value:null,unknown_reason:'not_read'}])]}));
  const before=structuredClone(capturesApi.captureRows.get('cap_3n9q')!);
  const rejected=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag',[
    {field:'colour',value:42,source:'seen',confidence:1},
    {field:'unknown_field',value:null,unknown_reason:'not_read'},
  ])]}));
  const rejectedState=structuredClone(capturesApi.captureRows.get(before.id)!.state);
  capturesApi.captureRows.set(before.id,before);
  const without=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('tag')]}));
  assert.deepEqual(rejected.plan,without.plan);
  assert.deepEqual(rejectedState,capturesApi.captureRows.get(before.id)!.state,'a dropped not_read cannot spend retakes');
});

test("F10: a dropped read's value is in the log", async () => {
  await requestCapture('POST /v1/captures',openInput);
  const sink=memorySink();deps.log=createLog({src:'test',build:'test',sink});
  await handlers[photosEndpoint]({user_id:'usr_8f2k',visitor_id:null,request_id:'rq_capture_reads',params:{id:'cap_3n9q'},query:new URLSearchParams(),headers:new Headers(),log:deps.log,body:{photos:[photo('front',[
    {field:'colour',value:['rejected_read_marker'],source:'seen',confidence:1},
    {field:'unknown_field',value:'unlisted_read_marker',source:'seen',confidence:1},
    {field:'unlisted_not_read',value:null,unknown_reason:'not_read'},
  ])]}},new Request('http://edge.test'));
  assert.doesNotMatch(sink.text(),/rejected_read_marker|unlisted_read_marker/);
  const notes=sink.lines.map(line=>JSON.parse(line)).filter(e=>e.event==='note' && e.reason);
  for(const field of ['colour','unknown_field','unlisted_not_read']) {
    assert.ok(notes.some(e=>e.field===field && typeof e.reason==='string'),`${field} has a logged reason`);
  }
  assert.ok(notes.every(e=>!Object.hasOwn(e,'value')));
  deps.log.end();
  const {checkLog}=await import('../../../../spec/log.mjs');
  const checked=checkLog(sink.text());assert.deepEqual(checked.problems,[]);assert.deepEqual(checked.warnings,[]);
});

test('F10: reads use the selected row for every value type and per-piece field', async () => {
  await questionCapture('apparel',{pieces:2});
  const before=structuredClone(capturesApi.captureRows.get('cap_3n9q')!.state.facts);
  const reads=[
    {field:'colour',value:['invalid']},{field:'size_label',value:'M'},
    {field:'size_label.1',value:42},{field:'dimensions.1',value:{pit_to_pit:52}},
    {field:'dimensions.2',value:{pit_to_pit:52,length:-1}},{field:'brand.1',value:'   '},
    {field:'condition',value:'unlisted'},
  ].map(read=>({...read,source:'seen',confidence:1}));
  await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('front.1',reads)]}));
  assert.deepEqual(capturesApi.captureRows.get('cap_3n9q')!.state.facts,before);
});

test('F12: a third colour is accepted', async () => {
  await requestCapture('POST /v1/captures',openInput);
  await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('front',[{field:'colour',value:['black','white','red'],source:'seen',confidence:1}])]}));
  assert.equal(capturesApi.captureRows.get('cap_3n9q')!.state.facts.colour,undefined);
});

test('F12: list maximum comes from max, then values, then no limit for reads and answers', async t => {
  const row=table.fields.root.find(r=>r.field==='colour')!;
  const original=structuredClone(row);t.after(()=>Object.assign(row,original));
  for(const maximum of [3,1,undefined]) {
    row.max=maximum;
    resetCaptures();let c=await questionCapture('apparel');
    c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('front',[{field:'colour',value:['black'],source:'seen',confidence:0}])]}));
    const value=['black','white','red'];
    c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('front',[{field:'colour',value,source:'seen',confidence:0}])]}));
    while(!c.plan.questions.some(q=>q.field==='colour')) {
      const q=c.plan.questions[0];assert.ok(q);
      c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,refuse:q.field}));
    }
    if(maximum===1) {
      assert.deepEqual(capturesApi.captureRows.get(c.id)!.state.facts.colour.value,['black']);
      await invalidAnswers(c,'colour',[value]);
    } else {
      assert.deepEqual(capturesApi.captureRows.get(c.id)!.state.facts.colour.value,value);
      assert.equal((await requestCapture(patchEndpoint,{version:c.version,answer:{field:'colour',value}})).status,200);
    }
  }
  row.values=undefined;row.max=undefined;
  resetCaptures();let c=await questionCapture('apparel');
  const value=['one','two','three','four'];
  c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('front',[{field:'colour',value,source:'seen',confidence:0}])]}));
  assert.deepEqual(capturesApi.captureRows.get(c.id)!.state.facts.colour.value,value);
  while(!c.plan.questions.some(q=>q.field==='colour')) {
    const q=c.plan.questions[0];assert.ok(q);
    c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,refuse:q.field}));
  }
  assert.equal((await requestCapture(patchEndpoint,{version:c.version,answer:{field:'colour',value}})).status,200);
});

const scanInput={...openInput,mode:'scan',suggestion:{family:'lighting_home',p:.98,second_p:.01},extent_cm:130,rigid:true};
const scanPhoto=(scan:unknown)=>({...photo('scan'),scan});
const scanResult={scan_ok:true,extent_cm:{width:30,depth:40,height:130},extent_conf:.95,frames:60};

test("F11: open's size is ignored", async () => {
  for(const [extent_cm,expected] of [[130,'large_bulky'],[6,'small_hard']] as const) {
    resetCaptures();const c=await bodyOf(await requestCapture('POST /v1/captures',{...scanInput,extent_cm,extent_conf:0}));
    assert.equal(c.plan.dimension_class,expected);
    assert.equal(capturesApi.captureRows.get(c.id)!.state.extent_cm,extent_cm);
    assert.equal(capturesApi.captureRows.get(c.id)!.state.rigid,true);
  }
});

test('F11: invalid open extent and rigid name the field and never write', async () => {
  for(const [field,values] of [['extent_cm',[0,-1,'130',null]],['extent_conf',[-.1,1.1,'0',null]],['rigid',[0,'true',null]]] as const) {
    for(const value of values) {
      const before=structuredClone([...capturesApi.captureRows]);
      const response=await requestCapture('POST /v1/captures',{...scanInput,[field]:value});
      assert.equal(response.status,400,`${field}=${value}`);
      const error=await response.json();assert.equal(error.code,'invalid');assert.deepEqual(error.fields,[field]);
      assert.deepEqual([...capturesApi.captureRows],before);
    }
  }
});

async function completedScan(confidence:number):Promise<CaptureBody> {
  const c=await bodyOf(await requestCapture('POST /v1/captures',scanInput));
  const photos=c.plan.process.map(s=>s.key==='scan'?scanPhoto({...scanResult,extent_conf:confidence}):photo(s.key));
  await bodyOf(await requestCapture(photosEndpoint,{photos}));
  return job(identify([],'ask'));
}

test('F11: a scan at confidence 0 is known', async () => {
  const c=await completedScan(0);
  assert.equal(fieldOf(c,'dimensions').state,'proposed');
  assert.equal(fieldOf(c,'dimensions').source,'measured');
  assert.deepEqual(fieldOf(c,'dimensions').value,scanResult.extent_cm);
  assert.equal(capturesApi.captureRows.get(c.id)!.state.facts.dimensions.confidence,0);
});

test('F11: a calibrated scan is known and keeps only dimensions row parts', async t => {
  const row=table.classes.large_bulky.dimensions!;
  const parts=row.ask!.parts;t.after(()=>{row.ask!.parts=parts;});
  row.ask!.parts=['width','height'];
  const c=await completedScan(.95);
  assert.equal(fieldOf(c,'dimensions').state,'known');
  assert.deepEqual(fieldOf(c,'dimensions').value,{width:30,height:130});
});

test('F11: a failed scan leaves object_capture true', async () => {
  const c=await bodyOf(await requestCapture('POST /v1/captures',scanInput));
  let next=await bodyOf(await requestCapture(photosEndpoint,{photos:[scanPhoto({...scanResult,scan_ok:false})]}));
  assert.equal(capturesApi.captureRows.get(c.id)!.state.object_capture,false);
  assert.equal(capturesApi.captureRows.get(c.id)!.state.facts.dimensions,undefined);
  assert.ok(next.plan.process.some(s=>s.key==='ring' && s.frames===8));
  next=await bodyOf(await requestCapture(photosEndpoint,{photos:[scanPhoto(scanResult)]}));
  assert.equal(capturesApi.captureRows.get(c.id)!.state.object_capture,false,'later success never reenables a failed scan');
  assert.ok(next.plan.process.every(s=>s.kind!=='scan'));
});

test('F11: a scan follows read precedence and never replaces you_said or lookup', async () => {
  for(const source of ['seen','label','measured','lookup','you_said'] as const) {
    resetCaptures();const c=await bodyOf(await requestCapture('POST /v1/captures',scanInput));
    const state=capturesApi.captureRows.get(c.id)!.state;
    const old={value:{width:10,depth:20,height:30},source,confidence:1};state.facts.dimensions=structuredClone(old);
    await bodyOf(await requestCapture(photosEndpoint,{photos:[scanPhoto(scanResult)]}));
    if(source==='lookup' || source==='you_said') assert.deepEqual(state.facts.dimensions,old);
    else assert.deepEqual(state.facts.dimensions,{value:scanResult.extent_cm,source:'measured',confidence:.95,step:'scan'});
  }
});

test('F11: invalid scan metadata and photo references reject the entire batch', async () => {
  await requestCapture('POST /v1/captures',scanInput);
  const before=structuredClone(capturesApi.captureRows.get('cap_3n9q'));
  for(const scan of [null,{}, {...scanResult,scan_ok:1},{...scanResult,extent_conf:-1},{...scanResult,extent_conf:2},
    {...scanResult,frames:1.5},{...scanResult,frames:-1},{...scanResult,extent_cm:{width:0,depth:40,height:130}},
    {...scanResult,extent_cm:{width:30,height:130}},{...scanResult,extent_cm:{width:'30',depth:40,height:130}}]) {
    assert.equal((await requestCapture(photosEndpoint,{photos:[photo('front'),scanPhoto(scan)]})).status,400);
    assert.deepEqual(capturesApi.captureRows.get('cap_3n9q'),before);
  }
  for(const field of ['depth_ref','pose_ref']) for(const value of [null,42,{}]) {
    assert.equal((await requestCapture(photosEndpoint,{photos:[photo('front'),{...photo('scan'),[field]:value}]})).status,400);
    assert.deepEqual(capturesApi.captureRows.get('cap_3n9q'),before);
  }
  await bodyOf(await requestCapture(photosEndpoint,{photos:[{...scanPhoto(scanResult),depth_ref:'depth/frame',pose_ref:'pose/frame'}]}));
});

test("F11: B's photos with a scan never change A's capture", async () => {
  const a=await bodyOf(await requestCapture('POST /v1/captures',scanInput));
  const b=await bodyOf(await requestCapture('POST /v1/captures',scanInput,'other'));
  const before=structuredClone(capturesApi.captureRows.get(a.id));
  const payload={photos:[scanPhoto(scanResult)]};
  assert.equal((await at(photosEndpoint,a.id,payload,'other')).status,404);
  await bodyOf(await at(photosEndpoint,b.id,payload,'other'));
  assert.deepEqual(capturesApi.captureRows.get(a.id),before);
  assert.equal(capturesApi.captureRows.get(b.id)!.state.facts.dimensions.source,'measured');
  await bodyOf(await at(photosEndpoint,b.id,{photos:[scanPhoto({...scanResult,scan_ok:false})]},'other'));
  assert.deepEqual(capturesApi.captureRows.get(a.id),before);
});

test('F11: a bundle scan writes only its piece dimensions', async () => {
  await requestCapture('POST /v1/captures',{...scanInput,pieces:2});
  await bodyOf(await requestCapture(photosEndpoint,{photos:[{...scanPhoto(scanResult),key:'scan.2'}]}));
  const facts=capturesApi.captureRows.get('cap_3n9q')!.state.facts;
  assert.equal(facts.dimensions,undefined);assert.equal(facts['dimensions.1'],undefined);
  assert.deepEqual(facts['dimensions.2'].value,scanResult.extent_cm);
});

test('F14: a measure ask without name is accepted', async () => {
  await askingCapture();
  assert.throws(()=>job({kind:'studio_plan',plan:{kind:'tee',asks:[{type:'measure',text:'Measure it.'}]}}),/name/);
});

test('F14: a flaw ask without zone is accepted', async () => {
  await askingCapture();
  assert.throws(()=>job({kind:'studio_plan',plan:{kind:'tee',asks:[{type:'flaw',text:'Show it.',kind:'stain'}]}}),/zone/);
});

test('F14: a half-valid studio result is partly applied', async () => {
  let c=await askingCapture();c=job(studioResult);
  await bodyOf(await requestCapture(patchEndpoint,{version:c.version,generate:true}));
  const before=structuredClone(capturesApi.captureRows.get(c.id));
  assert.throws(()=>job({kind:'studio_plan',plan:{kind:'pants',asks:[{type:'cover',text:'Front.'},{type:'measure',text:'Measure it.'}]}}),/name/);
  assert.deepEqual(capturesApi.captureRows.get(c.id),before,'facts, plan, cached asks and version all survive');
});

test('F14: each studio ask requires its fields and measure names match the known kind', async () => {
  await askingCapture();
  const valid=[{type:'cover',text:'Front.'},{type:'back',text:'Back.'},{type:'tag',text:'Tag.'},
    {type:'graphic',text:'Graphic.',zone:'chest'},{type:'flaw',text:'Mark.',kind:'stain',zone:'hem'},
    {type:'measure',text:'Measure.',name:'pit_to_pit'}];
  for(const ask of valid) for(const field of Object.keys(ask)) {
    const missing:Record<string,unknown>={...ask};delete missing[field];
    const before=structuredClone(capturesApi.captureRows.get('cap_3n9q'));
    assert.throws(()=>job({kind:'studio_plan',plan:{kind:'tee',asks:[missing]}}),new RegExp(field));
    assert.deepEqual(capturesApi.captureRows.get('cap_3n9q'),before);
  }
  assert.throws(()=>job({kind:'studio_plan',plan:{kind:'tee',asks:[{type:'measure',text:'Measure.',name:'inseam'}]}}),/name/);
  assert.throws(()=>job({kind:'studio_plan',plan:{kind:'hat',asks:[{type:'measure',text:'Measure.',name:'length'}]}}),/name/);
  job({kind:'studio_plan',plan:{kind:'tee',asks:valid}});
  job({kind:'studio_plan',plan:{kind:'unrecognised',asks:[{type:'measure',text:'Measure.',name:'custom'}]}});
});
test('capture intent: defaults to sell, keeps a named job on read, and refuses any other', async () => {
  const opened = await requestCapture('POST /v1/captures', openInput);
  assert.equal(opened.status, 201); assert.equal((await opened.json()).intent, 'sell');
  const worth = await (await requestCapture('POST /v1/captures', {...openInput, purpose: 'appraise', intent: 'worth'})).json();
  assert.equal(worth.intent, 'worth');
  const read = await route('GET /v1/captures/:id', handlers['GET /v1/captures/:id'])(new Request(`http://edge.test/v1/captures/${worth.id}`, {headers: {Authorization: 'Bearer good'}}));
  assert.equal((await read.json()).intent, 'worth');
  for (const intent of ['appraise', '', 7, null]) {
    const r = await requestCapture('POST /v1/captures', {...openInput, intent});
    assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
  }
});

test('a captured photo gets a single-use upload target in the process photo store, an example row keeps the example address', async () => {
  keptShared.__secondhandPhotos=undefined;keptSetBlobs(undefined);
  const c=await bodyOf(await requestCapture('POST /v1/captures',openInput,'other'));
  const response=await at('POST /v1/captures/:id/photos',c.id,{photos:[photo('front')]},'other');
  assert.equal(response.status,201,JSON.stringify(await response.clone().json()));
  const upload=(await response.json()).photos[0].upload;
  assert.match(upload.url,/^http:\/\/localhost:\d+\/v1\/uploads\/[a-f0-9]{64}$/);
  assert.equal(upload.method,'PUT');
  assert.ok(Date.parse(upload.expires_at)>Date.now());
});


const jpeg=readFileSync(new URL('../../../../assets/demo-items/switch-oled.jpg',import.meta.url));
async function captureBlobs(t:import('node:test').TestContext) {
  const {DatabaseSync}=await import('node:sqlite');
  const {kv}=await import('../store/kv.ts');
  const {createBlobs}=await import('../store/blobs.ts');
  const {setBlobs}=await import('./uploads.ts');
  const {mkdtemp,rm}=await import('node:fs/promises');
  const dir=await mkdtemp(join(tmpdir(),'capture-test-'));
  const database=new DatabaseSync(':memory:');
  const blobs=createBlobs({kv:kv(database),dir,origin:'http://capture.test',log:deps.log});
  const shared=globalThis as typeof globalThis & {__secondhandPhotos?:typeof blobs};
  const old=shared.__secondhandPhotos;shared.__secondhandPhotos=blobs;setBlobs(blobs);
  t.after(async()=>{shared.__secondhandPhotos=old;setBlobs(undefined);await rm(dir,{recursive:true,force:true});database.close();});
  return blobs;
}
async function openedIntent(intent:string,extra:Record<string,unknown>={}) {
  const {purpose:_purpose,...input}=openInput;
  return bodyOf(await requestCapture('POST /v1/captures',{...input,intent,...extra}));
}
async function joinedCapture(id:string) {return bodyOf(await at('GET /v1/captures/:id',id));}

test('finish starts one identify job even with no shots and waits for it',async()=>{
  const c=await openedIntent('sell');
  const response=await at(finishEndpoint,c.id,{version:c.version});assert.equal(response.status,202);
  const body=await response.json();const id=body.jobs.find((j:{kind:string})=>j.kind==='identify').id;
  const before=structuredClone(capturesApi.captureRows.get(c.id));
  await capturesApi.pendingIdentify('usr_8f2k',c.id);
  // Finish waits for identify before it writes the item (d1006a17): the job is done, and nothing moves afterwards.
  const {jobs}=await import('./jobs.ts');const job=jobs.get(id,'usr_8f2k')!;
  assert.equal(job.state,'done');
  assert.deepEqual(capturesApi.captureRows.get(c.id),before);
  assert.equal((await at(finishEndpoint,c.id,{version:c.version})).status,409);
  assert.equal(capturesApi.captureRows.get(c.id)!.identify_job_id,id);
});

test('finish refuses a kept photo whose bytes were never uploaded, and a capture with no photo',async t=>{
  await captureBlobs(t);
  deps.verify=async token=>token==='other'?'usr_other':null;
  let c=await bodyOf(await requestCapture('POST /v1/captures',openInput,'other'));
  const none=await at(finishEndpoint,c.id,{version:c.version},'other');
  assert.equal(none.status,400);assert.equal((await none.json()).message,'Add a photo before saving the item');
  await at(photosEndpoint,c.id,{photos:[photo('front')]},'other');
  c=await bodyOf(await at('GET /v1/captures/:id',c.id,undefined,'other'));
  const missing=await at(finishEndpoint,c.id,{version:c.version},'other');
  assert.equal(missing.status,400);assert.equal((await missing.json()).message,'Upload each photo before saving the item');
  assert.notEqual(capturesApi.captureRows.get(c.id)!.status,'judged','a refused finish leaves the capture open');
});

test('intent alone derives purpose and rejects disagreement',async()=>{
  const track=await openedIntent('track');assert.equal(capturesApi.captureRows.get(track.id)!.state.purpose,'find');
  await at(photosEndpoint,track.id,{photos:[photo('front'),photo('back'),photo('tag')]});
  await capturesApi.pendingIdentify('usr_8f2k',track.id);
  assert.ok(!(await joinedCapture(track.id)).plan.questions.some(q=>q.field==='condition'));
  const worth=await openedIntent('worth');assert.equal(capturesApi.captureRows.get(worth.id)!.state.purpose,'appraise');
  const legacy=await bodyOf(await requestCapture('POST /v1/captures',{...openInput,purpose:'appraise'}));assert.deepEqual(worth.plan.questions.map(q=>q.field),legacy.plan.questions.map(q=>q.field));
  assert.equal((await requestCapture('POST /v1/captures',{...openInput,intent:'worth'})).status,400);
});

test('tag metadata rejects too many lines, long lines, too many codes and front text before writing',async()=>{
  const c=await openedIntent('sell');
  for(const [field,p] of [
    ['text',{...photo('tag'),text:Array.from({length:201},()=>({line:'x',confidence:0}))}],
    ['text',{...photo('tag'),text:[{line:'x'.repeat(201),confidence:0}]}],
    ['text',{...photo('front'),text:[{line:'Carhartt',confidence:0}]}],
    ['text',{...photo('tag'),text:[{line:'x',confidence:1.1}]}],
    ['codes',{...photo('front'),codes:Array.from({length:11},()=>({symbology:'QR',payload:'x'}))}],
    ['codes',{...photo('front'),codes:[{symbology:'QR',payload:'x'.repeat(65)}]}],
  ] as const) {
    const before=structuredClone(capturesApi.captureRows.get(c.id));
    const r=await at(photosEndpoint,c.id,{photos:[p]});assert.equal(r.status,422);
    assert.deepEqual((await r.json()).fields,[field]);assert.deepEqual(capturesApi.captureRows.get(c.id),before);
  }
});

test('edit preserves a human brand through later identify and validates row, value and version',async()=>{
  let c=await openedIntent('sell');
  await at(photosEndpoint,c.id,{photos:[photo('front'),photo('back'),{...photo('tag'),text:[{line:'Carhartt RN 14806',confidence:0}]}]});
  await capturesApi.pendingIdentify('usr_8f2k',c.id);c=await joinedCapture(c.id);
  for(const edit of [{field:'unknown',value:'x'},{field:'department',value:'unisex'},{field:'brand',value:''}]) assert.equal((await at(patchEndpoint,c.id,{version:c.version,edit})).status,422);
  const old=c.version;
  c=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,edit:{field:'brand',value:'Carhartt WIP'}}));assert.equal(c.version,old+1);
  assert.equal((await at(patchEndpoint,c.id,{version:old,edit:{field:'brand',value:'Carhartt'}})).status,409);
  await at(photosEndpoint,c.id,{photos:[{...photo('tag'),text:[{line:'Carhartt RN 14806',confidence:0}]}]});
  await capturesApi.pendingIdentify('usr_8f2k',c.id);
  assert.deepEqual(capturesApi.captureRows.get(c.id)!.state.facts.brand,{value:'Carhartt WIP',source:'you_said',confidence:1,confirmed:true});
  c=await joinedCapture(c.id);
  c=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,answer:{field:'condition',value:'good'}}));
  assert.equal((await at(patchEndpoint,c.id,{version:c.version,edit:{field:'condition',value:'impossible'}})).status,422);
});

test('answer ask_id refuses a stale question id without changing the capture',async()=>{
  const c=await askingCapture();
  const r=await at(patchEndpoint,c.id,{version:c.version,answer:{ask_id:'superseded',field:'condition',value:'good'}});
  assert.equal(r.status,409);
});

for(const [item,brand] of [['carhartt-pants','Carhartt'],['chico-hoodie','Russell Athletic'],['marquette-tee','Fruit of the Loom']] as const)
  test(`${item}: recorded tag opens brand evidence and classification asks a site's own field`,async t=>{
    const {readFile}=await import('node:fs/promises');
    const manifest=JSON.parse(await readFile(new URL(`../../../../research/studio/ben/slides/runs/20261115-0800-43692434630/${item}/manifest.json`,import.meta.url),'utf8')) as {read:{tag_text:string};kind:string};
    // Recorded Inseam row from engines/listing/classify.test.ts's Taxonomy fixture.
    capturesApi.deps.listingAspects={ebay:{categoryId:'57989',aspects:[{localizedAspectName:'Inseam',aspectConstraint:{aspectRequired:true,aspectMode:'FREE_TEXT',aspectMaxLength:65}}]}};
    t.after(()=>{capturesApi.deps.listingAspects=undefined;});
    let c=await openedIntent('sell');
    c=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,type:'apparel'}));
    const row=capturesApi.captureRows.get(c.id)!;row.state.sites=['ebay','depop','poshmark'];row.state.kind=manifest.kind;
    // Vision's bounded lines preserve the exact recorded text across line boundaries.
    const lines=manifest.read.tag_text.match(/.{1,200}/gs)!.map(line=>({line,confidence:0}));
    const response=await at(photosEndpoint,c.id,{photos:[photo('front'),photo('back'),{...photo('tag'),text:lines}]});assert.equal(response.status,201);
    c=(await response.json()).capture;
    const before=plan({...row.state,lookups:'done'},memoryStore()).questions.length;
    await capturesApi.pendingIdentify('usr_8f2k',c.id);c=await joinedCapture(c.id);
    const jobId=capturesApi.captureRows.get(c.id)!.identify_job_id!;
    const {getJob}=await import('./jobs.ts');
    const job=await route('GET /v1/jobs/:id',getJob())(new Request(`http://edge.test/v1/jobs/${jobId}`,{headers:{Authorization:'Bearer good'}}));
    const jobBody=await job.json();assert.equal(jobBody.state,'done');assert.equal(jobBody.stages.length,4);
    const q=c.plan.questions.find(q=>q.field==='brand')!;assert.ok(q);
    const proposed=q.options.find(o=>o.value===brand)!;assert.equal(proposed.proposed,true);
    if(item==='carhartt-pants') assert.ok(proposed.rests_on?.some(r=>r.includes('RN 14806')));
    t.diagnostic(`capture.identify.questions ${item} before=${before} after=${c.plan.questions.length}`);
    assert.ok(c.plan.questions.some(q=>q.field==='ebay:Inseam'));
    for(const field of ['ebay:Inseam','unlisted']) assert.equal((await at(patchEndpoint,c.id,{version:c.version,answer:{field,value:'x'.repeat(66)}})).status,422);
    c=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,answer:{field:'ebay:Inseam',value:'36'}}));
    assert.ok(!c.plan.questions.some(q=>q.field==='ebay:Inseam'));
    c=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,edit:{field:'ebay:Inseam',value:'34'}}));
    assert.equal(capturesApi.captureRows.get(c.id)!.state.facts['ebay:Inseam'].value,'34');
  });

test('visual-only brand has evidence but no proposed option',async t=>{
  capturesApi.deps.identifyPorts={visual:async()=>[{title:'Nike shirt',rank:1}]};t.after(()=>{capturesApi.deps.identifyPorts=undefined;});
  const c=await openedIntent('sell');
  await at(photosEndpoint,c.id,{photos:[photo('front'),photo('back'),photo('tag')]});await capturesApi.pendingIdentify('usr_8f2k',c.id);
  const q=(await joinedCapture(c.id)).plan.questions.find(q=>q.field==='brand')!;
  assert.equal(q.options.find(o=>o.value==='Nike')?.proposed,false);assert.ok(q.options.every(o=>!o.proposed));
});

test('throwing identify port fails the job and ends waiting without an unhandled rejection',async t=>{
  capturesApi.deps.identifyPorts={visual:async()=>{throw new Error('recorded visual error');}};t.after(()=>{capturesApi.deps.identifyPorts=undefined;});
  const c=await openedIntent('sell');await at(photosEndpoint,c.id,{photos:[photo('front'),photo('back'),photo('tag')]});
  await capturesApi.pendingIdentify('usr_8f2k',c.id);
  const row=capturesApi.captureRows.get(c.id)!;assert.equal(row.state.lookups,'done');
  const {jobs}=await import('./jobs.ts');const job=jobs.get(row.identify_job_id!,'usr_8f2k')!;
  assert.equal(job.state,'failed');assert.match(job.reason!,/recorded visual error/);
  assert.ok((await joinedCapture(c.id)).plan.questions.some(q=>q.field==='brand'));
});

test('identify facts obey source and confirmation precedence and not_read never overwrites',async()=>{
  const c=await openedIntent('sell');const row=capturesApi.captureRows.get(c.id)!;
  row.state.facts.size_label={value:'XL',source:'you_said',confidence:1};
  row.state.facts.fabric={value:'wool',source:'label',confidence:1,confirmed:true};
  capturesApi.applyJobResult('usr_8f2k',c.id,{kind:'identify',action:'ask',set:[],others:[],facts:[{field:'size_label',value:'M',source:'label',confidence:1},{field:'fabric',value:'cotton',source:'label',confidence:1}]});
  assert.equal(capturesApi.captureRows.get(c.id)!.state.facts.size_label.value,'XL');assert.equal(capturesApi.captureRows.get(c.id)!.state.facts.fabric.value,'wool');
  assert.throws(()=>capturesApi.applyJobResult('usr_8f2k',c.id,{kind:'identify',action:'ask',set:[],facts:[{field:'fabric',value:null,source:'label',confidence:0,unknown_reason:'not_read'}]}));
});

test('identify candidates retain distinct set then others values with the strongest evidence',async()=>{
  const c=await openedIntent('sell');
  const member=(brand:string,c:number,reason:string)=>({product_id:brand+reason,family:'apparel',brand,c,rests_on:[reason]});
  capturesApi.applyJobResult('usr_8f2k',c.id,{kind:'identify',action:'pick',set:[member('Nike',.8,'tag'),member('Nike',.7,'code')],others:[member('Adidas',.5,'visual'),member('Nike',.4,'model')]});
  const state=capturesApi.captureRows.get(c.id)!.state;
  assert.deepEqual(state.candidates!.brand,['Nike','Adidas']);assert.deepEqual(state.candidate_detail!.brand.Nike,{c:.8,rests_on:['tag']});
  for(const bad of [{rests_on:[]},{rests_on:['x'.repeat(121)]},{rests_on:Array(7).fill('x')}]) assert.throws(()=>capturesApi.applyJobResult('usr_8f2k',c.id,{kind:'identify',action:'ask',set:[{...member('Nike',.8,'tag'),...bad}]}));
});

test('front upload reruns identify once with bytes only when the first set was empty',async t=>{
  await captureBlobs(t);const seen:(string|undefined)[]=[];
  capturesApi.deps.identifyPorts={visual:async p=>{seen.push(p.file_ref);return p.file_ref?[{title:'Nike shirt',rank:1}]:[];}};t.after(()=>{capturesApi.deps.identifyPorts=undefined;});
  const c=await openedIntent('sell');const response=await at(photosEndpoint,c.id,{photos:[{...photo('front'),bytes:jpeg.byteLength},photo('back'),photo('tag')]});const body=await response.json();
  await capturesApi.pendingIdentify('usr_8f2k',c.id);const first=capturesApi.captureRows.get(c.id)!.identify_job_id;
  const {handlers:uploads}=await import('./uploads.ts');const front=body.photos[0];
  assert.equal((await route('PUT /v1/uploads/:id',uploads['PUT /v1/uploads/:id'],{auth:'none',body:'raw',max_bytes:jpeg.byteLength})(new Request(front.upload.url,{method:'PUT',body:jpeg}))).status,204);
  await capturesApi.pendingIdentify('usr_8f2k',c.id);
  assert.notEqual(capturesApi.captureRows.get(c.id)!.identify_job_id,first);assert.equal(seen.length,2);assert.match(seen[1]!,/^data:image\/jpeg;base64,/);
});

test('two people own separate identify jobs and a foreign result cannot write',async()=>{
  const a=await openedIntent('sell');const b=await bodyOf(await requestCapture('POST /v1/captures',openInput,'other'));
  for(const [c,who] of [[a,'good'],[b,'other']] as const) await at(photosEndpoint,c.id,{photos:[photo('front'),photo('back'),{...photo('tag'),text:[{line:who==='good'?'Carhartt RN 14806':'Nike',confidence:0}]}]},who);
  await capturesApi.pendingIdentify('usr_8f2k',a.id);await capturesApi.pendingIdentify('usr_other',b.id);
  const {jobs}=await import('./jobs.ts');
  for(const [c,owner] of [[a,'usr_8f2k'],[b,'usr_other']] as const) assert.equal(jobs.get(capturesApi.captureRows.get(c.id)!.identify_job_id!,owner)!.user_id,owner);
  const before=structuredClone(capturesApi.captureRows.get(a.id));
  assert.throws(()=>capturesApi.applyJobResult('usr_other',a.id,{kind:'identify',action:'ask',set:[]}));assert.deepEqual(capturesApi.captureRows.get(a.id),before);
});

test('finish waits for a running identify, and nothing changes the capture after it',async t=>{
  let release:()=>void=()=>{};let entered:()=>void=()=>{};
  const running=new Promise<void>(resolve=>{entered=resolve;});
  const gate=new Promise<void>(resolve=>{release=resolve;});
  capturesApi.deps.identifyPorts={visual:async()=>{entered();await gate;return [{title:'Nike',rank:1}];}};
  t.after(()=>{capturesApi.deps.identifyPorts=undefined;release();});
  let c=await openedIntent('sell');await at(photosEndpoint,c.id,{photos:[photo('front'),photo('back'),photo('tag')]});
  await running;c=await joinedCapture(c.id);
  // Finish waits for identify before it writes the item (d1006a17), so it cannot answer while identify runs.
  let answered=false;
  const finishing=at(finishEndpoint,c.id,{version:c.version}).then(response=>{answered=true;return response;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(answered,false,'finish must wait for the running identify');
  release();
  assert.equal((await finishing).status,202);
  await capturesApi.pendingIdentify('usr_8f2k',c.id);
  const after=structuredClone(capturesApi.captureRows.get(c.id))!;
  assert.equal(after.status,'judged');
  const {jobs}=await import('./jobs.ts');assert.equal(jobs.get(after.identify_job_id!,'usr_8f2k')!.state,'done');
  assert.throws(()=>job(identify([product]),'usr_8f2k',c.id),ApiError,'a result after finish is refused');
  assert.deepEqual(capturesApi.captureRows.get(c.id),after);
});

test('a partial shoot starts no identify job; completing it starts one; only a label retake starts another',async()=>{
  const c=await openedIntent('sell');
  await at(photosEndpoint,c.id,{photos:[photo('front')]});assert.equal(capturesApi.captureRows.get(c.id)!.identify_job_id,undefined);
  await at(photosEndpoint,c.id,{photos:[photo('back'),photo('tag')]});await capturesApi.pendingIdentify('usr_8f2k',c.id);
  const first=capturesApi.captureRows.get(c.id)!.identify_job_id;
  await at(photosEndpoint,c.id,{photos:[photo('front')]});assert.equal(capturesApi.captureRows.get(c.id)!.identify_job_id,first);
  await at(photosEndpoint,c.id,{photos:[photo('tag')]});assert.notEqual(capturesApi.captureRows.get(c.id)!.identify_job_id,first);
  await capturesApi.pendingIdentify('usr_8f2k',c.id);
});

test('read screen lines are discarded while label text and codes are retained on their photo',async()=>{
  const c=await openedIntent('sell');
  const text=[{line:'private screen marker',confidence:0}];
  await at(photosEndpoint,c.id,{photos:[{...photo('read'),text}]});
  assert.ok(!JSON.stringify(capturesApi.captureRows.get(c.id)).includes('private screen marker'));
  const codes=[{symbology:'QR',payload:'recorded-label-code'}];
  await at(photosEndpoint,c.id,{photos:[{...photo('tag'),text:[{line:'Carhartt',confidence:0}],codes}]});
  const row=capturesApi.captureRows.get(c.id)!.photo_rows!.find(p=>p.role==='tag')!;
  assert.deepEqual(row.read_text,[{line:'Carhartt',confidence:0}]);assert.deepEqual(row.codes,codes);
});

test('edit can change the selected type even when it lives outside facts',async()=>{
  let c=await openedIntent('sell');
  c=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,type:'apparel'}));
  c=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,edit:{field:'type',value:'shoes'}}));
  assert.equal(capturesApi.captureRows.get(c.id)!.state.type,'shoes');
  assert.ok(c.plan.process.some(step=>step.key==='soles'));
});

test('site text answers obey max_length and edits need an existing value',async()=>{
  let c=await askingCapture();
  const state=capturesApi.captureRows.get(c.id)!.state;state.site_rows=[{site:'ebay',field:'ebay:Custom',name:'Custom',required:true,max_length:4}];
  assert.equal((await at(patchEndpoint,c.id,{version:c.version,edit:{field:'ebay:Custom',value:'abc'}})).status,422);
  for(const value of ['abcde',42,'']) assert.equal((await at(patchEndpoint,c.id,{version:c.version,answer:{field:'ebay:Custom',value}})).status,422);
  c=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,answer:{field:'ebay:Custom',value:'abcd'}}));
  assert.ok(!c.plan.questions.some(q=>q.field==='ebay:Custom'));
});

test('job result validates identify facts atomically against the capture rows',async()=>{
  const c=await openedIntent('sell');
  for(const fact of [{field:'unknown',value:'x',source:'label',confidence:1},{field:'size_label',value:'M',source:'seen',confidence:1},{field:'size_label',value:'M',source:'label',confidence:2},{field:'colour',value:42,source:'label',confidence:1}]) {
    const before=structuredClone(capturesApi.captureRows.get(c.id));
    assert.throws(()=>capturesApi.applyJobResult('usr_8f2k',c.id,{kind:'identify',action:'ask',set:[],facts:[{field:'size_label',value:'M',source:'label',confidence:1},fact]}));
    assert.deepEqual(capturesApi.captureRows.get(c.id),before);
  }
});

test('identify job logs its stages, completion and capture merge through the shared log contract',async()=>{
  const sink=memorySink();deps.log=createLog({src:'test',build:'test',sink});
  const c=await openedIntent('sell');
  await at(photosEndpoint,c.id,{photos:[photo('front'),photo('back'),{...photo('tag'),text:[{line:'Carhartt RN 14806',confidence:0}]}]});
  await capturesApi.pendingIdentify('usr_8f2k',c.id);deps.log.end();
  const {checkLog}=await import('../../../../spec/log.mjs');
  const checked=checkLog(sink.text());assert.deepEqual(checked.problems,[]);assert.deepEqual(checked.warnings,[]);
  const jobId=capturesApi.captureRows.get(c.id)!.identify_job_id!;
  const events=sink.lines.map(line=>JSON.parse(line));
  assert.deepEqual(events.filter(event=>event.event==='job.state' && event.job===jobId).map(event=>event.state),['running','done']);
  assert.equal(events.filter(event=>event.event==='job.stage' && event.job===jobId).length,4);
});

test('ordinary label origin and colour facts cannot discard the tag brand',async()=>{
  const c=await openedIntent('sell');
  await at(photosEndpoint,c.id,{photos:[photo('front'),photo('back'),{...photo('tag'),text:[{line:'Carhartt B324 BLK\nMade in China',confidence:1}]}]});
  await capturesApi.pendingIdentify('usr_8f2k',c.id);
  const row=capturesApi.captureRows.get(c.id)!;const {jobs}=await import('./jobs.ts');
  assert.equal(jobs.get(row.identify_job_id!,'usr_8f2k')!.state,'done');
  assert.equal(row.state.facts.brand.value,'Carhartt');assert.deepEqual(row.state.facts.colour.value,['black']);assert.equal(row.state.facts.origin,undefined);
});

test('an older identify run cannot overwrite the result of a kept label retake',async t=>{
  let release:()=>void=()=>{};let entered:()=>void=()=>{};
  const gate=new Promise<void>(resolve=>{release=resolve;});const running=new Promise<void>(resolve=>{entered=resolve;});
  capturesApi.deps.identifyPorts={visual:async()=>{entered();await gate;return [{title:'Nike',rank:1}];}};
  t.after(()=>{capturesApi.deps.identifyPorts=undefined;release();});
  const c=await openedIntent('sell');await at(photosEndpoint,c.id,{photos:[photo('front'),photo('back'),photo('tag')]});
  await running;const first=capturesApi.pendingIdentify('usr_8f2k',c.id)!;const firstId=capturesApi.captureRows.get(c.id)!.identify_job_id!;
  await at(photosEndpoint,c.id,{photos:[{...photo('tag'),text:[{line:'Carhartt RN 14806',confidence:0}]}]});await capturesApi.pendingIdentify('usr_8f2k',c.id);
  const before=structuredClone(capturesApi.captureRows.get(c.id));release();await first;
  assert.deepEqual(capturesApi.captureRows.get(c.id),before);
  const {jobs}=await import('./jobs.ts');assert.equal(jobs.get(firstId,'usr_8f2k')!.reason,'stale');
});


test('answer ask_id cannot name a different current field',async()=>{
  const c=await askingCapture();
  const q=c.plan.questions.find(q=>q.field==='size_label') ?? c.plan.questions.find(q=>q.field!=='condition')!;
  assert.ok(q);
  assert.equal((await at(patchEndpoint,c.id,{version:c.version,answer:{ask_id:q.id,field:'condition',value:'good'}})).status,409);
});

test('front upload retries an empty first result even when its visual stage failed for missing bytes',async t=>{
  await captureBlobs(t);let calls=0;
  capturesApi.deps.identifyPorts={visual:async p=>{calls++;if(!p.file_ref)throw new Error('recorded missing bytes');return [{title:'Nike',rank:1}];}};
  t.after(()=>{capturesApi.deps.identifyPorts=undefined;});
  const c=await openedIntent('sell');
  const r=await at(photosEndpoint,c.id,{photos:[{...photo('front'),bytes:jpeg.byteLength},photo('back'),photo('tag')]});const body=await r.json();
  await capturesApi.pendingIdentify('usr_8f2k',c.id);const first=capturesApi.captureRows.get(c.id)!.identify_job_id;
  const {handlers:uploads}=await import('./uploads.ts');
  const uploaded=await route('PUT /v1/uploads/:id',uploads['PUT /v1/uploads/:id'],{auth:'none',body:'raw',max_bytes:jpeg.byteLength})(new Request(body.photos[0].upload.url,{method:'PUT',body:jpeg}));assert.equal(uploaded.status,204);
  await capturesApi.pendingIdentify('usr_8f2k',c.id);
  assert.equal(calls,2);const row=capturesApi.captureRows.get(c.id)!;assert.notEqual(row.identify_job_id,first);
  const {jobs}=await import('./jobs.ts');assert.equal(jobs.get(row.identify_job_id!,'usr_8f2k')!.state,'done');
});


test('site selection answers and edits reject values outside allowed',async()=>{
  let c=await askingCapture();
  // siteRows representation of the committed classification test's selection-only Rise row.
  capturesApi.captureRows.get(c.id)!.state.site_rows=[{site:'ebay',field:'ebay:Rise',name:'Rise',required:false,allowed:['High']}];
  assert.equal((await at(patchEndpoint,c.id,{version:c.version,answer:{field:'ebay:Rise',value:'Mid'}})).status,422);
  c=await bodyOf(await at(patchEndpoint,c.id,{version:c.version,answer:{field:'ebay:Rise',value:'High'}}));
  assert.equal((await at(patchEndpoint,c.id,{version:c.version,edit:{field:'ebay:Rise',value:'Mid'}})).status,422);
});
