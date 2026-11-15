// Fetch and render: the hedged waterfall (engine doc §3.1 steps 4-6, §5). Plain fetch first; when it is slow (past its p95) or its
// page lacks what the caller needs, the render rung starts in parallel; the first good page wins and the other is cancelled.
// Per-domain limiter (1-3 s jittered, backoff on 429/503, 60 s ceiling), a semaphore per route with three priority classes that age.
// A block (bot check) is recorded as `blocked` and never retried, never rendered around.
import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLog, consoleSink, type Log } from '../../../../log/index.js';
const log = createLog({ src: 'intel.fetch', build: process.env.BUILD_SHA ?? 'dev', sink: consoleSink });
import type { Searched, Outcome } from './answer.ts';

export type Rung = 'plain' | 'render';
export type Priority = 'person' | 'gather' | 'refresh';
const CLASS: Record<Priority, number> = { person: 0, gather: 1, refresh: 2 };

// The hosted browser pool (task bp-1) implements this; `agentBrowserRenderer` below is the local one.
export interface Renderer {
  render(url: string, o: { deadline_ms: number; signal: AbortSignal }): Promise<{ status: number; html: string; final_url: string }>;
}

export interface Clock { now(): number; sleep(ms: number, signal?: AbortSignal): Promise<void> }
export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) => new Promise<void>(resolve => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(done, ms); function done() { signal?.removeEventListener('abort', stop); resolve(); }
    function stop() { clearTimeout(t); done(); }
    signal?.addEventListener('abort', stop, { once: true });
  }),
};

export interface FetchParams {
  p95_ms: number;                        // plain fetch past this starts the render rung in parallel
  base_delay_ms: [number, number];       // jittered gap between two requests to one domain
  backoff_ms: number;                    // first 429/503 wait without Retry-After; doubles each time
  ceiling_ms: number;                    // no wait is ever longer
  max_retries: number;                   // 429/503 retries before giving up
  route_concurrency: Record<Rung, number>;
  age_ms: number;                        // a waiting job moves up one class per this long
}
export const DEFAULT_PARAMS: FetchParams = {
  p95_ms: 1500, base_delay_ms: [1000, 3000], backoff_ms: 2000, ceiling_ms: 60_000, max_retries: 3,
  route_concurrency: { plain: 2, render: 1 }, age_ms: 30_000,
};

export interface Page {
  ok: true; html: string; status: number; final_url: string; rung: Rung; ms: number;
  etag?: string; last_modified?: string; cached?: true; searched: Searched[];
}
export interface PageFail { ok: false; kind: 'not_found' | 'blocked' | 'timeout'; reason: string; status?: number; ms: number; searched: Searched[] }
export type PageResult = Page | PageFail;

export interface FetchOpts {
  deadline_ms: number;
  need?: (html: string) => boolean;      // false means the page lacks the fields: render is tried
  renderer?: Renderer;
  fetchImpl?: typeof fetch;
  log?: Log;
  priority?: Priority;
}

// --- block detection (crawl4ai's layered idea: status first, then body markers) ---
const MARKERS = /captcha|are you a (human|robot)|unusual traffic|cf-chl|cf-challenge|just a moment|access denied|px-captcha|verify you are (a )?human|robot check|pardon our interruption|security check/i;
export function detectBlock(status: number, html: string): boolean {
  if (status === 403) return true;
  if ([429, 503].includes(status) && MARKERS.test(html)) return true;
  return status >= 200 && status < 300 && html.length < 15_000 && MARKERS.test(html);
}

// --- semaphore with priority classes that age ---
export class Semaphore {
  private free: number;
  private now: () => number;
  private ageMs: number;
  private q: { cls: number; at: number; go: () => void }[] = [];
  constructor(size: number, now: () => number, ageMs: number) { this.free = size; this.now = now; this.ageMs = ageMs; }
  acquire(p: Priority): Promise<() => void> {
    return new Promise(res => {
      const release = () => { this.free++; this.pump(); };
      this.q.push({ cls: CLASS[p], at: this.now(), go: () => { this.free--; res(release); } });
      this.pump();
    });
  }
  private pump() {
    while (this.free > 0 && this.q.length) {
      const t = this.now(), eff = (j: { cls: number; at: number }) => Math.max(0, j.cls - Math.floor((t - j.at) / this.ageMs));
      let best = 0;
      this.q.forEach((j, i) => { const b = this.q[best]; if (eff(j) < eff(b) || (eff(j) === eff(b) && j.at < b.at)) best = i; });
      this.q.splice(best, 1)[0]!.go();
    }
  }
}

