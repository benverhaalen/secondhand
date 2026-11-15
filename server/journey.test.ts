// Rests-on: spec/examples/{auth,buy,captures,jobs,me,routes}.json; server/proof.test.ts.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test, type TestContext } from 'node:test';

type ObjectBody = Record<string, unknown>;
type Reply = { status: number; body: ObjectBody; text: string; headers: Headers };
type Person = { access: string; refresh: string; id: string };
type Frame = { id: number; event: string; data: ObjectBody };
const code = '246810';
const emails = ['journey-one@example.invalid', 'journey-two@example.invalid'];
const lists = ['today', 'items', 'orders', 'wants', 'conversations', 'events', 'lookups', 'accounts', 'decisions', 'follows', 'rules'];
const savedEnv = new Map(['NODE_ENV', 'SECONDHAND_DATA_DIR', 'SECONDHAND_DEV_CODE', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'BROWSER_USE_API_KEY'].map(name => [name, process.env[name]]));
// No model key in this walk: the chat must refuse cleanly, and no outside call may be attempted.
delete process.env.OPENROUTER_API_KEY; delete process.env.ANTHROPIC_API_KEY; delete process.env.BROWSER_USE_API_KEY;
const realFetch = globalThis.fetch;
let folder: string;
let start: typeof import('./main.ts').start;
let server: Awaited<ReturnType<typeof start>> | undefined;
let routes: typeof import('./routes.ts');
let table: Awaited<ReturnType<typeof routes.discover>>;
let socketRefusal = '';
let search: typeof import('../app/src/edge/api/search.ts');
let originalPorts: typeof search.ports;
let contractExamples: typeof import('../app/src/edge/api/examples.ts').EXAMPLES;
let routeManifest: typeof import('../app/src/edge/api/routes.ts').manifest;
const walked = new Set<string>();
let example: typeof import('../app/src/edge/api/examples.ts').example;
let visitorId: typeof import('../app/src/edge/api/http.ts').visitorId;
let visitor: string;
let otherVisitor: string;
let one: Person;
let two: Person;
let visitorJob: string;
let personJob: string;
let captureId: string;
let wantId: string;
const forbiddenNetwork: string[] = [];

function object(value: unknown): ObjectBody {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'response must be an object');
  return value as ObjectBody;
}
function string(value: unknown): string {
  assert.ok(typeof value === 'string' && value.length > 0, 'response must contain a nonempty string');
  return value;
}
function rows(body: ObjectBody, field = 'data'): ObjectBody[] {
  assert.ok(Array.isArray(body[field]), `response must contain ${field}[]`);
  return body[field].map(object);
}
function safe(text: string): string {
  for (const person of [one, two]) for (const token of [person?.access, person?.refresh]) {
    if (token) text = text.replaceAll(token, '[token]');
  }
  return text.replace(/"(access_token|refresh_token)":"[^"]+"/g, '"$1":"[token]"');
}

// Collect independent assertion failures so a broken route does not hide the rest of a step.
function checks() {
  const failures: string[] = [];
  return {
    check(run: () => void) {
      try { run(); } catch (error) {
        if (!(error instanceof assert.AssertionError)) throw error;
        failures.push(error.message);
      }
    },
    finish() { assert.deepEqual(failures, [], failures.join('\n')); },
  };
}
// JOURNEY_TIMINGS=<file> writes every request's route, status and time to headers, for the benchmark table.
const timings: { endpoint: string; status: number; ms: number }[] = [];
after(async () => { if (process.env.JOURNEY_TIMINGS) await writeFile(process.env.JOURNEY_TIMINGS, JSON.stringify(timings)); });
async function request(method: string, path: string, headers: Record<string, string> = {}, body?: unknown): Promise<Response> {
  const started = performance.now(), response = await send(method, path, headers, body);
  timings.push({ endpoint: walkedRoute(method, path) ?? `${method} ${path.split('?')[0]}`, status: response.status, ms: performance.now() - started });
  return response;
}
function walkedRoute(method: string, path: string): string | undefined {
  const pathname = path.split('?')[0];
  const foundRoute = [...routeManifest].sort((a, b) => (a.endpoint.match(/:/g)?.length ?? 0) - (b.endpoint.match(/:/g)?.length ?? 0)).find(row => {
    const [verb, pattern] = row.endpoint.split(' ');
    const parts = pathname.split('/'), segments = pattern.split('/');
    return verb === method && parts.length === segments.length && segments.every((part, i) => part.startsWith(':') || part === parts[i]);
  });
  if (foundRoute) walked.add(foundRoute.endpoint);
  return foundRoute?.endpoint;
}
async function send(method: string, path: string, headers: Record<string, string>, body?: unknown): Promise<Response> {
  const req = new Request((server?.url ?? 'http://journey.test') + path, {
    method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(8_000),
  });
  if (server) return fetch(req);
  const found = routes.match(table, method, new URL(req.url).pathname);
  assert.equal(found.kind, 'match', `${method} ${path} must exist in the real route table`);
  assert.ok(found.kind === 'match');
  return found.handler(req);
}
const bearer = (p: Person) => ({ Authorization: `Bearer ${p.access}` });
const visiting = (id: string) => ({ 'X-Visitor-Id': id });
async function call(t: TestContext, method: string, path: string, headers: Record<string, string> = {}, body?: unknown): Promise<Reply> {
  const response = await request(method, path, headers, body);
  const text = await response.text();
  t.diagnostic(safe(`${method} ${path} -> ${response.status} ${text}`));
  return { status: response.status, body: text ? object(JSON.parse(text)) : {}, text, headers: response.headers };
}
function status(reply: Reply, expected: number) {
  assert.equal(reply.status, expected, safe(`expected ${expected}, got ${reply.status}: ${reply.text}`));
}
function typedError(reply: Reply, expected: number, errorCode: string) {
  status(reply, expected);
  assert.equal(reply.body.code, errorCode);
  string(reply.body.message); string(reply.body.failed_step);
  assert.ok(['auto', 'user', 'none'].includes(string(object(reply.body.retry).by)));
}
async function signIn(t: TestContext, email: string, wrongFirst = false): Promise<Person> {
  status(await call(t, 'POST', '/v1/auth/email/start', {}, { email }), 202);
  if (wrongFirst) typedError(await call(t, 'POST', '/v1/auth/email/verify', {}, { email, code: '000000' }), 401, 'unauthenticated');
  const verified = await call(t, 'POST', '/v1/auth/email/verify', {}, { email, code });
  status(verified, 200);
  const person = { access: string(verified.body.access_token), refresh: string(verified.body.refresh_token), id: string(object(verified.body.user).id) };
  const me = await call(t, 'GET', '/v1/me', bearer(person));
  status(me, 200); assert.equal(me.body.id, person.id);
  assert.deepEqual(rows(me.body, 'auth_methods').map(method => method.provider), ['email']);
  return person;
}
async function boot() {
  try { server = await start({ host: '127.0.0.1', port: 0, ticks: false }); }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || !['EPERM', 'EACCES'].includes(String(error.code))
      || !('syscall' in error) || error.syscall !== 'listen') throw error;
    socketRefusal = error.message;
    table = await routes.discover();
  }
}

