import { object } from './captures.ts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import { handlers, manifest, ports, searchJobs } from './search.ts';
import { readFileSync } from 'node:fs';
import { jobs, getJob, jobEvents, memoryJobs, seedExamples } from './jobs.ts';
import { SITES, type Site } from '../harness/protocol.ts';
import { searchAll } from '../intel/public/search.ts';
import { SOURCES as LIVE_SOURCES } from '../intel/public/sources.ts';
const SOURCES = LIVE_SOURCES.map(source => ({ ...source, pace: { per_minute: 1e12, min_gap_ms: 0 } }));
import { BASE, readPage } from '../intel/public/readers.ts';
import { _reset, outsideCallCount, searchParams } from '../intel/run.ts';
import { createDupe } from '../harness/sites/dupe/adapter.ts';
import type { PageResult } from '../intel/fetch.ts';
import type { Found } from '../intel/answer.ts';
import { memoryVault, memoryAccounts } from '../browser/auth.ts';
import { createHarness, fakeManifest, fail } from '../harness/protocol.ts';
import { mercariAdapters, type Page as MercariPage } from '../harness/sites/mercari/adapter.ts';

let depopRead: () => Promise<PageResult>;
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
  searchParams.declare({ name: 'search_browser_start_ms', family: 'scalar', prior: 0 });
  depopRead = async () => blocked();
  const harness = createHarness({ adapters: [{ route_id: 'depop.search.page', manifest: fakeManifest('depop', 'search'),
    async run() {
      const p = await depopRead();
      if (!p.ok) return fail('blocked', p.reason, { do: 'pause_session', site: 'depop' });
      const r = readPage('depop', p.html);
      if (!r.ok) return r;
      return { ok: true, data: r.data.map(row => ({ ...row, external_id: row.id, state: 'active' })) };
    },
  }] });
  Object.assign(ports, { ...originalPorts, sources: SOURCES, harness, dupe: { search: async () => ({ ok: true, data: { rows: [], dropped: 0, total: 0, keep_until: new Date().toISOString() } }) }, deadline_ms: 80, fetchPage: async () => blocked(),
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
      stages: body.stages.map((s: Record<string, unknown>) => ({ ...s, started_at: expected.stages[0].started_at })) }, { ...expected, stages: [...expected.stages, { ...expected.stages[0], name: 'site:facebook' }, { ...expected.stages[0], name: 'site:ebay' }] });
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
  assert.deepEqual([...started].sort(), ['poshmark'], 'Depop uses its harness and Facebook has no composed Apify port');
  assert.equal(jobs.st.getJob(job.id)?.state, 'running');
});