interface Attempt { rung: Rung; status?: number; html?: string; final_url?: string; etag?: string; last_modified?: string; cached?: boolean;
  state: 'ok' | 'blocked' | 'gone' | 'rate_limited' | 'error' | 'aborted'; reason?: string; ms: number }

export function createFetcher(cfg: { params?: Partial<FetchParams>; clock?: Clock; random?: () => number } = {}) {
  const P = { ...DEFAULT_PARAMS, ...cfg.params }, clock = cfg.clock ?? realClock, random = cfg.random ?? Math.random;
  const next = new Map<string, number>(), hold = new Map<string, number>(), sems = new Map<string, Semaphore>();
  const cache = new Map<string, { etag?: string; last_modified?: string; html: string; status: number; final_url: string }>();

  // The next free slot for this domain; the slot after it is pushed out by a jittered 1-3 s.
  async function turn(host: string, signal: AbortSignal) {
    const t = clock.now(), at = Math.max(t, next.get(host) ?? 0, hold.get(host) ?? 0);
    next.set(host, at + P.base_delay_ms[0] + random() * (P.base_delay_ms[1] - P.base_delay_ms[0]));
    if (at > t) await clock.sleep(at - t, signal);
  }
  const sem = (key: string, rung: Rung) => { let s = sems.get(key); if (!s) sems.set(key, s = new Semaphore(P.route_concurrency[rung], clock.now, P.age_ms)); return s; };

  async function plain(url: string, host: string, o: FetchOpts, signal: AbortSignal, t0: number): Promise<Attempt> {
    const f = o.fetchImpl ?? fetch, log = o.log;
    for (let n = 0; ; n++) {
      await turn(host, signal);
      if (signal.aborted) return { rung: 'plain', state: 'aborted', ms: clock.now() - t0 };
      const prior = cache.get(url), headers: Record<string, string> = { 'user-agent': 'Mozilla/5.0 (compatible; secondhand-research/0.1)', accept: 'text/html,application/xhtml+xml' };
      if (prior?.etag) headers['if-none-match'] = prior.etag;
      if (prior?.last_modified) headers['if-modified-since'] = prior.last_modified;
      let res: Response, html = '';
      try {
        const run = async () => { const r = await f(url, { signal, headers, redirect: 'follow' }); return [r, r.status === 304 ? '' : await r.text()] as const; };
        [res, html] = log ? await log.call('http', 'fetch.plain', { host, try: n }, run, ([r, h]) => ({ status: r.status, len: h.length })) : await run();
      } catch (e) {
        return { rung: 'plain', state: signal.aborted ? 'aborted' : 'error', reason: String((e as Error)?.message ?? e), ms: clock.now() - t0 };
      }
      const status = res.status, final_url = res.url || url, ms = clock.now() - t0;
      if (status === 304 && prior) { log?.note('fetch.304', { host }); return { rung: 'plain', status: 200, html: prior.html, final_url: prior.final_url, etag: prior.etag, last_modified: prior.last_modified, cached: true, state: 'ok', ms }; }
      if (detectBlock(status, html)) { log?.note('fetch.blocked', { host, status }, 'warn'); return { rung: 'plain', status, state: 'blocked', reason: `status ${status} with a block marker`, ms }; }
      if (status === 429 || status === 503) {
        if (n >= P.max_retries) return { rung: 'plain', status, state: 'rate_limited', reason: `${status} after ${n} retries`, ms };
        const ra = Number(res.headers.get('retry-after')), wait = Math.min(P.ceiling_ms, Number.isFinite(ra) && ra > 0 ? ra * 1000 : P.backoff_ms * 2 ** n);
        if (clock.now() + wait - t0 >= (o.deadline_ms)) return { rung: 'plain', status, state: 'rate_limited', reason: `${status}, wait ${wait} ms passes the deadline`, ms };
        hold.set(host, Math.max(hold.get(host) ?? 0, clock.now() + wait)); // the whole domain backs off, not just this call
        log?.note('fetch.backoff', { host, status, wait_ms: wait }, 'warn');
        continue;
      }
      if (status === 404 || status === 410) return { rung: 'plain', status, state: 'gone', ms };
      if (status >= 400) return { rung: 'plain', status, state: 'error', reason: `status ${status}`, ms };
      const etag = res.headers.get('etag') ?? undefined, last_modified = res.headers.get('last-modified') ?? undefined;
      if (etag || last_modified) { if (cache.size >= 200) cache.delete(cache.keys().next().value!); cache.set(url, { etag, last_modified, html, status, final_url }); }
      return { rung: 'plain', status, html, final_url, etag, last_modified, state: 'ok', ms };
    }
  }

  async function render(url: string, host: string, o: FetchOpts, signal: AbortSignal, t0: number): Promise<Attempt> {
    const log = o.log, left = Math.max(1, o.deadline_ms - (clock.now() - t0));
    try {
      await turn(host, signal);
      if (signal.aborted) return { rung: 'render', state: 'aborted', ms: clock.now() - t0 };
      const run = () => o.renderer!.render(url, { deadline_ms: left, signal });
      const r = log ? await log.call('browser', 'fetch.render', { host }, run, x => ({ status: x.status, len: x.html.length })) : await run();
      const ms = clock.now() - t0;
      if (detectBlock(r.status, r.html)) { log?.note('fetch.blocked', { host, status: r.status, rung: 'render' }, 'warn'); return { rung: 'render', status: r.status, state: 'blocked', reason: 'block marker on the rendered page', ms }; }
      if (r.status === 404 || r.status === 410) return { rung: 'render', status: r.status, state: 'gone', ms };
      if (r.status >= 400) return { rung: 'render', status: r.status, state: 'error', reason: `status ${r.status}`, ms };
      return { rung: 'render', status: r.status, html: r.html, final_url: r.final_url, state: 'ok', ms };
    } catch (e) {
      return { rung: 'render', state: signal.aborted ? 'aborted' : 'error', reason: String((e as Error)?.message ?? e), ms: clock.now() - t0 };
    }
  }

  async function fetchPage(url: string, o: FetchOpts): Promise<PageResult> {
    const t0 = clock.now(), host = new URL(url).host, pri = o.priority ?? 'person', log = o.log;
    const ctl = new AbortController(), stop = new AbortController(), signal = ctl.signal;
    void clock.sleep(o.deadline_ms, stop.signal).then(() => { if (!stop.signal.aborted) ctl.abort(); });
    const via = async (rung: Rung) => {
      const release = await sem(`${rung}:${host}`, rung).acquire(pri);
      try { return await (rung === 'plain' ? plain(url, host, o, signal, t0) : render(url, host, o, signal, t0)); } finally { release(); }
    };
    const good = (a: Attempt) => a.state === 'ok' && (!o.need || o.need(a.html!));
    const running = new Map<Rung, Promise<Attempt>>(), done: Attempt[] = [];
    const start = (r: Rung) => { running.set(r, via(r).then(a => { running.delete(r); return a; })); };
    start('plain');
    let hedge: Promise<'hedge'> | null = o.renderer ? clock.sleep(P.p95_ms, stop.signal).then(() => 'hedge' as const) : null;
    let win: Attempt | undefined;
    while (running.size && !win) {
      const first = await Promise.race<Attempt | 'hedge'>([...running.values(), ...(hedge ? [hedge] : [])]);
      if (first === 'hedge') {
        hedge = null;
        if (!stop.signal.aborted && !running.has('render') && !done.some(d => d.rung === 'render')) { log?.note('fetch.hedge', { host, p95_ms: P.p95_ms }); start('render'); }
        continue;
      }
      done.push(first);
      if (good(first)) win = first;
      else if (first.state === 'blocked') break; // a block is final: no other rung routes around it
      else if (first.rung === 'plain' && o.renderer && !running.has('render') && (first.state === 'ok' || first.state === 'error')) start('render'); // missing fields, or plain failed outright
    }
    stop.abort(); ctl.abort(); // the loser is cancelled
    const ms = clock.now() - t0;
    const searched: Searched[] = done.map(a => ({ route_id: `fetch.${a.rung}:${host}`, query: url, ms: a.ms,
      outcome: (a.state === 'ok' ? (win === a ? 'hit' : 'empty') : a.state === 'blocked' ? 'blocked' : a.state === 'gone' ? 'empty' : 'timeout') as Outcome }));
    if (win) return { ok: true, html: win.html!, status: win.status!, final_url: win.final_url!, rung: win.rung, ms, etag: win.etag, last_modified: win.last_modified,
      ...(win.cached ? { cached: true as const } : {}), searched };
    const blocked = done.find(a => a.state === 'blocked');
    if (blocked) return { ok: false, kind: 'blocked', reason: blocked.reason!, status: blocked.status, ms, searched };
    const seen = done.find(a => a.state === 'gone' || a.state === 'ok'); // a page came back and had no product, or the url is gone
    if (seen) return { ok: false, kind: 'not_found', reason: seen.state === 'gone' ? `status ${seen.status}` : 'page has no product', status: seen.status, ms, searched };
    const last = done[done.length - 1];
    return { ok: false, kind: 'timeout', reason: last?.reason ?? (signal.aborted ? 'deadline' : 'no result'), status: last?.status, ms, searched };
  }
  return { fetchPage, params: P };
}