before(async () => {
  folder = await mkdtemp(join(tmpdir(), 'secondhand-journey-'));
  process.env.NODE_ENV = 'development';
  process.env.SECONDHAND_DATA_DIR = folder;
  process.env.SECONDHAND_DEV_CODE = code;
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (!server || url.origin !== server.url) {
      forbiddenNetwork.push(url.origin);
      throw new Error(`journey forbids outside network: ${url.origin}`);
    }
    return realFetch(input, init);
  };
  ({ start } = await import('./main.ts'));
  routes = await import('./routes.ts');
  ({ example, EXAMPLES: contractExamples } = await import('../app/src/edge/api/examples.ts'));
  ({ manifest: routeManifest } = await import('../app/src/edge/api/routes.ts'));
  ({ visitorId } = await import('../app/src/edge/api/http.ts'));
  // Import the composed runtime before replacing the same source seams as search.test.ts.
  await import('../app/src/edge/api/runtime.ts');
  search = await import('../app/src/edge/api/search.ts');
  originalPorts = { ...search.ports };
  const { SOURCES } = await import('../app/src/edge/intel/public/sources.ts');
  const { readPage } = await import('../app/src/edge/intel/public/readers.ts');
  const { createHarness, fakeManifest } = await import('../app/src/edge/harness/protocol.ts');
  const { memoryApifyRuns } = await import('../app/src/edge/intel/public/search.ts');
  const depop = await readFile(new URL('../spec/fixtures/pages/depop.html', import.meta.url), 'utf8');
  const poshmark = await readFile(new URL('../spec/fixtures/pages/poshmark.html', import.meta.url), 'utf8');
  Object.assign(search.ports, {
    sources: SOURCES.map(source => ({ ...source, pace: { per_minute: 1e12, min_gap_ms: 0 } })),
    harness: createHarness({ adapters: [{ route_id: 'depop.search.page', manifest: fakeManifest('depop', 'search'), async run() {
      const result = readPage('depop', depop);
      if (!result.ok) return result;
      return { ok: true, data: result.data.map(row => ({ ...row, external_id: row.id, state: 'active' })) };
    } }] }),
    routed: (site: string) => site === 'depop', apify: undefined, shopping: undefined, apifyRuns: memoryApifyRuns(),
    dupe: { search: async () => ({ ok: true, data: { rows: [], dropped: 0, total: 0, keep_until: new Date().toISOString() } }) },
    deadline_ms: 500,
    fetchPage: async () => ({ ok: true, html: poshmark, final_url: '', status: 200, rung: 'plain', ms: 1, searched: [] }),
    ask: async (_state, questions) => ({ ok: true, ms: 0,
      answers: Object.fromEntries(Object.keys(questions).map(key => [key, { choice: key.startsWith('m') ? 'likely_same_model' : 'keep' }])) }),
  } satisfies Partial<typeof search.ports>);
  visitor = visitorId(); otherVisitor = visitorId();
  await boot();
});

after(async () => {
  try {
    if (search) await Promise.all(search.searchJobs.pendingSearches.values());
    await server?.close();
    assert.deepEqual(forbiddenNetwork, [], 'no outside network may even be attempted');
  } finally {
    if (originalPorts) Object.assign(search.ports, originalPorts);
    globalThis.fetch = realFetch;
    for (const [name, value] of savedEnv) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    // The store keeps its SQLite file open for the life of the process, and Windows will not unlink an open file.
    if (folder) await rm(folder, { recursive: true, force: true }).catch(e => { if (e.code !== 'EBUSY') throw e; });
  }
});

