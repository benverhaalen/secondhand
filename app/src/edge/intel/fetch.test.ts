import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFetcher, detectBlock, Semaphore, type Clock, type Renderer } from './fetch.ts';

const tick = () => new Promise<void>(r => setImmediate(r));
// A clock that never really sleeps: timers fire in order when `drive` sees every promise chain has gone quiet.
function fakeClock() {
  let t = 0; const timers: { at: number; res: () => void }[] = []; const sleeps: number[] = [];
  const clock: Clock = {
    now: () => t,
    sleep: (ms, signal) => new Promise<void>(res => {
      if (signal?.aborted) return res();
      sleeps.push(ms);
      const tm = { at: t + ms, res };
      timers.push(tm);
      signal?.addEventListener('abort', () => { const i = timers.indexOf(tm); if (i >= 0) timers.splice(i, 1); res(); }, { once: true });
    }),
  };
  async function drive<T>(p: Promise<T>): Promise<T> {
    let settled = false; void p.then(() => { settled = true; }, () => { settled = true; });
    for (let i = 0; !settled; i++) {
      await tick(); if (settled) break;
      timers.sort((a, b) => a.at - b.at);
      const x = timers.shift(); if (!x) { await tick(); if (!settled) throw new Error('stuck: nothing to wait for'); break; }
      t = Math.max(t, x.at); x.res();
      if (i > 5000) throw new Error('runaway');
    }
    return p;
  }
  return { clock, drive, sleeps, advanceTo: (n: number) => { t = n; } };
}
const page = (body: string, status = 200, headers: Record<string, string> = {}) => new Response(body, { status, headers });
const GOOD = '<html>{"@type":"Product","name":"Levi 501"}</html>';
const BARE = '<html><body>loading</body></html>';
const need = (h: string) => h.includes('"@type":"Product"');
const spyRenderer = (html = GOOD, status = 200) => {
  const r = { calls: [] as number[], aborted: false, render: async (_u: string, o: { deadline_ms: number; signal: AbortSignal }) => { r.calls.push(o.deadline_ms); o.signal.addEventListener('abort', () => { r.aborted = true; }); return { status, html, final_url: 'https://x.test/p' }; } };
  return r satisfies Renderer & { calls: number[] };
};
const hang = (signal?: AbortSignal | null) => new Promise<Response>((_, rej) => signal?.addEventListener('abort', () => rej(new Error('aborted')), { once: true }));
const url = 'https://shop.test/p/1';

test('no render when the plain fetch already returned the fields', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 }), r = spyRenderer();
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 8000, need, renderer: r, fetchImpl: async () => page(GOOD) }));
  assert.ok(out.ok && out.rung === 'plain');
  assert.equal(r.calls.length, 0);
});

test('a plain page without the fields starts the render rung and the render wins', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 }), r = spyRenderer();
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 8000, need, renderer: r, fetchImpl: async () => page(BARE) }));
  assert.ok(out.ok && out.rung === 'render' && out.html === GOOD);
  assert.equal(r.calls.length, 1);
  assert.deepEqual(out.searched.map(s => s.route_id.split(':')[0]).sort(), ['fetch.plain', 'fetch.render']);
});

test('hedge: a plain fetch past its p95 starts render in parallel; the first good one wins and the other is aborted', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0, params: { p95_ms: 1500 } }), r = spyRenderer();
  let plainSignal: AbortSignal | null | undefined;
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 8000, need, renderer: r, fetchImpl: async (_u, i) => { plainSignal = i?.signal; return hang(i?.signal); } }));
  assert.ok(out.ok && out.rung === 'render');
  assert.equal(out.ms, 1500, 'render started exactly at p95');
  assert.equal(plainSignal?.aborted, true);
});

test('hedge: a plain fetch that answers before its p95 never starts render', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 }), r = spyRenderer();
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 8000, need, renderer: r, fetchImpl: async () => page(GOOD) }));
  assert.ok(out.ok); assert.equal(r.calls.length, 0);
});