let shared: ReturnType<typeof createFetcher> | undefined;
// The process-wide fetcher: one limiter and one cache for every caller, so domains are paced across the whole process.
export const fetchPage = (url: string, o: FetchOpts): Promise<PageResult> => (shared ??= createFetcher()).fetchPage(url, o);

// --- the local renderer: drives the agent-browser CLI, one browser at a time, always closed ---
export function agentBrowserRenderer(o: { bin?: string } = {}): Renderer {
  const win = join(process.env.APPDATA ?? '', 'npm/node_modules/agent-browser/bin/agent-browser-win32-x64.exe');
  const bin = o.bin ?? (process.platform === 'win32' && existsSync(win) ? win : 'agent-browser');
  // The CLI starts a daemon that keeps inherited pipes open, so output goes to a file and we wait for the exit, not for the pipe to close.
  const run = (args: string[], ms: number, signal: AbortSignal) => new Promise<string>((res, rej) => {
    if (signal.aborted) return rej(new Error('aborted'));
    const dir = mkdtempSync(join(tmpdir(), 'fr-')), f = join(dir, 'out'), fd = openSync(f, 'w');
    const cp = spawn(bin, args, { stdio: ['ignore', fd, 'ignore'], windowsHide: true });
    const done = (e?: Error) => { clearTimeout(t); signal.removeEventListener('abort', stop); closeSync(fd); const out = e ? '' : readFileSync(f, 'utf8'); rmSync(dir, { recursive: true, force: true }); e ? rej(e) : res(out); };
    const stop = () => { cp.kill(); done(new Error('aborted')); };
    const t = setTimeout(() => { cp.kill(); done(new Error(`agent-browser ${args[2] ?? ''} timed out`)); }, ms);
    signal.addEventListener('abort', stop, { once: true });
    cp.on('error', done); cp.on('exit', c => c === 0 ? done() : done(new Error(`agent-browser exited ${c}`)));
  });
  let queue: Promise<unknown> = Promise.resolve(); // shortcut: one browser per process at a time; the hosted pool (bp-1) lifts this
  return {
    render(url, { deadline_ms, signal }) {
      const job = queue.then(async () => {
        const session = `fr-${Date.now().toString(36)}`, S = ['--session', session];
        try {
          await run([...S, 'open', url], deadline_ms, signal);
          await run([...S, 'wait', '--load', 'networkidle'], Math.min(5000, deadline_ms), signal).catch(e => { log.error('fetch.renderer', e); }); // a page that never idles is read as it is
          const out = await run([...S, 'eval', "JSON.stringify({s:performance.getEntriesByType('navigation')[0]?.responseStatus||200,u:location.href,h:document.documentElement.outerHTML})"], 15_000, signal);
          let v: unknown = JSON.parse(out.trim()); if (typeof v === 'string') v = JSON.parse(v); // the CLI prints the string JSON-quoted
          const r = v as { s: number; u: string; h: string };
          return { status: r.s, html: r.h, final_url: r.u };
        } finally { await run([...S, 'close'], 10_000, new AbortController().signal).catch(e => { log.error('fetch.renderer', e); }); }
      });
      queue = job.catch(e => { log.error('fetch.renderer', e); });
      return job;
    },
  };
}