test('1. A visitor sees health and a typed sign-in requirement', async t => {
  const c = checks();
  if (socketRefusal) {
    t.todo('Sandbox refuses port 0; /healthz has no route-table handler');
    t.diagnostic(`Using real discovered handlers: ${socketRefusal}`);
    c.check(() => assert.ok(server, '/healthz requires the refused HTTP listener'));
  } else {
    const health = await call(t, 'GET', '/healthz');
    c.check(() => { status(health, 200); assert.deepEqual(health.body, { ok: true }); });
  }
  const today = await call(t, 'GET', '/v1/today');
  c.check(() => {
    typedError(today, 401, 'unauthenticated');
    assert.deepEqual(today.body, { code: 'unauthenticated', message: 'no token', failed_step: 'auth', retry: { by: 'user' } });
  });
  c.finish();
});

test('2. Email sign-in rejects a wrong code and identifies person one', async t => {
  one = await signIn(t, emails[0], true);
});

test('3. A second person signs in and has a distinct identity and tokens', async t => {
  two = await signIn(t, emails[1], true);
  assert.notEqual(one.id, two.id); assert.notEqual(one.access, two.access); assert.notEqual(one.refresh, two.refresh);
});

test('4. Every list is empty for both new people', async t => {
  const c = checks();
  for (const [name, person] of [['one', one], ['two', two]] as const) for (const route of lists) {
    const response = await call(t, 'GET', `/v1/${route}`, bearer(person));
    c.check(() => {
      status(response, 200);
      const data = route === 'today' ? [...rows(response.body, 'decisions'), ...rows(response.body, 'notices')] : rows(response.body);
      assert.equal(data.length, 0, `${name}: /v1/${route} returned a row for a new person: ${JSON.stringify(data[0])}`);
    });
  }
  c.finish();
});

