// Rests-on: spec/examples/{auth,buy,captures,jobs,me,routes}.json; server/proof.test.ts.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
const savedEnv = new Map(['NODE_ENV', 'SECONDHAND_DATA_DIR', 'SECONDHAND_DEV_CODE', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY'].map(name => [name, process.env[name]]));
// No model key in this walk: the chat must refuse cleanly, and no outside call may be attempted.
delete process.env.OPENROUTER_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const realFetch = globalThis.fetch;
let folder: string;
let start: typeof import('./main.ts').start;
let server: Awaited<ReturnType<typeof start>> | undefined;
let routes: typeof import('./routes.ts');
let table: Awaited<ReturnType<typeof routes.discover>>;
let socketRefusal = '';
let search: typeof import('../app/src/edge/api/search.ts');
let originalPorts: typeof search.ports;
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
async function request(method: string, path: string, headers: Record<string, string> = {}, body?: unknown): Promise<Response> {
  const req = new Request((server?.url ?? 'http://journey.test') + path, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
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
  ({ example } = await import('../app/src/edge/api/examples.ts'));
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
  assert.deepEqual(rows(own.body).map(row => row.capture_id), [captureId]);
  const other = await call(t, 'GET', '/v1/lookups', bearer(two)); status(other, 200); assert.deepEqual(rows(other.body), []);
  typedError(await call(t, 'DELETE', `/v1/lookups/${captureId}`, bearer(two)), 404, 'not_found');
  const removed = await call(t, 'DELETE', `/v1/lookups/${captureId}`, bearer(one)); status(removed, 204); assert.equal(removed.text, '');
  const hidden = await call(t, 'GET', '/v1/lookups', bearer(one)); status(hidden, 200); assert.deepEqual(rows(hidden.body), []);
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
  const job = await call(t, 'GET', `/v1/jobs/${visitorJob}`, visiting(visitor));
  status(job, 200); assert.equal(job.body.id, visitorJob); assert.equal(job.body.state, 'done');
  typedError(await call(t, 'GET', `/v1/jobs/${visitorJob}`, visiting(otherVisitor)), 404, 'not_found');
  c.finish();
});