test('site batches reach polling and a live SSE reader in landing order, with exact found counts', async () => {
  const release = new Map<Site, (p: PageResult) => void>();
  depopRead = () => new Promise(resolve => release.set('depop', resolve));
  ports.fetchPage = async u => new Promise(resolve => release.set(siteOf(u), resolve));
  const job = await start();
  const res = await poll(job.id, 'vis_search01', true);
  const reader = res.body!.getReader();
  let early = '';
  while ((early.match(/event: answer.partial/g) ?? []).length < 4) early += new TextDecoder().decode((await bounded(reader.read())).value); // Dupe, unlinked Mercari, unrouted Facebook and eBay settle first
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
    assert.equal(stored.state, site === 'depop' ? 'running' : 'done');
  }
  await reader.cancel();
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

test('a Depop harness block is a failed site with its code before a slow site ends', async () => {
  ports.fetchPage = async u => siteOf(u) === 'poshmark' ? new Promise(() => {}) : siteOf(u) === 'facebook' ? page('<form action="/login">Log in</form>') : blocked();
  const job = await start();
  await new Promise(resolve => setTimeout(resolve, 10));
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.state, 'running');
  for (const site of ['depop']) {
    const searched = saved.result.searched.find((s: { site: string }) => s.site === site);
    assert.equal(searched.outcome, 'failed'); assert.equal(searched.error_code, 'blocked'); assert.equal(searched.count, 0);
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

test('sameProduct receives the query, labels a look-alike comparable, and drops balance counts', async () => {
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
  assert.equal(saved.result.results.find((r: { external_id: string }) => r.external_id === '6af924447625b11bb42ec837').relation, 'comparable');
  assert.equal(saved.result.found.results_found, 12);
  assert.equal(saved.result.found.results_used, 8);
  assert.deepEqual(saved.result.found.dropped_by_reason, { wrong_item: 1, max_delivered_cents: 3 });
});

test('Jev without a key keeps every landed row unresolved and reports default identity on partials and the result', async () => {
  ports.fetchPage = async u => siteOf(u) === 'poshmark' ? page(fixture('poshmark')) : blocked();
  ports.ask = async () => ({ ok: false, reason: 'no_key', ms: 0 });
  const job = await start(); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.state, 'done');
  assert.equal(saved.result.results.length, 12, 'missing Jev key must not discard the landed rows');
  assert.ok(saved.result.results.every((r: { relation: string }) => r.relation === 'unresolved'));
  assert.equal(saved.result.found.results_used, saved.result.results.length);
  assert.deepEqual(saved.result.found.dropped_by_reason, {});
  assert.deepEqual(saved.result.identity, { by: 'default', model_ok: false });
  const partials = jobs.framesAfter(job.id, 0).filter(f => f.event === 'answer.partial');
  for (const f of partials) assert.deepEqual(f.data.identity, { by: 'default', model_ok: false });
  const landed = partials.find(f => f.data.site === 'poshmark')!;
  assert.deepEqual(landed.data.results, saved.result.results);
  assert.equal((landed.data.answer as { found: Found }).found.results_used, saved.result.found.results_used);
  const totals = saved.result.results.map((r: { delivered_cents: { amount_cents: number } }) => r.delivered_cents.amount_cents);
  assert.deepEqual(totals, [...totals].sort((a, b) => a - b));
});

test('judged match certainty precedes price in partial and merged results, and only keep verdicts exclude identity rows', async () => {
  ports.fetchPage = async u => ['poshmark', 'depop'].includes(siteOf(u)) ? page(fixture(siteOf(u))) : blocked();
  depopRead = async () => page(fixture('depop'));
  const matches: Record<string, string> = { m0: 'unresolved', m1: 'likely_same_model', m11: 'exact', m2: 'same_family_other_variant' };
  ports.ask = async (_state, questions) => ({ ok: true, ms: 0,
    answers: Object.fromEntries(Object.keys(questions).map(k => [k, { choice: k.startsWith('m')
      ? (matches[k] ?? 'unresolved')
      : k === 'k3' ? 'spam' : 'keep' }])) });
  const job = await start(); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.deepEqual(saved.result.identity, { by: 'model', model_ok: true });
  assert.equal(saved.result.found.results_found, 24);
  assert.equal(saved.result.found.results_used, 22);
  assert.deepEqual(saved.result.found.dropped_by_reason, { spam: 2 });
  const rows = saved.result.results as { relation: string; delivered_cents: { amount_cents: number } }[];
  assert.deepEqual(rows.slice(0, 4).map(r => r.relation), ['exact', 'exact', 'likely_same_model', 'likely_same_model']);
  assert.equal(rows.filter(r => r.relation === 'same_family_other_variant').length, 2);
  for (const relation of new Set(rows.map(r => r.relation))) {
    const totals = rows.filter(r => r.relation === relation).map(r => r.delivered_cents.amount_cents);
    assert.deepEqual(totals, [...totals].sort((a, b) => a - b));
  }
  for (const f of jobs.framesAfter(job.id, 0).filter(f => f.event === 'answer.partial' && (f.data.results as unknown[]).length)) {
    assert.deepEqual(f.data.identity, { by: 'model', model_ok: true });
    assert.equal((f.data.results as { relation: string }[])[0].relation, 'exact');
  }
});

test('an invalid model answer reports default identity alongside exact matches, including cached partials', async () => {
  ports.fetchPage = async u => siteOf(u) === 'poshmark' ? page(fixture('poshmark')) : blocked();
  ports.ask = async (_state, questions) => ({ ok: true, ms: 0,
    answers: Object.fromEntries(Object.keys(questions).map(k => [k, { choice: k.startsWith('m')
      ? k === 'm11' ? 'exact' : 'invalid match'
      : 'keep' }])) });
  for (let i = 0; i < 2; i++) {
    const job = await start(); await ended(job.id);
    const saved = await (await poll(job.id)).json();
    assert.equal(saved.result.results.length, 12, 'invalid judgements retain the default keep verdict');
    assert.equal(saved.result.results[0].relation, 'exact', 'the exact row outranks cheaper unresolved rows');
    assert.ok(saved.result.results.slice(1).every((r: { relation: string }) => r.relation === 'unresolved'));
    assert.deepEqual(saved.result.identity, { by: 'default', model_ok: false }, 'a partial model answer must disclose default fallback');
    assert.deepEqual(saved.result.found.dropped_by_reason, {});
    for (const f of jobs.framesAfter(job.id, 0).filter(f => f.event === 'answer.partial' && f.data.site === 'poshmark')) {
      assert.deepEqual(f.data.identity, saved.result.identity);
      assert.deepEqual(f.data.results, saved.result.results);
    }
  }
});

test('merged found counts returned listings once when two sources land the same site rows', async () => {
  const source = SOURCES.find(s => s.id === 'poshmark')!;
  ports.sources = [source, { ...source, id: 'poshmark_repeat' }];
  ports.fetchPage = async () => page(fixture('poshmark'));
  ports.ask = async () => ({ ok: false, reason: 'no_key', ms: 0 });
  const job = await start(); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.result.results.length, 12);
  assert.deepEqual(saved.result.found, { sources_searched: 2, results_found: 24, results_used: 12,
    dropped_by_reason: { unavailable_or_duplicate: 12 }, sites: { poshmark: 12 } });
});

test('reconciliation failure fails only its source stage and the job finishes done', async () => {
  ports.fetchPage = async u => siteOf(u) === 'poshmark' ? page(fixture('poshmark')) : blocked();
  ports.ask = async () => { throw new Error('judge unavailable'); };
  const job = await start(); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.state, 'done');
  assert.deepEqual(saved.result.searched.find((s: { site: string }) => s.site === 'poshmark').pace, SOURCES.find(s => s.site === 'poshmark')!.pace);
  const stage = saved.stages.find((s: { name: string }) => s.name === 'site:poshmark');
  assert.equal(stage.state, 'failed');
  assert.equal(stage.error.code, 'site_failed');
  assert.equal(saved.error, undefined);
  assert.equal(jobs.framesAfter(job.id, 0).at(-1)!.data.state, 'done');
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

test('a shared reconciliation error fails that site for every joining job and cleans held promises', async () => {
  let release!: (p: PageResult) => void, reads = 0;
  ports.fetchPage = async u => {
    if (siteOf(u) !== 'poshmark') return blocked();
    reads++; return new Promise(resolve => { release = resolve; });
  };
  ports.ask = async () => { throw new Error('shared judge failure'); };
  const [a, b] = await Promise.all([start(), start()]);
  release(page(fixture('poshmark')));
  await Promise.all([ended(a.id), ended(b.id)]);
  assert.equal(reads, 1);
  for (const job of [a, b]) {
    const saved = await (await poll(job.id)).json();
    assert.equal(saved.state, 'done');
    const stage = saved.stages.find((s: { name: string }) => s.name === 'site:poshmark');
    assert.equal(stage.state, 'failed'); assert.equal(stage.error.code, 'site_failed');
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


test('source rows control targets: eBay is on and a planted source runs without runner changes', async () => {
  assert.deepEqual(SOURCES.map(({ id, on, needs_ask, reason }) => ({ id, on, needs_ask, reason })), [
    { id: 'dupe', on: true, needs_ask: false, reason: undefined },
    { id: 'depop', on: true, needs_ask: false, reason: undefined },
    { id: 'poshmark', on: true, needs_ask: false, reason: undefined },
    { id: 'mercari', on: true, needs_ask: true, reason: undefined },
    { id: 'facebook', on: true, needs_ask: false, reason: undefined },
    { id: 'ebay', on: true, needs_ask: false, reason: undefined },
  ]);
  const planted = { pace: { per_minute: 1e12, min_gap_ms: 0 }, id: 'planted', site: 'offerup', lane: 'public_page', covers: ['offerup'], needs_ask: false, on: true } as const;
  const fetched: Site[] = [];
  SOURCES.push(planted);
  try {
    ports.fetchPage = async u => { fetched.push(siteOf(u)); return page('No results'); };
    const job = await start(); await ended(job.id);
    assert.ok(job.stages.some((s: { name: string }) => s.name === 'site:planted'));
    assert.ok(fetched.includes('offerup'), 'the added row must reach the real fetch port');
    assert.ok(!fetched.includes('ebay'), 'eBay must use the harness, never the anonymous page reader');
    assert.equal(jobs.framesAfter(job.id, 0).filter(f => f.event === 'answer.partial').length, SOURCES.filter(s => s.on).length);
  } finally { SOURCES.pop(); }
});

test('background and omitted callers never fetch Mercari even when explicitly selected', async () => {
  for (const caller of ['background', undefined] as const) {
    const fetched: string[] = [];
    const result = await searchAll('levi 501', { sources: SOURCES.filter(s => s.id !== 'dupe'), caller, sites: ['mercari', 'depop'],
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
  const examples = memoryJobs(); seedExamples(examples);
  const frames = examples.framesAfter('job_sr1', 0);
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
  assert.equal(denied.searched[0].outcome, 'needs_account'); assert.equal(reads, 0);
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


test('a throw in the failure path store writes is logged and the background promise resolves', async () => {
  const sink = memorySink(); deps.log = createLog({ src: 'test', build: 'test', sink });
  const update = jobs.update;
  const job = await start();
  jobs.update = () => { throw new Error('store unavailable'); };
  try {
    await bounded(Promise.all(searchJobs.pendingSearches.values()));
    assert.match(sink.text(), /search.background/);
    assert.match(sink.text(), /store unavailable/);
    assert.equal(searchJobs.pendingSearches.has(job.id), false);
  } finally { jobs.update = update; jobs.append(job.id, 'job.state', { state: 'failed' }); }
});


test('a recorded Dupe reply lands as its own ranked batch with exact links and disclosures, never cached', async () => {
  let searches = 0, now = 0;
  const sleeps: number[] = [], queries: string[] = [];
  const recording = (name: string) => readFileSync(new URL(`../harness/sites/dupe/fixtures/${name}.sse`, import.meta.url), 'utf8');
  ports.sources = SOURCES.filter(s => s.id === 'dupe');
  ports.dupe = createDupe({ log: deps.log, now: () => now, sleep: async ms => { sleeps.push(ms); now += ms; },
    send: async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.method === 'tools/call') { searches++; queries.push(body.params.arguments.query); }
      return { status: 200, headers: new Headers(), text: async () => body.method === 'initialize' ? recording('initialize')
        : body.method === 'tools/list' ? recording('tools-list') : body.method === 'tools/call' ? recording('search') : '' };
    } });
  const rpc = JSON.parse(recording('search').split('data: ')[1]);
  const products = JSON.parse(rpc.result.content[0].text).products as { link: string; source: string; secondhand: boolean }[];
  const query = "Levi's 501 32x32 Medium Wash";
  for (let i = 0; i < 2; i++) {
    const job = await start({ text: query }); await ended(job.id);
    const saved = await (await poll(job.id)).json();
    assert.equal(saved.state, 'done');
    assert.equal(saved.result.results.length, 6);
    assert.deepEqual(saved.result.found, { sources_searched: 1, results_found: 6, results_used: 6, dropped_by_reason: {}, sites: { dupe: 6 } });
    for (const row of saved.result.results) {
      const product = products.find(p => p.link === row.url);
      assert.ok(product, 'the URL must be byte-identical to a recorded link');
      assert.equal(row.commercial_link, true); assert.equal(row.attribution, 'Dupe.com');
      assert.equal(row.source_site, product.source); assert.equal(row.secondhand, product.secondhand);
      assert.equal(row.site, 'dupe'); assert.equal(row.route_id, 'dupe.search.api');
      assert.equal(row.data, 'live:dupe'); assert.ok(row.keep_until);
    }
    const partials = jobs.framesAfter(job.id, 0).filter(f => f.event === 'answer.partial');
    assert.equal(partials.length, 1, 'a repeat must not emit a standing-index Dupe batch');
    assert.equal(partials[0].data.site, 'dupe');
    assert.deepEqual(partials[0].data.results, saved.result.results);
    assert.equal(saved.result.searched[0].cached, undefined);
    assert.equal(outsideCallCount(), i + 1, 'no request-only route output is retained in the run cache');
  }
  assert.equal(searches, 2); assert.deepEqual(queries, [query, query]); assert.deepEqual(sleeps, [3000]);
});

test('a Dupe protocol failure fails only Dupe with the original code and keeps the other batch', async () => {
  ports.sources = SOURCES.filter(s => ['dupe', 'poshmark'].includes(s.id));
  ports.dupe = { search: async () => ({ ok: false, error: { code: 'rate_limited', message: 'wait', hint: { do: 'retry_after', after_s: 3 } } }) };
  ports.fetchPage = async () => page(fixture('poshmark'));
  const job = await start(); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.state, 'done'); assert.equal(saved.result.results.length, 12);
  const failed = saved.stages.find((s: { name: string }) => s.name === 'site:dupe');
  assert.equal(failed.state, 'failed'); assert.equal(failed.error.code, 'rate_limited');
  assert.equal(saved.result.searched.find((s: { site: string }) => s.site === 'dupe').error_code, 'rate_limited');
});

test('Dupe releases its read slot before identity judgement, so the next query reads at its own pace', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
  ports.sources = LIVE_SOURCES.filter(s => s.site === 'dupe');
  ports.deadline_ms = 20000;
  const starts: number[] = [];
  ports.dupe = { search: async () => {
    starts.push(Date.now());
    return { ok: true, data: { rows: [{ id: `r${starts.length}`, title: 'jeans', price_cents: 5000, currency: 'USD', url: `https://example.test/${starts.length}`,
      commercial_link: true, attribution: 'Dupe.com', source_site: 'ebay', secondhand: true, keep_until: new Date().toISOString() }], dropped: 0, total: 1, keep_until: new Date().toISOString() } };
  } };
  ports.ask = async () => { await new Promise<void>(resolve => setTimeout(resolve, 5000)); return { ok: false, reason: 'timeout', ms: 5000 }; };
  const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
  const first = await start({ text: 'first jeans' }), second = await start({ text: 'second jeans' });
  await flush();
  t.mock.timers.tick(3000); await flush();
  const observed = [...starts];
  t.mock.timers.tick(10000); await flush();
  t.mock.timers.tick(10000); await flush();
  await Promise.all([ended(first.id), ended(second.id)]);
  assert.deepEqual(observed, [1000, 4000], 'identity judgement must not occupy the source read slot');
});


test('Depop gets one browser-start allowance for the search and reuses the configured harness on refresh', async () => {
  searchParams.declare({ name: 'search_browser_start_ms', family: 'scalar', prior: 60 });
  ports.deadline_ms = 20;
  ports.sources = SOURCES.filter(s => s.id === 'depop');
  let reads = 0;
  depopRead = async () => { reads++; await new Promise(resolve => setTimeout(resolve, 40)); return page(fixture('depop')); };
  ports.fetchPage = async () => { assert.fail('Depop must never retry the known 403 public-page lane'); };
  const harness = ports.harness;
  for (let i = 0; i < 2; i++) {
    const job = await start(); await ended(job.id);
    const saved = await (await poll(job.id)).json();
    assert.equal(saved.result.results.length, 12, 'browser startup is allowed before the page-read deadline');
    assert.equal(saved.stages[0].state, 'arrived');
    assert.equal(ports.harness, harness);
  }
  assert.equal(reads, 2);
});


test('Mercari without an account is needs_account in polling and answer frames and has no failed stage', async () => {
  ports.sources = SOURCES.filter(s => s.id === 'mercari');
  const job = await start(); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.state, 'done'); assert.equal(saved.stages[0].state, 'arrived');
  assert.equal(saved.stages[0].error, undefined);
  assert.equal(saved.result.searched[0].outcome, 'needs_account');
  assert.equal(saved.result.searched[0].reason, "needs the person's account");
  for (const frame of jobs.framesAfter(job.id, 0).filter(f => f.event.startsWith('answer.'))) {
    const answer = frame.data.answer as { searched: { outcome: string; reason: string }[] };
    assert.equal(answer.searched[0].outcome, 'needs_account');
    assert.equal(answer.searched[0].reason, "needs the person's account");
  }
});


test('public page failures fail only their source stage, including a shared read', async () => {
  ports.sources = SOURCES.filter(s => s.id === 'poshmark');
  let release!: (p: PageResult) => void;
  ports.fetchPage = async () => new Promise(resolve => { release = resolve; });
  const [a, b] = await Promise.all([start(), start()]);
  release(blocked());
  await Promise.all([ended(a.id), ended(b.id)]);
  for (const job of [a, b]) {
    const saved = await (await poll(job.id)).json();
    assert.equal(saved.state, 'done'); assert.equal(saved.stages[0].state, 'failed');
    assert.equal(saved.stages[0].error.code, 'blocked');
  }
});

test('a half-unreadable page reports unreadable_card in stage, polling and answer counts', async () => {
  ports.sources = SOURCES.filter(s => s.id === 'poshmark');
  ports.fetchPage = async () => page(fixture('poshmark').replace(/<span class="tile-grid-redesign__price-current">[^<]*<\/span>/, ''));
  const job = await start(); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.result.results.length, 11);
  assert.equal(saved.result.searched[0].dropped, 1);
  assert.equal(saved.stages[0].found.dropped_by_reason.unreadable_card, 1);
  assert.equal(saved.result.found.dropped_by_reason.unreadable_card, 1);
});

test('no listing card is unknown in polling and frames, makes one read and starts no repair', async () => {
  ports.sources = SOURCES.filter(s => s.id === 'poshmark');
  let reads = 0;
  ports.fetchPage = async () => { reads++; return page('<a href="/listing/missing-6af924447625b11bb42ec837">x</a>'); };
  const job = await start(); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.equal(reads, 1); assert.equal(saved.stages[0].state, 'arrived');
  assert.equal(saved.stages[0].error, undefined);
  assert.equal(saved.result.searched[0].outcome, 'unknown');
  assert.equal(saved.result.searched[0].reason, 'no listing card');
  for (const frame of jobs.framesAfter(job.id, 0).filter(f => f.event.startsWith('answer.'))) {
    const a = frame.data.answer as { searched: { outcome: string; reason: string }[] };
    assert.equal(a.searched[0].outcome, 'unknown'); assert.equal(a.searched[0].reason, 'no listing card');
  }
});

test('converted eBay cards keep their host and currency, follow USD rows and ignore dollar ceilings', async () => {
  ports.sources = LIVE_SOURCES.filter(s => s.id === 'ebay').map(s => ({ ...s, on: true }));
  ports.harness = createHarness({ adapters: [{ route_id: 'ebay.search.page', manifest: fakeManifest('ebay', 'search'),
    async run() { return { ok: true, data: [
      { external_id: 'gb1', title: 'Levi jeans', price_cents: 1, currency: 'GBP', converted: true, host: 'www.ebay.co.uk', url: 'https://www.ebay.com/itm/1', state: 'active' },
      { external_id: 'gb2', title: 'Levi jeans', price_cents: 999999, currency: 'GBP', converted: true, host: 'www.ebay.co.uk', url: 'https://www.ebay.com/itm/2', state: 'active' },
      { external_id: 'us', title: 'Levi jeans', price_cents: 5000, currency: 'USD', host: 'www.ebay.com', url: 'https://www.ebay.com/itm/3', state: 'active' },
    ] }; },
  }] });
  const job = await start({ text: 'levi', filters: { max_delivered_cents: { amount_cents: 6000, currency: 'USD' } } }); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.deepEqual(saved.result.results.map((r: { external_id: string }) => r.external_id), ['us', 'gb1', 'gb2']);
  const foreign = saved.result.results[1];
  assert.equal(foreign.converted, true); assert.equal(foreign.host, 'www.ebay.co.uk');
  assert.deepEqual(foreign.price_cents, { amount_cents: 1, currency: 'GBP' });
  assert.equal(foreign.delivered_cents, null);
  assert.equal(saved.result.searched[0].pace.per_minute, 6);
});

test('a not-routed source cannot delay answer.settled or take the next runnable eBay pace slot', async () => {
  ports.sources = [{ ...SOURCES.find(s => s.id === 'ebay')!, pace: { per_minute: 60, min_gap_ms: 1000 } }];
  ports.harness = undefined;
  ports.routed = () => false;
  for (let i = 0; i < 2; i++) {
    const job = await start({ text: `no route ${i}` }); await ended(job.id);
    const saved = jobs.st.getJob(job.id)!;
    const stage = saved.stages[0] as typeof saved.stages[number] & { error?: { code: string; message: string } };
    assert.equal(stage.state, 'failed');
    assert.equal(stage.error?.code, 'no_route');
    assert.equal(stage.error?.message, 'no live route composed');
    assert.ok(Date.parse(stage.ended_at!) - Date.parse(stage.started_at!) < 100, 'not-routed source delayed its stage');
    const answer = jobs.framesAfter(job.id, 0).find(f => f.event === 'answer.settled')!.data.answer as { ms: { settled: number } };
    assert.ok(answer.ms.settled < 100, 'not-routed source delayed answer.settled');
  }
  ports.harness = createHarness({ adapters: [{ route_id: 'ebay.search.page', manifest: fakeManifest('ebay', 'search'), run: async () => ({ ok: true, data: [] }) }] });
  ports.routed = () => true;
  const job = await start({ text: 'now routed' }); await ended(job.id);
  const stage = jobs.st.getJob(job.id)!.stages[0];
  assert.ok(Date.parse(stage.ended_at!) - Date.parse(stage.started_at!) < 100, 'no_route reserved a usable eBay pace slot');
});

test('a composition root that marks a harness site unrouted prevents its read even with a harness set', async () => {
  ports.sources = SOURCES.filter(s => s.id === 'depop');
  ports.routed = () => false;
  depopRead = async () => { assert.fail('an unrouted harness site was read'); };
  const job = await start(); await ended(job.id);
  const stage = jobs.st.getJob(job.id)!.stages[0] as { error?: { code: string } };
  assert.equal(stage.error?.code, 'no_route');
});

test('Apify rows keep may_model, use_scope and route through ranking, partials and settled answers', async () => {
  ports.sources = SOURCES.filter(s => s.id === 'facebook');
  const row = { id: 'facebook:demo', title: 'levi 501', currency: 'USD', price_cents: 1000, url: 'https://www.facebook.com/marketplace/item/demo',
    via: 'apify', actor: 'apify~facebook-marketplace-scraper', may_model: false, use_scope: 'hackathon_demo' } as const;
  let calls = 0;
  ports.apify = { search: async () => { calls++; return { ok: true, data: { rows: [row], dropped: 0, total: 1 } }; } };
  for (let i = 0; i < 2; i++) {
    const job = await start(); await ended(job.id);
    const saved = await (await poll(job.id)).json();
    assert.equal(saved.result.results.length, 1);
    for (const result of [saved.result, ...jobs.framesAfter(job.id, 0).filter(f => f.event.startsWith('answer.')).map(f => f.data)]) {
      const offer = result.results[0];
      assert.deepEqual([offer.via, offer.actor, offer.may_model, offer.use_scope, offer.route_id], ['apify', row.actor, false, 'hackathon_demo', 'apify.facebook.search']);
    }
    assert.equal(saved.result.searched[0].cost_usd_est, 0.005);
  }
  assert.equal(calls, 2, 'a cached Apify batch hid a paid run from admission or freshness');
});

test('eBay fallback rows and answer frames carry the Apify route instead of the unavailable page route', async () => {
  ports.sources = SOURCES.filter(s => s.id === 'ebay'); ports.harness = undefined; ports.routed = () => false;
  ports.apify = { search: async lane => ({ ok: true, data: { rows: [{ id: 'ebay:demo', title: 'levi 501', currency: 'USD', price_cents: 1000,
    url: 'https://www.ebay.com/itm/demo', via: 'apify', actor: lane === 'ebay' ? 'automation-lab~ebay-scraper' : 'apify~facebook-marketplace-scraper', may_model: false, use_scope: 'hackathon_demo' }], dropped: 0, total: 1 } }) };
  const job = await start(); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.result.results[0].route_id, 'apify.ebay.search');
  assert.equal(saved.result.searched[0].fallback, 'apify');
  for (const frame of jobs.framesAfter(job.id, 0).filter(f => f.event.startsWith('answer.'))) {
    const answer = frame.data.answer as { searched: { route_id: string; fallback: string; cost_usd_est: number }[] };
    assert.equal(answer.searched[0].route_id, 'apify.ebay.search'); assert.equal(answer.searched[0].fallback, 'apify'); assert.equal(answer.searched[0].cost_usd_est, 0.005);
  }
});

test('an unrouted Mercari stage is no_route before account admission and never queries accounts', async () => {
  ports.sources = SOURCES.filter(s => s.id === 'mercari'); ports.routed = () => false;
  ports.accounts = { linked: async () => { assert.fail('an unrouted source waited for account admission'); }, byId: async () => undefined };
  const job = await start(); await ended(job.id);
  const saved = await (await poll(job.id)).json();
  assert.equal(saved.stages[0].state, 'failed'); assert.equal(saved.stages[0].error.code, 'no_route');
  assert.equal(saved.stages[0].error.message, 'no live route composed');
  assert.ok(Date.parse(saved.stages[0].ended_at) - Date.parse(saved.stages[0].started_at) < 100);
});

test('real Apify Facebook search rows retain their terms and unknown currency without inventing USD', async () => {
  const { createApify } = await import('../harness/sites/apify/adapter.ts');
  ports.sources = SOURCES.filter(s => s.id === 'facebook');
  ports.apify = createApify({ token: 'fixture', log: deps.log, send: async () => ({ status: 200, headers: new Headers(),
    text: async () => readFileSync(new URL('../harness/sites/apify/fixtures/facebook-search.json', import.meta.url), 'utf8') }) });
  const job = await start({ text: 'office chair' }, 'vis_currency'); await ended(job.id);
  const saved = await (await poll(job.id, 'vis_currency')).json();
  assert.ok(saved.result.results.length > 0, 'currencyless Facebook rows were dropped');
  for (const row of saved.result.results) {
    assert.equal(row.price_cents, null, 'currencyless amount was emitted as valid Money');
    assert.equal(row.delivered_cents, null);
    assert.deepEqual([row.via, row.actor, row.may_model, row.use_scope], ['apify', 'apify~facebook-marketplace-scraper', false, 'hackathon_demo']);
  }
});
