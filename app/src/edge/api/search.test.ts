import { object } from './captures.ts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import { handlers, manifest, ports, searchJobs } from './search.ts';
import { readFileSync } from 'node:fs';
import { jobs, getJob, jobEvents } from './jobs.ts';
import { SITES, type Site } from '../harness/protocol.ts';
import { searchAll } from '../intel/public/search.ts';
import { SOURCES } from '../intel/public/sources.ts';
import { BASE } from '../intel/public/readers.ts';
import { _reset } from '../intel/run.ts';
import type { PageResult } from '../intel/fetch.ts';
import type { Found } from '../intel/answer.ts';
import { memoryVault, memoryAccounts } from '../browser/auth.ts';
import { createHarness } from '../harness/protocol.ts';
import { mercariAdapters, type Page as MercariPage } from '../harness/sites/mercari/adapter.ts';

const originalPorts = { ...ports };
const vault = memoryVault();
const accountRows = [{ account_id: 'acc_search', person_id: 'usr_8f2k', site: 'mercari' as const, token_ref: 'test-search' }];
const accounts = memoryAccounts(accountRows, vault);
const created: string[] = [];
const fixture = (site: Site) => readFileSync(new URL(`../../../../spec/fixtures/pages/${site}.html`, import.meta.url), 'utf8');
const page = (html: string): PageResult => ({ ok: true, html, final_url: '', status: 200, rung: 'plain', ms: 1, searched: [] });
const blocked = (): PageResult => ({ ok: false, kind: 'blocked', reason: '403', status: 403, ms: 1, searched: [] });
const siteOf = (url: string) => SITES.find(s => url.startsWith(BASE[s]))!;
const bounded = async <T>(p: Promise<T>, ms = 1500): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([p, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('search did not make progress')), ms); })]); }
  finally { clearTimeout(timer!); }
};
const ended = (id: string) => bounded(new Promise<void>(resolve => {
  const check = () => { if (['done', 'failed'].includes(jobs.st.getJob(id)!.state)) { off(); resolve(); } };
  const off = jobs.listen(id, check); check();
}));
const poll = (id: string, visitor = 'vis_search01', events = false, after = 0) => route(
  events ? 'GET /v1/jobs/:id/events' : 'GET /v1/jobs/:id', events ? jobEvents() : getJob(), { auth: 'visitor' },
)(new Request(`http://edge.test/v1/jobs/${id}${events ? '/events' : ''}`, { headers: { 'X-Visitor-Id': visitor, 'Last-Event-ID': String(after) } }));