async function replay(t: TestContext, id: string, headers: Record<string, string>) {
  const response = await request('GET', `/v1/jobs/${id}/events`, { ...headers, 'Last-Event-ID': '0' });
  assert.equal(response.status, 200); assert.match(response.headers.get('Content-Type') ?? '', /text\/event-stream/);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel('journey stream deadline'); }, 8_000);
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally { clearTimeout(timer); await reader.cancel(); }
  assert.equal(timedOut, false, 'the job stream must close itself after settling');
  const frames: Frame[] = text.split(/\r?\n\r?\n/).filter(block => /^id:/m.test(block)).map(block => {
    const lines = block.split(/\r?\n/);
    return { id: Number(lines.find(line => line.startsWith('id:'))?.slice(3)),
      event: lines.find(line => line.startsWith('event:'))!.slice(6).trim(),
      data: object(JSON.parse(lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n'))) };
  });
  t.diagnostic(`SSE /v1/jobs/${id}/events from 0: ${frames.length} frames; ${JSON.stringify(frames.map(frame => ({ id: frame.id, event: frame.event })))}`);
  assert.ok(frames.length > 0); assert.equal(frames[0].id, 1);
  frames.forEach((frame, i) => { if (i) assert.ok(frame.id > frames[i - 1].id); });
  assert.ok(frames.some(frame => frame.event === 'answer.settled'), 'stream must include the settled answer');
  const last = frames.at(-1)!;
  assert.equal(last.event, 'job.state'); assert.equal(last.data.state, 'done');
  const found = object(object(last.data.result).found);
  t.diagnostic(`Final frame: state=${last.data.state}; found=${JSON.stringify(found)}`);
  assert.ok(Number(found.results_found) > 0, 'real search must read the stub source fixtures');
  assert.equal(found.results_found, Number(found.results_used) + Object.values(object(found.dropped_by_reason)).reduce<number>((sum, value) => sum + Number(value), 0));
}

test('5. A visitor searches, owns the job, and replays the settled stream', async t => {
  const result = await call(t, 'POST', '/v1/search', visiting(visitor), example('search.text').request!.body);
  status(result, 202); visitorJob = string(result.body.id);
  assert.equal(result.headers.get('X-Visitor-Id'), visitor);
  const own = await call(t, 'GET', `/v1/jobs/${visitorJob}`, visiting(visitor));
  status(own, 200); assert.equal(own.body.id, visitorJob);
  typedError(await call(t, 'GET', `/v1/jobs/${visitorJob}`, visiting(otherVisitor)), 404, 'not_found');
  typedError(await call(t, 'GET', `/v1/jobs/${visitorJob}/events`, visiting(otherVisitor)), 404, 'not_found');
  await replay(t, visitorJob, visiting(visitor));
});

test('6. Person one searches and person two cannot read the job or stream', async t => {
  const result = await call(t, 'POST', '/v1/search', bearer(one), example('search.text').request!.body);
  status(result, 202); personJob = string(result.body.id);
  status(await call(t, 'GET', `/v1/jobs/${personJob}`, bearer(one)), 200);
  typedError(await call(t, 'GET', `/v1/jobs/${personJob}`, bearer(two)), 404, 'not_found');
  typedError(await call(t, 'GET', `/v1/jobs/${personJob}/events`, bearer(two)), 404, 'not_found');
  await replay(t, personJob, bearer(one));
});

test('7. A find capture appears only in its owner’s lookups and can be hidden', async t => {
  const created = await call(t, 'POST', '/v1/captures', bearer(one), { mode: 'shots', purpose: 'find', intent: 'find' });
  status(created, 201); captureId = string(created.body.id); assert.equal(created.body.intent, 'find');
  const own = await call(t, 'GET', '/v1/lookups', bearer(one)); status(own, 200);
  assert.deepEqual(rows(own.body).filter(row => row.kind !== 'search').map(row => row.capture_id), [captureId]);
  assert.ok(rows(own.body).filter(row => row.kind === 'search').every(row => row.capture_id === null && typeof row.short_name === 'string'), 'a person’s own searches are listed beside their lookups');
  const other = await call(t, 'GET', '/v1/lookups', bearer(two)); status(other, 200); assert.deepEqual(rows(other.body), []);
  typedError(await call(t, 'DELETE', `/v1/lookups/${captureId}`, bearer(two)), 404, 'not_found');
  const removed = await call(t, 'DELETE', `/v1/lookups/${captureId}`, bearer(one)); status(removed, 204); assert.equal(removed.text, '');
  const hidden = await call(t, 'GET', '/v1/lookups', bearer(one)); status(hidden, 200); assert.deepEqual(rows(hidden.body).filter(row => row.kind !== 'search'), []);
});

test('8. A want belongs to its author and an idempotency key cannot change its body', async t => {
  const input = object(example('wants.create').request!.body);
  const headers = { ...bearer(one), 'Idempotency-Key': 'journey-want' };
  const created = await call(t, 'POST', '/v1/wants', headers, input);
  status(created, 201); wantId = string(created.body.id); assert.equal(created.body.text, input.text);
  const own = await call(t, 'GET', '/v1/wants', bearer(one)); status(own, 200);
  assert.deepEqual(rows(own.body).map(row => row.id), [wantId]);
  const other = await call(t, 'GET', '/v1/wants', bearer(two)); status(other, 200); assert.deepEqual(rows(other.body), []);
  const again = await call(t, 'POST', '/v1/wants', headers, input); status(again, 201); assert.deepEqual(again.body, created.body);
  typedError(await call(t, 'POST', '/v1/wants', headers, { ...input, text: 'a different want' }), 409, 'idempotency_mismatch');
});

test('9. The buying chat is a real route: with no model key it refuses as unavailable, never 404', async t => {
  const reply = await call(t, 'POST', '/v1/assist', bearer(one), { surface: 'buy', text: 'what is selling and why' });
  typedError(reply, 503, 'unavailable');
});

// These steps run before deletion (10) and restart (11), retaining the original step numbers.
// There is no public endpoint that raises a decision/event: the Store fixtures below stand in for intake.
function noExampleData(body: unknown, endpoint: string) {
  const samples = contractExamples.filter(e => e.endpoint === endpoint && e.status < 400);
  const ids = new Set<string>();
  const numbers = new Map<string, Set<number>>();
  function collect(value: unknown, path = '') {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const at = path + '.' + key;
      if ((key === 'id' || key.endsWith('_id')) && typeof child === 'string') ids.add(child);
      // Versions, zero defaults and enum values are shared contract structure, not observations.
      if (typeof child === 'number' && child > 1 && ['amount_cents', 'value', 'count', 'basis_count'].includes(key)) {
        const values = numbers.get(at) ?? new Set<number>(); values.add(child); numbers.set(at, values);
      }
      collect(child, at);
    }
  }
  for (const sample of samples) collect(sample.response);
  function inspect(value: unknown, path = '') {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const at = path + '.' + key;
      if ((key === 'id' || key.endsWith('_id')) && typeof child === 'string') assert.ok(!ids.has(child), `${endpoint}: contract id at ${at}: ${child}`);
      if (typeof child === 'number') assert.ok(!numbers.get(at)?.has(child), `${endpoint}: contract figure at ${at}: ${child}`);
      inspect(child, at);
    }
  }
  inspect(body);
}
function unavailable(reply: Reply) {
  typedError(reply, 503, 'unavailable');
  assert.deepEqual(Object.keys(reply.body).sort(), ['code', 'failed_step', 'message', 'retry']);
  assert.deepEqual(reply.body.retry, { by: 'none' });
}
async function writeAgain(t: TestContext, c: ReturnType<typeof checks>, method: string, path: string,
  person: Person, key: string, body: ObjectBody, expected: number, changed: ObjectBody): Promise<Reply> {
  const headers = { ...bearer(person), 'Idempotency-Key': key };
  const first = await call(t, method, path, headers, body);
  c.check(() => status(first, expected));
  const again = await call(t, method, path, headers, body);
  c.check(() => { status(again, expected); assert.deepEqual(again.body, first.body); assert.equal(again.headers.get('Idempotent-Replayed'), 'true'); });
  const mismatch = await call(t, method, path, headers, changed);
  c.check(() => typedError(mismatch, 409, 'idempotency_mismatch'));
  return first;
}

test('12. Unbuilt appointments, packing, records, goals, experiments and scores never serve examples', async t => {
  const c = checks();
  const names = ['appointments.list', 'orders.pick_list', 'orders.bought_it', 'orders.handed_over', 'orders.ship', 'orders.labels',
    'records.csv', 'records.pdf', 'goals.put', 'experiments.list', 'experiments.consent', 'scores.list', 'scores.basis', 'sites.ranker', 'citations.get', 'insights.get'];
  for (const name of names) {
    const e = example(name), method = e.endpoint.split(' ')[0];
    for (const person of [one, two]) {
      const headers = { ...bearer(person), 'Idempotency-Key': `journey-unbuilt-${name}` };
      const bodies = method === 'GET' ? [undefined] : [e.request?.body, e.request?.body, { ...object(e.request?.body ?? {}), changed: true }];
      for (const body of bodies) {
        const reply = await call(t, method, e.path, headers, body);
        c.check(() => { unavailable(reply); noExampleData(reply.body, e.endpoint); });
      }
    }
  }
  // A 503 has not accepted a write. http.ts deliberately releases that key for a later retry;
  // successful writes, below, must instead replay and reject a changed body.
  c.finish();
});

