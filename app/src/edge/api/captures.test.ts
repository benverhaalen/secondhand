import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
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
  if (['captures.set_type','captures.finish','captures.answer','captures.refuse'].includes(name)) {
    await call(examples.find(e => e.name === 'captures.photos')!);
  }
  if (['captures.finish','captures.answer','captures.refuse'].includes(name)) {
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
for (const e of examples.filter(e => e.status < 400 && e.auth !== 'visitor')) test(e.name + ': wrong user cannot read or act on example data', async () => {
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
const openInput = {mode:'shots',purpose:'sell',suggestion:{family:'apparel',p:.86,second_p:.05},device:{has_lidar:true}};
async function routeWalk() {
  const bodies: unknown[] = [];
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
    capture = await step(patchEndpoint,{version:capture.version,answer:{field:q.field,value}});
  }
  assert.equal(capture.plan.status,'done');
  for(const site of state.sites) assert.equal(capture.plan.complete[site].ready,true,site);
  return bodies;
}
test('T-shirt walks through routes twice with deterministic bodies', async () => {
  const {resetCaptures}=await import('./captures.ts');
  resetCaptures(); const first=await routeWalk();
  resetCaptures(); deps.idem.clear(); assert.deepEqual(await routeWalk(),first);
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
