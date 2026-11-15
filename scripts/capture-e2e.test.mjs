import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEPS, evaluateStep, isCapture, isUploadTarget, hasProposedBrand,
  isIdentifyDone, hasFinishedJobs, findIdentifyJob, hasNoForeignCaptures,
} from './capture-e2e.mjs';

const origin = 'http://127.0.0.1:43210';
const target = { url: `${origin}/v1/uploads/${'a'.repeat(64)}`, method: 'PUT' };
// Copied shapes and expectations: app/src/edge/api/captures.test.ts,
// "one capture end to end"; view() supplies the capture envelope.
const capture = {
  id: 'cap_1', item_id: 'it_1', version: 4,
  plan: { process: [{ key: 'front' }, { key: 'back' }, { key: 'tag' }], questions: [
    { id: 'q_cap_1_brand', field: 'brand', options: [
      { value: 'Carhartt', proposed: true, rests_on: ['RN 14806 on the tag'] },
    ] },
  ] },
};
const job = { id: 'job_test', kind: 'identify', state: 'done',
  stages: ['code', 'tag', 'visual', 'model'].map(name => ({ name })) };
const context = { origin, capture, jobId: job.id };

test('upload target must be a single-use PUT on exactly our loopback origin', () => {
  assert.equal(isUploadTarget(target, origin), true);
  for (const url of [
    target.url.replace(origin, 'https://uploads.example'),
    target.url.replace('127.0.0.1', 'localhost'),
    target.url.replace('43210', '43211'),
    target.url.replace('/v1/uploads/', '/v1/photos/'),
    target.url.slice(0, -1), `${target.url}a`, `${target.url}?sig=x`,
    `${target.url}#fragment`, target.url.replace('127.0.0.1', 'user@127.0.0.1'),
  ]) assert.equal(isUploadTarget({ ...target, url }, origin), false, url);
  assert.equal(isUploadTarget({ ...target, method: 'POST' }, origin), false);
  assert.equal(isUploadTarget(null, origin), false);
});

test('capture envelope needs identity, a positive version, process and questions', () => {
  assert.equal(isCapture(capture), true);
  for (const patch of [{ id: '' }, { item_id: null }, { version: 0 }, { version: 1.5 },
    { plan: {} }, { plan: { process: [], questions: null } }]) {
    assert.equal(isCapture({ ...capture, ...patch }), false);
  }
  assert.equal(isCapture(null), false);
});

test('brand must be proposed Carhartt with RN 14806 evidence on that same option', () => {
  assert.equal(hasProposedBrand(capture), true);
  for (const patch of [{ value: 'Other' }, { proposed: false }, { rests_on: [] },
    { rests_on: ['RN 148060'] }, { rests_on: 'RN 14806' }]) {
    const copy = structuredClone(capture);
    Object.assign(copy.plan.questions[0].options[0], patch);
    assert.equal(hasProposedBrand(copy), false);
  }
  for (const questions of [[], null, {}, [null], [{ field: 'brand', options: [null] }]]) {
    assert.equal(hasProposedBrand({ plan: { questions } }), false);
  }
});

test('identify must finish and retain all four stages in their route order', () => {
  assert.equal(isIdentifyDone(job), true);
  for (const patch of [{ state: 'running' }, { state: 'failed' }, { kind: 'studio' },
    { stages: [] }, { stages: [...job.stages].reverse() }, { stages: null }]) {
    assert.equal(isIdentifyDone({ ...job, ...patch }), false);
  }
});

test('finish must name the same identify job and the judged capture', () => {
  const finished = { capture: { ...capture, state: 'judged' },
    item: { id: capture.item_id, state: 'researching' }, jobs: [job] };
  assert.equal(hasFinishedJobs(finished, context), true);
  for (const patch of [{ jobs: [] }, { jobs: [{ ...job, id: 'job_wrong' }] },
    { capture: { ...capture, id: 'cap_other', state: 'judged' } },
    { capture: { ...capture, state: 'shooting' } }, { item: { id: 'it_other' } }]) {
    assert.equal(hasFinishedJobs({ ...finished, ...patch }, context), false);
  }
});