const prefixes = ["search"];
const examples = EXAMPLES.filter(e => prefixes.includes(e.endpoint.split(' ')[1].split('/')[2]));
beforeEach(() => {
  deps.verify = async token => token === 'good' ? 'usr_8f2k' : token === 'other' ? 'usr_other' : null;
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.idem.clear(); deps.visits.clear(); deps.now = () => Date.now();
  _reset();
  Object.assign(ports, { ...originalPorts, deadline_ms: 80, fetchPage: async () => blocked(),
    ask: async (_state: object, questions: Record<string, unknown>) => ({ ok: true, ms: 0,
      answers: Object.fromEntries(Object.keys(questions).map(k => [k, { choice: k.startsWith('m') ? 'likely_same_model' : 'keep' }])) }),
  });
});
afterEach(async () => { await Promise.all(created.splice(0).map(ended)); await Promise.all(searchJobs.pendingSearches.values()); Object.assign(ports, originalPorts); });
const call = (e: Example, options: { body?: unknown; raw?: string; path?: string; token?: string | null; headers?: Record<string, string> } = {}) => {
  const token = options.token === undefined ? (e.auth === 'visitor' ? null : 'good') : options.token;
  const entry = manifest.find(m => m.endpoint === e.endpoint)!;
  return route(e.endpoint, handlers[e.endpoint], { auth: entry.auth })(new Request('http://edge.test' + (options.path ?? e.path), {
    method: e.endpoint.split(' ')[0],
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...e.request?.headers, ...options.headers },
    body: options.raw ?? (options.body !== undefined ? JSON.stringify(options.body) : e.request?.body === undefined ? undefined : JSON.stringify(e.request.body)),
  }));
};
test('search: every specified endpoint is registered and declares its answer source', () => {
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
  else {
    const body = await r.json(); created.push(body.id);
    const expected = e.response as { id: string; stages: { started_at: string }[]; stream: string };
    assert.deepEqual({ ...body, id: expected.id, stream: expected.stream,
      stages: body.stages.map((s: Record<string, unknown>) => ({ ...s, started_at: expected.stages[0].started_at })) }, expected);
  }
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
test('search: limit over 100 is refused', async () => {
  const e = examples.find(e => e.status < 400)!;
  const r = await call(e, { path: e.path + (e.path.includes('?') ? '&' : '?') + 'limit=101' });
  assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
});

test('search: malformed field values name the validation failure', async () => {
  const cases: [string, unknown][] = [["search.text",{"text":"jacket","filters":{"in_stock_only":"yes"}}]];
  for (const [name, body] of cases) {
    const e = examples.find(e => e.name === name)!;
    const r = await call(e, { body }); assert.equal(r.status, 400, name);
    const error = await r.json(); assert.equal(error.code, 'invalid'); assert.equal(error.failed_step, 'validate');
  }
});

test('search: a visitor is rate limited with retry by auto', async () => {
  const e = examples.find(e => e.name === 'search.text')!;
  for (let i = 0; i < deps.visitorPerMinute; i++) assert.equal((await call(e, { headers: { 'X-Visitor-Id': 'vis_limit001', 'Idempotency-Key': 'limit_' + i } })).status, 202);
  const r = await call(e, { headers: { 'X-Visitor-Id': 'vis_limit001' } });
  assert.equal(r.status, 429); const error = await r.json(); assert.equal(error.code, 'rate_limited'); assert.equal(error.retry.by, 'auto'); assert.ok(error.retry.after_s > 0);
});

test('search: owned Expo files bind auth and export the contract method', async () => {
  const { readFileSync } = await import('node:fs');
  for (const entry of manifest) {
    const [method, pattern] = entry.endpoint.split(' '), parts = pattern.split('/').slice(2);
    if (parts[0] !== 'search') continue;
    const relative = parts.map(p => p.startsWith(':') ? '[' + p.slice(1) + ']' : p).join('/') + (parts.length === 1 || parts.at(-1)!.startsWith(':') ? '/index+api.ts' : '+api.ts');
    const source = readFileSync(new URL('../../app/v1/' + relative, import.meta.url), 'utf8');
    assert.ok(source.includes("import '@/edge/auth'"), relative);
    assert.ok(source.includes("export const " + method + " = route('" + entry.endpoint + "'"), relative);
    if (entry.auth === 'visitor') assert.ok(source.includes("auth: 'visitor'"), relative);
  }
});

test('search stores the public engine rows on the job, without a network dependency', async () => {
  const { jobs } = await import('./jobs.ts');
  const response = await call(examples.find(e => e.name === 'search.text')!);
  const body = await response.json();
  await ended(body.id);
  const result = jobs.st.getJob(body.id)?.result;
  assert.ok(object(result) && Array.isArray(result.results), 'searchAll must populate the job result');
});

test('new searches have distinct jobs within and across visitor sessions', async () => {
  const { jobs } = await import('./jobs.ts');
  const e = examples.find(e => e.name === 'search.text')!;
  const first = await (await call(e, { headers: { 'X-Visitor-Id': 'vis_first01', 'Idempotency-Key': 'first-search' } })).json();
  await ended(first.id);
  const saved = structuredClone(jobs.get(first.id, 'vis_first01')?.result);
  const second = await (await call(e, { body: { text: 'another jacket' }, headers: { 'X-Visitor-Id': 'vis_second01', 'Idempotency-Key': 'second-search' } })).json();
  const third = await (await call(e, { body: { text: 'different jacket' }, headers: { 'X-Visitor-Id': 'vis_first01', 'Idempotency-Key': 'third-search' } })).json();
  assert.notEqual(first.id, second.id); assert.notEqual(first.id, third.id);
  assert.ok(jobs.get(second.id, 'vis_second01'));
  assert.equal(jobs.get(second.id, 'vis_first01'), undefined);
  assert.deepEqual(jobs.get(first.id, 'vis_first01')?.result, saved);
});

const start = async (body: Record<string, unknown> = { text: 'levi 501' }, visitor = 'vis_search01') => {
  const response = await bounded(call(examples.find(e => e.name === 'search.text')!, {
    body, headers: { 'X-Visitor-Id': visitor, 'Idempotency-Key': crypto.randomUUID() },
  }), 100);
  assert.equal(response.status, 202);
  const job = await response.json(); created.push(job.id); return job;
};

test('202 is returned before any page answers, including a page that never resolves', async () => {
  const started = new Set<Site>();
  ports.fetchPage = async u => { started.add(siteOf(u)); return new Promise(() => {}); };
  const job = await start();
  assert.equal(job.state, 'running');
  assert.deepEqual(job.stages.map((s: { name: string }) => s.name), SOURCES.filter(s => s.on).map(s => `site:${s.id}`));
  assert.ok(job.stages.every((s: { state: string; found: Found }) => s.state === 'running' && s.found.results_found === 0));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([...started].sort(), ['depop', 'facebook', 'poshmark'], 'public sources start together; Mercari requires the linked harness');
  assert.equal(jobs.st.getJob(job.id)?.state, 'running');
});

test('site batches reach polling and a live SSE reader in landing order, with exact found counts', async () => {
  const release = new Map<Site, (p: PageResult) => void>();
  ports.fetchPage = async u => new Promise(resolve => release.set(siteOf(u), resolve));
  const job = await start();
  const res = await poll(job.id, 'vis_search01', true);
  const reader = res.body!.getReader();
  let early = '';
  while (!early.includes('event: answer.partial')) early += new TextDecoder().decode((await bounded(reader.read())).value); // unlinked Mercari settles first
  for (const site of ['depop', 'poshmark'] as const) {
    release.get(site)!(page(fixture(site)));
    const frames = [];
    while (frames.length < 2) {
      const chunk = await bounded(reader.read());
      assert.equal(chunk.done, false);
      frames.push(...new TextDecoder().decode(chunk.value).trim().split('\n\n'));
    }
    assert.match(frames[0], /event: job.stage/);
    assert.match(frames[1], /event: answer.partial/);
    const stored = await (await poll(job.id)).json();
    const stage = stored.stages.find((s: { name: string }) => s.name === `site:${site}`);
    const partial = jobs.framesAfter(job.id, 0).filter(f => f.event === 'answer.partial').at(-1)!;
    assert.equal(partial.data.site, site);
    assert.equal(stage.state, 'arrived');
    assert.deepEqual(stage.found, { sources_searched: 1, results_found: 12,
      results_used: 12, dropped_by_reason: {}, sites: { [site]: 12 } });
    assert.equal((partial.data.results as unknown[]).length, stage.found.results_used);
    assert.equal(stored.state, 'running');
  }
  await reader.cancel();
  release.get('facebook')!(blocked());
  await ended(job.id);
  const result = (await (await poll(job.id)).json()).result;
  assert.equal(result.results.length, 24);
  assert.equal(result.found.results_used, 24);
  assert.equal(result.found.sources_searched, SOURCES.filter(s => s.on).length);
  const totals = result.results.map((r: { delivered_cents: { amount_cents: number } }) => r.delivered_cents.amount_cents);
  assert.deepEqual(totals, [...totals].sort((a, b) => a - b));
});

test('a late site is recorded and a done job cannot be changed by its eventual page', async () => {
  let release!: (p: PageResult) => void;
  ports.fetchPage = async u => siteOf(u) === 'poshmark' ? new Promise(resolve => { release = resolve; }) : blocked();
  const job = await start(); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.state, 'done');
  assert.equal(saved.stages.find((s: { name: string }) => s.name === 'site:poshmark').state, 'late');
  assert.equal(saved.result.searched.find((s: { site: string }) => s.site === 'poshmark').outcome, 'timeout');
  const count = jobs.framesAfter(job.id, 0).length;
  release(page(fixture('poshmark')));
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(await (await poll(job.id)).json(), saved);
  assert.equal(jobs.framesAfter(job.id, 0).length, count);
});

test('403 and a login wall are blocked with zero rows, and are streamed before a slow site ends', async () => {
  ports.fetchPage = async u => siteOf(u) === 'poshmark' ? new Promise(() => {}) : siteOf(u) === 'facebook' ? page('<form action="/login">Log in</form>') : blocked();
  const job = await start();
  await new Promise(resolve => setTimeout(resolve, 10));
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.state, 'running');
  for (const site of ['facebook', 'depop']) {
    const searched = saved.result.searched.find((s: { site: string }) => s.site === site);
    assert.equal(searched.outcome, 'blocked'); assert.equal(searched.count, 0);
    const stage = saved.stages.find((s: { name: string }) => s.name === `site:${site}`);
    assert.equal(stage.found.results_found, 0);
  }
});

