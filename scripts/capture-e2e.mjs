// Rests-on: spec/product.md §7; spec/engines/capture.md §§4–5;
// app/src/edge/api/captures.test.ts "one capture end to end".
// Live proof (Mac only): node scripts/capture-e2e.mjs
// Offline checks: node --test --test-concurrency=1 scripts/capture-e2e.test.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { openSync, closeSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createLog, maskText } from '../log/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const photoDir = 'research/studio/ben/slides/runs/20261115-0800-43692434630/carhartt-pants';
const photoFiles = { front: 'cand_cover_0.jpg', back: 'cand_back_0.jpg', tag: 'slide_05_tag.jpg' };
const nonempty = value => typeof value === 'string' && value.length > 0;
export const isCapture = value => !!value && nonempty(value.id) && nonempty(value.item_id) &&
  Number.isSafeInteger(value.version) && value.version > 0 &&
  Array.isArray(value.plan?.process) && Array.isArray(value.plan?.questions);

export function isUploadTarget(target, origin) {
  return target?.method === 'PUT' && typeof target.url === 'string' &&
    target.url.startsWith(`${origin}/v1/uploads/`) &&
    /^[a-f0-9]{64}$/.test(target.url.slice(`${origin}/v1/uploads/`.length));
}
export function hasProposedBrand(capture) {
  return Array.isArray(capture?.plan?.questions) && capture.plan.questions.some(q => q?.field === 'brand' && Array.isArray(q.options) &&
    q.options.some(o => o?.value === 'Carhartt' && o.proposed === true && Array.isArray(o.rests_on) &&
      o.rests_on.some(reason => typeof reason === 'string' && /\bRN 14806\b/.test(reason)))) === true;
}
export const isIdentifyDone = job => job?.kind === 'identify' && job.state === 'done' &&
  Array.isArray(job.stages) && JSON.stringify(job.stages.map(s => s?.name)) === JSON.stringify(['code', 'tag', 'visual', 'model']);
export function hasFinishedJobs(body, context) {
  return isCapture(body?.capture) && body.capture.id === context.capture.id && body.capture.state === 'judged' &&
    body.item?.id === context.capture.item_id && body.item?.state === 'researching' &&
    Array.isArray(body.jobs) && body.jobs.some(j => j?.id === context.jobId && j.kind === 'identify');
}
export const hasNoForeignCaptures = (body, captureId) => Array.isArray(body?.data) &&
  body.data.every(row => nonempty(row?.id) && row.id !== captureId);

// view() omits identify_job_id; no GET /v1/jobs listing exists. The scoped
// job.state log names the same job the in-process test reads from captureRows.
export function findIdentifyJob(contents, captureId) {
  let id;
  for (const line of contents.split('\n')) {
    if (!line.startsWith('{') || !line.endsWith('}')) continue; // warnings or an unfinished write
    const record = JSON.parse(line);
    if (record.event === 'job.state' && record.capture === captureId &&
      record.kind === 'identify' && nonempty(record.job)) id = record.job;
  }
  return id;
}
const notFound = body => body?.code === 'not_found';
const sameCapture = (body, context) => isCapture(body) && body.id === context.capture.id;
const step = (id, expected, fact, check) => ({ id, expected, fact, check });
export const STEPS = [
  step('health', 200, 'server answers healthz', b => b?.ok === true),
  ...['a', 'b'].flatMap(person => [
    step(`${person}.start`, 202, `${person.toUpperCase()} email code sent`, b => b?.sent === true && nonempty(b.expires_at) && Number.isFinite(b.resend_after_s)),
    step(`${person}.verify`, 200, `${person.toUpperCase()} receives a distinct access token and identity`, (b, c) =>
      nonempty(b?.access_token) && nonempty(b.user?.id) &&
      (person === 'a' || b.user.id !== c.userId && b.access_token !== c.tokens?.a)),
  ]),
  step('open', 201, 'capture opens with a plan', isCapture),
  step('type', 200, 'apparel process is front, back, tag', b => isCapture(b) && b.type === 'apparel' &&
    JSON.stringify(b.plan.process.map(s => s?.key)) === JSON.stringify(['front', 'back', 'tag'])),
  ...['front', 'back', 'tag'].flatMap(role => [
    step(`${role}.photo`, 201, `${role} photo receives our single-use PUT target`, (b, c) =>
      sameCapture(b?.capture, c) && b.photos?.length === 1 && nonempty(b.photos[0]?.id) &&
      b.photos[0].role === role && b.photos[0].step === role && isUploadTarget(b.photos[0].upload, c.origin)),
    step(`${role}.put`, 204, `${role} JPEG bytes accepted`, b => b === null),
    step(`${role}.replay`, 404, `${role} target cannot be used twice`, notFound),
  ]),
  step('identify', 200, 'identify done; stages code, tag, visual, model', isIdentifyDone),
  step('brand', 200, 'brand proposes Carhartt from RN 14806', (b, c) => sameCapture(b, c) && hasProposedBrand(b)),
  step('answer', 200, 'brand answer removes the question and advances version', (b, c) => sameCapture(b, c) &&
    b.version > c.capture.version && !b.plan.questions.some(q => q?.field === 'brand')),
  step('finish', 202, 'judged capture and researching item name the identify job', hasFinishedJobs),
  step('b.capture', 404, 'B cannot read A capture', notFound),
  step('b.job', 404, 'B cannot read A identify job', notFound),
  step('b.upload', 404, 'B cannot reuse consumed upload capability', notFound),
  step('b.patch', 404, 'B cannot change A capture', notFound),
  // captures/index+api.ts exports POST only; server/routes.ts returns 405.
  step('b.list', 405, 'no capture listing route exists', b => b?.code === 'invalid'),
];
export const evaluateStep = (entry, response, context) => response.status === entry.expected && entry.check(response.body, context) === true;