let keptRule: string;
let journeyItem: string;
test('13. A rule is private, replays its create, and can only be deleted by its owner', async t => {
  const c = checks();
  for (const person of [one, two]) {
    const initial = await call(t, 'GET', '/v1/rules', bearer(person));
    c.check(() => { status(initial, 200); assert.deepEqual(rows(initial.body), []); noExampleData(initial.body, 'GET /v1/rules'); });
  }
  const body = { kind: 'reply_other', scope: 'all' };
  const created = await writeAgain(t, c, 'POST', '/v1/rules', one, 'journey-rule', body, 201, { ...body, kind: 'accept_offer' });
  const id = string(created.body.id);
  c.check(() => noExampleData(created.body, 'POST /v1/rules'));
  const own = await call(t, 'GET', '/v1/rules', bearer(one));
  c.check(() => { status(own, 200); assert.deepEqual(rows(own.body).map(row => row.id), [id]); });
  const other = await call(t, 'GET', '/v1/rules', bearer(two));
  c.check(() => { status(other, 200); assert.deepEqual(rows(other.body), []); });
  const foreign = await call(t, 'DELETE', `/v1/rules/${id}`, { ...bearer(two), 'Idempotency-Key': 'journey-rule-delete' });
  c.check(() => typedError(foreign, 404, 'not_found'));
  // Person two uses the same create key with their own body: no cached response crosses people.
  const second = await writeAgain(t, c, 'POST', '/v1/rules', two, 'journey-rule', body, 201, { ...body, kind: 'accept_offer' });
  keptRule = string(second.body.id); c.check(() => assert.notEqual(keptRule, id));
  // DELETE ignores bodies in the current shared HTTP layer; this assertion exposes the missing key support.
  await writeAgain(t, c, 'DELETE', `/v1/rules/${id}`, one, 'journey-rule-delete', {}, 204, { changed: true });
  const removed = await call(t, 'GET', '/v1/rules', bearer(one));
  c.check(() => { status(removed, 200); assert.deepEqual(rows(removed.body), []); });
  c.finish();
});

test('14. Limits start empty, store actual floors, and cannot change another person’s item', async t => {
  const c = checks();
  const { store } = await import('../app/src/edge/api/store.ts');
  journeyItem = 'it_' + crypto.randomUUID().replaceAll('-', '');
  store.put('item', { id: journeyItem, user_id: one.id, state: 'review', title: 'Journey item' });
  const defaults = { handover: [], pickup_windows: [], saved_spot: null, ask_every_time: false, items: [], version: 0 };
  for (const person of [one, two]) {
    const reply = await call(t, 'GET', '/v1/limits', bearer(person));
    c.check(() => { status(reply, 200); assert.deepEqual(reply.body, defaults); noExampleData(reply.body, 'GET /v1/limits'); });
  }
  const input = { version: 0, ask_every_time: true, items: [{ item_id: journeyItem, floor_cents: { amount_cents: 12347, currency: 'USD' } }] };
  const foreign = await call(t, 'PUT', '/v1/limits', bearer(two), { ...input, user_id: one.id });
  c.check(() => typedError(foreign, 404, 'not_found'));
  await writeAgain(t, c, 'PUT', '/v1/limits', one, 'journey-limits', input, 200, { ...input, ask_every_time: false });
  const own = await call(t, 'GET', '/v1/limits', bearer(one));
  c.check(() => { status(own, 200); assert.equal(own.body.ask_every_time, true); assert.equal(object(rows(own.body, 'items')[0].floor_cents).amount_cents, 12347); noExampleData(own.body, 'GET /v1/limits'); });
  const other = await call(t, 'GET', '/v1/limits', bearer(two));
  c.check(() => { status(other, 200); assert.deepEqual(other.body, defaults); });
  c.finish();
});

