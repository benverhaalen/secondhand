import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DOMParser } from '@xmldom/xmldom';
import { ebayListingSpec } from './sites/ebay/adapter.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import type { Launcher, PoolContext } from '../browser/pool.ts';
import { publicClients, type PublicPage } from './public-client.ts';
import { API, WWW } from './sites/depop/adapter.ts';

function isolatedDocument(html: string): Document {
  const dom = new DOMParser().parseFromString(/<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`, 'text/html');
  type Node = Element;
  const matches = (node: Node, selectors: string): boolean => selectors.split(',').some(selector => {
    const s = selector.trim(), tag = s.match(/^[\w-]+/)?.[0];
    if (tag && node.tagName !== tag) return false;
    if ([...s.matchAll(/\.([\w-]+)/g)].some(m => !(node.getAttribute('class') ?? '').split(/\s+/).includes(m[1]!))) return false;
    return [...s.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(m => node.hasAttribute(m[1]!) && (m[2] === undefined || node.getAttribute(m[1]!) === m[2]));
  });
  const wrap = (node: Node): unknown => Object.freeze({
    textContent: node.textContent, getAttribute: (name: string) => node.hasAttribute(name) ? node.getAttribute(name) : null,
    matches: (s: string) => matches(node, s),
    querySelectorAll: (s: string) => Array.from(node.getElementsByTagName('*')).filter(n => matches(n, s)).map(wrap),
    querySelector: (s: string) => Array.from(node.getElementsByTagName('*')).filter(n => matches(n, s)).map(wrap)[0] ?? null,
  });
  return Object.freeze({
    title: dom.getElementsByTagName('title')[0]?.textContent ?? '', documentElement: { outerHTML: html },
    querySelectorAll: (s: string) => Array.from(dom.getElementsByTagName('*')).filter(n => matches(n, s)).map(wrap),
    querySelector: (s: string) => Array.from(dom.getElementsByTagName('*')).filter(n => matches(n, s)).map(wrap)[0] ?? null,
  }) as unknown as Document;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const signal = () => new AbortController().signal;
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
const ebayUrl = 'https://www.ebay.com/sch/i.html?_nkw=synthetic-query';
const depopUrl = `${WWW}/search/?q=synthetic-query`;

class FakePage implements PublicPage {
  html = '<html>synthetic page bytes</html>';
  status = 200;
  routes = 0;
  interceptions = 0;
  navigations: { url: string; timeout: number; waitUntil: string }[] = [];
  waits: number[] = [];
  selectors: { selector: string; timeout: number; state: string }[] = [];
  selectorNext?: () => Promise<void>;
  evaluateNext?: () => unknown;
  contentReads = 0;
  events = new Map<string, Set<() => void>>();
  gotoNext?: () => Promise<void>;
  contentNext?: () => Promise<void>;
  evaluated: string[] = [];
  fetches: { url: string; init?: RequestInit }[] = [];
  async goto(url: string, options: { waitUntil: 'domcontentloaded'; timeout: number }) {
    this.navigations.push({ url, ...options });
    await this.gotoNext?.();
    return { status: () => this.status };
  }
  async content() { this.contentReads++; await this.contentNext?.(); return this.html; }
  async waitForSelector(selector: string, options: { timeout: number; state: 'attached' }) { this.selectors.push({ selector, ...options }); await this.selectorNext?.(); }
  async waitForTimeout(ms: number) { this.waits.push(ms); }
  async evaluate<T, A>(fn: string | ((arg: A) => T | Promise<T>), arg: A): Promise<T> {
    this.evaluated.push(String(arg));
    if (this.evaluateNext) return this.evaluateNext() as T;
    if (typeof fn === 'string' || typeof arg === 'object') return runInNewContext(typeof fn === 'string' ? fn : `(${fn.toString()})(input)`, { input: arg, document: isolatedDocument(this.html), URL }) as T;
    // Execute the actual in-page function, so endpoint, credentials and headers are tested.
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      this.fetches.push({ url: String(input), init });
      return new Response(this.status === 200 ? '{"objects":[]}' : null, { status: this.status });
    };
    try { return await fn(arg); } finally { globalThis.fetch = original; }
  }
  on(event: 'close' | 'crash', fn: () => void) {
    const listeners = this.events.get(event) ?? new Set<() => void>();
    listeners.add(fn); this.events.set(event, listeners);
  }
  off(event: 'close' | 'crash', fn: () => void) { this.events.get(event)?.delete(fn); }
  emit(event: 'close' | 'crash') { for (const fn of this.events.get(event) ?? []) fn(); }
  async close() { this.emit('close'); }
  async route() { this.routes++; }
  async setRequestInterception() { this.interceptions++; }
}
class FakeContext implements PoolContext<FakePage> {
  page = new FakePage();
  closes = 0;
  pages = 0;
  listeners: (() => void)[] = [];
  async newPage() { this.pages++; return this.page; }
  onClose(fn: () => void) { this.listeners.push(fn); }
  async close() { this.closes++; this.disconnect(); }
  disconnect() { for (const fn of this.listeners) fn(); }
}
function setup(options: { idleMs?: number; timeoutMs?: number; now?: () => number } = {}) {
  const contexts: FakeContext[] = [], sink = memorySink();
  let launchNext: (() => Promise<void>) | undefined;
  const launcher: Launcher<FakePage> = {
    async persistent() { throw new Error('anonymous clients must never load a profile'); },
    async anonymous(options) {
      assert.deepEqual(options, { headless: true });
      const context = new FakeContext(); contexts.push(context);
      await launchNext?.(); return context;
    },
  };
  const log = createLog({ src: 'public-client.test', build: 'test', sink });
  const clients = publicClients({ launcher, log, ...options });
  return { clients, contexts, sink, launchWith(fn: () => Promise<void>) { launchNext = fn; } };
}
function ends(sink: ReturnType<typeof memorySink>): Record<string, unknown>[] {
  return sink.lines.map(line => JSON.parse(line) as Record<string, unknown>).filter(line => line.event === 'call.end');
}

test('lazy anonymous clients reuse one context and page per site, logging cold then warm', async () => {
  let clock = 10;
  const f = setup({ now: () => clock++ });
  assert.equal(f.clients.ebay.signed_in, false); assert.equal(f.clients.depop.signed_in, false);
  assert.equal(f.contexts.length, 0);
  try {
    await f.clients.ebay.page(ebayUrl, signal()); await f.clients.ebay.page(ebayUrl, signal());
    await f.clients.depop.doc(depopUrl, signal()); await f.clients.depop.doc(depopUrl, signal());
    assert.equal(f.contexts.length, 2);
    assert.deepEqual(f.contexts.map(c => c.pages), [1, 1]);
    assert.deepEqual(f.contexts.map(c => c.listeners.length), [1, 1]);
    assert.deepEqual(ends(f.sink).map(e => e.warm), [false, true, false, true]);
    for (const e of ends(f.sink)) {
      assert.ok(['ebay', 'depop'].includes(String(e.site)));
      assert.equal(e.status, 200); assert.equal(typeof e.ms, 'number');
      assert.ok(Number((e.result as Record<string, unknown>).ms) > 0); assert.ok(String(e.origin).startsWith('https://www.'));
      assert.ok(String(e.path).startsWith('/'));
    }
    assert.deepEqual(f.contexts[0].page.waits, []);
    assert.equal(f.contexts[0].page.selectors.length, 2);
    for (const wait of f.contexts[0].page.selectors) { assert.equal(wait.timeout, 1500); assert.equal(wait.state, 'attached'); assert.match(wait.selector, /li\.s-card/); assert.match(wait.selector, /srp-save-null-search/); }
    assert.deepEqual(f.contexts[1].page.waits, []);
  } finally { await f.clients.close(); }
});

test('one site runs in FIFO order while the other site can finish', async () => {
  const f = setup(), hold = deferred<void>();
  try {
    await f.clients.ebay.page(ebayUrl, signal());
    const page = f.contexts[0].page; page.gotoNext = () => hold.promise;
    const first = f.clients.ebay.page('https://www.ebay.com/itm/1', signal());
    const second = f.clients.ebay.page('https://www.ebay.com/itm/2', signal());
    await f.clients.depop.doc(depopUrl, signal());
    assert.equal(page.navigations.length, 2);
    hold.resolve(); await Promise.all([first, second]);
    assert.deepEqual(page.navigations.map(n => new URL(n.url).pathname), ['/sch/i.html', '/itm/1', '/itm/2']);
  } finally { hold.resolve(); await f.clients.close(); }
});

for (const event of ['disconnect', 'close', 'crash', 'navigation', 'content'] as const) {
  test(`a ${event} failure drops the context; the next read launches once without replay`, async () => {
    const f = setup();
    try {
      await f.clients.ebay.page(ebayUrl, signal());
      const c = f.contexts[0];
      if (event === 'disconnect') c.disconnect();
      else if (event === 'close' || event === 'crash') c.page.emit(event);
      else {
        const fail = async () => { throw new Error('failed https://www.ebay.com/private?q=do-not-log'); };
        if (event === 'navigation') c.page.gotoNext = fail; else c.page.contentNext = fail;
        await assert.rejects(f.clients.ebay.page(ebayUrl, signal()));
        assert.equal(c.page.navigations.length, 2);
        assert.equal(f.contexts.length, 1);
      }
      await f.clients.ebay.page(ebayUrl, signal());
      assert.equal(f.contexts.length, 2);
      assert.equal(ends(f.sink).at(-1)?.warm, false);
      assert.ok(!f.sink.text().includes('do-not-log'));
    } finally { await f.clients.close(); }
  });
}

test('idle expiry closes without another read, resets after use and never closes an active read', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup({ idleMs: 100 }), hold = deferred<void>();
  try {
    await f.clients.depop.doc(depopUrl, signal());
    t.mock.timers.tick(99); await turn(); assert.equal(f.contexts[0].closes, 0);
    await f.clients.depop.doc(depopUrl, signal());
    t.mock.timers.tick(99); await turn(); assert.equal(f.contexts[0].closes, 0);
    f.contexts[0].page.gotoNext = () => hold.promise;
    const read = f.clients.depop.doc(depopUrl, signal()); await turn();
    t.mock.timers.tick(101); await turn(); assert.equal(f.contexts[0].closes, 0);
    hold.resolve(); await read;
    t.mock.timers.tick(100); await turn(); assert.equal(f.contexts[0].closes, 1);
    await f.clients.depop.doc(depopUrl, signal()); assert.equal(f.contexts.length, 2);
  } finally { hold.resolve(); await f.clients.close(); }
});

test('the default idle limit is 120000 ms and close is terminal and idempotent', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup();
  await f.clients.ebay.page(ebayUrl, signal());
  t.mock.timers.tick(119999); await turn(); assert.equal(f.contexts[0].closes, 0);
  t.mock.timers.tick(1); await turn(); assert.equal(f.contexts[0].closes, 1);
  await f.clients.depop.doc(depopUrl, signal());
  await Promise.all([f.clients.close(), f.clients.close()]); await f.clients.close();
  assert.deepEqual(f.contexts.map(c => c.closes), [1, 1]);
  await assert.rejects(f.clients.ebay.page(ebayUrl, signal()), /closed/i);
  assert.equal(f.contexts.length, 2);
});

test('abort stops navigation, drops its context and lets the queue continue', async () => {
  const f = setup(), hold = deferred<void>(), ctl = new AbortController();
  try {
    await f.clients.depop.doc(depopUrl, signal());
    f.contexts[0].page.gotoNext = () => hold.promise;
    const read = f.clients.depop.doc(depopUrl, ctl.signal); await turn();
    ctl.abort(new Error('private abort detail?do-not-log'));
    await assert.rejects(read, { name: 'AbortError' });
    await f.clients.depop.doc(depopUrl, signal());
    assert.equal(f.contexts.length, 2); assert.equal(f.contexts[0].closes, 1);
    assert.ok(!f.sink.text().includes('do-not-log'));
  } finally { hold.resolve(); await f.clients.close(); }
});

test('an aborted queued read returns immediately without interrupting the active read', async () => {
  const f = setup(), hold = deferred<void>(), ctl = new AbortController();
  try {
    await f.clients.depop.doc(depopUrl, signal());
    f.contexts[0].page.gotoNext = () => hold.promise;
    const active = f.clients.depop.doc(depopUrl, signal()); await turn();
    const queued = f.clients.depop.doc(depopUrl, ctl.signal); ctl.abort();
    await assert.rejects(queued, { name: 'AbortError' });
    assert.equal(f.contexts[0].closes, 0);
    hold.resolve(); await active; await turn();
    assert.equal(f.contexts[0].page.navigations.length, 2);
  } finally { hold.resolve(); await f.clients.close(); }
});

test('a pre-aborted read launches nothing', async () => {
  const f = setup(), ctl = new AbortController(); ctl.abort();
  await assert.rejects(f.clients.ebay.page(ebayUrl, ctl.signal), { name: 'AbortError' });
  assert.equal(f.contexts.length, 0); await f.clients.close();
});

test('abort during launch closes the late context before another can open', async () => {
  const f = setup(), launch = deferred<void>(), ctl = new AbortController();
  f.launchWith(() => launch.promise);
  const read = f.clients.ebay.page(ebayUrl, ctl.signal); await turn(); ctl.abort();
  await assert.rejects(read, { name: 'AbortError' });
  const next = f.clients.ebay.page(ebayUrl, signal()); await turn();
  assert.equal(f.contexts.length, 1);
  launch.resolve(); await next;
  assert.equal(f.contexts[0].closes, 1); assert.equal(f.contexts[0].pages, 0);
  assert.equal(f.contexts.length, 2); await f.clients.close();
});

test('default deadline is 30000 ms, reported as TimeoutError rather than rate limiting', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup(), hold = deferred<void>();
  try {
    await f.clients.depop.doc(depopUrl, signal()); f.contexts[0].page.gotoNext = () => hold.promise;
    const read = f.clients.depop.doc(depopUrl, signal());
    const rejected = assert.rejects(read, { name: 'TimeoutError' }); await turn();
    t.mock.timers.tick(29999); await turn(); assert.equal(f.contexts[0].closes, 0);
    t.mock.timers.tick(1); await rejected;
    assert.equal(f.contexts[0].closes, 1);
    assert.equal(ends(f.sink).at(-1)?.status, 0);
    assert.ok(!f.sink.text().includes('rate_limited'));
    await f.clients.depop.doc(depopUrl, signal()); assert.equal(f.contexts.length, 2);
  } finally { hold.resolve(); await f.clients.close(); }
});

test('a custom deadline covers HTML and in-page JSON, not just navigation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup({ timeoutMs: 25 }), hold = deferred<void>();
  try {
    await f.clients.depop.doc(depopUrl, signal());
    f.contexts[0].page.contentNext = () => hold.promise;
    const doc = f.clients.depop.doc(depopUrl, signal()); const badDoc = assert.rejects(doc, { name: 'TimeoutError' });
    await turn(); t.mock.timers.tick(25); await badDoc;
    await f.clients.depop.doc(depopUrl, signal());
    f.contexts[1].page.evaluate = async () => hold.promise as Promise<never>;
    const json = f.clients.depop.json('/presentation/api/v1/test/', signal());
    const badJson = assert.rejects(json, { name: 'TimeoutError' }); await turn(); t.mock.timers.tick(25); await badJson;
    assert.deepEqual(f.contexts.map(c => c.closes), [1, 1]);
  } finally { hold.resolve(); await f.clients.close(); }
});

test('closing during a read stops it and closes each browser exactly once', async () => {
  const f = setup(), hold = deferred<void>();
  await f.clients.depop.doc(depopUrl, signal()); f.contexts[0].page.gotoNext = () => hold.promise;
  const read = f.clients.depop.doc(depopUrl, signal());
  const rejected = assert.rejects(read, /closed/i); await turn();
  await f.clients.close(); await rejected; await f.clients.close();
  assert.equal(f.contexts[0].closes, 1); hold.resolve();
});

test('neither site intercepts requests and challenges or sign-in HTML pass through unchanged', async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal()); await f.clients.depop.doc(depopUrl, signal());
    for (const html of ['<title>Just a moment</title>captcha', '<title>Sign in or Register</title>']) {
      for (const c of f.contexts) { c.page.html = html; c.page.status = 403; }
      assert.deepEqual(await f.clients.ebay.page(ebayUrl, signal()), { status: 403, html });
      assert.deepEqual(await f.clients.depop.doc(depopUrl, signal()), { status: 403, html, challenge: /captcha/i.test(html) });
    }
    for (const c of f.contexts) { assert.equal(c.page.routes, 0); assert.equal(c.page.interceptions, 0); }
    assert.equal(f.contexts.length, 2);
  } finally { await f.clients.close(); }
});

test('Depop JSON fetches the same API from the open page with credentials omitted and no added headers', async () => {
  const f = setup();
  try {
    await f.clients.depop.doc(depopUrl, signal());
    const path = '/presentation/api/v1/products/?limit=24';
    assert.deepEqual(await f.clients.depop.json(path, signal()), { status: 200, body: { objects: [] } });
    const p = f.contexts[0].page; p.status = 403;
    assert.deepEqual(await f.clients.depop.json(path, signal()), { status: 403, body: null });
    assert.equal(p.navigations.length, 1);
    assert.deepEqual(p.fetches, [{ url: API + path, init: { credentials: 'omit' } }, { url: API + path, init: { credentials: 'omit' } }]);
    assert.equal(p.routes, 0); assert.equal(p.interceptions, 0);
  } finally { await f.clients.close(); }
});

test('a JSON-first Depop read establishes the site origin once', async () => {
  const f = setup();
  try {
    await f.clients.depop.json('/presentation/api/v1/products/', signal());
    await f.clients.depop.json('/presentation/api/v1/products/', signal());
    assert.deepEqual(f.contexts[0].page.navigations.map(n => new URL(n.url).origin), [WWW]);
    assert.equal(f.contexts[0].page.routes, 0); assert.equal(f.contexts[0].page.interceptions, 0);
  } finally { await f.clients.close(); }
});

test('all read logs exclude queries, fragments, HTML, JSON and raw browser errors', async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl + '#synthetic-fragment', signal());
    await f.clients.depop.doc(depopUrl, signal());
    await f.clients.depop.json('/presentation/api/v1/products/?q=synthetic-query', signal());
    f.contexts[1].page.gotoNext = async () => { throw new Error('navigation https://www.depop.com/?q=synthetic-query synthetic page bytes'); };
    await assert.rejects(f.clients.depop.doc(depopUrl, signal()));
    const logs = f.sink.text();
    for (const value of ['synthetic-query', 'synthetic-fragment', 'synthetic page bytes', 'objects', '?', '#']) assert.ok(!logs.includes(value), value);
    assert.equal(ends(f.sink).length, 4);
    assert.deepEqual(ends(f.sink).map(e => e.path), ['/sch/i.html', '/search/', '/presentation/api/v1/products/', '/search/']);
  } finally { await f.clients.close(); }
});

for (const event of ['disconnect', 'close', 'crash'] as const) {
  test(`an active Depop read fails promptly on ${event} and the next read opens once`, async () => {
    const f = setup(), hold = deferred<void>();
    try {
      await f.clients.depop.doc(depopUrl, signal());
      const c = f.contexts[0]; c.page.gotoNext = () => hold.promise;
      const read = f.clients.depop.doc(depopUrl, signal());
      const rejected = assert.rejects(read, /browser read failed/); await turn();
      if (event === 'disconnect') c.disconnect(); else c.page.emit(event);
      await rejected;
      await f.clients.depop.doc(depopUrl, signal());
      assert.equal(f.contexts.length, 2);
      assert.equal(c.page.navigations.length, 2);
    } finally { hold.resolve(); await f.clients.close(); }
  });
}

test('close waits for a pending launch and stops it without opening a page', async () => {
  const f = setup(), launch = deferred<void>(); f.launchWith(() => launch.promise);
  const read = f.clients.ebay.page(ebayUrl, signal());
  const rejected = assert.rejects(read, /closed/); await turn();
  const closed = f.clients.close(); await rejected;
  assert.equal(f.contexts.length, 1);
  launch.resolve(); await closed; await f.clients.close();
  assert.equal(f.contexts[0].closes, 1); assert.equal(f.contexts[0].pages, 0);
});

test('a failed browser launch is reported once and does not poison later reads', async () => {
  const f = setup();
  f.launchWith(async () => { throw new Error('provider failed?do-not-log'); });
  await assert.rejects(f.clients.ebay.page(ebayUrl, signal()), /browser read failed/);
  assert.equal(f.contexts.length, 1);
  f.launchWith(async () => {});
  await f.clients.ebay.page(ebayUrl, signal());
  assert.equal(f.contexts.length, 2);
  assert.ok(!f.sink.text().includes('do-not-log'));
  await f.clients.close();
});

test('a navigation TimeoutError stays a timeout and never becomes a rate limit', async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal());
    f.contexts[0].page.gotoNext = async () => { const error = new Error('timeout at ?private-query'); error.name = 'TimeoutError'; throw error; };
    await assert.rejects(f.clients.ebay.page(ebayUrl, signal()), { name: 'TimeoutError', code: 'timeout' });
    assert.equal((ends(f.sink).at(-1)?.result as Record<string, unknown>).code, 'timeout');
    assert.ok(!f.sink.text().includes('private-query'));
  } finally { await f.clients.close(); }
});

test('a rejected idle close remains visible to shutdown and never opens an overlapping browser', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup({ idleMs: 20 });
  await f.clients.depop.doc(depopUrl, signal());
  f.contexts[0].close = async () => { throw new Error('close failed ?private-query'); };
  t.mock.timers.tick(20); await turn();
  assert.ok(f.sink.text().includes('anonymous browser close failed'));
  await assert.rejects(f.clients.depop.doc(depopUrl, signal()));
  assert.equal(f.contexts.length, 1);
  await assert.rejects(f.clients.close());
  assert.ok(!f.sink.text().includes('private-query'));
});

const recorded = readFileSync(new URL('./sites/ebay/fixtures/page-search.html', import.meta.url), 'utf8');

test('eBay returns compact rows from the isolated page and logs pinned fixture sizes in each lane', async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal());
    const p = f.contexts[0].page; p.html = recorded; p.contentReads = 0;
    const compact = await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), { tokens: ['501'], narrow: false });
    assert.ok(!('html' in compact));
    assert.deepEqual([compact.status, compact.rows.length, compact.total, compact.dropped, compact.facts, compact.narrowed_out], [200, 3, 3, 0, 48, 0]);
    assert.ok(compact.rows.every(row => row.name_match === 'all'));
    assert.equal(p.contentReads, 0);
    assert.equal(ends(f.sink).at(-1)?.parsed, 'page');
    assert.equal(ends(f.sink).at(-1)?.bytes_out, 1283);
    assert.equal(Buffer.byteLength(JSON.stringify(compact.rows)), 1283);
    const legacy = await f.clients.ebay.page(ebayUrl, signal());
    assert.equal(legacy.html, recorded);
    assert.equal(ends(f.sink).at(-1)?.parsed, 'server');
    assert.equal(ends(f.sink).at(-1)?.bytes_out, 13447);
    assert.equal(Buffer.byteLength(recorded), 13447);
    assert.equal(p.routes, 0); assert.equal(p.interceptions, 0); assert.equal(p.fetches.length, 0);
  } finally { await f.clients.close(); }
});

for (const fault of ['throw', 'null', 'bad_rows', 'bad_counts', 'extra_html', 'zero'] as const) test(`eBay ${fault} evaluation uses HTML fallback and records why without raw errors`, async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal());
    const p = f.contexts[0].page; p.html = recorded;
    const empty = { rows: [], dropped: 0, total: 0, facts: 0, narrowed_out: 0 };
    let evaluations = 0;
    const evaluate = p.evaluate.bind(p);
    p.evaluate = async (fn, arg) => {
      if (++evaluations === 1) return evaluate(fn, arg); // page state is checked before parsing
      if (fault === 'throw') throw new Error('private-query https://vendor.invalid/secret');
      return (fault === 'null' ? null : fault === 'bad_rows' ? { ...empty, total: 1, rows: [{ item_id: '1' }] } : fault === 'bad_counts' ? { ...empty, total: -1 } : fault === 'extra_html' ? { ...empty, html: 'page bytes' } : empty) as never;
    };
    assert.deepEqual(await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {}), { status: 200, html: recorded });
    const line = ends(f.sink).at(-1)!;
    assert.equal(line.parsed, 'server'); assert.equal(line.fallback, fault === 'throw' ? 'evaluation' : fault === 'zero' ? 'zero_cards' : 'shape');
    assert.equal(line.bytes_out, Buffer.byteLength(recorded));
    assert.doesNotMatch(f.sink.text(), /private-query|vendor.invalid/);
  } finally { await f.clients.close(); }
});

for (const file of ['page-empty.html', 'page-sold-signin.html'] as const) test(`eBay ${file} is detected before parsing`, async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal());
    const p = f.contexts[0].page; p.html = readFileSync(new URL(`./sites/ebay/fixtures/${file}`, import.meta.url), 'utf8'); p.contentReads = 0;
    const result = await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {});
    if (file === 'page-empty.html') { assert.ok(!('html' in result)); assert.equal(result.total, 0); assert.equal(p.contentReads, 0); assert.equal(ends(f.sink).at(-1)?.parsed, 'page'); }
    else assert.deepEqual(result, { status: 200, html: p.html });
  } finally { await f.clients.close(); }
});

for (const html of ['<title>Pardon Our Interruption...</title>', '<title>Search</title><p>captcha</p>', '<title>Error Page | eBay</title>', '<title>Something changed</title>']) test(`eBay passes page state through as HTML: ${html}`, async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal()); const p = f.contexts[0].page; p.html = html;
    const before = p.evaluated.length;
    assert.deepEqual(await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {}), { status: 200, html });
    assert.equal(p.evaluated.length - before, 1);
  } finally { await f.clients.close(); }
});

test('readiness timeout is a capped wait, not a failed read; other readiness errors remain visible', async () => {
  const f = setup({ now: () => 0 });
  try {
    await f.clients.ebay.page(ebayUrl, signal()); const p = f.contexts[0].page; p.html = recorded;
    p.selectorNext = async () => { const e = new Error('private-query'); e.name = 'TimeoutError'; throw e; };
    const result = await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {});
    assert.ok(!('html' in result)); assert.equal(result.rows.length, 3);
    assert.equal(ends(f.sink).at(-1)?.waited_ms, 1500);
    assert.equal((ends(f.sink).at(-1)?.result as Record<string, unknown>).ok, true);
    p.selectorNext = async () => { throw new Error('private-query'); };
    await assert.rejects(f.clients.ebay.page(ebayUrl, signal()), /browser read failed/);
    assert.doesNotMatch(f.sink.text(), /private-query/);
  } finally { await f.clients.close(); }
});