test('a different visitor cannot poll or stream a new job; SSE resumes strictly after Last-Event-ID', async () => {
  const job = await start(); await ended(job.id);
  for (const events of [false, true]) assert.equal((await poll(job.id, 'vis_other001', events)).status, 404);
  const frames = jobs.framesAfter(job.id, 2);
  const stream = await bounded((await poll(job.id, 'vis_search01', true, 2)).text());
  assert.deepEqual([...stream.matchAll(/^id: (\d+)$/gm)].map(m => Number(m[1])), frames.map(f => f.id));
  assert.equal(await (await poll(job.id, 'vis_search01', true, frames.at(-1)!.id)).text(), '');
});

test('sameProduct receives the query, a look-alike is not same_product, and drops balance counts', async () => {
  ports.fetchPage = async u => siteOf(u) === 'poshmark' ? page(fixture('poshmark')) : blocked();
  ports.ask = async (state, questions) => {
    assert.equal((state as { target: string }).target, 'levi 501');
    return { ok: true, ms: 0, answers: Object.fromEntries(Object.keys(questions).map(k => [k, {
      choice: k.startsWith('m') ? (k === 'm0' ? 'comparable' : 'likely_same_model') : k === 'k1' ? 'wrong_item' : 'keep',
    }])) };
  };
  const job = await start({ text: 'levi 501', filters: { max_delivered_cents: { amount_cents: 4000, currency: 'USD' } } });
  await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.result.results.find((r: { external_id: string }) => r.external_id === '6af924447625b11bb42ec837').relation, 'functional_equivalent');
  assert.equal(saved.result.found.results_found, 12);
  assert.equal(saved.result.found.results_used, 8);
  assert.deepEqual(saved.result.found.dropped_by_reason, { wrong_item: 1, max_delivered_cents: 3 });
});

