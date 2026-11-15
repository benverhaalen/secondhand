// The contract examples (spec/examples/) against spec/product.md §7: every endpoint has an example, and every
// example keeps the conventions (cents, id prefixes, UTC times, no client-sent user_id, every error code).
// Ben's screens mock from these files and the edge serves from them until each engine lands, so a drift here is a drift in both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'examples');
const product = readFileSync(join(here, 'product.md'), 'utf8');
const events = JSON.parse(readFileSync(join(here, 'events.json'), 'utf8'));
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const all = files.flatMap((f) => (load(f).examples ?? []).map((e) => ({ ...e, file: f })));

const METHOD = /^(GET|POST|PATCH|PUT|DELETE)$/;
const section = (md, start, end) => md.slice(md.indexOf(start), md.indexOf(end, md.indexOf(start)));

// Every "METHOD /v1/path" in a markdown table's first column; a bare method token carries to the next path ("`GET`, `PUT /v1/limits`").
export function endpointsOf(md) {
  const out = new Set();
  for (const line of md.split('\n')) {
    if (!line.startsWith('| `')) continue;
    const cell = line.split(' | ')[0];
    let carried = [];
    for (const [, tok] of cell.matchAll(/`([^`]+)`/g)) {
      if (METHOD.test(tok.trim())) { carried.push(tok.trim()); continue; }
      const m = tok.match(/^(GET|POST|PATCH|PUT|DELETE) (\/v1\/[^\s?{]*)/);
      if (!m) continue;
      for (const meth of [...carried, m[1]]) out.add(`${meth} ${m[2]}`);
      carried = [];
    }
  }
  return out;
}

// Rows packet 47 asks for that the canon lacks; each leaves this list when it lands in product.md §7.
// Sent to the orchestrator as canon rows (stream 15, 2026-11-14). Agent proposal.
const PROPOSED = new Set([
  'POST /v1/auth/apple', 'POST /v1/auth/google', 'POST /v1/auth/email/start', 'POST /v1/auth/email/verify',
  'POST /v1/auth/refresh', 'POST /v1/auth/signout', 'POST /v1/auth/link/apple', 'POST /v1/auth/link/google',
  'POST /v1/auth/link/email', 'GET /v1/me', 'GET /v1/me/style', 'PATCH /v1/me/style',
  'GET /v1/items/:id/plan-choices', 'GET /v1/accounts/:id/import-preview', 'POST /v1/captures/:id/talk',
]);

const canon = endpointsOf(section(product, '### Resources', '### Jobs and the event stream'));
const want = new Set([...canon, ...PROPOSED]);

// §7 prefixes, plus the ones these examples propose (usr_ user, opt_ decision option, act_ a fix action, vis_ visitor, fc_ forecast).
const PREFIXES = section(product, '## 7. Contract conventions', '### Requests').match(/`([a-z]+)_`/g).map((p) => p.slice(1, -1))
  .concat(['usr_', 'opt_', 'act_', 'vis_', 'fc_', 'sp_']);
// Ids that are not ours: the site's own, a trace, a reverse-DNS route, a site category, a client-chosen key.
const FOREIGN_ID = /^(trace_id|request_id|external_.*|site_.*|route_id|category_id|shopify_gid|google_id|call_id|span_id|template_key|push_token|operation_id|kind_id|index_id|family_id|version_id|client_id)$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const TIME_KEY = /(_at|^as_of|^until|^deadline|^expires|^ship_by|^respond_by|^claim_until|^release_at|^start|^end|^at)$/;
const MONEY_WORD = /(price|cost|fee|payout|amount|total|earn|kept|keep|dollar|usd|spend|insure|shipping|tax|max_pay|floor|accept)/i;

function walk(v, visit, path = []) {
  visit(v, path);
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, visit, [...path, i]));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, visit, [...path, k]);
}

export function problems(example) {
  const out = [];
  const where = (p) => `${example.file} ${example.name}: ${p.join('.')}`;
  walk(example, (v, p) => {
    const key = p[p.length - 1];
    if (typeof key !== 'string') return;
    if (key === 'amount_cents' && !Number.isInteger(v)) out.push(`${where(p)} amount_cents is not an integer`);
    if (key.endsWith('_cents') && key !== 'amount_cents' && v !== null) {
      if (!(v && typeof v === 'object' && Number.isInteger(v.amount_cents) && typeof v.currency === 'string')) out.push(`${where(p)} is not {amount_cents, currency}`);
    }
    if (typeof v === 'number' && MONEY_WORD.test(key) && key !== 'amount_cents' && !/(_days|_count|count|_pct|points|rank|_ms|share)$/.test(key)) out.push(`${where(p)} is a bare money number`);
    if ((key === 'id' || key.endsWith('_id')) && typeof v === 'string' && !FOREIGN_ID.test(key) && !PREFIXES.some((x) => v.startsWith(x))) out.push(`${where(p)} id "${v}" has no known prefix`);
    if (key.endsWith('_ids') && !key.startsWith('external') && Array.isArray(v)) for (const x of v) if (typeof x === 'string' && !PREFIXES.some((pre) => x.startsWith(pre))) out.push(`${where(p)} id "${x}" has no known prefix`);
    if (TIME_KEY.test(key) && typeof v === 'string' && !UTC.test(v) && !/^\d{4}-\d{2}-\d{2}$/.test(v)) out.push(`${where(p)} "${v}" is not UTC ISO 8601`);
  });
  const req = example.request ?? {};
  for (const part of ['body', 'query']) if (req[part] && JSON.stringify(req[part]).includes('"user_id"')) out.push(`${example.file} ${example.name}: the client sends user_id`);
  return out;
}

test('every endpoint in product.md §7 and every proposed row has an example', () => {
  assert.ok(canon.size >= 70, `parsed only ${canon.size} canon endpoints; the §7 table moved?`);
  const have = new Set(all.map((e) => e.endpoint));
  const missing = [...want].filter((e) => !have.has(e));
  assert.deepEqual(missing, [], `no example for:\n${missing.join('\n')}`);
});

test('every example names an endpoint the canon or the proposed list has', () => {
  const unknown = all.filter((e) => !want.has(e.endpoint)).map((e) => `${e.file} ${e.name}: ${e.endpoint}`);
  assert.deepEqual(unknown, []);
});

test('every example has a name, a status and a concrete path that fits its endpoint', () => {
  for (const e of all) {
    assert.ok(e.name && Number.isInteger(e.status), `${e.file}: ${JSON.stringify(e).slice(0, 80)}`);
    const [method, pattern] = e.endpoint.split(' ');
    assert.equal(e.method ?? method, method, e.name);
    const re = new RegExp('^' + pattern.replace(/:[a-z_]+/g, '[^/?]+') + '(\\?.*)?$');
    assert.match(e.path, re, `${e.file} ${e.name}`);
    assert.ok(['user', 'visitor', 'none'].includes(e.auth ?? 'user'), e.name);
  }
});

test('money is cents, ids carry their prefix, times are UTC, no client sends user_id', () => {
  const found = all.flatMap(problems);
  assert.deepEqual(found, []);
});

test('the checker catches a dollar float, a bare id and a client-sent user_id', () => {
  const bad = { file: 'x', name: 'bad', request: { body: { user_id: 'usr_1' } }, response: { price: 12.5, item_id: '42', fee_cents: 300, at: '2026-11-14 10:00' } };
  const p = problems(bad).join('\n');
  for (const want of ['bare money number', 'no known prefix', 'not {amount_cents', 'user_id', 'UTC']) assert.ok(p.includes(want), want);
});

test('every POST that creates or acts carries an Idempotency-Key', () => {
  const missing = all.filter((e) => e.endpoint.startsWith('POST') && (e.status < 400) && !e.request?.headers?.['Idempotency-Key']).map((e) => e.name);
  assert.deepEqual(missing, []);
});

test('lists page as {data, next_cursor}', () => {
  for (const e of all.filter((x) => x.list)) {
    assert.ok(Array.isArray(e.response.data) && 'next_cursor' in e.response, e.name);
  }
});

test('every error code in §7 has an example with its HTTP status and the error shape', () => {
  const table = section(product, '### Errors', '## 8.');
  const rows = [...table.matchAll(/^\| (\d{3}) \| ([^|]+) \|/gm)].flatMap(([, http, codes]) => [...codes.matchAll(/`([a-z_]+)`/g)].map(([, c]) => [Number(http), c]));
  assert.ok(rows.length >= 11);
  const errs = load('errors.json').examples;
  for (const [http, code] of rows) {
    const e = errs.find((x) => x.response.code === code);
    assert.ok(e, `no example for ${code}`);
    assert.equal(e.status, http, code);
    assert.ok(typeof e.response.message === 'string' && 'failed_step' in e.response && ['auto', 'user', 'none'].includes(e.response.retry?.by), code);
    if (code === 'rate_limited' || code === 'waking') assert.ok(Number.isInteger(e.response.retry.after_s), code);
  }
});

test('a 202 job and its stream: every stage frame carries found{}, frames resume by id, events are known names', () => {
  const jobs = load('jobs.json');
  const accepted = all.filter((e) => e.status === 202 && (e.response?.jobs || e.response?.kind)); // a 202 that is not a job: email/start
  assert.ok(accepted.length >= 5);
  for (const e of accepted) {
    for (const r of e.response.jobs ?? [e.response]) assert.ok(r.id.startsWith('job_') && r.kind && r.state && Array.isArray(r.stages), e.name);
  }
  const known = new Set([...Object.keys(events.events ?? events), 'fact.found', 'message.new', 'score.change', 'gather.update']);
  assert.ok(jobs.streams.length >= 2);
  for (const s of jobs.streams) {
    const ids = s.frames.map((f) => Number(f.id));
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b), `${s.name} ids ascend`);
    assert.equal(new Set(ids).size, ids.length, `${s.name} ids unique`);
    for (const f of s.frames) {
      if (f.comment) continue;
      assert.ok(known.has(f.event), `${s.name}: unknown event ${f.event}`);
      if (f.event === 'job.stage') assert.ok(f.data.found && typeof f.data.found === 'object', `${s.name} frame ${f.id} has no found{}`);
      if (f.event === 'fact.found') assert.ok(f.data.attribute?.name && 'value' in f.data.attribute, `${s.name} frame ${f.id}`);
    }
    for (const p of problems({ name: s.name, file: 'jobs.json', frames: s.frames.map((f) => f.data) })) assert.fail(p);
  }
  const states = { job: ['queued', 'running', 'done', 'failed'], stage: ['started', 'running', 'arrived', 'failed'] };
  for (const s of jobs.streams) for (const f of s.frames) {
    if (f.event === 'job.state') assert.ok(states.job.includes(f.data.state), f.data.state);
    if (f.event === 'job.stage') assert.ok(states.stage.includes(f.data.state), f.data.state);
  }
});