test('not_found: a page with no product fills searched[]', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 });
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 8000, need, fetchImpl: async () => page(BARE) }));
  assert.ok(!out.ok && out.kind === 'not_found');
  assert.equal(out.searched.length, 1);
  assert.deepEqual({ ...out.searched[0], ms: 0 }, { route_id: 'fetch.plain:shop.test', query: url, outcome: 'empty', ms: 0 });
});

test('not_found: a 404 is final and is not rendered', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 }), r = spyRenderer();
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 8000, need, renderer: r, fetchImpl: async () => page('nope', 404) }));
  assert.ok(!out.ok && out.kind === 'not_found' && out.status === 404 && out.searched.length === 1);
  assert.equal(r.calls.length, 0);
});

test('backoff: 503 without Retry-After doubles from 2 s, then gives up as timeout', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 });
  let n = 0;
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 1e7, fetchImpl: async () => { n++; return page('busy', 503); } }));
  assert.ok(!out.ok && out.kind === 'timeout');
  assert.equal(n, 4);
  assert.deepEqual(c.sleeps.filter(s => s !== 1e7), [2000, 4000, 8000]);
});

test('backoff: a 503 storm holds the 60 s ceiling, even for a Retry-After of 500 s', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0, params: { max_retries: 6 } });
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 1e7, fetchImpl: async () => page('busy', 503, { 'retry-after': '500' }) }));
  assert.ok(!out.ok && out.kind === 'timeout');
  const waits = c.sleeps.filter(s => s !== 1e7);
  assert.ok(waits.length >= 6 && waits.every(s => s <= 60_000), `waits ${waits}`);
  assert.equal(Math.max(...waits), 60_000);
});

test('backoff: a 429 whose Retry-After would pass the deadline returns at once, without sleeping', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 });
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 5000, fetchImpl: async () => page('slow down', 429, { 'retry-after': '30' }) }));
  assert.ok(!out.ok && out.kind === 'timeout');
  assert.match(out.reason, /deadline/);
  assert.deepEqual(c.sleeps.filter(s => s !== 5000), []);
});

test('backoff: a 429 then a 200 recovers', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 });
  let n = 0;
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 60_000, need, fetchImpl: async () => (n++ ? page(GOOD) : page('', 429, { 'retry-after': '3' })) }));
  assert.ok(out.ok && out.html === GOOD);
});

test('block: 403 is blocked, recorded once, not retried and not rendered around', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 }), r = spyRenderer();
  let n = 0;
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 8000, need, renderer: r, fetchImpl: async () => { n++; return page('Access Denied', 403); } }));
  assert.ok(!out.ok && out.kind === 'blocked' && out.searched[0]?.outcome === 'blocked');
  assert.equal(n, 1); assert.equal(r.calls.length, 0);
});

test('block: a 429 with a captcha marker is blocked, not backed off', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 });
  let n = 0;
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 8000, fetchImpl: async () => { n++; return page('<h1>Please complete the CAPTCHA</h1>', 429); } }));
  assert.ok(!out.ok && out.kind === 'blocked'); assert.equal(n, 1);
  assert.equal(detectBlock(200, '<html>' + 'x'.repeat(20_000) + ' captcha</html>'), false, 'a long real page that mentions captcha is not a block');
  assert.equal(detectBlock(200, '<title>Just a moment...</title>'), true);
});

test('block: a rendered bot-check page is blocked too', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 });
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 8000, need, renderer: spyRenderer('<title>Just a moment...</title>'), fetchImpl: async () => page(BARE) }));
  assert.ok(!out.ok && out.kind === 'blocked');
});

test('a failing renderer after a bare plain page is not_found; a dead network with no render is a timeout', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 });
  const bad: Renderer = { render: async () => { throw new Error('browser crashed'); } };
  const a = await c.drive(f.fetchPage(url, { deadline_ms: 8000, need, renderer: bad, fetchImpl: async () => page(BARE) }));
  assert.ok(!a.ok && a.kind === 'not_found');
  const b = await c.drive(f.fetchPage('https://other.test/', { deadline_ms: 8000, fetchImpl: async () => { throw new Error('ECONNRESET'); } }));
  assert.ok(!b.ok && b.kind === 'timeout' && b.searched[0]?.outcome === 'timeout');
});