test('15. Decisions act once for their owner; an unbuilt action remains open', async t => {
  const c = checks();
  const { store } = await import('../app/src/edge/api/store.ts');
  for (const kind of ['accept_offer', 'studio_approve']) {
    const decision = store.raiseDecision({ user_id: one.id, kind, subject: journeyItem + kind, item_id: journeyItem,
      why: 'Journey intake fixture', options: [{ id: 'journey_yes', label: 'Yes' }, { id: 'journey_no', label: 'No' }] }).row;
    const listed = await call(t, 'GET', '/v1/decisions', bearer(one)); status(listed, 200);
    const own = rows(listed.body).find(row => row.id === decision.id)!;
    const option = rows(own, 'options')[0];
    const body = { option_id: option.id, signature: option.signature, version: own.version };
    const other = await call(t, 'GET', '/v1/decisions', bearer(two));
    c.check(() => { status(other, 200); assert.deepEqual(rows(other.body), []); noExampleData(listed.body, 'GET /v1/decisions'); });
    const path = `/v1/decisions/${decision.id}/act`;
    const foreign = await call(t, 'POST', path, { ...bearer(two), 'Idempotency-Key': 'journey-' + kind }, body);
    c.check(() => typedError(foreign, 404, 'not_found'));
    if (kind === 'accept_offer') {
      const acted = await writeAgain(t, c, 'POST', path, one, 'journey-' + kind, body, 200, { ...body, option_id: 'journey_no' });
      c.check(() => { assert.equal(object(acted.body.decision).state, 'acting'); noExampleData(acted.body, 'POST /v1/decisions/:id/act'); });
      const job = await call(t, 'GET', `/v1/jobs/${string(object(acted.body.job).id)}`, bearer(two));
      c.check(() => typedError(job, 404, 'not_found'));
    } else {
      const events = store.events({ user_id: one.id }).length, jobs = store.jobs({ user_id: one.id }).length;
      for (let attempt = 0; attempt < 2; attempt++) {
        const reply = await call(t, 'POST', path, { ...bearer(one), 'Idempotency-Key': 'journey-' + kind }, body);
        c.check(() => unavailable(reply));
      }
      c.check(() => { assert.deepEqual(store.decisions({ user_id: one.id }).find(row => row.id === decision.id), decision); assert.equal(store.events({ user_id: one.id }).length, events); assert.equal(store.jobs({ user_id: one.id }).length, jobs); });
    }
  }
  c.finish();
});

test('16. The event timeline and undo belong to one person, with one undo on replay', async t => {
  const c = checks();
  const { store } = await import('../app/src/edge/api/store.ts');
  const at = new Date().toISOString();
  const event = store.insertEvent({ user_id: one.id, source: 'app', action: 'app.list', item_id: journeyItem, dedupe_key: 'journey-undo',
    actor: 'user', why: 'Journey intake fixture', observed_at: at, effective_at: at, trace_id: 'journey', undo: { allowed: true, until: new Date(Date.now() + 3600_000).toISOString() } }).row;
  const own = await call(t, 'GET', '/v1/events?item_id=' + journeyItem, bearer(one));
  c.check(() => { status(own, 200); assert.ok(rows(own.body).some(row => row.event_id === event.id)); noExampleData(own.body, 'GET /v1/events'); });
  const other = await call(t, 'GET', '/v1/events', bearer(two));
  c.check(() => { status(other, 200); assert.deepEqual(rows(other.body), []); });
  const foreignList = await call(t, 'GET', '/v1/events?item_id=' + journeyItem, bearer(two));
  c.check(() => typedError(foreignList, 404, 'not_found'));
  const path = `/v1/events/${event.id}/undo`;
  const foreign = await call(t, 'POST', path, { ...bearer(two), 'Idempotency-Key': 'journey-undo' }, {});
  c.check(() => typedError(foreign, 404, 'not_found'));
  const undone = await writeAgain(t, c, 'POST', path, one, 'journey-undo', {}, 200, { changed: true });
  c.check(() => { assert.equal(undone.body.undo_of, event.id); noExampleData(undone.body, 'POST /v1/events/:id/undo'); assert.equal(store.events({ user_id: one.id }).filter(row => row.undo_of === event.id).length, 1); });
  c.finish();
});

test('17. The user stream replays only that person’s frames, even with a forged user_id', async t => {
  const c = checks();
  const { jobs } = await import('../app/src/edge/api/jobs.ts');
  for (const person of [one, two]) {
    const key = `user:${person.id}`;
    // A person's own writes already put resource.changed frames on their stream; none may be a contract example's.
    const before = jobs.framesAfter(key, 0);
    c.check(() => { for (const f of before) { assert.equal(f.event, 'resource.changed', 'only the person’s own write notices precede'); noExampleData(f.data, 'GET /v1/stream'); } });
    const frame = jobs.append(key, 'state.change', { entity: 'rule', id: person === one ? journeyItem : keptRule, to: 'updated' });
    const reply = await request('GET', `/v1/stream?user_id=${person === one ? two.id : one.id}`, { ...bearer(person), 'Last-Event-ID': String(before.at(-1)?.id ?? 0) });
    assert.equal(reply.status, 200); assert.match(reply.headers.get('Content-Type') ?? '', /text\/event-stream/);
    const reader = reply.body!.getReader();
    const timer = setTimeout(() => { void reader.cancel('journey stream deadline'); }, 8_000);
    try {
      const decoder = new TextDecoder();
      let text = '';
      while (!text.includes('\n\n')) {
        const chunk = await reader.read();
        assert.ok(!chunk.done && chunk.value, 'the persisted frame must replay before the deadline');
        text += decoder.decode(chunk.value, { stream: true });
      }
      c.check(() => { assert.equal(text, `id: ${frame.id}\nevent: state.change\ndata: ${JSON.stringify(frame.data)}\n\n`); noExampleData(frame.data, 'GET /v1/stream'); });
    } finally { clearTimeout(timer); await reader.cancel(); }
  }
  c.finish();
});


