import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { ApiError, deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import * as capturesApi from './captures.ts';
import { handlers, manifest, resetCaptures } from './captures.ts';
import type { Attribute } from '../card/card.ts';
import { table } from '../../engines/capture/table.ts';
import type { Store } from '../events/ports.ts';

const prefixes = ["captures"];
const examples = EXAMPLES.filter(e => prefixes.includes(e.endpoint.split(' ')[1].split('/')[2]));
const exampleCreatedAt = (examples.find(e => e.name === 'captures.open')!.response as {created_at:string}).created_at;
beforeEach(async t => {
  resetCaptures();
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
    const body = await response.json(); bodies.push(body);
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
  assert.equal(c.item_id,'it_1');
  const row=capturesApi.captureRows.get(c.id)!;
  assert.equal(row.user_id,'usr_other');assert.equal(row.item_id,c.item_id);
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
  assert.equal(first.id,'cap_3n9q');assert.equal(second.id,'cap_1');assert.equal(other.id,'cap_2');
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
  const c=await askingCapture();
  const before=structuredClone(capturesApi.captureRows.get(c.id));
  const {runtime}=await import('./runtime.ts');
  const itemBefore=structuredClone(runtime.store.get('item','usr_8f2k',c.item_id));
  const tx=t.mock.method(runtime.store,'tx');
  const put=t.mock.method(runtime.store,'put',()=>{throw new Error('item write failed');});
  const response=await requestCapture(finishEndpoint,{version:c.version});
  assert.equal(response.status,503);assert.equal((await response.json()).code,'waking');
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
  assert.equal((await at(finishEndpoint,c.id,{version:c.version},'other')).status,202);
  const {runtime}=await import('./runtime.ts');
  const row=runtime.store.get('item','usr_other',c.item_id)!;
  assert.equal(row.origin,'capture');assert.equal(row.data,'captured');assert.equal(row.quantity,2);
  assert.equal(row.title,'');assert.equal(row.state,'researching');assert.deepEqual(row.photos,[]);
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
