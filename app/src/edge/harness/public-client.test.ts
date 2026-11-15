import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DOMParser } from '@xmldom/xmldom';
import { ebayListingSpec, ebayPageAdapters, searchRows, PAGE_HOSTS } from './sites/ebay/adapter.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import type { Launcher, PoolContext } from '../browser/pool.ts';
import { EBAY_FIRST_CARD_MS, publicClients, type PublicPage } from './public-client.ts';
import { API, WWW, depopAdapters } from './sites/depop/adapter.ts';
import { createSiteService } from './service.ts';
import { memoryStore } from '../events/ports.ts';
import { createReadLedger } from './read-ledger.ts';
import { memoryStore as paramStore } from '../../engines/param/param.ts';

function isolatedDocument(html: string): Document {
  // A browser keeps the open ancestors of a streamed document; xmldom needs their end tags.
  if (/<html[\s>]/i.test(html) && !/<\/html>/i.test(html)) html += '</body></html>';
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
  arrival?: { html: string; ms: number };
  additions: { html?: string; ms: number; readyState?: DocumentReadyState }[] = [];
  readyState: DocumentReadyState = 'complete';
  observers = 0;
  disconnectedObservers = 0;
  contentReads = 0;
  events = new Map<string, Set<() => void>>();
  gotoNext?: () => Promise<void>;
  contentNext?: () => Promise<void>;
  evaluated: string[] = [];
  fetches: { url: string; init?: RequestInit }[] = [];
  async goto(url: string, options: { waitUntil: 'domcontentloaded' | 'commit'; timeout: number }) {
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
    if (typeof fn === 'string' || typeof arg === 'object') {
      let clock = 0, next = 0;
      const tasks = new Map<number, { at: number; fn: () => void }>();
      const schedule = (fn: () => void, ms: number) => { tasks.set(++next, { at: clock + ms, fn }); return next; };
      const page = this;
      const listeners = new Set<() => void>();
      let currentHtml: string | undefined, currentDocument: Document;
      const document = new Proxy({} as Document, { get(_target, key) {
        if (key === 'readyState') return page.readyState;
        if (key === 'addEventListener') return (_event: string, listener: () => void) => listeners.add(listener);
        if (key === 'removeEventListener') return (_event: string, listener: () => void) => listeners.delete(listener);
        if (currentHtml !== page.html) { currentHtml = page.html; currentDocument = isolatedDocument(page.html); }
        const doc = currentDocument, value = Reflect.get(doc, key);
        return typeof value === 'function' ? value.bind(doc) : value;
      } });
      class MutationObserver {
        active = false;
        callback: () => void;
        constructor(callback: () => void) { this.callback = callback; }
        observe(target: Document, options: MutationObserverInit) {
          assert.equal(target, document); assert.deepEqual({ ...options }, { childList: true, subtree: true });
          this.active = true; page.observers++;
          if (page.arrival) schedule(() => { page.html = page.arrival!.html; if (this.active) this.callback(); }, page.arrival.ms);
          for (const addition of page.additions) schedule(() => {
            if (addition.html !== undefined) page.html = addition.html;
            if (addition.readyState) { page.readyState = addition.readyState; for (const listener of listeners) listener(); }
            if (this.active) this.callback();
          }, addition.ms);
        }
        disconnect() { this.active = false; page.disconnectedObservers++; }
      }
      const result = runInNewContext(typeof fn === 'string' ? fn : `(${fn.toString()})(input)`, {
        input: arg, document, URL, MutationObserver, performance: { now: () => clock },
        setTimeout: schedule, clearTimeout: (id: number) => tasks.delete(id),
      }) as T;
      while (tasks.size) {
        const [id, task] = [...tasks].sort((a, b) => a[1].at - b[1].at)[0]!;
        tasks.delete(id); clock = task.at; task.fn(); await Promise.resolve();
      }
      return await result;
    }
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
    assert.deepEqual(f.contexts[0].page.selectors, []);
    assert.ok(f.contexts[0].page.navigations.every(n => n.waitUntil === 'commit'));
    assert.ok(f.contexts[1].page.navigations.every(n => n.waitUntil === 'domcontentloaded'));
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
const partial = recorded.slice(0, recorded.lastIndexOf('</ul>'));
const placeholder = recorded.slice(0, recorded.indexOf('<li class="s-card', recorded.indexOf('<li class="s-card') + 1));
const recordedCard = recorded.split(/(?=<li\b[^>]*class="s-card\s)/)[2]!;
const largePage = '<html><body><h1 id="srp-results-heading">240 results</h1><ul>' +
  Array.from({ length: 240 }, (_, i) => recordedCard.replaceAll('387080178732', String(900000000000 + i))).join('') + '</ul></body></html>';

for (const site of ['ebay', 'depop'] as const) test(`${site} service cancellation stops a slow browser read, frees its lane and counts timed_out`, async () => {
  const f = setup(), ctl = new AbortController(), hold = deferred<void>();
  const log = createLog({ src: 'cancel.test', build: 'test', sink: memorySink() });
  const ledger = createReadLedger({ now: Date.now, log, params: paramStore() });
  const service = createSiteService(site, site === 'ebay' ? ebayPageAdapters(f.clients.ebay) : depopAdapters(f.clients.depop), {
    log, ledger, concurrency: 1, store: memoryStore(), data: 'synthetic', timeoutMs: 100,
  });
  try {
    if (site === 'ebay') await f.clients.ebay.page(ebayUrl, signal());
    else await f.clients.depop.doc(depopUrl, signal());
    f.contexts[0].page.gotoNext = () => hold.promise;
    const pending = service.call('search', { q: 'synthetic' }, { signal: ctl.signal });
    await turn();
    const next = service.call('search', { q: 'synthetic' });
    const start = performance.now(); ctl.abort();
    const result = await pending;
    assert.ok(performance.now() - start < 30, 'cancelled read must release the service without waiting for its deadline');
    assert.ok(!result.ok);
    assert.equal(ledger.counts(site)[0]!.classes.timed_out, 1);
    assert.equal(ledger.counts(site)[0]!.classes.refused, 0);
    assert.equal(ledger.paused(site), undefined);
    await next;
    assert.ok(performance.now() - start < 30, 'the next site read must start without waiting for the abandoned navigation');
    assert.equal(f.contexts.length, 2);
    assert.equal(f.contexts[0].closes, 1);
    assert.equal(service.running(), 0);
    assert.equal(service.queued(), 0);
  } finally { hold.resolve(); await f.clients.close(); }
});

test('warm reports only an open live page on the requested site', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup({ idleMs: 100 }), ctl = new AbortController(), launch = deferred<void>();
  try {
    assert.equal(f.clients.warm('ebay'), false); assert.equal(f.clients.warm('depop'), false);
    f.launchWith(() => launch.promise);
    const pending = f.clients.depop.doc(depopUrl, signal()); await turn();
    assert.equal(f.clients.warm('depop'), false, 'a pending browser launch is not warm');
    launch.resolve(); await pending;
    assert.equal(f.clients.warm('depop'), true); assert.equal(f.clients.warm('ebay'), false);
    f.contexts[0].page.gotoNext = () => new Promise(() => {});
    const read = f.clients.depop.doc(depopUrl, ctl.signal); await turn(); ctl.abort();
    await assert.rejects(read, { name: 'AbortError' });
    assert.equal(f.clients.warm('depop'), false);
    await f.clients.ebay.page(ebayUrl, signal()); assert.equal(f.clients.warm('ebay'), true);
    f.contexts[1].disconnect(); assert.equal(f.clients.warm('ebay'), false);
    await f.clients.ebay.page(ebayUrl, signal());
    t.mock.timers.tick(100); await turn(); assert.equal(f.clients.warm('ebay'), false);
    await f.clients.depop.doc(depopUrl, signal()); await f.clients.close();
    assert.equal(f.clients.warm('depop'), false);
  } finally { launch.resolve(); await f.clients.close(); }
});

for (const [name, html] of [['partial list', partial], ['complete list', recorded], ['240-card list', largePage]]) test(`eBay ${name} parses in the page with server parity`, async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal());
    const p = f.contexts[0].page; p.html = html; p.contentReads = 0;
    p.readyState = html === partial ? 'loading' : 'complete';
    const before = p.evaluated.length;
    const result = await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {});
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { status: 200, ...searchRows(html, 'live', PAGE_HOSTS[0]) });
    assert.equal(p.contentReads, 0); assert.equal(p.evaluated.length - before, 1);
    assert.equal(ends(f.sink).at(-1)?.waited_ms, html === partial ? 150 : 0);
  } finally { await f.clients.close(); }
});