test('job discovery uses only a complete capture-scoped identify log record', () => {
  const line = { event: 'job.state', capture: capture.id, job: job.id, kind: 'identify', state: 'running' };
  assert.equal(findIdentifyJob(`Node warning\n${JSON.stringify(line)}\n{"partial":`, capture.id), job.id);
  for (const patch of [{ capture: 'cap_other' }, { event: 'call.end' }, { kind: 'studio' }, { job: '' }]) {
    assert.equal(findIdentifyJob(JSON.stringify({ ...line, ...patch }), capture.id), undefined);
  }
});

test('a listing must have a data array with none of the first person’s captures', () => {
  assert.equal(hasNoForeignCaptures({ data: [] }, capture.id), true);
  assert.equal(hasNoForeignCaptures({ data: [{ id: 'cap_other' }] }, capture.id), true);
  assert.equal(hasNoForeignCaptures({ data: [{ id: capture.id }] }, capture.id), false);
  assert.equal(hasNoForeignCaptures({}, capture.id), false);
});

test('step table covers each photo upload and replay, auth and ownership in order', () => {
  assert.equal(new Set(STEPS.map(s => s.id)).size, STEPS.length);
  for (const person of ['a', 'b']) for (const action of ['start', 'verify']) {
    assert.ok(STEPS.some(s => s.id === `${person}.${action}`));
  }
  for (const role of ['front', 'back', 'tag']) {
    const ids = STEPS.map(s => s.id);
    const at = ids.indexOf(`${role}.photo`);
    assert.deepEqual(ids.slice(at, at + 3), [`${role}.photo`, `${role}.put`, `${role}.replay`]);
  }
  for (const id of ['b.capture', 'b.job', 'b.upload', 'b.patch', 'b.list']) assert.ok(STEPS.some(s => s.id === id));
  assert.ok(STEPS.findIndex(s => s.id === 'identify') < STEPS.findIndex(s => s.id === 'answer'));
  assert.ok(STEPS.findIndex(s => s.id === 'answer') < STEPS.findIndex(s => s.id === 'finish'));
});

test('every response check rejects a wrong status and malformed successful bodies', () => {
  for (const step of STEPS) {
    assert.equal(evaluateStep(step, { status: 500, body: capture }, context), false, step.id);
    assert.equal(evaluateStep(step, { status: step.expected, body: null }, context),
      ['front.put', 'back.put', 'tag.put'].includes(step.id), step.id);
  }
});

test('recorded successful responses pass the same checks the runner calls', () => {
  const cases = {
    health: { ok: true },
    'a.start': { sent: true, expires_at: '2026-11-15T00:00:00Z', resend_after_s: 60 },
    'a.verify': { access_token: 'synthetic-access', user: { id: 'usr_test' } },
    open: capture, type: { ...capture, type: 'apparel' },
    'front.photo': { capture, photos: [{ id: 'ph_a1', role: 'front', step: 'front', upload: target }] },
    'front.put': null, 'front.replay': { code: 'not_found' },
    identify: job, brand: capture,
    answer: { ...capture, version: 5, plan: { process: capture.plan.process, questions: [] } },
    finish: { capture: { ...capture, state: 'judged' }, item: { id: 'it_1', state: 'researching' }, jobs: [job] },
    'b.capture': { code: 'not_found' }, 'b.job': { code: 'not_found' },
    'b.upload': { code: 'not_found' }, 'b.patch': { code: 'not_found' }, 'b.list': { code: 'invalid' },
  };
  for (const [id, body] of Object.entries(cases)) {
    const step = STEPS.find(s => s.id === id);
    assert.equal(evaluateStep(step, { status: step.expected, body }, context), true, id);
  }
});

test('B sign-in fails before PASS when the server returns A identity or access token', () => {
  const step = STEPS.find(s => s.id === 'b.verify');
  const c = { userId: 'usr_a', tokens: { a: 'synthetic-a' } };
  for (const body of [
    { user: { id: 'usr_a' }, access_token: 'synthetic-b' },
    { user: { id: 'usr_b' }, access_token: 'synthetic-a' },
  ]) assert.equal(evaluateStep(step, { status: 200, body }, c), false);
  assert.equal(evaluateStep(step, { status: 200, body: {
    user: { id: 'usr_b' }, access_token: 'synthetic-b',
  } }, c), true);
});