async function freePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

export async function main() {
  const results = [];
  const context = { tokens: {}, targets: {}, bytes: {} };
  const abort = new AbortController();
  let folder, child, exited, log, childError, pollSignal;
  const stop = () => abort.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const record = (entry, status, ok, detail = '') => {
    const result = { step: entry.id, expected: entry.expected, got: status, result: ok ? 'PASS' : 'FAIL' };
    results.push(result);
    process.stdout.write(`${result.result} ${entry.id} expected=${entry.expected} got=${status} ${entry.fact}${detail ? ` (${detail})` : ''}\n`);
    log?.note('capture.e2e.step', result);
  };
  const request = async (method, path, person, body, raw = false, timeoutMs = 5000) => {
    const url = new URL(path, context.origin);
    if (url.origin !== context.origin) throw new Error('request origin escaped localhost');
    return log.call('http', `${method} ${url.pathname}`, {}, async () => {
      const response = await fetch(url, {
        method, redirect: 'error', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(timeoutMs), ...(pollSignal ? [pollSignal] : [])]),
        headers: { ...(person ? { Authorization: `Bearer ${context.tokens[person]}` } : {}),
          ...(body === undefined ? {} : { 'Content-Type': raw ? 'image/jpeg' : 'application/json' }) },
        body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    }, response => ({ status: response.status }));
  };
  const poll = async (work, ready, ms) => {
    const deadline = Date.now() + ms;
    let result;
    pollSignal = AbortSignal.timeout(ms);
    try {
      do {
        abort.signal.throwIfAborted();
        if (childError) throw childError;
        if (child.exitCode !== null || child.signalCode !== null) throw new Error('server exited before checks completed');
        result = await work(Math.max(1, Math.min(1000, deadline - Date.now())));
        if (ready(result)) return result;
        if (Date.now() < deadline) await delay(100, undefined, { signal: abort.signal });
      } while (Date.now() < deadline);
      return result;
    } finally { pollSignal = undefined; }
  };
  const capturePath = suffix => `/v1/captures/${context.capture.id}${suffix ?? ''}`;
  try {
    folder = await mkdtemp(join(tmpdir(), 'secondhand-capture-e2e-'));
    log = createLog({ src: 'capture.e2e', build: 'dev', sink: line => appendFileSync(join(folder, 'runner.log'), `${line}\n`) });
    const port = await freePort();
    context.origin = `http://127.0.0.1:${port}`;
    const fd = openSync(join(folder, 'server.log'), 'a');
    try {
      child = spawn(process.execPath, ['server/main.ts'], {
        cwd: root, stdio: ['ignore', fd, fd],
        env: { ...process.env, NODE_ENV: 'development', SECONDHAND_DEV_CODE: '314159',
          SECONDHAND_DATA_DIR: folder, PORT: String(port), SECONDHAND_PUBLIC_ORIGIN: context.origin },
      });
      exited = new Promise(resolve => {
        child.once('exit', resolve);
        child.once('error', error => { childError = error; resolve(); });
      });
    } finally { closeSync(fd); }
    for (const entry of STEPS) {
      let response;
      try {
        if (entry.id === 'health') {
          response = await poll(async timeout => {
            try { return await request('GET', '/healthz', undefined, undefined, false, timeout); }
            catch (error) {
              if (error.name === 'TimeoutError' || error.cause?.code === 'ECONNREFUSED') return { status: 'unreachable', body: null };
              throw error;
            }
          }, r => r.status === 200, 60000);
        } else if (/^[ab]\.(start|verify)$/.test(entry.id)) {
          const [person, action] = entry.id.split('.');
          response = await request('POST', `/v1/auth/email/${action}`, undefined,
            { email: `${person}@example.test`, ...(action === 'verify' ? { code: '314159' } : {}) });
        } else if (entry.id === 'open') {
          response = await request('POST', '/v1/captures', 'a', {
            mode: 'shots', intent: 'sell', device: { has_lidar: false, object_capture: false },
          });
        } else if (entry.id === 'type') {
          response = await request('PATCH', capturePath(), 'a', { version: context.capture.version, type: 'apparel' });
        } else if (/^(front|back|tag)\./.test(entry.id)) {
          const [role, action] = entry.id.split('.');
          if (action === 'photo') {
            const next = context.capture.plan.process.find(s => s.state === 'pending' || s.state === 'retake');
            if (next?.key !== role) throw new Error(`plan does not ask for ${role} next`);
            const bytes = await readFile(join(root, photoDir, photoFiles[role]));
            context.bytes[role] = bytes;
            response = await request('POST', capturePath('/photos'), 'a', { photos: [{ role, step: role,
              content_type: 'image/jpeg', bytes: bytes.length, reads: [],
              // Copied verbatim from captures.test.ts "one capture end to end".
              ...(role === 'tag' ? { text: [{ line: 'Carhartt RN 14806', confidence: 0 }] } : {}),
            }] });
          } else response = await request('PUT', context.targets[role].url, 'a', context.bytes[role], true);
        } else if (entry.id === 'identify') {
          response = await poll(async () => {
            const capture = await request('GET', capturePath(), 'a');
            if (capture.status !== 200 || !isCapture(capture.body)) return capture;
            context.capture = capture.body;
            context.jobId = findIdentifyJob(await readFile(join(folder, 'server.log'), 'utf8'), context.capture.id);
            if (!context.jobId) return { status: 'no job id', body: null };
            return request('GET', `/v1/jobs/${context.jobId}`, 'a');
          }, r => r.status !== 200 && r.status !== 'no job id' || ['done', 'failed', 'cancelled'].includes(r.body?.state), 30000);
        } else if (entry.id === 'brand') response = await request('GET', capturePath(), 'a');
        else if (entry.id === 'answer') {
          const question = context.capture.plan.questions.find(q => q.field === 'brand');
          response = await request('PATCH', capturePath(), 'a', { version: context.capture.version,
            answer: { ask_id: question.id, field: 'brand', value: 'Carhartt' } });
        } else if (entry.id === 'finish') response = await request('POST', capturePath('/finish'), 'a', { version: context.capture.version });
        else if (entry.id === 'b.capture') response = await request('GET', capturePath(), 'b');
        else if (entry.id === 'b.job') response = await request('GET', `/v1/jobs/${context.jobId}`, 'b');
        else if (entry.id === 'b.upload') response = await request('PUT', context.targets.front.url, 'b', context.bytes.front, true);
        else if (entry.id === 'b.patch') response = await request('PATCH', capturePath(), 'b', { version: context.capture.version, type: 'apparel' });
        else if (entry.id === 'b.list') response = await request('GET', '/v1/captures', 'b');
        else throw new Error('step has no implementation');
        const ok = evaluateStep(entry, response, context);
        record(entry, response.status, ok);
        if (!ok) throw new Error(`${entry.id}: response failed its fact check`);
        if (entry.id.endsWith('.verify')) {
          const person = entry.id[0];
          context.tokens[person] = response.body.access_token;
          if (person === 'a') context.userId = response.body.user.id;
        }
        if (['open', 'type', 'brand', 'answer'].includes(entry.id)) context.capture = response.body;
        if (entry.id.endsWith('.photo')) {
          context.capture = response.body.capture;
          context.targets[entry.id.split('.')[0]] = response.body.photos[0].upload;
        }
      } catch (error) {
        if (!results.some(r => r.step === entry.id)) record(entry, response?.status ?? 'no response', false, maskText(error.message));
        throw error;
      }
    }
  } catch (error) {
    log?.error('capture.e2e', error);
    process.stderr.write(`FAIL capture-e2e: ${maskText(error.message)}\n`);
    if (folder && !results.some(r => r.step === 'health' && r.result === 'PASS')) {
      const contents = await readFile(join(folder, 'server.log'), 'utf8').catch(readError => `Cannot read server.log: ${readError.code}`);
      process.stderr.write(`server.log last 40 lines:\n${maskText(contents.trimEnd().split('\n').slice(-40).join('\n'))}\n`);
    }
  } finally {
    if (child && child.exitCode === null && child.signalCode === null && !childError) {
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
      try { await exited; } finally { clearTimeout(timer); }
    }
    for (const entry of STEPS) if (!results.some(r => r.step === entry.id)) record(entry, 'not run', false, 'earlier step failed');
    log?.end({ ok: results.every(r => r.result === 'PASS') });
    if (folder) await rm(folder, { recursive: true, force: true });
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
  process.stdout.write('\nstep\texpected\tgot\tPASS/FAIL\n');
  for (const r of results) process.stdout.write(`${r.step}\t${r.expected}\t${r.got}\t${r.result}\n`);
  return results.length === STEPS.length && results.every(r => r.result === 'PASS') ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main();
}
