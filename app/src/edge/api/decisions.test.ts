import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { act, list, sign, feedOf, formOf } from './decisions.ts';
import { store } from './store.ts';

const LIST = route('GET /v1/decisions', list);
const ACT = route('POST /v1/decisions/:id/act', act);
beforeEach(() => {
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.verify = async (t) => ({ a: 'usr_a', b: 'usr_b' } as Record<string, string>)[t] ?? null;
});
const req = (path: string, token: string, body?: unknown, key = crypto.randomUUID()) =>
  new Request(`http://edge.test${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key }, body: body ? JSON.stringify(body) : undefined });
const raise = (user_id: string, kind: string, extra: Record<string, unknown> = {}) =>
  store.raiseDecision({ user_id, kind, subject: `it_${crypto.randomUUID().slice(0, 6)}`, item_id: 'it_7c2m', why: 'test', options: [{ id: 'opt_yes', label: 'Yes' }, { id: 'opt_no', label: 'No' }], suggested: 'opt_yes', ...extra }).row;

test('a list shows only the caller\'s open decisions, each with tier, feed, form, signed options and a version', async () => {
  const mine = raise('usr_a', 'accept_offer'); raise('usr_b', 'accept_offer');
  const body = await (await LIST(req('/v1/decisions?state=open', 'a'))).json();
  assert.ok(body.data.every((d: { id: string }) => store.decisions({ user_id: 'usr_a' }).some((x) => x.id === d.id)));
  const d = body.data.find((x: { id: string }) => x.id === mine.id);
  assert.equal(d.tier, 'ask'); assert.equal(d.feed, 'now'); assert.equal(d.group_form, 'single'); assert.equal(d.version, 1);
  assert.ok(d.options.every((o: { signature: string }) => typeof o.signature === 'string' && o.signature.includes('.')));
  assert.equal(body.next_cursor, null);
});

test('stacks: two buy_label cards form a batch; one due within a day never groups', () => {
  assert.equal(formOf('buy_label'), 'batch'); assert.equal(formOf('first_post'), 'queue'); assert.equal(formOf('accept_offer'), 'single');
  const soon = new Date(Date.now() + 3600_000).toISOString();
  assert.equal(feedOf({ kind: 'first_post', deadline: soon } as never, Date.now()), 'now');
  assert.equal(feedOf({ kind: 'digest' } as never, Date.now()), 'good_to_know');
});

test('act: the right answer moves the decision to acting and makes one job through intake', async () => {
  const d = raise('usr_a', 'accept_offer');
  const r = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_yes'), version: 1 }));
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.decision.state, 'acting'); assert.equal(b.decision.version, 2); assert.match(b.job.id, /^job_/); assert.equal(b.job.kind, 'answer_offer');
  assert.match(b.event_id, /^ev_/);
});

test('act: an unmapped kind stays byte-identical, with no job, event or answer log', async () => {
  const sink = memorySink();
  deps.log = createLog({ src: 'test', build: 'test', sink });
  const d = raise('usr_a', 'studio_approve');
  const before = JSON.stringify(store.decisions({ user_id: d.user_id }).find(row => row.id === d.id));
  const events = store.events({ user_id: d.user_id }).length, jobs = store.jobs({ user_id: d.user_id }).length;
  const body = { option_id: 'opt_yes', signature: sign(d, 'opt_yes'), version: 1 };
  const key = crypto.randomUUID();
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', body, key));
    assert.equal(response.status, 503, 'unmapped actions must be refused on every attempt');
    assert.deepEqual(await response.json(), { code: 'unavailable', message: 'This decision action is not available yet', failed_step: 'act', retry: { by: 'none' } });
    assert.equal(JSON.stringify(store.decisions({ user_id: d.user_id }).find(row => row.id === d.id)), before);
    assert.equal(store.events({ user_id: d.user_id }).length, events);
    assert.equal(store.jobs({ user_id: d.user_id }).length, jobs);
  }
  assert.ok(!sink.lines.some(line => JSON.parse(line).event === 'decision.answer'));
});

test('act: a mapped request replay returns its first answer and makes only one event and job', async () => {
  const d = raise('usr_a', 'accept_offer');
  const key = crypto.randomUUID(), body = { option_id: 'opt_yes', signature: sign(d, 'opt_yes'), version: 1 };
  const first = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', body, key));
  assert.equal(first.status, 200);
  const answer = await first.text();
  const again = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', body, key));
  assert.equal(again.status, 200);
  assert.equal(await again.text(), answer);
  assert.equal(again.headers.get('Idempotent-Replayed'), 'true');
  assert.equal(store.events({ user_id: d.user_id }).filter(row => row.payload?.decision_id === d.id).length, 1);
  assert.equal(store.jobs({ user_id: d.user_id }).filter(row => row.id === store.decisions({ user_id: d.user_id }).find(row => row.id === d.id)?.job_id).length, 1);
  const changed = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { ...body, option_id: 'opt_no' }, key));
  assert.equal(changed.status, 409);
  assert.equal((await changed.json()).code, 'idempotency_mismatch');
});

test('act refuses: a foreign decision 404, a stale version 409, a forged or expired signature 400, a rule on a locked kind 403', async () => {
  const theirs = raise('usr_b', 'accept_offer');
  assert.equal((await ACT(req(`/v1/decisions/${theirs.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(theirs, 'opt_yes'), version: 1 }))).status, 404);
  const d = raise('usr_a', 'counter_offer');
  const stale = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_yes'), version: 7 }));
  assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'stale');
  const forged = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_no'), version: 1 }));
  assert.equal(forged.status, 400);
  const old = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_yes', Date.now() - 16 * 60_000), version: 1 }));
  assert.equal(old.status, 400);
  const locked = raise('usr_a', 'share_address');
  const r = await ACT(req(`/v1/decisions/${locked.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(locked, 'opt_yes'), version: 1, via: 'rule' }));
  assert.equal(r.status, 403); assert.equal((await r.json()).code, 'locked');
});

test('act on an acting decision is 409 stale; a missing field is 400 invalid with fields', async () => {
  const d = raise('usr_a', 'accept_offer');
  const ok = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_yes'), version: 1 }));
  assert.equal((await ok.json()).decision.state, 'acting');
  const again = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_yes'), version: 2 }));
  assert.equal(again.status, 409);
  const bad = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes' }));
  assert.equal(bad.status, 400); assert.deepEqual((await bad.json()).fields, ['signature', 'version']);
});

test('decision signatures and row versions survive a restart; acting with the old version is stale', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'decision-restart-'));
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'development', SECONDHAND_DATA_DIR: dir };
  delete env.DECISION_SIGNING_KEY;
  const setup = `
    const { store } = await import(${JSON.stringify(new URL('./store.ts', import.meta.url).href)});
    const { deps, route } = await import(${JSON.stringify(new URL('./http.ts', import.meta.url).href)});
    deps.verify = async () => 'usr_restart';
    const { list, act } = await import(${JSON.stringify(new URL('./decisions.ts?restart=1', import.meta.url).href)});
    const request = (path, body) => new Request('http://edge.test' + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer test' }, body: body ? JSON.stringify(body) : undefined });
  `;
  const run = (code: string) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', setup + code], { env, encoding: 'utf8' }).trim().split('\n').at(-1)!);
  try {
    const signed = run(`store.raiseDecision({ user_id: 'usr_restart', kind: 'accept_offer', subject: 'it_restart', item_id: 'it_restart', why: 'test', options: [{ id: 'opt_yes', label: 'Yes' }] });
      const response = await route('GET /v1/decisions', list)(request('/v1/decisions'));
      process.stdout.write(JSON.stringify((await response.json()).data[0]));`);
    const body = { option_id: 'opt_yes', signature: signed.options[0].signature, version: signed.version };
    const code = `const response = await route('POST /v1/decisions/:id/act', act)(request(${JSON.stringify(`/v1/decisions/${signed.id}/act`)}, ${JSON.stringify(body)}));
      process.stdout.write(JSON.stringify({ status: response.status, body: await response.json(), row: store.decisions({ user_id: 'usr_restart' })[0] }));`;
    const acted = run(code);
    assert.equal(acted.status, 200); assert.equal(acted.body.decision.version, 2); assert.equal(acted.row.version, 2);
    const again = run(code);
    assert.equal(again.status, 409); assert.equal(again.body.code, 'stale'); assert.equal(again.body.current.version, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a failed decision update rolls back the answer event, job, state and version without success logs', async () => {
  const sink = memorySink();
  deps.log = createLog({ src: 'test', build: 'test', sink });
  const d = raise('usr_a', 'accept_offer');
  const update = store.updateDecision;
  const beforeEvents = store.events({ user_id: 'usr_a' }).length;
  const beforeJobs = store.jobs({ user_id: 'usr_a' }).length;
  store.updateDecision = (id, patch) => { update(id, patch); throw new Error('decision write failed'); };
  try {
    const response = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_yes'), version: 1 }));
    assert.equal(response.status, 503);
  } finally { store.updateDecision = update; }
  const row = store.decisions({ user_id: 'usr_a' }).find(row => row.id === d.id)!;
  assert.equal(row.state, 'open'); assert.equal(row.version ?? 1, 1);
  assert.equal(store.events({ user_id: 'usr_a' }).length, beforeEvents);
  assert.equal(store.jobs({ user_id: 'usr_a' }).length, beforeJobs);
  assert.ok(!sink.lines.some(line => ['event.received', 'decision.answer'].includes(JSON.parse(line).event)), 'rolled-back writes must not be logged as received or answered');
});

test('decision signing reads the environment lazily after import and signs the persisted row version', async () => {
  const { createHmac, randomBytes } = await import('node:crypto');
  const d = raise('usr_a', 'accept_offer', { version: 7 });
  const previous = process.env.DECISION_SIGNING_KEY;
  const key = randomBytes(32).toString('hex');
  process.env.DECISION_SIGNING_KEY = key;
  try {
    const now = Date.now();
    const stamp = now.toString(36);
    const expected = createHmac('sha256', key).update([d.id, 'opt_yes', '7', d.user_id, stamp].join('|')).digest('base64url');
    assert.equal(sign(d, 'opt_yes', now), `${stamp}.${expected}`);
    const response = await ACT(req(`/v1/decisions/${d.id}/act`, 'a', { option_id: 'opt_yes', signature: sign(d, 'opt_yes'), version: 7 }));
    assert.equal(response.status, 200); assert.equal((await response.json()).decision.version, 8);
    assert.equal(store.decisions({ user_id: 'usr_a' }).find(row => row.id === d.id)!.version, 8);
  } finally {
    if (previous === undefined) delete process.env.DECISION_SIGNING_KEY;
    else process.env.DECISION_SIGNING_KEY = previous;
  }
});