for (const end of ['quiet', 'ready', 'cap', 'late_first'] as const) test(`eBay waits past the placeholder for streamed cards until ${end}`, async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal());
    const p = f.contexts[0].page; p.html = placeholder; p.readyState = 'loading'; p.contentReads = 0;
    const one = recorded.slice(0, recorded.indexOf('<li class="s-card', recorded.indexOf('data-item-pos="1"')));
    const first = end === 'late_first' ? 300 : 100;
    p.additions = [
      { ms: first, html: one },
      { ms: first + 120, html: partial },
      { ms: first + 200, html: partial + '<span>unrelated mutation</span>' },
      ...(end === 'ready' ? [{ ms: 240, readyState: 'interactive' as const }] : []),
      ...(end === 'cap' ? Array.from({ length: 50 }, (_, i) => ({ ms: 320 + i * 120,
        html: partial + '<li class="s-card" data-listingid="999"><span class="s-card__price">$1</span></li>'.repeat(i + 1) })) : []),
    ];
    const before = p.evaluated.length;
    const result = await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {});
    assert.ok(!('html' in result), 'the placeholder must not trigger zero_cards fallback');
    assert.ok(result.rows.length >= 3);
    assert.equal(p.contentReads, 0); assert.equal(p.evaluated.length - before, 1);
    assert.equal(ends(f.sink).at(-1)?.waited_ms, end === 'cap' ? EBAY_FIRST_CARD_MS : end === 'ready' ? 240 : first + 270);
    assert.equal(p.observers, p.disconnectedObservers);
  } finally { await f.clients.close(); }
});