test('18. Profile, style, want edits and exports remain private', async t => {
  const c = checks();
  const me = await call(t, 'GET', '/v1/me', bearer(one)); status(me, 200);
  await writeAgain(t, c, 'PATCH', '/v1/me', one, 'journey-profile', { version: me.body.version, tutorial_seen: true }, 200, { version: me.body.version, tutorial_seen: false });
  const otherMe = await call(t, 'GET', '/v1/me', bearer(two));
  c.check(() => { status(otherMe, 200); assert.equal(otherMe.body.tutorial_seen, false); });
  const style = await call(t, 'GET', '/v1/me/style', bearer(one)); status(style, 200);
  c.check(() => { assert.deepEqual(rows(style.body, 'facets'), []); noExampleData(style.body, 'GET /v1/me/style'); });
  const edit = { version: style.body.version, facets: [{ name: 'color', value: 'journey-blue', weight: .37, pinned: true }] };
  await writeAgain(t, c, 'PATCH', '/v1/me/style', one, 'journey-style', edit, 200, { ...edit, facets: [] });
  const otherStyle = await call(t, 'GET', '/v1/me/style', bearer(two));
  c.check(() => { status(otherStyle, 200); assert.deepEqual(rows(otherStyle.body, 'facets'), []); });
  const ownStyle = await call(t, 'GET', '/v1/me/style', bearer(one));
  c.check(() => { status(ownStyle, 200); assert.equal(rows(ownStyle.body, 'facets')[0].value, 'journey-blue'); });
  const want = await call(t, 'GET', `/v1/wants/${wantId}`, bearer(one)); status(want, 200);
  for (const [method, suffix, body] of [['GET', '', undefined], ['GET', '/matches', undefined], ['PATCH', '', { version: want.body.version, text: 'foreign edit' }]] as const) {
    const foreign = await call(t, method, `/v1/wants/${wantId}${suffix}`, bearer(two), body);
    c.check(() => typedError(foreign, 404, 'not_found'));
  }
  const wantEdit = { version: want.body.version, text: 'a journey-specific want' };
  await writeAgain(t, c, 'PATCH', `/v1/wants/${wantId}`, one, 'journey-want-edit', wantEdit, 200, { ...wantEdit, text: 'changed again' });
  const matches = await call(t, 'GET', `/v1/wants/${wantId}/matches`, bearer(one));
  c.check(() => { status(matches, 200); assert.deepEqual(rows(matches.body), []); });
  const lookups: string[] = [];
  for (const person of [one, two]) {
    const created = await call(t, 'POST', '/v1/captures', bearer(person), { mode: 'shots', purpose: 'find', intent: 'find' });
    status(created, 201); lookups.push(string(created.body.id));
  }
  await writeAgain(t, c, 'DELETE', '/v1/lookups', one, 'journey-clear-lookups', {}, 204, { changed: true });
  const ownLookups = await call(t, 'GET', '/v1/lookups', bearer(one));
  c.check(() => { status(ownLookups, 200); assert.deepEqual(rows(ownLookups.body), []); });
  const otherLookups = await call(t, 'GET', '/v1/lookups', bearer(two));
  c.check(() => { status(otherLookups, 200); assert.deepEqual(rows(otherLookups.body).map(row => row.capture_id), [lookups[1]]); });
  status(await call(t, 'DELETE', '/v1/lookups', bearer(two)), 204);
  const extraSession = await signIn(t, emails[1]);
  // Signout is auth:none. Omit bearer on retries so revocation cannot change the key's caller scope.
  const signoutHeaders = { 'Idempotency-Key': 'journey-signout' };
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await call(t, 'POST', '/v1/auth/signout', signoutHeaders, { refresh_token: extraSession.refresh });
    c.check(() => { status(reply, 204); if (attempt) assert.equal(reply.headers.get('Idempotent-Replayed'), 'true'); });
  }
  const changedSignout = await call(t, 'POST', '/v1/auth/signout', signoutHeaders, { refresh_token: 'journey-missing' });
  c.check(() => typedError(changedSignout, 409, 'idempotency_mismatch'));
  const revoked = await call(t, 'GET', '/v1/me', bearer(extraSession));
  c.check(() => typedError(revoked, 401, 'unauthenticated'));
  const originalSession = await call(t, 'GET', '/v1/me', bearer(two));
  c.check(() => { status(originalSession, 200); assert.equal(originalSession.body.id, two.id); });
  const exported = await writeAgain(t, c, 'POST', '/v1/me/export', one, 'journey-export', {}, 202, { changed: true });
  const foreignJob = await call(t, 'GET', `/v1/jobs/${string(exported.body.id)}`, bearer(two));
  c.check(() => typedError(foreignJob, 404, 'not_found'));
  c.finish();
});

