import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { start } from './behavior.mjs';

let app;
before(async () => { app = await start({ dark: true }); });
after(async () => { await app?.stop(); });
const capture = { id: 'cap_ui', item_id: 'it_ui', version: 1, purpose: 'find', coverage: { needed: [], kept: [] }, plan: { status: 'done', fields: [], questions: [], process: [] } };
const auth = {
  '/v1/auth/refresh': { access_token: 'ui-test', refresh_token: 'ui-refresh', expires_at: '2099-01-01T00:00:00Z' },
  '/v1/me': { id: 'ui-user', tutorial_seen: true },
  ...Object.fromEntries(['accounts', 'items', 'orders', 'wants', 'conversations', 'events', 'lookups'].map(name => [`/v1/${name}`, { data: [], next_cursor: null }])),
  '/v1/today': { decisions: [] },
};
const json = (route, body) => route.fulfill({ json: body });
async function open(job, extra = {}) {
  const v = await app.open('/camera?mode=find', { api: { ...auth,
    '/v1/captures': capture, '/v1/captures/cap_ui': capture,
    '/v1/captures/cap_ui/finish': { jobs: [job] },
    '/v1/jobs/job_ui': job, ...extra,
  } });
  await v.tap('cam-done');
  return v;
}

test('Find sends its intent, and completed results stop claiming to be finding', async () => {
  let sent;
  const v = await open({ id: 'job_ui', item_id: 'it_ui', kind: 'identify', state: 'done', result: { candidates: [{ brand: 'Carhartt', model: 'Detroit' }] } }, {
    '/v1/captures': route => { sent = route.request().postDataJSON(); return json(route, capture); },
  });
  await v.shows('Carhartt Detroit');
  assert.equal(sent.purpose, 'find');
  assert.equal(sent.intent, 'find');
  assert.equal(await v.count('Finding matches', { exact: true }), 0);
  await v.shows('Photo matches');
  await v.page.close();
});

test('cancelled identification is terminal and never subscribes again', async () => {
  let streams = 0;
  const v = await open({ id: 'job_ui', item_id: 'it_ui', kind: 'identify', state: 'cancelled' }, {
    '/v1/jobs/job_ui/events': route => { streams++; return json(route, {}); },
  });
  await v.shows('Cancelled');
  assert.equal(streams, 0);
  await v.page.close();
});

test('proposed identity is selected and its evidence is visible before confirming', async () => {
  const question = { id: 'brand', field: 'brand', kind: 'pick_one', words: 'Which brand?', required_by: [], other: false,
    options: [{ value: 'Carhartt', label: 'Carhartt', proposed: true, rests_on: ['RN 14806 on the tag'] }, { value: 'Other', label: 'Other', proposed: false }] };
  const v = await app.open('/camera?mode=find', { api: { ...auth, '/v1/captures': { ...capture, plan: { ...capture.plan, status: 'asking', questions: [question] } } } });
  await v.tap('capture-questions');
  assert.equal(await v.page.getByTestId('capture-brand-0').locator('[data-part="chip"]').getAttribute('data-picked'), 'true');
  await v.shows('RN 14806 on the tag');
  if (process.env.CAPTURE_SCREENSHOT) await v.page.waitForTimeout(700);
  if (process.env.CAPTURE_SCREENSHOT) await v.page.screenshot({ path: process.env.CAPTURE_SCREENSHOT });
  await v.page.close();
});

test('library photo uploads through Find and the completed job renders its returned matches', async () => {
  let uploaded = false, streamed = false, payload;
  const photoPlan = { ...capture, plan: { ...capture.plan, status: 'framing', process: [{ key: 'front', step: 'front', role: 'front', state: 'pending' }] } };
  const job = { id: 'job_ui', item_id: 'it_ui', kind: 'identify', state: 'running' };
  const v = await app.open('/buy', { api: { ...auth,
    '/v1/captures': photoPlan,
    '/v1/captures/cap_ui/photos': route => { payload = route.request().postDataJSON(); return json(route, { capture, photos: [{ id: 'photo_ui', upload: { method: 'PUT', url: `${app.url}/ui-photo-upload` } }] }); },
    '/ui-photo-upload': route => { uploaded = route.request().method() === 'PUT' && route.request().postDataBuffer().length > 0; return route.fulfill({ status: 204 }); },
    '/v1/captures/cap_ui': route => { assert.ok(uploaded); return json(route, capture); },
    '/v1/captures/cap_ui/finish': { jobs: [job] },
    '/v1/jobs/job_ui': route => json(route, streamed ? { ...job, state: 'done', result: { candidates: [{ brand: 'Carhartt', model: 'Detroit' }] } } : job),
    '/v1/jobs/job_ui/events': route => { streamed = true; return route.fulfill({ contentType: 'text/event-stream', body: 'id: 1\nevent: job.state\ndata: {"state":"done"}\n\n' }); },
  } });
  await v.tap('buy-search-camera');
  await v.page.waitForURL('**/camera?mode=find');
  const chooser = v.page.waitForEvent('filechooser');
  await v.tap('camera-library');
  await (await chooser).setFiles(new URL('../assets/demo-items/carhartt-jacket.jpg', import.meta.url).pathname);
  await v.tap('cam-done');
  await v.shows('Carhartt Detroit');
  assert.ok(uploaded && streamed);
  assert.equal(payload.photos[0].step, 'front');
  assert.equal(payload.photos[0].content_type, 'image/jpeg');
  assert.equal(await v.count('Use your camera', { exact: true }), 0);
  assert.equal(await v.count('Finding matches', { exact: true }), 0);
  await v.shows('Back to Buy');
  if (process.env.CAPTURE_SCREENSHOT) await v.page.waitForTimeout(700);
  if (process.env.CAPTURE_SCREENSHOT) await v.page.screenshot({ path: process.env.CAPTURE_SCREENSHOT.replace('.png', '-results.png') });
  await v.page.setViewportSize({ width: 320, height: 720 });
  assert.ok(await v.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await v.tap('capture-messages');
  await v.page.waitForURL('**/buy');
  assert.equal(v.path(), '/buy');
  await v.page.close();
});

for (const [state, result, expected] of [
  ['done', { candidates: [] }, 'No matching items were returned.'],
  ['failed', undefined, 'This step failed.'],
]) test(`Find handles ${state} without inventing matches`, async () => {
  const v = await open({ id: 'job_ui', item_id: 'it_ui', kind: 'identify', state, result });
  await v.shows(expected);
  await v.page.close();
});

test('a failed terminal refresh can be retried without hiding recovered results', async () => {
  let reads = 0;
  const job = { id: 'job_ui', item_id: 'it_ui', kind: 'identify', state: 'running' };
  const v = await open(job, {
    '/v1/jobs/job_ui': route => {
      reads++;
      if (reads === 1) return json(route, job);
      if (reads === 2) return route.fulfill({ status: 503, json: { code: 'unavailable', message: 'Could not load matches.' } });
      return json(route, { ...job, state: 'done', result: { set: [{ brand: 'Carhartt', model: 'Detroit' }] } });
    },
    '/v1/jobs/job_ui/events': route => route.fulfill({ contentType: 'text/event-stream', body: 'id: 1\nevent: job.state\ndata: {"state":"done"}\n\n' }),
  });
  await v.shows('Could not load matches.');
  await v.tap('capture-results-refresh');
  await v.shows('Carhartt Detroit');
  assert.equal(await v.count('Could not load matches.', { exact: true }), 0);
  assert.equal(reads, 3);
  await v.page.close();
});