test('eBay stops waiting when a streaming document becomes interactive without cards and retains fallback', async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal());
    const p = f.contexts[0].page; p.html = '<title>Changed</title>'; p.readyState = 'loading'; p.contentReads = 0;
    p.additions = [{ ms: 25, readyState: 'interactive' }];
    const result = await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {});
    assert.deepEqual(result, { status: 200, html: p.html });
    assert.equal(ends(f.sink).at(-1)?.waited_ms, 25);
    assert.equal(ends(f.sink).at(-1)?.fallback, 'page_state');
    assert.equal(p.contentReads, 1); assert.equal(p.observers, p.disconnectedObservers);
  } finally { await f.clients.close(); }
});

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

for (const fault of ['throw', 'result_null', 'bad_state', 'primitive_state', 'bad_wait', 'null', 'bad_rows', 'bad_counts', 'extra_html', 'zero'] as const) test(`eBay ${fault} evaluation uses HTML fallback and records why without raw errors`, async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal());
    const p = f.contexts[0].page; p.html = recorded;
    const empty = { rows: [], dropped: 0, total: 0, facts: 0, narrowed_out: 0 };
    const state = { blocked: false, signin: false, error: false, heading: true, empty: false };
    p.evaluate = async (fn, arg) => {
      if (fault === 'throw') throw new Error('private-query https://vendor.invalid/secret');
      if (fault === 'result_null') return null as never;
      if (fault === 'primitive_state') return { state: 1, parsed: empty, waited_ms: 0 } as never;
      if (fault === 'bad_state') return { state: {}, parsed: empty, waited_ms: 0 } as never;
      if (fault === 'bad_wait') return { state, parsed: empty, waited_ms: -1 } as never;
      return { state, waited_ms: 0, parsed: (fault === 'null' ? null : fault === 'bad_rows' ? { ...empty, total: 1, rows: [{ item_id: '1' }] } : fault === 'bad_counts' ? { ...empty, total: -1 } : fault === 'extra_html' ? { ...empty, html: 'page bytes' } : empty) } as never;
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

test('a card already present skips waiting and uses exactly one evaluate after commit', async () => {
  const f = setup({ now: () => 7 });
  try {
    await f.clients.ebay.page(ebayUrl, signal());
    const p = f.contexts[0].page; p.html = recorded;
    const before = p.evaluated.length;
    const result = await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {});
    assert.ok(!('html' in result)); assert.equal(result.rows.length, 3);
    assert.equal(p.evaluated.length - before, 1); assert.equal(p.observers, 1); // only the initial blank page waited
    assert.equal(ends(f.sink).at(-1)?.waited_ms, 0);
    assert.equal(ends(f.sink).at(-1)?.nav_ms, 0);
    assert.equal(p.navigations.at(-1)?.waitUntil, 'commit'); assert.deepEqual(p.selectors, []);
  } finally { await f.clients.close(); }
});