test('19. Every remaining manifest route rejects foreign resources or reports its missing service', { todo: 'other leads still serve example data or the wrong refusal: market (products, history, trends, index, follows), buy (compare, out), accounts (POST copies the example connection), genie (404 before unavailable), items and captures (sell, listings, talk); packet 86' }, async t => {
  const c = checks();
  // These existing steps execute later, after all writes that deletion must remove.
  const later = new Set(['POST /v1/auth/refresh', 'DELETE /v1/me']);
  const unavailableRoutes = new Set(['POST /v1/accounts', 'POST /v1/follows', 'POST /v1/genie', 'POST /v1/compare', 'GET /v1/out']);
  const remaining = routeManifest.filter(row => !walked.has(row.endpoint) && !later.has(row.endpoint));
  t.diagnostic('Additional routes: ' + remaining.map(row => row.endpoint).join(', '));
  for (const entry of remaining) {
    const [method, pattern] = entry.endpoint.split(' ');
    const e = contractExamples.find(e => e.endpoint === entry.endpoint && e.status < 400);
    // Connection and raw-upload routes have no spec example; their real paths come from the manifest.
    const path = e?.path ?? pattern.replace(/:[a-z_]+/g, 'journey_missing');
    for (const person of [one, two]) {
      const auth = pattern.startsWith('/v1/auth/');
      const body = method === 'GET' || method === 'DELETE' ? undefined
        : auth ? {} : e?.request?.body ?? (pattern === '/v1/connections' ? { site: 'ebay' } : {});
      const reply = await call(t, method, path, { ...bearer(person), 'Idempotency-Key': 'journey-probe-' + entry.endpoint }, body);
      c.check(() => {
        if (auth) typedError(reply, 400, 'invalid'); // no provider proof: validation must precede outside calls
        else if (pattern.startsWith('/v1/connections') && method !== 'GET') typedError(reply, 503, 'unavailable');
        else if (entry.source === 'example' || unavailableRoutes.has(entry.endpoint)) unavailable(reply);
        else if (pattern === '/v1/routes') { status(reply, 200); assert.deepEqual(rows(reply.body), routeManifest); }
        else if (pattern === '/v1/connections') {
          status(reply, 200); assert.ok(rows(reply.body, 'services').every(row => row.account === undefined && row.available === false));
        } else if (pattern === '/v1/sources/health') {
          status(reply, 200); assert.ok(Array.isArray(reply.body.routes)); assert.ok(Array.isArray(reply.body.reads));
        } else if (pattern.includes(':') || pattern === '/v1/valuations') typedError(reply, 404, 'not_found');
        else assert.fail('Add a behavior assertion for ' + entry.endpoint);
        if (pattern !== '/v1/routes') noExampleData(reply.body, entry.endpoint);
      });
    }
  }
  c.finish();
});

let deletionPaused: unknown = 'step 10 did not run';
test('10. Refresh works, deletion revokes tokens and removes the person’s rows', async t => {
  const c = checks();
  const original = { ...one };
  const refreshed = await call(t, 'POST', '/v1/auth/refresh', {}, { refresh_token: one.refresh }); status(refreshed, 200);
  one = { ...one, access: string(refreshed.body.access_token), refresh: string(refreshed.body.refresh_token) };
  const me = await call(t, 'GET', '/v1/me', bearer(one)); status(me, 200); assert.equal(me.body.id, original.id);
  const deleted = await call(t, 'DELETE', '/v1/me', bearer(one)); status(deleted, 202);
  c.check(() => { string(deleted.body.id); assert.equal(deleted.body.kind, 'delete_user'); });
  for (const person of [original, one]) {
    const refused = await call(t, 'GET', '/v1/me', bearer(person));
    c.check(() => typedError(refused, 401, 'unauthenticated'));
  }
  const refreshRefused = await call(t, 'POST', '/v1/auth/refresh', {}, { refresh_token: one.refresh });
  c.check(() => typedError(refreshRefused, 401, 'unauthenticated'));
  // Reauthenticate through the real route: revoked tokens alone cannot prove rows were deleted.
  const returned = await signIn(t, emails[0]);
  const deletionJob = await call(t, 'GET', `/v1/jobs/${string(deleted.body.id)}`, bearer(returned));
  c.check(() => status(deletionJob, 200)); deletionPaused = deletionJob.body.paused;
  for (const route of ['wants', 'lookups', 'items']) {
    const response = await call(t, 'GET', `/v1/${route}`, bearer(returned));
    c.check(() => { status(response, 200); assert.deepEqual(rows(response.body), []); });
  }
  const capture = await call(t, 'GET', `/v1/captures/${captureId}`, bearer(returned));
  c.check(() => typedError(capture, 404, 'not_found'));
  const want = await call(t, 'GET', `/v1/wants/${wantId}`, bearer(returned));
  c.check(() => typedError(want, 404, 'not_found'));
  const job = await call(t, 'GET', `/v1/jobs/${personJob}`, bearer(returned));
  c.check(() => typedError(job, 404, 'not_found'));
  c.finish();
});

test('10b. Account deletion finishes its workspace purge', { todo: 'no workspace port is configured on a local server, so the purge job pauses' }, () => {
  assert.equal(deletionPaused, undefined, 'deletion must have a configured path to finish');
});

test('11. Restart on the same folder preserves person two and the visitor’s search', async t => {
  const c = checks();
  if (socketRefusal) {
    t.todo('Sandbox refuses port 0; handler rediscovery cannot prove server restart');
    t.diagnostic(`HTTP restart unavailable (${socketRefusal}); rediscovering the real route table on the same folder`);
  }
  await server?.close(); server = undefined;
  await boot();
  c.check(() => assert.ok(server, 'restart requires a real server to close and start again'));
  const me = await call(t, 'GET', '/v1/me', bearer(two)); status(me, 200); assert.equal(me.body.id, two.id);
  const persistedRules = await call(t, 'GET', '/v1/rules', bearer(two));
  c.check(() => { status(persistedRules, 200); assert.deepEqual(rows(persistedRules.body).map(row => row.id), [keptRule]); });
  const job = await call(t, 'GET', `/v1/jobs/${visitorJob}`, visiting(visitor));
  status(job, 200); assert.equal(job.body.id, visitorJob); assert.equal(job.body.state, 'done');
  typedError(await call(t, 'GET', `/v1/jobs/${visitorJob}`, visiting(otherVisitor)), 404, 'not_found');
  c.finish();
});

test('20. The walk has touched every method and path in the manifest', () => {
  assert.deepEqual(routeManifest.filter(row => !walked.has(row.endpoint)).map(row => row.endpoint), []);
});