test('background reconciliation failure ends the job as failed with the contract error', async () => {
  ports.fetchPage = async u => siteOf(u) === 'poshmark' ? page(fixture('poshmark')) : blocked();
  ports.ask = async () => { throw new Error('judge unavailable'); };
  const job = await start(); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.state, 'failed');
  assert.equal(saved.error.code, 'site_failed');
  assert.equal(saved.error.failed_step, 'search');
  assert.equal(saved.error.retry.by, 'user');
  assert.equal(jobs.framesAfter(job.id, 0).at(-1)!.data.state, 'failed');
});

test('a fresh repeat streams the standing result before its live delta; filters are not cached', async () => {
  let reads = 0, release!: (p: PageResult) => void;
  ports.fetchPage = async u => {
    if (siteOf(u) !== 'poshmark') return blocked();
    if (++reads === 1) return page(fixture('poshmark'));
    return new Promise(resolve => { release = resolve; });
  };
  const first = await start(); await ended(first.id);
  const second = await start({ text: 'LEVI  501', filters: { max_delivered_cents: { amount_cents: 3000, currency: 'USD' } } });
  await new Promise(resolve => setTimeout(resolve, 10));
  const warm = await (await poll(second.id)).json();
  assert.equal(warm.state, 'running');
  assert.equal(warm.result.results.length, 7);
  assert.equal(reads, 2);
  release(page('No results'));
  await ended(second.id);
  const done = await (await poll(second.id)).json();
  assert.equal(done.result.results.length, 0, 'live empty batch must remove the cached rows');
  assert.deepEqual(jobs.framesAfter(second.id, 0).filter(f => f.event === 'answer.partial' && f.data.site === 'poshmark').map(f => (f.data.results as unknown[]).length), [7, 0]);
});