test('a card arriving after commit wakes the observer before the first-card cap', async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal()); const p = f.contexts[0].page;
    p.html = '<title>Loading</title>'; p.arrival = { html: recorded, ms: 42 };
    const before = p.evaluated.length;
    const result = await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {});
    assert.ok(!('html' in result)); assert.equal(result.rows.length, 3);
    assert.equal(p.evaluated.length - before, 1);
    const waited = Number(ends(f.sink).at(-1)?.waited_ms);
    assert.equal(waited, 42); assert.ok(waited > 0 && waited < EBAY_FIRST_CARD_MS);
    assert.equal(p.observers, p.disconnectedObservers);
  } finally { await f.clients.close(); }
});

for (const heading of [true, false]) test(`no card by the cap falls back once with ${heading ? 'zero_cards' : 'page_state'}`, async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal()); const p = f.contexts[0].page;
    p.html = `<title>Search</title>${heading ? '<h1 id="srp-results-heading">Results</h1>' : ''}`;
    p.contentReads = 0;
    assert.deepEqual(await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {}), { status: 200, html: p.html });
    assert.equal(p.contentReads, 1); assert.equal(ends(f.sink).at(-1)?.waited_ms, EBAY_FIRST_CARD_MS);
    assert.equal(ends(f.sink).at(-1)?.fallback, heading ? 'zero_cards' : 'page_state');
    assert.equal(p.observers, p.disconnectedObservers);
  } finally { await f.clients.close(); }
});

test('a destroyed evaluate context falls back once without another navigation', async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal()); const p = f.contexts[0].page;
    p.html = recorded; p.contentReads = 0;
    p.evaluateNext = () => { throw new Error('Execution context was destroyed ?private-query'); };
    const before = p.navigations.length;
    assert.deepEqual(await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {}), { status: 200, html: recorded });
    assert.equal(p.contentReads, 1); assert.equal(p.navigations.length - before, 1);
    assert.equal(ends(f.sink).at(-1)?.fallback, 'evaluation'); assert.doesNotMatch(f.sink.text(), /private-query/);
  } finally { await f.clients.close(); }
});

test('a challenge title takes page_state without parsing or navigating a second time', async () => {
  const f = setup();
  try {
    await f.clients.ebay.page(ebayUrl, signal()); const p = f.contexts[0].page;
    p.html = '<title>Pardon Our Interruption...</title>'; p.contentReads = 0;
    const before = p.navigations.length, evaluations = p.evaluated.length;
    assert.deepEqual(await f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {}), { status: 200, html: p.html });
    assert.equal(p.contentReads, 1); assert.equal(p.navigations.length - before, 1);
    assert.equal(p.evaluated.length - evaluations, 1); assert.equal(ends(f.sink).at(-1)?.fallback, 'page_state');
    assert.equal(p.routes, 0); assert.equal(p.interceptions, 0);
  } finally { await f.clients.close(); }
});

test('the read deadline still bounds an evaluate waiting for its first card', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup({ timeoutMs: 25 }), hold = deferred<void>();
  try {
    await f.clients.ebay.page(ebayUrl, signal()); const p = f.contexts[0].page;
    p.evaluate = async () => hold.promise as Promise<never>;
    const read = f.clients.ebay.listings!(ebayUrl, signal(), ebayListingSpec(), {});
    const rejected = assert.rejects(read, { name: 'TimeoutError' });
    await turn(); t.mock.timers.tick(25); await rejected;
    assert.equal(f.contexts[0].closes, 1);
  } finally { hold.resolve(); await f.clients.close(); }
});