test('deadline: a plain fetch that never answers ends as timeout at the deadline', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 });
  const out = await c.drive(f.fetchPage(url, { deadline_ms: 3000, fetchImpl: async (_u, i) => hang(i?.signal) }));
  assert.ok(!out.ok && out.kind === 'timeout' && out.ms === 3000);
});

test('per-domain spacing: two requests to one domain are 1 to 3 s apart, two domains are not', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0.5 });
  const at: Record<string, number[]> = {};
  const fetchImpl: typeof fetch = async u => { (at[new URL(String(u)).host] ??= []).push(c.clock.now()); return page(GOOD); };
  await c.drive(Promise.all([
    f.fetchPage('https://a.test/1', { deadline_ms: 20_000, fetchImpl }), f.fetchPage('https://a.test/2', { deadline_ms: 20_000, fetchImpl }),
    f.fetchPage('https://b.test/1', { deadline_ms: 20_000, fetchImpl }),
  ]));
  assert.deepEqual(at['a.test'], [0, 2000]); assert.deepEqual(at['b.test'], [0]);
});

test('304: a revalidated page returns the cached page', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0 });
  const seen: Array<Record<string, string>> = [];
  const fetchImpl: typeof fetch = async (_u, i) => {
    seen.push((i?.headers ?? {}) as Record<string, string>);
    return seen.length === 1 ? page(GOOD, 200, { etag: '"v1"', 'last-modified': 'Sat, 01 Nov 2026 00:00:00 GMT' }) : new Response(null, { status: 304 });
  };
  const first = await c.drive(f.fetchPage(url, { deadline_ms: 20_000, need, fetchImpl }));
  const second = await c.drive(f.fetchPage(url, { deadline_ms: 20_000, need, fetchImpl }));
  assert.ok(first.ok && first.etag === '"v1"' && !first.cached);
  assert.equal(seen[1]?.['if-none-match'], '"v1"'); assert.ok(seen[1]?.['if-modified-since']);
  assert.ok(second.ok && second.cached === true && second.html === GOOD && second.status === 200);
});

test('priority: a person goes before a refresh; a job waiting 30 s moves up one class so none starves', async () => {
  let t = 0; const order: string[] = [];
  const s = new Semaphore(1, () => t, 30_000);
  const hold = await s.acquire('person');
  const wait = (p: 'person' | 'gather' | 'refresh', name: string) => void s.acquire(p).then(rel => { order.push(name); rel(); });
  wait('refresh', 'refresh@0'); t = 1000; wait('person', 'person@1s');
  hold(); await tick();
  assert.deepEqual(order, ['person@1s', 'refresh@0']);

  order.length = 0; t = 0;
  const s2 = new Semaphore(1, () => t, 30_000), h2 = await s2.acquire('person');
  const w2 = (p: 'person' | 'gather' | 'refresh', name: string) => void s2.acquire(p).then(rel => { order.push(name); rel(); });
  w2('refresh', 'refresh@0'); t = 60_000; w2('person', 'person@60s'); w2('gather', 'gather@60s');
  h2(); await tick();
  assert.deepEqual(order, ['refresh@0', 'person@60s', 'gather@60s'], 'after 60 s the refresh has risen two classes and was first in line');
});

test('semaphore per route: no more than the route allows run at once', async () => {
  const c = fakeClock(), f = createFetcher({ clock: c.clock, random: () => 0, params: { base_delay_ms: [0, 0], route_concurrency: { plain: 2, render: 1 } } });
  let live = 0, peak = 0;
  const fetchImpl: typeof fetch = async () => { live++; peak = Math.max(peak, live); await tick(); await tick(); live--; return page(GOOD); };
  await c.drive(Promise.all([1, 2, 3, 4, 5].map(i => f.fetchPage(`https://s.test/${i}`, { deadline_ms: 8000, fetchImpl }))));
  assert.equal(peak, 2);
});