test('concurrent warm repeats both receive the shared live delta after their cached batch', async () => {
  let reads = 0, release!: (p: PageResult) => void;
  ports.fetchPage = async u => {
    if (siteOf(u) !== 'poshmark') return blocked();
    if (++reads === 1) return page(fixture('poshmark'));
    return new Promise(resolve => { release = resolve; });
  };
  const first = await start(); await ended(first.id);
  const a = await start();
  await new Promise(resolve => setImmediate(resolve));
  const b = await start();
  await new Promise(resolve => setImmediate(resolve));
  for (const job of [a, b]) {
    assert.equal(jobs.st.getJob(job.id)?.state, 'running', 'each repeat must wait for the shared live delta');
    assert.equal((await (await poll(job.id)).json()).result.results.length, 12);
  }
  release(page('No results'));
  await Promise.all([ended(a.id), ended(b.id)]);
  assert.equal(reads, 2, 'the repeats must share one live fetch');
  for (const job of [a, b]) assert.equal((await (await poll(job.id)).json()).result.results.length, 0);
});

test('a shared reconciliation error fails every joining job and cleans held promises', async () => {
  let release!: (p: PageResult) => void, reads = 0;
  ports.fetchPage = async u => {
    if (siteOf(u) !== 'poshmark') return blocked();
    reads++; return new Promise(resolve => { release = resolve; });
  };
  ports.ask = async () => { throw new Error('shared judge failure'); };
  const a = await start(), b = await start();
  release(page(fixture('poshmark')));
  await Promise.all([ended(a.id), ended(b.id)]);
  assert.equal(reads, 1);
  for (const job of [a, b]) {
    const saved = await (await poll(job.id)).json();
    assert.equal(saved.state, 'failed'); assert.equal(saved.error.code, 'site_failed');
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(searchJobs.pendingSearches.has(a.id), false);
  assert.equal(searchJobs.pendingSearches.has(b.id), false);
});

test('a timed-out live refresh keeps fresh indexed offers and records the site as late', async () => {
  let reads = 0;
  ports.fetchPage = async u => siteOf(u) !== 'poshmark' ? blocked() : ++reads === 1 ? page(fixture('poshmark')) : new Promise(() => {});
  const first = await start(); await ended(first.id);
  const second = await start(); await ended(second.id);
  const saved = await (await poll(second.id)).json();
  assert.equal(saved.state, 'done');
  assert.equal(saved.stages.find((s: { name: string }) => s.name === 'site:poshmark').state, 'late');
  assert.equal(saved.result.results.length, 12);
  assert.equal(saved.result.found.results_used, 12);
  assert.equal(saved.result.searched.find((s: { site: string }) => s.site === 'poshmark').cached, true);
});

test('the fixture-only visitor id cannot create a job that the example ownership exception would expose', async () => {
  const e = examples.find(e => e.name === 'search.text')!;
  const before = jobs.st.jobs({ kind: 'search' }).length;
  const response = await call(e, { headers: { 'X-Visitor-Id': 'vis_example01' } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'invalid');
  assert.equal(jobs.st.jobs({ kind: 'search' }).length, before);
});

test('search logs successful and late site transitions through the existing log contract', async () => {
  const { checkLog } = await import('../../../../spec/log.mjs');
  const sink = memorySink(); deps.log = createLog({ src: 'test', build: 'test', sink });
  ports.fetchPage = async u => siteOf(u) === 'poshmark' ? new Promise(() => {}) : blocked();
  const reply = await handlers['POST /v1/search']({ user_id: null, visitor_id: 'vis_search01', request_id: 'test',
    params: {}, query: new URLSearchParams(), body: { text: 'levi 501' }, headers: new Headers(), log: deps.log,
  }, new Request('http://edge.test/v1/search'));
  assert.ok(!(reply instanceof Response) && object(reply.body) && typeof reply.body.id === 'string');
  const id = reply.body.id; created.push(id); await ended(id);
  deps.log.end();
  assert.deepEqual(checkLog(sink.text()).problems, []);
});


test('source rows control targets: eBay stays off and a planted source runs without runner changes', async () => {
  assert.deepEqual(SOURCES.map(({ id, on, needs_ask, reason }) => ({ id, on, needs_ask, reason })), [
    { id: 'depop', on: true, needs_ask: false, reason: undefined },
    { id: 'poshmark', on: true, needs_ask: false, reason: undefined },
    { id: 'mercari', on: true, needs_ask: true, reason: undefined },
    { id: 'facebook', on: true, needs_ask: false, reason: undefined },
    { id: 'ebay', on: false, needs_ask: false, reason: 'page lane not built' },
  ]);
  const planted = { id: 'planted', site: 'offerup', lane: 'public_page', covers: ['offerup'], needs_ask: false, on: true } as const;
  const fetched: Site[] = [];
  SOURCES.push(planted);
  try {
    ports.fetchPage = async u => { fetched.push(siteOf(u)); return page('No results'); };
    const job = await start(); await ended(job.id);
    assert.ok(job.stages.some((s: { name: string }) => s.name === 'site:planted'));
    assert.ok(fetched.includes('offerup'), 'the added row must reach the real fetch port');
    assert.ok(!fetched.includes('ebay'), 'disabled eBay must never reach its old page reader or stub');
    assert.equal(jobs.framesAfter(job.id, 0).filter(f => f.event === 'answer.partial').length, SOURCES.filter(s => s.on).length);
  } finally { SOURCES.pop(); }
});

test('background and omitted callers never fetch Mercari even when explicitly selected', async () => {
  for (const caller of ['background', undefined] as const) {
    const fetched: string[] = [];
    const result = await searchAll('levi 501', { caller, sites: ['mercari', 'depop'],
      fetchPage: async u => { fetched.push(u); return page('No results'); } });
    assert.equal(fetched.filter(u => u.includes('mercari')).length, 0, 'a want or background run must make zero Mercari fetches');
    assert.deepEqual(result.searched.map(s => s.site), ['depop']);
  }
});

test('fetched rows carry live provenance through partials, polling and cached refreshes', async () => {
  ports.fetchPage = async u => siteOf(u) === 'poshmark' ? page(fixture('poshmark')) : blocked();
  const first = await start(); await ended(first.id);
  const second = await start(); await ended(second.id);
  for (const job of [first, second]) {
    const stored = await (await poll(job.id)).json();
    assert.ok(stored.result.results.length > 0);
    assert.ok(stored.result.results.every((r: { data: string }) => r.data === 'live:poshmark'));
    for (const frame of jobs.framesAfter(job.id, 0).filter(f => f.event === 'answer.partial')) {
      assert.ok((frame.data.results as { data: string }[]).every(r => r.data === 'live:poshmark'));
    }
  }
});

test('rows served from spec examples carry example provenance', async () => {
  const frames = jobs.framesAfter('job_sr1', 0);
  assert.ok(frames.length > 0);
  for (const frame of frames) {
    const results = frame.data.results ?? (object(frame.data.result) ? frame.data.result.results : undefined);
    if (Array.isArray(results)) for (const row of results) assert.equal(row.data, 'example');
  }
});


test('Mercari runs only through the person’s linked harness, never an anonymous page fetch', async () => {
  await vault.put('test-search', { cookies: [], origins: [] });
  const recording = JSON.parse(readFileSync(new URL('../harness/sites/mercari/fixtures/search.json', import.meta.url), 'utf8')) as MercariPage;
  let reads = 0;
  const harness = createHarness({ accounts, adapters: mercariAdapters({ signed_in: true, page: async () => { reads++; return recording; } }) });
  const fetchPage = async (): Promise<PageResult> => { throw new Error('Mercari must not use the anonymous page reader'); };
  for (const caller of ['background', undefined] as const) {
    const result = await searchAll('carhartt hoodie', { caller, sites: ['mercari'], person_id: 'usr_8f2k', accounts, harness, fetchPage });
    assert.deepEqual(result.searched, []); assert.equal(reads, 0);
  }
  const denied = await searchAll('carhartt hoodie', { caller: 'person', sites: ['mercari'], person_id: 'usr_other', accounts, harness, fetchPage });
  assert.equal(denied.searched[0].outcome, 'blocked'); assert.equal(reads, 0);
  const allowed = await searchAll('carhartt hoodie', { caller: 'person', sites: ['mercari'], person_id: 'usr_8f2k', accounts, harness, fetchPage });
  assert.equal(reads, 1); assert.ok(allowed.results.length > 0); assert.equal(allowed.searched[0].outcome, 'hit');
  ports.accounts = accounts; ports.harness = harness;
  const response = await call(examples.find(e => e.name === 'search.text')!, { token: 'good', body: { text: 'carhartt hoodie' } });
  const job = await response.json(); created.push(job.id); await ended(job.id);
  const stored = jobs.get(job.id, 'usr_8f2k')!;
  assert.ok(object(stored.result) && Array.isArray(stored.result.results));
  assert.ok(stored.result.results.length > 0);
  assert.ok(stored.result.results.every((r: { data: string }) => r.data === 'live:mercari'));
  assert.equal(reads, 2, 'POST /v1/search is the person’s ask');
});


test('a harness card missing its title is page_changed, never a kept offer', async () => {
  await vault.put('test-search', { cookies: [], origins: [] });
  const recording = JSON.parse(readFileSync(new URL('../harness/sites/mercari/fixtures/search.json', import.meta.url), 'utf8')) as MercariPage;
  for (const response of recording.api) {
    const body = response.body as { data: { search: { itemsList: Record<string, unknown>[] } } };
    for (const item of body.data.search.itemsList) delete item.name;
  }
  ports.accounts = accounts;
  ports.harness = createHarness({ accounts, adapters: mercariAdapters({ signed_in: true, page: async () => recording }) });
  const response = await call(examples.find(e => e.name === 'search.text')!, { token: 'good', body: { text: 'no title' } });
  const job = await response.json(); created.push(job.id); await ended(job.id);
  const stored = jobs.get(job.id, 'usr_8f2k')!.result as { results: unknown[]; searched: { site: Site; outcome: string }[] };
  assert.deepEqual(stored.results, []);
  assert.equal(stored.searched.find(s => s.site === 'mercari')!.outcome, 'page_changed');
});
