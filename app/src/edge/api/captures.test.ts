import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import * as capturesApi from './captures.ts';
import { handlers, manifest, resetCaptures } from './captures.ts';

const prefixes = ["captures"];
const examples = EXAMPLES.filter(e => prefixes.includes(e.endpoint.split(' ')[1].split('/')[2]));
beforeEach(async t => {
  resetCaptures();
  deps.verify = async token => token === 'good' ? 'usr_8f2k' : token === 'other' ? 'usr_other' : null;
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.idem.clear(); deps.visits.clear(); deps.now = () => Date.now();
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

async function askingCapture() {
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

type CaptureBody = {id:string;version:number;state:string;plan:ReturnType<typeof plan>};
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
  c=await bodyOf(await requestCapture(photosEndpoint,{photos:[photo('front',[{field:'colour',value:['invalid'],source:'seen',confidence:0}])]}));
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
test('PATCH preserves status after shooting and logs only answered or refused field name', async () => {
  const sink=memorySink();deps.log=createLog({src:'test',build:'test',sink});
  let c=await askingCapture(); assert.equal(c.state,'uploading');
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,answer:{field:'condition',value:'good'}}));
  assert.equal(c.state,'uploading');
  c=await bodyOf(await requestCapture(patchEndpoint,{version:c.version,refuse:'size_label'}));
  const changes=sink.lines.map(s=>JSON.parse(s)).filter(e=>e.event==='state.change');
  assert.ok(changes.some(e=>e.field==='condition'));assert.ok(changes.some(e=>e.field==='size_label'));
  assert.ok(!changes.some(e=>'value' in e));
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
test('job results validate all fields before applying, bump once, log once and enforce ownership', async () => {
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
  assert.equal(sink.lines.map(s=>JSON.parse(s)).filter(e=>e.event==='state.change').length,3);
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
